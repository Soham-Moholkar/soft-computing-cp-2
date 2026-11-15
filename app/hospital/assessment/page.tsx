'use client';

import { useEffect, useRef, useState } from 'react';
import { Activity, ArrowLeft, FlaskConical, LoaderCircle } from 'lucide-react';
import Link from '@/components/common/app-link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  hospitalAssessmentService,
  news2Units,
  type AssessmentResult,
  type EducationalModel,
  type News2Result,
} from '@/services/api/hospital-assessment-service';

const fieldClass =
  'mt-2 w-full rounded-lg border bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-50';
const buttonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50';
const secondaryClass =
  'rounded-lg border bg-white px-4 py-2.5 text-sm font-medium disabled:opacity-50';
const number = (value: number | null) =>
  value === null ? 'Unavailable' : value.toFixed(3);

export default function AssessmentPage() {
  const [models, setModels] = useState<EducationalModel[]>([]);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [mode, setMode] = useState('cleveland-presence-v1');
  useEffect(() => {
    const controller = new AbortController();
    void hospitalAssessmentService
      .models(controller.signal)
      .then((catalog) => {
        if (!controller.signal.aborted) {
          setModels(catalog.models);
          setError('');
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : 'Could not load educational models.',
          );
      });
    return () => controller.abort();
  }, [attempt]);
  const model = models.find((item) => item.model_id === mode);
  return (
    <div className="space-y-6">
      <Link
        href="/hospital"
        className="inline-flex items-center gap-2 text-xs font-medium text-teal-700"
      >
        <ArrowLeft className="size-3.5" />
        Hospital records
      </Link>
      <section className="rounded-2xl border bg-white p-6 md:p-8">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.14em] text-teal-700">
          <FlaskConical className="size-4" />
          Educational assessment
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Inspect the method before the score.
        </h1>
        <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-600">
          Explore a trained fuzzy classifier, inspect a rejected outcome model,
          or calculate the separate NEWS2 early-warning score. Enter
          measurements explicitly. This page does not read patient records,
          generate care plans or make automatic assessments.
        </p>
        <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          Educational tools only. Local input stays within this application and
          is not saved or sent to external providers. These tools do not
          establish a diagnosis, a patient’s survival probability or treatment.
          A qualified professional must interpret clinical information.
        </p>
      </section>
      <Tabs
        value={mode}
        onValueChange={(value) => setMode(String(value))}
        className="gap-6"
      >
        <TabsList
          aria-label="Assessment methods"
          className="h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-0 group-data-horizontal/tabs:h-auto"
        >
          <TabsTrigger
            value="cleveland-presence-v1"
            className="h-11 flex-none rounded-lg border bg-white px-4"
          >
            Fuzzy classification
          </TabsTrigger>
          <TabsTrigger
            value="heart-failure-90d-v1"
            className="h-11 flex-none rounded-lg border bg-white px-4"
          >
            90-day candidate · rejected
          </TabsTrigger>
          <TabsTrigger
            value="news2"
            className="h-11 flex-none rounded-lg border bg-white px-4"
          >
            NEWS2 early warning
          </TabsTrigger>
        </TabsList>
        <TabsContent key={mode} value={mode} className="space-y-6">
          {mode === 'news2' ? (
            <News2Calculator />
          ) : error ? (
            <section className="space-y-4 rounded-xl border bg-white p-6">
              <p role="alert" className="text-sm text-red-800">
                {error}
              </p>
              <button
                className={secondaryClass}
                onClick={() => setAttempt((value) => value + 1)}
              >
                Retry model catalog
              </button>
            </section>
          ) : model ? (
            <>
              <section className="space-y-3 rounded-2xl border bg-white p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold">{model.title}</h2>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${model.status === 'rejected' ? 'bg-red-100 text-red-900' : 'bg-amber-100 text-amber-900'}`}
                  >
                    {model.status === 'rejected'
                      ? 'REJECTED · analysis only'
                      : 'Educational only · unvalidated'}
                  </span>
                </div>
                <p className="text-sm leading-7 text-slate-600">
                  Target: {model.target}
                </p>
                <p className="break-all text-xs text-slate-500">
                  Version: {model.version}
                  {model.horizon_days
                    ? ` · Horizon: ${model.horizon_days} days`
                    : ' · Current dataset status, no future horizon'}
                </p>
                {model.rejection_reason ? (
                  <p
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium leading-7 text-red-900"
                  >
                    {model.rejection_reason} No score or class is available for
                    patient-facing evaluation.
                  </p>
                ) : null}
              </section>
              <div className="grid items-start gap-6 xl:grid-cols-[1.15fr_1fr]">
                {model.status === 'rejected' ? (
                  <section className="space-y-4 rounded-2xl border bg-white p-6">
                    <h2 className="text-lg font-semibold">
                      Inference disabled
                    </h2>
                    <p className="text-sm leading-7 text-slate-600">
                      The candidate was trained for people with
                      already-confirmed heart failure. Its fixed threshold
                      missed all {model.metrics.positives} positive outcomes in
                      the held-out set. Its negative class would offer no
                      reliable reassurance. The failed result is retained for
                      inspection; the public API refuses evaluation.
                    </p>
                    <p className="text-sm leading-7 text-slate-600">
                      NEWS2 is available in its own tab for a different,
                      immediate early-warning task. It does not replace a 90-day
                      prognosis model.
                    </p>
                    <details className="rounded-xl border p-4">
                      <summary className="cursor-pointer text-sm font-medium">
                        Candidate input schema ({model.schema.length} required
                        inputs)
                      </summary>
                      <ul className="mt-3 space-y-2 text-xs leading-6 text-slate-600">
                        {model.schema.map((field) => (
                          <li key={field.name}>
                            {field.label} · {field.unit} ·{' '}
                            {field.kind === 'number'
                              ? `${field.minimum}–${field.maximum}`
                              : field.choices
                                  ?.map(
                                    (choice) =>
                                      `${choice.value}: ${choice.label}`,
                                  )
                                  .join('; ')}
                          </li>
                        ))}
                      </ul>
                    </details>
                  </section>
                ) : (
                  <ClassifierForm key={model.model_id} model={model} />
                )}
                <MetricsCard model={model} />
              </div>
              <ModelDocumentation model={model} />
            </>
          ) : (
            <output className="flex min-h-48 items-center justify-center gap-3 text-sm text-slate-500">
              <LoaderCircle className="size-5 animate-spin" />
              Loading model provenance and metrics…
            </output>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ClassifierForm({ model }: { model: EducationalModel }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const measurements: Record<string, number> = {};
      for (const field of model.schema) {
        if (!values[field.name]?.trim())
          throw new Error(
            `Provide ${field.label}. Missing measurements are refused.`,
          );
        measurements[field.name] = Number(values[field.name]);
      }
      const output = await hospitalAssessmentService.evaluate(
        {
          model_id: model.model_id,
          values: measurements,
          units: Object.fromEntries(
            model.schema.map((field) => [field.name, field.unit]),
          ),
          heart_failure_confirmed: false,
        },
        controller.signal,
      );
      if (!controller.signal.aborted) setResult(output);
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(cause instanceof Error ? cause.message : 'Assessment failed.');
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <section className="space-y-5 rounded-2xl border bg-white p-6">
      <div>
        <h2 className="text-lg font-semibold">Complete every model input</h2>
        <p className="mt-2 text-xs leading-6 text-slate-500">
          Use the displayed source units and categories. Missing values,
          unsupported values and unit changes are refused. Values within these
          bounds are not necessarily clinically applicable.
        </p>
      </div>
      <button
        type="button"
        className={secondaryClass}
        disabled={busy}
        onClick={() => {
          setValues(
            Object.fromEntries(
              Object.entries(model.synthetic_example).map(([name, value]) => [
                name,
                String(value),
              ]),
            ),
          );
          setResult(null);
          setError('');
        }}
      >
        Fill synthetic demonstration
      </button>
      <p className="text-xs leading-6 text-slate-500">
        {model.synthetic_example_label}
      </p>
      <form
        onSubmit={(event) => void submit(event)}
        aria-busy={busy}
        className="space-y-5"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          {model.schema.map((field) => (
            <label key={field.name} className="block text-xs font-medium">
              {field.label}
              <span className="mt-1 block font-normal text-slate-500">
                {field.unit}
                {field.kind === 'number'
                  ? ` · ${field.minimum}–${field.maximum}`
                  : ''}
              </span>
              {field.kind === 'category' ? (
                <select
                  required
                  disabled={busy}
                  className={fieldClass}
                  value={values[field.name] ?? ''}
                  onChange={(event) => {
                    setValues((previous) => ({
                      ...previous,
                      [field.name]: event.target.value,
                    }));
                    setResult(null);
                  }}
                >
                  <option value="">Select recorded category</option>
                  {field.choices?.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label} ({choice.value})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  required
                  disabled={busy}
                  type="number"
                  step="any"
                  min={field.minimum}
                  max={field.maximum}
                  className={fieldClass}
                  value={values[field.name] ?? ''}
                  onChange={(event) => {
                    setValues((previous) => ({
                      ...previous,
                      [field.name]: event.target.value,
                    }));
                    setResult(null);
                  }}
                />
              )}
            </label>
          ))}
        </div>
        {error ? (
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
          >
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={busy} className={buttonClass}>
          {busy ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <FlaskConical className="size-4" />
          )}
          Calculate educational pattern score
        </button>
      </form>
      {result ? (
        <section
          aria-live="polite"
          className="space-y-4 rounded-xl border border-violet-200 bg-violet-50 p-5"
        >
          <h3 className="text-sm font-semibold">{result.score_label}</h3>
          <p className="text-3xl font-semibold">
            {result.pattern_score.toFixed(3)}{' '}
            <span className="text-sm font-normal">on a 0–1 scale</span>
          </p>
          <p className="text-sm leading-6">
            Dataset class {result.dataset_class} at the fixed {result.threshold}{' '}
            threshold: {result.class_label}.
          </p>
          <p className="text-xs leading-6">{result.notice}</p>
          <details className="rounded-lg border border-violet-200 p-3">
            <summary className="cursor-pointer text-sm font-medium">
              Rule contributions and exact inputs
            </summary>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr>
                    <th className="p-2">Rule</th>
                    <th className="p-2">Membership</th>
                    <th className="p-2">Learned constant</th>
                    <th className="p-2">Contribution</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rules.map((rule) => (
                    <tr key={rule.rule} className="border-t">
                      <td className="p-2">{rule.rule}</td>
                      <td className="p-2">{rule.membership.toFixed(4)}</td>
                      <td className="p-2">{rule.consequent.toFixed(4)}</td>
                      <td className="p-2">{rule.contribution.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="mt-3 space-y-1 text-xs leading-6">
              {result.inputs.map((input) => (
                <li key={input.name}>
                  {input.name}: {input.value} {input.unit}
                </li>
              ))}
            </ul>
            <p className="mt-3 break-all text-[11px]">{result.version}</p>
          </details>
        </section>
      ) : null}
    </section>
  );
}

function MetricsCard({ model }: { model: EducationalModel }) {
  const measured = model.metrics;
  const baseline = model.baseline_metrics;
  const rows = [
    ['Accuracy', measured.accuracy, baseline.accuracy],
    [
      'Balanced accuracy',
      measured.balanced_accuracy,
      baseline.balanced_accuracy,
    ],
    ['Sensitivity', measured.sensitivity, baseline.sensitivity],
    ['Specificity', measured.specificity, baseline.specificity],
    ['AUROC', measured.auroc, baseline.auroc],
    ['Brier loss ↓', measured.brier, baseline.brier],
    ['Log loss ↓', measured.log_loss, baseline.log_loss],
  ] as const;
  return (
    <section className="space-y-4 rounded-2xl border bg-white p-6">
      <h2 className="text-lg font-semibold">Actual held-out performance</h2>
      <p className="text-xs leading-6 text-slate-500">
        {measured.n} held-out records: {measured.positives} positive and{' '}
        {measured.negatives} negative labels. One fixed split; small-cohort
        estimates are uncertain.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b">
              <th className="py-3 pr-3">Metric</th>
              <th className="py-3 pr-3">Fuzzy candidate</th>
              <th className="py-3">Constant baseline</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, value, comparison]) => (
              <tr key={label} className="border-b">
                <th className="py-3 pr-3 font-medium">{label}</th>
                <td className="py-3 pr-3 font-mono">{number(value)}</td>
                <td className="py-3 font-mono">{number(comparison)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs leading-6 text-slate-600">
        True positives {measured.true_positive}; false negatives{' '}
        {measured.false_negative}; false positives {measured.false_positive};
        true negatives {measured.true_negative}.
      </p>
      <p className="text-xs leading-6 text-slate-500">
        Accuracy 95% Wilson interval: {number(measured.accuracy_wilson_95[0])}–
        {number(measured.accuracy_wilson_95[1])}. This interval omits dataset
        shift and model-selection uncertainty.
      </p>
      <p className="text-xs leading-6 text-slate-500">
        Baseline: {model.training.baseline}
      </p>
    </section>
  );
}

function ModelDocumentation({ model }: { model: EducationalModel }) {
  return (
    <section className="space-y-5 rounded-2xl border bg-white p-6">
      <h2 className="text-lg font-semibold">Source, method and limitations</h2>
      <p className="text-sm leading-7">
        <a
          href={model.source.url}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-teal-700 underline"
        >
          {model.source.name}
        </a>{' '}
        ·{' '}
        <a
          href={model.source.license_url}
          target="_blank"
          rel="noreferrer"
          className="text-teal-700 underline"
        >
          {model.source.license}
        </a>
      </p>
      <p className="text-xs leading-6 text-slate-500">
        {model.source.attribution}
      </p>
      <p className="break-all font-mono text-[10px] text-slate-500">
        Source SHA-256: {model.source.sha256}
      </p>
      <p className="text-xs leading-6 text-slate-600">
        Cohort: {model.cohort.source_rows} source rows,{' '}
        {model.cohort.eligible_rows} eligible;{' '}
        {model.cohort.excluded_censored_before_90_days} early alive-censored
        observations excluded. Split: {model.training.split_rows.train} train /{' '}
        {model.training.split_rows.validation} validation /{' '}
        {model.training.split_rows.test} test.
      </p>
      <details className="rounded-xl border p-4">
        <summary className="cursor-pointer text-sm font-medium">
          How fuzzy rules and genetic search were trained
        </summary>
        <div className="mt-4 space-y-3 text-xs leading-7 text-slate-600">
          <p>{model.algorithm}.</p>
          <p>{model.training.score_definition}</p>
          <p>{model.training.preprocessing_protocol}</p>
          <p>{model.training.fit_protocol}</p>
          <p>{model.training.split_protocol}</p>
          <p>
            Training seed {model.training.seed}. Genetic population{' '}
            {model.training.ga.population}, generations{' '}
            {model.training.ga.generations}, unique candidates{' '}
            {model.training.ga.unique_candidates}. Objective:{' '}
            {model.training.ga.objective}. Selected validation Brier loss:{' '}
            {number(model.training.validation_brier)}.
          </p>
          <p>
            Reproduce locally: <code>{model.training.reproduce}</code>
          </p>
        </div>
      </details>
      <ul className="list-disc space-y-3 pl-5 text-xs leading-7 text-slate-600">
        {model.limitations.map((limitation) => (
          <li key={limitation}>{limitation}</li>
        ))}
      </ul>
    </section>
  );
}

const newsFields = [
  { name: 'age', label: 'Age', minimum: 18, maximum: 130, step: 1 },
  {
    name: 'respiration_rate',
    label: 'Respiration rate',
    minimum: 0,
    maximum: 100,
    step: 1,
  },
  {
    name: 'spo2',
    label: 'Oxygen saturation · Scale 1',
    minimum: 0,
    maximum: 100,
    step: 1,
  },
  {
    name: 'systolic_bp',
    label: 'Systolic blood pressure',
    minimum: 0,
    maximum: 300,
    step: 1,
  },
  { name: 'pulse', label: 'Pulse', minimum: 0, maximum: 300, step: 1 },
  {
    name: 'temperature',
    label: 'Temperature',
    minimum: 25,
    maximum: 45,
    step: 0.1,
  },
] as const;

function News2Calculator() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [notPregnant, setNotPregnant] = useState(false);
  const [scale1, setScale1] = useState(false);
  const [result, setResult] = useState<News2Result | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  function update(name: string, value: string) {
    setValues((previous) => ({ ...previous, [name]: value }));
    setResult(null);
  }
  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const input: Record<string, string | number> = {};
      for (const name of Object.keys(news2Units)) {
        if (!values[name]?.trim())
          throw new Error(`Supply ${name}; every measurement is required.`);
        input[name] =
          name === 'consciousness' ? values[name] : Number(values[name]);
      }
      const output = await hospitalAssessmentService.news2(
        {
          values: input,
          units: news2Units,
          not_pregnant_confirmed: notPregnant,
          scale_1_confirmed: scale1,
        },
        controller.signal,
      );
      if (!controller.signal.aborted) setResult(output);
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(
          cause instanceof Error ? cause.message : 'Could not calculate NEWS2.',
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <section className="space-y-5 rounded-2xl border bg-white p-6">
      <h2 className="flex items-center gap-2 text-xl font-semibold">
        <Activity className="size-5" />
        NEWS2 early-warning score · Scale 1
      </h2>
      <p className="max-w-4xl text-sm leading-7 text-slate-600">
        This reference calculator sums the Royal College of Physicians’ NEWS2
        physiological parameter scores. It is a separate early-deterioration
        warning score, not a fuzzy model, disease diagnosis or long-term
        prognosis. It supplies no mortality percentage, medication advice or
        automatic triage plan.
      </p>
      <p className="rounded-xl bg-amber-50 p-4 text-sm leading-7 text-amber-950">
        Adult-only educational implementation. It refuses pregnancy, unconfirmed
        Scale 1 eligibility, missing values and unsupported units. A zero or
        small score does not establish safety; interpretation and any clinical
        response require qualified professional review.
      </p>
      <button
        className={secondaryClass}
        disabled={busy}
        onClick={() => {
          setValues({
            age: '40',
            respiration_rate: '16',
            spo2: '98',
            supplemental_oxygen: '0',
            systolic_bp: '120',
            pulse: '80',
            consciousness: 'alert',
            temperature: '36.8',
          });
          setResult(null);
          setError('');
          setNotPregnant(false);
          setScale1(false);
        }}
      >
        Fill synthetic vital signs
      </button>
      <p className="text-xs text-slate-500">
        Manually constructed example, not a patient record. Eligibility
        confirmations remain unchecked.
      </p>
      <form
        onSubmit={(event) => void submit(event)}
        aria-busy={busy}
        className="space-y-5"
      >
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {newsFields.map((field) => (
            <label key={field.name} className="block text-xs font-medium">
              {field.label}
              <span className="mt-1 block font-normal text-slate-500">
                {news2Units[field.name]} · {field.minimum}–{field.maximum}
                {field.step === 1 ? ' · whole number' : ' · one decimal place'}
              </span>
              <input
                type="number"
                required
                disabled={busy}
                min={field.minimum}
                max={field.maximum}
                step={field.step}
                value={values[field.name] ?? ''}
                onChange={(event) => update(field.name, event.target.value)}
                className={fieldClass}
              />
            </label>
          ))}
          <label className="block text-xs font-medium">
            Supplemental oxygen
            <span className="mt-1 block font-normal text-slate-500">
              category
            </span>
            <select
              required
              disabled={busy}
              value={values.supplemental_oxygen ?? ''}
              onChange={(event) =>
                update('supplemental_oxygen', event.target.value)
              }
              className={fieldClass}
            >
              <option value="">Select recorded status</option>
              <option value="0">Air · no supplemental oxygen</option>
              <option value="1">Supplemental oxygen</option>
            </select>
          </label>
          <label className="block text-xs font-medium">
            Consciousness
            <span className="mt-1 block font-normal text-slate-500">
              category · ACVPU
            </span>
            <select
              required
              disabled={busy}
              value={values.consciousness ?? ''}
              onChange={(event) => update('consciousness', event.target.value)}
              className={fieldClass}
            >
              <option value="">Select recorded category</option>
              {[
                ['alert', 'Alert'],
                ['new_confusion', 'New confusion'],
                ['voice', 'Responds to voice'],
                ['pain', 'Responds to pain'],
                ['unresponsive', 'Unresponsive'],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex items-start gap-3 text-sm leading-6">
          <input
            type="checkbox"
            required
            disabled={busy}
            checked={notPregnant}
            onChange={(event) => {
              setNotPregnant(event.target.checked);
              setResult(null);
            }}
            className="mt-1"
          />
          I confirm pregnancy is not applicable for this adult.
        </label>
        <label className="flex items-start gap-3 text-sm leading-6">
          <input
            type="checkbox"
            required
            disabled={busy}
            checked={scale1}
            onChange={(event) => {
              setScale1(event.target.checked);
              setResult(null);
            }}
            className="mt-1"
          />
          I confirm SpO2 Scale 1 is appropriate and Scale 2 is not required.
          This calculator does not decide oxygen targets.
        </label>
        {error ? (
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
          >
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={busy} className={buttonClass}>
          {busy ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Activity className="size-4" />
          )}
          Calculate NEWS2 Scale 1
        </button>
      </form>
      {result ? (
        <section
          aria-live="polite"
          className="space-y-4 rounded-xl border bg-slate-50 p-5"
        >
          <h3 className="text-lg font-semibold">
            NEWS2 total: {result.total} / {result.maximum}
          </h3>
          <p className="text-sm">
            At least one physiological parameter scores 3:{' '}
            {result.single_parameter_three ? 'Yes' : 'No'}.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  <th className="p-2">Parameter</th>
                  <th className="p-2">Recorded input</th>
                  <th className="p-2">Points</th>
                </tr>
              </thead>
              <tbody>
                {result.components.map((component) => (
                  <tr key={component.parameter} className="border-t">
                    <td className="p-2">
                      {component.parameter.replaceAll('_', ' ')}
                    </td>
                    <td className="p-2">
                      {component.value} {component.unit}
                    </td>
                    <td className="p-2 font-mono">{component.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs leading-7">{result.notice}</p>
          <p className="text-xs text-slate-500">
            Age: {String(result.inputs.age)} years. Version: {result.version}.
            No result is stored.
          </p>
        </section>
      ) : null}
      <p className="text-xs leading-7 text-slate-500">
        Attribution: Royal College of Physicians. National Early Warning Score
        (NEWS) 2. Updated report of a working party. London: RCP, 2017. © Royal
        College of Physicians 2017.{' '}
        <a
          href="https://www.rcp.ac.uk/media/alxev00t/news2-chart-1_the-news-scoring-system_0_0.pdf"
          target="_blank"
          rel="noreferrer"
          className="text-teal-700 underline"
        >
          Official scoring source
        </a>
        ;{' '}
        <a
          href="https://www.rcp.ac.uk/media/a4ibkkbf/news2-final-report_0_0.pdf"
          target="_blank"
          rel="noreferrer"
          className="text-teal-700 underline"
        >
          full report
        </a>
        . This independent calculator implements factual score arithmetic and
        does not reproduce the RCP chart. Its input limits are application
        guards, not clinical reference ranges.
      </p>
    </section>
  );
}
