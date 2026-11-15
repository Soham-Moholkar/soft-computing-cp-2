# Genetic Algorithm Specification

This is the target optimizer specification. Current UI runs are simulations; a real backend GA optimizer and measured fitness are pending Milestone 6.

## Chromosome

The preferred real-valued chromosome is:

    [entity_threshold, relation_threshold, semantic_weight, graph_weight,
     confidence_weight, source_weight, hop_penalty, centrality_weight]

Binary encoding remains an educational comparison. Production weights are repaired or normalized so each lies in [0,1] and relevant groups sum to approximately one.

## Fitness

Fitness is configurable and versioned:

    F = a·Precision@K + b·Recall@K + c·MRR + d·NDCG
        + e·GraphCoherence − f·Latency − g·Noise − h·DensityPenalty

No single weighting is declared scientifically optimal.

## Operators

Roulette selection:

    P(i) = fitness(i) / Σ fitness(j)

Tournament selection samples k candidates and selects the best. Crossover supports single-point and multi-point recombination. Mutation applies bounded noise or gene-specific mutation. Elitism copies the best candidates.

## Multi-objective mode

Objectives may maximize retrieval quality and graph coherence while minimizing latency and graph noise. The result is a Pareto set, not one forced solution. Record hypervolume, spread and constraint violations.

## Determinism

Every experiment records random seed, dataset version, graph version, configuration schema version and software commit.

## Python interfaces

- Chromosome.decode() → PipelineConfiguration
- FitnessEvaluator.evaluate(configuration, dataset) → FitnessVector
- Selector.select(population, rng)
- Crossover.apply(parent_a, parent_b, rng)
- Mutation.apply(chromosome, rng)
- GeneticAlgorithm.run(config, callback) → OptimizationResult
