export type Topic =
  | 'Education'
  | 'Small business'
  | 'Food access'
  | 'Social support';
export type LinkKind =
  | 'Rule'
  | 'Restriction'
  | 'Allocation'
  | 'Programme link'
  | 'Revision';
export type EvidenceLayer = 'path' | 'eligibility' | 'funding' | 'documents';
export interface Rule {
  layer?: EvidenceLayer;
  calculation?: { rate: number; cap?: number; maxProject: number };
  label: string;
  subject?: string;
  verb: string;
  target: string;
  kind: LinkKind;
  evidence: string;
  keywords: string;
  source?: OfficialSource;
}
export interface OfficialSource {
  title: string;
  url: string;
  locator: string;
}
export interface Version {
  id: string;
  label: string;
  years: number[];
  summary: string;
  source: OfficialSource;
  rules: Rule[];
}
export interface Policy {
  state?: string;
  directAssets?: readonly ('three-wheeler' | 'two-wheeler')[];
  assetRestricted?: boolean;
  electricOnly?: boolean;
  listingOnly?: boolean;
  fundingType?:
    | 'Loan'
    | 'Subsidy'
    | 'Loan + subsidy'
    | 'Scholarship'
    | 'Fee reimbursement'
    | 'Pension'
    | 'One-time assistance';
  goals?: readonly string[];
  id: string;
  name: string;
  topic: Topic;
  keywords: string;
  versions: Version[];
  similar?: string[];
}
const vendorWelfare = {
  title: 'MoHUA / PIB · SVANidhi se Samriddhi',
  url: 'https://www.pib.gov.in/PressReleasePage.aspx?PRID=1816139&lang=2&reg=48',
  locator: 'Convergence with eight schemes',
};
const earlierVendor = {
  title: 'MoHUA · PM SVANidhi beneficiary FAQ',
  url: 'https://www.mohua.gov.in/upload/uploadfiles/files/FAQ-PM-SAVNidhi-English.pdf',
  locator: 'Question 1 · Initial working capital loan',
};
const vendorRevision = {
  title: 'Union Cabinet / PIB · PM SVANidhi restructuring',
  url: 'https://www.pib.gov.in/PressReleasePage.aspx?PRID=2161157&lang=1&reg=3',
  locator: '27 August 2025 · Revised loan structure',
};
const mudraRevision = {
  title: 'Ministry of Finance / PIB · MUDRA loan limit and categories',
  url: 'https://www.pib.gov.in/PressReleasePage.aspx?PRID=2069170&lang=2&reg=3',
  locator: '29 October 2024 · Tarun Plus and loan categories',
};
export const policies: Policy[] = [
  {
    id: 'svanidhi',
    fundingType: 'Loan',
    goals: ['street vending', 'credit'],
    name: 'PM SVANidhi',
    topic: 'Small business',
    similar: ['mudra'],
    keywords:
      'svanidhi street vendor cart hawker street vending working capital loan old first tranche रेहड़ी पटरी ठेला स्वनिधि',
    versions: [
      {
        id: '2025',
        label: '2025 Cabinet restructuring',
        years: [2025],
        source: vendorRevision,
        summary:
          'The 2025 Cabinet decision raised the first two loan tranches for street vendors and extended the lending period.',
        rules: [
          {
            label: 'First tranche',
            layer: 'funding',
            verb: 'raises first loan to',
            target: 'Up to ₹15,000',
            kind: 'Revision',
            keywords: 'first tranche 15000 old limit amount',
            evidence:
              'The Cabinet increased the first tranche from ₹10,000 to ₹15,000.',
          },
          {
            label: 'Second tranche',
            layer: 'funding',
            verb: 'raises second loan to',
            target: 'Up to ₹25,000',
            kind: 'Revision',
            keywords: 'second tranche 25000 amount',
            evidence:
              'The Cabinet increased the second tranche from ₹20,000 to ₹25,000.',
          },
          {
            label: 'Third tranche',
            layer: 'funding',
            verb: 'keeps third loan at',
            target: 'Up to ₹50,000',
            kind: 'Rule',
            keywords: 'third tranche 50000 amount',
            evidence:
              'The Cabinet announcement left the third tranche at ₹50,000.',
          },
          {
            label: 'Lending period',
            verb: 'extends lending through',
            target: '31 March 2030',
            kind: 'Revision',
            keywords: 'deadline lending period extension 2030',
            evidence:
              'The Cabinet announcement extended the lending period to 31 March 2030. That date describes the lending period.',
          },
          {
            label: 'Links to welfare schemes',
            verb: 'connects vendors through',
            target: 'SVANidhi se Samriddhi',
            kind: 'Programme link',
            keywords:
              'ration onorc other schemes welfare convergence jan dhan links affects',
            evidence:
              'The convergence programme profiles beneficiaries and their households and facilitates access to schemes for which they are eligible.',
            source: vendorWelfare,
          },
        ],
      },
      {
        id: 'earlier',
        label: 'Earlier loan structure',
        years: [2020, 2021, 2022, 2023, 2024],
        source: earlierVendor,
        summary:
          'The earlier beneficiary FAQ describes an initial working-capital loan of up to ₹10,000. The 2025 Cabinet announcement documents the increase.',
        rules: [
          {
            label: 'First tranche',
            layer: 'funding',
            verb: 'offered first loan up to',
            target: '₹10,000',
            kind: 'Rule',
            keywords: 'old previous original first tranche 10000 2020 2024',
            evidence:
              'The earlier MoHUA beneficiary FAQ lists an initial working-capital loan of up to ₹10,000 for a one-year tenure.',
          },
          {
            label: 'Second tranche',
            layer: 'funding',
            verb: 'offered second loan up to',
            target: 'Up to ₹20,000',
            kind: 'Rule',
            keywords: 'old previous second tranche 20000',
            evidence:
              'The 2025 Cabinet announcement gives ₹20,000 as the second-tranche ceiling before restructuring.',
            source: vendorRevision,
          },
          {
            label: 'Third tranche',
            layer: 'funding',
            verb: 'offered third loan up to',
            target: 'Up to ₹50,000',
            kind: 'Rule',
            keywords: 'old previous third tranche 50000',
            evidence:
              'The Cabinet announcement says the third tranche was unchanged at ₹50,000.',
            source: vendorRevision,
          },
        ],
      },
    ],
  },
  {
    id: 'mudra',
    fundingType: 'Loan',
    goals: ['vehicle', 'business', 'credit', 'equipment'],
    directAssets: ['three-wheeler'],
    name: 'Pradhan Mantri MUDRA Yojana',
    topic: 'Small business',
    similar: ['svanidhi'],
    keywords:
      'mudra pmmy business small business microenterprise start expand entrepreneur shishu kishore tarun finance loans auto rickshaw three wheeler commercial vehicle passenger transport tuk tuk e rickshaw मुद्रा छोटा कारोबार व्यवसाय ऑटो रिक्शा',
    versions: [
      {
        id: '2024',
        label: 'Tarun Plus · effective 24 Oct 2024',
        years: [2024],
        source: mudraRevision,
        summary:
          'MUDRA covers eligible microenterprise activities. Its Tarun Plus category is for borrowers who successfully repaid a previous Tarun loan.',
        rules: [
          {
            label: 'Commercial auto-rickshaw',
            verb: 'covers loans for',
            target: 'Commercial auto-rickshaws and e-rickshaws',
            kind: 'Rule',
            keywords:
              'buy auto rickshaw commercial transport three wheeler cab passenger vehicle taxi e rickshaw चालक ऑटो रिक्शा',
            evidence:
              'The Government of India’s PMMY coverage note names autos, e-rickshaws and other small vehicles for commercial use.',
            source: {
              title: 'Government of India · PMMY coverage',
              url: 'https://www.pib.gov.in/PressReleasePage.aspx?PRID=2249942&lang=2&reg=48',
              locator: 'PMMY Coverage · Commercial transport vehicles',
            },
          },
          {
            label: 'Business equipment',
            verb: 'covers finance for',
            target: 'Equipment and machinery for income-generating micro units',
            kind: 'Rule',
            keywords:
              'sewing machine tailoring equipment tools machinery shop business',
            evidence:
              'The official PMMY coverage note includes equipment finance for micro units and loans for income-generating services.',
            source: {
              title: 'Government of India · PMMY coverage',
              url: 'https://www.pib.gov.in/PressReleasePage.aspx?PRID=2249942&lang=2&reg=48',
              locator: 'PMMY Coverage · Equipment finance',
            },
          },
          {
            label: 'Indicative lender checklist',
            verb: 'commonly asks applicants for',
            target: 'ID, address, photo, vehicle quotation and business plan',
            kind: 'Rule',
            layer: 'documents',
            keywords:
              'required documents application papers vehicle quotation business plan identity address ID',
            evidence:
              'The Maharashtra MSME Commissionerate lists identity and address evidence, photos, a vehicle quotation, and a project report or business plan as common documents. The lender can request additional documents for the proposal.',
            source: {
              title: 'Commissionerate of MSME, Maharashtra · PMMY guide',
              url: 'https://s3fd5a3f16c2001a93d9d64a1ec1d6196e.s3waas.gov.in/scheme/pradhan-mantri-mudra-yojana-pmmy/',
              locator: 'Documents required · Commonly requested documents',
            },
          },
          {
            label: 'Shishu',
            layer: 'funding',
            subject: 'MUDRA Shishu',
            verb: 'offers loans up to',
            target: '₹50,000',
            kind: 'Rule',
            keywords: 'start small business shishu first beginner 50000',
            evidence:
              'The published MUDRA categories list Shishu loans of up to ₹50,000.',
          },
          {
            label: 'Kishore',
            layer: 'funding',
            subject: 'MUDRA Kishore',
            verb: 'covers loans above ₹50,000 through',
            target: '₹5 lakh',
            kind: 'Rule',
            keywords: 'kishore kishor category expand',
            evidence: 'Kishore covers loans above ₹50,000 and up to ₹5 lakh.',
          },
          {
            label: 'Tarun',
            layer: 'funding',
            subject: 'MUDRA Tarun',
            verb: 'covers loans above ₹5 lakh through',
            target: '₹10 lakh',
            kind: 'Rule',
            keywords: 'tarun 10 lakh',
            evidence: 'Tarun covers loans above ₹5 lakh and up to ₹10 lakh.',
          },
          {
            label: 'Tarun Plus amount',
            layer: 'funding',
            subject: 'MUDRA Tarun Plus',
            verb: 'lists up to',
            target: '₹20 lakh for eligible repeat Tarun borrowers',
            kind: 'Restriction',
            keywords: 'tarun plus amount 20 lakh cash funding',
            evidence:
              'Tarun Plus is above ₹10 lakh through ₹20 lakh and requires successful repayment of an earlier Tarun loan.',
          },
          {
            label: 'Tarun Plus',
            subject: 'MUDRA Tarun Plus',
            verb: 'requires',
            target: 'Previously repaid Tarun loan',
            kind: 'Restriction',
            keywords:
              'tarun plus repeat first previous repayment repay 20 lakh 2000000',
            evidence:
              'Tarun Plus covers loans above ₹10 lakh through ₹20 lakh for applicants who successfully repaid a previous Tarun loan.',
          },
        ],
      },
      {
        id: 'earlier',
        label: 'Pre–Tarun Plus loan structure',
        years: [2015, 2020, 2021, 2022, 2023],
        source: mudraRevision,
        summary:
          'The October 2024 announcement describes the previous overall MUDRA ceiling as ₹10 lakh.',
        rules: [
          {
            label: 'Highest published loan category',
            layer: 'funding',
            verb: 'previously capped loans at',
            target: '₹10 lakh',
            kind: 'Rule',
            keywords: 'previous old 10 lakh before tarun plus',
            evidence:
              'The Ministry of Finance describes ₹10 lakh as the ceiling before the increase that took effect on 24 October 2024.',
          },
        ],
      },
    ],
  },
  {
    id: 'csss',
    fundingType: 'Scholarship',
    goals: ['scholarship', 'college'],
    name: 'PM-USP College Scholarship (CSSS)',
    topic: 'Education',
    keywords:
      'student university college study scholarship csss pm usp family income marks percentile stipend fee reimbursement reservation category seats slots छात्रवृत्ति कॉलेज विद्यार्थी छात्र आरक्षण',
    versions: [
      {
        id: '2025-26',
        label: '2025–26 academic-year FAQ',
        years: [2025, 2026],
        summary:
          'The Ministry of Education FAQ lists the rules for a fresh college scholarship application in 2025–26, including marks, family income and limits on receiving other scholarships.',
        source: {
          title: 'Ministry of Education · PM-USP CSSS 2025–26 FAQ',
          url: 'https://www.education.gov.in/sites/upload_files/mhrd/files/upload_document/FAQs_PM_USP2526.pdf',
          locator: 'Questions 1–2 · Eligibility and selection',
        },
        rules: [
          {
            label: 'Class XII merit',
            verb: 'requires',
            target: 'Above 80th percentile for the relevant stream and board',
            kind: 'Rule',
            keywords: 'marks percentile high 12 class merit college eligible',
            evidence:
              'For fresh applications, the FAQ requires Class XII results above the 80th percentile in the relevant stream and examination board.',
          },
          {
            label: 'Family income',
            verb: 'sets annual family income limit at',
            target: '₹4.5 lakh',
            kind: 'Rule',
            keywords:
              'family income poor income limit low salary 450000 eligibility',
            evidence:
              'The 2025–26 FAQ specifies annual family income up to ₹4.5 lakh for a fresh application.',
          },
          {
            label: 'Other scholarships',
            verb: 'restricts concurrent awards with',
            target: 'Other scholarships or fee reimbursement',
            kind: 'Restriction',
            keywords:
              'state scholarship other scholarship already receiving both combine another fee waiver reimbursement double funding',
            evidence:
              'Fresh applicants must meet the FAQ condition about receiving no other scholarship or fee reimbursement.',
          },
          {
            label: 'Undergraduate award rate',
            layer: 'funding',
            verb: 'lists',
            target: '₹12,000 per year for the first three undergraduate years',
            kind: 'Rule',
            keywords: 'rate amount scholarship money undergraduate funding',
            evidence:
              'Question 3 in the 2025–26 FAQ lists this annual rate and separately describes postgraduate and specified technical-course rates.',
            source: {
              title: 'Ministry of Education · PM-USP CSSS 2025–26 FAQ',
              url: 'https://www.education.gov.in/sites/upload_files/mhrd/files/upload_document/FAQs_PM_USP2526.pdf',
              locator: 'Question 3 · Scholarship rate',
            },
          },
          {
            label: 'Official application route',
            layer: 'documents',
            verb: 'uses',
            target:
              'National Scholarship Portal registration and supporting documents',
            kind: 'Rule',
            keywords: 'apply documents OTR registration scholarship portal',
            evidence:
              'Questions 11–15 describe OTR and the National Scholarship Portal application. Open the relevant year’s notice for its document checklist.',
            source: {
              title: 'Ministry of Education · PM-USP CSSS 2025–26 FAQ',
              url: 'https://www.education.gov.in/sites/upload_files/mhrd/files/upload_document/FAQs_PM_USP2526.pdf',
              locator: 'Questions 11–15 · Registration and application',
            },
          },
          {
            label: 'Vacant scholarship slots',
            subject: 'Unfilled fresh scholarship slots',
            verb: 'can be redistributed across',
            target: 'Categories, gender and state quotas',
            kind: 'Allocation',
            keywords:
              'category reservation unfilled slots seats transfer redistribution sc obc st gender state quota',
            evidence:
              'If applications fall short, the 2025–26 FAQ allows cross-category, gender and state-quota use of eligible vacant slots under its selection rules.',
          },
        ],
      },
      {
        id: '2024-25',
        label: '2024–25 academic-year FAQ',
        years: [2024],
        summary:
          'The 2024–25 FAQ lists fresh application and merit-list conditions for that academic year.',
        source: {
          title: 'Ministry of Education · PM-USP CSSS 2024–25 FAQ',
          url: 'https://www.education.gov.in/sites/upload_files/mhrd/files/upload_document/FAQs_PM_USP_CSSS_scheme.pdf',
          locator: 'Questions 1–2 · Eligibility and merit list',
        },
        rules: [
          {
            label: 'Family income',
            verb: 'sets annual family income limit at',
            target: '₹4.5 lakh',
            kind: 'Rule',
            keywords: 'family income income limit',
            evidence:
              'The 2024–25 FAQ lists annual family income up to ₹4.5 lakh among the eligibility conditions.',
          },
          {
            label: 'Other scholarships',
            verb: 'restricts concurrent awards with',
            target: 'Other scholarships or fee reimbursement',
            kind: 'Restriction',
            keywords: 'other scholarship both already receiving reimbursement',
            evidence:
              'The 2024–25 FAQ requires applicants to be free of other scholarship or fee reimbursement benefits.',
          },
        ],
      },
    ],
  },
  {
    id: 'onorc',
    name: 'One Nation One Ration Card',
    topic: 'Food access',
    keywords:
      'onorc ration portability moved state food workers migration existing card राशन दूसरे राज्य वन नेशन',
    versions: [
      {
        id: '2024',
        label: '2024 TPDS amendment',
        years: [2024],
        source: {
          title: 'DFPD · TPDS Second Amendment Order, 2024',
          url: 'https://dfpd.gov.in/WriteReadData/OrderUploadDocuments/bb9e69f8-e968-45d9-9257-425d75fcd7dd_TPDS%202nd%20Amendment.pdf',
          locator: 'Clauses 6 and 8 · Ration portability',
        },
        summary:
          'The 2024 amendment describes access for eligible ration card beneficiaries under One Nation One Ration Card.',
        rules: [
          {
            label: 'Ration portability',
            verb: 'supports access through',
            target: 'ePoS Fair Price Shop',
            kind: 'Rule',
            keywords: 'portability card another state eligible shop biometric',
            evidence:
              'The order describes portability of eligible foodgrain entitlements through biometric authentication at Fair Price Shops.',
          },
        ],
      },
    ],
  },
  {
    id: 'samriddhi',
    name: 'SVANidhi se Samriddhi',
    topic: 'Small business',
    keywords:
      'svanidhi se samriddhi converges welfare ration onorc jan dhan street vendor families insurance linkage link related schemes',
    versions: [
      {
        id: '2022',
        label: '2022 MoHUA programme release',
        years: [2022],
        source: vendorWelfare,
        summary:
          'The programme connects street vendors and their families with checks for eligibility under eight other government schemes.',
        rules: [
          {
            label: 'Ration scheme connection',
            verb: 'facilitates eligibility checks for',
            target: 'One Nation One Ration Card',
            kind: 'Programme link',
            keywords: 'ration food onorc affects linkage schemes',
            evidence:
              'MoHUA lists NFSA ration portability among the schemes covered by its beneficiary profiling and facilitation programme.',
          },
          {
            label: 'Banking connection',
            verb: 'facilitates eligibility checks for',
            target: 'PM Jan Dhan Yojana',
            kind: 'Programme link',
            keywords:
              'bank account jan dhan financial services related linkage',
            evidence:
              'MoHUA includes PM Jan Dhan Yojana among the linked schemes assessed for eligible beneficiaries.',
          },
          {
            label: 'Insurance connection',
            verb: 'facilitates eligibility checks for',
            target: 'PM Suraksha Bima Yojana',
            kind: 'Programme link',
            keywords: 'insurance accident suraksha bima related linkage',
            evidence:
              'MoHUA lists PM Suraksha Bima Yojana among the programmes covered by the convergence initiative.',
          },
        ],
      },
    ],
  },
];
