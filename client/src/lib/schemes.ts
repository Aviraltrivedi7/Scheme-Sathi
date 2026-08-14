/* Jan Seva Editorial reminder: keep public-service data trustworthy, scannable, bilingual, and source-aware. */

export type SchemeLevel = "Central" | "State";

export type EligibilityRule = {
  age_min?: number;
  age_max?: number;
  income_max?: number;
  caste_categories?: string[] | "all";
  occupations?: string[] | "all";
  states?: string[] | "all";
  gender?: string[] | "all";
  is_student?: boolean;
  is_farmer?: boolean;
  is_disabled?: boolean;
};

export type Scheme = {
  id: string;
  name: string;
  nameHindi: string;
  category: string;
  categoryHindi: string;
  level: SchemeLevel;
  administeringBody: string;
  benefits: string;
  benefitsHindi: string;
  eligibility: EligibilityRule;
  documents: string[];
  documentsHindi: string[];
  steps: string[];
  stepsHindi: string[];
  portalUrl: string;
  reviewed: string;
  accent: "saffron" | "emerald" | "coral" | "indigo";
  artwork: string;
  applicationDeadline?: number | null;
  deadlineLabel?: string | null;
};

export type UserProfile = {
  age: number;
  state: string;
  caste: string;
  annualIncome: number;
  occupation: string;
  gender: string;
  isStudent: boolean;
  isFarmer: boolean;
  isDisabled: boolean;
};

const farmerArt = "/manus-storage/scheme-sathi-farmer_fa6fb4ad.png";
const educationArt = "/manus-storage/scheme-sathi-education_87d604a6.png";
const healthArt = "/manus-storage/scheme-sathi-health_7a34a071.png";

