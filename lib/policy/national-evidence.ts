import type { EvidenceLayer, Rule, Version } from './catalog';

type Claim = [target: string, evidence: string, locator: string, url?: string];
const nsp = 'https://scholarships.gov.in/public/schemeGuidelines/';
const aicte = nsp + 'AICTE/';
export const nationalEvidence = new Map<string, Version>();

function add(
  name: string,
  url: string,
  funding: Claim,
  eligibility: Claim,
  documents: Claim | undefined,
  application?: Claim,
) {
  const makeRule = (
    layer: EvidenceLayer,
    claim: Claim,
    label: string,
    verb: string,
  ): Rule => ({
    layer,
    label,
    verb,
    target: claim[0],
    evidence: claim[1],
    kind: 'Rule',
    keywords: claim[0],
    source: {
      title: name + ' · Official guidance',
      url: claim[3] ?? url,
      locator: claim[2],
    },
  });
  nationalEvidence.set(name, {
    id: 'official',
    label: 'Published programme guidance',
    years: [],
    source: {
      title: name + ' · Official guidance',
      url,
      locator: 'Guidelines',
    },
    summary:
      'The graph shows the funding, eligibility and application records described in the linked official guidance.',
    rules: [
      makeRule('funding', funding, 'Published benefit', 'provides'),
      makeRule(
        'eligibility',
        eligibility,
        'Published eligibility',
        'has conditions for',
      ),
      ...(documents
        ? [makeRule('documents', documents, 'Application records', 'lists')]
        : []),
      ...(application
        ? [makeRule('path', application, 'Official application route', 'uses')]
        : []),
    ],
  });
}

for (const course of [
  {
    name: 'Degree',
    lower: 'degree',
    max: 4,
    pragati: '2010',
    saksham: '2012',
    swanath: '3039',
  },
  {
    name: 'Diploma',
    lower: 'diploma',
    max: 3,
    pragati: '2011',
    saksham: '2013',
    swanath: '3038',
  },
]) {
  const urlFor = (id: string, type = 'G') =>
    aicte + 'AICTE_' + id + '_' + type + '.pdf';
  const amount: Claim = [
    '₹50,000 per year of study',
    'The guidelines list this annual lump sum and a maximum of ' +
      course.max +
      ' years for a student admitted to first year. Later entry or later-year application can shorten the award.',
    'Amount of scholarship',
  ];
  add(
    'AICTE Pragati Scholarship for Girl Students in Technical ' +
      course.name +
      ' Courses',
    urlFor(course.pragati),
    amount,
    [
      'Girl students in approved technical ' + course.lower + ' courses',
      'The guidance covers first-year or second-year lateral admission in an AICTE-approved course, with up to two girls in a family and family income up to ₹8 lakh a year.',
      'Eligibility for scholarship',
    ],
    [
      'Academic marksheets, institutional proof and income certificate',
      'The FAQ lists marksheets and admission evidence for the relevant entry route, a current income certificate, and additional records where applicable.',
      'FAQ Q22 · Documents to upload',
      urlFor(course.pragati, 'F'),
    ],
  );
  add(
    'AICTE Saksham Scholarship for Students with Disabilities in Technical ' +
      course.name +
      ' Courses',
    urlFor(course.saksham),
    amount,
    [
      'Students with at least 40% disability',
      'The scheme includes first-year or second-year lateral admission in an AICTE-approved ' +
        course.lower +
        ' course and requires family income up to ₹8 lakh a year.',
      'Eligibility for scholarship',
    ],
    [
      'Academic records, income and disability proof',
      'The FAQ lists records for the candidate’s entry route, an annual family income certificate, disability verification and other specified documents.',
      'FAQ Q22 · Documents to upload',
      urlFor('2013', 'F'),
    ],
  );
  add(
    'AICTE Swanath Scholarship for Technical ' + course.name + ' Students',
    urlFor(course.swanath),
    amount,
    [
      'Technical ' + course.lower + ' students in listed family circumstances',
      'The published categories include orphans, certain COVID-19 bereavements, wards of personnel martyred in action, and specified cases of critical illness, death or severe disability from an accident. Regular approved study, family income up to ₹8 lakh, and the scholarship overlap restriction also apply.',
      '§2 · Eligibility for scholarship',
    ],
    [
      'Bonafide certificate, marksheets and proof for the applicant category',
      'The published checklist separates orphan, bereavement and other categories. Some categories need death certificates or a prescribed authority certificate. Follow the row matching your circumstances.',
      '§10 · Documents to be uploaded on NSP',
    ],
  );
}

