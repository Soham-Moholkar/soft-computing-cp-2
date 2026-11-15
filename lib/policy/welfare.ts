import type { OfficialSource, Policy, Rule } from './catalog';

const nsap: OfficialSource = {
  title:
    'Ministry of Rural Development / PIB · National Social Assistance Programme',
  url: 'https://www.pib.gov.in/PressReleasePage.aspx?PRID=2210378&lang=2&reg=3',
  locator: 'NSAP · Assistance and eligibility table',
};
const nsapApplication: OfficialSource = {
  title: 'Ministry of Rural Development · NSAP guidelines',
  url: 'https://rural.gov.in/sites/default/files/NSAP_Guidelines_English.pdf',
  locator: '§3.1.3 · Application and supporting records',
};
const nsapEarlier: OfficialSource = {
  title: 'Ministry of Rural Development · Letter of 8 November 2012',
  url: 'https://cdnbbsr.s3waas.gov.in/s357bafb2c2dfeefba931bb03a835b1fa9/uploads/2025/02/20250204215751571.pdf#page=1',
  locator: 'Paragraph 1(i) · Previous and revised IGNWPS rules',
};
const mh: OfficialSource = {
  title: 'Maharashtra Social Justice & Special Assistance Department',
  url: 'https://sjsa.maharashtra.gov.in/en/scheme/sanjay-gandhi-niradhar-anudan-yojana/',
  locator: 'Eligibility Criteria',
};
const mhWidow: OfficialSource = {
  title: 'Maharashtra Social Justice & Special Assistance Department · IGNWPS',
  url: 'https://sjsa.maharashtra.gov.in/en/scheme/indira-gandhi-national-widow-pension-scheme/',
  locator: 'Eligibility Criteria',
};
const dhule: OfficialSource = {
  title: 'District Dhule · Sanjay Gandhi Yojana branch',
  url: 'https://dhule.gov.in/en/sanjay-gandhi-yojana-branch/',
  locator:
    'State schemes · Sanjay Gandhi Niradhar Anudan Yojna · Document Required',
};
const delhi: OfficialSource = {
  title: 'Delhi Department of Women and Child Development',
  url: 'https://wcd.delhi.gov.in/wcd/delhi-pension-scheme-women-distress-widows-divorced-separated-destitute-abandoned-women?page=0',
  locator: 'Widow Pension Scheme · Quantum of assistance',
};
const delhiFaq: OfficialSource = {
  title: 'Delhi WCD · Widow Pension Scheme FAQ',
  url: 'https://wcd.delhi.gov.in/sites/default/files/WCD/circulars-orders/faqwidowpensionscheme.pdf',
  locator: 'What are the eligibility criteria to avail WPS benefits?',
};
const bengal: OfficialSource = {
  title: 'West Bengal Panchayats & Rural Development · NSAP',
  url: 'https://prd.wb.gov.in/schemes/detail/b93d105f-8dd5-4a63-a916-041f2d48ea39',
  locator: 'IGNWPS',
};
const tn: OfficialSource = {
  title: 'Tamil Nadu Revenue Administration · Social Security Pension Schemes',
  url: 'https://cra.tn.gov.in/about_schemes_t.php',
  locator: 'Pension table · Row 5, Destitute Widow Pension Scheme',
};
const tnCharter: OfficialSource = {
  title:
    'Tamil Nadu Social Welfare and Women Empowerment · Citizens’ Charter 2022',
  url: 'https://tnlegalservices.tn.gov.in/swwe/swwe_e_cc_2022.pdf',
  locator: 'Printed p. 131 · §6.5 · Item 5, Documents to be submitted',
};

const widowTerms =
  'widow widows widowhood widowed husband died lost my husband pension विधवा विधवा पेंशन বিধবা বিধবা ভাতা';
const widowGoals = ['widow support', 'pension'];

function evidence(
  layer: NonNullable<Rule['layer']>,
  label: string,
  verb: string,
  target: string,
  passage: string,
  source: OfficialSource,
): Rule {
  return {
    layer,
    label,
    verb,
    target,
    kind: 'Rule',
    evidence: passage,
    keywords: label + ' ' + target,
    source,
  };
}

