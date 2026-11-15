# Local verification — 2026-11-14

The single-owner Windows laptop workflow was checked with the production build and the native launcher. This records local application behavior; it does not establish clinical validity or hosted deployment readiness.

## Automated checks and launcher

- **265 backend tests** and **54 frontend tests** passed; full oxlint and TypeScript checks passed. Backend tests used the isolated database at `output/verification/nov14-final`.
- The Windows launcher passed prerequisite/readiness checks and started the production website and API on loopback. A second launch reused the matching build fingerprint. Full launcher shutdown closed the owned listeners on ports 3000 and 8000.
- Restarting against the same isolated database retained patient records, a completed DOCX ingestion and its chunks, and a cited patient-scoped query.

## Browser flows

- Structured imports: all four downloadable CSV, JSON, XLSX, and SQLite templates were downloaded and imported through the running website proxy. Spreadsheet and SQLite sheet/table inspection also passed.
- Hospital workflow: JSON import, patient timeline, condition statuses, patient graph, DOCX attachment and ingestion progress, and a cited patient query passed. Manual registration worked, and a query scoped to another patient returned no match.
- Educational assessment: the Cleveland demonstration returned score `0.172` with its trace. The rejected heart-failure model exposed no inference form. The NEWS2 Scale 1 demo showed a score of `0` and all 20 displayed components.
- Learning lab: Syllabus, Fuzzy logic, Evaluation, and navigation passed. Syllabus content loaded with backend requests blocked. An unknown-topic TXT source persisted and correctly reported zero graph changes.
- Browser requests to non-loopback destinations were blocked; linked research sources were not visited. Normal tested flows produced zero console errors.

## Scope and limits

This verification covers the exercised Windows laptop flow and the isolated local database. It does not validate any clinical diagnosis, treatment, care plan, or prognosis. The research assessment remains educational; NEWS2 is a factual score calculation for professional interpretation. Arbitrary database schemas still require mapping to the supported templates, and scanned-document OCR is not included. No hosting, public access, or remote-service behavior was tested or is needed for the current local-only target.