add(
  'PM-USP Special Scholarship Scheme for Jammu, Kashmir and Ladakh',
  aicte + 'PM_USPY%28SSSJKL%29SchemeSpecifications.pdf',
  [
    '₹1 lakh annual maintenance plus course-specific fee support',
    'The maintenance rate applies across streams under the published terms. Academic fees are subject to separate stream ceilings.',
    '§5 · Disbursement of scholarship',
  ],
  [
    'Eligible Jammu & Kashmir or Ladakh students with family income up to ₹8 lakh',
    'The guidelines specify domicile, where the qualifying examination was passed, recognised admissions and separate lateral-entry conditions.',
    '§6–7 · Eligibility and exclusions',
  ],
  [
    'Domicile, academic results, family income and applicable category proof',
    'The original-document checklist includes academic, domicile and income records and lists additional certificates where applicable.',
    'Annexure · Original documents required',
  ],
);

add(
  'Ishan Uday Special Scholarship Scheme for North Eastern Region',
  nsp + 'Guidelines_ISHAN%20UDAY_2324.pdf',
  [
    '₹8,000 per month for 10 months',
    'The UGC guidelines state this amount for ten months per academic year, subject to selection and continuation terms.',
    'P. 2 · Number and value of scholarships',
  ],
  [
    'Eligible undergraduate students with North Eastern Region domicile',
    'The guidance includes first-year undergraduate admission, domicile and parental income below ₹4.5 lakh a year. It excludes management quota admissions.',
    'Pp. 2–3 · Eligibility',
  ],
  [
    'Domicile or permanent-resident certificate and income certificate',
    'The relevant institution verifies certificates, including domicile and income records, under the published process.',
    'P. 4 · Verification, item VII',
  ],
);

add(
  'NEC Merit Scholarship for Higher Professional Courses in the North Eastern Region',
  'https://necouncil.gov.in/sites/default/files/2026-03/NEC_Merit%20Guidelines.pdf',
  [
    '₹20,000–₹30,000 annually depending on course level',
    'The published rates are ₹20,000 for diploma, ₹22,000 for degree, ₹25,000 for postgraduate study, and ₹30,000 for M.Phil. or Ph.D.',
    '§7.1 · Rates by level',
  ],
  [
    'Permanent residents of North Eastern states on recognised courses',
    'The guidelines set a family income ceiling of ₹8 lakh, require marks for the relevant level and set conditions on other financial assistance.',
    '§3.1–3.8 · Eligibility conditions',
  ],
  [
    'Permanent residence or Sikkim identification certificate, income, and academic proof',
    'The list identifies the issuing authorities and mandatory records. Renewal additionally requires progress or examination evidence as applicable.',
    '§4.3 and §6.2 · Documents and renewal',
  ],
);

add(
  'Central Sector Scholarship of Top Class Education for SC Students',
  nsp + 'Top_Class_Education_Scheme_2018.pdf',
  [
    'Fee support plus ₹86,000 first-year academic allowance',
    'The guidance lists ₹41,000 in later years and sets a ₹2 lakh annual fee ceiling per student at private institutions.',
    'P. 3 · Funding and pattern of assistance',
  ],
  [
    'SC students in eligible full-time courses at notified institutions',
    'Applicants must meet the family-income limit and qualify under the institution and slot rules. The guidelines describe ranking and reserved slots.',
    'Pp. 1–2 · Eligibility',
  ],
  [
    'Income and caste certificates, bank and admission information',
    'The application section calls for uploading the certificates and entering bank details, admission rank and course information on NSP.',
    'P. 3 · Application and verification',
  ],
);

add(
  'Free Coaching for SC, OBC and PM CARES for Children Beneficiaries',
  nsp + 'guid_3108.pdf',
  [
    '₹4,000 monthly stipend for up to 12 months plus eligible coaching fees',
    'The guidance gives course-wise fee ceilings and separately states a conditional incentive for successful candidates in certain coaching categories.',
    'P. 6 · Quantum of assistance',
  ],
  [
    'Eligible SC, OBC and PM CARES for Children candidates',
    'The guidelines state an ₹8 lakh annual family-income ceiling for SC and OBC candidates and an exemption from income and caste restrictions for PM CARES beneficiaries. Course and academic requirements apply.',
    'Pp. 2–3 · Eligibility',
  ],
  [
    'Income evidence for SC/OBC applicants',
    'The income section describes proof for employed and self-employed parents or guardians. PM CARES applicants have a different eligibility route.',
    'P. 2 · Income Certificate and PM CARES categories',
  ],
);

