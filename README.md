# Ration Saathi

Ration Saathi is an English and Hindi help desk for public ration services in India. It has a searchable public guide and a separate Evidence Lab for demonstrating what happens when you upload and query a public document.

## Start locally on Windows

Install Node.js 22.13+, pnpm, and Python 3.12+. From this folder run `pnpm install --frozen-lockfile` and `python -m pip install -r backend/requirements.lock`. Open **Start-RationSaathi.cmd** and keep the launcher window open.

Open [Ration Saathi](http://127.0.0.1:3001/). The fork uses 3001 for the website and 8001 for FastAPI. SQLite data belongs to this fork under `backend/.local`. The existing Care Evidence app can run beside it on ports 3000 and 8000.

In the supplied workspace, the fork can use the installed dependencies from the parent project. An independent checkout can install its own dependencies from its lockfile.

## Try it

- **Policy explorer** interprets plain-language questions about scholarships, small businesses, ration access and social support. Evidence graphs show the published rules, funding and paperwork. The catalogue footer gives the latest coverage counts. See the [policy walkthrough](docs/POLICY_EXPLORER.md).

- **Get help** has 27 editorial summaries with Hindi and English text and links to official sources. Try “I moved to another state,” “The ration shop refused me,” “नया राशन कार्ड,” and “fingerprnt.”
- **Evidence lab → Run guide demo** sends the included [guide CSV](public/demo/ration-guide.csv) through the upload API. Click **Try a multi-hop question** and inspect the resulting query graph.
- **Evidence lab → Run large fictional demo** uploads [128 records about fictional help desks](public/demo/fictional-district-desk.csv). It includes 16 uncertain statements for review. Try **How is Acacia Help Desk related to Acacia Visit Plan?**
- Use **Upload file** to choose your own public TXT, Markdown, text PDF, DOCX, CSV or JSON. Try direct assertions such as “Beacon Desk uses Cedar Sheet. Cedar Sheet feeds Ivory Queue.” Read the passage, select a graph node, ask a question, then click any step in the query graph to see the exact supporting quote.

The public guide runs in the browser and uses the bundled data. Its near-spelling, token and phrase scores describe relevance. Its source excerpts are translated summaries. The Evidence Lab quotes stored text and uses document-scoped BM25, graph proximity, and Mamdani fuzzy relevance. Review marks live in this browser. Editing the public source and uploading a corrected document is how you change the graph.

The app supplies informational steps and official links. Personal eligibility, shop opening hours and official application submissions are handled by the relevant government service. The local app asks for no identity numbers. Use only public or fictional data in the upload demonstration.

See [the demo and verification guide](docs/RATION_SAATHI.md) for presenter cues, the source inventory and repeatable tests. The other documents in this fork are inherited SoftGraph research references.
