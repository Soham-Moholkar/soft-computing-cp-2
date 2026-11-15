# Parameter Registry

The executable registry is lib/parameters.ts and the complete interactive view is /architecture.

## Ingestion

- chunk_size 512, range 128–2048
- chunk_overlap 64, range 0–256
- minimum_chunk_length 80, range 16–512

## Extraction

- entity_threshold 0.62
- relation_threshold 0.58
- entity_resolution_threshold 0.78

## Fuzzy

- membership centres, widths and shapes
- rule weights
- inference_method: Mamdani or Sugeno
- defuzzification_method: centroid, bisector or mean of maxima

## GA

- population_size 36
- generations 60
- mutation_rate 0.08
- crossover_rate 0.82
- elitism 2
- selection_method and encoding

## PSO

- particle_count 30
- inertia_weight 0.72
- cognitive_coefficient 1.45
- social_coefficient 1.55
- iterations

## ACO

- ant_count 24
- pheromone_importance 1.20
- heuristic_importance 2.00
- evaporation_rate 0.28
- pheromone_deposit
- iterations and max_hops

## GWO

- wolf_count 24
- iterations
- exploration_coefficient 1.60

## WOA

- whale_count 26
- iterations
- spiral_constant 1.00
- exploration parameters

## Retrieval

- semantic_weight 0.26
- graph_weight 0.18
- fuzzy_weight 0.20
- centrality_weight 0.09
- source_weight 0.10
- temporal_weight 0.05
- path_weight 0.12
- max_hops and top_k

Parameter sets are immutable after promotion. Every result stores the configuration version.
