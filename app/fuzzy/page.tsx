'use client';

import { useEffect, useState } from 'react';
import { Binary, Braces, Gauge } from 'lucide-react';
import type { FuzzyEvaluationResult } from '@/lib/types';
import {
  fuzzyComplement,
  fuzzyIntersection,
  fuzzyUnion,
} from '@/lib/algorithms/fuzzy';
import { serviceMode, services } from '@/services';
import { MembershipChart } from '@/components/charts/membership-chart';
import { ScoreBars } from '@/components/charts/score-bars';
import { EducationPanel } from '@/components/common/education-panel';
import { PageHeader } from '@/components/common/page-header';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';

export default function FuzzyPage() {
  const [confidence, setConfidence] = useState(0.73);
  const [mfType, setMfType] = useState<
    'triangular' | 'trapezoidal' | 'gaussian'
  >('triangular');
  const [center, setCenter] = useState(0.55);
  const [width, setWidth] = useState(0.32);
  const [semantic, setSemantic] = useState(0.91);
  const [relation, setRelation] = useState(0.83);
  const [distance, setDistance] = useState(1.6);
  const [inference, setInference] = useState<'mamdani' | 'sugeno'>('mamdani');
  const [defuzzification, setDefuzzification] = useState<
    'centroid' | 'bisector' | 'mean-of-maxima'
  >('centroid');
  const [result, setResult] = useState<FuzzyEvaluationResult | null>(null);
  const [evaluationError, setEvaluationError] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const rule =
    'IF semantic_similarity IS High\nAND relation_strength IS Strong\nAND graph_distance IS Near\nTHEN retrieval_relevance IS VeryHigh';

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    void Promise.resolve()
      .then(() => {
        if (current) {
          setIsEvaluating(true);
          setEvaluationError('');
        }
        return services.fuzzy.evaluate({
        semanticSimilarity: semantic,
        relationStrength: relation,
        graphDistance: distance,
        inferenceMethod: inference,
        defuzzificationMethod: defuzzification,
        signal: controller.signal,
        });
      })
      .then((next) => {
        if (current) setResult(next);
      })
      .catch((error: unknown) => {
        if (current && !(error instanceof DOMException && error.name === 'AbortError')) {
          setEvaluationError(error instanceof Error ? error.message : 'Fuzzy evaluation failed.');
        }
      })
      .finally(() => {
        if (current) setIsEvaluating(false);
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [semantic, relation, distance, inference, defuzzification]);

  const hardDecision = confidence >= 0.8 ? 'ACCEPT' : 'REJECT';
  const fuzzyLabel =
    confidence >= 0.8
      ? 'Very High'
      : confidence >= 0.65
        ? 'High'
        : confidence >= 0.45
          ? 'Medium'
          : 'Low';

  return (
    <>
      <PageHeader
        eyebrow="Unit II · Approximate reasoning"
        title="Fuzzy logic laboratory"
        description="Shape local membership visualizations, compare crisp and fuzzy decisions, inspect the fixed teaching rule-set, and follow Mamdani or Sugeno inference to a transparent relevance score."
        icon={Binary}
      />

      <section className="grid gap-5 xl:grid-cols-2">
        <Card className="border-slate-200 p-6 shadow-none">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Crisp sets vs fuzzy sets
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Relation acceptance at confidence {confidence.toFixed(2)}
              </p>
            </div>
            <Gauge className="size-5 text-primary" />
          </div>
          <div className="mt-5">
            <div className="mb-3 flex justify-between text-xs">
              <span>Evidence confidence</span>
              <span className="font-mono">{confidence.toFixed(2)}</span>
            </div>
            <Slider
              value={[confidence]}
              min={0}
              max={1}
              step={0.01}
              onValueChange={(value) =>
                setConfidence(Array.isArray(value) ? value[0] : value)
              }
            />
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Hard mode · threshold 0.80
              </p>
              <p
                className={
                  hardDecision === 'ACCEPT'
                    ? 'mt-4 font-mono text-3xl font-semibold text-emerald-600'
                    : 'mt-4 font-mono text-3xl font-semibold text-red-600'
                }
              >
                {hardDecision}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                A one-bit decision discards how close the evidence was.
              </p>
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Soft mode · membership
              </p>
              <p className="mt-4 text-3xl font-semibold text-primary">
                {fuzzyLabel}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                μ(Relation, Reliable) = {confidence.toFixed(2)}
              </p>
            </div>
          </div>
          <div className="mt-5 rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-semibold">
              Fuzzy set operations for two evidence sources
            </p>
            <div className="mt-3 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="font-mono text-xl">
                  {fuzzyUnion(confidence, 0.64).toFixed(2)}
                </p>
                <p className="text-[10px] text-muted-foreground">Union · max</p>
              </div>
              <div>
                <p className="font-mono text-xl">
                  {fuzzyIntersection(confidence, 0.64).toFixed(2)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Intersection · min
                </p>
              </div>
              <div>
                <p className="font-mono text-xl">
                  {fuzzyComplement(confidence).toFixed(2)}
                </p>
                <p className="text-[10px] text-muted-foreground">Complement</p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="border-slate-200 p-6 shadow-none">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Membership-function editor
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Local visualization only; API mode uses a fixed, versioned teaching set.
              </p>
            </div>
            <NativeSelect
              value={mfType}
              onChange={(event) =>
                setMfType(event.target.value as typeof mfType)
              }
            >
              <NativeSelectOption value="triangular">
                Triangular
              </NativeSelectOption>
              <NativeSelectOption value="trapezoidal">
                Trapezoidal
              </NativeSelectOption>
              <NativeSelectOption value="gaussian">Gaussian</NativeSelectOption>
            </NativeSelect>
          </div>
          <MembershipChart type={mfType} center={center} width={width} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="mb-2 flex justify-between text-xs">
                <span>Centre</span>
                <span className="font-mono">{center.toFixed(2)}</span>
              </div>
              <Slider
                value={[center]}
                min={0.25}
                max={0.75}
                step={0.01}
                onValueChange={(value) =>
                  setCenter(Array.isArray(value) ? value[0] : value)
                }
              />
            </div>
            <div>
              <div className="mb-2 flex justify-between text-xs">
                <span>Width</span>
                <span className="font-mono">{width.toFixed(2)}</span>
              </div>
              <Slider
                value={[width]}
                min={0.12}
                max={0.48}
                step={0.01}
                onValueChange={(value) =>
                  setWidth(Array.isArray(value) ? value[0] : value)
                }
              />
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[430px_1fr]">
        <Card className="border-slate-200 p-6 shadow-none">
          <div className="flex items-center gap-2">
            <Braces className="size-5 text-primary" />
            <h2 className="text-lg font-semibold">Reference fuzzy rule</h2>
          </div>
          <Textarea
            value={rule}
            readOnly
            className="mt-4 min-h-40 font-mono text-xs leading-6"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Demonstration text only. Custom rules are not submitted; API mode evaluates the fixed rule-set version.
          </p>
          <div className="mt-4 rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-semibold">Linguistic variables</p>
            <div className="mt-3 space-y-2 text-xs text-muted-foreground">
              <p>
                <span className="font-mono text-foreground">
                  EntityConfidence
                </span>{' '}
                = Low · Medium · High
              </p>
              <p>
                <span className="font-mono text-foreground">
                  RelationStrength
                </span>{' '}
                = Weak · Moderate · Strong
              </p>
              <p>
                <span className="font-mono text-foreground">
                  QueryRelevance
                </span>{' '}
                = Irrelevant · Possible · Relevant · HighlyRelevant
              </p>
            </div>
          </div>
        </Card>

        <Card className="border-slate-200 p-6 shadow-none">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Inference workbench</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Fuzzification → rule evaluation → aggregation → defuzzification
              </p>
            </div>
            <Badge variant="outline">{serviceMode === 'api' ? 'Reference backend' : 'Mock evaluator'}</Badge>
            <div className="flex gap-2">
              <NativeSelect
                value={inference}
                onChange={(event) =>
                  setInference(event.target.value as typeof inference)
                }
              >
                <NativeSelectOption value="mamdani">Mamdani</NativeSelectOption>
                <NativeSelectOption value="sugeno">Sugeno</NativeSelectOption>
              </NativeSelect>
              <NativeSelect
                value={defuzzification}
                disabled={inference === 'sugeno'}
                onChange={(event) =>
                  setDefuzzification(
                    event.target.value as typeof defuzzification,
                  )
                }
              >
                <NativeSelectOption value="centroid">
                  Centroid
                </NativeSelectOption>
                <NativeSelectOption value="bisector">
                  Bisector
                </NativeSelectOption>
                <NativeSelectOption value="mean-of-maxima">
                  Mean of maxima
                </NativeSelectOption>
              </NativeSelect>
            </div>
          </div>
          <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1.25fr]">
            <div className="space-y-5">
              {[
                ['Semantic similarity', semantic, setSemantic, 0, 1],
                ['Relation strength', relation, setRelation, 0, 1],
                ['Graph distance', distance, setDistance, 1, 5],
              ].map(([label, value, setter, minimum, maximum]) => (
                <div key={String(label)}>
                  <div className="mb-2 flex justify-between text-xs">
                    <span>{String(label)}</span>
                    <span className="font-mono">
                      {Number(value).toFixed(2)}
                    </span>
                  </div>
                  <Slider
                    value={[Number(value)]}
                    min={Number(minimum)}
                    max={Number(maximum)}
                    step={0.01}
                    onValueChange={(next) =>
                      (setter as (value: number) => void)(
                        Array.isArray(next) ? next[0] : next,
                      )
                    }
                  />
                </div>
              ))}
              {result && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                      {result.inferenceMethod === 'sugeno' ? 'Sugeno output' : 'Defuzzified output'}
                    </span>
                    <Badge>{result.label}</Badge>
                  </div>
                  <p className="mt-3 font-mono text-4xl font-semibold text-primary">
                    {result.score.toFixed(3)}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Controller decision: {result.controllerDecision}
                  </p>
                  {result.inferenceMethod === 'sugeno' && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Sugeno uses weighted singleton outputs; defuzzification is not applied.
                    </p>
                  )}
                </div>
              )}
              {isEvaluating && <p className="text-xs text-muted-foreground">Evaluating fuzzy rules…</p>}
              {evaluationError && (
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                  {evaluationError}
                </p>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Rule firing strength
              </p>
              <ScoreBars
                data={(result?.ruleFirings ?? []).map((item, index) => ({
                  name: 'Rule ' + (index + 1),
                  value: item.strength,
                }))}
              />
            </div>
          </div>
        </Card>
      </section>

      <EducationPanel
        title="Fuzzy inference"
        items={{
          'What is this?':
            'Degree-based reasoning with interpretable linguistic sets and rules.',
          'Why is it being used?':
            'Extraction and retrieval evidence are uncertain rather than simply true or false.',
          'How does it work?':
            'Fuzzify inputs, fire rules, aggregate outputs and defuzzify a final score.',
          'Where is it used in SoftGraph?':
            'Entity trust, edge strength, graph control and retrieval relevance.',
          Inputs:
            'Model confidence, source quality, semantic similarity and graph distance.',
          Outputs:
            'Memberships, firing strengths, relevance and controller action.',
          Parameters:
            'Membership centres, widths, shapes, rule weights and inference method.',
          Example:
            'High semantic + strong relation + near path → very high relevance.',
        }}
      />
    </>
  );
}
