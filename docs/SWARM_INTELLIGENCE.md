# Swarm Intelligence Specification

This is the target swarm specification. Current UI runs are simulations; backend PSO/ACO/GWO/WOA execution and measured objective comparisons remain pending.

## Particle Swarm Optimization

A particle represents retrieval weights. Update:

    v(t+1) = w·v(t) + c1·r1·(pBest−x) + c2·r2·(gBest−x)
    x(t+1) = x(t) + v(t+1)

Repair keeps weights in bounds and normalizes required groups. Primary use: retrieval tuning. Secondary uses: clustering, fuzzy thresholds, pruning and entity resolution.

## Ant Colony Optimization

The knowledge graph is the environment, edges are paths, ants are search agents, pheromone is historical utility and heuristic desirability is semantic or relevance evidence.

Transition probability:

    P(i→j) = τij^α · ηij^β / Σk(τik^α · ηik^β)

Pheromone update:

    τij ← (1−ρ)τij + Σants Δτij

ACO returns ranked paths, visited nodes, path scores and a per-edge pheromone trace.

## Grey Wolf Optimization

Alpha, beta and delta are the three leading solutions. Omega wolves update positions relative to those leaders while coefficient a decreases to shift from exploration to exploitation. Primary use: candidate subgraph and feature selection.

## Whale Optimization Algorithm

WOA switches among global search, encircling and logarithmic spiral exploitation. Primary uses: graph pruning, clustering and retrieval configuration.

## Comparison

No optimizer is universally best. Evaluate best fitness, iterations to target, execution time, diversity, exploitation strength and task-specific utility under equal budgets.

## Python interfaces

- ParticleSwarm.run(search_space, objective, callback)
- AntColony.search(graph, seeds, query, max_hops, callback)
- GreyWolf.run(search_space, objective, callback)
- WhaleOptimizer.run(search_space, objective, callback)
