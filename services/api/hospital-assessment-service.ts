import { workspaceClient } from './workspace-service.js';

export interface AssessmentField {
  name: string;
  label: string;
  kind: 'number' | 'category';
  unit: string;
  minimum?: number;
  maximum?: number;
  choices?: { value: number; label: string }[];
}

export interface AssessmentMetrics {
  n: number;
  positives: number;
  negatives: number;
  true_positive: number;
  true_negative: number;
  false_positive: number;
  false_negative: number;
  accuracy: number;
  accuracy_wilson_95: [number, number];
  sensitivity: number | null;
  specificity: number | null;
  balanced_accuracy: number | null;
  auroc: number | null;
  brier: number;
  log_loss: number;
}

export interface EducationalModel {
  model_id: string;
  version: string;
  title: string;
  status: 'educational_only' | 'rejected';
  rejection_reason: string | null;
  target: string;
  horizon_days: number | null;
  source: {
    name: string;
    url: string;
    sha256: string;
    attribution: string;
    license: string;
    license_url: string;
  };
  schema: AssessmentField[];
  algorithm: string;
  notice: string;
  synthetic_example: Record<string, number>;
  synthetic_example_label: string;
  metrics: AssessmentMetrics;
  baseline_metrics: AssessmentMetrics;
  limitations: string[];
  cohort: {
    source_rows: number;
    eligible_rows: number;
    excluded_censored_before_90_days: number;
  };
  training: {
    seed: number;
    split_protocol: string;
    split_rows: { train: number; validation: number; test: number };
    preprocessing_protocol: string;
    fit_protocol: string;
    validation_brier: number;
    score_definition: string;
    reproduce: string;
    baseline: string;
    ga: {
      population: number;
      generations: number;
      unique_candidates: number;
      objective: string;
      history: { generation: number; best_validation_brier: number }[];
    };
  };
  rules: { rule: number; consequent: number }[];
}

export interface AssessmentResult {
  model_id: string;
  version: string;
  pattern_score: number;
  score_label: string;
  dataset_class: 0 | 1;
  class_label: string;
  threshold: number;
  target: string;
  horizon_days: number | null;
  inputs: { name: string; value: number; unit: string }[];
  rules: {
    rule: number;
    membership: number;
    consequent: number;
    contribution: number;
  }[];
  notice: string;
  stored: false;
  external_calls: false;
}

export const news2Units = {
  age: 'years',
  respiration_rate: 'breaths/min',
  spo2: '%',
  supplemental_oxygen: 'category',
  systolic_bp: 'mm Hg',
  pulse: 'beats/min',
  consciousness: 'category',
  temperature: 'degrees C',
} as const;

export interface News2Result {
  version: string;
  title: string;
  total: number;
  maximum: number;
  single_parameter_three: boolean;
  components: {
    parameter: string;
    value: string | number;
    unit: string;
    score: number;
  }[];
  inputs: Record<string, string | number>;
  units: Record<string, string>;
  source_url: string;
  report_url: string;
  attribution: string;
  notice: string;
}

const client = workspaceClient('healthcare');
export const hospitalAssessmentService = {
  models: (signal?: AbortSignal) =>
    client.get<{ models: EducationalModel[]; notice: string }>(
      '/hospital/assessment/models',
      signal,
    ),
  evaluate: (
    payload: {
      model_id: string;
      values: Record<string, number>;
      units: Record<string, string>;
      heart_failure_confirmed: boolean;
    },
    signal?: AbortSignal,
  ) =>
    client.post<AssessmentResult>(
      '/hospital/assessment/evaluate',
      payload,
      signal,
    ),
  news2: (
    payload: {
      values: Record<string, string | number>;
      units: Record<string, string>;
      not_pregnant_confirmed: boolean;
      scale_1_confirmed: boolean;
    },
    signal?: AbortSignal,
  ) => client.post<News2Result>('/hospital/assessment/news2', payload, signal),
};
