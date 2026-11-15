# Ration Saathi demonstration

## Show the public help desk

Ask “I moved to another state” and open the official source. Switch to Hindi and ask “मुझे नया राशन कार्ड चाहिए”. Show how the title, next step and graph change. An unrelated question should produce an insufficient-information result. The public guide searches editorial summaries and uses distinctive terms, exact phrases and near spellings; each selected reference opens the corresponding government page. No personal identifier is needed.

Official references are listed with their URLs in [guide-data.json](../lib/ration/guide-data.json). The main documentation reviewed on 15 November 2026 includes the [DFPD portability FAQ](https://dfpd.gov.in/faqs/en), [NFSA application directory](https://nfsa.gov.in/portal/appl/), [NFSA complaint directory](https://www.nfsa.gov.in/portal/State_UT_Online_Grievance_AA), and [Mera Ration 2.0 FAQ](https://nfsa.gov.in/doc/FAQ_for_Mera_Ration_2.pdf). The summaries point to the original publications for current official instructions.

## Show graph creation and review

1. In Evidence Lab, upload [the 128-row fictional CSV](../public/demo/fictional-district-desk.csv) with the file picker. The run button uses the same multipart route.
2. Point out the actual passage count, mention projection, admitted edges and review candidates at the top. Expected results are 128 article rows, 128 canonical concepts, 112 admitted relationships and 16 review candidates.
3. Select a graph node to see its source row and incident edge quotes. Use the page and zoom controls to inspect the larger graph. Open **Review**, inspect an uncertain candidate, mark it reviewed, then open the same file again to confirm the mark persists in the browser.
4. Ask **How is Acacia Help Desk related to Acacia Visit Plan?**. Open the query graph, select each edge, and point to the exact row cited at each hop. Change the question to **How is Acacia Help Desk related to Pine Visit Plan?**. The app can show related passages while giving insufficient evidence for a path.
5. Upload the [27-row guide CSV](../public/demo/ration-guide.csv). Ask **How is One Nation One Ration Card related to Monthly Entitlement?**. It traverses Existing NFSA Card and Portability Claim. Search cannot use edges from another uploaded file.
6. Open **How the search ranked evidence**. The trace shows actual execution stages, the contributions from BM25, graph proximity and fuzzy relevance, and the rule firings. For a scoped question naming two known concepts, the search also considers graph-neighbor passages and reserves citations for a short supported path when the ranked pool and citation budget allow it.

## Test the fork

Run from the RationSaathi folder in PowerShell.

```powershell
pnpm typecheck
pnpm lint
pnpm test
$testRoot = Join-Path (Get-Location) ('output/ration-test-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot | Out-Null
$env:SOFTGRAPH_INGESTION_DB = Join-Path $testRoot 'course.sqlite3'
python -m pytest backend/tests/test_ration_saathi.py --basetemp (Join-Path $testRoot 'pytest')
```

The tests check real multipart ingestion, source-located evidence, graph changes across questions, case isolation and ranking an intermediate hop without exact query words. Browser checks exercise Hindi, keyboard and file picker interactions, the source graph, review marks and the query graph. Accepting new heterogeneous documents is limited by text extraction and supported assertion forms. The built-in Hindi and English guide ranks a curated set of topics. Unfamiliar real-world cases may require the official state service.
