"""Deterministic cross-partition audit, including near duplicates and shared facts."""
import re
from itertools import combinations


def tokens(text):
    return re.findall(r"\w+", text.casefold())


def shingles(text, width=5):
    words = tokens(text)
    return {tuple(words[index:index + width]) for index in range(len(words) - width + 1)}


def audit(sources, queries):
    near, shared = [], []
    signatures = {source.id: shingles(source.text) for source in sources}
    sentence_sets = {source.id: {" ".join(tokens(sentence)) for sentence in re.split(r"[.!?\n]", source.text) if len(tokens(sentence)) >= 5} for source in sources}
    for left, right in combinations(sources, 2):
        if left.split == right.split:
            continue
        a, b = signatures[left.id], signatures[right.id]
        intersection = len(a & b)
        jaccard = intersection / len(a | b) if a | b else 0
        containment = intersection / min(len(a), len(b)) if a and b else 0
        if min(len(a), len(b)) >= 8 and (jaccard >= 0.8 or containment >= 0.9):
            near.append({"left": left.id, "right": right.id, "jaccard": jaccard, "containment": containment})
        overlap = sorted(sentence_sets[left.id] & sentence_sets[right.id])
        if overlap:
            shared.append({"left": left.id, "right": right.id, "shared_sentences": overlap})
    return {"method": "casefolded word 5-shingles; Jaccard>=0.8 or containment>=0.9 with >=8 shingles",
            "near_duplicate_sources": near, "shared_cross_split_facts": shared,
            "family_counts": {split: len({source.family for source in sources if source.split == split}) for split in ("train", "validation", "test")},
            "limitations": "Lexical audit cannot establish absence of semantic leakage. Shared facts require review but are not automatically the same source family."}
