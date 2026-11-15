"""Transactional graph projection over durable document mentions and assertions."""
import json
from collections import defaultdict, deque

from app.core.errors import IngestionError, NotFoundError
from app.graph.extraction import DEFAULT_ONTOLOGY, entity_id, extract, identifier
from app.models.graph import DocumentExtraction, EntityDetail, EntityModel, EvidenceModel, GraphBuildRequest, GraphBuildResult, GraphDocumentStatus, GraphPathRequest, GraphPathResult, GraphResponse, MentionModel, RelationCandidate, RelationModel, RelationPage
from app.models.ingestion import ChunkModel, DocumentModel, ProcessingStatus
from app.repositories.sqlite_ingestion import SQLiteIngestionRepository


class SQLiteGraphRepository:
    def __init__(self, ingestion: SQLiteIngestionRepository, ontology=DEFAULT_ONTOLOGY) -> None:
        self.ingestion = ingestion
        self.ontology = ontology
        with ingestion.connect() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS graph_meta (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL);
                INSERT OR IGNORE INTO graph_meta VALUES (1,0);
                CREATE TABLE IF NOT EXISTS graph_documents (document_id TEXT PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE, configuration TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS graph_mentions (id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE, body TEXT NOT NULL);
                CREATE INDEX IF NOT EXISTS mentions_document ON graph_mentions(document_id);
                CREATE TABLE IF NOT EXISTS graph_candidates (id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE, body TEXT NOT NULL);
                CREATE INDEX IF NOT EXISTS candidates_document ON graph_candidates(document_id);
                CREATE TABLE IF NOT EXISTS graph_entities (id TEXT PRIMARY KEY, body TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS graph_relations (id TEXT PRIMARY KEY, body TEXT NOT NULL);
                CREATE INDEX IF NOT EXISTS chunks_id ON chunks(json_extract(body,'$.chunk_id'));
            """)

    @staticmethod
    def version(db) -> str:
        return f"graph-sqlite-{db.execute('SELECT revision FROM graph_meta WHERE id=1').fetchone()[0]}"

    @staticmethod
    def bodies(db, table: str) -> dict[str, str]:
        # Table names are private constants, never request data.
        return dict(db.execute(f"SELECT id,body FROM {table}"))

    def project(self, db) -> tuple[dict[str, EntityModel], dict[str, RelationModel]]:
        mentions = [MentionModel.model_validate_json(row[0]) for row in db.execute("SELECT body FROM graph_mentions ORDER BY id")]
        candidates = [RelationCandidate.model_validate_json(row[0]) for row in db.execute("SELECT body FROM graph_candidates ORDER BY id")]
        grouped = defaultdict(list)
        for mention in mentions:
            if mention.accepted:
                grouped[mention.entity_id].append(mention)
        entities = {}
        catalog = {entity_id(item.name, item.kind): item for item in self.ontology.catalog}
        for eid, evidence in grouped.items():
            first = evidence[0]
            confidence = max(item.extraction_confidence for item in evidence)
            aliases = sorted(set(catalog[eid].aliases if eid in catalog else ()) | {item.surface_form for item in evidence if item.surface_form != first.canonical_name})
            entities[eid] = EntityModel(entity_id=eid, canonical_name=first.canonical_name, entity_type=first.entity_type, aliases=aliases, description="Recognized workspace concept. Inspect its source evidence for assertions.", source_chunks=sorted({item.source_chunk for item in evidence}), extraction_confidence=confidence, fuzzy_confidence=confidence, centrality_score=0, importance_score=confidence)
        grouped_relations = defaultdict(list)
        for candidate in candidates:
            if candidate.accepted and candidate.source_entity in entities and candidate.target_entity in entities:
                rid = identifier("relation", candidate.source_entity, candidate.relation_type, candidate.target_entity)
                grouped_relations[rid].append(candidate)
        relations = {}
        neighbors = defaultdict(set)
        for rid, evidence in grouped_relations.items():
            first = sorted(evidence, key=lambda item: (-item.extraction_confidence, item.candidate_id))[0]
            confidence = max(item.extraction_confidence for item in evidence)
            relations[rid] = RelationModel(relation_id=rid, source_entity=first.source_entity, target_entity=first.target_entity, relation_type=first.relation_type, evidence=first.evidence, source_chunk=first.source_chunk, source_chunks=sorted({item.source_chunk for item in evidence}), extraction_confidence=confidence, fuzzy_strength=confidence, semantic_strength=confidence, temporal_strength=1, final_weight=confidence)
            neighbors[first.source_entity].add(first.target_entity)
            neighbors[first.target_entity].add(first.source_entity)
        for eid, entity in entities.items():
            entity.centrality_score = len(neighbors[eid]) / max(1, len(entities) - 1)
            entity.importance_score = round(0.7 * entity.fuzzy_confidence + 0.3 * entity.centrality_score, 6)
        return entities, relations

    def save_projection(self, db, entities, relations) -> None:
        for table, models in (("graph_entities", entities), ("graph_relations", relations)):
            db.execute(f"DELETE FROM {table}")
            db.executemany(f"INSERT INTO {table} VALUES (?,?)", [(key, model.model_dump_json()) for key, model in sorted(models.items())])

    def build(self, request: GraphBuildRequest) -> GraphBuildResult:
        versions = {self.ontology.version, "healthcare-extractor-1"} if self.ontology.version == "healthcare-extractor-2" else {self.ontology.version}
        if request.extraction_configuration_version not in versions or request.fuzzy_configuration_version != "heuristic-confidence-1":
            raise IngestionError("Unsupported extraction or confidence configuration version.", "unsupported_configuration", 422)
        configuration = request.model_dump(exclude={"document_ids", "dry_run"}, mode="json")
        config_json = json.dumps(configuration, sort_keys=True)
        warnings = [] if self.ontology.open_relations else ["Workspace lexical extraction and confidence scores are untrained heuristics. Unknown concepts and complex predicates require later extractors."]
        with self.ingestion.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            before_entities, before_relations = self.bodies(db, "graph_entities"), self.bodies(db, "graph_relations")
            source_changed = False
            review_count = 0
            total_chunks = 0
            total_candidates = 0
            for document_id in sorted(set(request.document_ids)):
                row = db.execute("SELECT body FROM documents WHERE id=?", (document_id,)).fetchone()
                if not row:
                    raise NotFoundError("document", document_id)
                document = DocumentModel.model_validate_json(row[0])
                if document.processing_status != ProcessingStatus.COMPLETED:
                    raise IngestionError("Only successfully ingested documents can be built.", "document_not_ready", 409)
                chunks = [ChunkModel.model_validate_json(row[0]) for row in db.execute("SELECT body FROM chunks WHERE document_id=? ORDER BY sequence", (document_id,))]
                total_chunks += len(chunks)
                if total_chunks > 5000:
                    raise IngestionError("Build at most 5,000 chunks per request; select fewer documents.", "build_limit", 413)
                mentions, candidates = extract(document_id, chunks, request, self.ontology)
                total_candidates += len(mentions) + len(candidates)
                if total_candidates > 20000:
                    raise IngestionError("Build at most 20,000 candidates per request; select fewer documents.", "build_limit", 413)
                review_count += sum(not item.accepted for item in mentions + candidates)
                if not mentions:
                    warnings.append(f"{document.name}: no recognizable graph concepts found. The source text remains searchable." if self.ontology.open_relations else f"{document.name}: no known course concepts found.")
                old_mentions = dict(db.execute("SELECT id,body FROM graph_mentions WHERE document_id=?", (document_id,)))
                old_candidates = dict(db.execute("SELECT id,body FROM graph_candidates WHERE document_id=?", (document_id,)))
                old_config = db.execute("SELECT configuration FROM graph_documents WHERE document_id=?", (document_id,)).fetchone()
                new_mentions = {item.mention_id: item.model_dump_json() for item in mentions}
                new_candidates = {item.candidate_id: item.model_dump_json() for item in candidates}
                source_changed |= old_mentions != new_mentions or old_candidates != new_candidates or old_config is None or old_config[0] != config_json
                db.execute("DELETE FROM graph_mentions WHERE document_id=?", (document_id,))
                db.execute("DELETE FROM graph_candidates WHERE document_id=?", (document_id,))
                db.executemany("INSERT INTO graph_mentions VALUES (?,?,?)", [(key, document_id, value) for key, value in new_mentions.items()])
                db.executemany("INSERT INTO graph_candidates VALUES (?,?,?)", [(key, document_id, value) for key, value in new_candidates.items()])
                db.execute("INSERT OR REPLACE INTO graph_documents VALUES (?,?)", (document_id, config_json))
            entities, relations = self.project(db)
            after_entities = {key: value.model_dump_json() for key, value in entities.items()}
            after_relations = {key: value.model_dump_json() for key, value in relations.items()}
            changed = source_changed or before_entities != after_entities or before_relations != after_relations
            def counts(before, after):
                return len(after.keys() - before.keys()), sum(before[key] != after[key] for key in before.keys() & after.keys()), len(before.keys() - after.keys())
            added_nodes, updated_nodes, removed_nodes = counts(before_entities, after_entities)
            added_relations, updated_relations, removed_relations = counts(before_relations, after_relations)
            if changed and not request.dry_run:
                self.save_projection(db, entities, relations)
                db.execute("UPDATE graph_meta SET revision=revision+1 WHERE id=1")
            version = self.version(db)
            if not request.dry_run:
                for document_id in sorted(set(request.document_ids)):
                    document = DocumentModel.model_validate_json(db.execute("SELECT body FROM documents WHERE id=?", (document_id,)).fetchone()[0])
                    document.graph_version = version
                    db.execute("UPDATE documents SET body=? WHERE id=?", (document.model_dump_json(), document_id))
            if request.dry_run:
                db.rollback()
            return GraphBuildResult(graph_version=version, added_nodes=added_nodes, updated_nodes=updated_nodes, removed_nodes=removed_nodes, added_relations=added_relations, updated_relations=updated_relations, removed_relations=removed_relations, review_count=review_count, changed=changed, dry_run=request.dry_run, warnings=warnings)

    def snapshot(self):
        with self.ingestion.connect() as db:
            db.execute("BEGIN")
            entities = [EntityModel.model_validate_json(row[0]) for row in db.execute("SELECT body FROM graph_entities ORDER BY id")]
            relations = [RelationModel.model_validate_json(row[0]) for row in db.execute("SELECT body FROM graph_relations ORDER BY id")]
            return entities, relations, self.version(db)

    def get_subgraph(self, entity_type=None, relation_type=None, source=None, minimum_confidence=0, cursor=None, limit=100) -> GraphResponse:
        entities, relations, version = self.snapshot()
        entities = [item for item in entities if (entity_type is None or item.entity_type == entity_type) and (source is None or source in item.source_chunks) and item.fuzzy_confidence >= minimum_confidence and (cursor is None or item.entity_id > cursor)]
        page = entities[:limit]
        ids = {item.entity_id for item in page}
        relations = [item for item in relations if item.source_entity in ids and item.target_entity in ids and (relation_type is None or item.relation_type == relation_type) and (source is None or source in item.source_chunks) and item.fuzzy_strength >= minimum_confidence]
        return GraphResponse(entities=page, relations=relations, graph_version=version, next_cursor=page[-1].entity_id if len(entities) > limit else None)

    def relation_page(self, cursor=None, limit=100, relation_type=None, source=None, minimum_confidence=0) -> RelationPage:
        entities, relations, version = self.snapshot()
        eligible = {item.entity_id for item in entities if item.fuzzy_confidence >= minimum_confidence}
        relations = [item for item in relations if item.source_entity in eligible and item.target_entity in eligible and (cursor is None or item.relation_id > cursor) and (relation_type is None or item.relation_type == relation_type) and (source is None or source in item.source_chunks) and item.fuzzy_strength >= minimum_confidence]
        page = relations[:limit]
        return RelationPage(relations=page, graph_version=version, next_cursor=page[-1].relation_id if len(relations) > limit else None)

    def extraction(self, document_id: str) -> DocumentExtraction:
        with self.ingestion.connect() as db:
            db.execute("BEGIN")
            if not db.execute("SELECT 1 FROM documents WHERE id=?", (document_id,)).fetchone():
                raise NotFoundError("document", document_id)
            row = db.execute("SELECT configuration FROM graph_documents WHERE document_id=?", (document_id,)).fetchone()
            return DocumentExtraction(document_id=document_id, graph_version=self.version(db), configuration=GraphBuildRequest(document_ids=[document_id], **json.loads(row[0])) if row else None, mentions=[MentionModel.model_validate_json(row[0]) for row in db.execute("SELECT body FROM graph_mentions WHERE document_id=? ORDER BY id", (document_id,))], relation_candidates=[RelationCandidate.model_validate_json(row[0]) for row in db.execute("SELECT body FROM graph_candidates WHERE document_id=? ORDER BY id", (document_id,))])

    def documents(self, limit: int) -> list[GraphDocumentStatus]:
        with self.ingestion.connect() as db:
            db.execute("BEGIN")
            documents = [DocumentModel.model_validate_json(row[0]) for row in db.execute("SELECT body FROM documents WHERE json_extract(body,'$.processing_status')='completed' ORDER BY rowid DESC LIMIT ?", (limit,))]
            result = []
            for document in documents:
                mentions = [MentionModel.model_validate_json(row[0]) for row in db.execute("SELECT body FROM graph_mentions WHERE document_id=?", (document.document_id,))]
                candidates = [RelationCandidate.model_validate_json(row[0]) for row in db.execute("SELECT body FROM graph_candidates WHERE document_id=?", (document.document_id,))]
                result.append(GraphDocumentStatus(document_id=document.document_id, name=document.name, built=bool(db.execute("SELECT 1 FROM graph_documents WHERE document_id=?", (document.document_id,)).fetchone()), accepted_mentions=sum(item.accepted for item in mentions), accepted_relations=sum(item.accepted for item in candidates), review_count=sum(not item.accepted for item in mentions + candidates)))
            return result

    def entity_detail(self, eid: str) -> EntityDetail:
        with self.ingestion.connect() as db:
            db.execute("BEGIN")
            row = db.execute("SELECT body FROM graph_entities WHERE id=?", (eid,)).fetchone()
            if not row:
                raise NotFoundError("entity", eid)
            entity = EntityModel.model_validate_json(row[0])
            mentions = [MentionModel.model_validate_json(row[0]) for row in db.execute("SELECT body FROM graph_mentions ORDER BY id")]
            mentions = [item for item in mentions if item.entity_id == eid]
            relations = [RelationModel.model_validate_json(row[0]) for row in db.execute("SELECT body FROM graph_relations ORDER BY id")]
            evidence_ids = set(entity.source_chunks)
            for relation in relations:
                if eid in {relation.source_entity, relation.target_entity}:
                    evidence_ids.update(relation.source_chunks)
            evidence = []
            for chunk_id in sorted(evidence_ids):
                row = db.execute("SELECT chunks.body,documents.body FROM chunks JOIN documents ON chunks.document_id=documents.id WHERE json_extract(chunks.body,'$.chunk_id')=?", (chunk_id,)).fetchone()
                if row is None:
                    raise IngestionError("Graph evidence refers to a missing source chunk.", "graph_integrity", 500)
                chunk = ChunkModel.model_validate_json(row[0])
                document = DocumentModel.model_validate_json(row[1])
                evidence.append(EvidenceModel(chunk_id=chunk.chunk_id, document_id=chunk.document_id, document_name=document.name, text=chunk.text, source_location=chunk.source_location))
            return EntityDetail(entity=entity, mentions=mentions, incoming=[item for item in relations if item.target_entity == eid], outgoing=[item for item in relations if item.source_entity == eid], evidence=evidence, graph_version=self.version(db))

    def path(self, request: GraphPathRequest) -> GraphPathResult:
        entities, relations, version = self.snapshot()
        by_id = {item.entity_id: item for item in entities}
        for eid in (request.source_entity, request.target_entity):
            if eid not in by_id:
                raise NotFoundError("entity", eid)
        eligible = {item.entity_id for item in entities if item.fuzzy_confidence >= request.minimum_confidence}
        adjacency = defaultdict(list)
        for relation in relations:
            if relation.fuzzy_strength < request.minimum_confidence or relation.source_entity not in eligible or relation.target_entity not in eligible or (request.relation_types and relation.relation_type not in request.relation_types):
                continue
            adjacency[relation.source_entity].append((relation.target_entity, relation))
            if not request.directed:
                adjacency[relation.target_entity].append((relation.source_entity, relation))
        queue = deque([(request.source_entity, [request.source_entity], [])])
        visited = {request.source_entity}
        while queue and request.source_entity in eligible and request.target_entity in eligible:
            current, ids, edges = queue.popleft()
            if current == request.target_entity:
                strength = min((edge.fuzzy_strength for edge in edges), default=1)
                return GraphPathResult(nodes=[by_id[eid] for eid in ids], relations=edges, path_score=strength, fuzzy_composed_strength=strength, graph_version=version)
            if len(edges) >= request.max_hops:
                continue
            for neighbor, relation in sorted(adjacency[current], key=lambda item: (item[0], item[1].relation_id)):
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append((neighbor, ids + [neighbor], edges + [relation]))
        return GraphPathResult(nodes=[], relations=[], path_score=0, fuzzy_composed_strength=0, graph_version=version)

    def remove_document(self, document_id: str) -> str:
        """Remove graph contributions, retaining the source so it can be rebuilt."""
        with self.ingestion.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            if not db.execute("SELECT 1 FROM documents WHERE id=?", (document_id,)).fetchone():
                raise NotFoundError("document", document_id)
            if db.execute("SELECT 1 FROM graph_documents WHERE document_id=?", (document_id,)).fetchone():
                db.execute("DELETE FROM graph_mentions WHERE document_id=?", (document_id,))
                db.execute("DELETE FROM graph_candidates WHERE document_id=?", (document_id,))
                db.execute("DELETE FROM graph_documents WHERE document_id=?", (document_id,))
                self.save_projection(db, *self.project(db))
                db.execute("UPDATE graph_meta SET revision=revision+1 WHERE id=1")
                document = DocumentModel.model_validate_json(db.execute("SELECT body FROM documents WHERE id=?", (document_id,)).fetchone()[0])
                document.graph_version = "unbuilt"
                db.execute("UPDATE documents SET body=? WHERE id=?", (document.model_dump_json(), document_id))
            return self.version(db)
