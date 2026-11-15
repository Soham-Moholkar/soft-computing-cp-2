# India Policy Explorer

Run the [local site](http://127.0.0.1:3001/) and open **Policy explorer**. The catalogue combines detailed programme profiles and a wider official directory. Directory entries point to the published listing or guideline. Each detailed profile has its own indexed document versions, official URLs, and section or page locators.

## Demo questions

**I am a widow and I need support.** The search recognises widowhood and shows the national pension along with indexed state options. Choose your state to see its published rates and application routes. Open **Who qualifies**, **Money** and **Documents**, then click a graph connection to read its official evidence. Try **My husband passed away in Delhi and I need help** to include the state and retrieve one-time bereavement support where applicable.

1. **I want to buy an auto-rickshaw. Can the government help?** The search identifies a three-wheeler purchase and leaves the use unspecified. MUDRA’s published commercial vehicle coverage names auto-rickshaws. Open **Documents** for the indicative lender checklist. PMEGP appears as a broader business option, and Tamil Nadu has a dated, specifically targeted auto-rickshaw subsidy profile.
2. **I work for Blinkit and need a bike for delivery.** The search identifies two-wheeler, delivery work and platform worker context. Select **Tamil Nadu** to see its registered gig-worker e-scooter programme. The central PM E-DRIVE profile covers eligible electric models. Mention a petrol motorcycle and the electric options drop out.
3. **I sew clothes for customers and need a sewing machine.** The search identifies an equipment purchase and finds microenterprise equipment finance without needing a scheme name.
4. **How did the PM SVANidhi first loan change?** Choose **Compare with → Earlier loan structure**. The earlier and restructured values are linked cell by cell. The graph also shows the document-version relationship.
5. **How are unfilled scholarship slots moved?** Select the PM-USP CSSS result and click the allocation edge. The matching official FAQ is dated to its academic year.
6. **Can I get a college scholarship with another scholarship?** Use the **Evidence graph** to inspect the CSSS concurrent-award restriction. Browse national and state scholarship entries, including Maharashtra’s MCAER fee reimbursement and the dated West Bengal SVMCM notices.

## How the search works

The interpretation step extracts a goal, asset, work context, use, fuel, location, and whether the question asks for money or documents. Users can correct location and vehicle use in the page. English, Hindi, and Bengali phrases are included for selected intents, such as a two-wheeler for delivery. A match identifies an interpretation of the wording, not a verified fact about the user.

The ranker uses graded activity membership, a trapezoidal wording membership, location scope, and documentation depth. The weights are 54%, 27%, 12%, and 7%. Explicit scheme names take priority. Known jurisdiction and fuel exclusions are applied before fuzzy ranking. The ranking trace shows the component scores. These scores rank usefulness for the query and are unrelated to approval probability.

- **Evidence graph** shows published scope, rules, restrictions, documented programme links and indexed revisions.
- **Who qualifies** shows indexed eligibility criteria or explicit restrictions from the selected version.
- **Money** shows loan limits, scholarship rates and subsidies as separate sourced edges. Some profiles accept an illustrative project cost. The calculator applies the indexed formula only within its published ceiling, and carries the source into the graph. Its output is a hypothetical formula result.
- **Documents** shows the official checklist or application route that was indexed for each version. An indicative lender list is labelled as such.

## Sources and catalogue refresh

The detailed profiles are authored in [catalog.ts](../lib/policy/catalog.ts), [expansion.ts](../lib/policy/expansion.ts) and [mobility.ts](../lib/policy/mobility.ts). The [National Scholarship Portal](https://scholarships.gov.in/All-Scholarships), [MahaDBT catalogue](https://mahadbt.maharashtra.gov.in/Home/Index) and [Ministry of MSME scheme list](https://my.msme.gov.in/mymsme/Scheme.aspx/Reg/LdapLogin.aspx) supply directory entries. Save the MahaDBT and MSME listings as `maha.html` and `msme.html` in a source folder and run `python scripts/build-policy-directory.py PATH` to regenerate that snapshot. The scholarship portal entries are named in the script. Directory membership by itself does not establish current availability, eligibility or funding.

The initial goal-based expansion was source-checked on 15 November 2026. The historical versions are retained. Recheck agency publications, coverage, document status, and effective dates when adding or updating claims.

To refresh the MahaDBT evidence, save each official scheme detail page as its `str` token followed by `.html`, install Beautiful Soup if needed, and run `python scripts/build-mahadbt-evidence.py PATH`. The generated snapshot keeps the published section text with the original programme URL and section title. The [national evidence profiles](../lib/policy/national-evidence.ts) and [social support profiles](../lib/policy/welfare.ts) map claims to agency guidance directly. A missing official section leaves that graph empty for the selected version.

The hero uses a generated editorial illustration of an auto-rickshaw and driver on a quiet Pune neighbourhood street, in warm afternoon light, without signage or logos. It was generated with the built-in image tool and encoded locally for delivery as [auto-rickshaw.webp](../public/policy/auto-rickshaw.webp).

## Verification

Run TypeScript and lint checks with `pnpm typecheck` and `pnpm lint`. With the local preview running and Playwright available, `node scripts/verify-policy-browser.mjs` checks catalogue breadth, plain-language goals, source-backed amounts and documents, state and fuel constraints, Bengali queries, earlier documents and mobile layout.
