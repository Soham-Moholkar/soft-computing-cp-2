# Hospital records and educational assessment

The Hospital records area stores patient and encounter records locally in the healthcare workspace. It supports manual patient registration, structured imports, attached source documents, a patient timeline, and patient-scoped evidence search. The database starts empty. Use a stable patient ID that does not contain a person's name; IDs, not labels, keep encounters separate.

## Import structured records

Open **Hospital records → Import records**. The page offers downloadable templates in CSV, JSON, Excel `.xlsx`, and SQLite formats. Start from a template when adapting an existing file: import requires the documented patient/encounter fields and does not guess how unrelated columns map to records. Additional input columns are retained as raw source evidence.

Each encounter needs:

- `patient_id`: stable local identifier, up to 100 characters.
- `encounter_id`: stable identifier unique within that patient.
- `recorded_at`: ISO date or timestamp, such as `2026-11-14` or `2026-11-14T09:00:00+05:30`.

Optional fields are `patient_label`, `observations`, `conditions`, `care_plan`, `prognosis_note`, and `notes`. An observation has a name, recorded value, and unit. A condition has a name and one explicit status: `confirmed`, `suspected`, `negated`, or `historical`. Care plans and prognosis notes are stored as supplied text; the app does not write them or turn an assessment score into a plan.

| Format | Expected shape | Handling |
|---|---|---|
| CSV | One encounter per row; required columns above. `observations` and `conditions` cells contain JSON arrays. | Header and row widths are checked; source row numbers are retained. |
| JSON | A top-level array of encounter objects. `observations` and `conditions` are JSON arrays. | Duplicate JSON keys are refused; JSON path is retained. |
| Excel `.xlsx` | Header row and encounter rows on a worksheet. Choose a sheet if the workbook has more than one. | Values are read without executing formulas; formula cells are refused. Worksheet and row provenance are retained. Legacy `.xls` is not supported. |
| SQLite | A database containing a normal table with the encounter columns. Choose a table when needed. | The selected source is opened read-only. Views, triggers, virtual tables, SQL scripts, and schema inference are not supported; scan-row provenance is retained. |

Imports are limited to 2 MiB and 1,000 records per file. The local workspace holds at most 5,000 encounters, 500 encounters per patient, and 32 MiB of stored encounter content. Invalid files fail as a whole rather than partially importing. Re-importing unchanged encounter identifiers does not create duplicate entries. Four downloadable templates are available from the page.

## Attach documents and inspect evidence

You can attach source documents to a selected patient. General ingestion also accepts TXT, Markdown text, PDF, DOCX, CSV, and JSON. DOCX extraction reads body paragraphs and tables and records paragraph/table-row/cell locations. It displays safe cached Word field results without executing field instructions; external hyperlink target URLs are not followed, and only visible hyperlink text is imported. Macros, embedded objects, `altChunk` content, other linked external content, images requiring OCR, headers, footers, and comments are not imported. The old binary `.doc` and `.xls` formats are unsupported. PDFs are text-extracted; scanned PDFs need OCR, which is not included.

For a patient query, SoftGraph filters to that patient before matching words against recorded encounter fields and attached document text. Results show matching excerpts and their source locations. This is literal evidence search, not a clinical question-answering system: it does not infer diagnoses, reconcile conflicting records, or predict treatment or prognosis. The displayed graph links the patient to encounters, recorded fields, and explicitly attached source documents; it does not infer medical relationships.

## Educational assessment

The separate **Educational assessment** page has three distinct tools. All are educational demonstrations and must not guide care.

**Cleveland heart-disease-pattern model.** This small fuzzy/Sugeno research model uses the Cleveland file from the [UCI Heart Disease dataset](https://archive.ics.uci.edu/dataset/45/heart+disease) (303 rows). A fixed grouped split used 181 training, 61 validation, and 61 held-out test records. The held-out result was 80.3% accuracy and 0.843 AUROC; sensitivity was 71.4% and specificity 87.9%. The target means the dataset's angiographic disease-presence class, and inputs include findings such as colored vessels and thallium tests. It is not a screening test, calibrated patient probability, diagnosis, causal explanation, or prognosis. Attribution: Janosi, A., Steinbrunn, W., Pfisterer, M., and Detrano, R. (1989), *Heart Disease*, UCI Machine Learning Repository, [DOI 10.24432/C52P4X](https://doi.org/10.24432/C52P4X). The dataset is licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); source-file hash is in `backend/app/hospital/data/provenance.json` and model artifact hashes are in its manifest.

**Heart-failure 90-day candidate.** This research dataset from [UCI Heart Failure Clinical Records](https://archive.ics.uci.edu/dataset/519/heart+failure+clinical+records) has 299 records; the fixed-horizon cohort excludes 43 people whose survival observation ended before day 90, leaving 256. On the held-out 52-record test set, the candidate detected 0 of 14 positive outcomes (sensitivity 0). It is explicitly **rejected**: its public prediction evaluation is disabled, and a negative class must never be used for reassurance. It is not a survival model. Attribution: Chicco, D. and Jurman, G. (2020), *Heart Failure Clinical Records*, UCI Machine Learning Repository, [DOI 10.24432/C5Z89R](https://doi.org/10.24432/C5Z89R). The dataset is licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); source-file hash is in `backend/app/hospital/data/provenance.json` and model artifact hashes are in its manifest.

**NEWS2 Scale 1 calculator.** This is a factual arithmetic implementation based on the Royal College of Physicians [NEWS2 Chart 1](https://www.rcp.ac.uk/media/alxev00t/news2-chart-1_the-news-scoring-system_0_0.pdf) and [2017 report](https://www.rcp.ac.uk/media/a4ibkkbf/news2-final-report_0_0.pdf). It displays each parameter score, the total, and whether any single parameter scored 3. It is restricted to adults, requires confirmation that pregnancy is not applicable and that SpO₂ Scale 2 is not indicated, and accepts inputs in the displayed units without conversion. It is not a new diagnosis, mortality probability, long-term prognosis, treatment recommendation, or clinical response system. A zero or small score does not establish safety; qualified professionals must interpret any clinical score and decide any response. The calculation is not saved and does not call external services.

The app does not automatically run either research model on hospital records. The record tool and educational assessment tool remain separate.
