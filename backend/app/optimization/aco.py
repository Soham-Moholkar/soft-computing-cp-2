"""Seeded ant-colony traversal over actual stored relation evidence."""
from random import Random


def search(entities, relations, source, target, ants=12, iterations=12, max_hops=5, seed=17, directed=False):
    names = {entity.entity_id: entity.canonical_name for entity in entities}
    if source not in names or target not in names or source == target:
        raise ValueError("Choose two different existing graph entities")
    if not 1 <= ants <= 32 or not 1 <= iterations <= 32 or not 1 <= max_hops <= 10:
        raise ValueError("ACO search limits exceeded")
    adjacency, pheromone = {key: [] for key in names}, {edge.relation_id: 1. for edge in relations}
    for edge in relations:
        adjacency[edge.source_entity].append((edge.target_entity, edge))
        if not directed: adjacency[edge.target_entity].append((edge.source_entity, edge))
    random, paths, trace, best = Random(seed), {}, [], 0.
    for iteration in range(iterations):
        deposits = {key: 0. for key in pheromone}
        successes = 0
        for _ in range(ants):
            current, visited, edges, route = source, {source}, [], [source]
            for _ in range(max_hops):
                options = [(neighbor, edge) for neighbor, edge in adjacency[current] if neighbor not in visited]
                if not options: break
                current, edge = random.choices(options, weights=[pheromone[edge.relation_id] * max(.001, edge.extraction_confidence) ** 2 for _, edge in options])[0]
                edges.append(edge); visited.add(current); route.append(current)
                if current == target: break
            if current != target: continue
            successes += 1
            strength = min(edge.extraction_confidence for edge in edges)
            reward = strength / (1 + .05 * len(edges))
            best = max(best, reward)
            identity = tuple(edge.relation_id for edge in edges)
            paths[identity] = {"labels": [names[key] for key in route], "entity_ids": route,
                               "relation_ids": list(identity), "score": strength, "objective": reward,
                               "source_chunks": sorted({cid for edge in edges for cid in edge.source_chunks or [edge.source_chunk]}),
                               "traversal": "directed ACO" if directed else "undirected ACO; typed edge directions retained"}
            for edge in edges: deposits[edge.relation_id] += reward
        pheromone = {key: max(.0001, value * .75 + deposits[key]) for key, value in pheromone.items()}
        trace.append({"iteration": iteration + 1, "best_objective": best, "successful_ants": successes, "ants": ants})
    ranked = sorted(paths.values(), key=lambda path: (-path["objective"], path["relation_ids"]))[:20]
    for path in ranked: path["pheromone"] = min(pheromone[key] for key in path["relation_ids"])
    return {"paths": ranked, "trace": trace, "evaluations": ants * iterations, "seed": seed,
            "pheromones": pheromone, "settings": {"ants": ants, "iterations": iterations, "max_hops": max_hops, "evaporation": .25, "alpha": 1, "beta": 2, "directed": directed},
            "limitations": "Stochastic bounded search is not guaranteed to find the shortest path. Paths only cite stored relation evidence."}
