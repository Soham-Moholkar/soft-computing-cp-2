import type { EvidenceLayer, OfficialSource, Rule, Version } from './catalog';
import evidenceData from './mahadbt-evidence.json';
import { nationalEvidence } from './national-evidence';

interface RecordedSection {
  heading: string;
  lines: string[];
}
interface RecordedScheme {
  title: string;
  sections: Partial<Record<Exclude<EvidenceLayer, 'path'>, RecordedSection>>;
}
interface Listing {
  name: string;
  url: string;
  sourceTitle: string;
  locator: string;
}
const stateEvidence: Readonly<Partial<Record<string, RecordedScheme>>> =
  evidenceData;
const sectionTargets = {
  funding: ['Published benefit', 'lists', 'Amounts and eligible expenses'],
  eligibility: [
    'Published eligibility',
    'sets conditions for',
    'Eligible applicants',
  ],
  documents: ['Published checklist', 'lists', 'Application documents'],
} as const;

export function directoryProfile(item: Listing): Version | undefined {
  const official = nationalEvidence.get(item.name);
  if (official) return official;
  const key = new URL(item.url).searchParams.get('str');
  const scheme = key ? stateEvidence[key] : undefined;
  if (!scheme) return undefined;
  const source: OfficialSource = {
    title: 'MahaDBT · ' + scheme.title,
    url: item.url,
    locator: 'About Scheme',
  };
  const rules: Rule[] = [
    {
      label: 'Programme record',
      verb: 'is published in',
      target: 'MahaDBT scheme page',
      kind: 'Rule',
      keywords: item.name,
      evidence: 'The Maharashtra portal publishes this programme record.',
      source,
    },
  ];

  for (const layer of Object.keys(
    sectionTargets,
  ) as (keyof typeof sectionTargets)[]) {
    const section = scheme.sections[layer];
    if (!section) continue;
    const [label, verb, standardTarget] = sectionTargets[layer];
    const target =
      layer === 'funding' &&
      section.lines.length === 1 &&
      section.lines[0].length <= 85
        ? section.lines[0]
        : standardTarget;
    rules.push({
      layer,
      label,
      verb,
      target,
      kind: 'Rule',
      keywords: item.name + ' ' + section.heading,
      evidence: section.lines.join('\n'),
      source: { ...source, locator: 'About Scheme · ' + section.heading },
    });
  }
  return {
    id: 'official',
    label: 'MahaDBT published scheme profile',
    years: [],
    source,
    summary:
      'The graph shows the sections published for this programme on the Maharashtra portal. Check the portal for application dates and any institution-specific directions.',
    rules,
  };
}
