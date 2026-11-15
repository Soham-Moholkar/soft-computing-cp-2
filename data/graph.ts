import type { Entity, EntityType, GraphData, Relation } from '../lib/types.js';

type EntitySeed = [string, string, EntityType, string, string[]];

const entitySeeds: EntitySeed[] = [
  ['e01', 'Artificial Intelligence', 'Concept', 'Systems that perceive, reason and act toward goals.', ['AI']],
  ['e02', 'Machine Learning', 'Concept', 'Data-driven models that improve task performance from examples.', ['ML']],
  ['e03', 'Soft Computing', 'Concept', 'Methods that tolerate uncertainty, imprecision and approximation.', ['computational intelligence']],
  ['e04', 'Knowledge Graph', 'Technology', 'A typed graph of entities, relations and supporting evidence.', ['KG']],
  ['e05', 'Fuzzy Logic', 'Concept', 'Degree-based reasoning over linguistic variables and rules.', ['fuzzy systems']],
  ['e06', 'Genetic Algorithm', 'Technology', 'Population-based evolutionary optimization using selection and variation.', ['GA']],
  ['e07', 'Particle Swarm Optimization', 'Technology', 'Swarm optimizer guided by personal and global best positions.', ['PSO']],
  ['e08', 'Ant Colony Optimization', 'Technology', 'Pheromone-guided search inspired by ant foraging.', ['ACO']],
  ['e09', 'Grey Wolf Optimizer', 'Technology', 'Leadership-hierarchy search using alpha, beta, delta and omega wolves.', ['GWO']],
  ['e10', 'Whale Optimization Algorithm', 'Technology', 'Metaheuristic based on encircling, search and spiral exploitation.', ['WOA']],
  ['e11', 'Neural Network', 'Technology', 'Layered adaptive function approximator.', ['ANN']],
  ['e12', 'Neuro-Fuzzy System', 'Technology', 'A trainable fuzzy inference architecture.', ['ANFIS']],
  ['e13', 'Entity Extraction', 'Process', 'Identifies candidate entities in source chunks.', ['NER']],
  ['e14', 'Relation Extraction', 'Process', 'Identifies typed links and their textual evidence.', ['RE']],
  ['e15', 'Entity Resolution', 'Process', 'Merges aliases while preserving ambiguity.', ['record linkage']],
  ['e16', 'Semantic Search', 'Process', 'Retrieves evidence using meaning similarity.', ['vector search']],
  ['e17', 'Graph Traversal', 'Process', 'Explores neighborhoods and multi-hop paths.', ['graph search']],
  ['e18', 'Approximate Reasoning', 'Concept', 'Infers useful conclusions when evidence is partial.', ['soft inference']],
  ['e19', 'Mamdani Inference', 'Technology', 'Rule inference with fuzzy output aggregation.', ['Mamdani']],
  ['e20', 'Sugeno Inference', 'Technology', 'Rule inference with functional or constant consequents.', ['TSK']],
  ['e21', 'Membership Function', 'Concept', 'Maps a crisp input to a degree of set membership.', ['MF']],
  ['e22', 'Triangular Membership', 'Concept', 'Piecewise-linear membership with three parameters.', ['triangular MF']],
  ['e23', 'Gaussian Membership', 'Concept', 'Smooth bell-shaped membership using centre and width.', ['Gaussian MF']],
  ['e24', 'Centroid Defuzzification', 'Process', 'Returns the centre of area of an aggregated fuzzy output.', ['centre of area']],
  ['e25', 'Optimization', 'Concept', 'Search for configurations that improve an objective.', ['parameter tuning']],
  ['e26', 'Multi-objective Optimization', 'Concept', 'Balances several competing objectives without one forced optimum.', ['MOO']],
  ['e27', 'Pareto Front', 'Concept', 'Non-dominated trade-off solutions in objective space.', ['Pareto set']],
  ['e28', 'Swarm Intelligence', 'Concept', 'Global search behavior emerging from cooperating agents.', ['SI']],
  ['e29', 'Evolutionary Computing', 'Concept', 'Optimization inspired by variation and selection.', ['EC']],
  ['e30', 'Hybrid Intelligence', 'Concept', 'Combines complementary learning and optimization techniques.', ['hybrid soft computing']],
  ['e31', 'Explainable AI', 'Concept', 'Makes model evidence and reasoning understandable.', ['XAI']],
  ['e32', 'Healthcare Knowledge Graph', 'Domain', 'Clinical concepts, evidence and treatment relationships.', ['medical KG']],
  ['e33', 'Agriculture Knowledge Graph', 'Domain', 'Crops, diseases, conditions and recommendations.', ['agri KG']],
  ['e34', 'Finance Knowledge Graph', 'Domain', 'Companies, sectors, events and market relationships.', ['financial KG']],
  ['e35', 'Engineering Knowledge Graph', 'Domain', 'Components, failures, processes and maintenance evidence.', ['engineering KG']],
  ['e36', 'Neo4j', 'Technology', 'Property-graph database proposed for production storage.', ['graph database']],
  ['e37', 'NetworkX', 'Technology', 'Python graph algorithms library proposed for analytics.', ['NX']],
  ['e38', 'FastAPI', 'Technology', 'Typed Python web framework proposed for API delivery.', ['API framework']],
  ['e39', 'Vector Database', 'Technology', 'Embedding index abstraction for semantic retrieval.', ['vector store']],
  ['e40', 'Semantic Embedding', 'Technology', 'Dense representation used to compare meaning.', ['embedding']],
  ['e41', 'ACO Pheromone', 'Concept', 'A decaying memory of historically useful graph paths.', ['pheromone trail']],
  ['e42', 'Retrieval Relevance', 'Concept', 'Final uncertainty-aware score used to rank evidence.', ['relevance']],
];

