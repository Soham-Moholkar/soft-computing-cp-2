import data from './guide-data.json';

export const guide = data.entries;
export type GuideEntry = (typeof guide)[number];
export type Language = 'en' | 'hi';
export const sources: Readonly<Record<string, string[]>> = data.sources;

const generic = new Set(
  'a an the i my in is for of to how do does can get use about what where which with ration card food shop please राशन कार्ड में के से की का को है क्या कैसे मुझे चाहिए'.split(
    ' ',
  ),
);

function normalize(value: string) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .trim();
}
function tokens(value: string) {
  return [
    ...new Set(
      normalize(value)
        .split(' ')
        .filter((word) => word && !generic.has(word)),
    ),
  ];
}
const index = guide.map((entry) => ({
  entry,
  phrases: entry.terms.map(normalize),
  words: tokens([entry.title, entry.hiTitle, ...entry.terms].join(' ')),
}));
const frequencies = new Map<string, number>();
for (const row of index)
  for (const word of row.words)
    frequencies.set(word, (frequencies.get(word) ?? 0) + 1);
const idf = (word: string) =>
  Math.log1p(guide.length / (frequencies.get(word) ?? 1));

function closeWord(a: string, b: string) {
  if (
    Math.abs(a.length - b.length) > 1 ||
    !/^[a-z]{5,}$/.test(a) ||
    !/^[a-z]{5,}$/.test(b)
  )
    return false;
  if (a.length > b.length) [a, b] = [b, a];
  const offset = b.length - a.length;
  let mismatch = 0;
  let j = 0;
  for (const letter of a) {
    if (letter !== b[j] && ++mismatch > 1) return false;
    if (offset && letter !== b[j]) j += 1;
    j += 1;
  }
  return true;
}

export function searchGuide(question: string) {
  const text = ` ${normalize(question)} `;
  const query = tokens(question);
  const total = query.reduce((sum, word) => sum + idf(word), 0);
  const ranked = index
    .map(({ entry, phrases, words }) => {
      const phrase =
        phrases
          .filter((value) => text.includes(` ${value} `))
          .sort((a, b) => b.length - a.length)[0] ?? '';
      const matches = query.filter((word) => words.includes(word));
      const near = query.filter(
        (word) =>
          !matches.includes(word) &&
          words.some((candidate) => closeWord(word, candidate)),
      );
      const lexical = total
        ? matches.reduce((sum, word) => sum + idf(word), 0) / total
        : 0;
      const fuzzy = total
        ? near.reduce((sum, word) => sum + idf(word), 0) / total
        : 0;
      const phraseScore = phrase ? (phrase.includes(' ') ? 1 : 0.7) : 0;
      return {
        entry,
        phrase,
        matches,
        near,
        lexical,
        fuzzy,
        phraseScore,
        score: 0.6 * phraseScore + 0.32 * lexical + 0.08 * fuzzy,
      };
    })
    .sort((a, b) => b.score - a.score || b.matches.length - a.matches.length);
  const first = ranked[0];
  const approved =
    first.phraseScore >= 0.7 ||
    first.lexical >= 0.55 ||
    (query.length <= 2 && first.fuzzy >= 0.75);
  return {
    first: approved ? first : null,
    related: approved
      ? ranked
          .slice(1)
          .filter(
            (value) =>
              value.score >= 0.2 && value.entry.topic === first.entry.topic,
          )
          .slice(0, 2)
      : [],
    checked: ranked.length,
  };
}

// Only adjacent, source-backed edges in the same topic; these can add useful context.
export function guideTrail(entry: GuideEntry) {
  const connected = [entry];
  const used = new Set([entry.id]);
  const nodes = new Set([entry.from, entry.to]);
  while (connected.length < 4) {
    const next = guide.find(
      (item) =>
        item.topic === entry.topic &&
        !used.has(item.id) &&
        (nodes.has(item.from) || nodes.has(item.to)),
    );
    if (!next) break;
    connected.push(next);
    used.add(next.id);
    nodes.add(next.from);
    nodes.add(next.to);
  }
  return connected;
}
