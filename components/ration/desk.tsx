'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CircleHelp,
  ClipboardList,
  FileUp,
  Fingerprint,
  MapPin,
  Search,
  ShieldCheck,
  Wheat,
} from 'lucide-react';
import {
  guide,
  guideTrail,
  searchGuide,
  sources,
  type Language,
} from '@/lib/ration/guide';
import hindiLabels from '@/lib/ration/hi-graph.json';
import { EvidenceGraph } from './evidence-graph';
import { UploadLab } from './upload-lab';
import { PolicyExplorer } from './policy-explorer';
import './desk.css';

const text = {
  en: {
    label: 'Public ration guidance',
    help: 'Get help',
    lab: 'Evidence lab',
    headline: 'Find your next step',
    accent: 'to get ration.',
    tagline:
      'Ask in simple words. Get a clear next step and see the official information behind it.',
    question: 'What do you need help with?',
    placeholder: 'Example: I moved to another state. Can I use my ration card?',
    search: 'Find help',
    quick: 'Common questions',
    next: 'Your next step',
    official: 'Open official source',
    proof: 'See how the evidence connects',
    rank: 'Why this result came first',
    noMatch: 'I couldn’t find enough evidence for that question.',
    retry:
      'Try words like new card, ration refused, fingerprint, or moved to another state.',
    method: 'About this guide',
    methodBody:
      'This guide searches a built-in collection of summaries linked to government sources. It uses word and phrase matching to choose a next step. It does not check a person’s eligibility or collect ID numbers.',
    data: 'Download the evidence file',
    illustration: 'From question to proof',
    guideStep: 'One question',
    guideSource: 'An official source',
    guideAction: 'A practical next step',
    searchTip:
      'Use general words. Leave out Aadhaar numbers, ration card numbers and addresses.',
    resultSources: 'Other relevant passages',
    rankRows: ['Phrase match', 'Distinctive words', 'Near spellings'],
  },
  hi: {
    label: 'सार्वजनिक राशन सहायता',
    help: 'सहायता लें',
    lab: 'स्रोत जाँच',
    headline: 'राशन पाने का अगला',
    accent: 'कदम जानें।',
    tagline: 'आसान शब्दों में पूछें। अगला कदम और उसके पीछे की आधिकारिक जानकारी देखें।',
    question: 'किस बात में मदद चाहिए?',
    placeholder: 'जैसे: क्या मैं दूसरे राज्य में अपना राशन कार्ड इस्तेमाल कर सकता हूँ?',
    search: 'सहायता खोजें',
    quick: 'आम सवाल',
    next: 'आपका अगला कदम',
    official: 'आधिकारिक स्रोत खोलें',
    proof: 'देखें जानकारी कैसे जुड़ती है',
    rank: 'यह जवाब पहले क्यों आया',
    noMatch: 'इस सवाल के लिए पर्याप्त जानकारी नहीं मिली।',
    retry: 'नया कार्ड, राशन नहीं मिला, अंगूठा या दूसरे राज्य जैसे शब्द आज़माएँ।',
    method: 'इस गाइड के बारे में',
    methodBody:
      'यह गाइड सरकारी स्रोतों से जुड़े सारांश खोजती है। अगला कदम सुझाने के लिए शब्दों और वाक्यांशों का मिलान करती है। यह व्यक्तिगत पात्रता की जाँच नहीं करती और पहचान नंबर नहीं माँगती।',
    data: 'स्रोत वाली फ़ाइल डाउनलोड करें',
    illustration: 'सवाल से स्रोत तक',
    guideStep: 'एक सवाल',
    guideSource: 'एक आधिकारिक स्रोत',
    guideAction: 'अगला कदम',
    searchTip: 'सामान्य शब्द लिखें। आधार नंबर, राशन कार्ड नंबर और पता न लिखें।',
    resultSources: 'अन्य उपयोगी जानकारी',
    rankRows: ['वाक्यांश मिलान', 'खास शब्द', 'मिलती-जुलती वर्तनी'],
  },
} as const;

