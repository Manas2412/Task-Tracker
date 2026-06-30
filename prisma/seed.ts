/**
 * MYAS Task Tracker — Prisma seed
 *
 * Creates the full organisational structure from the Work Activities Excel:
 *   6 divisions, ~65 users with real Ministry data.
 *
 * Bootstrap OSD preserves its existing password if already in the DB;
 * falls back to .env BOOTSTRAP_PASSWORD on a fresh database.
 * All other users get division-wise passwords with forcePasswordChange.
 *
 * Idempotent: clears all rows and re-inserts so re-running gives a fresh
 * known state. Safe to run every time the schema changes.
 */

import { PrismaClient } from '@prisma/client';

import { hashPassword } from '../src/lib/auth/password';

const prisma = new PrismaClient();

const BOOTSTRAP_USERNAME = process.env.BOOTSTRAP_USERNAME ?? 'osd.myas';
const BOOTSTRAP_PASSWORD = process.env.BOOTSTRAP_PASSWORD ?? 'ChangeMeImmediately!';
const BOOTSTRAP_NAME = process.env.BOOTSTRAP_NAME ?? 'OSD';

const PASSWORD_BY_DIVISION: Record<string, string> = {
  'Office of JS': 'officeojs_26',
  'Khelo India': 'kheloindia_26',
  'NSDF': 'nsdf_26',
  'SGM': 'sgm_26',
  'Media & IT': 'mediait_26',
  'Autonomous Bodies': 'autonomousbodies_26',
};

async function wipe() {
  console.log('Clearing tables…');
  // Children first.
  await prisma.$transaction([
    prisma.timelineFileActivity.deleteMany(),
    prisma.timelineFileTaskLink.deleteMany(),
    prisma.timelineFileMarkedTo.deleteMany(),
    prisma.taskActivity.deleteMany(),
    prisma.taskComment.deleteMany(),
    prisma.taskCollaborator.deleteMany(),
    prisma.taskTag.deleteMany(),
    prisma.reassignmentRequest.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.attachment.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.task.deleteMany(),
    prisma.timelineFile.deleteMany(),
    prisma.tag.deleteMany(),
  ]);
  // Break circular FK: divisions.created_by → users, users.division_id → divisions
  await prisma.$executeRawUnsafe(`UPDATE divisions SET created_by = NULL`);
  await prisma.$executeRawUnsafe(`UPDATE users SET supervisor_id = NULL, created_by = NULL`);
  await prisma.user.deleteMany();
  await prisma.division.deleteMany();
}

// Division names used as references in user data
const DIV = {
  OFFICE: 'Office of JS',
  KI: 'Khelo India',
  NSDF: 'NSDF',
  SGM: 'SGM',
  MEDIA: 'Media & IT',
  ABD: 'Autonomous Bodies',
} as const;

type UserSeed = {
  name: string;
  username: string;
  designation: string;
  hierarchySlot: string;
  division: string;
  contractRole?: string;
  isPmu?: boolean;
  pmuRole?: string;
  phone?: string;
  email?: string;
  workActivities?: string;
  supervisorRef?: string; // username of supervisor
};

// ============================================================
// User data from Work Activities Excel
// ============================================================