export const schemes: Scheme[] = [
  {
    id: "pmjay",
    name: "Ayushman Bharat PM-JAY",
    nameHindi: "आयुष्मान भारत प्रधानमंत्री जन आरोग्य योजना",
    category: "Health",
    categoryHindi: "स्वास्थ्य",
    level: "Central",
    administeringBody: "National Health Authority",
    benefits: "Cashless health cover up to ₹5 lakh per family per year at empanelled hospitals.",
    benefitsHindi: "सूचीबद्ध अस्पतालों में प्रति परिवार प्रति वर्ष ₹5 लाख तक का कैशलेस स्वास्थ्य कवर।",
    eligibility: { age_min: 0, income_max: 300000, caste_categories: "all", occupations: "all", states: "all" },
    documents: ["Aadhaar or alternate ID", "Ration card / family ID", "Mobile number"],
    documentsHindi: ["आधार या वैकल्पिक पहचान पत्र", "राशन कार्ड / परिवार आईडी", "मोबाइल नंबर"],
    steps: ["Check your name in the beneficiary list", "Visit a CSC or empanelled hospital", "Carry your ID and complete e-KYC"],
    stepsHindi: ["लाभार्थी सूची में अपना नाम देखें", "सीएससी या सूचीबद्ध अस्पताल जाएँ", "पहचान पत्र लेकर ई-केवाईसी पूरा करें"],
    portalUrl: "https://pmjay.gov.in/",
    reviewed: "Reviewed 18 Jun 2026",
    accent: "emerald",
    artwork: healthArt,
  },
  {
    id: "pmkisan",
    name: "PM-KISAN Samman Nidhi",
    nameHindi: "प्रधानमंत्री किसान सम्मान निधि",
    category: "Agriculture",
    categoryHindi: "कृषि",
    level: "Central",
    administeringBody: "Department of Agriculture & Farmers Welfare",
    benefits: "Income support of ₹6,000 per year, paid in three instalments to eligible landholding farmers.",
    benefitsHindi: "पात्र भूमिधारक किसानों को तीन किस्तों में हर साल ₹6,000 की आय सहायता।",
    eligibility: { age_min: 18, caste_categories: "all", occupations: ["Farmer", "Agriculture"], states: "all", is_farmer: true },
    documents: ["Aadhaar card", "Land ownership record", "Bank account details"],
    documentsHindi: ["आधार कार्ड", "भूमि स्वामित्व रिकॉर्ड", "बैंक खाते का विवरण"],
    steps: ["Open the PM-KISAN portal", "Complete farmer registration with land details", "Finish Aadhaar-linked e-KYC"],
    stepsHindi: ["पीएम-किसान पोर्टल खोलें", "भूमि विवरण के साथ किसान पंजीकरण करें", "आधार से जुड़ी ई-केवाईसी पूरी करें"],
    portalUrl: "https://pmkisan.gov.in/",
    reviewed: "Reviewed 12 Jun 2026",
    accent: "saffron",
    artwork: farmerArt,
  },
  {
    id: "pmfby",
    name: "Pradhan Mantri Fasal Bima Yojana",
    nameHindi: "प्रधानमंत्री फसल बीमा योजना",
    category: "Agriculture",
    categoryHindi: "कृषि",
    level: "Central",
    administeringBody: "Ministry of Agriculture & Farmers Welfare",
    benefits: "Affordable crop insurance against natural risks, pests and diseases for notified crops.",
    benefitsHindi: "अधिसूचित फसलों के लिए प्राकृतिक जोखिम, कीट और रोगों से किफायती फसल बीमा।",
    eligibility: { age_min: 18, occupations: ["Farmer", "Agriculture"], states: "all", is_farmer: true },
    documents: ["Aadhaar card", "Land / tenancy record", "Sowing declaration and bank details"],
    documentsHindi: ["आधार कार्ड", "भूमि / किरायेदारी रिकॉर्ड", "बुवाई घोषणा और बैंक विवरण"],
    steps: ["Check the notified crop and season", "Apply through bank, CSC or portal", "Keep the acknowledgement for claim support"],
    stepsHindi: ["अधिसूचित फसल और मौसम देखें", "बैंक, सीएससी या पोर्टल से आवेदन करें", "दावे के लिए पावती सुरक्षित रखें"],
    portalUrl: "https://pmfby.gov.in/",
    reviewed: "Reviewed 09 Jun 2026",
    accent: "saffron",
    artwork: farmerArt,
  },
  {
    id: "nsp",
    name: "National Scholarship Portal",
    nameHindi: "राष्ट्रीय छात्रवृत्ति पोर्टल",
    category: "Education",
    categoryHindi: "शिक्षा",
    level: "Central",
    administeringBody: "Ministry of Education",
    benefits: "One-window access to multiple pre-matric, post-matric and merit scholarships.",
    benefitsHindi: "प्री-मैट्रिक, पोस्ट-मैट्रिक और मेरिट छात्रवृत्तियों तक एक ही जगह से पहुँच।",
    eligibility: { age_min: 10, age_max: 35, income_max: 800000, caste_categories: "all", occupations: "all", states: "all", is_student: true },
    documents: ["Student ID and Aadhaar", "Income certificate", "Previous marksheet and bank details"],
    documentsHindi: ["छात्र आईडी और आधार", "आय प्रमाण पत्र", "पिछली अंकतालिका और बैंक विवरण"],
    steps: ["Create a student profile on NSP", "Select the scholarship that fits your course", "Submit documents through your institute"],
    stepsHindi: ["एनएसपी पर छात्र प्रोफाइल बनाएँ", "अपने पाठ्यक्रम के लिए छात्रवृत्ति चुनें", "संस्थान के माध्यम से दस्तावेज जमा करें"],
    portalUrl: "https://scholarships.gov.in/",
    reviewed: "Reviewed 04 Jun 2026",
    accent: "indigo",
    artwork: educationArt,
    applicationDeadline: Date.UTC(2026, 9, 31, 18, 29, 59),
    deadlineLabel: "Student applications close 31 Oct 2026",
  },
  {
    id: "pmuy",
    name: "Pradhan Mantri Ujjwala Yojana",
    nameHindi: "प्रधानमंत्री उज्ज्वला योजना",
    category: "Women & Family",
    categoryHindi: "महिला एवं परिवार",
    level: "Central",
    administeringBody: "Ministry of Petroleum & Natural Gas",
    benefits: "Deposit-free LPG connection support for eligible adult women from low-income households.",
    benefitsHindi: "कम आय वाले परिवारों की पात्र वयस्क महिलाओं के लिए जमा-रहित एलपीजी कनेक्शन सहायता।",
    eligibility: { age_min: 18, income_max: 300000, gender: ["Female"], states: "all" },
    documents: ["Aadhaar of applicant and adult family members", "Address proof", "Bank account details"],
    documentsHindi: ["आवेदक और वयस्क परिवार सदस्यों का आधार", "पता प्रमाण", "बैंक खाते का विवरण"],
    steps: ["Visit an LPG distributor", "Submit KYC and household declaration", "Collect connection details after verification"],
    stepsHindi: ["एलपीजी वितरक के पास जाएँ", "केवाईसी और परिवार घोषणा जमा करें", "सत्यापन के बाद कनेक्शन विवरण प्राप्त करें"],
    portalUrl: "https://www.pmuy.gov.in/",
    reviewed: "Reviewed 27 May 2026",
    accent: "coral",
    artwork: healthArt,
  },
  {
    id: "pmsvanidhi",
    name: "PM SVANidhi",
    nameHindi: "पीएम स्वनिधि",
    category: "Livelihood",
    categoryHindi: "आजीविका",
    level: "Central",
    administeringBody: "Ministry of Housing & Urban Affairs",
    benefits: "Collateral-free working capital support with incentives for street vendors who repay on time.",
    benefitsHindi: "समय पर भुगतान करने वाले स्ट्रीट वेंडर्स के लिए बिना गारंटी कार्यशील पूंजी सहायता और प्रोत्साहन।",
    eligibility: { age_min: 18, occupations: ["Street Vendor", "Small Business", "Business Owner", "Self-Employed"], states: "all" },
    documents: ["Certificate of vending or local survey record", "Aadhaar card", "Bank account and mobile number"],
    documentsHindi: ["वेंडिंग प्रमाण पत्र या स्थानीय सर्वे रिकॉर्ड", "आधार कार्ड", "बैंक खाता और मोबाइल नंबर"],
    steps: ["Contact your urban local body or lending partner", "Submit vendor verification details", "Track the loan and digital cashback incentives"],
    stepsHindi: ["शहरी स्थानीय निकाय या ऋण भागीदार से संपर्क करें", "वेंडर सत्यापन विवरण जमा करें", "ऋण और डिजिटल कैशबैक प्रोत्साहन ट्रैक करें"],
    portalUrl: "https://pmsvanidhi.mohua.gov.in/",
    reviewed: "Reviewed 22 May 2026",
    accent: "saffron",
    artwork: farmerArt,
  },
  {
    id: "standup-india",
    name: "Stand-Up India",
    nameHindi: "स्टैंड-अप इंडिया",
    category: "Enterprise",
    categoryHindi: "उद्यमिता",
    level: "Central",
    administeringBody: "Department of Financial Services",
    benefits: "Bank loans for greenfield enterprises promoted by women or SC/ST entrepreneurs.",
    benefitsHindi: "महिला या एससी/एसटी उद्यमियों द्वारा शुरू किए गए नए उद्यमों के लिए बैंक ऋण।",
    eligibility: { age_min: 18, caste_categories: ["SC", "ST", "all"], occupations: ["Entrepreneur", "Business Owner", "Self-Employed"], states: "all", gender: ["Female", "all"] },
    documents: ["Identity and address proof", "Business plan", "Caste / women entrepreneur proof where applicable"],
    documentsHindi: ["पहचान और पता प्रमाण", "व्यवसाय योजना", "लागू होने पर जाति / महिला उद्यमी प्रमाण"],
    steps: ["Prepare a viable greenfield business plan", "Apply through the portal or bank branch", "Complete lender due diligence"],
    stepsHindi: ["व्यवहार्य नए व्यवसाय की योजना बनाएँ", "पोर्टल या बैंक शाखा से आवेदन करें", "ऋणदाता की जाँच पूरी करें"],
    portalUrl: "https://www.standupmitra.in/",
    reviewed: "Reviewed 16 May 2026",
    accent: "coral",
    artwork: educationArt,
  },
  {
    id: "pmay-urban",
    name: "PMAY — Urban Housing",
    nameHindi: "प्रधानमंत्री आवास योजना — शहरी",
    category: "Housing",
    categoryHindi: "आवास",
    level: "Central",
    administeringBody: "Ministry of Housing & Urban Affairs",
    benefits: "Support for eligible urban families to build, buy or improve a pucca home.",
    benefitsHindi: "पात्र शहरी परिवारों को पक्का घर बनाने, खरीदने या सुधारने में सहायता।",
    eligibility: { age_min: 18, income_max: 1800000, states: "all" },
    documents: ["Identity and address proof", "Income certificate", "Land / property documents if applicable"],
    documentsHindi: ["पहचान और पता प्रमाण", "आय प्रमाण पत्र", "लागू होने पर भूमि / संपत्ति दस्तावेज"],
    steps: ["Check the housing vertical available in your city", "Apply through the urban local body or official portal", "Track verification and sanction status"],
    stepsHindi: ["अपने शहर में उपलब्ध आवास विकल्प देखें", "शहरी स्थानीय निकाय या आधिकारिक पोर्टल से आवेदन करें", "सत्यापन और स्वीकृति स्थिति ट्रैक करें"],
    portalUrl: "https://pmay-urban.gov.in/",
    reviewed: "Reviewed 10 May 2026",
    accent: "indigo",
    artwork: healthArt,
  },
  {
    id: "nsap",
    name: "National Social Assistance Programme",
    nameHindi: "राष्ट्रीय सामाजिक सहायता कार्यक्रम",
    category: "Social Security",
    categoryHindi: "सामाजिक सुरक्षा",
    level: "Central",
    administeringBody: "Ministry of Rural Development",
    benefits: "Social assistance pensions for eligible elderly persons, widows and persons with disabilities.",
    benefitsHindi: "पात्र बुजुर्गों, विधवाओं और दिव्यांग व्यक्तियों के लिए सामाजिक सहायता पेंशन।",
    eligibility: { age_min: 18, income_max: 300000, states: "all", is_disabled: true },
    documents: ["Age / disability proof", "Aadhaar or alternate ID", "Bank or post-office account"],
    documentsHindi: ["आयु / दिव्यांगता प्रमाण", "आधार या वैकल्पिक पहचान पत्र", "बैंक या डाकघर खाता"],
    steps: ["Contact your Gram Panchayat or municipal office", "Submit the pension application", "Keep the acknowledgement for status checks"],
    stepsHindi: ["ग्राम पंचायत या नगर कार्यालय से संपर्क करें", "पेंशन आवेदन जमा करें", "स्थिति जाँच के लिए पावती रखें"],
    portalUrl: "https://nsap.nic.in/",
    reviewed: "Reviewed 03 May 2026",
    accent: "emerald",
    artwork: healthArt,
  },
  {
    id: "sukanya",
    name: "Sukanya Samriddhi Account",
    nameHindi: "सुकन्या समृद्धि खाता",
    category: "Women & Family",
    categoryHindi: "महिला एवं परिवार",
    level: "Central",
    administeringBody: "Department of Economic Affairs",
    benefits: "Small-savings account designed to support the education and future of a girl child.",
    benefitsHindi: "बालिका की शिक्षा और भविष्य के लिए बनाया गया छोटी बचत खाता।",
    eligibility: { age_min: 0, age_max: 10, gender: ["Female"], states: "all" },
    documents: ["Girl child birth certificate", "Guardian identity proof", "Address proof"],
    documentsHindi: ["बालिका का जन्म प्रमाण पत्र", "अभिभावक का पहचान प्रमाण", "पता प्रमाण"],
    steps: ["Visit a post office or authorised bank", "Open the account in the girl child’s name", "Maintain contributions as per account rules"],
    stepsHindi: ["डाकघर या अधिकृत बैंक जाएँ", "बालिका के नाम पर खाता खोलें", "खाता नियमों के अनुसार योगदान करें"],
    portalUrl: "https://www.indiapost.gov.in/",
    reviewed: "Reviewed 26 Apr 2026",
    accent: "coral",
    artwork: educationArt,
  },
  {
    id: "up-kanya",
    name: "Mukhyamantri Kanya Sumangala",
    nameHindi: "मुख्यमंत्री कन्या सुमंगला योजना",
    category: "Women & Family",
    categoryHindi: "महिला एवं परिवार",
    level: "State",
    administeringBody: "Government of Uttar Pradesh",
    benefits: "Stage-wise financial support for the health, education and development of a girl child in Uttar Pradesh.",
    benefitsHindi: "उत्तर प्रदेश में बालिका के स्वास्थ्य, शिक्षा और विकास के लिए चरणबद्ध आर्थिक सहायता।",
    eligibility: { age_min: 0, age_max: 25, income_max: 300000, gender: ["Female"], states: ["Uttar Pradesh"] },
    documents: ["UP residence proof", "Girl child birth certificate", "Family income certificate and bank details"],
    documentsHindi: ["उत्तर प्रदेश निवास प्रमाण", "बालिका का जन्म प्रमाण पत्र", "परिवार आय प्रमाण और बैंक विवरण"],
    steps: ["Register on the state portal", "Upload stage-specific documents", "Track approval and instalment status"],
    stepsHindi: ["राज्य पोर्टल पर पंजीकरण करें", "चरण के अनुसार दस्तावेज अपलोड करें", "स्वीकृति और किस्त की स्थिति ट्रैक करें"],
    portalUrl: "https://mksy.up.gov.in/",
    reviewed: "Reviewed 18 Apr 2026",
    accent: "coral",
    artwork: educationArt,
  },
  {
    id: "maha-ladki",
    name: "Majhi Ladki Bahin Yojana",
    nameHindi: "मुख्यमंत्री माझी लाडकी बहिन योजना",
    category: "Women & Family",
    categoryHindi: "महिला एवं परिवार",
    level: "State",
    administeringBody: "Government of Maharashtra",
    benefits: "Direct support for eligible women residents of Maharashtra, subject to current state criteria.",
    benefitsHindi: "वर्तमान राज्य मानदंडों के अधीन महाराष्ट्र की पात्र महिला निवासियों के लिए प्रत्यक्ष सहायता।",
    eligibility: { age_min: 21, age_max: 65, income_max: 250000, gender: ["Female"], states: ["Maharashtra"] },
    documents: ["Maharashtra residence proof", "Aadhaar-linked mobile", "Bank account and income declaration"],
    documentsHindi: ["महाराष्ट्र निवास प्रमाण", "आधार से जुड़ा मोबाइल", "बैंक खाता और आय घोषणा"],
    steps: ["Use the official state application channel", "Complete identity and bank verification", "Check the current government notice before applying"],
    stepsHindi: ["आधिकारिक राज्य आवेदन माध्यम का उपयोग करें", "पहचान और बैंक सत्यापन पूरा करें", "आवेदन से पहले वर्तमान सरकारी सूचना देखें"],
    portalUrl: "https://ladakibahin.maharashtra.gov.in/",
    reviewed: "Reviewed 11 Apr 2026",
    accent: "saffron",
    artwork: healthArt,
  },
];

