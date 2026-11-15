# Hybrid Systems Specification

The neuro-fuzzy, Fuzzy-GA, GA-PSO and adaptive methods below are proposed designs. The current hybrid lab is simulated; active API hybrid retrieval combines BM25, graph proximity and fixed fuzzy scores, with guarded optional ranker artifact loading. No experimental model is promoted.

## Neuro-Fuzzy architecture

1. Input neurons hold semantic similarity, graph distance, entity confidence, relation confidence, source reliability, centrality and query intent.
2. Membership neurons evaluate linguistic sets with learnable centres and widths.
3. Rule neurons calculate individual fuzzy-rule firing strengths.
4. Normalization neurons divide each firing strength by the total.
5. Output neurons produce retrieval relevance or entity acceptance confidence.

Trainable values are membership centres, widths, rule weights, retrieval weights and confidence thresholds.

## Fuzzy-GA

GA proposes candidate fuzzy configurations. The fuzzy system evaluates a validation query set. Retrieval and calibration metrics become fitness. GA then selects, crosses and mutates candidates.

## GA-PSO

GA provides global evolutionary exploration. The best diverse candidates initialize PSO particles. PSO refines them through personal and global best updates. Compare this hybrid with equal-budget GA-only and PSO-only ablations.

## Adaptive retrieval

Feedback events are Relevant, PartiallyRelevant and Irrelevant. Pass 2 may use them to adjust rule utility, ranking weights, ACO pheromone, entity confidence and source reliability. Updates require rate limits, rollback, versioning and offline validation before promotion.

## Guardrails

- Never update production parameters directly from one feedback event.
- Preserve the configuration that generated each answer.
- Evaluate drift and group-level error.
- Keep rules and learned adjustments inspectable.
