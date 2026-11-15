import { clamp, trapezoidalMembership } from '@/lib/algorithms/fuzzy';
import { policyIndex } from './index';
import type { Policy, Version } from './catalog';

const stop = new Set(
  'a an the i we they in of on for to by how does do did is are me my and can get what which if has will with it policy scheme government help support want need buy buyin purchase buying looking any before after old earlier version historical में के से क्या कैसे मुझे আমি চাই কি জন্য সাহায্য'.split(
    ' ',
  ),
);
export const jurisdictions = [
  'All locations',
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
] as const;

function normalize(value: string) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .trim();
}
function terms(value: string) {
  return new Set(
    normalize(value)
      .split(' ')
      .filter((word) => word && !stop.has(word)),
  );
}
const whole = (words: string, phrase: string) =>
  (' ' + words + ' ').includes(' ' + phrase + ' ');
const any = (phrase: string, values: string[]) =>
  values.some((value) => whole(phrase, normalize(value)));
function score(words: Set<string>, index: Set<string>) {
  return [...words].reduce(
    (value, word) => value + (index.has(word) ? (word.length > 4 ? 2 : 1) : 0),
    0,
  );
}

export type Asset = 'two-wheeler' | 'three-wheeler' | '';
export interface QueryPlan {
  text: string;
  asset: Asset;
  electric: boolean;
  petrol: boolean;
  use: 'Delivery for work' | 'Commercial use' | 'Personal use' | '';
  audience: string;
  circumstance: string;
  request: string;
  goal: string;
  goals: string[];
  state: string;
}