add(
  "Prime Minister's Scholarship Scheme for Ministry of Railways",
  nsp + 'MORB_GL.pdf',
  [
    '₹2,500 a month for male students or ₹3,000 for female students',
    'The Railways guidelines list these monthly rates and describe the payment period.',
    'P. 3 · Amount of scholarship',
  ],
  [
    'Eligible wards or widows of RPF/RPSF personnel studying approved professional courses',
    'The Railways guidelines define service categories and preference order, and require at least 60% in the minimum entry qualification for initial sanction.',
    'Pp. 2–4 · Eligibility and minimum entry qualification',
  ],
  [
    'Service or discharge records and academic records, depending on category',
    'The checklist varies across personnel categories and fresh or renewal applications. It includes the service or discharge evidence specified for the category.',
    'P. 4 · §10.1, Documents required',
  ],
);

for (const scheme of [
  {
    name: 'Pre-Matric Scholarship for Students with Disabilities',
    slug: 'scholership-schemes-pre-matric',
    amount: '₹500 for day scholars or ₹800 for hostellers per month',
    benefit:
      'The guide lists support for twelve months, an annual ₹1,000 book grant, and a disability allowance of ₹2,000–₹4,000 per year.',
    cohort: 'Class IX or X students with benchmark disabilities',
    requirements:
      'The department specifies at least 40% disability, Indian nationality and household income up to ₹2.5 lakh per year, with a restriction on concurrent scholarships.',
  },
  {
    name: 'Post-Matric Scholarship for Students with Disabilities',
    slug: 'scholarship-post-matric',
    amount: 'Up to ₹1.5 lakh in published fee components',
    benefit:
      'The department guide lists up to ₹1.4 lakh for tuition/admission fees and up to ₹10,000 for other fees, with separate disability and book allowances.',
    cohort:
      'Class XI, XII and eligible diploma, degree or postgraduate students',
    requirements:
      'The department specifies at least 40% disability, Indian nationality and household income up to ₹2.5 lakh per year, with a restriction on concurrent scholarships.',
  },
  {
    name: 'Scholarship for Top Class Education for Students with Disabilities',
    slug: 'scholarship-top-class-fellowship',
    amount: '₹1,500 or ₹3,000 monthly maintenance, depending on residence',
    benefit:
      'The department lists ₹1,500 for day scholars and ₹3,000 for hostellers. It also describes separate components for fees, books, disability allowance, computers and assistive devices.',
    cohort: 'Students with benchmark disabilities in notified institutions',
    requirements:
      'The department specifies at least 40% disability, Indian nationality, eligible graduate or postgraduate study or a diploma, and family income up to ₹8 lakh per year.',
  },
]) {
  add(
    scheme.name,
    'https://depwd.gov.in/en/' + scheme.slug + '/',
    [scheme.amount, scheme.benefit, 'Financial support and monthly support'],
    [scheme.cohort, scheme.requirements, 'Who can apply? and Must have'],
    [
      'UDID and Aadhaar cards',
      'The department’s guide lists these records. Check the application checklist for additional records, including institutional verification.',
      'Must have',
    ],
  );
}

const isec =
  'https://www.msme.gov.in/offerings/schemes-and-services/details/prime-minister-employment-generation-programme-and-other-credit-support-schemes-1-MDMzETMtQWa';
add(
  'Interest Subsidy Eligibility Certificate (ISEC)',
  isec,
  [
    '4% annual interest on eligible working-capital credit',
    'The Ministry describes a concessional interest rate and says the Central Government pays the difference to the lending banks through KVIC.',
    'ISEC · Nature of assistance',
  ],
  [
    'Registered Khadi institutions with a valid certificate and sanctioned programme',
    'The Ministry limits this route to eligible Khadi and polyvastra institutions registered with KVIC or a state board.',
    'ISEC · Who can apply?',
  ],
  [
    'KVIC-issued Interest Subsidy Eligibility Certificate',
    'The institution submits the certificate to its financing bank with its working-capital request.',
    'ISEC · How to apply?',
  ],
  [
    'Financing bank',
    'The institution applies to its financing bank, which processes the eligible working-capital request.',
    'ISEC · How to apply?',
  ],
);

