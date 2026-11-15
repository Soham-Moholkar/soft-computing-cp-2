"""Fixed workspace profiles and explicit theoretical example packs."""
from app.graph.extraction import CATALOG, Concept, Ontology
from app.domain_profiles import DOMAIN_PROFILES, POLICIES

PROFILES = {
    "personal": {"name": "Atlas Vault", "category": "Personal knowledge", "description": "Connect notes, reading and projects in an Obsidian-inspired knowledge workspace.", "concepts": ["Knowledge Vault", "Daily Notes", "Research Notes", "Project Atlas", "Reading Queue"], "questions": ["How does Knowledge Vault use Knowledge Graph?", "How do Research Notes support Project Atlas?", "How is Reading Queue related to Project Atlas?"], "examples": [
        ("Welcome to Atlas", "# Atlas Vault\nTheoretical personal knowledge example.\nKnowledge Vault uses Knowledge Graph.\nKnowledge Graph supports Project Atlas.\nKeep source excerpts beside each relationship."),
        ("Project Atlas", "# Project Atlas\nTheoretical project note.\nDaily Notes supports Project Atlas.\nResearch Notes supports Project Atlas.\nProject Atlas uses Hybrid Retrieval."),
        ("Reading queue", "# Reading queue\nTheoretical reading workflow.\nReading Queue supports Research Notes.\nResearch Notes uses Fuzzy Logic.\n[[Project Atlas]] is a note reference; link text alone is not an accepted assertion."),
        ("Uncertain ideas", "# Uncertain ideas\nTheoretical review note.\nDaily Notes might improve Reading Queue.\nThis tentative relationship should remain in the review queue.")],},
    "engineering": {"name": "Relay Operations", "category": "Engineering knowledge", "description": "Trace runbooks, service dependencies and release decisions to documented evidence.", "concepts": ["Incident Response", "Reliability Runbook", "Payments API", "Queue Worker", "Release Checklist", "On Call Handoff", "Service Ownership"], "questions": ["How does Incident Response use Reliability Runbook?", "How is Payments API related to Queue Worker?", "How does Release Checklist improve Incident Response?"], "examples": [
        ("Incident response runbook", "# Incident response\nTheoretical engineering case; no real service telemetry.\nIncident Response uses Reliability Runbook.\nReliability Runbook supports Payments API.\nInspect documented dependencies before responding."),
        ("Payments service map", "# Payments service map\nTheoretical service notes.\nPayments API uses Queue Worker.\nQueue Worker supports Incident Response.\nService Ownership supports Payments API."),
        ("Release readiness", "# Release readiness\nTheoretical release notes.\nRelease Checklist improves Incident Response.\nRelease Checklist supports On Call Handoff.\nOn Call Handoff uses Reliability Runbook."),
        ("Open investigation", "# Open investigation\nTheoretical hypothesis.\nQueue Worker might improve Payments API.\nDo not treat this hypothesis as a verified incident cause.")],},
    "course": {"name": "Soft Computing Studio", "category": "Course companion", "description": "Explore algorithm relationships, revision notes and source-grounded course excerpts.", "concepts": [], "questions": ["How does Particle Swarm Optimization tune Ranking Weights?", "How does Fuzzy Logic support Hybrid Retrieval?", "How is Genetic Algorithm related to Knowledge Graph?"], "examples": [
        ("Case study · fuzzy retrieval", "Theoretical course example.\nFuzzy Logic supports Hybrid Retrieval.\nHybrid Retrieval uses Knowledge Graph.\nMamdani uses Membership Function."),
        ("Case study · optimization", "Theoretical course example.\nParticle Swarm Optimization tunes Ranking Weights.\nGenetic Algorithm tunes Retrieval Parameters.\nRetrieval Parameters supports Hybrid Retrieval."),
        ("Case study · graph paths", "Theoretical course example.\nAnt Colony Optimization explores Graph Paths.\nGraph Paths supports Knowledge Graph.\nKnowledge Graph supports Retrieval."),
        ("Case study · review", "Theoretical uncertain course note.\nWhale Optimization Algorithm might improve Retrieval.\nThis hypothesis requires independent evaluation.")],},
}

PROFILES = {**DOMAIN_PROFILES, **PROFILES}

def ontology_for(workspace):
    extras = tuple(Concept(name, "Concept") for name in PROFILES[workspace]["concepts"])
    if workspace == "ration":
        return Ontology(extras, "ration-extractor-1", open_relations=True)
    if workspace == "healthcare":
        return Ontology(extras, "healthcare-extractor-2", open_relations=True)
    return Ontology((() if workspace in DOMAIN_PROFILES else CATALOG) + extras, "course-extractor-1" if workspace == "course" else f"{workspace}-extractor-1")

def descriptor(workspace):
    profile = PROFILES[workspace]
    return {key: value for key, value in profile.items() if key not in {"examples", "concepts"}} | {"workspace_id": workspace, "extraction_version": ontology_for(workspace).version, "example_kind": "theoretical", "policy": {**POLICIES[workspace], "version": f"{workspace}-policy-1"}, "default_preferences": {"mode": "hybrid", "ranking_profile": "domain", **{key: POLICIES[workspace][key] for key in ("top_k", "max_hops", "view")}}}
