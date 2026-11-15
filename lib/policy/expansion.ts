import type { OfficialSource, Policy, Rule } from './catalog';

const ref = (title: string, url: string, locator: string): OfficialSource => ({
  title,
  url,
  locator,
});
const rule = (
  label: string,
  verb: string,
  target: string,
  evidence: string,
  keywords: string,
  source: OfficialSource,
  layer: Rule['layer'] = 'path',
): Rule => ({
  label,
  verb,
  target,
  evidence,
  keywords,
  source,
  layer,
  kind: 'Rule',
});

const transport = ref(
  'KVIC · Revised PMEGP guidelines',
  'https://www.kviconline.gov.in/pmegpeportal/dashboard/notification/Revised_PMEGP_Scheme_Guidelines_07122023_compressed.pdf',
  'Eligibility conditions · Transport activities',
);
const pmegpRates = ref(
  'Ministry of MSME · PMEGP Scheme Booklet 2025–26',
  'https://dcmsme.gov.in/SAMACHAR/MSMESchemebooklet2025-26.pdf',
  'PMEGP · Financial assistance and margin money',
);
const pmegpForm = ref(
  'KVIC · PMEGP standard application form',
  'https://www.kviconline.gov.in/pmegpeportal/jsp/RegionalLanguageforms/Final%20English_Version.pdf#page=4',
  'Page 4 · Self-attested documents checklist',
);
const pmegpLive = ref(
  'Ministry of MSME / PIB · FY 2026–27 PMEGP disbursements',
  'https://www.pib.gov.in/PressReleasePage.aspx?PRID=2329819&lang=1&reg=3',
  '2026–27 release · Bank-sanctioned loans and margin money',
);
const tnAuto = ref(
  'Tamil Nadu Labour Welfare · 2025–26 policy note',
  'https://labour.tn.gov.in/pdf/policy_note_lwsd_e_pn_2025_26.pdf',
  '§1.4.4 · Subsidy for the purchase of new auto-rickshaws',
);
const tnAutoForm = ref(
  'Tamil Nadu Unorganised Workers Welfare Board · Auto subsidy application',
  'https://tnuwwb.tn.gov.in/docs/Auto_board_subsidy_application_form.pdf',
  'Applicant details, bank details and supporting form',
);
const wbCurrent = ref(
  'Government of West Bengal · Bhabishyat Credit Card',
  'https://wb.gov.in/government-schemes-details-bhabisyat.aspx',
  'Key Benefits and Application Process · State portal updated July 2025',
);
const wbGazette = ref(
  'Kolkata Gazette · West Bengal Bhabishyat Credit Card notification',
  'https://msme.wb.gov.in/sites/all/themes/anonymous/pdf/notification_msmet_credit_card.pdf',
  '30 March 2023 · Sections 8, 11 and 12',
);
const svmcmApply = ref(
  'West Bengal SVMCM portal · Application procedure',
  'https://svmcm.wb.gov.in/page/application_procedure.php',
  'Step 3 · Fresh applications and renewals',
);
const svmcmEarlier = ref(
  'West Bengal Higher Education · SVMCM 2022–23 notice',
  'https://svmcm.wb.gov.in/readwrite/svmcm_Adv_23.pdf',
  'Historical notice · Scholarship rates table and documents',
);
const maha = ref(
  'MahaDBT · Rajarshi Shahu Maharaj fees scheme, MCAER',
  'https://mahadbt.maharashtra.gov.in/SchemeData/SchemeData?str=E9DDFA703C38E51AF93663E6569EFD2493B74079C9D4BC045DDEC4D398AED1BA',
  'MCAER scheme · Benefits, Eligibility and Documents Required',
);
const yasasvi = ref(
  'Ministry of Social Justice · Top Class College Education 2023–24 letter',
  'https://www.socialjustice.gov.in/writereaddata/UploadFile/28901703762769.pdf',
  '15 December 2023 · Award structure and eligible categories',
);
const yasasviAnnex = ref(
  'Ministry of Social Justice · Top Class College fresh scholarship proforma',
  'https://socialjustice.gov.in/writereaddata/UploadFile/95641707199689.pdf',
  'Annexure A · Fee, living, books and computer components',
);
const yasasviIndex = ref(
  'Ministry of Social Justice · PM-YASASVI scheme documents',
  'https://socialjustice.gov.in/schemes/101',
  'Top Class College Education for OBC, EBC and DNT',
);