export const entities: Entity[] = entitySeeds.map(([entityId, canonicalName, entityType, description, aliases], index) => {
  const ring = Math.floor(index / 10);
  const angle = (index % 10) * (Math.PI * 2 / 10) + ring * 0.33;
  const radius = 92 + ring * 74;
  return {
    entityId,
    canonicalName,
    entityType,
    aliases,
    description,
    sourceChunks: ['chunk-' + String((index % 8) + 1).padStart(2, '0')],
    extractionConfidence: 0.68 + ((index * 7) % 29) / 100,
    fuzzyConfidence: 0.61 + ((index * 11) % 36) / 100,
    centralityScore: index < 12 ? 0.72 + ((index * 3) % 20) / 100 : 0.34 + ((index * 5) % 48) / 100,
    importanceScore: 0.48 + ((index * 13) % 45) / 100,
    embeddingReference: 'emb-softgraph-' + entityId,
    x: 450 + Math.cos(angle) * radius,
    y: 320 + Math.sin(angle) * radius * 0.78,
  };
});

type RelationSeed = [string, string, string];

const relationSeeds: RelationSeed[] = [
  ['e01', 'e02', 'includes'], ['e01', 'e03', 'includes'], ['e01', 'e31', 'requires'],
  ['e01', 'e32', 'applied_to'], ['e01', 'e33', 'applied_to'], ['e01', 'e34', 'applied_to'], ['e01', 'e35', 'applied_to'],
  ['e02', 'e11', 'includes'], ['e02', 'e25', 'optimized_by'], ['e02', 'e40', 'uses'],
  ['e02', 'e13', 'supports'], ['e02', 'e14', 'supports'], ['e02', 'e05', 'complements'], ['e02', 'e07', 'tuned_by'],
  ['e03', 'e05', 'includes'], ['e03', 'e29', 'includes'], ['e03', 'e28', 'includes'], ['e03', 'e30', 'culminates_in'], ['e03', 'e18', 'enables'],
  ['e04', 'e13', 'built_from'], ['e04', 'e14', 'built_from'], ['e04', 'e15', 'requires'], ['e04', 'e16', 'retrieved_by'],
  ['e04', 'e17', 'explored_by'], ['e04', 'e36', 'stored_in'], ['e04', 'e37', 'modeled_with'], ['e04', 'e39', 'paired_with'],
  ['e04', 'e42', 'evaluated_by'], ['e04', 'e31', 'explained_by'], ['e04', 'e32', 'powers'], ['e04', 'e33', 'powers'],
  ['e04', 'e34', 'powers'], ['e04', 'e35', 'powers'],
  ['e05', 'e21', 'defines'], ['e05', 'e18', 'enables'], ['e05', 'e19', 'implements'], ['e05', 'e20', 'implements'],
  ['e05', 'e06', 'optimized_by'], ['e05', 'e42', 'scores'],
  ['e21', 'e22', 'has_shape'], ['e21', 'e23', 'has_shape'], ['e21', 'e24', 'defuzzified_by'],
  ['e19', 'e24', 'uses'], ['e19', 'e42', 'outputs'], ['e20', 'e42', 'outputs'],
  ['e06', 'e25', 'solves'], ['e06', 'e26', 'supports'], ['e06', 'e27', 'approximates'], ['e06', 'e05', 'tunes'], ['e06', 'e30', 'combines_in'],
  ['e07', 'e28', 'member_of'], ['e07', 'e25', 'solves'], ['e07', 'e42', 'tunes'], ['e07', 'e15', 'tunes'],
  ['e08', 'e28', 'member_of'], ['e08', 'e17', 'traverses'], ['e08', 'e41', 'deposits'], ['e08', 'e42', 'maximizes'],
  ['e09', 'e28', 'member_of'], ['e09', 'e25', 'solves'], ['e09', 'e17', 'selects_subgraph'],
  ['e10', 'e28', 'member_of'], ['e10', 'e25', 'solves'], ['e10', 'e04', 'prunes'],
  ['e11', 'e12', 'contributes_to'], ['e11', 'e40', 'produces'],
  ['e12', 'e30', 'subtype_of'], ['e12', 'e42', 'learns'],
  ['e30', 'e06', 'combines'], ['e30', 'e07', 'combines'], ['e30', 'e42', 'produces'], ['e30', 'e31', 'supports'],
  ['e13', 'e14', 'precedes'], ['e13', 'e15', 'feeds'],
  ['e16', 'e39', 'queries'], ['e16', 'e40', 'compares'], ['e16', 'e42', 'contributes'],
  ['e38', 'e04', 'exposes_api_for'],
];

export const relations: Relation[] = relationSeeds.map(([sourceEntity, targetEntity, relationType], index) => ({
  relationId: 'r' + String(index + 1).padStart(3, '0'),
  sourceEntity,
  targetEntity,
  relationType,
  evidence: 'Demonstration evidence connects ' + sourceEntity + ' to ' + targetEntity + ' through ' + relationType.replaceAll('_', ' ') + '.',
  sourceChunk: 'chunk-' + String((index % 8) + 1).padStart(2, '0'),
  extractionConfidence: 0.6 + ((index * 9) % 38) / 100,
  fuzzyStrength: 0.54 + ((index * 13) % 44) / 100,
  semanticStrength: 0.58 + ((index * 7) % 40) / 100,
  temporalStrength: 0.72 + ((index * 5) % 26) / 100,
  finalWeight: 0.57 + ((index * 11) % 41) / 100,
}));

export const graphData: GraphData = { entities, relations };
