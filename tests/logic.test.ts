import test from 'node:test';
import assert from 'node:assert/strict';
import {
  centroidDefuzzification,
  evaluateRetrievalFuzzy,
  fuzzyComplement,
  fuzzyIntersection,
  fuzzyUnion,
  gaussianMembership,
  trapezoidalMembership,
  triangularMembership,
} from '../lib/algorithms/fuzzy.js';
import {
  crossover,
  mutateChromosome,
  normalizeWeights,
  simulateGeneticAlgorithm,
  validateOptimizerConfig,
} from '../lib/algorithms/genetic.js';
import {
  calculateHybridScore,
  filterSyllabus,
} from '../lib/algorithms/retrieval.js';
import { syllabusEntries } from '../data/syllabus.js';

test('membership functions preserve expected peaks and bounds', () => {
  assert.equal(triangularMembership(0.5, 0, 0.5, 1), 1);
  assert.equal(triangularMembership(-1, 0, 0.5, 1), 0);
  assert.equal(trapezoidalMembership(0.5, 0, 0.3, 0.7, 1), 1);
  assert.ok(Math.abs(gaussianMembership(0.5, 0.5, 0.2) - 1) < 1e-10);
});

test('fuzzy set operations use max, min and complement', () => {
  assert.equal(fuzzyUnion(0.3, 0.8), 0.8);
  assert.equal(fuzzyIntersection(0.3, 0.8), 0.3);
  assert.ok(Math.abs(fuzzyComplement(0.3) - 0.7) < 1e-10);
});

test('centroid defuzzification returns a weighted centre', () => {
  assert.equal(
    centroidDefuzzification([
      { x: 0, membership: 1 },
      { x: 1, membership: 1 },
    ]),
    0.5,
  );
  assert.equal(centroidDefuzzification([{ x: 0, membership: 0 }]), 0);
});

test('fuzzy retrieval produces an explainable high score', () => {
  const result = evaluateRetrievalFuzzy({
    semanticSimilarity: 0.92,
    relationStrength: 0.88,
    graphDistance: 1,
    inferenceMethod: 'mamdani',
    defuzzificationMethod: 'centroid',
  });
  assert.ok(result.score > 0.7);
  assert.equal(result.ruleFirings.length, 3);
  assert.equal(result.ruleFirings[0].ruleId, 'mock-r1');
  assert.ok(result.aggregatedOutput.length === 101);
  assert.equal(result.inferenceMethod, 'mamdani');
  assert.equal(result.defuzzificationApplied, true);
  assert.ok(result.memberships.semanticHigh > 0.8);
});

test('genetic operations are deterministic and constraint-safe', () => {
  const [childA, childB] = crossover([0.1, 0.2, 0.3], [0.8, 0.7, 0.6], 1);
  assert.deepEqual(childA, [0.1, 0.7, 0.6]);
  assert.deepEqual(childB, [0.8, 0.2, 0.3]);
  const mutated = mutateChromosome(childA, 1, 22);
  assert.ok(mutated.every((gene) => gene >= 0 && gene <= 1));
  const rerunSample = Array.from({ length: 8 }, () => 0.5);
  assert.notDeepEqual(
    mutateChromosome(rerunSample, 0.08, 17),
    mutateChromosome(rerunSample, 0.08, 20),
  );
  const weights = normalizeWeights([0.2, 0.3, 0.5]);
  assert.ok(
    Math.abs(weights.reduce((sum, value) => sum + value, 0) - 1) < 1e-10,
  );
});

test('optimizer validation and simulation cover invalid and valid configurations', () => {
  assert.equal(
    validateOptimizerConfig({
      populationSize: 2,
      iterations: 0,
      mutationRate: 2,
      crossoverRate: -1,
      selection: 'roulette',
      encoding: 'real',
    }).length,
    4,
  );
  const config = {
    populationSize: 20,
    iterations: 12,
    mutationRate: 0.08,
    crossoverRate: 0.8,
    selection: 'tournament' as const,
    encoding: 'real' as const,
  };
  const first = simulateGeneticAlgorithm(config);
  const second = simulateGeneticAlgorithm(config);
  assert.deepEqual(first, second);
  assert.equal(first.convergence.length, 12);
});

test('hybrid retrieval score normalizes arbitrary weights', () => {
  const result = calculateHybridScore(
    {
      semantic: 1,
      graph: 0.8,
      fuzzy: 0.9,
      centrality: 0.6,
      source: 0.9,
      temporal: 0.5,
      path: 0.7,
    },
    {
      semantic: 2,
      graph: 1,
      fuzzy: 1,
      centrality: 1,
      source: 1,
      temporal: 1,
      path: 1,
    },
  );
  assert.ok(result.score >= 0 && result.score <= 1);
  assert.ok(
    Math.abs(result.breakdown.reduce((sum, item) => sum + item.weight, 0) - 1) <
      1e-10,
  );
});

test('syllabus filtering supports category and query matching', () => {
  const fuzzy = filterSyllabus(syllabusEntries, 'fuzzy logic', 'Mamdani');
  assert.deepEqual(fuzzy.map((entry) => entry.concept).sort(), [
    'Approximate Reasoning',
    'Mamdani Inference',
  ]);
  assert.ok(fuzzy.every((entry) => entry.category === 'Fuzzy Logic'));
});
