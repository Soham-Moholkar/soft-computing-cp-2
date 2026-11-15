import type { OfficialSource, Policy } from './catalog';

const gigBudget: OfficialSource = {
  title: 'Tamil Nadu Budget 2025–26 · Highlights',
  locator: 'Page 16 · Subsidy for platform-based service workers',
  url: 'https://tnbudget.tn.gov.in/tnweb_files/budget%20highlights/HIGHLIGHTS%20ENG%202025_26.pdf',
};
const gigApply: OfficialSource = {
  title: 'Tamil Nadu Unorganised Workers Welfare Board',
  locator: 'Claims · eScooter Subsidy for Platform-based Gig Workers',
  url: 'https://tnuwwb.tn.gov.in/claims/login',
};
const evAugust: OfficialSource = {
  title: 'Gazette · Ministry of Heavy Industries S.O. 4424(E)',
  locator: '10 August 2026 · Annexure 4 amendment and paragraph 46',
  url: 'https://pmedrive.heavyindustries.gov.in/docs/policy_document/Gazette%20Notification%2010%2008%202026%20on%20enhancement%20of%20Outlay%2011900%20cr.pdf#page=3',
};
const evFacts: OfficialSource = {
  title:
    'Ministry of Heavy Industries / PIB · October 2026 PM E-DRIVE factsheet',
  locator: 'Demand incentives · Registered e-two-wheelers',
  url: 'https://www.pib.gov.in/FactsheetDetails.aspx?id=151062&lang=2&reg=48',
};
const evMarch: OfficialSource = {
  title: 'Gazette · Ministry of Heavy Industries S.O. 1617(E)',
  locator: '27 March 2026 · Annexure 4 and terminal dates',
  url: 'https://pmedrive.heavyindustries.gov.in/docs/policy_document/2026-03-27%20e-rickshaw%20%26%20e-2w%20extension%20notification.pdf#page=3',
};

export const mobilityPolicies: Policy[] = [
  {
    id: 'tn-gig',
    name: 'Tamil Nadu Gig Workers E-Scooter Subsidy',
    topic: 'Small business',
    state: 'Tamil Nadu',
    fundingType: 'Subsidy',
    goals: ['vehicle', 'two-wheeler', 'delivery', 'subsidy'],
    directAssets: ['two-wheeler'],
    assetRestricted: true,
    electricOnly: true,
    keywords:
      'tamil nadu chennai gig platform blinkit zepto swiggy zomato delivery courier rider bike electric scooter motorcycle e scooter online service subsidy বাইক ডেলিভারি',
    versions: [
      {
        id: '2025-26',
        label: '2025–26 budget and official claims portal',
        years: [2025, 2026],
        source: gigBudget,
        summary:
          'An electric-scooter option for registered platform-based workers in Tamil Nadu. The state budget announces a ₹20,000 subsidy, and the Welfare Board provides an official application entry.',
        rules: [
          {
            label: 'Electric vehicle and worker scope',
            verb: 'covers announced support for',
            target: 'New e-scooters for registered Tamil Nadu platform workers',
            kind: 'Rule',
            keywords:
              'blinkit gig delivery bike electric vehicle worker welfare board',
            evidence:
              'The budget highlights specify registered platform-based workers and the purchase of a new e-scooter.',
            source: gigBudget,
          },
          {
            label: 'Budgeted support per worker',
            verb: 'announces',
            target: '₹20,000 per eligible worker',
            kind: 'Rule',
            layer: 'funding',
            keywords: 'amount subsidy grant 20000 money',
            evidence:
              'The 2025–26 budget highlights announced ₹20,000 each for 2,000 internet-based service workers. The Board controls approval.',
            source: gigBudget,
          },
          {
            label: 'Official application route',
            verb: 'lists the claim route for',
            target: 'Welfare Board registration and eScooter subsidy claim',
            kind: 'Rule',
            layer: 'documents',
            keywords: 'documents apply registration',
            evidence:
              'The Welfare Board portal links to new gig-worker registration and the eScooter claim. Open the claim for its document instructions.',
            source: gigApply,
          },
        ],
      },
    ],
  },
  {
    id: 'pmedrive',
    name: 'PM E-DRIVE · Electric Two-Wheeler Incentive',
    topic: 'Small business',
    fundingType: 'Subsidy',
    goals: ['vehicle', 'two-wheeler', 'subsidy'],
    directAssets: ['two-wheeler'],
    assetRestricted: true,
    electricOnly: true,
    keywords:
      'PM E DRIVE pm edrive electric scooter bike delivery vehicle motorcycle ev two wheeler registered subsidy battery dealer इलेक्ट्रिक বাইক',
    versions: [
      {
        id: '2026-08',
        label: '10 August 2026 amendment',
        years: [2026, 2027, 2028],
        source: evAugust,
        summary:
          'An incentive for eligible registered electric two-wheelers. Its effective benefit depends on the approved model, battery capacity and ex-factory price.',
        rules: [
          {
            label: 'Vehicle category',
            verb: 'covers eligible',
            target: 'Registered electric two-wheelers',
            kind: 'Rule',
            keywords: 'bike scooter electric delivery vehicle registered model',
            evidence:
              'Annexure 4 in the August Gazette amends the registered electric two-wheeler row, including the eligible ex-factory price ceiling.',
            source: evAugust,
          },
          {
            label: 'Published incentive rate',
            verb: 'lists',
            target: '₹2,500 per kWh · up to ₹5,000 per vehicle',
            layer: 'funding',
            kind: 'Rule',
            keywords: 'money amount subsidy cap 5000 battery',
            evidence:
              'The October 2026 factsheet lists the rate and vehicle cap. The Gazette also limits the amount to the lower applicable ceiling, including 15% of ex-factory price.',
            source: evFacts,
          },
          {
            label: 'Model approval',
            verb: 'publishes approved models in',
            target: 'PM E-DRIVE model approval register',
            kind: 'Rule',
            layer: 'documents',
            keywords: 'documents apply dealer approved model',
            evidence:
              'Check the official approval register for the particular model and its certification validity before purchase.',
            source: {
              title: 'PM E-DRIVE · Model Approval',
              locator: 'Registered e-two-wheeler model table',
              url: 'https://pmedrive.heavyindustries.gov.in/models/205/e-2W',
            },
          },
          {
            label: 'Fund limit',
            verb: 'sets a terminal date of',
            target: '31 March 2028, subject to funds',
            kind: 'Rule',
            keywords: 'date deadline fund exhausted 2028',
            evidence:
              'The August amendment sets the terminal date and allows earlier closure if funds are exhausted.',
            source: evAugust,
          },
        ],
      },
      {
        id: '2026-03',
        label: '27 March 2026 amendment · earlier snapshot',
        years: [],
        source: evMarch,
        summary:
          'The March amendment listed an earlier terminal date for e-two-wheelers. Compare it with the August amendment for the updated document.',
        rules: [
          {
            label: 'Fund limit',
            verb: 'then listed a terminal date of',
            target: '31 July 2026 for registered e-two-wheelers',
            kind: 'Rule',
            keywords: 'old deadline date earlier',
            evidence:
              'The March amendment lists 31 July 2026 for this vehicle segment.',
            source: evMarch,
          },
        ],
      },
    ],
  },
];
