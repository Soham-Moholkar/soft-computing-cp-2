import type { HybridService } from '../contracts.js';
import { mockRetrievalService } from './retrieval-service.js';

export const mockHybridService: HybridService = {
  async retrieve(request) {
    // TODO(PASS-2): Replace with POST /api/hybrid/retrieve defined in docs/API_CONTRACTS.md.
    return mockRetrievalService.retrieve({ ...request, mode: 'hybrid' });
  },
  async submitFeedback(feedback) {
    // TODO(PASS-2): Persist feedback through the adaptive endpoint specified in docs/API_CONTRACTS.md.
    return {
      accepted: true,
      message: 'Feedback "' + feedback + '" recorded for the Pass-2 adaptive-learning queue.',
    };
  },
};