export const categories = [
  { key: "all", label: "All schemes", labelHi: "सभी योजनाएँ", icon: "✳" },
  { key: "Agriculture", label: "Agriculture", labelHi: "कृषि", icon: "◒" },
  { key: "Education", label: "Education", labelHi: "शिक्षा", icon: "✎" },
  { key: "Health", label: "Health", labelHi: "स्वास्थ्य", icon: "+" },
  { key: "Women & Family", label: "Women & Family", labelHi: "महिला एवं परिवार", icon: "◌" },
  { key: "Livelihood", label: "Livelihood", labelHi: "आजीविका", icon: "↗" },
  { key: "Housing", label: "Housing", labelHi: "आवास", icon: "⌂" },
];

export const states = ["Andhra Pradesh", "Bihar", "Delhi", "Gujarat", "Haryana", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Odisha", "Punjab", "Rajasthan", "Tamil Nadu", "Telangana", "Uttar Pradesh", "Uttarakhand", "West Bengal"];
export const occupations = ["Farmer", "Student", "Unemployed", "Employee", "Business Owner", "Housewife", "Retired", "Self-Employed", "Government Employee", "Street Vendor", "Small Business", "Entrepreneur", "Other"];
export const casteCategories = ["General", "OBC", "SC", "ST", "EWS", "Other"];

export function scoreScheme(profile: UserProfile, scheme: Scheme) {
  const rule = scheme.eligibility;
  const factors: string[] = [];
  let score = 0;
  const add = (points: number, factor: string, matched: boolean) => {
    if (matched) {
      score += points;
      factors.push(factor);
    }
  };
  add(15, "age", rule.age_min === undefined || ((profile.age >= rule.age_min) && (rule.age_max === undefined || profile.age <= rule.age_max)));
  add(15, "income", rule.income_max === undefined || profile.annualIncome <= rule.income_max);
  add(18, "category", rule.caste_categories === undefined || rule.caste_categories === "all" || rule.caste_categories.includes(profile.caste) || rule.caste_categories.includes("all"));
  add(22, "work", rule.occupations === undefined || rule.occupations === "all" || rule.occupations.includes(profile.occupation) || (profile.isFarmer && rule.occupations.includes("Agriculture")));
  add(12, "state", rule.states === undefined || rule.states === "all" || rule.states.includes(profile.state));
  add(8, "gender", rule.gender === undefined || rule.gender === "all" || rule.gender.includes(profile.gender) || rule.gender.includes("all"));
  add(5, "student", rule.is_student !== true || profile.isStudent);
  add(5, "farmer", rule.is_farmer !== true || profile.isFarmer);
  add(5, "disability", rule.is_disabled !== true || profile.isDisabled);
  return { score: Math.min(100, Math.round(score)), factors };
}

export type ScoreBreakdownItem = { key: string; points: number; matched: boolean; english: string; hindi: string };
export function getScoreBreakdown(profile: UserProfile, scheme: Scheme): ScoreBreakdownItem[] {
  const rule = scheme.eligibility;
  const ageMatched = rule.age_min === undefined || (profile.age >= rule.age_min && (rule.age_max === undefined || profile.age <= rule.age_max));
  const incomeMatched = rule.income_max === undefined || profile.annualIncome <= rule.income_max;
  const categoryMatched = rule.caste_categories === undefined || rule.caste_categories === "all" || rule.caste_categories.includes(profile.caste) || rule.caste_categories.includes("all");
  const workMatched = rule.occupations === undefined || rule.occupations === "all" || rule.occupations.includes(profile.occupation) || (profile.isFarmer && rule.occupations.includes("Agriculture"));
  const stateMatched = rule.states === undefined || rule.states === "all" || rule.states.includes(profile.state);
  const genderMatched = rule.gender === undefined || rule.gender === "all" || rule.gender.includes(profile.gender) || rule.gender.includes("all");
  const ranges = (minimum?: number, maximum?: number) => minimum === undefined ? "any age" : maximum === undefined ? `age ${minimum}+` : `ages ${minimum}–${maximum}`;
  return [
    { key: "age", points: 15, matched: ageMatched, english: ageMatched ? `Your age (${profile.age}) fits the scheme’s ${ranges(rule.age_min, rule.age_max)} criteria.` : `Your age (${profile.age}) does not fit the scheme’s ${ranges(rule.age_min, rule.age_max)} criteria.`, hindi: ageMatched ? `आपकी आयु (${profile.age}) योजना की ${ranges(rule.age_min, rule.age_max)} पात्रता में आती है।` : `आपकी आयु (${profile.age}) योजना की ${ranges(rule.age_min, rule.age_max)} पात्रता में नहीं आती है।` },
    { key: "income", points: 15, matched: incomeMatched, english: incomeMatched ? "Your stated household income fits this scheme’s income criterion." : "Your stated household income is above this scheme’s listed income criterion.", hindi: incomeMatched ? "आपकी बताई घरेलू आय योजना के आय मानदंड में आती है।" : "आपकी बताई घरेलू आय योजना के सूचीबद्ध आय मानदंड से ऊपर है।" },
    { key: "category", points: 18, matched: categoryMatched, english: categoryMatched ? "Your social category is supported by this eligibility rule." : "Your selected social category did not add points under this eligibility rule.", hindi: categoryMatched ? "आपकी सामाजिक श्रेणी इस पात्रता नियम में शामिल है।" : "आपकी चुनी सामाजिक श्रेणी ने इस पात्रता नियम में अंक नहीं जोड़े।" },
    { key: "work", points: 22, matched: workMatched, english: workMatched ? "Your work profile matches the scheme’s supported occupation rule." : "Your work profile did not match this scheme’s listed occupation rule.", hindi: workMatched ? "आपका काम का प्रोफाइल योजना के समर्थित व्यवसाय नियम से मिलता है।" : "आपका काम का प्रोफाइल योजना के सूचीबद्ध व्यवसाय नियम से नहीं मिला।" },
    { key: "state", points: 12, matched: stateMatched, english: stateMatched ? "The scheme is available for your selected state or is open nationally." : "This scheme’s listed state coverage did not match your selected state.", hindi: stateMatched ? "योजना आपके चुने राज्य में उपलब्ध है या राष्ट्रीय स्तर पर खुली है।" : "योजना की सूचीबद्ध राज्य कवरेज आपके चुने राज्य से नहीं मिली।" },
    { key: "gender", points: 8, matched: genderMatched, english: genderMatched ? "Your selected gender fits this eligibility rule or the rule is open to all." : "Your selected gender did not add points under this eligibility rule.", hindi: genderMatched ? "आपका चुना लिंग इस पात्रता नियम में आता है या नियम सभी के लिए खुला है।" : "आपके चुने लिंग ने इस पात्रता नियम में अंक नहीं जोड़े।" },
    { key: "student", points: 5, matched: rule.is_student !== true || profile.isStudent, english: rule.is_student !== true || profile.isStudent ? "Student status fits this rule or is not required." : "This scheme requires student status, which is not selected in your profile.", hindi: rule.is_student !== true || profile.isStudent ? "छात्र स्थिति इस नियम से मेल खाती है या आवश्यक नहीं है।" : "इस योजना में छात्र स्थिति चाहिए, जो आपके प्रोफाइल में चयनित नहीं है।" },
    { key: "farmer", points: 5, matched: rule.is_farmer !== true || profile.isFarmer, english: rule.is_farmer !== true || profile.isFarmer ? "Farmer status fits this rule or is not required." : "This scheme requires farmer status, which is not selected in your profile.", hindi: rule.is_farmer !== true || profile.isFarmer ? "किसान स्थिति इस नियम से मेल खाती है या आवश्यक नहीं है।" : "इस योजना में किसान स्थिति चाहिए, जो आपके प्रोफाइल में चयनित नहीं है।" },
    { key: "disability", points: 5, matched: rule.is_disabled !== true || profile.isDisabled, english: rule.is_disabled !== true || profile.isDisabled ? "Disability status fits this rule or is not required." : "This scheme requires disability status, which is not selected in your profile.", hindi: rule.is_disabled !== true || profile.isDisabled ? "दिव्यांग स्थिति इस नियम से मेल खाती है या आवश्यक नहीं है।" : "इस योजना में दिव्यांग स्थिति चाहिए, जो आपके प्रोफाइल में चयनित नहीं है।" },
  ];
}

export function getDeadlineUrgency(deadline?: number | null, now = Date.now()) {
  if (!deadline) return { state: "none" as const, days: null };
  if (deadline < now) return { state: "closed" as const, days: Math.floor((deadline - now) / 86_400_000) };
  const days = Math.ceil((deadline - now) / 86_400_000);
  if (days <= 30) return { state: "closingSoon" as const, days };
  return { state: "open" as const, days };
}

export function getTier(score: number) {
  if (score >= 85) return { label: "Strong match", labelHi: "बहुत अच्छा मिलान", tone: "strong" };
  if (score >= 70) return { label: "Good match", labelHi: "अच्छा मिलान", tone: "good" };
  return { label: "Worth checking", labelHi: "जाँचने योग्य", tone: "check" };
}

export const factorLabels: Record<string, [string, string]> = {
  age: ["Age fits", "आयु अनुकूल है"],
  income: ["Income criteria", "आय मानदंड"],
  category: ["Category supported", "श्रेणी समर्थित है"],
  work: ["Work profile", "काम का प्रोफाइल"],
  state: ["State coverage", "राज्य में लागू"],
  gender: ["Gender criteria", "लिंग मानदंड"],
  student: ["Student status", "छात्र स्थिति"],
  farmer: ["Farmer status", "किसान स्थिति"],
  disability: ["Disability support", "दिव्यांग सहायता"],
};