const scenarios = [
  {
    id: 'move',
    icon: MapPin,
    en: 'I moved to another state',
    hi: 'मैं दूसरे राज्य में चला गया',
  },
  {
    id: 'denied',
    icon: CircleHelp,
    en: 'The ration shop refused me',
    hi: 'मुझे राशन नहीं मिला',
  },
  {
    id: 'apply',
    icon: ClipboardList,
    en: 'I need a new ration card',
    hi: 'मुझे नया राशन कार्ड चाहिए',
  },
  {
    id: 'fingerprint',
    icon: Fingerprint,
    en: 'My fingerprint failed',
    hi: 'मेरा अंगूठा काम नहीं कर रहा',
  },
];

export function RationDesk() {
  const [language, setLanguage] = useState<Language>('en');
  const [view, setView] = useState<'help' | 'lab' | 'policy'>('help');
  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState('');
  const [search, setSearch] = useState<ReturnType<typeof searchGuide> | null>(
    null,
  );
  const t = text[language];
  const results = useRef<HTMLElement>(null);
  useEffect(() => {
    if (search) results.current?.scrollIntoView({ block: 'nearest' });
  }, [search]);

  useEffect(() => {
    let disposed = false;
    void Promise.resolve().then(() => {
      if (!disposed && localStorage.getItem('ration-language') === 'hi')
        setLanguage('hi');
    });
    return () => {
      disposed = true;
    };
  }, []);

  function ask(value: string) {
    const clean = value.trim();
    if (!clean) return;
    setQuestion(clean);
    setAsked(clean);
    setSearch(searchGuide(clean));
  }

  function changeLanguage(value: Language) {
    setLanguage(value);
    localStorage.setItem('ration-language', value);
  }

  const answer = search?.first;
  const labels: Readonly<Record<string, string>> = hindiLabels;
  const label = (value: string) =>
    language === 'hi' ? (labels[value] ?? value) : value;
  const trail = answer
    ? guideTrail(answer.entry).map((entry) => ({
        id: entry.id,
        from: label(entry.from),
        to: label(entry.to),
        verb: label(entry.verb),
        quote: language === 'hi' ? entry.hiBody : entry.body,
        citation: sources[entry.source][0],
        url: sources[entry.source][1],
      }))
    : [];

  return (
    <div className="rs-app" lang={language}>
      <header className="rs-header">
        <div className="rs-container rs-header-content">
          <a className="rs-brand" href="#top" onClick={() => setView('help')}>
            <span>
              <Wheat size={24} />
            </span>
            <strong>
              Ration Saathi<small>{t.label}</small>
            </strong>
          </a>
          <nav aria-label={language === 'hi' ? 'मुख्य मेनू' : 'Main navigation'}>
            <button
              type="button"
              aria-pressed={view === 'help'}
              onClick={() => setView('help')}
            >
              <BookOpen size={16} />
              {t.help}
            </button>
            <button
              type="button"
              aria-pressed={view === 'lab'}
              onClick={() => setView('lab')}
            >
              <FileUp size={16} />
              {t.lab}
            </button>
            <button
              type="button"
              aria-pressed={view === 'policy'}
              onClick={() => setView('policy')}
            >
              <Search size={16} />
              {language === 'hi' ? 'नीति खोजें' : 'Policy explorer'}
            </button>
          </nav>
          <div className="rs-language" aria-label="Language">
            <button
              type="button"
              aria-pressed={language === 'en'}
              onClick={() => changeLanguage('en')}
            >
              English
            </button>
            <button
              type="button"
              lang="hi"
              aria-pressed={language === 'hi'}
              onClick={() => changeLanguage('hi')}
            >
              हिन्दी
            </button>
          </div>
        </div>
      </header>
      <main id="top" className="rs-container rs-main">
        {view === 'help' ? (
          <>
            <section className="rs-hero">
              <div className="rs-hero-main">
                <span className="rs-kicker">
                  <ShieldCheck size={15} /> {t.label}
                </span>
                <h1>
                  {t.headline}
                  <br />
                  <span>{t.accent}</span>
                </h1>
                <p>{t.tagline}</p>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    ask(question);
                  }}
                >
                  <label htmlFor="ration-question">{t.question}</label>
                  <div className="rs-search">
                    <Search size={20} />
                    <input
                      id="ration-question"
                      value={question}
                      onChange={(event) => setQuestion(event.target.value)}
                      maxLength={240}
                      required
                      placeholder={t.placeholder}
                    />
                    <button type="submit">
                      {t.search} <ArrowRight size={18} />
                    </button>
                  </div>
                  <small>{t.searchTip}</small>
                </form>
              </div>
              <div className="rs-hero-flow" aria-hidden="true">
                <p>{t.illustration}</p>
                <div>
                  <span>
                    <CircleHelp size={24} />
                  </span>
                  <strong>{t.guideStep}</strong>
                </div>
                <div>
                  <span>
                    <BookOpen size={24} />
                  </span>
                  <strong>{t.guideSource}</strong>
                </div>
                <div>
                  <span>
                    <ArrowRight size={24} />
                  </span>
                  <strong>{t.guideAction}</strong>
                </div>
              </div>
            </section>
            <section className="rs-quick" aria-label={t.quick}>
              <h2>{t.quick}</h2>
              <div className="rs-quick-grid">
                {scenarios.map(({ id, icon: Icon, en, hi }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => ask(language === 'hi' ? hi : en)}
                  >
                    <span>
                      <Icon size={20} />
                    </span>
                    <strong>{language === 'hi' ? hi : en}</strong>
                    <ArrowUpRight size={16} />
                  </button>
                ))}
              </div>
            </section>
            {search && (
              <section
                ref={results}
                className="rs-result"
                aria-live="polite"
                aria-label={t.next}
              >
                {answer ? (
                  <>
                    <article className="rs-result-card">
                      <p className="rs-kicker">{t.next}</p>
                      <h2>
                        {language === 'hi'
                          ? answer.entry.hiTitle
                          : answer.entry.title}
                      </h2>
                      <p className="rs-result-copy">
                        {language === 'hi'
                          ? answer.entry.hiBody
                          : answer.entry.body}
                      </p>
                      <a
                        className="rs-primary"
                        href={sources[answer.entry.source][1]}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t.official} <ArrowUpRight size={17} />
                      </a>
                      <p className="rs-source-label">
                        {sources[answer.entry.source][0]}
                      </p>
                      {search.related.length > 0 && (
                        <details className="rs-detail">
                          <summary>{t.resultSources}</summary>
                          {search.related.map(({ entry }) => (
                            <div key={entry.id}>
                              <strong>
                                {language === 'hi'
                                  ? entry.hiTitle
                                  : entry.title}
                              </strong>
                              <p>
                                {language === 'hi' ? entry.hiBody : entry.body}
                              </p>
                              <a
                                href={sources[entry.source][1]}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {t.official}
                              </a>
                            </div>
                          ))}
                        </details>
                      )}
                      <details className="rs-detail">
                        <summary>{t.rank}</summary>
                        <p>
                          {language === 'hi'
                            ? 'जाँचे गए सारांश'
                            : 'Summaries checked'}
                          : {search.checked} · {asked}
                        </p>
                        <dl>
                          {[
                            answer.phraseScore,
                            answer.lexical,
                            answer.fuzzy,
                          ].map((score, index) => (
                            <div key={t.rankRows[index]}>
                              <dt>{t.rankRows[index]}</dt>
                              <dd>
                                {score.toFixed(2)} ×{' '}
                                {[0.6, 0.32, 0.08][index].toFixed(2)}
                              </dd>
                            </div>
                          ))}
                        </dl>
                        <p>
                          {[answer.phrase, ...answer.matches, ...answer.near]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </details>
                    </article>
                    <EvidenceGraph
                      key={asked}
                      edges={trail}
                      title={t.proof}
                      words={['', '']}
                    />
                  </>
                ) : (
                  <article className="rs-result-card">
                    <h2>{t.noMatch}</h2>
                    <p>{t.retry}</p>
                  </article>
                )}
              </section>
            )}
            <footer className="rs-footer">
              <details>
                <summary>{t.method}</summary>
                <p>{t.methodBody}</p>
              </details>
              <a href="/demo/ration-guide.csv" download>
                <ArrowDownToLine size={16} />
                {t.data} <span>CSV · {guide.length}</span>
              </a>
            </footer>
          </>
        ) : view === 'policy' ? (
          <PolicyExplorer />
        ) : (
          <UploadLab key={language} language={language} />
        )}
      </main>
    </div>
  );
}
