# Ration Saathi

Ration Saathi is a source-linked guide to Indian public programmes, with a separate ration help desk and a document evidence lab. The policy explorer helps people find relevant published information; it does not decide personal eligibility or submit applications.

## Start locally on Windows

Install Node.js 22.13+, pnpm, and Python 3.12+. From this folder run `pnpm install --frozen-lockfile` and `python -m pip install -r backend/requirements.lock`. Open **Start-RationSaathi.cmd** and keep the launcher window open.

Open [Ration Saathi](http://127.0.0.1:3001/). The site uses port 3001 and FastAPI uses port 8001. SQLite data belongs to this fork under `backend/.local`. The existing Care Evidence app can run beside it on ports 3000 and 8000.

## Explore policies

Search in plain language, open a result, select its published document version, and inspect the source-linked evidence graph. The **Eligibility & requirements** workspace separates eligibility criteria, exclusions, required documents, and application steps. Select an item to inspect its cited passage and source. The [policy walkthrough](docs/POLICY_EXPLORER.md) covers the search, source/version controls, and a short presentation demo.

Where recorded source text is available, its section excerpts are identified as such; other catalogue entries are labelled as curated summaries. For another document, paste text or choose a TXT/Markdown file up to 60,000 characters, review up to 200 extracted passages, then add only selected passages to the graph for the current policy and version. PDF files are not uploaded by this feature; copy the relevant PDF text into the text area. User-supplied excerpts are unverified and remain in the current browser tab. Extraction is a review aid, not an eligibility decision. Read the complete official source for combined conditions and exceptions.

The public ration help desk has 27 editorial summaries with Hindi and English text and links to official sources. Try “I moved to another state,” “The ration shop refused me,” “नया राशन कार्ड,” or “fingerprnt.” The separate Evidence Lab includes [demo data](public/demo/ration-guide.csv) and a [fictional help-desk dataset](public/demo/fictional-district-desk.csv); its document quotes are distinct from the policy catalogue’s summaries. See [the ration help-desk demo guide](docs/RATION_SAATHI.md).

The app supplies informational steps and official links. Personal eligibility, shop opening hours, and official applications are handled by the relevant government service. No identity numbers are needed for these demonstrations. Use public or fictional data in the Evidence Lab.

## Implementation notes

The explorer's search scores help rank catalogue matches and are not approval probabilities. Local Ollama, when installed, can suggest a search intent for an unclear query; it does not provide an eligibility decision. The catalogue search works without Ollama. There is no live myScheme/API Setu integration in this fork; the explorer links to public sources.

See [deployment instructions](docs/DEPLOYMENT.md) for running the services outside the local launcher. Other documents in this fork include inherited SoftGraph research references.