const coirForms = 'https://coirboard.gov.in/?page_id=162';
add(
  'Revamped Scheme Of Fund for Regeneration Of Traditional Industries (SFURTI)',
  'https://sfurti.msme.gov.in/WriteReadData/Circular/SFURTI_NEW.pdf',
  [
    'Up to ₹5 crore per approved cluster project',
    'The revised guidelines set a project ceiling and differentiate limits by cluster category and intervention. The support is for the project.',
    'Financial assistance and per-cluster budget limit',
  ],
  [
    'Traditional-industry clusters through eligible implementing agencies',
    'The Nodal Agency checks the proposed cluster, implementing agency and artisans against the revised guidelines.',
    'Proposal appraisal and financial assistance',
  ],
  [
    'Concept note, supporting records and detailed project report',
    'The revised guidelines describe a concept review followed by preparation of the detailed project report in the prescribed format.',
    'Proposal appraisal and Annexure 7',
  ],
);
add(
  'Skill Upgradation & Mahila Coir Yojana (MCY)',
  'https://coirboard.gov.in/wp-content/uploads/2018/03/mcy.pdf',
  [
    'Up to ₹3,000 a month for eligible skill-development trainees',
    'The operational guidelines set this limit and prorate shorter training. They distinguish stipendiary field training from some in-house orientation programmes.',
    '§4.1.2–4.1.3 · Skill Upgradation',
  ],
  [
    'Rural women artisans in coconut-husk processing regions',
    'This is the target group named for the Mahila Coir training component. The wider skill programme has separate training categories.',
    '§4.3 · Mahila Coir Yojana',
  ],
  [
    'Candidate photographs and eligible records through the training agency',
    'The operational guidelines describe the sponsoring agency submitting candidate records and bank information to the local office.',
    '§4.1 · Sponsoring agency and candidate records',
  ],
);
add(
  'Development Of Production Infrastructure (DPI)',
  'https://my.msme.gov.in/MyMsmeMob/MsmeScheme/Pages/1_3_5_2.html',
  [
    'Published 25% project subsidy with unit-specific ceilings',
    'The Ministry’s scheme summary lists different caps for defibering, spinning and other unit types. Check the current guideline for eligible costs and project size.',
    'Nature of assistance',
  ],
  [
    'New coir-processing units registered with the Coir Board and DIC',
    'The Ministry summary specifies these registrations and gives project-cost conditions. Check the current Coir Board guidelines before applying.',
    'Who can apply',
  ],
  [
    'Prescribed claim form and DIC production commencement certificate',
    'The scheme summary lists the certificate and specifies a six-month application window from production commencement under the published rules.',
    'How to apply',
  ],
);
add(
  'Domestic Market Promotion Scheme',
  'https://my.msme.gov.in/MyMsmeMob/MsmeScheme/Pages/1_3_5_5.html',
  [
    'Published 10% of qualifying average annual turnover',
    'The Ministry summary uses average eligible coir sales in the preceding three financial years, subject to funding. It describes Central and state cost sharing.',
    'Nature of assistance',
  ],
  [
    'Listed coir cooperatives, public enterprises and Coir Board outlets',
    'The published beneficiaries include apex, central and primary cooperative societies in the coir sector.',
    'Who can apply',
  ],
  [
    'Coir Board Market Development Assistance application form',
    'The Ministry directs applicants to the Coir Board office or website for the prescribed form. Ask the office about current supporting documents.',
    'How to apply',
  ],
);
add(
  'MSME Market Development Assistance (MDA)',
  'https://my.msme.gov.in/MyMsmeMob/MsmeScheme/Pages/1_3_2.html',
  [
    '20% of eligible production cost in the published MDA design',
    'The Ministry summary gives a 25:30:45 split among artisans, producing institutions and selling institutions. Confirm which version applies before claiming.',
    'Nature of assistance',
  ],
  [
    'Khadi institutions in specified grades with valid Khadi certification',
    'The published grades are A+, A, B and C. Funding is tied to approved production targets.',
    'Who can apply',
  ],
  [
    'Quarterly production claim and audited accounts',
    'The Ministry states that producing institutions claim against actual output and that the annual adjustment is based on audited accounts.',
    'How to apply',
  ],
);
add(
  'Export Market Promotion',
  'https://my.msme.gov.in/MyMsmeMob/MsmeScheme/Pages/1_3_5_0.html',
  [
    'Assistance for specified export-promotion activities',
    'The Coir Board programme covers selected participation and promotion activities. Consult the relevant call and claim form for the rate or cap.',
    'Description and Nature of assistance',
  ],
  [
    'Eligible coir enterprises and exporters',
    'The Ministry description identifies eligible MSMEs and exporters in the coir sector. The activity and call determine the application route.',
    'Description',
  ],
  [
    'Activity-specific external market development assistance form',
    'The Coir Board lists a form for buyer–seller meetings, delegations, fairs and eligible promotional materials.',
    'External Market Development Assistance forms',
    coirForms,
  ],
);

const mhaScholarship =
  'https://www.mha.gov.in/sites/default/files/2023-01/PMSSrevisedguidelines_23112020%5B1%5D%5B1%5D_0.pdf';
