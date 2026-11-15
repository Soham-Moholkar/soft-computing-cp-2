# Syllabus Coverage Validation

The executable registry is data/syllabus.ts and the interactive matrix is /syllabus. Each checked line links conceptually to a page, a specification, a future backend module and a project use case.

## Unit I — Foundations

- [x] Soft Computing — / · SOFT_COMPUTING_INTEGRATION.md · hybrid/adaptive.py · whole pipeline
- [x] Hard vs Soft Computing — /fuzzy · FUZZY_ENGINE.md · fuzzy/controller.py · relation acceptance
- [x] Imprecision — /ingestion · KNOWLEDGE_GRAPH_SCHEMA.md · extraction/entity_resolver.py · ambiguous mentions
- [x] Uncertainty — /graph · KNOWLEDGE_GRAPH_SCHEMA.md · graph/schema.py · confidence-carrying graph
- [x] Approximation — /retrieval · RETRIEVAL_PIPELINE.md · retrieval/semantic.py · alias and query matching
- [x] Components of Soft Computing — / · SOFT_COMPUTING_INTEGRATION.md · hybrid/retrieval.py · engine map
- [x] Intelligent Systems — /architecture · SYSTEM_ARCHITECTURE.md · app/main.py · perceive-reason-explain loop
- [x] Hybrid Intelligent Systems — /hybrid · HYBRID_SYSTEMS.md · retrieval/hybrid.py · final retrieval

## Unit II — Fuzzy Logic and Approximate Reasoning

- [x] Crisp Sets vs Fuzzy Sets — /fuzzy · FUZZY_ENGINE.md · fuzzy/membership.py · threshold comparison
- [x] Triangular Membership Function — /fuzzy · FUZZY_ENGINE.md · fuzzy/membership.py · confidence sets
- [x] Trapezoidal Membership Function — /fuzzy · FUZZY_ENGINE.md · fuzzy/membership.py · stable plateaus
- [x] Gaussian Membership Function — /fuzzy · FUZZY_ENGINE.md · fuzzy/membership.py · smooth confidence
- [x] Entity Confidence — /fuzzy · FUZZY_ENGINE.md · fuzzy/controller.py · entity trust
- [x] Relation Confidence — /graph · FUZZY_ENGINE.md · fuzzy/controller.py · edge weighting
- [x] Retrieval Relevance — /retrieval · RETRIEVAL_PIPELINE.md · fuzzy/variables.py · answer ranking
- [x] Fuzzy Set Union — /fuzzy · FUZZY_ENGINE.md · fuzzy/membership.py · evidence fusion
- [x] Fuzzy Set Intersection — /fuzzy · FUZZY_ENGINE.md · fuzzy/rules.py · rule AND
- [x] Fuzzy Set Complement — /fuzzy · FUZZY_ENGINE.md · fuzzy/membership.py · negative evidence
- [x] Fuzzy Relations — /graph · KNOWLEDGE_GRAPH_SCHEMA.md · graph/schema.py · weighted edges
- [x] Fuzzy Relation Composition — /explainability · FUZZY_ENGINE.md · graph/traversal.py · multi-hop strength
- [x] Linguistic Variables — /fuzzy · FUZZY_ENGINE.md · fuzzy/variables.py · human-readable confidence
- [x] Fuzzy Rules — /fuzzy · FUZZY_ENGINE.md · fuzzy/rules.py · approximate decisions
- [x] Approximate Reasoning — /fuzzy · FUZZY_ENGINE.md · fuzzy/mamdani.py · partial rule firing
- [x] Mamdani Inference — /fuzzy · FUZZY_ENGINE.md · fuzzy/mamdani.py · interpretable relevance
- [x] Sugeno Inference — /fuzzy · FUZZY_ENGINE.md · fuzzy/sugeno.py · efficient numeric relevance
- [x] Centroid Defuzzification — /fuzzy · FUZZY_ENGINE.md · fuzzy/defuzzification.py · final score
- [x] Bisector Defuzzification — /fuzzy · FUZZY_ENGINE.md · fuzzy/defuzzification.py · final score
- [x] Mean of Maxima — /fuzzy · FUZZY_ENGINE.md · fuzzy/defuzzification.py · fast final score
- [x] Fuzzy Controller — /fuzzy · FUZZY_ENGINE.md · fuzzy/controller.py · reject/review/accept

## Unit III — Evolutionary Computing

- [x] Biological Inspiration — /evolutionary · GENETIC_ALGORITHM.md · evolutionary/genetic_algorithm.py · evolution cycle
- [x] Chromosome Design — /evolutionary · GENETIC_ALGORITHM.md · evolutionary/chromosome.py · parameter vector
- [x] Binary Encoding — /evolutionary · GENETIC_ALGORITHM.md · evolutionary/chromosome.py · teaching comparison
- [x] Real-valued Encoding — /evolutionary · GENETIC_ALGORITHM.md · evolutionary/chromosome.py · production tuning
- [x] Fitness Function — /evolutionary · GENETIC_ALGORITHM.md · evolutionary/fitness.py · quality-cost balance
- [x] Roulette Wheel Selection — /evolutionary · GENETIC_ALGORITHM.md · evolutionary/selection.py · parent choice
- [x] Tournament Selection — /evolutionary · GENETIC_ALGORITHM.md · evolutionary/selection.py · parent choice
- [x] Single-point Crossover — /evolutionary · GENETIC_ALGORITHM.md · evolutionary/crossover.py · recombination
- [x] Multi-point Crossover — /evolutionary · GENETIC_ALGORITHM.md · evolutionary/crossover.py · recombination
- [x] Mutation — /evolutionary · GENETIC_ALGORITHM.md · evolutionary/mutation.py · diversity
- [x] Constraint Handling — /evolutionary · GENETIC_ALGORITHM.md · evolutionary/chromosome.py · valid weights
- [x] Multi-objective Optimization — /evolutionary · GENETIC_ALGORITHM.md · evolutionary/fitness.py · trade-offs
- [x] Pareto Optimization — /evolutionary · EVALUATION_PLAN.md · evaluation/experiments.py · non-dominated solutions

