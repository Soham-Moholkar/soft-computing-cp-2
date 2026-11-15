"""Deterministic, attributed adaptation of official SQuAD2 answerable contexts."""
import argparse
import json
from hashlib import sha256
from pathlib import Path

from app.evaluation.dataset import Dataset
from app.ingestion.parser import normalize

URL = "https://rajpurkar.github.io/SQuAD-explorer/dataset/dev-v2.0.json"
LICENSE = "https://creativecommons.org/licenses/by-sa/4.0/"


def prepare(raw_path, output):
    raw_bytes = raw_path.read_bytes()
    raw = json.loads(raw_bytes)
    articles = sorted(raw["data"], key=lambda item: sha256(("1729:" + item["title"]).encode()).hexdigest())[:30]
    sources, queries, seen = [], [], set()
    for article_index, article in enumerate(articles):
        split = "train" if article_index < 14 else "validation" if article_index < 22 else "test"
        family = "squad-wikipedia-" + article["title"]
        paragraphs = sorted(enumerate(article["paragraphs"]), key=lambda item: sha256(item[1]["context"].encode()).hexdigest())
        chosen = 0
        for paragraph_index, paragraph in paragraphs:
            text = normalize(paragraph["context"])
            questions = [item for item in paragraph["qas"] if not item["is_impossible"] and item["answers"]]
            if not questions or not 40 <= len(text.split()) <= 350:
                continue
            source_id = f"squad-{article_index:02}-{paragraph_index:03}"
            source_queries = []
            for item in sorted(questions, key=lambda question: question["id"]):
                key = normalize(item["question"]).casefold()
                if key in seen or not any(normalize(answer["text"]) in text for answer in item["answers"]):
                    continue
                seen.add(key)
                source_queries.append({"id": item["id"], "split": split, "family": family,
                                       "text": normalize(item["question"]), "category": "single_hop", "answerable": True,
                                       "judgments": [{"source_id": source_id, "excerpt": text, "grade": 2}]})
                if len(source_queries) == 2:
                    break
            if not source_queries:
                continue
            sources.append({"id": source_id, "family": family, "split": split,
                            "license": f"CC BY-SA 4.0; SQuAD2 Rajpurkar/Jia/Liang and Wikipedia contributors; article {article['title']}; {URL}; {LICENSE}",
                            "text": text, "mentions": [], "relations": []})
            queries.extend(source_queries)
            chosen += 1
            if chosen == 6:
                break
    data = {"schema_version": "1", "version": "squad2-retrieval-adaptation-v1",
            "provenance": f"SQuAD2 public dev set, originally crowdworker-annotated Wikipedia; original authors and contributors credited at https://rajpurkar.github.io/SQuAD-explorer/. Raw SHA256={sha256(raw_bytes).hexdigest()}. Adaptation: normalized contexts, paragraph retrieval judgments, article-family hash split, up to 6 paragraphs/article and 2 answerable questions/paragraph. This is a new diagnostic split, not an official SQuAD leaderboard evaluation. Adaptation and corpus-wide relevance pooling have not been independently reviewed. Original no-answer annotations are passage-scoped and excluded because they are not corpus-wide no-answer labels.",
            "review_status": "upstream_human_annotated", "reviewers": [], "annotation_tasks": ["retrieval"],
            "adaptation_reviewed": False, "domain": "general-wikipedia-english", "seed": 1729,
            "sources": sources, "queries": queries}
    Dataset.model_validate(data)
    if output.exists():
        raise ValueError("Dataset already exists; preserve versions")
    output.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Prepared {len(sources)} sources and {len(queries)} queries across 30 article families")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    prepare(args.raw, args.output)
