export type DiscoverLanguage = "en" | "hi";

const providerHindi: Record<string, string> = {
  "All India Council for Technical Education": "अखिल भारतीय तकनीकी शिक्षा परिषद (एआईसीटीई)",
  "Department of Agriculture & Farmers Welfare": "कृषि एवं किसान कल्याण विभाग",
  "Department of Agriculture Research and Education": "कृषि अनुसंधान एवं शिक्षा विभाग",
  "Department of Empowerment of Persons with Disabilities": "दिव्यांगजन सशक्तिकरण विभाग",
  "Department of Financial Services": "वित्तीय सेवा विभाग",
  "Department of Higher Education": "उच्च शिक्षा विभाग",
  "Department of School Education & Literacy": "स्कूली शिक्षा एवं साक्षरता विभाग",
  "Department of Social Justice & Empowerment": "सामाजिक न्याय एवं अधिकारिता विभाग",
  "Department of Social Justice & Empowerment (Backward Classes)": "सामाजिक न्याय एवं अधिकारिता विभाग (पिछड़ा वर्ग)",
  "Government of Maharashtra": "महाराष्ट्र सरकार",
  "Government of Uttar Pradesh": "उत्तर प्रदेश सरकार",
  "Ministry of Agriculture & Farmers Welfare": "कृषि एवं किसान कल्याण मंत्रालय",
  "Ministry of Education": "शिक्षा मंत्रालय",
  "Ministry of Home Affairs": "गृह मंत्रालय",
  "Ministry of Housing & Urban Affairs": "आवास एवं शहरी कार्य मंत्रालय",
  "Ministry of Labour & Employment": "श्रम एवं रोजगार मंत्रालय",
  "Ministry of New and Renewable Energy": "नवीन एवं नवीकरणीय ऊर्जा मंत्रालय",
  "Ministry of Petroleum & Natural Gas": "पेट्रोलियम एवं प्राकृतिक गैस मंत्रालय",
  "Ministry of Railways": "रेल मंत्रालय",
  "Ministry of Rural Development": "ग्रामीण विकास मंत्रालय",
  "Ministry of Statistics and Programme Implementation": "सांख्यिकी एवं कार्यक्रम कार्यान्वयन मंत्रालय",
  "Ministry of Tribal Affairs": "जनजातीय कार्य मंत्रालय",
  "National Health Authority": "राष्ट्रीय स्वास्थ्य प्राधिकरण",
  "North Eastern Council, DoNER": "पूर्वोत्तर परिषद, डोनर",
  "University Grants Commission": "विश्वविद्यालय अनुदान आयोग (यूजीसी)",
};

const stateHindi: Record<string, string> = {
  "Andhra Pradesh": "आंध्र प्रदेश",
  Bihar: "बिहार",
  Delhi: "दिल्ली",
  Gujarat: "गुजरात",
  Haryana: "हरियाणा",
  Jharkhand: "झारखंड",
  Karnataka: "कर्नाटक",
  Kerala: "केरल",
  "Madhya Pradesh": "मध्य प्रदेश",
  Maharashtra: "महाराष्ट्र",
  Odisha: "ओडिशा",
  Punjab: "पंजाब",
  Rajasthan: "राजस्थान",
  "Tamil Nadu": "तमिलनाडु",
  Telangana: "तेलंगाना",
  "Uttar Pradesh": "उत्तर प्रदेश",
  Uttarakhand: "उत्तराखंड",
  "West Bengal": "पश्चिम बंगाल",
};

const labels = {
  refine: ["Refine schemes", "योजनाएँ छाँटें"],
  clear: ["Clear", "साफ़ करें"],
  search: ["Search", "खोजें"],
  searchPlaceholder: ["Scheme, benefit or provider", "योजना, लाभ या विभाग खोजें"],
  state: ["State / UT", "राज्य / केंद्रशासित प्रदेश"],
  category: ["Category", "श्रेणी"],
  schemeLevel: ["Scheme level", "योजना स्तर"],
  providerArea: ["Provider area", "संचालक विभाग"],
  sourceStatus: ["Source status", "स्रोत स्थिति"],
  deadline: ["Application deadline", "आवेदन की अंतिम तिथि"],
  sort: ["Sort by", "क्रमबद्ध करें"],
  allProviders: ["All ministries and providers", "सभी मंत्रालय और विभाग"],
  allSources: ["All source statuses", "सभी स्रोत स्थितियाँ"],
  officialDirectory: ["Official directory listed", "आधिकारिक निर्देशिका में सूचीबद्ध"],
  eligibilityVerified: ["Eligibility verified", "पात्रता सत्यापित"],
  allLevels: ["Central and state schemes", "केंद्रीय और राज्य योजनाएँ"],
  central: ["Central schemes", "केंद्रीय योजनाएँ"],
  stateLevel: ["State schemes", "राज्य योजनाएँ"],
  allDeadlines: ["Any deadline status", "किसी भी समयसीमा की स्थिति"],
  closingSoon: ["Closing within 90 days", "90 दिनों के भीतर बंद होगी"],
  announced: ["Deadline announced", "समयसीमा घोषित"],
  openEnded: ["No deadline announced", "समयसीमा घोषित नहीं"],
  deadlineSoonest: ["Deadline soonest", "सबसे नज़दीकी समयसीमा"],
  recentlyReviewed: ["Recently reviewed", "हाल ही में जाँची गई"],
  providerSort: ["Provider area", "संचालक विभाग"],
  name: ["Name", "नाम"],
  categorySort: ["Category", "श्रेणी"],
} as const;

export function discoverLabel(key: keyof typeof labels, language: DiscoverLanguage) {
  return labels[key][language === "hi" ? 1 : 0];
}

export function providerDisplayLabel(provider: string, language: DiscoverLanguage) {
  return language === "hi" ? providerHindi[provider] ?? provider : provider;
}

export function stateDisplayLabel(state: string, language: DiscoverLanguage) {
  return language === "hi" ? stateHindi[state] ?? state : state;
}