const transportRule = rule(
  'Transport scope',
  'lists examples of',
  'Eligible public or tourist transport projects',
  'The revised guideline lists cab, van and boat examples and identifies a transport-project allocation ceiling, with regional exceptions. Verify the exact vehicle and activity with the implementing agency.',
  'auto bike taxi vehicle transport rickshaw delivery passenger',
  transport,
);
const pmegpDocs = rule(
  'Applicant documents',
  'lists',
  'Photos, identity, education certificate and project report',
  'The application checklist names photos, Aadhaar, education and project report. It also lists caste, rural-area and training certificates for the circumstances described in the application.',
  'documents requirements project identity caste report education',
  pmegpForm,
  'documents',
);
const pmegpMoney: Rule[] = [
  {
    ...rule(
      'General category · Urban',
      'publishes a margin-money rate of',
      '15% of eligible project cost',
      'The official booklet lists 15% for general category projects in urban areas.',
      'subsidy amount urban general',
      pmegpRates,
      'funding',
    ),
    calculation: { rate: 0.15, maxProject: 2000000 },
  },
  {
    ...rule(
      'General category · Rural',
      'publishes a margin-money rate of',
      '25% of eligible project cost',
      'The official booklet lists 25% for general category projects in rural areas.',
      'subsidy amount rural general',
      pmegpRates,
      'funding',
    ),
    calculation: { rate: 0.25, maxProject: 2000000 },
  },
  {
    ...rule(
      'Special category · Urban',
      'publishes a margin-money rate of',
      '25% of eligible project cost',
      'The official booklet lists 25% for special category projects in urban areas.',
      'subsidy amount urban special women SC ST',
      pmegpRates,
      'funding',
    ),
    calculation: { rate: 0.25, maxProject: 2000000 },
  },
  {
    ...rule(
      'Special category · Rural',
      'publishes a margin-money rate of',
      '35% of eligible project cost',
      'The official booklet lists 35% for special category projects in rural areas.',
      'subsidy amount rural special women SC ST',
      pmegpRates,
      'funding',
    ),
    calculation: { rate: 0.35, maxProject: 2000000 },
  },
];

