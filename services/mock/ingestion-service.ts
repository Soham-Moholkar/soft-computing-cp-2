import type { IngestionService } from '../contracts.js';

export const mockIngestionService: IngestionService = {
  async process(input) {
    // TODO(PASS-2): Replace this deterministic stage response with POST /api/ingestion/upload from docs/API_CONTRACTS.md.
    return {
      document: {
        documentId: 'doc-demo-' + input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name: input.name,
        sourceType: input.sourceType,
        domain: input.domain,
        timestamp: '2026-09-02T10:30:00+05:30',
        metadata: { pass: 1, simulated: true },
        processingStatus: 'completed',
      },
      stageDurations: [
        { stage: 'Uploaded', durationMs: 45 },
        { stage: 'Parsing', durationMs: 118 },
        { stage: 'Chunking', durationMs: 84 },
        { stage: 'Extracting', durationMs: 212 },
        { stage: 'Resolving', durationMs: 166 },
        { stage: 'Building graph', durationMs: 138 },
        { stage: 'Completed', durationMs: 0 },
      ],
      extractedEntities: 14,
      extractedRelations: 23,
      warnings: [],
    };
  },
};