const mhaAward: Claim = [
  '₹2,500 a month for male students or ₹3,000 for female students',
  'The revised Ministry guidelines set these monthly rates from the 2019–20 academic year onward.',
  'Cover letter §2 · Revised amount',
];
add(
  "Prime Minister's Scholarship Scheme for Wards of States and UTs Police Personnel Martyred During Terror or Naxal Attacks",
  mhaScholarship,
  mhaAward,
  [
    'Eligible wards of State or UT police personnel martyred in terror or Naxal attacks',
    'The revised guidelines define this category and set conditions for eligible first professional degree courses.',
    '§4(ii) and §8(C) · Applicant categories and courses',
  ],
  [
    'Certificate from the relevant state government',
    'The fresh-application checklist requires a government certificate identifying the circumstances in which the officer was killed.',
    '§8(E) · Fresh applicant under §4(ii)',
  ],
);
add(
  "Prime Minister's Scholarship Scheme for Central Armed Police Forces and Assam Rifles",
  mhaScholarship,
  mhaAward,
  [
    'Eligible wards and widows of CAPF or Assam Rifles personnel',
    'The guideline sets service categories and conditions for first professional degree courses. This is an education scholarship.',
    '§4(i) and §8(C) · Applicant categories and courses',
  ],
  [
    'Academic marksheet and applicable service, discharge, death or disability records',
    'The official checklist varies by service category. It lists marksheets and additional certificates for fresh applicants.',
    '§8(E) · Fresh applicant under §4(i)',
  ],
);
add(
  'National Means-cum-Merit Scholarship',
  nsp + 'NMMSSGuidelines.pdf',
  [
    '₹12,000 per year for selected students',
    'Awards begin in Class IX. Continuation through Class XII depends on satisfying the scheme conditions.',
    'NMMSS · Amount and continuation',
  ],
  [
    'Eligible Class VIII students at government, aided or local-body schools',
    'The Ministry states a parental-income limit of ₹3.5 lakh a year. Applicants must meet entry marks and take the state or union territory selection test.',
    'Eligibility criteria and selection of fresh awardees',
  ],
  [
    'State-specific income and category evidence',
    'The Odisha guidelines provide a concrete example: current income evidence and category or disability proof where applicable. Check your state’s selection-test notice.',
    'Documents to be submitted by the candidate',
    'https://nmms.odisha.gov.in/public/assets/guidlines/GUIDELINES_NMMS_E_2025.pdf',
  ],
);
add(
  'National Fellowship and Scholarship for Higher Education of ST Students',
  nsp + 'tribalfellowshipguideline.pdf',
  [
    'Eligible fee support and ₹3,000 monthly stipend under the scholarship component',
    'The scholarship table describes eligible institutional fees and a living stipend. This entry covers the scholarship component listed on NSP.',
    'P. 6 · Scholarship components',
  ],
  [
    'Eligible ST students at notified institutions',
    'The scholarship is for eligible students admitted to listed institutes and subject to its family-income limit.',
    'Scholarship component · Eligibility and selection',
  ],
  [
    'ST certificate, income evidence and admission or fee details',
    'The institute verifies the applicant’s ST and income evidence and fee details. Some categories also need additional evidence.',
    'Scholarship component · Documents and institute verification',
  ],
);
add(
  'A Scheme for Promoting Innovation, Rural Industry & Entrepreneurship (ASPIRE)',
  'https://aspire.msme.gov.in/WriteReadData/DocumentFile/ASPIRE_NEW.pdf',
  [
    'Up to ₹1 crore for eligible incubator operating expenditure under the published 2021–26 guidelines',
    'The operational guidelines define eligible incubator costs. This amount is institutional funding. The official portal provides information on new applications.',
    '§8.2 · Operational expenditure',
  ],
  [
    'Eligible host institutions proposing a Livelihood Business Incubator',
    'This route supports institutions that operate an incubator for rural enterprise. Consult the registration route and host-institution requirements.',
    'Host institution and LBI framework',
  ],
  [
    'Advance receipt, mandate form and undertaking or bond for fund release',
    'The fund-release procedure lists these forms and any additional documents required by the Ministry.',
    '§9.4 · Fund release to the LBI',
    'https://aspire.msme.gov.in/WriteReadData/DocumentFile/ASPIRE_New_21112023.pdf',
  ],
  [
    'ASPIRE registration portal',
    'The Ministry currently provides a registration form for Livelihood Business Incubators.',
    'ASPIRE Registration Form',
    'https://aspire.msme.gov.in/ASPIRE/Registration.aspx',
  ],
);