const nsapProof = [
  evidence(
    'documents',
    'Age evidence',
    'accepts age evidence such as',
    'Birth or school certificate',
    'The guidelines also allow states to consider a ration card or voter ID when those certificates are unavailable, and describe a government medical certificate fallback.',
    nsapApplication,
  ),
  evidence(
    'documents',
    'Widowhood evidence',
    'may need',
    'State-issued widowhood proof',
    'The guidelines describe a state-designated revenue certificate and the use of the husband’s death certificate naming the surviving wife. Confirm what your state accepts.',
    nsapApplication,
  ),
];
const widowPolicy = {
  topic: 'Social support',
  goals: widowGoals,
  keywords: widowTerms,
  fundingType: 'Pension',
} as const;

export const welfarePolicies: Policy[] = [
  {
    ...widowPolicy,
    id: 'ignwps',
    name: 'Indira Gandhi National Widow Pension Scheme',
    keywords: widowTerms + ' ignwps nsap monthly financial assistance bpl',
    versions: [
      {
        id: 'current',
        label: 'Published national rules',
        years: [2025],
        source: nsap,
        summary:
          'Monthly central pension assistance for eligible widows from Below Poverty Line (BPL) households. States and Union Territories administer the programme and may contribute to the amount.',
        rules: [
          evidence(
            'path',
            'State implementation',
            'is administered by',
            'State or Union Territory',
            'States and Union Territories identify beneficiaries under NSAP. The local office can confirm the applicable total and paperwork.',
            nsap,
          ),
          evidence(
            'eligibility',
            'Household and age',
            'serves',
            'Widows aged 40+ in BPL households',
            'The national table sets separate rates for ages 40–79 and age 80 onward. State authorities identify eligible BPL households.',
            nsap,
          ),
          evidence(
            'funding',
            'Ages 40–79',
            'provides a central share of',
            '₹300 per month · ages 40–79',
            'This is the central contribution for eligible widows aged 40–79. See your state’s published total where available.',
            nsap,
          ),
          evidence(
            'funding',
            'Age 80+',
            'lists central assistance of',
            '₹500 per month · age 80+',
            'The national table lists central assistance of ₹500 per month for eligible BPL widows aged 80 and over.',
            nsap,
          ),
          ...nsapProof,
        ],
      },
      {
        id: 'before-2012',
        label: 'Rules before the 2012 revision',
        years: [2011],
        source: nsapEarlier,
        summary:
          'The November 2012 letter records the earlier national rule and its revision. This is a historical snapshot.',
        rules: [
          evidence(
            'path',
            'Historical rate',
            'previously covered',
            'BPL widows aged 40–59',
            'The prior rule in the Ministry’s 2012 letter applied to BPL widows aged 40–59.',
            nsapEarlier,
          ),
          evidence(
            'eligibility',
            'Earlier age band',
            'previously covered',
            'BPL widows aged 40–59',
            'The Ministry’s 2012 letter records this as the earlier age band.',
            nsapEarlier,
          ),
          evidence(
            'funding',
            'Earlier monthly assistance',
            'previously provided',
            '₹200 per month',
            'The 2012 letter increased the earlier ₹200 pension to ₹300 per month and extended the age band.',
            nsapEarlier,
          ),
        ],
      },
    ],
  },
  {
    ...widowPolicy,
    id: 'mh-sanjay-gandhi',
    state: 'Maharashtra',
    name: 'Sanjay Gandhi Niradhar Anudan Yojana',
    versions: [
      {
        id: 'state',
        label: 'Maharashtra department listing',
        years: [],
        source: mh,
        summary:
          'Maharashtra publishes monthly assistance for eligible destitute widows and other listed groups.',
        rules: [
          evidence(
            'path',
            'Apply locally',
            'accepts applications through',
            'Collector, Tehsildar or Talathi office',
            'The department lists these offices and the Sanjay Gandhi Niradhar branch as application points.',
            { ...mh, locator: 'How To Apply' },
          ),
          evidence(
            'eligibility',
            'Widow category',
            'includes',
            'Destitute widows',
            'The state department includes destitute widows among beneficiaries.',
            mh,
          ),
          evidence(
            'eligibility',
            'Means test',
            'requires',
            'BPL listing or family income up to ₹21,000 a year',
            'The state department publishes these alternative means tests.',
            mh,
          ),
          evidence(
            'funding',
            'State payment',
            'provides',
            '₹1,500 per month',
            'The Maharashtra department lists ₹1,500 per month for eligible beneficiaries.',
            { ...mh, locator: 'Benefits' },
          ),
          evidence(
            'documents',
            'District checklist',
            'lists records such as',
            'Age, residence and income certificates',
            'District Dhule lists these records under the state scheme. Confirm the checklist, including any widowhood proof, with your local office.',
            dhule,
          ),
        ],
      },
    ],
  },
  {
    ...widowPolicy,
    id: 'mh-ignwps',
    state: 'Maharashtra',
    name: 'Indira Gandhi National Widow Pension · Maharashtra',
    versions: [
      {
        id: 'state',
        label: 'Maharashtra department listing',
        years: [],
        source: mhWidow,
        summary:
          'Maharashtra publishes a combined state and Central monthly payment for its documented 40–79 age band.',
        rules: [
          evidence(
            'path',
            'State contribution',
            'names a contribution under',
            'Sanjay Gandhi Niradhar Anudan Yojana',
            'The department identifies the state contribution as part of a combined ₹1,500 payment.',
            mhWidow,
          ),
          evidence(
            'eligibility',
            'Household and age',
            'serves',
            'Widows aged 40–79 in BPL households',
            'This is the age band and household category on the Maharashtra scheme page.',
            mhWidow,
          ),
          evidence(
            'funding',
            'Combined amount',
            'lists a combined',
            '₹1,500 per month',
            'The state page gives ₹300 as the Central share and ₹1,200 as the state share. ₹1,500 is the combined figure.',
            { ...mhWidow, locator: 'Eligibility Criteria and Benefits' },
          ),
          ...nsapProof,
        ],
      },
    ],
  },
  {
    ...widowPolicy,
    id: 'delhi-widow',
    state: 'Delhi',
    name: 'Delhi Pension Scheme to Women in Distress',
    versions: [
      {
        id: 'state',
        label: 'Delhi WCD scheme and FAQ',
        years: [],
        source: delhi,
        summary:
          'Delhi’s monthly pension can cover widows and other women in distress who meet its age, residence, income and other conditions.',
        rules: [
          evidence(
            'path',
            'Application route',
            'accepts applications through',
            'Delhi e-District portal',
            'The WCD FAQ describes online registration and how to select the pension service.',
            { ...delhiFaq, locator: 'Procedure for applying' },
          ),
          evidence(
            'eligibility',
            'Applicant and residence',
            'requires',
            'Age 18+ and at least 5 years’ Delhi residence',
            'Delhi includes widows among the covered categories and requires at least five years of residence before application.',
            delhiFaq,
          ),
          evidence(
            'eligibility',
            'Means and pension overlap',
            'requires',
            'Annual income below ₹1 lakh and no overlapping assistance',
            'The WCD FAQ requires income under ₹1 lakh a year and excludes receipt of other assistance for the same purpose. It also lists an Aadhaar and Delhi bank account condition.',
            delhiFaq,
          ),
          evidence(
            'funding',
            'Monthly payment',
            'provides',
            '₹2,500 per month',
            'Delhi WCD lists ₹2,500 per eligible woman per month.',
            delhi,
          ),
          evidence(
            'documents',
            'Widowhood proof',
            'requires',
            'Proof of husband’s death',
            'Delhi WCD lists proof of the husband’s death for the widow category.',
            {
              ...delhiFaq,
              locator: 'Documents required to avail WPS benefits',
            },
          ),
          evidence(
            'documents',
            'Other records',
            'requires records such as',
            'Age, five years’ residence, income declaration and bank records',
            'The FAQ also lists Aadhaar, an Aadhaar-linked single-operated Delhi bank account, a year’s bank records and a photo. Category-specific documents can apply.',
            {
              ...delhiFaq,
              locator: 'Documents required to avail WPS benefits',
            },
          ),
        ],
      },
    ],
  },
  {
    ...widowPolicy,
    id: 'tn-widow',
    state: 'Tamil Nadu',
    name: 'Tamil Nadu Destitute Widow Pension Scheme',
    versions: [
      {
        id: 'state',
        label: 'Revenue Administration rate and published checklist',
        years: [],
        source: tn,
        summary:
          'Tamil Nadu publishes a state-funded pension for destitute widows. Its Citizens’ Charter describes the checklist.',
        rules: [
          evidence(
            'path',
            'Application channel',
            'is available as a service through',
            'Tamil Nadu e-Sevai',
            'The state lists the Destitute Widow Pension Scheme among Revenue Administration services.',
            {
              title: 'Tamil Nadu e-Governance Agency',
              url: 'https://tnesevai.tn.gov.in/Pages/ServiceList.aspx',
              locator:
                'Revenue Administration · Destitute Widow Pension Scheme',
            },
          ),
          evidence(
            'eligibility',
            'Applicant category',
            'covers',
            'Destitute widows aged 18 and above',
            'The 2022 Citizens’ Charter lists age, widowhood, destitution and a fixed-asset test. Check the latest asset threshold with the state office before applying.',
            {
              ...tnCharter,
              locator:
                'Printed p. 131 · §6.5 · Item 4, Eligible persons (2022)',
            },
          ),
          evidence(
            'funding',
            'Monthly payment',
            'lists',
            '₹1,200 per month',
            'The Revenue Administration pension table lists ₹1,200 a month, funded by the state.',
            tn,
          ),
          evidence(
            'documents',
            'Application records',
            'lists',
            'Ration card or Aadhaar, age proof and husband’s death certificate',
            'The 2022 Citizens’ Charter sets out these documents. Check the current e-Sevai checklist before filing.',
            tnCharter,
          ),
        ],
      },
    ],
  },
  {
    ...widowPolicy,
    id: 'wb-widow',
    state: 'West Bengal',
    name: 'Indira Gandhi National Widow Pension · West Bengal',
    versions: [
      {
        id: 'state',
        label: 'West Bengal NSAP pension listing',
        years: [],
        source: bengal,
        summary:
          'West Bengal lists a combined Central and state monthly amount for the 40–79 age band.',
        rules: [
          evidence(
            'path',
            'State payment',
            'is published by',
            'West Bengal Panchayats & Rural Development',
            'The department publishes the state and Central shares of the widow pension.',
            bengal,
          ),
          evidence(
            'eligibility',
            'Household and age',
            'serves',
            'Widows aged 40–79 in BPL households',
            'The state listing names below-poverty-line widow beneficiaries in the 40–79 age band.',
            bengal,
          ),
          evidence(
            'funding',
            'Combined monthly pension',
            'lists a combined',
            '₹1,000 per month',
            'The West Bengal listing gives ₹300 as the Central share and ₹700 as the state share.',
            bengal,
          ),
          ...nsapProof,
        ],
      },
    ],
  },
  {
    id: 'nfbs',
    name: 'National Family Benefit Scheme',
    topic: 'Social support',
    fundingType: 'One-time assistance',
    goals: ['bereavement', 'family income loss'],
    keywords:
      'nfbs breadwinner death spouse died husband died bereavement one time family benefit',
    versions: [
      {
        id: 'current',
        label: 'Published national rules',
        years: [2025],
        source: nsap,
        summary:
          'One-time support for the surviving head of an eligible BPL household after the death of its main breadwinner.',
        rules: [
          evidence(
            'path',
            'Reason for support',
            'responds to',
            'Death of the household’s primary breadwinner',
            'This benefit is tied to the loss of the household’s main earner.',
            nsap,
          ),
          evidence(
            'eligibility',
            'Household and age',
            'requires',
            'BPL household and deceased primary earner aged 18–59',
            'The national table specifies these conditions for the surviving head of the household.',
            nsap,
          ),
          evidence(
            'funding',
            'One-time payment',
            'provides',
            '₹20,000 one time',
            'The Ministry lists a single payment of ₹20,000 for eligible households.',
            nsap,
          ),
          evidence(
            'documents',
            'Example local checklist',
            'lists in Dhule',
            'Death and age certificates, plus household and income records',
            'District Dhule lists these records and a certificate confirming the deceased was the main earner. Check the state checklist where you apply.',
            {
              ...dhule,
              locator: 'National Family Benefit Scheme · Documents Required',
            },
          ),
        ],
      },
    ],
  },
];
