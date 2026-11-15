# Care Evidence live demo

Care Evidence is a local hospital operations workspace for handoff procedures. The audience sees a file go from upload to a navigable knowledge graph, then uses that same source to answer an operations question. The fictional Cedar Ward procedure is the rehearsal file.

## Set up before presenting

1. Open [Start-SoftGraph.cmd](../Start-SoftGraph.cmd) on your Windows laptop. Leave its window open. The launcher builds if needed and opens [the local workspace](http://127.0.0.1:3000/).
2. Put [ward-handoff-procedure.txt](../public/demo/ward-handoff-procedure.txt) on your desktop or in Downloads. You can also use **Download example** in the hero.
3. For the pitch, share the browser window and use 100% browser zoom. Practice once on the same laptop. To repeat the demo, upload the same file with its original name or click **Run demo file**. Both actions use the same upload and graph pipeline. An identical submission reuses the saved source.
4. To show a fresh workspace while keeping your regular records available, stop the launcher and run the following from the project folder. Keep using that shell for the demo. Each new path creates a separate set of SQLite files.

```powershell
$demoPath = Join-Path (Get-Location) ('output/verification/live-demo-' + [Guid]::NewGuid().ToString('N'))
$env:SOFTGRAPH_INGESTION_DB = Join-Path $demoPath 'course.sqlite3'
.\Start-SoftGraph.cmd
```

## Six-minute presentation script

### 0:00–0:45 · Overview

> “A handoff procedure links checklists, roles and follow-up work. When the procedure lives in a document, a coordinator has to locate and interpret those links manually. Care Evidence gives hospital operations teams a navigable map of the procedure and a way to inspect the original language behind it. I’ll use a fictional ward procedure so you can follow every claim against the same file.”

Point to the graph and **Ask evidence** panels. The top cards show the number of indexed procedure files and the concepts, accepted relationships, and review candidates in the active file.

### 0:45–1:45 · Upload and build the graph

Click **Upload source**, select **ward-handoff-procedure.txt**, and wait for **Source indexed**. On a fresh demo database, expect **1 indexed source, 8 concepts, 9 relationships, and 2 candidates needing review**. With previous uploads, the source count can be higher. The other three metrics describe the selected file.

> “The browser sends the actual file to the local API. A background job parses the text, breaks it into overlapping passages, and retains where those passages came from. Once the job finishes, Care Evidence builds the graph and shows the result. The upload and graph are saved in local SQLite, so I can reopen the file after restarting.”

Click **Sources → Read source text** if someone asks to inspect the stored text. **Run demo file** is the quick recovery if the file picker is awkward on a projector.

### 1:45–2:45 · Inspect an accepted edge and a review candidate

Open **Knowledge graph** and click **Care Handoff**. The inspector shows its source and associated edge quotes. Open **Relationships** and find the statement **Care Handoff uses Discharge Checklist**. Open **Needs review** and point to **Medication Reconciliation might improve Referral Queue**.

> “The extractor recognizes common hospital operations concepts and can add new ones from explicit statements. It normalizes those mentions into nodes and looks for supported predicates in the same sentence. The graph stores directed, typed relationships with supporting quotes. A statement with ‘might’ stays in review. The second candidate is co-occurrence: both concepts are mentioned together, but the source gives no supported predicate. A reviewer can inspect both statements. The score is an extraction heuristic.”

### 2:45–4:15 · Search, open a citation, explain the ranking

Under **Ask evidence**, click **How does Care Handoff use Discharge Checklist?**. The first citation contains the sentence shown in the graph. Click **How is Referral Queue related to Procedure Library?** and point to **Referral Queue → Follow Up Plan → Procedure Library**, with a citation attached. Open **Why these results ranked here**.

> “Search starts with term matching and BM25, then looks at graph proximity and fuzzy relevance. Graph traversal uses a bounded breadth-first search, so the app can explain which concepts connect and check that the path’s edges are cited. The default healthcare policy combines the three signals at 65, 20, and 15 percent. I can show those contributions, along with the fuzzy rules that fired. The app returns quoted source text. The score tells us how the passage ranked.”

> “Fuzzy inference lets evidence be partly weak and partly strong. The Mamdani rules combine lexical match strength, extracted relation strength, and graph distance. Centroid defuzzification turns the combined fuzzy output into a number. That number is one input to ranking. Graph admission uses separate, explicit extraction rules and thresholds.”

The ranking selector can repeat the same question with **Text ranking**, **Graph ranking**, or **Fuzzy ranking**. A one-passage file may yield the same citation in each mode. Compare the contributions and weights to show what changed.

### 4:15–5:00 · Show the evidence boundary

Click **What is the lunch menu on Mars?**. Expect **Insufficient evidence**.

> “The query is restricted to the selected document. The service checks whether retrieved passages cover the query terms and, where a relationship question names known concepts, whether the path can be supported by citations. It withholds an answer when those checks fail. Open the cited passage yourself for questions where wording or context matters.”

### 5:00–6:00 · Close for the audience

**For professors**

> “The core application combines deterministic graph construction, approximate reasoning, hybrid ranking, and an inspectable inference trace. The same query and source let me demonstrate a direct relation, a multi-hop path, an uncertain assertion, and an abstention. In **Learning lab**, I can also walk through the course experiments with evolutionary and swarm methods.”

**For investors**

> “The first workflow is helping a hospital operations team find the documented links across a handoff procedure and inspect the supporting language. A pilot could measure time to find the supporting passage, agreement with an operations reviewer on extracted edges, and the rate at which unsupported questions are correctly withheld. The current release runs on one laptop, with a rule-based extractor and no external ranking provider.”

## Second file for a fresh test

Upload [equipment-readiness-procedure.txt](../public/demo/equipment-readiness-procedure.txt). The graph should show **12 new concepts, 11 relationships, and 2 candidates for review**. Use the zoom buttons to inspect the larger graph and click a concept to highlight its neighbors. Ask **How is Equipment Register related to Service Review?** and expand the path **Equipment Register → Asset Audit → Service Review**. Each hop shows its exact source quote and citation.

For new material, try one direct statement per line and repeat the same term consistently. For example, “The Equipment Register supports the Asset Audit.” Supported verbs include uses, supports, requires, triggers, depends on, and routes to. Text remains searchable when no graph relationship is recognized. Use **Sources → Rebuild graph** to reprocess a previously uploaded document with the current extractor.

## Architecture and technical questions

| Topic | What to say |
| --- | --- |
| Interface | React and TypeScript render the same selected source in the metrics, graph, and search panels. The graph canvas places recognized concepts and plots actual accepted relationships. Selecting a node opens its evidence inspector. |
| API boundary | The website calls a same-origin Vinext route. It forwards requests to the local FastAPI service and the healthcare workspace. The healthcare workspace has a separate SQLite database. |
| File ingestion | The multipart endpoint checks the format and size. The asynchronous job parses and chunks the text with 400-word windows and up to 64 words of overlap. Paragraph, page, CSV row, and JSON path boundaries supply provenance. TXT and Markdown use a section location. |
| Formats | TXT and Markdown use UTF-8. Use DOCX body text, text-based PDF, CSV with headers, or a JSON object or array. Files can be up to 10 MiB, subject to parser and graph limits. Scanned PDFs need OCR before upload. Empty or malformed files show a processing error. Vocabulary-light sources may give an empty graph while remaining searchable. |
| Graph extraction | The versioned healthcare extractor recognizes eight built-in concepts and new labels in simple subject–verb–object statements. It checks sentence context and typed predicates such as uses, supports, and requires. The working acceptance thresholds are 0.80 for entity mentions and 0.75 for relation candidates. Negation, hedges, and unsupported predicates keep a proposed edge out of the graph. |
| Graph storage | SQLite retains source chunks, mentions, candidate relations, and the graph projection. Canonical IDs merge repeated mentions of the same concept. Typed source–predicate–target keys prevent duplicate edges. Source citations keep their original evidence. |
| BM25 | Ranks lexical matches using term frequency, inverse document frequency, and passage length normalization. A term-coverage factor gives less weight to passages that match only part of the question. The workspace index supplies term statistics. |
| Graph retrieval | Breadth-first search starts from matched concepts and stops at three hops in this interface. Traversal can follow either direction, while the graph stores edge direction. In the cited result, a path uses edges supported by the returned citations. |
| Fuzzy logic | Continuous inputs have graded memberships. Mamdani rules fire partially, aggregate output memberships, and reduce the result to a scalar via centroid defuzzification. The lexical feature is used as the matching input. |
| Hybrid ranking | Default score = 0.65 × normalized lexical score + 0.20 × graph proximity + 0.15 × fuzzy relevance. The ranking trace shows raw signals, weights, contributions, rule firings, and versions. Scores are uncalibrated heuristics. |
| Genetic algorithm | The Learning lab evolves candidate ranker weight vectors using fitness evaluation, selection, crossover, and mutation. Candidate fitness measures ranking behavior on evaluation data. |
| Swarm methods | The Learning lab uses PSO to refine candidate weights with personal and shared best positions. It demonstrates ACO path search using pheromone and edge desirability. GWO and WOA provide further optimizer comparisons. |
| Neuro-fuzzy and hybrids | The lab demonstrates research candidates that tune a fuzzy ranker from training data and use combined search strategies. Live Care Evidence ranking uses the fixed healthcare policy. |
| Evaluation | A passing test checks behavior on known cases. A pilot would need reviewer-labeled procedures, path and citation judgments, and held-out questions to measure extraction precision and recall, retrieval quality and abstention. |

## Rehearsal checklist

| Test | Action | Expected |
| --- | --- | --- |
| Actual upload | Upload the supplied TXT using the native file picker. | 8 concepts, 9 relationships and 2 in review. |
| Evidence fidelity | Select Care Handoff, then search the direct question and read citation 1. | The inspector and original passage both support the uses relationship. |
| Multi-hop | Search the Referral Queue question. | Path via Follow Up Plan to Procedure Library with citation 1. |
| Uncertainty | Open Needs review. | The candidate with “might improve” stays out of Relationships. |
| Abstention | Ask the Mars question. | Insufficient evidence. |
| Idempotency | Run the demo or re-upload the same file under the same name. | Same source and graph. The source count does not increase. |
| Invalid input | Try uploading an empty TXT. | An empty-file error and the currently selected graph remains visible. |
| No graph vocabulary | Upload a UTF-8 TXT containing only “The linen delivery arrives at sunrise.” Search for “linen delivery.” | Zero concepts and relationships, with a cited source excerpt. |
| Persistence | Close the launcher, restart it with the same database path, and select the demo source. | The source text, graph, and review candidates are available again. |

## Run the automated checks

Run the targeted pipeline tests against a disposable test database from the project folder. They verify the exact demo fixture, direct and multi-hop evidence, abstention, persistence, duplicate uploads, malformed CSV, citation locations for alternative file formats, and isolation between sources.

```powershell
$testPath = Join-Path (Get-Location) ('output/verification/care-evidence-test-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testPath | Out-Null
$env:SOFTGRAPH_INGESTION_DB = Join-Path $testPath 'course.sqlite3'
python -m pytest backend/tests/test_care_evidence.py --basetemp (Join-Path $testPath 'pytest')
pnpm test
```