## Unit IV — Swarm Intelligence

- [x] Collective Behavior — /swarm · SWARM_INTELLIGENCE.md · swarm/aco.py · cooperative search
- [x] Self Organization — /swarm · SWARM_INTELLIGENCE.md · swarm/pso.py · emergent convergence
- [x] Particle Swarm Optimization — /swarm · SWARM_INTELLIGENCE.md · swarm/pso.py · retrieval weights
- [x] PSO Position and Velocity — /swarm · SWARM_INTELLIGENCE.md · swarm/pso.py · parameter update
- [x] Ant Colony Optimization — /swarm · SWARM_INTELLIGENCE.md · swarm/aco.py · graph traversal
- [x] Pheromone Update — /swarm · SWARM_INTELLIGENCE.md · swarm/aco.py · path memory
- [x] Grey Wolf Optimization — /swarm · SWARM_INTELLIGENCE.md · swarm/gwo.py · subgraph selection
- [x] Whale Optimization Algorithm — /swarm · SWARM_INTELLIGENCE.md · swarm/woa.py · pruning search
- [x] Exploration vs Exploitation — /swarm · SWARM_INTELLIGENCE.md · swarm/common.py · search balance
- [x] Comparative Swarm Analysis — /swarm · EVALUATION_PLAN.md · evaluation/experiments.py · algorithm choice

## Unit V — Hybrid Soft Computing

- [x] Neuro-Fuzzy Input Layer — /hybrid · HYBRID_SYSTEMS.md · hybrid/neuro_fuzzy.py · signal intake
- [x] Neuro-Fuzzy Membership Layer — /hybrid · HYBRID_SYSTEMS.md · hybrid/neuro_fuzzy.py · learned sets
- [x] Neuro-Fuzzy Rule Layer — /hybrid · HYBRID_SYSTEMS.md · hybrid/neuro_fuzzy.py · rule firing
- [x] Neuro-Fuzzy Normalization Layer — /hybrid · HYBRID_SYSTEMS.md · hybrid/neuro_fuzzy.py · stable mixture
- [x] Neuro-Fuzzy Output Layer — /hybrid · HYBRID_SYSTEMS.md · hybrid/neuro_fuzzy.py · relevance output
- [x] Adaptive Parameters — /hybrid · HYBRID_SYSTEMS.md · hybrid/adaptive.py · centres, widths and weights
- [x] Fuzzy + Genetic Algorithm — /hybrid · HYBRID_SYSTEMS.md · hybrid/fuzzy_ga.py · fuzzy tuning
- [x] GA + PSO — /hybrid · HYBRID_SYSTEMS.md · hybrid/ga_pso.py · exploration plus refinement
- [x] Adaptive Self-learning System — /hybrid · HYBRID_SYSTEMS.md · hybrid/adaptive.py · feedback learning

## Unit VI — Applications and Emerging Trends

- [x] Healthcare — /applications · SOFT_COMPUTING_INTEGRATION.md · domain/healthcare.py · medical graph
- [x] Agriculture — /applications · SOFT_COMPUTING_INTEGRATION.md · domain/agriculture.py · crop graph
- [x] Finance — /applications · SOFT_COMPUTING_INTEGRATION.md · domain/finance.py · event graph
- [x] Engineering — /applications · SOFT_COMPUTING_INTEGRATION.md · domain/engineering.py · failure graph
- [x] Soft Computing in Machine Learning — /applications · SOFT_COMPUTING_INTEGRATION.md · evaluation/experiments.py · feature and threshold tuning
- [x] Explainable AI using Fuzzy Systems — /explainability · FUZZY_ENGINE.md · explainability/fuzzy_explainer.py · answer rationale
- [x] Real-time Systems — /applications · SYSTEM_ARCHITECTURE.md · ingestion/incremental.py · incremental updates
- [x] Embedded and Edge AI — /applications · SYSTEM_ARCHITECTURE.md · deployment/edge_adapter.py · lightweight retrieval
- [x] Soft Computing vs ML vs Deep Learning — /applications · SOFT_COMPUTING_INTEGRATION.md · docs/decision guide · method selection
- [x] Emerging Hybrid Trends — /applications · HYBRID_SYSTEMS.md · hybrid/adaptive.py · future research

## Validation result

All supplied syllabus topics are represented in the frontend registry, at least one interactive or visual page, an algorithm or architecture document, a future backend module and an evaluation or project use case.
