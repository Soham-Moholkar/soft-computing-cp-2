# India Policy Explorer

Run the [local site](http://127.0.0.1:3001/). The home page opens the policy explorer. The catalogue combines detailed programme profiles and a wider official directory. Directory entries point to the published listing or guideline. Each detailed profile has its own indexed document versions, official URLs, and section or page locators.

## Demo questions

**I am a widow and I need support.** The search recognises widowhood and shows the national pension along with indexed state options. Choose your state to see its published rates and application routes. Open **Eligibility & requirements**, **Money** and **Documents**, then select an item to read its evidence. Try **My husband passed away in Delhi and I need help** to include the state and retrieve one-time bereavement support where applicable.

**I am a single parent and need help supporting my children.** Try this or **I need help for an orphan living with relatives**. The explorer finds Mission Vatsalya’s child sponsorship guidance and shows state profiles where indexed. Its eligibility graph explains the exact child and family circumstances in the source.

1. **I want to buy an auto-rickshaw. Can the government help?** The search identifies a three-wheeler purchase and leaves the use unspecified. MUDRA’s published commercial vehicle coverage names auto-rickshaws. Open **Documents** for the indicative lender checklist. PMEGP appears as a broader business option, and Tamil Nadu has a dated, specifically targeted auto-rickshaw subsidy profile.
2. **I work for Blinkit and need a bike for delivery.** The search identifies two-wheeler, delivery work and platform worker context. Select **Tamil Nadu** to see its registered gig-worker e-scooter programme. The central PM E-DRIVE profile covers eligible electric models. Mention a petrol motorcycle and the electric options drop out.
3. **I sew clothes for customers and need a sewing machine.** The search identifies an equipment purchase and finds microenterprise equipment finance without needing a scheme name.
4. **How did the PM SVANidhi first loan change?** Choose **Compare with → Earlier loan structure**. The earlier and restructured values are linked cell by cell. The graph also shows the document-version relationship.
5. **How are unfilled scholarship slots moved?** Select the PM-USP CSSS result and click the allocation edge. The matching official FAQ is dated to its academic year.
6. **Can I get a college scholarship with another scholarship?** Use the **Evidence graph** to inspect the CSSS concurrent-award restriction. Browse national and state scholarship entries, including Maharashtra’s MCAER fee reimbursement and the dated West Bengal SVMCM notices.

## How the search works

The interpretation step extracts a goal, asset, work context, use, fuel, location, and whether the question asks for money or documents. Users can correct location and vehicle use in the page. English, Hindi, and Bengali phrases are included for selected intents, such as a two-wheeler for delivery. The policy explorer's interface and catalogue are primarily English; the English/Hindi language switch applies to the separate ration help desk and Evidence Lab. A match identifies an interpretation of the wording, not a verified fact about the user.

The ranker uses graded activity membership, a trapezoidal wording membership, location scope, and documentation depth. The weights are 54%, 27%, 12%, and 7%. Explicit scheme names take priority. Known jurisdiction and fuel exclusions are applied before fuzzy ranking. The ranking trace shows the component scores. These scores rank usefulness for the query and are unrelated to approval probability.

- **Evidence graph** shows published scope, rules, restrictions, documented programme links and indexed revisions.
- **Eligibility & requirements** groups indexed eligibility criteria, exclusions, document requirements and application steps, with source evidence where available.
- **Money** shows loan limits, scholarship rates and subsidies as separate sourced edges. Some profiles accept an illustrative project cost. The calculator applies the indexed formula only within its published ceiling, and carries the source into the graph. Its output is a hypothetical formula result.
- **Documents** shows the official checklist or application route that was indexed for each version. An indicative lender list is labelled as such.

## Eligibility & requirements workspace

Select a policy result and its **Document version**, then open **Eligibility & requirements**. This workspace shows four separate groups: eligibility criteria, exclusions, required documents, and application steps. The selected policy and version anchor the graph. Selecting a graph item opens its evidence and source locator. Version history and the other evidence views, including published funding information, remain available in the explorer.

Evidence is labelled by provenance. Recorded excerpts are source text saved from the cited section; curated summaries are editorial descriptions linked to their source. The catalogue is not a full-text copy of every programme document, and an official directory listing alone does not establish current eligibility, funding, or availability.

### Extract and review a document excerpt

1. Open **Extract from a policy document** in the selected policy's Eligibility & requirements workspace.
2. Enter a **Document title**, then either paste an excerpt or choose a TXT/Markdown file. The text limit is 60,000 characters. PDF files cannot be selected directly; copy the relevant PDF text into the text area.
3. Choose **Review extracted passages**. The extractor looks for recognizable headings and requirement language, then groups matching lines, up to 200 possible requirements. If an excerpt produces more, choose a shorter section. Suggested categories are a starting point: confirm each passage and its context against the full document.
4. Uncheck anything that does not belong in this policy's graph and choose **Add selected passages to graph**. The graph labels these as excerpts you supplied and shows the title and line/section locator. They are scoped to the selected policy and version in the current browser tab. Removing them clears those added passages.

The feature reads the text locally in the browser and does not upload it to the ingestion API. User-provided excerpts are unverified; the app does not confirm their issuing authority, effective date, completeness, or authenticity. It extracts and organizes evidence, not a personal eligibility verdict. Check all combined conditions and exceptions in the official document, and ask the programme authority to determine eligibility.

### Short presentation walkthrough

1. Search **I am a widow and I need support**, open a result, and point out its source and **Document version** selector.
2. Open **Eligibility & requirements**. Select an eligibility or document item and show the evidence label, locator, excerpt, and **Open source** link. Explain that the summary and recorded excerpt labels describe different levels of source fidelity.
3. Expand **Extract from a policy document** and choose the supplied [fictional policy excerpt](../public/demo/fictional-policy-excerpt.txt), or paste its text. Select **Review extracted passages**.
4. Inspect the suggested passages, then add the selected passages. Select an added eligibility or exclusion item and open **Read the surrounding text**. This shows the adjacent condition, including the repayment-arrangement exception, so viewers can see why a matching line should be read in context.
5. Remind viewers that the sample is fictional, matching is a discovery aid, uploaded text is unverified and tab-scoped, and the programme authority determines eligibility.

The small TXT fixture is synthetic and should not be presented as a real programme rule.

## Local language model and government directory

When the search cannot identify a goal or find matches, **Try local interpretation** asks Ollama on this computer to classify the wording into a supported search intent. Confirm the suggested wording to rerun the catalogue search. The model supplies the search intent. Amounts, eligibility and source passages come from the catalogue. The Windows launcher defaults to the installed `qwen3:8b` tag when Ollama is present. Set `RATION_POLICY_OLLAMA_MODEL` before starting the launcher to use another already-installed chat model. The catalogue search works when Ollama is unavailable.

[myScheme](https://www.myscheme.gov.in/) is the Government of India’s scheme discovery portal. [MeitY’s API Setu overview](https://docs.apisetu.gov.in/document-central/explore-apisetu/Overview.html) lists myScheme as a service API and explains consumer registration and subscription. Official live integration would require that access and the approved API documentation. The explorer currently links to the public portal.

## Sources and catalogue refresh

The detailed profiles are authored in [catalog.ts](../lib/policy/catalog.ts), [expansion.ts](../lib/policy/expansion.ts) and [mobility.ts](../lib/policy/mobility.ts). The [National Scholarship Portal](https://scholarships.gov.in/All-Scholarships), [MahaDBT catalogue](https://mahadbt.maharashtra.gov.in/Home/Index) and [Ministry of MSME scheme list](https://my.msme.gov.in/mymsme/Scheme.aspx/Reg/LdapLogin.aspx) supply directory entries. Save the MahaDBT and MSME listings as `maha.html` and `msme.html` in a source folder and run `python scripts/build-policy-directory.py PATH` to regenerate that snapshot. The scholarship portal entries are named in the script. Directory membership by itself does not establish current availability, eligibility or funding.

The initial goal-based expansion was source-checked on 15 November 2026. The historical versions are retained. Recheck agency publications, coverage, document status, and effective dates when adding or updating claims.

To refresh the MahaDBT evidence, save each official scheme detail page as its `str` token followed by `.html`, install Beautiful Soup if needed, and run `python scripts/build-mahadbt-evidence.py PATH`. The generated snapshot keeps the published section text with the original programme URL and section title. The [national evidence profiles](../lib/policy/national-evidence.ts) and [social support profiles](../lib/policy/welfare.ts) map claims to agency guidance directly. A missing official section leaves that graph empty for the selected version.

The hero uses a generated editorial illustration of an auto-rickshaw and driver on a quiet Pune neighbourhood street, in warm afternoon light, without signage or logos. It was generated with the built-in image tool and encoded locally for delivery as [auto-rickshaw.webp](../public/policy/auto-rickshaw.webp).

## Verification

Run TypeScript and lint checks with `pnpm typecheck` and `pnpm lint`. With the local preview running and Playwright available, `node scripts/verify-policy-browser.mjs` checks catalogue breadth, plain-language goals, source-backed amounts and documents, state and fuel constraints, Bengali queries, earlier documents and mobile layout.
