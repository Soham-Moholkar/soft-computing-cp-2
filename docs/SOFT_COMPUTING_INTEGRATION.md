# Soft Computing Integration

## One coherent system

Soft computing is not a collection of disconnected demos. It operates at decision points throughout graph creation and retrieval.

| Pipeline decision | Hard structure | Soft-computing contribution |
| --- | --- | --- |
| Parse a document | File type and parser contract | Approximate cleanup confidence |
| Extract an entity | Typed candidate record | Fuzzy trust from model, source and agreement |
| Resolve aliases | Canonical ID | Approximate candidate memberships |
| Add a relation | Typed source and target | Fuzzy strength and controller decision |
| Prune the graph | Degree and size constraints | GA, GWO or WOA configuration search |
| Understand a query | Request schema | Approximate intent and entity match |
| Traverse paths | Adjacency and hop limit | ACO pheromone and heuristic desirability |
| Rank evidence | Stable score interface | Fuzzy relevance with GA or PSO weights |
| Learn from feedback | Event record | Adaptive rules, weights and pheromone |
| Explain a result | Provenance schema | Linguistic memberships and fired rules |

## Hybrid retrieval score

The default score is a normalized weighted sum:

    S = ws·semantic + wg·graph + wf·fuzzy + wc·centrality
        + wsrc·source + wt·temporal + wp·ACO_path

Weights live in lib/parameters.ts and are exposed through the architecture page. GA performs broad search; PSO refines promising weight vectors.

## Integrity

Every simulated value is labeled in the interface. Actual algorithm comparisons require seeded experiments, recorded datasets, confidence intervals and ablations.
