# Local operations

Use SoftGraph on this Windows laptop with [Start-SoftGraph.cmd](../Start-SoftGraph.cmd). The launcher starts the site and API on `127.0.0.1`, confirms readiness, and stops only the processes it owns when you press Ctrl+C or close its window. See [Local use](LOCAL_USE.md) for prerequisites and options.

## Local files

The default workspace databases are in `backend/.local/`. Hospital records are in `healthcare.sqlite3`; course sources, graph data, and course retrieval history are in `ingestion.sqlite3`. The launcher preserves existing databases and honors `SOFTGRAPH_INGESTION_DB`; when that variable points elsewhere, workspace databases are placed beside its database file.

These are ordinary SQLite files and may contain identifiable imported records and source documents. Store them on a laptop protected by your Windows account and device encryption. Do not share the database or backup unless authorized. Avoid copying or deleting database files while the application is running because SQLite may have active WAL files.

## Backup and restore

Stop SoftGraph before making a backup. From `backend/`, the bundled backup utility can make a consistent SQLite online backup with a SHA-256 manifest:

```powershell
py -m app.operations.backup backup .local/healthcare.sqlite3 backups/hospital-records.sqlite3
```

Keep the backup in a protected location. To inspect restore behavior without overwriting the active database, restore to a new file:

```powershell
py -m app.operations.backup restore backups/hospital-records.sqlite3 restored/healthcare.sqlite3
```

The restore command verifies the manifest and creates the requested destination; it does not replace a live database. Keep copies of the relevant workspace files together if you need to preserve related course and hospital workspaces.

## Startup troubleshooting

- **A port is busy:** close the application using port 3000 or 8000, then start again. The launcher does not stop unrelated processes.
- **A prerequisite is missing:** install Node.js 22.13+, Python 3.12+, pnpm, or the locked project dependencies as described in [Local use](LOCAL_USE.md).
- **The page does not open:** check readiness and read the latest `output/local-runtime/<run-id>-*.log` files. `Start-SoftGraph.cmd -Rebuild` forces a fresh website build.
- **Do not import data:** an invalid structured file fails as a whole. Check the downloaded template and the limits in [Hospital records](HOSPITAL_RECORDS.md).

The local launcher is designed for one app instance. The backend's worker and SQLite layout is not a multi-instance deployment setup.