const ministryMobile = 'https://my.msme.gov.in/MyMsmeMob/MsmeScheme/Pages/';
add(
  'Performance and Credit Rating Scheme',
  ministryMobile + '1_2_0.html',
  [
    '75% of the rating fee up to a turnover-based limit',
    'The published limits are ₹25,000, ₹30,000 or ₹40,000 depending on the enterprise turnover band.',
    'Nature of assistance · Reimbursement table',
  ],
  [
    'Registered micro and small enterprises in India',
    'The Ministry lists enterprises registered as micro or small.',
    'Who can apply',
  ],
  [
    'Prescribed rating application',
    'Submit the prescribed form to NSIC or an empanelled rating agency under the published process.',
    'How to apply',
  ],
);
add(
  'Credit Linked Capital Subsidy for Technology Upgradation',
  'https://my.msme.gov.in/MyMsme/Reg/COM_ClcssAppForm.aspx',
  [
    '15% of eligible capital costs up to ₹15 lakh',
    'The legacy CLCSS application page ties the subsidy to institutional finance and eligible approved machinery, with a ₹1 crore machinery investment ceiling.',
    'Description · CLCSS',
  ],
  [
    'Eligible micro or small industrial units using institutional finance',
    'The description includes specified khadi, village and coir units using the scheme for approved technology upgrades.',
    'Description · Beneficiaries',
  ],
  [
    'Completed CLCSS application submitted by the lending institution',
    'The portal describes the lender uploading the application for nodal-agency recommendation. Ask the lender which records apply.',
    'How to apply',
  ],
);
add(
  'Marketing Support/Assistance to MSMEs (Bar Code)',
  ministryMobile + 'ssub_0.html',
  [
    '75% of eligible GS1 fees',
    'The historical rules cover 75% of the one-time registration fee and 75% of eligible annual recurring fees for the first three years.',
    'Nature of assistance',
  ],
  [
    'Eligible micro and small enterprises registered with GS1 India',
    'The published vintage also specifies the former EM-II registration.',
    'Who can apply',
  ],
  [
    'Prescribed bar-code fee reimbursement form and supporting formats',
    'The Ministry summary directs applicants to the MSME Development Institute for the forms and supporting records.',
    'How to apply',
  ],
);
add(
  'Technology and Quality Upgradation Support to MSMEs',
  ministryMobile + 'ssub_7.html',
  [
    '25% of eligible energy-efficiency project costs',
    'The programme also listed separate assistance for energy audits, project reports, and certain licensing expenses, each with its own rules.',
    'Nature of assistance',
  ],
  [
    'Eligible MSMEs undertaking the relevant technology or quality intervention',
    'The applicant depends on the intervention. Technology projects have separate financing and contribution rules, and licensing support is for manufacturing MSMEs.',
    'Nature of assistance and Who can apply',
  ],
  [
    'Annexure IV application for fee reimbursement',
    'The Ministry summary directs the applicant to submit the form and supporting records to the relevant Development Institute.',
    'How to apply',
  ],
);
add(
  'Entrepreneurial and Managerial Development of SMEs through Incubators',
  ministryMobile + 'ssub_1.html',
  [
    '₹4–8 lakh per incubatee or idea in the archived design',
    'The Ministry summary states a ₹62.5 lakh aggregate ceiling for idea support per business incubator and describes other institutional components separately.',
    'Nature of assistance',
  ],
  [
    'Individuals or MSMEs with an idea near commercialisation',
    'The published scheme sends applicants to a host institution. Technical institutions apply separately when a call is released.',
    'Who can apply',
  ],
  [
    'Host-institution application or proposal under the relevant call',
    'The Ministry describes the host institution’s proposal route and where individuals or MSMEs take their idea.',
    'How to apply',
  ],
);
add(
  'Enabling Manufacturing Sector to be Competitive through QMS&QTT',
  ministryMobile + 'ssub_2.html',
  [
    '₹2.5 lakh per eligible unit for a diagnostic and implementation component',
    'The scheme describes cost sharing and separate amounts for training, studies and other interventions.',
    'Nature of assistance',
  ],
  [
    'Eligible MSEs, clusters, expert agencies and technical institutions',
    'The source lists eligible bodies for different interventions and describes the Development Commissioner’s selection of clusters.',
    'Who can apply',
  ],
  [
    'Cluster proposal through the Development Commissioner’s office',
    'The Ministry’s published application section directs MSEs and clusters to that office. Confirm the required documents for the specific intervention.',
    'How to apply',
  ],
);
add(
  'Building Awareness on Intellectual Property Rights (IPR)',
  ministryMobile + 'ssub_3.html',
  [
    'Up to ₹25,000 for a domestic patent or ₹2 lakh for a foreign patent under this guidance',
    'These are the figures in the archived awareness programme. Other interventions had separate limits.',
    'Nature of assistance',
  ],
  [
    'Registered Indian MSMEs for the patent support component',
    'Expert agencies and other organisations may apply for separately listed activities.',
    'Who can apply and Nature of assistance',
  ],
  [
    'Component-specific application form',
    'The published route sends the application from the relevant scheme form to an MSME Development Institute.',
    'How to apply',
  ],
);
add(
  'Marketing Assistance & Technology Upgradation (MATU)',
  ministryMobile + 'ssub_6.html',
  [
    'Up to ₹45,000 for an eligible corporate-governance intervention',
    'That example is limited to 50% of eligible expenditure. Packaging, training, marketing hubs and certification have separate terms.',
    'Nature of assistance',
  ],
  [
    'Eligible MSMEs and clusters for their respective components',
    'The Ministry summary distinguishes firms, clusters and the bodies named in individual calls.',
    'Who can apply and Nature of assistance',
  ],
  [
    'Application or reimbursement claim in the prescribed format',
    'The Ministry summary directs applicants to their Regional MSME Development Institute with the documents required for that component.',
    'How to apply',
  ],
);
add(
  'Assistance to Training Institutions (ATI)',
  ministryMobile + '0_3_1.html',
  [
    'Infrastructure assistance up to ₹150 lakh under the published design',
    'The scheme summary caps ordinary support at 50% of project cost. Specified northeastern and island jurisdictions have a ₹270 lakh or 90% ceiling, whichever is lower.',
    'Nature of assistance',
  ],
  [
    'Eligible training institutions and entrepreneurship-development bodies',
    'This is institutional infrastructure or programme support. Only bodies meeting the published scheme criteria can apply.',
    'Who can apply',
  ],
  [
    'Institution’s application for infrastructure support',
    'The published summary identifies the Ministry office receiving applications. The relevant institutional call specifies supporting records.',
    'How to apply',
  ],
);
add(
  'International Cooperation',
  'https://ic.msme.gov.in/IC_APP/WriteReadData/GuideLine/MDAGuidelines_2024.pdf',
  [
    'Published ceilings of ₹1.5 lakh for airfare and ₹3 lakh for stall rent per eligible unit',
    'The linked event guidelines specify actual-cost reimbursement up to each ceiling and eligibility conditions. Check the guideline and notice for your event.',
    '§3.2.1 · Physical-mode events',
  ],
  [
    'Eligible MSME delegations applying through qualifying organisations',
    'The official portal identifies industry associations, export promotion councils and government organisations for relevant calls.',
    'Official calls · Who may apply',
    'https://www.ic.msme.gov.in/IC_APP/IC_Welcome.aspx',
  ],
  [
    'Online proposal, event budget estimate and supporting records',
    'The applicant organisation submits an itemised budget with the relevant documents for screening.',
    '§3.1 · Assessment of financial assistance',
  ],
);
add(
  'Market Promotion & Development Scheme (MPDA)',
  'https://msme.gov.in/sites/default/files/Khadi_MPDA_Guidelines.pdf',
  [
    '30% of eligible prime cost in the linked Modified MDA guidelines',
    'The initial guidance describes assistance linked to Khadi and Polyvastra production. The guideline specifies allocation among institutions and artisans.',
    'Calculation of Modified MDA and distribution',
  ],
  [
    'Eligible Khadi and Polyvastra production institutions and linked artisans',
    'The producing institution files the claim under the guideline, which sets shares for spinners, weavers and other artisans.',
    'Eligible production and distribution of Modified MDA',
  ],
  [
    'Quarterly claim through the KVIC online system',
    'The guidance specifies quarterly claim filing and describes the subsequent settlement and auditing process.',
    'Submission and settlement of claims',
  ],
);
add(
  'Financial Support to MSMEs in ZED Certification Scheme',
  'https://zed.msme.gov.in/faqs',
  [
    'Certification subsidy of 80% for micro, 60% for small or 50% for medium enterprises',
    'The official incentives page also lists additional category-specific subsidies and terms for a joining reward. These are certification incentives.',
    'Subsidy on Cost of ZED Certification',
    'https://zed.msme.gov.in/benefitsincentives',
  ],
  [
    'Eligible Udyam-registered manufacturing MSMEs',
    'The published FAQ specifies Udyam registration and discusses manufacturing-sector coverage.',
    'FAQ 14 and 21–22 · Coverage and registration',
  ],
  [
    'Udyam registration number and registered mobile number',
    'The portal FAQ lists these for registration. Further verification may be needed for a certification application.',
    'FAQ · Registration process',
  ],
);
add(
  'Lean Manufacturing Competitiveness for MSMEs',
  'https://lean.msme.gov.in/Home/Eligibility',
  [
    '90% subsidy on eligible implementation consultant fees',
    'The current Competitive Lean portal describes this assistance and separate terms for applications through an association or OEM.',
    'Financial Assistance for MSME Units',
    'https://lean.msme.gov.in/Home/FinancialAssistance',
  ],
  [
    'Udyam-registered MSMEs and specified common facilities centres',
    'The current Competitive Lean portal includes eligible centres under SFURTI and the MSE cluster development programme.',
    'Coverage & Eligibility',
  ],
  [
    'Udyam registration number, registered mobile and lean coordinator details',
    'The registration guide lists these records and the work flow through the implementing agency.',
    'How to register',
    'https://lean.msme.gov.in/Home/Howtoregister',
  ],
);