export function understand(
  query: string,
  location = 'All locations',
): QueryPlan {
  const text = normalize(query);
  const bereavement = any(text, [
    'husband died',
    'lost my husband',
    'husband passed away',
    'spouse died',
    'spouse passed away',
    'lost my spouse',
    'breadwinner died',
    'death of the breadwinner',
    'पति की मृत्यु',
    'স্বামী মারা',
  ]);
  const widow = any(text, [
    'widow',
    'widows',
    'widowed',
    'widowhood',
    'vidhwa',
    'vidhva',
    'विधवा',
    'বিধবা',
    'বিধবা ভাতা',
    'விதவை',
    'husband died',
    'lost my husband',
    'husband passed away',
    'पति की मृत्यु',
    'স্বামী মারা',
  ]);
  const pension = widow || any(text, ['pension', 'पेंशन', 'ভাতা']);
  const three = any(text, [
    'auto rickshaw',
    'autorickshaw',
    'rickshaw',
    'three wheeler',
    'tuk tuk',
    'ऑटो रिक्शा',
    'অটোরিকশা',
    'অটো রিকশা',
  ]);
  const two = any(text, [
    'motorcycle',
    'motor bike',
    'motorbike',
    'scooter',
    'bike',
    'two wheeler',
    'बाइक',
    'स्कूटर',
    'বাইক',
    'স্কুটার',
  ]);
  const asset = three ? 'three-wheeler' : two ? 'two-wheeler' : '';
  const delivery = any(text, [
    'delivery',
    'deliveries',
    'deliver groceries',
    'deliver food',
    'deliver parcels',
    'courier',
    'blinkit',
    'zepto',
    'swiggy',
    'zomato',
    'gig worker',
    'gig workers',
    'platform worker',
    'डिलीवरी',
    'ডেলিভারি',
  ]);
  const personal = any(text, [
    'personal use',
    'private use',
    'only personal',
    'for myself privately',
  ]);
  const commercial = any(text, [
    'commercial',
    'transport passengers',
    'passenger fares',
    'for work',
    'earn',
    'livelihood',
    'for business',
    'income from driving',
  ]);
  const education = any(text, [
    'scholarship',
    'scholarships',
    'study',
    'student',
    'school',
    'college',
    'university',
    'tuition',
    'छात्रवृत्ति',
    'স্কলারশিপ',
    'বৃত্তি',
  ]);
  const college = any(text, [
    'college',
    'degree',
    'university',
    'postgraduate',
    'diploma',
    'tuition',
    'कॉलेज',
    'কলেজ',
  ]);
  const equipment = any(text, [
    'sewing machine',
    'machinery',
    'equipment',
    'tools',
    'stitching machine',
    'machine for work',
    'সেলাই মেশিন',
  ]);
  const business =
    equipment ||
    any(text, [
      'business',
      'shop',
      'stall',
      'tailoring',
      'venture',
      'enterprise',
      'self employed',
      'startup',
      'start selling',
      'entrepreneur',
      'व्यवसाय',
      'ব্যবসা',
    ]);
  const vendor = any(text, [
    'street vendor',
    'street vending',
    'hawker',
    'street cart',
    'रेहड़ी',
  ]);
  const subsidy = any(text, [
    'subsidy',
    'grant',
    'margin money',
    'अनुदान',
    'ভর্তুকি',
  ]);
  const credit = any(text, [
    'loan',
    'credit',
    'finance',
    'funding',
    'ऋण',
    'ঋণ',
  ]);
  const ration = any(text, ['ration', 'onorc', 'foodgrain', 'राशन', 'রেশন']);
  const electric =
    !any(text, ['non electric', 'not electric', 'petrol only']) &&
    any(text, [
      'electric',
      'ev',
      'e scooter',
      'e bike',
      'e rickshaw',
      'battery powered',
      'इलेक्ट्रिक',
      'ইলেকট্রিক',
    ]);
  const petrol =
    !electric &&
    any(text, ['petrol', 'diesel', 'gasoline', 'non electric', 'পেট্রোল']);
  const stateFromQuery =
    [
      [
        'Tamil Nadu',
        'tamil nadu',
        'chennai',
        'coimbatore',
        'তামিলনাড়ু',
        'तमिलनाडु',
      ],
      ['West Bengal', 'west bengal', 'kolkata', 'পশ্চিমবঙ্গ', 'কলকাতা'],
      ['Maharashtra', 'maharashtra', 'pune', 'mumbai', 'महाराष्ट्र', 'মহারাষ্ট্র'],
    ].find(([, ...names]) => any(text, names))?.[0] ??
    jurisdictions.slice(1).find((name) => whole(text, normalize(name)));
  const goals = [
    ...(asset || delivery ? ['vehicle'] : []),
    ...(asset ? [asset] : []),
    ...(delivery ? ['delivery', 'business'] : []),
    ...(education ? ['scholarship', college ? 'college' : 'school'] : []),
    ...(business ? ['business'] : []),
    ...(equipment ? ['equipment'] : []),
    ...(vendor ? ['street vending'] : []),
    ...(subsidy ? ['subsidy'] : []),
    ...(credit ? ['credit'] : []),
    ...(ration ? ['ration'] : []),
    ...(widow ? ['widow support'] : []),
    ...(pension ? ['pension'] : []),
    ...(bereavement ? ['bereavement', 'family income loss'] : []),
  ];
  return {
    text,
    asset,
    electric,
    petrol,
    use: personal
      ? 'Personal use'
      : delivery
        ? 'Delivery for work'
        : commercial
          ? 'Commercial use'
          : '',
    audience: delivery
      ? 'Delivery or platform worker'
      : vendor
        ? 'Street vendor'
        : education
          ? 'Student'
          : '',
    circumstance: widow
      ? 'Widowhood'
      : bereavement
        ? 'Death in the family'
        : '',
    request: any(text, [
      'documents',
      'paperwork',
      'checklist',
      'কাগজপত্র',
      'दस्तावेज़',
    ])
      ? 'Documents'
      : any(text, [
            'how much',
            'amount',
            'what amount',
            'loan limit',
            'কত টাকা',
            'कितना',
          ])
        ? 'Money'
        : any(text, [
              'who qualifies',
              'am i eligible',
              'eligibility',
              'qualify',
              'पात्रता',
              'যোগ্যতা',
            ])
          ? 'Eligibility'
          : '',
    goal: asset
      ? 'Purchase a vehicle'
      : equipment
        ? 'Buy business equipment'
        : education
          ? 'Pay for education'
          : business
            ? 'Start or grow a business'
            : ration
              ? 'Access food support'
              : widow
                ? 'Find widow support'
                : bereavement
                  ? 'Find support after a death'
                  : pension
                    ? 'Find a pension'
                    : '',
    goals: [...new Set(goals)],
    state: location !== 'All locations' ? location : (stateFromQuery ?? ''),
  };
}

export interface PolicyMatch {
  policy: Policy;
  fit: string;
  explanation: string;
  score: number;
  signals: {
    activity: number;
    wording: number;
    location: number;
    documentation: number;
  };
}

