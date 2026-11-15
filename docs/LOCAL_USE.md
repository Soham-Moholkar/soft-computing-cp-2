# Run SoftGraph on your laptop

SoftGraph is intended for local use on one Windows laptop. The launcher binds the website and backend to `127.0.0.1` only and uses Vinext's local Node start command; it does not use Wrangler, Sites, or Cloudflare. No hosted service, cloud account, public URL, or internet connection is needed to run the app after dependencies have been installed. Source links in the research notes open only when you choose to visit them. Local mode does not require sign-in; keep the listener on loopback.

## First-time setup

Install Node.js 22.13 or later, Python 3.12 or later, and pnpm. From the project folder, install dependencies:

```powershell
pnpm install --frozen-lockfile
py -3.12 -m venv backend\.venv
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.lock
```

If your Python 3.12 launcher command is different, create `backend\.venv` with that interpreter instead. The launcher accepts an existing root or backend virtual environment, or a system Python 3.12+.

## Start and stop

Double-click `Start-SoftGraph.cmd`, or run it from PowerShell:

```powershell
.\Start-SoftGraph.cmd
```

The launcher checks the installed runtimes and required packages, verifies ports 8000 and 3000 are free, builds the app when its source fingerprint changes, starts the API and website on loopback, waits for both readiness checks, and opens `http://127.0.0.1:3000/`. First launch or a changed build may take a few minutes. Keep the launcher window open while using the app.

Press Ctrl+C or close the launcher window to stop the services it started. The launcher owns its helper processes and cleans them up together. If either required port is already in use, it explains which port is occupied and leaves the existing process alone.

Useful options:

```powershell
.\Start-SoftGraph.cmd -CheckOnly       # check runtimes, packages, and ports; start nothing
.\Start-SoftGraph.cmd -NoBrowser       # start without opening a browser tab
.\Start-SoftGraph.cmd -Rebuild         # force a production build
.\Start-SoftGraph.cmd -RunForSeconds 60 # stop the app after one minute
```

Care Evidence opens by default. Use the [live demo script](CARE_EVIDENCE_DEMO.md) to rehearse with the synthetic procedure file. Open Learning lab for course material or visit `/hospital` for Hospital records and `/workspaces` for the workspace index. Learning lab includes Syllabus, Course sources, Course graph, Course search, Fuzzy logic, Genetic algorithms, Swarm intelligence, Hybrid systems, Explanations, Evaluation, Architecture, and Use cases. Internal navigation uses ordinary browser page loads; this is intentional for the current Vinext runtime.

In **Syllabus**, search by topic or filter by course unit/category, then select a row to inspect its purpose, where it appears, inputs/outputs, parameters/equation, demonstration, related backend module, and evaluation measure. The registry consolidates the syllabus mappings in one place.

## Your data

By default, local workspace databases are under `backend/.local/`; hospital records are in `healthcare.sqlite3`. The launcher honors an existing `SOFTGRAPH_INGESTION_DB` path and leaves existing database files in place. Other workspaces use separate SQLite files beside that configured base database. Avoid deleting or moving `.local` while the app is running.

Use a stable, non-name patient identifier. Keep the database and any exported backups in a location protected by your Windows account and device encryption. The app does not encrypt SQLite files itself. Do not import identifiable records unless you are authorized to store them on this laptop.

The launcher writes its owned process logs under `output/local-runtime/`. If startup fails, read the latest run's `.out.log` and `.err.log`; correct the reported prerequisite or free the reported port, then launch again. `-Rebuild` is available if the generated app needs a fresh production build.

The current Windows production-launcher and browser verification passed, including build reuse, clean shutdown, local data persistence, record imports, document search, and Learning lab navigation. See the [verification record](LOCAL_VERIFICATION_2026-11-14.md) for the tested flows and boundaries.
