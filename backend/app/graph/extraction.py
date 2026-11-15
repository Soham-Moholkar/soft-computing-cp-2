"""Course-domain lexical baseline. Scores are heuristics, not calibrated probabilities."""
import json
import re
from bisect import bisect_left
from dataclasses import dataclass
from hashlib import sha256

from app.models.graph import GraphBuildRequest, MentionModel, RelationCandidate
from app.models.ingestion import ChunkModel
from app.core.errors import IngestionError


@dataclass(frozen=True)
class Concept:
    name: str
    kind: str
    aliases: tuple[str, ...] = ()


CATALOG = (
    Concept("Soft Computing", "Concept"),
    Concept("SoftGraph", "Technology"),
    Concept("Fuzzy Logic", "Concept", ("fuzzy inference",)),
    Concept("Genetic Algorithm", "Process", ("genetic algorithms", "GA")),
    Concept("Particle Swarm Optimization", "Process", ("PSO",)),
    Concept("Ant Colony Optimization", "Process", ("ACO",)),
    Concept("Grey Wolf Optimization", "Process", ("gray wolf optimization", "GWO")),
    Concept("Whale Optimization Algorithm", "Process", ("whale optimization", "WOA")),
    Concept("Knowledge Graph", "Technology", ("knowledge graphs", "knowledge network",)),
    Concept("Hybrid Retrieval", "Process", ("hybrid search",)),
    Concept("Retrieval", "Process"),
    Concept("Retrieval Relevance", "Concept"),
    Concept("Retrieval Parameters", "Concept"),
    Concept("Ranking Weights", "Concept", ("retrieval weights",)),
    Concept("Entity Resolution", "Process", ("entity linking",)),
    Concept("Entity Extraction", "Process", ("extraction",)),
    Concept("Entity Trust", "Concept"),
    Concept("Relation Strength", "Concept"),
    Concept("Graph Paths", "Concept", ("knowledge graph paths", "graph path",)),
    Concept("Membership Function", "Concept", ("membership functions",)),
    Concept("Mamdani", "Process", ("Mamdani inference",)),
    Concept("Sugeno", "Process", ("Sugeno inference",)),
    Concept("Neuro-Fuzzy", "Process", ("neuro fuzzy", "ANFIS",)),
    Concept("Swarm Intelligence", "Concept"),
    Concept("Evolutionary Computing", "Concept", ("evolutionary computation",)),
    Concept("Hybrid Systems", "Concept"),
    Concept("Semantic Similarity", "Concept"),
    Concept("Fuzzy Confidence", "Concept"),
    Concept("Source Reliability", "Concept"),
    Concept("Graph Topology", "Concept"),
    Concept("Entity Importance", "Concept"),
    Concept("Path Quality", "Concept"),
)


def identifier(prefix: str, *parts: str) -> str:
    return prefix + "-" + sha256("\0".join(parts).encode()).hexdigest()


def entity_id(name: str, kind: str) -> str:
    return identifier("entity", kind, name.casefold())


ALIASES = sorted(((alias, concept) for concept in CATALOG for alias in (concept.name, *concept.aliases)), key=lambda item: (-len(item[0]), item[0]))
PATTERN = re.compile(r"(?<!\w)(?:" + "|".join(re.escape(alias).replace(r"\ ", r"[\s-]+") for alias, _ in ALIASES) + r")(?!\w)", re.IGNORECASE)
LOOKUP = {re.sub(r"[\s-]+", " ", alias).casefold(): concept for alias, concept in ALIASES}
class Ontology:
    def __init__(self, catalog=CATALOG, version="course-extractor-1", open_relations=False):
        self.catalog, self.version = catalog, version
        self.open_relations = open_relations
        aliases = sorted(((alias, concept) for concept in catalog for alias in (concept.name, *concept.aliases)), key=lambda item: (-len(item[0]), item[0]))
        self.pattern = re.compile(r"(?<!\w)(?:" + "|".join(re.escape(alias).replace(r"\ ", r"[\s-]+") for alias, _ in aliases) + r")(?!\w)", re.IGNORECASE)
        self.lookup = {re.sub(r"[\s-]+", " ", alias).casefold(): concept for alias, concept in aliases}

DEFAULT_ONTOLOGY = Ontology()
VERBS = {"uses": "uses", "use": "uses", "supports": "supports", "support": "supports", "improves": "improves", "improve": "improves", "tunes": "tunes", "tune": "tunes", "refines": "refines", "refine": "refines", "estimates": "estimates", "explores": "explores", "combines": "combines", "is a": "is_a", "is an": "is_a"}
DIRECT = re.compile(r"^\s*(?:also\s+)?(" + "|".join(sorted(VERBS, key=len, reverse=True)) + r")\s+(?:(?:the|a|an|multi-hop)\s+)?$", re.IGNORECASE)
NEGATION = re.compile(r"\b(?:not|never|no|cannot|can't|doesn't|may|might|could|if|whether)\b", re.IGNORECASE)

OPEN_VERBS = VERBS | {variant: canonical for canonical, variants in {
    "requires": ("requires", "require"), "depends_on": ("depends on", "depend on"),
    "routes_to": ("routes to", "route to"), "triggers": ("triggers", "trigger"),
    "verifies": ("verifies", "verify"), "records": ("records", "record"),
    "feeds": ("feeds", "feed"), "documents": ("documents", "document"),
}.items() for variant in variants}
WORD = r"[^\W_][\w-]*"
PHRASE = rf"{WORD}(?: +{WORD}){{0,5}}"
OPEN_ASSERTION = re.compile(
    r'^\s*(?:[-*]\s+)?(?:(?:"[^"\n]+"|[\w -]+):\s*"?)?'
    rf'(?:(?:the|a|an) +)?(?P<left>{PHRASE}?) +'
    r'(?:(?:may|might|could|does not|doesn\'t|never|also) +)?'
    r'(?P<verb>' + '|'.join(sorted(OPEN_VERBS, key=len, reverse=True)) + r') +'
    rf'(?:(?:the|a|an) +)?(?P<right>{PHRASE})[.!?]?\s*"?,?\s*$', re.I,
)
CLAUSE_WORDS = re.compile(r"\b(?:and|or|then|when|where|which|that|while|also)\b", re.I)
PRONOUN = re.compile(r"^(?:it|they|we|you|he|she|this|these|those|there)\b", re.I)