export const expandedPolicies: Policy[] = [
  {
    id: 'pmegp',
    name: 'Prime Minister’s Employment Generation Programme',
    topic: 'Small business',
    fundingType: 'Loan + subsidy',
    goals: ['business', 'vehicle', 'credit', 'subsidy'],
    keywords:
      'PMEGP microenterprise new business first time income earn livelihood passenger transport vehicle employment venture margin money subsidy going self employed project service',
    similar: ['mudra'],
    versions: [
      {
        id: '2026',
        label: '2026–27 implementation and published rates',
        years: [2026, 2027],
        source: pmegpLive,
        summary:
          'Bank-linked margin-money subsidy for eligible new microenterprises. Transport projects are a conditional lead. Check the vehicle and business model before assuming coverage.',
        rules: [
          transportRule,
          rule(
            'Funding mechanism',
            'links subsidy to',
            'Bank-sanctioned new enterprise project loan',
            'The FY 2026–27 release describes margin-money support on sanctioned project loans.',
            'loan business new enterprise subsidy grant',
            pmegpLive,
          ),
          ...pmegpMoney,
          pmegpDocs,
        ],
      },
      {
        id: '2023',
        label: '2023 revised programme guidelines',
        years: [2023, 2024, 2025],
        source: transport,
        summary:
          'The earlier revised guidelines describe transport examples and the programme’s conditions for new microenterprises.',
        rules: [transportRule, pmegpDocs],
      },
    ],
  },
  {
    id: 'tn-auto',
    name: 'Tamil Nadu Auto-Rickshaw Purchase Subsidy',
    topic: 'Small business',
    state: 'Tamil Nadu',
    fundingType: 'Subsidy',
    goals: ['vehicle', 'three-wheeler', 'subsidy'],
    directAssets: ['three-wheeler'],
    assetRestricted: true,
    keywords:
      'auto rickshaw three wheeler electric cng lpg purchase subsidy women female transgender driver tamil nadu welfare board vehicle ऑटो रिक्शा',
    versions: [
      {
        id: '2025-26',
        label: '2025–26 Labour Welfare policy note',
        years: [2025, 2026],
        source: tnAuto,
        summary:
          'Tamil Nadu’s policy note describes a purchase subsidy for new electric, CNG or LPG auto-rickshaws for women and transgender unorganised drivers. Check with the Board for the application round.',
        rules: [
          rule(
            'Named vehicle types',
            'covers purchases of',
            'New electric, CNG or LPG auto-rickshaws',
            'The state policy note lists these three fuel types and describes a target group of women and transgender unorganised drivers.',
            'auto rickshaw three wheeler commercial purchase',
            tnAuto,
          ),
          rule(
            'Published subsidy',
            'provides',
            '₹1,00,000 purchase subsidy',
            'Section 1.4.4 publishes this amount for the stated driver group and new vehicles.',
            'amount subsidy money rupees 100000',
            tnAuto,
            'funding',
          ),
          rule(
            'Driver group',
            'targets',
            'Women and transgender unorganised drivers',
            'The state policy note identifies women and transgender unorganised drivers. The linked registration form is specifically the women-driver form.',
            'woman transgender eligibility driver',
            tnAuto,
          ),
          rule(
            'Published women-driver form',
            'requests',
            'Driver details, income certificate, quotation and passbook copy',
            'The Board’s women-driver form asks for driver and registration information, a bank passbook copy, an original income certificate and an original vehicle quotation.',
            'licence registration proof documents bank passbook',
            tnAutoForm,
            'documents',
          ),
        ],
      },
    ],
  },
  {
    id: 'wb-credit',
    name: 'West Bengal Bhabishyat Credit Card',
    topic: 'Small business',
    state: 'West Bengal',
    fundingType: 'Loan + subsidy',
    goals: ['business', 'credit', 'subsidy'],
    keywords:
      'bhabishyat credit card small business startup shops entrepreneurship self employment west bengal kolkata business plan service ব্যবসা ভবিষ্যৎ ক্রেডিট',
    versions: [
      {
        id: '2025',
        label: 'July 2025 state portal guidance',
        years: [2025, 2026],
        source: wbCurrent,
        summary:
          'A West Bengal programme for eligible entrepreneurs including small service providers. Confirm with the state programme whether your specific business activity is accepted.',
        rules: [
          rule(
            'Business categories',
            'covers eligible',
            'Manufacturing, services, trading and agro-based ventures',
            'The state portal lists these activity groups. It specifies West Bengal permanent residence and bank processing.',
            'business service entrepreneur start delivery transport bike',
            wbCurrent,
          ),
          rule(
            'Published loan ceiling',
            'lists a loan ceiling of',
            'Up to ₹5 lakh',
            'The state portal publishes a loan ceiling of ₹5 lakh per beneficiary and describes margin-money and interest subsidy separately.',
            'grant loan amount funding',
            wbCurrent,
            'funding',
          ),
          rule(
            'Application documents',
            'lists',
            'Aadhaar, domicile proof, income certificate and business proposal',
            'The state portal’s application instructions list these examples.',
            'documents proof identity income proposal',
            wbCurrent,
            'documents',
          ),
        ],
      },
      {
        id: '2023',
        label: '30 March 2023 Gazette notification',
        years: [2023, 2024],
        source: wbGazette,
        summary:
          'The original applicable notification lists a project-cost ceiling and the capital subsidy formula for that document version.',
        rules: [
          rule(
            'Published project ceiling',
            'limits documented project cost to',
            '₹5 lakh',
            'Section 11 caps project cost at ₹5 lakh in the 2023 notification.',
            'project loan amount',
            wbGazette,
            'funding',
          ),
          {
            ...rule(
              'Published margin-money formula',
              'sets subsidy to',
              '10% of project cost, capped at ₹25,000',
              'Section 12(a) defines this formula in the Gazette version.',
              'subsidy margin money grant amount',
              wbGazette,
              'funding',
            ),
            calculation: { rate: 0.1, cap: 25000, maxProject: 500000 },
          },
        ],
      },
    ],
  },
  {
    id: 'svmcm',
    name: 'Swami Vivekananda Merit-cum-Means Scholarship',
    topic: 'Education',
    state: 'West Bengal',
    fundingType: 'Scholarship',
    goals: ['scholarship', 'college', 'school'],
    keywords:
      'svmcm vivekananda scholarship college bengal kanyashree madhyamik income marks higher secondary রাজ্য পশ্চিমবঙ্গ বৃত্তি স্কলারশিপ',
    versions: [
      {
        id: '2025',
        label: '2025 application procedure',
        years: [2025, 2026],
        source: svmcmApply,
        summary:
          'West Bengal’s official portal describes how to make fresh and renewal applications. It points applicants to its guidelines for course-level eligibility.',
        rules: [
          rule(
            'Fresh application documents',
            'requests',
            'Mark sheets, admission receipt, domicile proof and bank passbook',
            'Step 3 also lists a family income certificate for applicants outside the Kanyashree exception.',
            'documents marksheet admission proof income',
            svmcmApply,
            'documents',
          ),
          rule(
            'Renewal documents',
            'requires',
            'Current course marks and next-class admission receipt',
            'The renewal checklist asks for the last examination mark sheet and advancement admission receipt.',
            'renewal documents marksheet admission',
            svmcmApply,
            'documents',
          ),
        ],
      },
      {
        id: '2022-23',
        label: '2022–23 published scholarship rates',
        years: [2022, 2023],
        source: svmcmEarlier,
        summary:
          'This dated notice records historical monthly rates by course, with a separate table for school, undergraduate, postgraduate and professional levels.',
        rules: [
          rule(
            'Higher-secondary rate in this notice',
            'lists',
            '₹1,000 per month',
            'The higher-secondary row in the 2022–23 notice lists ₹1,000 monthly. The course-specific rows differ.',
            'amount school historical monthly',
            svmcmEarlier,
            'funding',
          ),
          rule(
            'Undergraduate science rate in this notice',
            'lists',
            '₹1,500 per month',
            'The undergraduate science row in the 2022–23 notice lists ₹1,500 monthly.',
            'amount graduation science historical monthly',
            svmcmEarlier,
            'funding',
          ),
        ],
      },
    ],
  },
  {
    id: 'maha-shahu-mcaer',
    name: 'Rajarshi Shahu Maharaj Fee Scholarship · MCAER',
    topic: 'Education',
    state: 'Maharashtra',
    fundingType: 'Fee reimbursement',
    goals: ['scholarship', 'college'],
    keywords:
      'mahadbt shahu maharaj ebc mcaer agricultural education agricultural college Maharashtra tuition cap fees scholarship agriculture महाराष्ट्र शुल्क छात्रवृत्ति',
    versions: [
      {
        id: 'portal',
        label: 'MahaDBT · MCAER scheme profile',
        years: [],
        source: maha,
        summary:
          'This MahaDBT record is specifically the MCAER scheme. The profile ties the fee benefit to its domicile, income, institution and centralised admission requirements.',
        rules: [
          rule(
            'Fee components',
            'lists reimbursement of',
            '100% of tuition and exam fees',
            'The MCAER Benefits section lists full tuition and exam-fee reimbursement for qualifying students.',
            'fee amount tuition exam 100 percent reimbursement',
            maha,
            'funding',
          ),
          rule(
            'Core conditions',
            'checks',
            'Maharashtra domicile, CAP admission and family income up to ₹8 lakh',
            'The eligibility section identifies domicile, institution and admission conditions and the income limit.',
            'eligibility domicile cap family income',
            maha,
          ),
          rule(
            'Document checklist',
            'lists',
            'Mark sheets, domicile and income certificates, CAP documents',
            'MahaDBT also lists a family undertaking and biometric attendance evidence under the MCAER entry.',
            'documents income domicile certificate cap marksheet',
            maha,
            'documents',
          ),
        ],
      },
    ],
  },
  {
    id: 'yasasvi-college',
    name: 'PM-YASASVI · Top Class College Education',
    topic: 'Education',
    fundingType: 'Scholarship',
    goals: ['scholarship', 'college'],
    keywords:
      'yasasvi obc ebc dnt student tuition fees laptop books government college scholarship assistance पिछड़ा वर्ग छात्रवृत्ति',
    versions: [
      {
        id: 'index',
        label: 'Ministry programme document index',
        years: [],
        source: yasasviIndex,
        summary:
          'The ministry groups Top Class College Education for OBC, EBC and DNT students under PM-YASASVI. Open the ministry’s scheme page for its listed documents and check the relevant academic year.',
        rules: [
          rule(
            'Scheme component',
            'includes',
            'Top Class College Education for OBC, EBC and DNT',
            'The ministry lists college education as a separate component under the umbrella scheme.',
            'college obc ebc dnt student eligibility',
            yasasviIndex,
          ),
        ],
      },
      {
        id: '2023-24',
        label: '2023–24 implementation letter and proforma',
        years: [2023, 2024],
        source: yasasvi,
        summary:
          'This dated implementation letter describes supported tuition and non-refundable charges, living expenses, books and computer assistance.',
        rules: [
          rule(
            'Private-sector tuition ceiling',
            'lists tuition support up to',
            '₹2 lakh per year',
            'The 2023–24 letter gives a private-sector ceiling with a separate limit for specified flying clubs.',
            'tuition fees amount college',
            yasasvi,
            'funding',
          ),
          rule(
            'One-time computer assistance',
            'limits the computer line to',
            '₹45,000 one time',
            'The fresh application proforma separately lists living expenses, books and one-time computer assistance.',
            'laptop computer amount books assistance',
            yasasviAnnex,
            'funding',
          ),
        ],
      },
    ],
  },
];