export function policyMatches(query: string, topic: string, plan: QueryPlan) {
  const words = terms(query);
  const welfareOnly = Boolean(
    plan.circumstance &&
    plan.goals.every((goal) =>
      [
        'widow support',
        'pension',
        'bereavement',
        'family income loss',
      ].includes(goal),
    ),
  );
  const candidates = policyIndex.filter(
    (policy) =>
      (topic === 'All topics' || policy.topic === topic) &&
      (!plan.state || !policy.state || policy.state === plan.state) &&
      !(
        plan.asset &&
        policy.assetRestricted &&
        !policy.directAssets?.includes(plan.asset)
      ) &&
      !(policy.electricOnly && plan.petrol) &&
      !(
        ['Loan', 'Loan + subsidy'].includes(policy.fundingType ?? '') &&
        /\b(?:no loans?|only (?:a )?grants?|without (?:a )?loans?)\b/.test(
          plan.text,
        )
      ) &&
      !(
        plan.use === 'Personal use' &&
        ['mudra', 'tn-auto', 'tn-gig', 'pmegp', 'wb-credit'].includes(policy.id)
      ),
  );
  const rows: PolicyMatch[] = candidates.flatMap((policy) => {
    const sameName =
      whole(plan.text, normalize(policy.name)) ||
      (!policy.listingOnly && whole(plan.text, policy.id));
    const ruleScore = Math.max(
      ...policy.versions.flatMap((version) =>
        version.rules.map((rule) =>
          score(words, terms(rule.keywords + ' ' + rule.target)),
        ),
      ),
    );
    const nameScore = score(words, terms(policy.keywords));
    const direct = Boolean(
      plan.asset && policy.directAssets?.includes(plan.asset),
    );
    const goals = policy.goals ?? [];
    const shared = plan.goals.filter((goal) => goals.includes(goal));
    if (welfareOnly && policy.topic !== 'Social support' && !sameName)
      return [];
    if (welfareOnly && !shared.length && !sameName) return [];
    const broadVehicle = Boolean(plan.asset && goals.includes('vehicle'));
    const broaderBusiness = Boolean(
      plan.asset && goals.includes('business') && !direct,
    );
    const electricAlternative =
      direct && Boolean(policy.electricOnly) && !plan.electric;
    if (plan.asset && !direct && !broadVehicle && !broaderBusiness && !sameName)
      return [];
    if (plan.text && !sameName && !shared.length && nameScore + ruleScore < 2)
      return [];
    const activity = direct
      ? electricAlternative
        ? 0.77
        : 1
      : broadVehicle
        ? 0.62
        : broaderBusiness
          ? 0.42
          : clamp(shared.length / Math.max(1, Math.min(2, plan.goals.length)));
    const wordHits = nameScore + ruleScore;
    const wording = sameName
      ? 1
      : trapezoidalMembership(wordHits, 0, Math.max(3, words.size), 1000, 1001);
    const location =
      welfareOnly && !plan.state
        ? Number(!policy.state)
        : policy.state
          ? plan.state
            ? 1
            : 0.43
          : 0.77;
    const documentation = policy.listingOnly ? 0.22 : 1;
    const value =
      0.54 * activity + 0.27 * wording + 0.12 * location + 0.07 * documentation;
    const fit = policy.listingOnly
      ? 'Official listing'
      : electricAlternative
        ? 'Electric option'
        : direct
          ? 'Vehicle named in source'
          : broaderBusiness || broadVehicle
            ? 'Broader business option'
            : 'Documented programme';
    const explanation = policy.listingOnly
      ? 'Open the official catalogue for programme rules.'
      : electricAlternative
        ? 'The policy names an electric vehicle. Confirm the model and applicable conditions.'
        : direct
          ? 'An official source names this vehicle category. Check its use and applicant conditions.'
          : broaderBusiness || broadVehicle
            ? 'The programme covers a wider business activity. Confirm your vehicle and work arrangement with the administering agency.'
            : 'Found through your words or the type of support you asked about.';
    return [
      {
        policy,
        fit,
        explanation,
        score: value,
        signals: { activity, wording, location, documentation },
      },
    ];
  });
  return rows.sort((a, b) => {
    if (!plan.text)
      return (
        Number(Boolean(a.policy.listingOnly)) -
        Number(Boolean(b.policy.listingOnly))
      );
    const exact = (policy: Policy) =>
      Number(
        whole(plan.text, normalize(policy.name)) ||
          (!policy.listingOnly && whole(plan.text, policy.id)),
      );
    return exact(b.policy) - exact(a.policy) || b.score - a.score;
  });
}

export function selectedVersion(policy: Policy, query: string) {
  const cutoff = query.match(
    /\b(as of|before|in|during|version)\s+(20\d\d)\b/i,
  );
  if (cutoff) {
    const year = Number(cutoff[2]);
    const result = policy.versions.find((version) =>
      cutoff[1].toLowerCase() === 'before'
        ? version.years.some((item) => item < year)
        : version.years.includes(year),
    );
    return {
      version: result ?? policy.versions[0],
      missingYear: result ? null : year,
    };
  }
  const earlier =
    /\b(old|original rules|original version|earlier|historical|previous (?:version|rules|limit|ceiling|loan structure))\b/i.test(
      query,
    );
  return {
    version: earlier ? policy.versions.at(-1)! : policy.versions[0],
    missingYear: null,
  };
}

export function rankRules(version: Version, query: string) {
  const words = terms(query);
  return version.rules
    .map((rule) => ({
      rule,
      rating: score(words, terms(rule.keywords + ' ' + rule.target)),
    }))
    .sort((a, b) => b.rating - a.rating)
    .map(({ rule }) => rule);
}