def open_assertion(sentence):
    match = OPEN_ASSERTION.fullmatch(sentence)
    if match is None or sentence.rstrip().endswith("?"):
        return None
    for side in ("left", "right"):
        phrase = match[side]
        if PRONOUN.search(phrase) or CLAUSE_WORDS.search(phrase) or NEGATION.search(phrase):
            return None
        if any(word.casefold() in OPEN_VERBS for word in phrase.split()[1:]):
            return None
    return match


def extract(document_id: str, chunks: list[ChunkModel], config: GraphBuildRequest, ontology=DEFAULT_ONTOLOGY) -> tuple[list[MentionModel], list[RelationCandidate]]:
    mentions: dict[str, MentionModel] = {}
    relations: dict[str, RelationCandidate] = {}
    segments: dict[str, list[ChunkModel]] = {}
    for chunk in chunks:
        segments.setdefault(json.dumps(chunk.source_location, sort_keys=True), []).append(chunk)
    for location, segment_chunks in segments.items():
        segment_chunks.sort(key=lambda chunk: chunk.start_offset)
        ends = [chunk.end_offset for chunk in segment_chunks]
        def supporting_chunk(first, last):
            index = bisect_left(ends, last)
            return segment_chunks[index] if index < len(segment_chunks) and segment_chunks[index].start_offset <= first else None
        # Reconstruct normalized context so overlap cannot hide sentence negation.
        extent = max(chunk.end_offset for chunk in segment_chunks)
        characters = [" "] * extent
        for chunk in segment_chunks:
            characters[chunk.start_offset:chunk.end_offset] = chunk.text
        text = "".join(characters)
        expanded = ontology.open_relations and config.extraction_configuration_version == ontology.version
        delimiters = r"[^.!?;\n]+[.!?]?" if expanded else r"[^.!?\n]+(?:[.!?]|$)"
        for sentence in re.finditer(delimiters, text):
            sentence_mentions = []
            assertion = open_assertion(sentence.group()) if expanded else None
            spans = ([assertion.span(side) for side in ("left", "right")] if assertion else
                     [match.span() for match in ontology.pattern.finditer(sentence.group())])
            for start, end in spans:
                surface = sentence.group()[start:end]
                normalized = re.sub(r"[\s-]+", " ", surface).casefold()
                concept = ontology.lookup.get(normalized)
                if concept is None:
                    concept = Concept(surface, "Concept")
                    confidence = 0.88
                else:
                    confidence = 0.85 if surface.casefold() in {"ga", "pso", "aco", "gwo", "woa", "anfis"} else 0.95
                first = sentence.start() + start
                last = first + len(surface)
                source = supporting_chunk(first, last)
                if source is None:
                    # Never claim a multi-word surface exists in a chunk that split it.
                    continue
                eid = entity_id(concept.name, concept.kind)
                mid = identifier("mention", document_id, location, str(first), str(last), eid)
                mention = MentionModel(mention_id=mid, document_id=document_id, source_chunk=source.chunk_id, entity_id=eid, canonical_name=concept.name, entity_type=concept.kind, surface_form=surface, start_offset=first, end_offset=last, source_location=source.source_location, extraction_confidence=confidence, accepted=confidence >= config.entity_threshold)
                mentions[mid] = mention
                if len(mentions) + len(relations) > 20000:
                    raise IngestionError("Too many extraction candidates in one document.", "build_limit", 413)
                sentence_mentions.append(mention)
            for left, right in zip(sentence_mentions, sentence_mentions[1:]):
                if left.entity_id == right.entity_id:
                    continue
                source = supporting_chunk(left.start_offset, right.end_offset)
                if source is None:
                    continue
                gap = text[left.end_offset:right.start_offset]
                predicate = DIRECT.fullmatch(gap)
                blocked = bool(NEGATION.search(sentence.group()))
                relation_type = (OPEN_VERBS[assertion["verb"].lower()] if assertion else
                                 VERBS[predicate.group(1).lower()] if predicate else "co_occurs_with")
                explicit = relation_type != "co_occurs_with"
                confidence = min(left.extraction_confidence, right.extraction_confidence, 0.9 if explicit else 0.6)
                accepted = explicit and not blocked and left.accepted and right.accepted and confidence >= config.relation_threshold
                reason = "explicit predicate" if accepted else "negated or uncertain sentence" if blocked else "co-occurrence only; no supported predicate" if not explicit else "below acceptance threshold"
                first, last = left.start_offset, right.end_offset
                evidence = text[first:last]
                cid = identifier("candidate", document_id, location, left.mention_id, right.mention_id, relation_type)
                relations[cid] = RelationCandidate(candidate_id=cid, document_id=document_id, source_chunk=source.chunk_id, source_entity=left.entity_id, target_entity=right.entity_id, relation_type=relation_type, evidence=evidence, start_offset=first, end_offset=last, extraction_confidence=confidence, accepted=accepted, reason=reason)
                if len(mentions) + len(relations) > 20000:
                    raise IngestionError("Too many extraction candidates in one document.", "build_limit", 413)
    return sorted(mentions.values(), key=lambda item: item.mention_id), sorted(relations.values(), key=lambda item: item.candidate_id)