for (const name of [
  'Performance and Credit Rating Scheme',
  'Development Of Production Infrastructure (DPI)',
  'Credit Linked Capital Subsidy for Technology Upgradation',
  'Marketing Support/Assistance to MSMEs (Bar Code)',
  'Technology and Quality Upgradation Support to MSMEs',
  'Entrepreneurial and Managerial Development of SMEs through Incubators',
  'Enabling Manufacturing Sector to be Competitive through QMS&QTT',
  'Building Awareness on Intellectual Property Rights (IPR)',
  'Marketing Assistance & Technology Upgradation (MATU)',
  'MSME Market Development Assistance (MDA)',
  'Domestic Market Promotion Scheme',
]) {
  const version = nationalEvidence.get(name)!;
  version.label = 'Earlier programme guidance';
  version.summary =
    'The graph describes an earlier published programme design. Confirm the applicable version and whether the administering agency is accepting applications.';
}

const coirSchemes = 'https://coirboard.gov.in/?page_id=221';
add(
  'Coir Vikas Yojana (CVY)',
  'https://coirboard.gov.in/?page_id=8452',
  [
    'Subsidy varies by activity, in the Coir Board’s published design',
    'For the production infrastructure component the Board lists a 25% subsidy on eligible facilities or equipment. Different types of units have different ceilings. Modernisation has a separately published limit.',
    'Financial Assistance Schemes · Production infrastructure',
  ],
  [
    'Eligible coir enterprises and other applicants by component',
    'The Board distinguishes infrastructure, training, and other types of assistance. An applicant must follow the rules for the relevant component.',
    'Financial Assistance Schemes',
  ],
  [
    'Component-specific Coir Board claim or registration forms',
    'The Board publishes separate application and claim forms for new units, modernisation, training and other support.',
    'Forms & Guidelines · Development of Production Infrastructure',
    coirForms,
  ],
);
add(
  'Science and Technology Scheme',
  coirSchemes,
  [
    'Technical assistance, testing and incubation services',
    'The published Coir Board scheme describes support delivered through research institutes. The linked service description gives no general cash amount for applicants.',
    'Central Sector Scheme of Science and Technology · Nature of assistance',
  ],
  [
    'Coir workers, manufacturers, entrepreneurs and research organisations',
    'The Board describes service access for industry and worker applicants and a research-proposal route for eligible organisations.',
    'Central Sector Scheme of Science and Technology · How to apply',
  ],
  [
    'Research project proposal for collaborative research',
    'Universities, research organisations and government institutions can submit a collaborative research proposal. For technical services, the Board directs applicants to its research centres.',
    'Central Sector Scheme of Science and Technology · How to apply',
  ],
);
add(
  'Trade and Industry Related Functional Support Services (TIRFSS)',
  ministryMobile + '1_3_5_4.html',
  [
    'Training, export information and industry studies',
    'The scheme summary describes services. It gives no individual cash rate.',
    'Nature of assistance',
  ],
  [
    'Coir workers and new entrepreneurs for training',
    'These groups can use the human-resource development programmes described in the scheme summary.',
    'Who can apply',
  ],
  undefined,
  [
    'Regional Coir Board offices',
    'The Ministry directs workers and entrepreneurs to regional offices for training programmes. Its summary gives no document checklist.',
    'How to apply',
  ],
);
add(
  'Marketing Assistance Scheme',
  'https://msme.gov.in/sites/default/files/MASCHEME-New-181120141.pdf',
  [
    '25%–95% of stall space charges under the published domestic exhibition schedule',
    'The guideline gives category-specific subsidy percentages. The amount depends on enterprise size, beneficiary category and activity. Check the NSIC notice for your event.',
    '§4.2.1 · Domestic exhibition space charges',
  ],
  [
    'Eligible manufacturing and service MSMEs',
    'The Maharashtra MSME Commissionerate lists Udyam registration and describes additional routes for industry bodies and organisations.',
    'Important Eligibility Conditions',
    'https://s3fd5a3f16c2001a93d9d64a1ec1d6196e.s3waas.gov.in/scheme/nsic-marketing-assistance-scheme/',
  ],
  [
    'Udyam certificate, business details, bank details and event forms',
    'The Maharashtra Commissionerate lists these and additional event-specific records.',
    'Documents Required',
    'https://s3fd5a3f16c2001a93d9d64a1ec1d6196e.s3waas.gov.in/scheme/nsic-marketing-assistance-scheme/',
  ],
);
