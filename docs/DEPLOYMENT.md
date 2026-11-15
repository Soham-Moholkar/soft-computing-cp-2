# Deploy SoftGraph to Render

Use one Render Docker web service for the hosted owner demo. Vinext serves HTTPS traffic through Render and forwards `/api/backend` to FastAPI over loopback. One API process owns the six SQLite workspace databases under `/var/data/softgraph`. The existing Windows launcher remains the entry point for the laptop copy.

The Blueprint configures 2 GB RAM and a 2 GB disk. At current Render rates, this is approximately $25.50 per month on the Hobby workspace before usage charges. Render requires paid compute for a persistent disk. [Pricing](https://render.com/pricing) · [Persistent disks](https://render.com/docs/disks)

## Launch

1. Put the application source and deployment files in a private GitHub repository. Review the staged file list before the initial push. Exclude local workspaces, imported records, backups, runtime logs and credentials. Start the hosted demo with empty databases and use synthetic examples.
2. Open [Render Blueprints](https://dashboard.render.com/blueprint/new), connect the private repository and choose the branch containing `render.yaml`.
3. Set `SOFTGRAPH_USERS` in Render to the JSON below, replacing the placeholder with a unique random access key of at least 32 characters. Save the key in your password manager. Render generates the separate session-signing secret.
4. Review the compute and disk charges and apply the Blueprint. The initial deploy uses the Render HTTPS URL for sign-in and checks readiness at `/api/backend/ready`.

```json
{"owner":{"key":"REPLACE_WITH_A_RANDOM_ACCESS_KEY","role":"editor","workspaces":["healthcare","agriculture","engineering","finance","personal","course"]}}
```

## Verify and operate

- Open `/api/backend/ready`. Expect `ready`, six workspaces and authentication enabled. Open `/hospital` in a fresh browser session, sign in and confirm that the same page opens.
- Add a synthetic example, run a cited query, and confirm the saved result survives a service restart. Sign out and check that the protected data is inaccessible.
- Make checksummed SQLite backups of all six databases with the bundled backup utility. Keep copies off the service disk and verify a restore into a separate directory before relying on the hosted instance for durable data. See [operations](OPERATIONS.md).
- Before updating the application, back up the databases. If the update fails, redeploy the previous known-good commit and verify readiness and sign-in. Restore SQLite separately if necessary. A service with an attached disk can briefly go offline during redeploys.
