"""Build auditable evidence from saved official MahaDBT scheme-detail pages."""

import argparse
import json
import re
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from bs4 import BeautifulSoup


ROOT = Path(__file__).resolve().parents[1]
HEADINGS = {
    "benefits": "funding",
    "eligibility": "eligibility",
    "documents required": "documents",
}


def normalize(text):
    return " ".join(text.split())


def parse_profile(file):
    soup = BeautifulSoup(file.read_bytes(), "html.parser")
    title_element = soup.select_one(".box-panel .pagetitle h1")
    if not title_element:
        return None
    title = normalize(title_element.get_text())
    if not title:
        return None
    sections = {}
    # A scheme's Benefits table can have unbalanced markup, putting the
    # following headings outside the box panel in the parsed HTML tree.
    for heading in title_element.find_all_next("h3"):
        label = normalize(heading.get_text(" "))
        layer = HEADINGS.get(label.casefold())
        if not layer or layer in sections:
            continue
        content = []
        for sibling in heading.find_next_siblings():
            if sibling.name in {"h2", "h3"}:
                break
            if sibling.name in {"ul", "ol", "p", "div", "table"}:
                tables = [sibling] if sibling.name == "table" else sibling.find_all("table")
                for table in tables:
                    rows = [
                        " | ".join(normalize(cell.get_text(" ")) for cell in row.find_all(["th", "td"], recursive=False))
                        for row in table.find_all("tr")
                    ]
                    if table is sibling:
                        content.extend(row for row in rows if row)
                    else:
                        table.replace_with("\n" + "\n".join(rows) + "\n")
                if sibling.name == "table":
                    continue
                for text in sibling.get_text("\n").splitlines():
                    line = normalize(text)
                    if line:
                        content.append(line)
        if content:
            sections[layer] = {"heading": label, "lines": content}
    return {"title": title, "sections": sections} if sections else None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Folder of <MahaDBT str token>.html pages")
    args = parser.parse_args()
    folder = ROOT / "lib" / "policy"
    directory = json.loads((folder / "directory-data.json").read_text(encoding="utf-8"))
    profiles = {}
    for item in directory:
        url = urlparse(item["url"])
        if url.hostname != "mahadbt.maharashtra.gov.in" or url.path != "/SchemeData/SchemeData":
            continue
        token = parse_qs(url.query).get("str", [""])[0]
        if not re.fullmatch("[0-9A-F]+", token):
            raise ValueError(f"Invalid MahaDBT scheme token: {token!r}")
        file = args.source / f"{token}.html"
        if not file.exists():
            print(f"No saved page for {item['name']}")
            continue
        profile = parse_profile(file)
        if profile:
            profiles[token] = profile
    output = folder / "mahadbt-evidence.json"
    output.write_text(json.dumps(profiles, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    complete = sum(len(profile["sections"]) == 3 for profile in profiles.values())
    print(f"{len(profiles)} profiles, {complete} with all three sections")


if __name__ == "__main__":
    main()

