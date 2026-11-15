"""Versioned BM25 + bounded graph traversal with extractive, cited output.

Scores are transparent baselines. Neither term coverage nor fuzzy inference
proves that a passage answers a question; the UI calls the output excerpts.
"""
import json
import re
from collections import Counter, deque
from datetime import UTC, datetime
from hashlib import sha256
from math import log
from threading import Lock
from time import perf_counter
from uuid import uuid4

from app.core.errors import IngestionError, NotFoundError
from app.core.chunk_limits import validate_chunk, SENTENCES
from app.core.corpus_limits import MAX_CORPUS_CHUNKS, MAX_CORPUS_CHARACTERS
from app.fuzzy.engine import FuzzyEngine
from app.graph.extraction import DEFAULT_ONTOLOGY, entity_id
from app.models.fuzzy import FuzzyEvaluationRequest
from app.models.graph import EntityModel, RelationModel
from app.models.retrieval import Evidence, RetrievalPath, RetrievalRequest, RetrievalResult, ScoreContribution
from app.retrieval.provider import ProviderSettings, rerank, RERANK_TEMPERATURE, RERANK_MAX_TOKENS
from app.retrieval.ranker import load_ranker
from pathlib import Path


STOP = set("a an the is are was were be been being to of for in on at by with and or as it this that these those how what which tell me about explain please does do can related relate relationship between through using".split())
NORMAL = {"uses": "use", "used": "use", "supports": "support", "supported": "support", "improves": "improve", "improved": "improve", "tunes": "tune", "tuning": "tune", "explores": "explore", "combines": "combine", "relations": "relation", "algorithms": "algorithm", "weights": "weight", "graphs": "graph", "paths": "path"}


NORMAL.update({
    "requires": "require", "depends": "depend", "routes": "route", "triggers": "trigger",
    "verifies": "verify", "records": "record", "feeds": "feed", "documents": "document",
})


def terms(text: str, ontology=DEFAULT_ONTOLOGY) -> Counter:
    def canonical(match):
        concept = ontology.lookup[re.sub(r"[\s-]+", " ", match.group()).casefold()]
        return concept.name
    expanded = ontology.pattern.sub(canonical, text)
    return Counter(NORMAL.get(word, word) for word in re.findall(r"[^\W_]+", expanded.casefold()) if word not in STOP)


def sentence_index(text: str, ontology=DEFAULT_ONTOLOGY):
    validate_chunk(text)
    spans = []
    for match in SENTENCES.finditer(text):
        spans.append((match.start(), match.end(), frozenset(terms(match.group(), ontology))))
    return spans


def excerpt(text: str, query: set[str], sentences=None) -> str:
    # Exact, contiguous source text: no paraphrasing or removal of negation.
    sentences = sentence_index(text) if sentences is None else sentences
    if not sentences:
        return text[:2000]
    best = max(sentences, key=lambda span: len(query & span[2]))
    first = max(0, best[0] - 600)
    last = min(len(text), first + 2000)
    # Use sentence boundaries when possible; otherwise explicitly an excerpt.
    starts = [span[0] for span in sentences if first <= span[0] <= best[0]]
    ends = [span[1] for span in sentences if best[1] <= span[1] <= last]
    return text[min(starts) if starts else best[0]:max(ends) if ends else min(last, best[1])].strip()


def path_support(seeds, adjacency, ranked, max_hops, top_k):
    """Reserve actual citations for a short path between the two named concepts."""
    order = {item.chunk_id: index for index, (item, _) in enumerate(ranked)}
    source, target = seeds
    pending = deque([(source, ())])
    visited = {source}
    while pending:
        node, citations = pending.popleft()
        if node == target:
            return set(citations) if len(set(citations)) <= top_k else set()
        if len(citations) >= max_hops:
            continue
        for neighbor, edge in adjacency[node]:
            supporting = [cid for cid in (edge.source_chunks or [edge.source_chunk]) if cid in order]
            if neighbor not in visited and supporting:
                cid = min(supporting, key=order.__getitem__)
                visited.add(neighbor)
                pending.append((neighbor, (*citations, cid)))
    return set()


