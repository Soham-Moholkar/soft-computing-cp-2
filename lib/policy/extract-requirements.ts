export const maxDocumentCharacters = 60_000;
const maxFindings = 200;

export const requirementGroups = {
  eligibility: 'Eligibility criteria',
  exclusions: 'Exclusions and exceptions',
  documents: 'Required documents',
  steps: 'Application steps',
} as const;

export type RequirementGroup = keyof typeof requirementGroups;

export interface DocumentFinding {
  id: string;
  group: RequirementGroup;
  heading: string;
  passage: string;
  locator: string;
  sourceContext?: string;
  line: number;
}

const headingPatterns = [
  [
    'exclusions',
    /^(?:exclusions?|exceptions?|ineligible applicants?|who cannot apply)$/i,
  ],
  [
    'eligibility',
    /^(?:eligibility(?: criteria| requirements)?|who (?:can apply|is eligible)|eligible applicants?|qualifications?)$/i,
  ],
  [
    'documents',
    /^(?:required documents?|documents?(?: required| checklist)?|supporting documents?|documentation|proof required)$/i,
  ],
  [
    'steps',
    /^(?:how to apply|application (?:process|steps|procedure)|submission(?: process)?)$/i,
  ],
] as const;

function sectionFor(label: string): RequirementGroup | undefined {
  const clean = label.replace(/^\s*(?:#+\s*|\d+[.)]\s*)/, '').trim();
  return headingPatterns.find(([, pattern]) => pattern.test(clean))?.[0];
}

const otherHeading =
  /^(?:overview|introduction|background|benefits?(?: and assistance)?|funding|financial assistance|amounts?|objective[s]?|important dates|contact(?: information)?|frequently asked questions|disclaimer|terms and conditions)$/i;

function labelFor(passage: string) {
  const clean = passage.trim().replace(/^(?:[-*•–]\s*|\d+[.)]\s*)/, '');
  if (clean.length <= 92) return clean;
  const end = clean.lastIndexOf(' ', 88);
  return clean.slice(0, end > 45 ? end : 88) + '…';
}

function classify(passage: string): RequirementGroup | undefined {
  if (
    /\b(?:ineligible|not eligible|excluded|disqualified|cannot apply|shall not (?:be eligible|qualify)|except|unless)\b/i.test(
      passage,
    )
  )
    return 'exclusions';
  if (
    /\b(?:submit|provide|attach|produce|upload|furnish|bring|enclose)\b[^.!?]*\b(?:certificates?|proof|copies|copy|documents?|identity card|bank statements?|photographs?)\b/i.test(
      passage,
    )
  )
    return 'documents';
  if (
    /\b(?:apply (?:online|through|at|via|in person)|(?:submit|complete|file|fill out) (?:the |an |your )?application|register (?:at|on|through))\b/i.test(
      passage,
    )
  )
    return 'steps';
  if (
    /\b(?:eligible|eligibility|qualifies?|(?:applicants?|beneficiaries?)\s+(?:must|shall|should|need to))\b/i.test(
      passage,
    )
  )
    return 'eligibility';
}

export function extractRequirements(text: string): DocumentFinding[] {
  if (!text.trim()) return [];
  if (text.length > maxDocumentCharacters)
    throw new Error('Use an excerpt of up to 60,000 characters.');

  const results: DocumentFinding[] = [];
  const lines = text.split(/\r?\n/);
  const headings = lines.map((line) => {
    const trimmed = line.trim();
    const colon = trimmed.indexOf(':');
    const label = colon >= 0 ? trimmed.slice(0, colon) : trimmed;
    const group = sectionFor(label);
    const isOther =
      otherHeading.test(label.replace(/^#{1,6}\s*/, '').trim()) ||
      /^#{1,6}\s|^[A-Za-z][A-Za-z /&-]{1,55}:$/.test(trimmed);
    return {
      label,
      group,
      isOther,
      inline: colon >= 0 && Boolean(trimmed.slice(colon + 1).trim()),
    };
  });
  const sectionEnds = new Map<number, number>();
  let nextHeading = lines.length;
  for (let index = lines.length - 1; index >= 0; index--) {
    const heading = headings[index];
    if (!heading.group && !heading.isOther) continue;
    if (heading.group) sectionEnds.set(index, nextHeading);
    nextHeading = index;
  }
  let section:
    | { heading: string; group: RequirementGroup; context: string }
    | undefined;

  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const heading = headings[index];
    if (heading.group) {
      section = {
        group: heading.group,
        heading: heading.label,
        context: lines
          .slice(index, sectionEnds.get(index))
          .join('\n')
          .trimEnd(),
      };
      if (!heading.inline) continue;
    } else if (heading.isOther) {
      section = undefined;
      continue;
    }

    const context = classify(trimmed);
    const category =
      heading.group ??
      (context === 'exclusions' ? context : (section?.group ?? context));
    if (!category) continue;

    if (results.length >= maxFindings)
      throw new Error(
        'This excerpt contains more than 200 possible requirements. Choose a shorter section.',
      );

    let first = index;
    let last = index;
    if (!section) {
      while (
        first > 0 &&
        lines[first - 1].trim() &&
        !headings[first - 1].group &&
        !headings[first - 1].isOther
      )
        first--;
      while (
        last < lines.length - 1 &&
        lines[last + 1].trim() &&
        !headings[last + 1].group &&
        !headings[last + 1].isOther
      )
        last++;
    }
    const sourceContext =
      section?.context ?? lines.slice(first, last + 1).join('\n');
    results.push({
      id: 'line-' + (index + 1),
      group: category,
      heading: labelFor(line),
      passage: line,
      locator: (section ? section.heading + ' · ' : '') + 'Line ' + (index + 1),
      sourceContext: sourceContext === line ? undefined : sourceContext,
      line: index + 1,
    });
  }

  return results;
}
