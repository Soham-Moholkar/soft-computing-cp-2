import { graphData } from '../../data/graph.js';
import type { GraphService } from '../contracts.js';

export const mockGraphService: GraphService = {
  async getGraph() {
    // TODO(PASS-2): Replace with GET /api/graph defined in docs/API_CONTRACTS.md.
    return graphData;
  },
  async shortestPath(sourceId, targetId) {
    const queue: Array<{ id: string; path: string[] }> = [{ id: sourceId, path: [sourceId] }];
    const visited = new Set<string>([sourceId]);
    while (queue.length) {
      const current = queue.shift();
      if (!current) break;
      if (current.id === targetId) return current.path;
      const neighbors = graphData.relations
        .filter((relation) => relation.sourceEntity === current.id || relation.targetEntity === current.id)
        .map((relation) => relation.sourceEntity === current.id ? relation.targetEntity : relation.sourceEntity);
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push({ id: neighbor, path: current.path.concat(neighbor) });
        }
      }
    }
    return [];
  },
};
