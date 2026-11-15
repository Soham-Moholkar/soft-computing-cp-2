# Local backend

SoftGraph's FastAPI service runs on `127.0.0.1:8000` and is normally started and stopped with the root [Windows launcher](../docs/LOCAL_USE.md). The launcher sets the frontend API proxy and local API mode, checks `/ready`, and owns the helper processes. For local API inspection while it is running, open `http://127.0.0.1:8000/docs`.

The app uses separate SQLite files for workspaces. By default they live in `backend/.local/`; the hospital workspace database is `healthcare.sqlite3`, and the course database is `ingestion.sqlite3`. `SOFTGRAPH_INGESTION_DB` can select another base database; the other workspace files are placed beside it. Hospital records, imports, and attached-document metadata stay in the healthcare workspace.

## Hospital records limits

- Structured import formats: CSV, JSON, Excel `.xlsx`, and SQLite. Use the page's downloadable templates; imports require the documented patient/encounter schema and do not map arbitrary columns.
- Import size is at most 2 MiB and 1,000 records per file. The healthcare database permits 5,000 encounters overall, 500 per patient, and 32 MiB of stored record content.
- Excel formulas are refused, not calculated. SQLite inputs are inspected read-only and accept ordinary tables only; views, triggers, virtual tables, and SQL scripts are unsupported.
- Query searches only the requested patient's recorded fields and attached document text, then returns matching source excerpts and provenance. It does not infer a diagnosis, treatment, or prognosis.
- See [Hospital records and educational assessment](../docs/HOSPITAL_RECORDS.md) for schemas, provenance, dataset attributions, the Cleveland evaluation, the rejected heart-failure model, and NEWS2 limits.

## General source ingestion

The Learning lab source importer supports text and teaching material, including TXT, Markdown text, PDF, DOCX, CSV, and JSON. It stores parsed source chunks for cited retrieval and course graph building. PDF scans require OCR, which is not included. The bounded DOCX parser extracts body paragraphs and tables with source locations, displays cached field results without executing instructions, and does not fetch hyperlink destinations. Macros, embedded objects, images requiring OCR, and old binary `.doc` files are unsupported. See the UI for per-format limits and warnings.

The course retrieval baseline is lexical, graph-based, and fuzzy-rule based. Its scores are untrained relevance heuristics, not measured answer quality. Optional provider reranking is off by default and is not needed for local use. The educational healthcare classifiers are separate from the hospital record database; the heart-failure 90-day candidate is rejected and its evaluation endpoint is disabled.

## Maintenance

Do not launch a second backend manually while `Start-SoftGraph.cmd` is running. Keep the app bound to loopback for this single-computer workflow. For data copies and cleanup, stop the launcher first and follow [local operations](../docs/OPERATIONS.md).

## Current verification status

On 2026-11-14, 265 backend tests and 54 frontend tests passed, along with full oxlint and TypeScript checks. The backend test database was isolated under `output/verification/nov14-final`. The Windows production launcher and browser workflow also passed; see the [local verification record](../docs/LOCAL_VERIFICATION_2026-11-14.md) for scope and retained-data checks.