const USERS: UserSeed[] = [
  // ── Khelo India — Ministry staff ──────────────────────────
  {
    name: 'O P Chanchal',
    username: 'chanchal',
    designation: 'Under Secretary',
    hierarchySlot: 'under_secretary',
    division: DIV.KI,
    phone: '9560716689',
    email: 'chanchal.op@gov.in',
    workActivities: 'Under Secretary — Khelo India & NSDF',
    supervisorRef: BOOTSTRAP_USERNAME,
  },
  {
    name: 'Rajat Chauhan',
    username: 'rajat',
    designation: 'Section Officer',
    hierarchySlot: 'section_officer',
    division: DIV.KI,
    phone: '9560652536',
    email: 'rajat.chauhan@gov.in',
    workActivities: 'Section Officer — Khelo India',
    supervisorRef: 'chanchal',
  },
  {
    name: 'Santoshi Kumar',
    username: 'santoshi',
    designation: 'APO',
    hierarchySlot: 'aso',
    contractRole: 'apo',
    division: DIV.KI,
    phone: '7562878005',
    email: 'kumarsantoshi.ks@gmail.com',
    workActivities: 'PFMS Transaction, Sanction Orders, Files for release of funds, Status of funds position, Audit matters, other assigned tasks etc.',
    supervisorRef: 'rajat',
  },
  {
    name: 'VVS Kharayat',
    username: 'vvs',
    designation: 'APO',
    hierarchySlot: 'aso',
    contractRole: 'apo',
    division: DIV.KI,
    phone: '9868274311',
    workActivities: 'Matters related to GC, NLEC, PAC, DPAC under Khelo India Scheme. Court cases, LIMBS and legal matters. North-Eastern and Southern States (14 nos.)',
    supervisorRef: 'rajat',
  },
  {
    name: 'Ashish Gupta',
    username: 'ashish',
    designation: 'APO',
    hierarchySlot: 'aso',
    contractRole: 'apo',
    division: DIV.KI,
    phone: '9625563306',
    email: 'ashish.gupta1994@govcontractor.in',
    workActivities: 'General Administration works, Parliamentary matters, Coordination Matters, GeM Portal, SOM Data, VIP, RTI, PG, Sanction, Release, VVP, EBSB and other miscellaneous matters',
    supervisorRef: 'rajat',
  },
  {
    name: 'Paramjit Singh Thakur',
    username: 'paramjit',
    designation: 'APO',
    hierarchySlot: 'aso',
    contractRole: 'apo',
    division: DIV.KI,
    phone: '9560180632',
    workActivities: 'Matters related to sports infra projects of 14 states. Chief Secretaries Conference follow-up. RTI/misc. matters.',
    supervisorRef: 'rajat',
  },
  {
    name: 'Chandra Dutt Sharma',
    username: 'chandra',
    designation: 'APO',
    hierarchySlot: 'aso',
    contractRole: 'apo',
    division: DIV.KI,
    phone: '8750995010',
    workActivities: 'RTI. Matters related to SAI under Khelo India. All Union Territories under Khelo India. Ek Bharat Shrestha Bharat (EBSB). Prime Minister\'s Development Package (PMDP).',
    supervisorRef: 'rajat',
  },
  {
    name: 'Srishti Salvi',
    username: 'srishti',
    designation: 'Young Professional',
    hierarchySlot: 'aso',
    contractRole: 'yp',
    division: DIV.KI,
    phone: '9867271975',
    supervisorRef: 'rajat',
  },
  {
    name: 'Aditya Pundhir',
    username: 'aditya',
    designation: 'APO',
    hierarchySlot: 'aso',
    contractRole: 'apo',
    division: DIV.KI,
    phone: '9012617248',
    email: 'aditya.pundhir@govcontractor.in',
    workActivities: 'EFC, Cabinet Note related matters of KIS/KIM, Parliamentary matters, Coordination Matters, Asset Monetization, Budget Announcements, e-Samiksha, Chintan Shivir matters',
    supervisorRef: 'rajat',
  },
  {
    name: 'Samindra Nath Moitra',
    username: 'samindra',
    designation: 'APO',
    hierarchySlot: 'aso',
    contractRole: 'apo',
    division: DIV.KI,
    phone: '9717976942',
    email: 'snath.moitra@govcontractor.in',
    workActivities: 'Technical examination of proposals and monitoring of projects, PPP, Asset Monetization, VVP, Vikas Setu Portal',
    supervisorRef: 'rajat',
  },
  {
    name: 'Sheenu',
    username: 'sheenu',
    designation: 'DEO',
    hierarchySlot: 'aso',
    division: DIV.KI,
    phone: '7291848583',
    workActivities: 'Preparation of Note for Pad for Parliament Session, Parliament Questions, Statewise pagers, Poorvottar Vikas Setu and Sampark Setu Portals, Noting and Drafting, E-filing, MTNL Bills, miscellaneous works.',
    supervisorRef: 'rajat',
  },
  {
    name: 'Rajender Minj',
    username: 'rajender',
    designation: 'DEO',
    hierarchySlot: 'aso',
    division: DIV.KI,
    phone: '9653525229',
    workActivities: 'Attached with VVS Kharayat. Typing letters, notes, maintaining folders, scanning documents. Maintaining DPAC Data.',
    supervisorRef: 'rajat',
  },
  {
    name: 'Monu',
    username: 'monu',
    designation: 'DEO',
    hierarchySlot: 'aso',
    division: DIV.KI,
    phone: '7703801235',
    workActivities: 'Attached with S N Moitra. Typing letters. Maintaining LIMBS Portal. Miscellaneous work. Parliament duty during night.',
    supervisorRef: 'rajat',
  },
  {
    name: 'Sakshi Gaur',
    username: 'sakshi',
    designation: 'DEO',
    hierarchySlot: 'aso',
    division: DIV.KI,
    phone: '8178870275',
    workActivities: 'Maintaining SOM. Maintaining Public Grievance Portal, Appeals. Maintaining General Receipt. Miscellaneous works.',
    supervisorRef: 'rajat',
  },
  {
    name: 'Deeksha',
    username: 'deeksha',
    designation: 'DEO',
    hierarchySlot: 'aso',
    division: DIV.KI,
    phone: '9540850721',
    workActivities: 'Attached with US Sir and handling his official email. Handling Section Khelo India email. Processing TA/DA bills, MTNL bills. Handling RTI portal. Miscellaneous office tasks.',
    supervisorRef: 'rajat',
  },
  {
    name: 'Jatin Maan',
    username: 'jatin.m',
    designation: 'DEO',
    hierarchySlot: 'aso',
    division: DIV.KI,
    phone: '7065346456',
    workActivities: 'Attached with Chandra Dutt Sharma (APO). Typing letters, notes, scanning documents. Handles RTI Appeal Portal. Parliament duty during night.',
    supervisorRef: 'rajat',
  },
  {
    name: 'Hitesh',
    username: 'hitesh',
    designation: 'DEO',
    hierarchySlot: 'aso',
    division: DIV.KI,
    phone: '8882080850',
    workActivities: 'Attached with Paramjeet Singh Thakur (APO). Typing letters, notes, scanning documents. Maintaining Proposal (Infra) list, TTDI Data. Handling Video Conference/Meeting work. Maintain Compactor room records.',
    supervisorRef: 'rajat',
  },
  {
    name: 'Kamal Kumar',
    username: 'kamal',
    designation: 'DEO',
    hierarchySlot: 'aso',
    division: DIV.KI,
    phone: '9210578058',
    workActivities: 'Parliament duty during night. Letter dispatch work. Store maintenance (stationary, printers etc). Office equipment supervision. Miscellaneous work.',
    supervisorRef: 'rajat',
  },
  {
    name: 'Jyoti Raman',
    username: 'jyoti',
    designation: 'Tech Lead',
    hierarchySlot: 'aso',
    division: DIV.KI,
    phone: '8800719944',
    email: 'jyotiraman.mdsd@gmail.com',
    workActivities: 'MDSD Dashboard Management & Monitoring. State/UT DPR Facilitation & Coordination. PMGS Project Technical Coordination. OOMF & DGQI Data Management. Technical Support for Meetings & Presentations. YAS-NIC Technical Liaison.',
    supervisorRef: 'rajat',
  },
  {
    name: 'Manish Kumar',
    username: 'manish',
    designation: 'Project Coordinator, PMGS',
    hierarchySlot: 'aso',
    division: DIV.KI,
    phone: '8080039279',
    email: 'manishk1989@gmail.com',
    workActivities: 'Liaison and coordination with States/UTs, DPIIT, and BISAG-N on sports infrastructure data and PM Gati Shakti. Management and monitoring of PM Gati Shakti Portal. PMU Consultancy coordination. Preparation of reports, notes, presentations.',
    supervisorRef: 'rajat',
  },

  // ── Khelo India — EY PMU ──────────────────────────────────
  {
    name: 'Aneek Biswas',
    username: 'aneek',
    designation: 'Project Manager',
    hierarchySlot: 'aso',
    isPmu: true,
    pmuRole: 'pmu_team_leader',
    division: DIV.KI,
    phone: '9871056661',
    email: 'aneek.biswas@in.ey.com',
    workActivities: 'KIM — Infrastructure and Overall Management of EY Team and KIM Components',
    supervisorRef: 'chanchal',
  },
  {
    name: 'Abhishek Rawat',
    username: 'abhishek.r',
    designation: 'Senior Consultant',
    hierarchySlot: 'aso',
    isPmu: true,
    pmuRole: 'pmu_senior_consultant',
    division: DIV.KI,
    phone: '8527412805',
    email: 'abhishek.rawat2@in.ey.com',
    workActivities: 'KIM — Sports Technology and overall management of KIM components',
    supervisorRef: 'aneek',
  },
  {
    name: 'Chandan Pathak',
    username: 'chandan',
    designation: 'Senior Consultant',
    hierarchySlot: 'aso',
    isPmu: true,
    pmuRole: 'pmu_senior_consultant',
    division: DIV.KI,
    phone: '8826987372',
    email: 'chandan.pathak@in.ey.com',
    workActivities: 'KIM — Infrastructure and procurement support',
    supervisorRef: 'aneek',
  },
  {
    name: 'Abhishek Sanklan',
    username: 'abhishek.s',
    designation: 'Senior Consultant',
    hierarchySlot: 'aso',
    isPmu: true,
    pmuRole: 'pmu_senior_consultant',
    division: DIV.KI,
    phone: '8477014444',
    email: 'abhishek.sanklan@in.ey.com',
    workActivities: 'KIM — Infrastructure and procurement support',
    supervisorRef: 'aneek',
  },
  {
    name: 'Rohan Banja',
    username: 'rohan',
    designation: 'Senior Consultant',
    hierarchySlot: 'aso',
    isPmu: true,
    pmuRole: 'pmu_senior_consultant',
    division: DIV.KI,
    phone: '9833033104',
    email: 'rohan.banja@in.ey.com',
    workActivities: 'KIM — KITF Component',
    supervisorRef: 'aneek',
  },
  {
    name: 'Neha Baviskar',
    username: 'neha',
    designation: 'Senior Consultant',
    hierarchySlot: 'aso',
    isPmu: true,
    pmuRole: 'pmu_senior_consultant',
    division: DIV.KI,
    phone: '8087615920',
    email: 'neha.baviskar@in.ey.com',
    workActivities: 'KIM — Coach and Support Staff Development component',
    supervisorRef: 'aneek',
  },
  {
    name: 'Ashutosh Jalan',
    username: 'ashutosh.j',
    designation: 'Senior Consultant',
    hierarchySlot: 'aso',
    isPmu: true,
    pmuRole: 'pmu_senior_consultant',
    division: DIV.KI,
    phone: '7004631870',
    email: 'ashutosh.jalan@in.ey.com',
    workActivities: 'KIM — Infrastructure Component',
    supervisorRef: 'aneek',
  },
  {
    name: 'Prashant Chaudhary',
    username: 'prashant.c',
    designation: 'Senior Consultant',
    hierarchySlot: 'aso',
    isPmu: true,
    pmuRole: 'pmu_senior_consultant',
    division: DIV.KI,
    phone: '9910031107',
    email: 'prashant.chaudhary2@in.ey.com',
    workActivities: 'KIM — FIT India Component',
    supervisorRef: 'aneek',
  },
  {
    name: 'Rohit Nagarajan',
    username: 'rohit',
    designation: 'Consultant',
    hierarchySlot: 'aso',
    isPmu: true,
    pmuRole: 'pmu_consultant',
    division: DIV.KI,
    phone: '9600661073',
    email: 'rohit.nagarajan@in.ey.com',
    workActivities: 'KIM — TID Component',
    supervisorRef: 'aneek',
  },
  {
    name: 'Rachna',
    username: 'rachna',
    designation: 'Consultant',
    hierarchySlot: 'aso',
    isPmu: true,
    pmuRole: 'pmu_consultant',
    division: DIV.KI,
    phone: '9958235291',
    email: 'rachna@in.ey.com',
    workActivities: 'KIM — Sports Competitions and Leagues',
    supervisorRef: 'aneek',
  },

  // ── Khelo India — Support staff ───────────────────────────
  {
    name: 'Ravi',
    username: 'ravi',
    designation: 'House Keeping',
    hierarchySlot: 'aso',
    division: DIV.KI,
    workActivities: 'House Keeping',
    supervisorRef: 'chanchal',
  },
  {
    name: 'Ajay',
    username: 'ajay',
    designation: 'House Keeping',
    hierarchySlot: 'aso',
    division: DIV.KI,
    phone: '8799783406',
    workActivities: 'House Keeping',
    supervisorRef: 'chanchal',
  },
  {
    name: 'Ashutosh',
    username: 'ashutosh',
    designation: 'MTS',
    hierarchySlot: 'aso',
    division: DIV.KI,
    phone: '9582575701',
    workActivities: 'Multi Tasking Work',
    supervisorRef: 'chanchal',
  },
  {
    name: 'Hemant Kumar',
    username: 'hemant',
    designation: 'MTS',
    hierarchySlot: 'aso',
    division: DIV.KI,
    phone: '9910269529',
    workActivities: 'Multi Tasking Work',
    supervisorRef: 'chanchal',
  },
  {
    name: 'Vikash Kumar',
    username: 'vikash',
    designation: 'MTS',
    hierarchySlot: 'aso',
    division: DIV.KI,
    phone: '7858945367',
    workActivities: 'Multi Tasking Work',
    supervisorRef: 'chanchal',
  },
  {
    name: 'Laxman Diwakar',
    username: 'laxman',
    designation: 'MTS',
    hierarchySlot: 'aso',
    division: DIV.KI,
    phone: '9873669822',
    workActivities: 'Multi Tasking Work',
    supervisorRef: 'chanchal',
  },

  // ── NSDF ──────────────────────────────────────────────────
  {
    name: 'K Balan Nair',
    username: 'balan',
    designation: 'Project Officer',
    hierarchySlot: 'aso',
    contractRole: 'po',
    division: DIV.NSDF,
    phone: '9868760842',
    workActivities: 'Preliminary examination of proposals for financial assistance. Prepare agenda notes and minutes for Executive Committee and Council meetings. Monitor assisted cases. Audit and Income Tax related issues. Prepare Annual Report. Parliament Questions and Standing Committee inputs.',
    supervisorRef: 'chanchal',
  },
  {
    name: 'B P Satapathy',
    username: 'satapathy',
    designation: 'Asst. Project Officer',
    hierarchySlot: 'aso',
    contractRole: 'apo',
    division: DIV.NSDF,
    phone: '8920100911',
    workActivities: 'Preliminary examination of proposals. Agenda notes and minutes for meetings. Parliament Questions and Standing Committee inputs. RTI & VIP Reference. Audit and Income Tax related issues. Reply to Audit Paras.',
    supervisorRef: 'balan',
  },
  {
    name: 'Rubeena',
    username: 'rubeena',
    designation: 'Accounts Assistant',
    hierarchySlot: 'aso',
    division: DIV.NSDF,
    phone: '7042136563',
    workActivities: 'Financial record-keeping, maintenance, and initial scrutiny of bills. Preparing financial statements, budget utilization tracks, and audit responses. Compliance with financial guidelines.',
    supervisorRef: 'balan',
  },
  {
    name: 'Sudhakar Kala',
    username: 'sudhakar',
    designation: 'Data Entry Operator',
    hierarchySlot: 'aso',
    division: DIV.NSDF,
    phone: '9911349328',
    workActivities: 'Data entry operations, file tracking, and digital archiving. Preparation and laying of Annual Report. Processing sports grant applications and correspondence. Knowledge of past files, records and cases. Diarising of Receipts.',
    supervisorRef: 'balan',
  },
  {
    name: 'Tejbhan',
    username: 'tejbhan',
    designation: 'MTS',
    hierarchySlot: 'aso',
    division: DIV.NSDF,
    phone: '9817613995',
    workActivities: 'Facilitating the work of the staff, record keeping, dispatch of files.',
    supervisorRef: 'balan',
  },

  // ── SGM — Ministry staff ──────────────────────────────────
  {
    name: 'Harilal K M',
    username: 'harilal',
    designation: 'Director',
    hierarchySlot: 'director',
    division: DIV.SGM,
    phone: '9946946774',
    email: 'km.harilal@nic.in',
    supervisorRef: BOOTSTRAP_USERNAME,
  },
  {
    name: 'Yogesh Kumar',
    username: 'yogesh',
    designation: 'Under Secretary',
    hierarchySlot: 'under_secretary',
    division: DIV.SGM,
    phone: '9560297732',
    email: 'yogesh.kumar55@nic.in',
    supervisorRef: 'harilal',
  },
  {
    name: 'Antra Madaan',
    username: 'antra',
    designation: 'Assistant Director',
    hierarchySlot: 'section_officer',
    division: DIV.SGM,
    phone: '7347340344',
    email: 'antra.madaan@gov.in',
    supervisorRef: 'yogesh',
  },

  // ── SGM — KPMG PMU ───────────────────────────────────────
  {
    name: 'Jatin Chopra',
    username: 'jatin.c',
    designation: 'Team Leader',
    hierarchySlot: 'aso',
    isPmu: true,
    pmuRole: 'pmu_team_leader',
    division: DIV.SGM,
    phone: '9717700606',
    email: 'jatinchopra1@kpmg.com',
    workActivities: 'Ecosystem Development, Investment and Trade Outreach',
    supervisorRef: 'harilal',
  },
  {
    name: 'Sanjana Rishi',
    username: 'sanjana',
    designation: 'Senior Consultant',
    hierarchySlot: 'aso',
    isPmu: true,
    pmuRole: 'pmu_senior_consultant',
    division: DIV.SGM,
    phone: '9999897240',
    email: 'sanjanarishi@kpmg.com',
    workActivities: 'Investor and Sports Ecosystem Outreach',
    supervisorRef: 'jatin.c',
  },
  {
    name: 'Kritika Bhasin',
    username: 'kritika',
    designation: 'Senior Consultant',
    hierarchySlot: 'aso',
    isPmu: true,
    pmuRole: 'pmu_senior_consultant',
    division: DIV.SGM,
    phone: '9953467518',
    email: 'kritikabhasin@kpmg.com',
    workActivities: 'Policy and Scheme Design',
    supervisorRef: 'jatin.c',
  },
  {
    name: 'Prashant Jeph',
    username: 'prashant',
    designation: 'Senior Consultant',
    hierarchySlot: 'aso',
    isPmu: true,
    pmuRole: 'pmu_senior_consultant',
    division: DIV.SGM,
    phone: '7872838926',
    email: 'prashantjeph@kpmg.com',
    workActivities: 'Technology Interventions',
    supervisorRef: BOOTSTRAP_USERNAME,
  },
  {
    name: 'Pratik Sinha',
    username: 'pratik',
    designation: 'Consultant',
    hierarchySlot: 'aso',
    isPmu: true,
    pmuRole: 'pmu_consultant',
    division: DIV.SGM,
    phone: '9210834408',
    email: 'pratiksinha1@kpmg.com',
    workActivities: 'Autonomous Bodies, NISSR, Make In India',
    supervisorRef: 'jatin.c',
  },
  {
    name: 'Gargi Sur',
    username: 'gargi',
    designation: 'Consultant',
    hierarchySlot: 'aso',
    isPmu: true,
    pmuRole: 'pmu_consultant',
    division: DIV.SGM,
    phone: '7003766393',
    email: 'gargisur@kpmg.com',
    workActivities: 'Ecosystem Support',
    supervisorRef: 'jatin.c',
  },
  {
    name: 'Tanya Chadha',
    username: 'tanya',
    designation: 'Consultant',
    hierarchySlot: 'aso',
    isPmu: true,
    pmuRole: 'pmu_consultant',
    division: DIV.SGM,
    phone: '9810335630',
    email: 'tanyachadha@kpmg.com',
    workActivities: 'Policy and Scheme Design',
    supervisorRef: 'jatin.c',
  },
  {
    name: 'Dishi Aggarwal',
    username: 'dishi',
    designation: 'Consultant',
    hierarchySlot: 'aso',
    isPmu: true,
    pmuRole: 'pmu_consultant',
    division: DIV.SGM,
    phone: '8477845705',
    email: 'dishiaggarwa@kpmg.com',
    workActivities: 'Trade Data Analytics and Monitoring and Evaluation of Government programs',
    supervisorRef: 'jatin.c',
  },
  {
    name: 'Muskan Sahu',
    username: 'muskan',
    designation: 'Consultant',
    hierarchySlot: 'aso',
    isPmu: true,
    pmuRole: 'pmu_consultant',
    division: DIV.SGM,
    phone: '9109546445',
    email: 'muskansahu@kpmg.com',
    workActivities: 'Autonomous Bodies, NISSR, Make In India',
    supervisorRef: 'jatin.c',
  },
  {
    name: 'Tanmay Batra',
    username: 'tanmay',
    designation: 'Consultant',
    hierarchySlot: 'aso',
    isPmu: true,
    pmuRole: 'pmu_consultant',
    division: DIV.SGM,
    phone: '9212535773',
    email: 'tanmaybatra@kpmg.com',
    workActivities: 'Investment Outreach',
    supervisorRef: 'jatin.c',
  },

  // ── Media & IT ────────────────────────────────────────────
  {
    name: 'Ayushman Kumar',
    username: 'ayushman',
    designation: 'Chief Media Coordinator',
    hierarchySlot: 'aso',
    division: DIV.MEDIA,
    phone: '8585932175',
    email: 'cmc-dos@gov.in',
    workActivities: 'Media & Public Relations. Social Media Management. Event Coverage. Branding & Promotion. Digital initiatives implementation and monitoring. Data security and IT policy compliance. DBT implementation. NIC Nodal Officer. Website/Dashboard management and Web Information Manager.',
    supervisorRef: BOOTSTRAP_USERNAME,
  },

  // ── Autonomous Bodies ─────────────────────────────────────
  {
    name: 'Mohd Zuber',
    username: 'zuber',
    designation: 'Deputy Secretary',
    hierarchySlot: 'deputy_secretary',
    division: DIV.ABD,
    phone: '7219191237',
    email: 'mohdzuber@ord.gov.in',
    supervisorRef: BOOTSTRAP_USERNAME,
  },
  {
    name: 'Basant Kumar Sahrawat',
    username: 'basant',
    designation: 'Section Officer',
    hierarchySlot: 'section_officer',
    division: DIV.ABD,
    phone: '9813562200',
    email: 'bk.sahrawat@gov.in',
    supervisorRef: 'zuber',
  },
  {
    name: 'Vaishali Rajput',
    username: 'vaishali',
    designation: 'Assistant Section Officer',
    hierarchySlot: 'aso',
    division: DIV.ABD,
    phone: '9015761660',
    email: 'rajput.vaishali@gov.in',
    workActivities: 'Matters related to NADA/WADA, PG/RTI/Court Cases. Matters related to Sports Goods Manufacturing.',
    supervisorRef: 'basant',
  },
  {
    name: 'Suraj Kumar Jasiwara',
    username: 'suraj',
    designation: 'Young Professional',
    hierarchySlot: 'aso',
    contractRole: 'yp',
    division: DIV.ABD,
    phone: '7081053988',
    email: 'suraj.jaiswara@govcontractor.in',
    workActivities: 'Administrative, Financial, and Legal matters related to SAI',
    supervisorRef: 'basant',
  },
  {
    name: 'Amol Raj',
    username: 'amol',
    designation: 'Young Professional',
    hierarchySlot: 'aso',
    contractRole: 'yp',
    division: DIV.ABD,
    phone: '8126033759',
    email: 'amol.raj@govcontractor.in',
    workActivities: 'Matters related to NCSSR/NISSR',
    supervisorRef: 'basant',
  },
  {
    name: 'Samia Rizvi',
    username: 'samia',
    designation: 'Young Professional',
    hierarchySlot: 'aso',
    contractRole: 'yp',
    division: DIV.ABD,
    phone: '8595532918',
    workActivities: 'Matter related to NDTL and AICS',
    supervisorRef: 'basant',
  },
  {
    name: 'Lakshay',
    username: 'lakshay',
    designation: 'Young Professional',
    hierarchySlot: 'aso',
    contractRole: 'yp',
    division: DIV.ABD,
    phone: '9872668467',
    email: 'lakshayrakhra29@gmail.com',
    workActivities: 'Newly joined',
    supervisorRef: 'basant',
  },
  {
    name: 'Abhay Prajapati',
    username: 'abhay',
    designation: 'Data Entry Operator',
    hierarchySlot: 'aso',
    division: DIV.ABD,
    phone: '9667022593',
    email: 'abhayprajapati9667@gmail.com',
    workActivities: 'Records & Data Management',
    supervisorRef: 'yogesh',
  },
  {
    name: 'Vijay Kaushik',
    username: 'vijay',
    designation: 'MTS',
    hierarchySlot: 'aso',
    division: DIV.ABD,
    phone: '9671505082',
    workActivities: 'Document handling, Physical records management, Equipment use',
    supervisorRef: 'basant',
  },
];

