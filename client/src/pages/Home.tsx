import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  CalendarClock,
  CalendarPlus,
  Check,
  ChevronDown,
  ClipboardCheck,
  ExternalLink,
  FileDown,
  Filter,
  HeartHandshake,
  Languages,
  ListFilter,
  Menu,
  MessageCircle,
  Moon,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  categories,
  casteCategories,
  factorLabels,
  getDeadlineUrgency,
  getTier,
  occupations,
  schemes,
  scoreScheme,
  states,
  type Scheme,
  type UserProfile,
} from "@/lib/schemes";
import { SchemeHelpDrawer } from "@/components/SchemeHelpDrawer";
import { ScoreExplanationModal } from "@/components/ScoreExplanationModal";
import { SchemeComparisonModal } from "@/components/SchemeComparisonModal";
import { PwaInstallButton } from "@/components/PwaInstallButton";
import { OfflineSavedDeadlineReminders } from "@/components/OfflineSavedDeadlineReminders";
import { SchemeSharePreviewCard } from "@/components/SchemeSharePreviewCard";
import { createDeadlineCalendarIcs, downloadTextFile } from "@/lib/schemeExports";
import { createOfflineSavedSchemesSnapshot, readOfflineSavedSchemesSnapshot, sortOfflineSavedSchemes, writeOfflineSavedSchemesSnapshot, type OfflineSavedSchemesSnapshot } from "@/lib/offlineSavedSchemes";
import { createSchemeShareUrl } from "@/lib/schemeSharing";
import "./SchemeActionEnhancements.css";

type Language = "en" | "hi";
type Screen = "home" | "profile" | "results" | "details" | "offlineSaved";
type MatchedScheme = Scheme & { score: number; factors: string[] };
const text = (language: Language, english: string, hindi: string) =>
  language === "hi" ? hindi : english;
const mark = "/manus-storage/scheme-sathi-mark_a9a3e063.png";
const hero = "/manus-storage/scheme-sathi-hero_aeb278a7.png";
const dateFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const defaultProfile: UserProfile = {
  age: 28,
  state: "",
  caste: "",
  annualIncome: 250000,
  occupation: "",
  gender: "",
  isStudent: false,
  isFarmer: false,
  isDisabled: false,
};

function toClientScheme(value: any): Scheme {
  return {
    ...value,
    eligibility: {
      age_min: value.eligibility.ageMin,
      age_max: value.eligibility.ageMax,
      income_max: value.eligibility.incomeMax,
      caste_categories: value.eligibility.casteCategories,
      occupations: value.eligibility.occupations,
      states: value.eligibility.states,
      gender: value.eligibility.genders,
      is_student: value.eligibility.requiresStudent,
      is_farmer: value.eligibility.requiresFarmer,
      is_disabled: value.eligibility.requiresDisability,
    },
  } as Scheme;
}
function SectionKicker({ children }: { children: React.ReactNode }) {
  return (
    <div className="section-kicker">
      <span />
      {children}
    </div>
  );
}
function DeadlineBanner({
  scheme,
  language,
  compact = false,
}: {
  scheme: Scheme;
  language: Language;
  compact?: boolean;
}) {
  const urgency = getDeadlineUrgency(scheme.applicationDeadline);
  if (urgency.state === "none" || urgency.state === "open") return null;
  const closing = urgency.state === "closed";
  return (
    <div
      className={`deadline-urgency ${closing ? "closed" : ""} ${compact ? "compact" : ""}`}
    >
      <CalendarClock size={compact ? 13 : 16} />
      <span>
        {closing
          ? text(language, "Applications closed", "आवेदन बंद हो चुके हैं")
          : text(
              language,
              `Closing in ${urgency.days} ${urgency.days === 1 ? "day" : "days"} — apply before ${dateFormat.format(new Date(scheme.applicationDeadline!))}`,
              `${urgency.days} दिन में बंद — ${dateFormat.format(new Date(scheme.applicationDeadline!))} से पहले आवेदन करें`
            )}
      </span>
    </div>
  );
}

