"""Build an offline discovery catalogue from saved official government pages."""
import html
import json
import re
import sys
from pathlib import Path
from urllib.parse import urljoin, urlparse

ROOT = Path(__file__).resolve().parents[1]
PORTAL = "https://scholarships.gov.in/All-Scholarships"

NSP = (
    "Prime Minister's Scholarship Scheme for Wards of States and UTs Police Personnel Martyred During Terror or Naxal Attacks",
    "Prime Minister's Scholarship Scheme for Central Armed Police Forces and Assam Rifles",
    "AICTE Swanath Scholarship for Technical Degree Students",
    "AICTE Swanath Scholarship for Technical Diploma Students",
    "PM-USP Special Scholarship Scheme for Jammu, Kashmir and Ladakh",
    "AICTE Pragati Scholarship for Girl Students in Technical Degree Courses",
    "AICTE Pragati Scholarship for Girl Students in Technical Diploma Courses",
    "AICTE Saksham Scholarship for Students with Disabilities in Technical Diploma Courses",
    "AICTE Saksham Scholarship for Students with Disabilities in Technical Degree Courses",
    "Ishan Uday Special Scholarship Scheme for North Eastern Region",
    "Central Sector Scholarship of Top Class Education for SC Students",
    "Free Coaching for SC, OBC and PM CARES for Children Beneficiaries",
    "Pre-Matric Scholarship for Students with Disabilities",
    "Post-Matric Scholarship for Students with Disabilities",
    "Scholarship for Top Class Education for Students with Disabilities",
    "National Means-cum-Merit Scholarship",
    "National Fellowship and Scholarship for Higher Education of ST Students",
    "NEC Merit Scholarship for Higher Professional Courses in the North Eastern Region",
    "Prime Minister's Scholarship Scheme for Ministry of Railways",
)

def plain(value):
    return " ".join(html.unescape(re.sub(r"<[^>]*>", " ", value)).split())

def safe_url(origin, value):
    url = urljoin(origin, html.unescape(value))
    host = urlparse(url).hostname or ""
    return url if url.startswith("https://") and (host.endswith(".gov.in") or host.endswith(".nic.in")) else ""

def record(name, topic, state, url, title, locator):
    return dict(name=name, topic=topic, state=state, url=url, sourceTitle=title, locator=locator)

def build(saved):
    entries = [record(name, "Education", "", PORTAL, "National Scholarship Portal · All Scholarships", "Academic Year 2026–27 · " + name) for name in NSP]
    page = saved.joinpath("maha.html").read_text(encoding="utf-8", errors="replace")
    maha_links = re.findall(r'<a\b[^>]*href="([^"]*SchemeData[?][^"]+)"[^>]*>(.*?)</a>', page, re.I | re.S)
    for raw, label in maha_links:
        name = plain(label)
        url = safe_url("https://mahadbt.maharashtra.gov.in/", raw)
        if url and len(name) >= 12 and re.search(r"scholarship|education|student|fee|merit|vasatigruh|vastigruh|shishyavrutti|maintenance allowance|fellowship|research adhichatra", name, re.I):
            entries.append(record(name, "Education", "Maharashtra", url, "MahaDBT · Individual scheme profile", "SchemeData · " + name))

    page = saved.joinpath("msme.html").read_text(encoding="utf-8", errors="replace")
    for row in re.findall(r'<tr\b[^>]*>(.*?)</tr>', page, re.I | re.S):
        fields = re.findall(r'<td\b[^>]*>(.*?)</td>', row, re.I | re.S)
        if len(fields) < 2:
            continue
        name = plain(fields[0])
        link = re.search(r'<a\b[^>]*href="([^"]+)"', row, re.I)
        if not link or len(name) < 12 or "PMEGP" in name or name.startswith("MyMSME"):
            continue
        url = safe_url("https://my.msme.gov.in/", link[1])
        if url:
            entries.append(record(name, "Small business", "", url, "Ministry of MSME · Scheme list", "Official guideline linked from the ministry directory · " + name))
    return list({(item["url"], item["name"].casefold()): item for item in entries}.values())

if __name__ == "__main__":
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "output" / "policy-sources"
    rows = build(source)
    (ROOT / "lib" / "policy" / "directory-data.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(rows)} official-directory entries ({sum(bool(item['state']) for item in rows)} state entries)")