async function main() {
  console.log(`Bootstrap user: ${BOOTSTRAP_USERNAME}`);
  console.log(`Division-wise passwords enabled\n`);

  await wipe();

  // ── Create divisions ────────────────────────────────────
  console.log('Creating divisions…');
  const divisionData = [
    { name: DIV.OFFICE, kind: 'division' as const, avatarColour: '#1e1b4b', displayOrder: 0 },
    { name: DIV.KI, kind: 'division' as const, avatarColour: '#0c4a6e', displayOrder: 1, hasPmu: true },
    { name: DIV.NSDF, kind: 'division' as const, avatarColour: '#064e3b', displayOrder: 2 },
    { name: DIV.SGM, kind: 'division' as const, avatarColour: '#7c2d12', displayOrder: 3, hasPmu: true },
    { name: DIV.MEDIA, kind: 'division' as const, avatarColour: '#581c87', displayOrder: 4 },
    { name: DIV.ABD, kind: 'division' as const, avatarColour: '#1e3a5f', displayOrder: 5 },
  ];

  const divMap: Record<string, string> = {};
  for (const d of divisionData) {
    const created = await prisma.division.create({ data: d });
    divMap[d.name] = created.id;
  }

  // ── Preserve existing OSD credentials if already set ────
  // Read BEFORE wipe so we can restore the password the user changed
  const existingOsd = await prisma.user.findUnique({
    where: { username: BOOTSTRAP_USERNAME },
    select: { passwordHash: true, forcePasswordChange: true },
  });

  // ── Hash passwords (one per division) ──────────────────
  console.log('Hashing passwords…');
  const divNames = Object.keys(PASSWORD_BY_DIVISION);
  const divHashes = await Promise.all(
    divNames.map((d) => hashPassword(PASSWORD_BY_DIVISION[d])),
  );
  const hashByDivision: Record<string, string> = {};
  divNames.forEach((d, i) => { hashByDivision[d] = divHashes[i]; });

  const bootstrapHash = existingOsd
    ? existingOsd.passwordHash
    : await hashPassword(BOOTSTRAP_PASSWORD);
  const bootstrapForceChange = existingOsd
    ? existingOsd.forcePasswordChange
    : false;

  if (existingOsd) {
    console.log('Preserving existing OSD password…');
  }

  // ── Create bootstrap user (OSD) ─────────────────────────
  console.log('Creating bootstrap user…');
  await prisma.user.create({
    data: {
      name: BOOTSTRAP_NAME,
      username: BOOTSTRAP_USERNAME,
      passwordHash: bootstrapHash,
      designation: 'Officer on Special Duty',
      hierarchySlot: 'osd',
      divisionId: divMap[DIV.OFFICE],
      isActive: true,
      isSuperAdmin: true,
      forcePasswordChange: bootstrapForceChange,
    },
  });

  // ── Create all other users (without supervisor links) ───
  console.log(`Creating ${USERS.length} users…`);
  for (const u of USERS) {
    await prisma.user.create({
      data: {
        name: u.name,
        username: u.username,
        passwordHash: hashByDivision[u.division],
        designation: u.designation,
        hierarchySlot: u.hierarchySlot as any,
        divisionId: divMap[u.division],
        contractRole: (u.contractRole as any) ?? null,
        isPmu: u.isPmu ?? false,
        pmuRole: (u.pmuRole as any) ?? null,
        phone: u.phone ?? null,
        email: u.email ?? null,
        workActivities: u.workActivities ?? null,
        isActive: true,
        forcePasswordChange: true,
      },
    });
  }

  // ── Link supervisors ────────────────────────────────────
  console.log('Linking supervisors…');
  const usernameToId: Record<string, string> = {};
  const allUsers = await prisma.user.findMany({ select: { id: true, username: true } });
  for (const u of allUsers) usernameToId[u.username] = u.id;

  for (const u of USERS) {
    if (u.supervisorRef && usernameToId[u.supervisorRef]) {
      await prisma.user.update({
        where: { username: u.username },
        data: { supervisorId: usernameToId[u.supervisorRef] },
      });
    }
  }

  console.log('\nSeed complete.');
  console.log(`Created ${Object.keys(divMap).length} divisions, ${USERS.length + 1} users.`);
  console.log(`Sign in at /login. OSD: existing password preserved. Others: division-wise passwords.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