class RetrievalService:
    def terms(self, text):
        return terms(text, self.graph.ontology)

    MAX_CHUNKS = MAX_CORPUS_CHUNKS
    MAX_CHARACTERS = MAX_CORPUS_CHARACTERS
    MAX_RESULTS = 1000
    MAX_CANDIDATES = 200

    def __init__(self, ingestion, graph, provider_settings=None, provider_call=None, ranker_path=None, policy=None):
        self.ingestion, self.graph = ingestion, graph
        self.fuzzy = FuzzyEngine()
        self.policy = policy
        self.provider_settings = provider_settings or ProviderSettings.from_environment()
        self.provider_call = provider_call or rerank
        self._index_lock, self._provider_lock = Lock(), Lock()
        self._cache_key, self._corpus = None, None
        self.ranker, self.ranker_warning, self.candidate_observer = None, None, None
        if ranker_path:
            try:
                self.ranker = load_ranker(Path(ranker_path))
            except (OSError, ValueError):
                self.ranker_warning = "Configured ranking artifact was rejected; default baseline ranking is active."
        with ingestion.connect() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS retrieval_results (id TEXT PRIMARY KEY, body TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS retrieval_feedback (result_id TEXT PRIMARY KEY REFERENCES retrieval_results(id) ON DELETE CASCADE, rating TEXT NOT NULL, recorded_at TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS provider_usage (day TEXT PRIMARY KEY, attempts INTEGER NOT NULL);
                CREATE TABLE IF NOT EXISTS provider_cache (id TEXT PRIMARY KEY, body TEXT NOT NULL);
            """)

    def corpus(self):
        # One read transaction gives graph and source data the same snapshot.
        # Tokenization/postings are reused until the source manifest changes.
        with self._index_lock, self.ingestion.connect() as db:
            db.execute("BEGIN")
            documents = [json.loads(row[0]) for row in db.execute("SELECT body FROM documents WHERE json_extract(body,'$.processing_status')='completed' ORDER BY id")]
            index_version = self.index_version(documents)
            version = self.graph.version(db)
            cache_key = (index_version, version)
            if cache_key == self._cache_key:
                return self._corpus
            rows = db.execute("SELECT c.body FROM chunks c JOIN documents d ON c.document_id=d.id WHERE json_extract(d.body,'$.processing_status')='completed' ORDER BY c.document_id,c.sequence LIMIT ?", (self.MAX_CHUNKS + 1,)).fetchall()
            if len(rows) > self.MAX_CHUNKS:
                raise IngestionError("Retrieval corpus exceeds 20,000 chunks; partition the corpus before querying.", "retrieval_limit", 413)
            chunks = [json.loads(row[0]) for row in rows]
            if sum(len(chunk["text"]) for chunk in chunks) > self.MAX_CHARACTERS:
                raise IngestionError("Retrieval corpus exceeds 20 million characters.", "retrieval_limit", 413)
            entities = [EntityModel.model_validate_json(row[0]) for row in db.execute("SELECT body FROM graph_entities ORDER BY id")]
            relations = [RelationModel.model_validate_json(row[0]) for row in db.execute("SELECT body FROM graph_relations ORDER BY id")]
            candidates = [json.loads(row[0]) for row in db.execute("SELECT body FROM graph_candidates WHERE json_extract(body,'$.accepted')=1")]
            counters = [self.terms(chunk["text"]) for chunk in chunks]
            sentences = [sentence_index(chunk["text"], self.graph.ontology) for chunk in chunks]
            postings = {}
            for index, counter in enumerate(counters):
                for token in counter:
                    postings.setdefault(token, []).append(index)
            corpus = dict(chunks=chunks, entities=entities, relations=relations, candidates=candidates, counters=counters, sentences=sentences, postings=postings, documents={doc["document_id"]: doc for doc in documents}, average_length=sum(sum(counter.values()) for counter in counters) / max(1, len(counters)), index_version=index_version, graph_version=version)
            self._cache_key, self._corpus = cache_key, corpus
            return corpus

    @staticmethod
    def index_version(documents):
        manifest = [(doc["document_id"], doc["content_hash"]) for doc in documents]
        return "bm25-" + sha256(json.dumps(["bm25-1", manifest]).encode()).hexdigest()[:24]

    def versions(self):
        # Health reads the manifest, without tokenizing the corpus or changing caches.
        with self.ingestion.connect() as db:
            db.execute("BEGIN")
            documents = [json.loads(row[0]) for row in db.execute("SELECT body FROM documents WHERE json_extract(body,'$.processing_status')='completed' ORDER BY id")]
            return {"graph_version": self.graph.version(db), "index_version": self.index_version(documents),
                    "configuration_version": "ranker-" + self.ranker.checksum[:24] if self.ranker else "retrieval-bm25-1"}

    def provider_order(self, query, candidates, versions):
        if not self._provider_lock.acquire(blocking=False):
            return None, "busy", "Another provider request is running. Local ranking was used."
        try:
            return self._provider_order(query, candidates, versions)
        finally:
            self._provider_lock.release()

    def _provider_order(self, query, candidates, versions):
        config = self.provider_settings
        if not config.enabled:
            return None, "unconfigured", "OpenRouter is unavailable: configure a server key and a free model. Local ranking was used."
        identity = sha256(json.dumps(["rerank-1", query, candidates, versions, config.model], sort_keys=True).encode()).hexdigest()
        with self.ingestion.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            cached = db.execute("SELECT body FROM provider_cache WHERE id=?", (identity,)).fetchone()
            if cached:
                return json.loads(cached[0]), "cached", None
            day = datetime.now(UTC).date().isoformat()
            row = db.execute("SELECT attempts FROM provider_usage WHERE day=?", (day,)).fetchone()
            if (row[0] if row else 0) >= config.daily_budget:
                return None, "budget_exhausted", "The local OpenRouter daily budget is exhausted. Local ranking was used."
            db.execute("INSERT INTO provider_usage VALUES (?,1) ON CONFLICT(day) DO UPDATE SET attempts=attempts+1", (day,))
        try:
            ids = self.provider_call(query, candidates, config)
            expected = {candidate["chunk_id"] for candidate in candidates}
            if not isinstance(ids, list) or any(not isinstance(item, str) for item in ids) or len(ids) != len(expected) or set(ids) != expected:
                raise ValueError("invalid reranking IDs")
        except Exception:
            # Never expose provider responses, prompts, or credentials in errors.
            return None, "fallback", "OpenRouter could not return valid evidence IDs. Local ranking was used."
        with self.ingestion.connect() as db:
            db.execute("INSERT OR REPLACE INTO provider_cache VALUES (?,?)", (identity, json.dumps(ids)))
            db.execute("DELETE FROM provider_cache WHERE rowid NOT IN (SELECT rowid FROM provider_cache ORDER BY rowid DESC LIMIT 1000)")
        return ids, "reranked", None

    def retrieve(self, request: RetrievalRequest) -> RetrievalResult:
        started = perf_counter()
        if request.mode == "aco":
            raise IngestionError("ACO retrieval is planned for the optimizer phase. Choose lexical, graph, fuzzy, or hybrid.", "algorithm_unavailable", 422)
        query = set(self.terms(request.query))
        if len(query) > 50:
            raise IngestionError("Use at most 50 distinct search terms.", "query_limit", 422)
        corpus = self.corpus()
        snapshot_ms = (perf_counter() - started) * 1000
        nodes, relations = corpus["entities"], corpus["relations"]
        scoped_indexes = None
        if request.document_id is not None:
            if request.document_id not in corpus["documents"]:
                raise NotFoundError("completed source document", request.document_id)
            scoped_indexes = {index for index, chunk in enumerate(corpus["chunks"]) if chunk["document_id"] == request.document_id}
            scoped_chunks = {corpus["chunks"][index]["chunk_id"] for index in scoped_indexes}
            nodes = [node for node in nodes if scoped_chunks.intersection(node.source_chunks)]
            relations = [edge for edge in relations if scoped_chunks.intersection(edge.source_chunks or [edge.source_chunk])]
        by_id = {node.entity_id: node for node in nodes}
        if self.graph.ontology.open_relations:
            # Include recognized dynamic concepts even when they occur only in a
            # different source, so a scoped path query can correctly abstain.
            named_nodes = []
            query_text = request.query.casefold()
            for node in corpus["entities"]:
                phrase = node.canonical_name.casefold()
                match = re.search(r"(?<!\w)" + re.escape(phrase) + r"(?!\w)", query_text)
                if match:
                    named_nodes.append((match.start(), -len(phrase), node.entity_id))
        else:
            named_nodes = []
        seeds, requested_seeds = [], []
        for match in self.graph.ontology.pattern.finditer(request.query):
            concept = self.graph.ontology.lookup[re.sub(r"[\s-]+", " ", match.group()).casefold()]
            eid = entity_id(concept.name, concept.kind)
            if eid not in requested_seeds:
                requested_seeds.append(eid)
            if eid in by_id and eid not in seeds:
                seeds.append(eid)
        for _, _, eid in sorted(named_nodes):
            if eid not in requested_seeds:
                requested_seeds.append(eid)
            if eid in by_id and eid not in seeds:
                seeds.append(eid)
        adjacency = {eid: [] for eid in by_id}
        for relation in relations:
            adjacency[relation.source_entity].append((relation.target_entity, relation))
            adjacency[relation.target_entity].append((relation.source_entity, relation))
        distances = {seed: 0 for seed in seeds}
        queue = deque(seeds)
        while queue:
            current = queue.popleft()
            if distances[current] >= request.max_hops:
                continue
            for neighbor, _ in adjacency[current]:
                if neighbor not in distances:
                    distances[neighbor] = distances[current] + 1
                    queue.append(neighbor)
        affinity, chunk_distance = {}, {}
        for eid, distance in distances.items():
            for cid in by_id[eid].source_chunks:
                affinity[cid] = max(affinity.get(cid, 0), 1 / (distance + 1))
                chunk_distance[cid] = min(chunk_distance.get(cid, 5), max(1, distance))
        relation_strength = {}
        for relation in relations:
            for cid in relation.source_chunks or [relation.source_chunk]:
                relation_strength[cid] = max(relation_strength.get(cid, 0), relation.extraction_confidence)
        weights = {"lexical": (1, 0, 0), "semantic": (1, 0, 0), "graph": (0.5, 0.5, 0), "fuzzy": (0.6, 0, 0.4), "hybrid": (0.6, 0.25, 0.15)}[request.mode]
        active_ranker = self.ranker if request.mode == "hybrid" else None
        domain_policy = self.policy if request.mode == "hybrid" and request.ranking_profile == "domain" and not active_ranker else None
        if domain_policy:
            weights = domain_policy["weights"]
        if active_ranker:
            weights = active_ranker.weights
        prioritize_path = (
            self.graph.ontology.version == "ration-extractor-1"
            and request.document_id is not None
            and len(requested_seeds) == len(seeds) == 2
            and (request.mode == "graph" or re.search(r"\b(?:related|relationship|connect|connected|path)\b", request.query, re.I))
        )
        candidates = set()
        for token in query:
            candidates.update(corpus["postings"].get(token, []))
        if prioritize_path:
            candidates.update(index for index in scoped_indexes if corpus["chunks"][index]["chunk_id"] in affinity)
        if scoped_indexes is not None:
            candidates.intersection_update(scoped_indexes)
        preliminary = []
        count = len(corpus["chunks"])
        for index in candidates:
            chunk, counter = corpus["chunks"][index], corpus["counters"][index]
            length = sum(counter.values())
            bm25 = 0.0
            for token in query & counter.keys():
                frequency = counter[token]
                document_frequency = len(corpus["postings"][token])
                idf = log(1 + (count - document_frequency + 0.5) / (document_frequency + 0.5))
                bm25 += idf * frequency * 2.2 / (frequency + 1.2 * (0.25 + 0.75 * length / max(1, corpus["average_length"])))
            coverage = len(query & counter.keys()) / max(1, len(query))
            lexical = coverage * bm25 / (bm25 + 1)
            cid = chunk["chunk_id"]
            preliminary.append((index, lexical, affinity.get(cid, 0), coverage))
        preliminary.sort(key=lambda item: (-(item[1] * weights[0] + item[2] * weights[1] + (item[3] * weights[3] if active_ranker else 0)), corpus["chunks"][item[0]]["chunk_id"]))
        ranked, fuzzy_cache = [], {}
        for index, lexical, graph_signal, coverage in preliminary[:self.MAX_CANDIDATES]:
            chunk = corpus["chunks"][index]
            cid = chunk["chunk_id"]
            fuzzy_key = (lexical, relation_strength.get(cid, 0), chunk_distance.get(cid, 5))
            if fuzzy_key not in fuzzy_cache:
                fuzzy_cache[fuzzy_key] = self.fuzzy.centroid_score(dict(zip(("semantic_similarity", "relation_strength", "graph_distance"), fuzzy_key)))
            fuzzy = fuzzy_cache[fuzzy_key]
            signals = (lexical, graph_signal, fuzzy, coverage) if active_ranker else (lexical, graph_signal, fuzzy)
            score = sum(weight * signal for weight, signal in zip(weights, signals))
            document = corpus["documents"][chunk["document_id"]]
            evidence = Evidence(citation=0, chunk_id=cid, document_id=chunk["document_id"], document_name=document["name"], text=chunk["text"], excerpt=excerpt(chunk["text"], query, corpus["sentences"][index]), source_location=chunk["source_location"], lexical_score=lexical, graph_score=signals[1], fuzzy_score=fuzzy, rank_score=score)
            ranked.append((evidence, fuzzy_key))
        if self.candidate_observer:
            self.candidate_observer(request, [item[0] for item in ranked])
        ranked.sort(key=lambda pair: (-pair[0].rank_score, pair[0].chunk_id))
        # Avoid repeated overlapping chunks with identical normalized excerpts.
        unique, seen = [], set()
        for item in ranked:
            identity = (item[0].document_id, item[0].excerpt)
            if identity not in seen:
                seen.add(identity)
                unique.append(item)
        ranked = unique[:min(30, request.top_k * 3)]
        warnings = ["Lexical BM25 candidates; no embeddings or trained optimizers. Fuzzy semantic_similarity receives a lexical proxy. Source reliability is unrated."]
        if self.ranker_warning:
            warnings.append(self.ranker_warning)
        if active_ranker:
            warnings.append(f"Linear ranking artifact {active_ranker.checksum[:16]} ({active_ranker.status}); domain {active_ranker.domain}. Ranking scores remain uncalibrated heuristics.")
        if len(preliminary) > self.MAX_CANDIDATES:
            warnings.append("Fuzzy reranking is limited to 200 lexical/graph candidates, with any active learned coverage weight included in selection. Relevant evidence outside this shortlist may be omitted.")
        if request.mode == "semantic":
            warnings.append("Semantic mode uses the lexical baseline until an embedding model is evaluated.")
        provider_status = "disabled"
        rank_ms = (perf_counter() - started) * 1000 - snapshot_ms
        # Requests with missing terms cannot be repaired by an external model.
        available = set().union(*(set(self.terms(item[0].excerpt)) for item in ranked)) if ranked else set()
        requires_paths = request.mode == "graph" or bool(re.search(r"\b(?:related|relationship|connect|connected|path)\b", request.query, re.I))
        candidate_ids = {item[0].chunk_id for item in ranked}
        candidate_edges = {edge.relation_id for edge in relations if any(cid in candidate_ids for cid in edge.source_chunks or [edge.source_chunk])}
        graph_covered = not (requires_paths and len(requested_seeds) > 1 and len(requested_seeds) != len(seeds))
        if requires_paths and len(seeds) > 1:
            if len(seeds) > 8:
                graph_covered = False
            for source in seeds[:8]:
                reachable = {source: 0}
                pending = deque([source])
                while pending:
                    current = pending.popleft()
                    if reachable[current] >= request.max_hops:
                        continue
                    for neighbor, edge in adjacency[current]:
                        if edge.relation_id in candidate_edges and neighbor not in reachable:
                            reachable[neighbor] = reachable[current] + 1
                            pending.append(neighbor)
                if any(target not in reachable for target in seeds):
                    graph_covered = False
        if request.use_provider and query and query <= available and graph_covered:
            ids, provider_status, warning = self.provider_order(request.query, [{"chunk_id": item[0].chunk_id, "text": item[0].excerpt} for item in ranked], [corpus["index_version"], corpus["graph_version"]])
            if warning:
                warnings.append(warning)
            if ids:
                by_chunk = {item[0].chunk_id: item for item in ranked}
                ranked = [by_chunk[cid] for cid in ids]
        elif request.use_provider:
            provider_status = "skipped_insufficient_evidence"
        if prioritize_path:
            reserved = path_support(seeds, adjacency, ranked, request.max_hops, request.top_k)
            if reserved:
                ranked = sorted(ranked, key=lambda item: item[0].chunk_id not in reserved)
                warnings.append("Passages supporting a short documented path were kept together before applying the result limit.")
        selected = ranked[:request.top_k]
        evidence = [item[0] for item in selected]
        for citation, item in enumerate(evidence, 1):
            item.citation = citation
        cited = {item.chunk_id: item.citation for item in evidence}
        cited_candidates = {}
        for candidate in corpus["candidates"]:
            if candidate["source_chunk"] in cited:
                cited_candidates.setdefault((candidate["source_entity"], candidate["target_entity"], candidate["relation_type"]), []).append(candidate)
        supported_relations = []
        for relation in relations:
            candidates = cited_candidates.get((relation.source_entity, relation.target_entity, relation.relation_type), [])
            if candidates:
                representative = min(candidates, key=lambda item: item["candidate_id"])
                supported_relations.append(relation.model_copy(update={"evidence": representative["evidence"], "source_chunk": representative["source_chunk"], "source_chunks": sorted({candidate["source_chunk"] for candidate in candidates})}))
        selected_nodes = [node for node in nodes if any(cid in cited for cid in node.source_chunks)]
        # Paths only use edges with evidence in this exact result, not unrelated
        # parts of the global graph. Traverse undirected but retain typed edges.
        supported_ids = {relation.relation_id for relation in supported_relations}
        paths = []
        for first_index, source in enumerate(seeds[:8]):
            for target in seeds[first_index + 1:8]:
                search = deque([(source, [source], [])])
                visited = {source}
                while search:
                    current, route, edges = search.popleft()
                    if current == target:
                        paths.append(RetrievalPath(labels=[by_id[eid].canonical_name for eid in route], entity_ids=route, relation_ids=[edge.relation_id for edge in edges], citation_ids=sorted({cited[cid] for edge in edges for cid in edge.source_chunks or [edge.source_chunk] if cid in cited}), score=min((edge.extraction_confidence for edge in edges), default=0)))
                        break
                    if len(edges) >= request.max_hops:
                        continue
                    for neighbor, edge in adjacency[current]:
                        if edge.relation_id in supported_ids and neighbor not in visited:
                            visited.add(neighbor)
                            search.append((neighbor, route + [neighbor], edges + [edge]))
        covered = set().union(*(set(self.terms(item.excerpt)) for item in evidence)) if evidence else set()
        enough = bool(query) and query <= covered
        if requires_paths and len(requested_seeds) > 1 and len(requested_seeds) != len(seeds):
            enough = False
            warnings.append("Some query concepts have no accepted graph entities. Build or review the relevant sources in the graph explorer.")
        if not enough:
            missing = sorted(query - covered)
            warnings.append("Insufficient term coverage" + (": " + ", ".join(missing) if missing else "; enter a more specific query") + ". Related passages may still be shown for inspection.")
        if len(seeds) > 1 and len(paths) < len(seeds) * (len(seeds) - 1) // 2:
            warnings.append("Not all query entities have cited graph paths within the selected evidence and hop limit.")
            if requires_paths:
                enough = False
        answer = "Source excerpts (inspect these for relevance to your question):\n" + "\n".join(f'“{item.excerpt}” [{item.citation}]' for item in evidence) if enough else "Insufficient evidence to answer this question from the saved sources. Try a more specific question or ingest a source that addresses it."
        top, top_fuzzy_key = selected[0] if selected else (None, (0, 0, 5))
        fuzzy = self.fuzzy.evaluate(FuzzyEvaluationRequest(inputs=dict(zip(("semantic_similarity", "relation_strength", "graph_distance"), top_fuzzy_key))))
        signals = (top.lexical_score, top.graph_score, top.fuzzy_score) if top else (0, 0, 0)
        if active_ranker:
            signals = (*signals, len(query & self.terms(top.text).keys()) / max(1, len(query)) if top else 0)
        result = RetrievalResult(result_id="retrieval-" + uuid4().hex, query=request.query, answer=answer, answer_status="evidence" if enough else "insufficient_evidence", confidence=top.rank_score if top else 0, mode="lexical" if request.mode == "semantic" else request.mode, nodes=selected_nodes, relations=supported_relations, evidence=evidence, paths=paths[:12], score_breakdown=[ScoreContribution(component=name, raw_score=signal, weight=weight, contribution=signal * weight) for name, signal, weight in zip(("Lexical BM25", "Graph proximity", "Fuzzy relevance", "Term coverage"), signals, weights)], fuzzy_explanation=fuzzy, graph_version=corpus["graph_version"], index_version=corpus["index_version"], provider_status=provider_status, configuration_version=("ranker-" + active_ranker.checksum[:24]) if active_ranker else domain_policy["version"] if domain_policy else "retrieval-bm25-1", warnings=warnings, timeline=[{"stage": "Source and graph snapshot", "duration_ms": round(snapshot_ms, 2), "status": "complete"}, {"stage": "Local ranking", "duration_ms": round(rank_ms, 2), "status": "complete"}, {"stage": "Evidence selection and citation checks", "duration_ms": round((perf_counter() - started) * 1000 - snapshot_ms - rank_ms, 2), "status": "complete"}])
        if provider_status in {"reranked", "cached", "fallback", "busy", "budget_exhausted"}:
            result.provider_model_requested = self.provider_settings.model
            result.provider_parameters = {"temperature": RERANK_TEMPERATURE, "max_tokens": RERANK_MAX_TOKENS, "timeout_seconds": self.provider_settings.timeout}
        with self.ingestion.connect() as db:
            db.execute("INSERT INTO retrieval_results VALUES (?,?)", (result.result_id, result.model_dump_json()))
            db.execute("DELETE FROM retrieval_results WHERE rowid NOT IN (SELECT rowid FROM retrieval_results ORDER BY rowid DESC LIMIT ?)", (self.MAX_RESULTS,))
        return result

    def get_result(self, result_id):
        with self.ingestion.connect() as db:
            row = db.execute("SELECT body FROM retrieval_results WHERE id=?", (result_id,)).fetchone()
        if not row:
            raise NotFoundError("retrieval result (retained latest 1000)", result_id)
        return RetrievalResult.model_validate_json(row[0])

    def feedback(self, request):
        with self.ingestion.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            if not db.execute("SELECT 1 FROM retrieval_results WHERE id=?", (request.result_id,)).fetchone():
                raise NotFoundError("retrieval result", request.result_id)
            db.execute("INSERT INTO retrieval_feedback VALUES (?,?,?) ON CONFLICT(result_id) DO UPDATE SET rating=excluded.rating,recorded_at=excluded.recorded_at", (request.result_id, request.feedback, datetime.now(UTC).isoformat()))
        return {"accepted": True, "message": "Feedback saved for this result. Ranking weights are unchanged; training uses reviewed labels in a later phase."}

    def explain(self, result_id):
        result = self.get_result(result_id)
        return {
            "headline": "Cited source excerpts" if result.answer_status == "evidence" else "Insufficient evidence; no answer synthesized",
            "decision_trace": [f"Snapshot: {result.graph_version}, {result.index_version}, {result.configuration_version}.", f"Evidence: {len(result.evidence)} chunks; paths: {len(result.paths)}; provider: {result.provider_status}.", *([f"Requested provider model: {result.provider_model_requested}; parameters {json.dumps(result.provider_parameters, sort_keys=True)}. A router model ID does not identify the actual routed model."] if result.provider_model_requested else []), *[f"{component.component}: {component.raw_score:.4f} × {component.weight:.2f} = {component.contribution:.4f}." for component in result.score_breakdown], *[f"{trace.rule_id}: {trace.rule}; firing {trace.strength:.4f}." for trace in result.fuzzy_explanation.rule_firings], *result.warnings],
            "alternatives": [{"path": " → ".join(path.labels), "confidence": path.score} for path in result.paths[1:]],
        }
