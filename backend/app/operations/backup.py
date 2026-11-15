"""Online SQLite backup and verified restore to a new location only."""
import argparse
import hashlib
import json
import sqlite3
from pathlib import Path

def digest(path):
    checksum = hashlib.sha256()
    with Path(path).open("rb") as source:
        for chunk in iter(lambda: source.read(65536), b""): checksum.update(chunk)
    return checksum.hexdigest()

def copy_database(source, target):
    source, target = Path(source).resolve(), Path(target).resolve()
    if not source.is_file(): raise ValueError("Source database does not exist")
    target.parent.mkdir(parents=True, exist_ok=True)
    # Exclusive creation prevents overwriting a live database or existing backup.
    with target.open("xb"): pass
    try:
        with sqlite3.connect(source.as_uri() + "?mode=ro", uri=True) as origin, sqlite3.connect(target) as destination:
            origin.backup(destination)
            if destination.execute("PRAGMA quick_check").fetchone()[0] != "ok": raise ValueError("Backup integrity check failed")
    except Exception:
        target.unlink(missing_ok=True)
        raise
    return target

def backup(source, target):
    manifest = Path(str(target) + ".json")
    if manifest.exists(): raise FileExistsError("Backup manifest already exists")
    target = copy_database(source, target)
    manifest.write_text(json.dumps({"sha256": digest(target), "format": "sqlite-online-backup-1"}, indent=2), encoding="utf-8")
    return target

def restore(source, target):
    manifest = json.loads(Path(str(source) + ".json").read_text(encoding="utf-8"))
    if manifest.get("format") != "sqlite-online-backup-1" or manifest.get("sha256") != digest(source): raise ValueError("Backup checksum failed")
    return copy_database(source, target)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(); parser.add_argument("action", choices=["backup", "restore"]); parser.add_argument("source"); parser.add_argument("target")
    args = parser.parse_args(); print((backup if args.action == "backup" else restore)(args.source, args.target))