function AppHeader({
  language,
  setLanguage,
  dark,
  setDark,
  onHome,
  onStart,
  onOfflineSaved,
  offlineSavedCount,
  authenticated,
  name,
  onLogout,
}: {
  language: Language;
  setLanguage: (language: Language) => void;
  dark: boolean;
  setDark: (value: boolean) => void;
  onHome: () => void;
  onStart: () => void;
  onOfflineSaved: () => void;
  offlineSavedCount: number;
  authenticated: boolean;
  name?: string | null;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <div className="header-inner">
        <button
          className="brand"
          onClick={onHome}
          aria-label={text(
            language,
            "Go to Scheme Sathi home",
            "Scheme Sathi होम पर जाएँ"
          )}
        >
          <span className="brand-mark">
            <img src={mark} alt="" />
          </span>
          <span>
            <strong>Scheme Sathi</strong>
            <small>
              {text(
                language,
                "Government schemes, made clear.",
                "सरकारी योजनाएँ, आसान भाषा में।"
              )}
            </small>
          </span>
        </button>
        <nav className={`site-nav ${open ? "is-open" : ""}`}>
          <button
            onClick={() => {
              window.location.assign("/discover");
              setOpen(false);
            }}
            aria-label={text(language, "Discover schemes", "योजनाएँ खोजें")}
          >
            {text(language, "Discover", "खोजें")}
          </button>
          <button
            onClick={() => {
              onStart();
              setOpen(false);
            }}
            aria-label={text(language, "Find my matches", "मेरे मिलान खोजें")}
          >
            {text(language, "Find my matches", "मेरे लिए खोजें")}
          </button>
          <a href="#how-it-works" onClick={() => setOpen(false)}>
            {text(language, "How it works", "कैसे काम करता है")}
          </a>
          <button
            onClick={() => {
              onOfflineSaved();
              setOpen(false);
            }}
            aria-label={text(language, "Open saved schemes available offline", "ऑफ़लाइन सहेजी योजनाएँ खोलें")}
          >
            <Bookmark size={14} /> {text(language, `Saved (${offlineSavedCount})`, `सहेजी गई (${offlineSavedCount})`)}
          </button>
        </nav>
        <div className="header-actions">
          <PwaInstallButton language={language} />
          <button
            className={`account-button ${authenticated ? "signed-in" : ""}`}
            onClick={authenticated ? onLogout : startLogin}
            aria-label={
              authenticated
                ? text(language, "Sign out", "साइन आउट")
                : text(language, "Sign in", "साइन इन")
            }
          >
            {<ShieldCheck size={15} />}
            <span>
              {authenticated
                ? name || text(language, "Account", "अकाउंट")
                : text(language, "Sign in", "साइन इन")}
            </span>
          </button>
          <button
            className="language-button"
            onClick={() => setLanguage(language === "en" ? "hi" : "en")}
            aria-label={text(
              language,
              "Switch to Hindi",
              "अंग्रेज़ी में बदलें"
            )}
          >
            <Languages size={16} />
            <span>{language === "en" ? "हिन्दी" : "English"}</span>
          </button>
          <button
            className="icon-button"
            onClick={() => setDark(!dark)}
            aria-label={text(language, "Toggle colour theme", "रंग थीम बदलें")}
          >
            {dark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button
            className="menu-button icon-button"
            onClick={() => setOpen(!open)}
            aria-label={text(language, "Open navigation", "नेविगेशन खोलें")}
          >
            <Menu size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}

function HomeScreen({
  language,
  onStart,
  onBrowse,
  saved,
  catalog,
}: {
  language: Language;
  onStart: () => void;
  onBrowse: (category: string) => void;
  saved: string[];
  catalog: Scheme[];
}) {
  return (
    <main>
      <section className="hero-section">
        <div className="hero-copy">
          <SectionKicker>
            {text(
              language,
              "A clearer way to access your rights",
              "सरकारी योजनाओं को समझने का आसान तरीका"
            )}
          </SectionKicker>
          <h1>
            {text(
              language,
              "Find the help that was made for you.",
              "आपके लिए बनी मदद खोजें।"
            )}
          </h1>
          <p className="hero-lede">
            {text(
              language,
              "Explore government schemes by need, not by paperwork. Tell us a little about yourself and we’ll surface benefits worth checking.",
              "कागज़ी भाषा नहीं, अपनी ज़रूरत के हिसाब से सरकारी योजनाएँ खोजें। अपने बारे में थोड़ा बताइए और हम उपयोगी योजनाएँ सामने लाएँगे।"
            )}
          </p>
          <div className="hero-actions">
            <button
              className="button button-primary"
              onClick={onStart}
              aria-label={text(
                language,
                "Find my schemes",
                "मेरे लिए योजनाएँ खोजें"
              )}
            >
              {text(language, "Find my schemes", "मेरे लिए योजनाएँ खोजें")}
              <ArrowRight size={18} />
            </button>
            <a className="text-link" href="#how-it-works">
              {text(language, "See how it works", "जानें कैसे काम करता है")}
              <ArrowRight size={16} />
            </a>
          </div>
          <div className="hero-proof">
            <span>
              <ShieldCheck size={16} />
              {text(language, "Private by default", "आपकी जानकारी सुरक्षित")}
            </span>
            <span>
              <Zap size={16} />
              {text(language, "Takes about 3 min", "लगभग 3 मिनट")}
            </span>
          </div>
        </div>
        <div className="hero-art-wrap">
          <div className="hero-art-note note-top">
            01 <span>Guided discovery</span>
          </div>
          <img
            className="hero-art"
            src={hero}
            alt={text(
              language,
              "A family exploring public benefits",
              "सरकारी लाभों को समझता परिवार"
            )}
          />
          <div className="hero-art-note note-bottom">
            <span>Built for every Indian household</span>भारत के हर परिवार के
            लिए
          </div>
        </div>
      </section>
      <section className="trust-strip">
        <div>
          <strong>Scheme Sathi</strong>
          <span>
            {text(
              language,
              "A simple guide to public benefits",
              "सरकारी लाभों का सरल साथी"
            )}
          </span>
        </div>
        <div className="trust-items">
          <span>
            <ShieldCheck size={17} />
            {text(language, "No sign-up required", "साइन-अप ज़रूरी नहीं")}
          </span>
          <span>
            <ClipboardCheck size={17} />
            {text(language, "Source-aware guidance", "स्रोत आधारित जानकारी")}
          </span>
          <span>
            <HeartHandshake size={17} />
            {text(
              language,
              "Built around how people apply",
              "लोगों के आवेदन के तरीके पर बना"
            )}
          </span>
        </div>
      </section>
      <section className="section-block category-block">
        <div className="section-heading-row">
          <div>
            <SectionKicker>
              {text(
                language,
                "Start with what matters",
                "अपनी ज़रूरत से शुरू करें"
              )}
            </SectionKicker>
            <h2>
              {text(
                language,
                "Support for the season you’re in.",
                "आपकी ज़िंदगी के इस पड़ाव के लिए मदद।"
              )}
            </h2>
          </div>
          <button
            className="text-link"
            onClick={() => onBrowse("all")}
            aria-label={text(
              language,
              "Browse all schemes",
              "सभी योजनाएँ देखें"
            )}
          >
            {text(language, "Browse all schemes", "सभी योजनाएँ देखें")}
            <ArrowRight size={15} />
          </button>
        </div>
        <div className="category-shelf">
          {categories.slice(1).map((category, index) => (
            <button
              key={category.key}
              className={`category-tile ${index === 0 ? "category-featured" : ""}`}
              onClick={() => onBrowse(category.key)}
              aria-label={text(
                language,
                `Browse ${category.label}`,
                `${category.labelHi} देखें`
              )}
            >
              <span className="category-index">0{index + 1}</span>
              <span className="category-icon">{category.icon}</span>
              <span>
                <strong>
                  {text(language, category.label, category.labelHi)}
                </strong>
                <small>
                  {
                    catalog.filter(scheme => scheme.category === category.key)
                      .length
                  }{" "}
                  {text(language, "schemes", "योजनाएँ")}
                </small>
              </span>
              <ArrowRight size={15} />
            </button>
          ))}
        </div>
      </section>
      <section id="how-it-works" className="how-section">
        <div className="how-heading">
          <SectionKicker>
            {text(language, "How it works", "कैसे काम करता है")}
          </SectionKicker>
          <h2>
            {text(
              language,
              "From ‘maybe’ to ‘I know what to do.’",
              "‘शायद’ से ‘अब पता है क्या करना है।’ तक।"
            )}
          </h2>
        </div>
        <div className="how-steps">
          {[
            ["Tell us about you", "अपने बारे में बताएँ"],
            ["See your strongest matches", "सबसे अच्छे मिलान देखें"],
            ["Take the next step", "अगला कदम उठाएँ"],
          ].map(([en, hi], index) => (
            <div className="how-step" key={en}>
              <span>{index + 1}</span>
              <div>
                <h3>{text(language, en, hi)}</h3>
                <p>
                  {text(
                    language,
                    "Clear guidance, matched to the details you choose to share.",
                    "स्पष्ट मार्गदर्शन, आपकी चुनी जानकारी के आधार पर।"
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
        <button
          className="button button-primary how-cta"
          onClick={onStart}
          aria-label={text(
            language,
            "Start my three minute check",
            "मेरी तीन मिनट की जाँच शुरू करें"
          )}
        >
          {text(
            language,
            "Start my 3-minute check",
            "3 मिनट की जाँच शुरू करें"
          )}
          <ArrowRight size={18} />
        </button>
      </section>
      <section className="footer-band">
        <div>
          <img src={mark} alt="" />
          <strong>Scheme Sathi</strong>
        </div>
        <span>
          {text(
            language,
            "Always verify current criteria on the official portal before applying.",
            "आवेदन से पहले आधिकारिक पोर्टल पर वर्तमान मानदंड ज़रूर जाँचें।"
          )}
        </span>
        <span className="saved-count">
          <Bookmark size={15} />
          {saved.length} {text(language, "saved", "सहेजी गई")}
        </span>
      </section>
    </main>
  );
}

function ProfileScreen({
  language,
  profile,
  setProfile,
  onBack,
  onSubmit,
  pending,
}: {
  language: Language;
  profile: UserProfile;
  setProfile: (profile: UserProfile) => void;
  onBack: () => void;
  onSubmit: () => void;
  pending: boolean;
}) {
  const [step, setStep] = useState(1);
  const update = (patch: Partial<UserProfile>) =>
    setProfile({ ...profile, ...patch });
  const canContinue =
    step !== 1 || Boolean(profile.age && profile.state && profile.gender);
  return (
    <main className="profile-page">
      <div className="profile-intro">
        <button
          className="back-link"
          onClick={step === 1 ? onBack : () => setStep(step - 1)}
          aria-label={text(language, "Go back", "वापस जाएँ")}
        >
          <ArrowLeft size={16} />
          {text(language, "Back", "वापस")}
        </button>
        <SectionKicker>
          {text(language, "Your personal shortlist", "आपकी व्यक्तिगत सूची")}
        </SectionKicker>
        <h1>
          {text(
            language,
            "Let’s make this useful for you.",
            "इसे आपके लिए उपयोगी बनाते हैं।"
          )}
        </h1>
        <p>
          {text(
            language,
            "Answer a few questions. We use them only to explain which schemes are worth checking first.",
            "कुछ सवालों के जवाब दें। इनका उपयोग केवल यह बताने के लिए होगा कि किन योजनाओं को पहले जाँचना चाहिए।"
          )}
        </p>
      </div>
      <div className="profile-card">
        <div className="progress-wrap">
          <div className="progress-label">
            <span>
              {text(language, `Step ${step} of 3`, `चरण ${step} / 3`)}
            </span>
            <strong>{["Basics", "Profile", "Situation"][step - 1]}</strong>
          </div>
          <div className="progress-line">
            <span style={{ width: `${(step / 3) * 100}%` }} />
          </div>
        </div>
        <div className="form-body">
          {step === 1 && (
            <div className="form-step">
              <div className="step-heading">
                <span className="step-count">01</span>
                <div>
                  <h2>{text(language, "The basics", "बेसिक्स")}</h2>
                  <p>
                    {text(
                      language,
                      "Start with age, state and how we should refer to you.",
                      "आयु, राज्य और आपको कैसे संबोधित करें से शुरुआत करें।"
                    )}
                  </p>
                </div>
              </div>
              <div className="field-grid">
                <label className="field">
                  <span>{text(language, "Your age", "आपकी आयु")}</span>
                  <input
                    aria-label={text(language, "Your age", "आपकी आयु")}
                    type="number"
                    min="0"
                    max="120"
                    value={profile.age || ""}
                    onChange={event =>
                      update({ age: Number(event.target.value) })
                    }
                  />
                </label>
                <label className="field">
                  <span>
                    {text(language, "State / UT", "राज्य / केंद्रशासित प्रदेश")}
                  </span>
                  <select
                    aria-label={text(
                      language,
                      "State or Union Territory",
                      "राज्य या केंद्रशासित प्रदेश"
                    )}
                    value={profile.state}
                    onChange={event => update({ state: event.target.value })}
                  >
                    <option value="">
                      {text(language, "Choose your state", "अपना राज्य चुनें")}
                    </option>
                    {states.map(state => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <fieldset className="choice-field">
                <legend>
                  {text(
                    language,
                    "How should we refer to you?",
                    "आपको किस तरह संबोधित करें?"
                  )}
                </legend>
                <div className="choice-row">
                  {[
                    ["Female", "Woman", "महिला"],
                    ["Male", "Man", "पुरुष"],
                    ["Other", "Other", "अन्य"],
                  ].map(([value, en, hi]) => (
                    <button
                      type="button"
                      key={value}
                      className={`choice-button ${profile.gender === value ? "selected" : ""}`}
                      onClick={() => update({ gender: value })}
                      aria-label={text(language, en, hi)}
                    >
                      {profile.gender === value && <Check size={16} />}
                      {text(language, en, hi)}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
          )}
          {step === 2 && (
            <div className="form-step">
              <div className="step-heading">
                <span className="step-count">02</span>
                <div>
                  <h2>{text(language, "Your day-to-day", "आपका प्रोफाइल")}</h2>
                  <p>
                    {text(
                      language,
                      "A broad picture is enough.",
                      "सामान्य जानकारी ही काफी है।"
                    )}
                  </p>
                </div>
              </div>
              <div className="field-grid">
                <label className="field">
                  <span>
                    {text(language, "Social category", "सामाजिक श्रेणी")}
                  </span>
                  <select
                    aria-label={text(
                      language,
                      "Social category",
                      "सामाजिक श्रेणी"
                    )}
                    value={profile.caste}
                    onChange={event => update({ caste: event.target.value })}
                  >
                    <option value="">
                      {text(language, "Choose a category", "श्रेणी चुनें")}
                    </option>
                    {casteCategories.map(item => (
                      <option value={item} key={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>
                    {text(
                      language,
                      "Annual household income",
                      "वार्षिक घरेलू आय"
                    )}
                  </span>
                  <input
                    aria-label={text(
                      language,
                      "Annual household income",
                      "वार्षिक घरेलू आय"
                    )}
                    type="number"
                    min="0"
                    value={profile.annualIncome || ""}
                    onChange={event =>
                      update({ annualIncome: Number(event.target.value) })
                    }
                  />
                </label>
              </div>
              <label className="field field-wide">
                <span>
                  {text(language, "Primary occupation", "मुख्य काम / व्यवसाय")}
                </span>
                <select
                  aria-label={text(language, "Primary occupation", "मुख्य काम")}
                  value={profile.occupation}
                  onChange={event => update({ occupation: event.target.value })}
                >
                  <option value="">
                    {text(language, "Choose your work", "अपना काम चुनें")}
                  </option>
                  {occupations.map(item => (
                    <option value={item} key={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {step === 3 && (
            <div className="form-step">
              <div className="step-heading">
                <span className="step-count">03</span>
                <div>
                  <h2>{text(language, "Your situation", "आपकी स्थिति")}</h2>
                  <p>
                    {text(
                      language,
                      "Optional details can uncover support that is easy to miss.",
                      "वैकल्पिक जानकारी अक्सर छूट जाने वाली सहायता खोज सकती है।"
                    )}
                  </p>
                </div>
              </div>
              <div className="status-grid">
                {[
                  ["isStudent", "I’m a student", "मैं छात्र / छात्रा हूँ"],
                  ["isFarmer", "I’m a farmer", "मैं किसान हूँ"],
                  ["isDisabled", "I have a disability", "मैं दिव्यांग हूँ"],
                ].map(([key, en, hi]) => {
                  const active = profile[key as keyof UserProfile] as boolean;
                  return (
                    <button
                      type="button"
                      key={key}
                      className={`status-card ${active ? "selected" : ""}`}
                      onClick={() => update({ [key]: !active })}
                      aria-label={text(language, en, hi)}
                    >
                      <span>
                        <strong>{text(language, en, hi)}</strong>
                        <small>
                          {active
                            ? text(
                                language,
                                "Included in your match",
                                "आपके मिलान में शामिल"
                              )
                            : text(
                                language,
                                "Tap to include",
                                "शामिल करने के लिए चुनें"
                              )}
                        </small>
                      </span>
                      {active ? (
                        <Check size={17} />
                      ) : (
                        <span className="status-empty" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="form-actions">
          <button
            className="button button-quiet"
            onClick={step === 1 ? onBack : () => setStep(step - 1)}
            disabled={pending}
          >
            {text(language, "Back", "वापस")}
          </button>
          {step < 3 ? (
            <button
              className="button button-primary"
              disabled={!canContinue || pending}
              onClick={() => setStep(step + 1)}
            >
              {text(language, "Continue", "आगे बढ़ें")}
              <ArrowRight size={18} />
            </button>
          ) : (
            <button
              className="button button-primary"
              disabled={pending}
              onClick={onSubmit}
            >
              {pending
                ? text(language, "Finding matches…", "मिलान खोज रहे हैं…")
                : text(language, "Show my matches", "मेरे मिलान दिखाएँ")}
              <Sparkles size={17} />
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

function ScorePill({
  score,
  language,
  onExplain,
}: {
  score: number;
  language: Language;
  onExplain?: () => void;
}) {
  const tier = getTier(score);
  return (
    <button
      className={`score-pill ${tier.tone} ${onExplain ? "score-pill-button" : ""}`}
      onClick={onExplain}
      disabled={!onExplain}
      aria-label={
        onExplain
          ? text(
              language,
              `Explain ${score} match score`,
              `${score} मिलान स्कोर समझें`
            )
          : undefined
      }
    >
      <strong>{score}</strong>
      <span>{text(language, tier.label, tier.labelHi)}</span>
    </button>
  );
}
function SchemeCard({
  scheme,
  language,
  saved,
  comparing,
  onSave,
  onOpen,
  onShare,
  onToggleCompare,
  onExplain,
  lead,
}: {
  scheme: MatchedScheme;
  language: Language;
  saved: boolean;
  comparing: boolean;
  onSave: () => void;
  onOpen: () => void;
  onShare: () => void;
  onToggleCompare: () => void;
  onExplain: () => void;
  lead?: boolean;
}) {
  const urgency = getDeadlineUrgency(scheme.applicationDeadline);
  const shareCardScheme = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onShare();
  };
  return (
    <article
      className={`scheme-card ${lead ? "scheme-card-lead" : ""} ${urgency.state === "closed" ? "scheme-closed" : ""}`}
      onClick={onOpen}
    >
      <DeadlineBanner scheme={scheme} language={language} compact />
      <div className="scheme-card-top">
        <span className={`category-tag ${scheme.accent}`}>
          {text(language, scheme.category, scheme.categoryHindi)}
        </span>
        <div className="scheme-card-actions">
          <button
            className={`compare-toggle ${comparing ? "selected" : ""}`}
            onClick={event => {
              event.stopPropagation();
              onToggleCompare();
            }}
            aria-label={text(
              language,
              comparing
                ? `Remove ${scheme.name} from comparison`
                : `Add ${scheme.name} to comparison`,
              comparing
                ? `${scheme.nameHindi} को तुलना से हटाएँ`
                : `${scheme.nameHindi} को तुलना में जोड़ें`
            )}
          >
            <Check size={13} />
            {text(
              language,
              comparing ? "Selected" : "Compare",
              comparing ? "चुनी गई" : "तुलना"
            )}
          </button>
          <button
            className={`save-button ${saved ? "saved" : ""}`}
            onClick={event => {
              event.stopPropagation();
              onSave();
            }}
            aria-label={text(
              language,
              saved ? "Remove saved scheme" : "Save scheme",
              saved ? "सहेजी योजना हटाएँ" : "योजना सहेजें"
            )}
            >
              <Bookmark size={17} fill={saved ? "currentColor" : "none"} />
            </button>
            <button
              className="share-scheme-card"
              onClick={shareCardScheme}
              aria-label={text(language, `Share ${scheme.name}`, `${scheme.nameHindi} साझा करें`)}
            >
              <Share2 size={16} />
            </button>
          </div>
      </div>
      <div className="scheme-card-content">
        <div className="scheme-card-copy">
          <h3>{text(language, scheme.name, scheme.nameHindi)}</h3>
          <p>{text(language, scheme.benefits, scheme.benefitsHindi)}</p>
          <div className="factor-list">
            {scheme.factors.slice(0, lead ? 4 : 3).map(factor => (
              <span key={factor}>
                <Check size={13} />
                {text(
                  language,
                  factorLabels[factor]?.[0] ?? factor,
                  factorLabels[factor]?.[1] ?? factor
                )}
              </span>
            ))}
          </div>
          <div className="scheme-meta">
            <span>
              {scheme.level} {text(language, "scheme", "योजना")}
            </span>
            <span>•</span>
            <span>{scheme.administeringBody}</span>
          </div>
        </div>
        {lead && (
          <div className="lead-score">
            <ScorePill
              score={scheme.score}
              language={language}
              onExplain={onExplain}
            />
          </div>
        )}
      </div>
      <button
        className="card-cta"
        aria-label={text(
          language,
          `View ${scheme.name}`,
          `${scheme.nameHindi} देखें`
        )}
      >
        {text(language, "View scheme details", "योजना का विवरण देखें")}
        <ArrowRight size={15} />
      </button>
    </article>
  );
}

function ResultsScreen({
  language,
  profile,
  catalog,
  serverMatches,
  saved,
  authenticated,
  onSave,
  onOpen,
  onShare,
  onBack,
  initialCategory,
}: {
  language: Language;
  profile: UserProfile;
  catalog: Scheme[];
  serverMatches: MatchedScheme[];
  saved: string[];
  authenticated: boolean;
  onSave: (id: string) => void;
  onOpen: (scheme: MatchedScheme) => void;
  onShare: (scheme: Scheme) => void;
  onBack: () => void;
  initialCategory: string;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(initialCategory);
  const [level, setLevel] = useState("all");
  const [sort, setSort] = useState("score");
  const [mobileFilters, setMobileFilters] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [explain, setExplain] = useState<MatchedScheme | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const scored = useMemo(
    () =>
      serverMatches.length
        ? serverMatches
        : catalog
            .map(scheme => ({ ...scheme, ...scoreScheme(profile, scheme) }))
            .filter(scheme => scheme.score >= 45),
    [catalog, profile, serverMatches]
  );
  const results = useMemo(
    () =>
      [...scored]
        .filter(
          scheme =>
            (category === "all" || scheme.category === category) &&
            (level === "all" || scheme.level === level) &&
            `${scheme.name} ${scheme.nameHindi} ${scheme.benefits}`
              .toLowerCase()
              .includes(query.toLowerCase())
        )
        .sort((a, b) =>
          sort === "name"
            ? a.name.localeCompare(b.name)
            : sort === "category"
              ? a.category.localeCompare(b.category)
              : b.score - a.score
        ),
    [scored, category, level, query, sort]
  );
  const strong = results.filter(scheme => scheme.score >= 70);
  const lead = strong[0] ?? results[0];
  const selectedSchemes = scored.filter(scheme =>
    selectedForCompare.includes(scheme.id)
  );
  const toggleCompare = (id: string) =>
    setSelectedForCompare(current =>
      current.includes(id)
        ? current.filter(item => item !== id)
        : current.length >= 3
          ? (toast.message(
              text(
                language,
                "You can compare up to three schemes at a time.",
                "आप एक साथ अधिकतम तीन योजनाओं की तुलना कर सकते हैं।"
              )
            ),
            current)
          : [...current, id]
    );
  return (
    <main className="results-page">
      <div className="results-hero">
        <div>
          <button
            className="back-link"
            onClick={onBack}
            aria-label={text(language, "Edit my answers", "मेरे जवाब बदलें")}
          >
            <ArrowLeft size={16} />
            {text(language, "Edit my answers", "अपने जवाब बदलें")}
          </button>
          <SectionKicker>
            {text(language, "Your personal shortlist", "आपकी व्यक्तिगत सूची")}
          </SectionKicker>
          <h1>
            {text(
              language,
              `You have ${results.length} schemes worth exploring.`,
              `आपके लिए ${results.length} योजनाएँ मिली हैं।`
            )}
          </h1>
          <p>
            {text(
              language,
              "Start with a strong match, then compare the details that matter to you.",
              "मजबूत मिलान से शुरुआत करें, फिर आपके लिए महत्वपूर्ण विवरणों की तुलना करें।"
            )}
          </p>
        </div>
        <div className="results-summary">
          <span className="summary-icon">
            <Sparkles size={20} />
          </span>
          <div>
            <strong>
              {strong.length} {text(language, "strong matches", "मजबूत मिलान")}
            </strong>
            <small>
              {text(
                language,
                "ranked for your profile",
                "आपके प्रोफाइल के अनुसार क्रमित"
              )}
            </small>
          </div>
        </div>
      </div>
      <div className="results-workspace">
        <aside className={`filter-rail ${mobileFilters ? "open" : ""}`}>
          <div className="filter-mobile-head">
            <strong>
              {text(language, "Filter results", "परिणाम फ़िल्टर करें")}
            </strong>
            <button
              onClick={() => setMobileFilters(false)}
              aria-label={text(language, "Close filters", "फ़िल्टर बंद करें")}
            >
              <X size={18} />
            </button>
          </div>
          <div className="filter-heading">
            <Filter size={16} />
            <strong>
              {text(language, "Refine your list", "सूची को बेहतर बनाएँ")}
            </strong>
          </div>
          <label className="filter-label">
            {text(language, "Category", "श्रेणी")}
          </label>
          <div className="filter-options">
            {categories.map(item => (
              <button
                key={item.key}
                className={category === item.key ? "active" : ""}
                onClick={() => {
                  setCategory(item.key);
                  setMobileFilters(false);
                }}
                aria-label={text(language, item.label, item.labelHi)}
              >
                <span>{item.icon}</span>
                {text(language, item.label, item.labelHi)}
                <small>
                  {item.key === "all"
                    ? catalog.length
                    : catalog.filter(scheme => scheme.category === item.key)
                        .length}
                </small>
              </button>
            ))}
          </div>
          <label className="filter-label">
            {text(language, "Scheme level", "योजना स्तर")}
          </label>
          <div className="segmented">
            {["all", "Central", "State"].map(item => (
              <button
                key={item}
                className={level === item ? "active" : ""}
                onClick={() => setLevel(item)}
                aria-label={item}
              >
                {item === "all" ? text(language, "All", "सभी") : item}
              </button>
            ))}
          </div>
        </aside>
        <div className="results-column">
          <div className="results-toolbar">
            <button
              className="mobile-filter-button"
              onClick={() => setMobileFilters(true)}
              aria-label={text(language, "Open filters", "फ़िल्टर खोलें")}
            >
              <ListFilter size={16} />
              {text(language, "Filters", "फ़िल्टर")}
            </button>
            <label className="search-box">
              <Search size={17} />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder={text(
                  language,
                  "Search schemes or benefits",
                  "योजना या लाभ खोजें"
                )}
                aria-label={text(language, "Search schemes", "योजनाएँ खोजें")}
              />
            </label>
            <label className="sort-select">
              <span>{text(language, "Sort", "क्रम")}</span>
              <select
                value={sort}
                onChange={event => setSort(event.target.value)}
                aria-label={text(
                  language,
                  "Sort schemes",
                  "योजनाएँ क्रमित करें"
                )}
              >
                <option value="score">
                  {text(language, "Best match", "सबसे अच्छा मिलान")}
                </option>
                <option value="name">{text(language, "Name", "नाम")}</option>
                <option value="category">
                  {text(language, "Category", "श्रेणी")}
                </option>
              </select>
              <ChevronDown size={15} />
            </label>
          </div>
          {results.map((scheme, index) => (
            <SchemeCard
              key={scheme.id}
              scheme={scheme}
              language={language}
              lead={scheme.id === lead?.id && index === 0}
              saved={saved.includes(scheme.id)}
              comparing={selectedForCompare.includes(scheme.id)}
              onSave={() => onSave(scheme.id)}
              onOpen={() => onOpen(scheme)}
              onShare={() => onShare(scheme)}
              onToggleCompare={() => toggleCompare(scheme.id)}
              onExplain={() => setExplain(scheme)}
            />
          ))}
          {!results.length && (
            <div className="empty-state">
              <Search size={24} />
              <h2>
                {text(
                  language,
                  "Nothing in this view yet.",
                  "इस दृश्य में अभी कुछ नहीं मिला।"
                )}
              </h2>
              <button
                className="button button-secondary"
                onClick={() => {
                  setQuery("");
                  setCategory("all");
                  setLevel("all");
                }}
              >
                {text(language, "Reset filters", "फ़िल्टर रीसेट करें")}
              </button>
            </div>
          )}
        </div>
      </div>
      {selectedForCompare.length > 0 && (
        <div className="comparison-bar">
          <span>
            {selectedForCompare.length}/3{" "}
            {text(language, "schemes selected", "योजनाएँ चुनी गईं")}
          </span>
          <button
            onClick={() => setSelectedForCompare([])}
            aria-label={text(
              language,
              "Clear comparison selection",
              "तुलना चयन हटाएँ"
            )}
          >
            {text(language, "Clear", "हटाएँ")}
          </button>
          <button
            className="button button-primary"
            disabled={selectedForCompare.length < 2}
            onClick={() => setCompareOpen(true)}
            aria-label={text(
              language,
              "Compare selected schemes",
              "चुनी योजनाओं की तुलना करें"
            )}
          >
            {text(
              language,
              selectedForCompare.length < 2
                ? "Select one more to compare"
                : "Compare schemes",
              selectedForCompare.length < 2
                ? "तुलना के लिए एक और चुनें"
                : "योजनाओं की तुलना करें"
            )}
          </button>
        </div>
      )}
      {explain && (
        <ScoreExplanationModal
          scheme={explain}
          profile={profile}
          language={language}
          onClose={() => setExplain(null)}
        />
      )}
      {compareOpen && (
        <SchemeComparisonModal
          schemes={selectedSchemes}
          language={language}
          authenticated={authenticated}
          onClose={() => setCompareOpen(false)}
          onRemove={id => {
            toggleCompare(id);
            if (selectedSchemes.length <= 2) setCompareOpen(false);
          }}
        />
      )}
    </main>
  );
}

function DetailsScreen({
  scheme,
  language,
  profile,
  saved,
  authenticated,
  onBack,
  onSave,
  onExplain,
  onShare,
}: {
  scheme: MatchedScheme;
  language: Language;
  profile: UserProfile;
  saved: boolean;
  authenticated: boolean;
  onBack: () => void;
  onSave: () => void;
  onExplain: () => void;
  onShare: () => void;
}) {
  const [checked, setChecked] = useState<string[]>([]);
  const [personalNote, setPersonalNote] = useState("");
  const [calendarDemoSynced, setCalendarDemoSynced] = useState(false);
  const utils = trpc.useUtils();
  const closed =
    getDeadlineUrgency(scheme.applicationDeadline).state === "closed";
  const calendarEvent = createDeadlineCalendarIcs(scheme, language);
  const savedNote = trpc.saved.getNote.useQuery(
    { schemeId: scheme.id },
    { enabled: saved && authenticated, retry: false }
  );
  const savePersonalNote = trpc.saved.upsertNote.useMutation({
    onSuccess: async () => {
      await utils.saved.getNote.invalidate({ schemeId: scheme.id });
      toast.success(
        text(
          language,
          "Your personal note is saved privately.",
          "आपका निजी नोट सुरक्षित रूप से सहेज लिया गया है।"
        )
      );
    },
    onError: error => toast.error(error.message),
  });
  const deletePersonalNote = trpc.saved.deleteNote.useMutation({
    onSuccess: async () => {
      setPersonalNote("");
      await utils.saved.getNote.invalidate({ schemeId: scheme.id });
      toast.success(
        text(language, "Personal note removed.", "निजी नोट हटा दिया गया है।")
      );
    },
    onError: error => toast.error(error.message),
  });
  useEffect(() => {
    setPersonalNote(savedNote.data?.note?.note ?? "");
  }, [savedNote.data?.note?.note, scheme.id]);
  const documents =
    language === "hi" ? scheme.documentsHindi : scheme.documents;
  const steps = language === "hi" ? scheme.stepsHindi : scheme.steps;
  const addDeadlineToCalendar = () => {
    if (!calendarEvent) return;
    downloadTextFile(calendarEvent.contents, calendarEvent.fileName, "text/calendar;charset=utf-8");
    toast.success(
      text(
        language,
        "Calendar file downloaded. Open it to add this deadline to your calendar.",
        "कैलेंडर फ़ाइल डाउनलोड हो गई है। समयसीमा जोड़ने के लिए इसे खोलें।"
      )
    );
  };
  const previewGoogleCalendarDemo = () => {
    if (!calendarEvent) return;
    setCalendarDemoSynced(true);
    toast.message(
      text(
        language,
        "Demo preview updated. No Google account or calendar event was accessed.",
        "डेमो प्रीव्यू अपडेट हो गया। किसी Google खाते या कैलेंडर इवेंट को एक्सेस नहीं किया गया।"
      )
    );
  };
  return (
    <main className="details-page">
      <div className="details-topbar">
        <button
          className="back-link"
          onClick={onBack}
          aria-label={text(language, "Back to matches", "मिलान पर वापस जाएँ")}
        >
          <ArrowLeft size={16} />
          {text(language, "Back to your matches", "अपने मिलान पर वापस जाएँ")}
        </button>
        <button
          className={`save-button large ${saved ? "saved" : ""}`}
          onClick={onSave}
          aria-label={text(
            language,
            saved ? "Remove saved scheme" : "Save scheme",
            saved ? "सहेजी योजना हटाएँ" : "योजना सहेजें"
          )}
        >
          <Bookmark size={18} fill={saved ? "currentColor" : "none"} />
          {text(
            language,
            saved ? "Saved" : "Save scheme",
            saved ? "सहेजी गई" : "योजना सहेजें"
          )}
        </button>
      </div>
      <div className="details-layout">
        <article className="details-reading">
          <DeadlineBanner scheme={scheme} language={language} />
          <div className={`detail-art ${scheme.accent}`}>
            <img src={scheme.artwork} alt="" />
            <span className="detail-art-label">
              {scheme.level} ·{" "}
              {text(language, scheme.category, scheme.categoryHindi)}
            </span>
          </div>
          <div className="detail-heading">
            <span className={`category-tag ${scheme.accent}`}>
              {text(language, scheme.category, scheme.categoryHindi)}
            </span>
            <h1>{text(language, scheme.name, scheme.nameHindi)}</h1>
            <p className="detail-body-lede">
              {text(language, scheme.benefits, scheme.benefitsHindi)}
            </p>
            <div className="detail-source">
              <ShieldCheck size={15} />
              <span>{scheme.administeringBody}</span>
              <span>•</span>
              <span>{scheme.reviewed}</span>
            </div>
          </div>
          <section className="detail-section">
            <SectionKicker>
              {text(
                language,
                "Why it surfaced for you",
                "यह योजना आपके लिए क्यों आई"
              )}
            </SectionKicker>
            <div className="detail-match-box">
              <ScorePill
                score={scheme.score}
                language={language}
                onExplain={onExplain}
              />
              <div>
                <strong>
                  {text(
                    language,
                    "Tap the score to see every matching factor.",
                    "हर मिलान कारक देखने के लिए स्कोर पर टैप करें।"
                  )}
                </strong>
                <p>
                  {text(
                    language,
                    "This score reflects the details you shared, not a final eligibility decision.",
                    "यह स्कोर आपके दिए विवरण पर आधारित है, अंतिम पात्रता निर्णय नहीं।"
                  )}
                </p>
                <div className="factor-list">
                  {scheme.factors.map(factor => (
                    <span key={factor}>
                      <Check size={13} />
                      {text(
                        language,
                        factorLabels[factor]?.[0] ?? factor,
                        factorLabels[factor]?.[1] ?? factor
                      )}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>
          <section className="detail-section">
            <SectionKicker>
              {text(language, "Keep these ready", "ये दस्तावेज तैयार रखें")}
            </SectionKicker>
            <h2>
              {text(language, "Documents you may need", "ज़रूरी दस्तावेज")}
            </h2>
            <div className="document-list">
              {documents.map(document => (
                <button
                  key={document}
                  className={checked.includes(document) ? "checked" : ""}
                  onClick={() =>
                    setChecked(current =>
                      current.includes(document)
                        ? current.filter(item => item !== document)
                        : [...current, document]
                    )
                  }
                  aria-label={document}
                >
                  <span>
                    {checked.includes(document) ? (
                      <Check size={16} />
                    ) : (
                      <span className="document-empty" />
                    )}
                  </span>
                  {document}
                </button>
              ))}
            </div>
          </section>
          <section className="detail-section">
            <SectionKicker>
              {text(language, "The path ahead", "आगे के चरण")}
            </SectionKicker>
            <h2>{text(language, "How to apply", "आवेदन कैसे करें")}</h2>
            <ol className="steps-list">
              {steps.map((step, index) => (
                <li key={step}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <p>{step}</p>
                </li>
              ))}
            </ol>
          </section>
        </article>
        <aside className="details-aside">
          <div className="action-card">
            <span className="action-eyebrow">
              {text(language, "Ready when you are", "जब आप तैयार हों")}
            </span>
            <h2>
              {closed
                ? text(
                    language,
                    "This application window has closed.",
                    "इस आवेदन की समयसीमा बंद हो चुकी है।"
                  )
                : text(
                    language,
                    "Your next step is waiting.",
                    "आपका अगला कदम तैयार है।"
                  )}
            </h2>
            <p>
              {text(
                language,
                "Use the official portal for the latest rules, dates and status checks.",
                "नवीनतम नियम, तारीख और स्थिति जाँचने के लिए आधिकारिक पोर्टल का उपयोग करें।"
              )}
            </p>
            <a
              className={`button button-primary full-button ${closed ? "is-disabled" : ""}`}
              href={closed ? undefined : scheme.portalUrl}
              target={closed ? undefined : "_blank"}
              rel="noreferrer"
              aria-disabled={closed}
            >
              {closed ? (
                text(language, "Applications closed", "आवेदन बंद हैं")
              ) : (
                <>
                  {text(
                    language,
                    "Open official portal",
                    "आधिकारिक पोर्टल खोलें"
                  )}
                  <ExternalLink size={16} />
                </>
              )}
            </a>
            <button
              className="button share-scheme-button full-button"
              onClick={onShare}
              aria-label={text(language, "Share scheme", "योजना साझा करें")}
            >
              <Share2 size={16} /> {text(language, "Share scheme", "योजना साझा करें")}
            </button>
            <button
              className="button whatsapp-button full-button"
              onClick={onShare}
              aria-label={text(
                language,
                "Share on WhatsApp",
                "WhatsApp पर साझा करें"
              )}
            >
              WhatsApp · {text(language, "Share scheme", "योजना साझा करें")}
            </button>
            {calendarEvent && (
              <button
                className="button calendar-button full-button"
                onClick={addDeadlineToCalendar}
                aria-label={text(
                  language,
                  "Add application deadline to calendar",
                  "आवेदन की समयसीमा कैलेंडर में जोड़ें"
                )}
              >
                <CalendarPlus size={16} />
                {text(language, "Add deadline to calendar", "समयसीमा कैलेंडर में जोड़ें")}
              </button>
            )}
            {calendarEvent && (
              <div className={`google-calendar-demo ${calendarDemoSynced ? "is-previewed" : ""}`}>
                <div>
                  <strong>{calendarDemoSynced ? text(language, "Demo event previewed", "डेमो इवेंट प्रीव्यू हो गया") : text(language, "Google Calendar demo", "Google Calendar डेमो")}</strong>
                  <small>{calendarDemoSynced ? text(language, `${text(language, scheme.name, scheme.nameHindi)} deadline is shown in the local demo state only.`, `${text(language, scheme.name, scheme.nameHindi)} की समयसीमा केवल स्थानीय डेमो स्थिति में दिखाई गई है।`) : text(language, "Preview the direct-sync flow now; real Google OAuth activates only after credentials are configured.", "अभी डायरेक्ट-सिंक फ्लो का प्रीव्यू देखें; असली Google OAuth केवल क्रेडेंशियल कॉन्फ़िगर होने पर सक्रिय होगा।")}</small>
                </div>
                <button onClick={previewGoogleCalendarDemo} aria-label={text(language, "Preview Google Calendar demo", "Google Calendar डेमो प्रीव्यू करें")}>
                  <CalendarPlus size={15} />
                  {calendarDemoSynced ? text(language, "Preview again", "फिर प्रीव्यू करें") : text(language, "Preview sync", "सिंक प्रीव्यू")}
                </button>
              </div>
            )}
            <button
              className="share-link"
              onClick={() => {
                navigator.clipboard?.writeText(createSchemeShareUrl(scheme.id));
                toast.success(
                  text(
                    language,
                    "Scheme Sathi link copied.",
                    "Scheme Sathi लिंक कॉपी हो गया।"
                  )
                );
              }}
              aria-label={text(
                language,
                "Copy scheme link",
                "योजना लिंक कॉपी करें"
              )}
            >
              <ArrowRight size={15} />
              {text(language, "Copy Scheme Sathi link", "Scheme Sathi लिंक कॉपी करें")}
            </button>
          </div>
          <div className="profile-note">
            <ShieldCheck size={17} />
            <div>
              <strong>
                {text(language, "A note on eligibility", "पात्रता के बारे में")}
              </strong>
              <p>
                {text(
                  language,
                  `We matched this against your profile: age ${profile.age}, ${profile.state || "your state"}, and ${profile.occupation || "your work profile"}.`,
                  `आपके प्रोफाइल से मिलान किया गया: आयु ${profile.age}, ${profile.state || "आपका राज्य"}, और ${profile.occupation || "आपका काम"}।`
                )}
              </p>
            </div>
          </div>
          {saved && !authenticated && (
            <div className="saved-scheme-note sign-in-note">
              <Bookmark size={17} />
              <div>
                <strong>{text(language, "Keep a personal note", "निजी नोट रखें")}</strong>
                <p>{text(language, "Sign in to save private notes with this scheme across your devices.", "इस योजना के साथ निजी नोट को सभी डिवाइस पर रखने के लिए साइन इन करें।")}</p>
              </div>
            </div>
          )}
          {saved && authenticated && (
            <section className="saved-scheme-note" aria-labelledby="personal-scheme-note-title">
              <div className="saved-scheme-note-heading">
                <div>
                  <span className="action-eyebrow">{text(language, "Private tracking", "निजी ट्रैकिंग")}</span>
                  <h2 id="personal-scheme-note-title">{text(language, "Your note", "आपका नोट")}</h2>
                </div>
                <Bookmark size={18} />
              </div>
              <p>{text(language, "Keep a reminder, question, or follow-up here. Only you can see it.", "यहाँ रिमाइंडर, सवाल या फॉलो-अप रखें। इसे केवल आप देख सकते हैं।")}</p>
              <textarea
                value={personalNote}
                maxLength={4000}
                placeholder={text(language, "e.g. Check my income certificate before applying", "जैसे: आवेदन से पहले आय प्रमाणपत्र जाँचें")}
                onChange={event => setPersonalNote(event.target.value)}
                aria-label={text(language, "Personal scheme note", "योजना के लिए निजी नोट")}
              />
              <div className="saved-scheme-note-actions">
                <button
                  className="button button-primary"
                  disabled={!personalNote.trim() || savePersonalNote.isPending}
                  onClick={() => savePersonalNote.mutate({ schemeId: scheme.id, note: personalNote })}
                >
                  {text(language, savePersonalNote.isPending ? "Saving note…" : "Save note", savePersonalNote.isPending ? "नोट सहेज रहे हैं…" : "नोट सहेजें")}
                </button>
                {savedNote.data?.note && (
                  <button
                    className="note-delete-button"
                    disabled={deletePersonalNote.isPending}
                    onClick={() => deletePersonalNote.mutate({ schemeId: scheme.id })}
                    aria-label={text(language, "Delete personal note", "निजी नोट हटाएँ")}
                  >
                    <Trash2 size={15} />
                    {text(language, "Remove", "हटाएँ")}
                  </button>
                )}
              </div>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}

function OfflineSavedSchemesScreen({
  language,
  snapshot,
  onBack,
  onOpen,
  onShare,
}: {
  language: Language;
  snapshot: OfflineSavedSchemesSnapshot | null;
  onBack: () => void;
  onOpen: (scheme: Scheme) => void;
  onShare: (scheme: Scheme) => void;
}) {
  const savedSchemes = snapshot?.schemes ?? [];
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [level, setLevel] = useState("all");
  const [sort, setSort] = useState<"saved" | "deadlineAsc">("saved");
  useEffect(() => {
    const openOfflineScheme = (event: Event) => onOpen((event as CustomEvent<Scheme>).detail);
    window.addEventListener("scheme-sathi-open-offline-saved", openOfflineScheme);
    return () => window.removeEventListener("scheme-sathi-open-offline-saved", openOfflineScheme);
  }, [onOpen]);
  const categories = useMemo(() => Array.from(new Set(savedSchemes.map(scheme => scheme.category))).sort(), [savedSchemes]);
  const visibleSchemes = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    const filtered = savedSchemes.filter(scheme => {
      const matchesText = !term || [scheme.name, scheme.nameHindi, scheme.benefits, scheme.benefitsHindi, scheme.administeringBody].some(value => value.toLocaleLowerCase().includes(term));
      return matchesText && (category === "all" || scheme.category === category) && (level === "all" || scheme.level === level);
    });
    return sortOfflineSavedSchemes(filtered, sort);
  }, [savedSchemes, query, category, level, sort]);
  return <main className="offline-saved-page"><div className="offline-saved-intro"><button className="back-link" onClick={onBack}><ArrowLeft size={16} /> {text(language, "Back home", "होम पर वापस जाएँ")}</button><p className="eyebrow"><Bookmark size={14} /> {text(language, "AVAILABLE OFFLINE", "ऑफ़लाइन उपलब्ध")}</p><h1>{text(language, "Your saved schemes, ready without a connection.", "आपकी सहेजी योजनाएँ, बिना इंटरनेट के भी तैयार।")}</h1><p>{text(language, "This device keeps only public scheme guidance here. Personal profiles, notes, and account data stay out of the offline snapshot.", "इस डिवाइस पर यहाँ केवल सार्वजनिक योजना जानकारी रखी जाती है। निजी प्रोफाइल, नोट और अकाउंट डेटा ऑफ़लाइन स्नैपशॉट में नहीं आते।")}</p>{snapshot && <small>{text(language, "Last updated", "अंतिम अपडेट")}: {new Date(snapshot.savedAt).toLocaleString(language === "hi" ? "hi-IN" : "en-IN")}</small>}</div>{savedSchemes.length ? <><OfflineSavedDeadlineReminders schemes={savedSchemes} language={language} /><section className="offline-saved-discovery" aria-label={text(language, "Search saved schemes", "सहेजी योजनाएँ खोजें")}><label className="offline-saved-search"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={text(language, "Search saved schemes", "सहेजी योजनाएँ खोजें")} aria-label={text(language, "Search saved schemes", "सहेजी योजनाएँ खोजें")} /></label><label><span>{text(language, "Category", "श्रेणी")}</span><select value={category} onChange={event => setCategory(event.target.value)}><option value="all">{text(language, "All categories", "सभी श्रेणियाँ")}</option>{categories.map(item => <option key={item} value={item}>{language === "hi" ? savedSchemes.find(scheme => scheme.category === item)?.categoryHindi ?? item : item}</option>)}</select></label><label><span>{text(language, "Level", "स्तर")}</span><select value={level} onChange={event => setLevel(event.target.value)}><option value="all">{text(language, "All levels", "सभी स्तर")}</option><option value="Central">{text(language, "Central", "केंद्र")}</option><option value="State">{text(language, "State", "राज्य")}</option></select></label><label><span>{text(language, "Sort", "क्रम")}</span><select value={sort} onChange={event => setSort(event.target.value as "saved" | "deadlineAsc")}><option value="saved">{text(language, "Saved order", "सहेजने का क्रम")}</option><option value="deadlineAsc">{text(language, "Upcoming deadline", "आने वाली समयसीमा")}</option></select></label><span className="offline-saved-result-count">{visibleSchemes.length} {text(language, "shown", "दिखाई गई")}</span></section>{visibleSchemes.length ? <div className="offline-saved-grid">{visibleSchemes.map(scheme => <article key={scheme.id} className="offline-saved-card"><span className={`category-tag ${scheme.accent}`}>{text(language, scheme.category, scheme.categoryHindi)}</span><h2>{text(language, scheme.name, scheme.nameHindi)}</h2><p>{text(language, scheme.benefits, scheme.benefitsHindi)}</p><div><button type="button" onClick={() => onOpen(scheme)}>{text(language, "Open details", "विवरण खोलें")} <ArrowRight size={15} /></button><button type="button" className="offline-share-button" onClick={() => onShare(scheme)}><Share2 size={15} /> {text(language, "Share", "साझा करें")}</button></div></article>)}</div> : <section className="offline-saved-empty filtered"><Search size={26} /><h2>{text(language, "No saved schemes match these filters", "इन फ़िल्टर के लिए कोई सहेजी योजना नहीं मिली")}</h2><button onClick={() => { setQuery(""); setCategory("all"); setLevel("all"); setSort("saved"); }}>{text(language, "Clear filters", "फ़िल्टर साफ़ करें")}</button></section>}</> : <section className="offline-saved-empty"><Bookmark size={26} /><h2>{text(language, "No saved schemes on this device yet", "इस डिवाइस पर अभी कोई सहेजी योजना नहीं है")}</h2><p>{text(language, "Save a scheme while you are online and it will appear here for later access.", "ऑनलाइन रहते हुए कोई योजना सहेजें और वह बाद में यहाँ उपलब्ध होगी।")}</p><button onClick={onBack}>{text(language, "Browse schemes", "योजनाएँ देखें")}</button></section>}</main>;
}

export default function Home() {
  const { user, isAuthenticated, logout } = useAuth();
  const utils = trpc.useUtils();
  const catalogQuery = trpc.schemes.list.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const accountProfileQuery = trpc.profile.mine.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });
  const savedQuery = trpc.saved.list.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });
  const [language, setLanguage] = useState<Language>(
    () => (localStorage.getItem("scheme-language") as Language) || "en"
  );
  const [dark, setDark] = useState(
    () => localStorage.getItem("scheme-dark") === "true"
  );
  const [screen, setScreen] = useState<Screen>("home");
  const [profile, setProfile] = useState<UserProfile>(() => {
    try {
      return (
        JSON.parse(localStorage.getItem("scheme-profile") || "null") ||
        defaultProfile
      );
    } catch {
      return defaultProfile;
    }
  });
  const [selected, setSelected] = useState<MatchedScheme | null>(null);
  const [sharePreviewScheme, setSharePreviewScheme] = useState<Scheme | null>(null);
  const [detailBackScreen, setDetailBackScreen] = useState<Screen>("results");
  const [savedIds, setSavedIds] = useState<string[]>(() =>
    JSON.parse(localStorage.getItem("scheme-saved") || "[]")
  );
  const [offlineSavedSnapshot, setOfflineSavedSnapshot] = useState<OfflineSavedSchemesSnapshot | null>(() => readOfflineSavedSchemesSnapshot(localStorage));
  const [helpOpen, setHelpOpen] = useState(false);
  const [browseCategory, setBrowseCategory] = useState("all");
  const [detailScoreOpen, setDetailScoreOpen] = useState(false);
  const catalog = useMemo(
    () => catalogQuery.data?.schemes.map(toClientScheme) ?? schemes,
    [catalogQuery.data]
  );
  const matching = trpc.matching.run.useMutation({
    onSuccess: () => {
      localStorage.setItem("scheme-profile", JSON.stringify(profile));
      setScreen("results");
    },
    onError: () =>
      toast.error(
        text(
          language,
          "We could not refresh your matches. Please try again.",
          "आपके मिलान अभी नहीं बन पाए। कृपया फिर कोशिश करें।"
        )
      ),
  });
  const profileSave = trpc.profile.save.useMutation({
    onSuccess: () => utils.profile.mine.invalidate(),
  });
  const savedToggle = trpc.saved.toggle.useMutation({
    onSuccess: () => utils.saved.list.invalidate(),
    onError: () =>
      toast.error(
        text(
          language,
          "We could not update your saved scheme.",
          "योजना सहेजी नहीं जा सकी।"
        )
      ),
  });
  const serverMatches = useMemo<MatchedScheme[]>(
    () =>
      (matching.data?.matches ?? []).map(match => ({
        ...toClientScheme(match),
        score: match.score,
        factors: match.factors,
      })),
    [matching.data]
  );
  useEffect(() => {
    localStorage.setItem("scheme-language", language);
    document.documentElement.lang = language === "hi" ? "hi-IN" : "en-IN";
  }, [language]);
  useEffect(() => {
    localStorage.setItem("scheme-dark", String(dark));
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  useEffect(() => {
    localStorage.setItem("scheme-saved", JSON.stringify(savedIds));
  }, [savedIds]);
  useEffect(() => {
    const snapshot = createOfflineSavedSchemesSnapshot(catalog, savedIds);
    writeOfflineSavedSchemesSnapshot(localStorage, snapshot);
    setOfflineSavedSnapshot(snapshot);
  }, [catalog, savedIds]);
  useEffect(() => {
    if (accountProfileQuery.data?.profile)
      setProfile(accountProfileQuery.data.profile);
  }, [accountProfileQuery.data]);
  useEffect(() => {
    if (isAuthenticated && savedQuery.data)
      setSavedIds(savedQuery.data.schemeIds);
  }, [isAuthenticated, savedQuery.data]);
  const openResults = () => {
    localStorage.setItem("scheme-profile", JSON.stringify(profile));
    if (isAuthenticated) profileSave.mutate(profile);
    matching.mutate(profile);
  };
  const toggleSave = (id: string) => {
    if (!isAuthenticated) {
      setSavedIds(current =>
        current.includes(id)
          ? current.filter(item => item !== id)
          : [...current, id]
      );
      toast.message(
        text(
          language,
          "Saved on this device. Sign in to sync across devices.",
          "इस डिवाइस पर सहेजी गई। सभी डिवाइस पर सिंक के लिए साइन इन करें।"
        )
      );
      return;
    }
    savedToggle.mutate({ schemeId: id });
  };
  const home = () => {
    setScreen("home");
    setSelected(null);
    setDetailBackScreen("results");
    setBrowseCategory("all");
  };
  return (
    <div className="app-shell">
      <AppHeader
        language={language}
        setLanguage={setLanguage}
        dark={dark}
        setDark={setDark}
        onHome={home}
        onStart={() => setScreen("profile")}
        onOfflineSaved={() => setScreen("offlineSaved")}
        offlineSavedCount={offlineSavedSnapshot?.schemes.length ?? 0}
        authenticated={isAuthenticated}
        name={user?.name}
        onLogout={logout}
      />
      {catalogQuery.isError && (
        <div className="api-status api-status-error">
          <span>
            {text(
              language,
              "Live catalog is temporarily unavailable — showing verified offline data.",
              "लाइव कैटलॉग उपलब्ध नहीं है — सत्यापित ऑफलाइन डेटा दिखाया जा रहा है।"
            )}
          </span>
          <button
            onClick={() => catalogQuery.refetch()}
            aria-label={text(
              language,
              "Retry catalog",
              "कैटलॉग फिर कोशिश करें"
            )}
          >
            {text(language, "Retry", "फिर कोशिश करें")}
          </button>
        </div>
      )}
      {screen === "home" && (
        <HomeScreen
          language={language}
          onStart={() => setScreen("profile")}
          onBrowse={category => {
            setBrowseCategory(category);
            setScreen("results");
          }}
          saved={savedIds}
          catalog={catalog}
        />
      )}
      {screen === "profile" && (
        <ProfileScreen
          language={language}
          profile={profile}
          setProfile={setProfile}
          onBack={home}
          onSubmit={openResults}
          pending={matching.isPending}
        />
      )}
      {screen === "results" && (
        <ResultsScreen
          language={language}
          profile={profile}
          catalog={catalog}
          serverMatches={serverMatches}
          saved={savedIds}
          authenticated={isAuthenticated}
          onSave={toggleSave}
          onShare={scheme => setSharePreviewScheme(scheme)}
          onOpen={scheme => {
            setSelected(scheme);
            setDetailBackScreen("results");
            setScreen("details");
          }}
          onBack={() => setScreen("profile")}
          initialCategory={browseCategory}
        />
      )}
      {screen === "details" && selected && (
        <DetailsScreen
          scheme={selected}
          language={language}
          profile={profile}
          saved={savedIds.includes(selected.id)}
          authenticated={isAuthenticated}
          onBack={() => { setSelected(null); setScreen(detailBackScreen); }}
          onSave={() => toggleSave(selected.id)}
          onExplain={() => setDetailScoreOpen(true)}
          onShare={() => setSharePreviewScheme(selected)}
        />
      )}
      {screen === "offlineSaved" && <OfflineSavedSchemesScreen language={language} snapshot={offlineSavedSnapshot} onBack={home} onShare={scheme => setSharePreviewScheme(scheme)} onOpen={scheme => { setSelected({ ...scheme, ...scoreScheme(profile, scheme) }); setDetailBackScreen("offlineSaved"); setScreen("details"); }} />}
      {detailScoreOpen && selected && (
        <ScoreExplanationModal
          scheme={selected}
          profile={profile}
          language={language}
          onClose={() => setDetailScoreOpen(false)}
        />
      )}
      {sharePreviewScheme && <SchemeSharePreviewCard scheme={sharePreviewScheme} initialLanguage={language} onClose={() => setSharePreviewScheme(null)} />}
      <button
        className="help-fab"
        onClick={() => setHelpOpen(true)}
        aria-label={text(language, "Open help", "मदद खोलें")}
      >
        <MessageCircle size={19} />
        <span>{text(language, "Need help?", "मदद चाहिए?")}</span>
      </button>
      {helpOpen && (
        <SchemeHelpDrawer
          language={language}
          screen={screen}
          profile={profile}
          selectedScheme={selected}
          onClose={() => setHelpOpen(false)}
        />
      )}
    </div>
  );
}
