import { useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  Loader2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { states } from "@/lib/schemes";
import { trpc } from "@/lib/trpc";
import "./ScholarshipChecker.css";

type ScholarshipForm = {
  age: string;
  state: string;
  caste: string;
  annualIncome: string;
  gender: string;
  isDisabled: boolean;
};

const initialForm: ScholarshipForm = {
  age: "18",
  state: "",
  caste: "General",
  annualIncome: "",
  gender: "",
  isDisabled: false,
};

export default function ScholarshipChecker() {
  const [form, setForm] = useState<ScholarshipForm>(initialForm);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const eligibility = trpc.scholarships.checkEligibility.useMutation();
  const set = <K extends keyof ScholarshipForm>(key: K, value: ScholarshipForm[K]) => {
    setForm(current => ({ ...current, [key]: value }));
    setFieldError(null);
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const age = Number(form.age);
    const income = Number(form.annualIncome);
    if (!Number.isFinite(age) || !Number.isInteger(age) || age < 10 || age > 45) {
      setFieldError("Please enter a valid age between 10 and 45.");
      return;
    }
    if (form.annualIncome.trim() === "" || !Number.isFinite(income) || !Number.isInteger(income) || income < 0 || income > 100000000) {
      setFieldError("Please enter a valid annual household income (0 – 10,00,00,000).");
      return;
    }
    if (!form.state.trim() || !form.caste.trim() || !form.gender.trim()) {
      setFieldError("Please choose your state, category and gender.");
      return;
    }
    setFieldError(null);
    eligibility.mutate({
      age,
      state: form.state.trim(),
      caste: form.caste.trim(),
      annualIncome: income,
      gender: form.gender.trim(),
      isDisabled: form.isDisabled,
    });
  };

  const matches = eligibility.data?.matches ?? [];

  return (
    <main className="scholarship-checker-page">
      <header className="scholarship-checker-nav">
        <Link href="/" className="checker-back-link">
          <ArrowLeft size={16} /> Scheme Sathi
        </Link>
        <Link href="/pilot" className="checker-pilot-link">
          Pilot feedback <ArrowLeft size={14} className="checker-pilot-arrow" />
        </Link>
      </header>

      <section className="checker-hero">
        <div>
          <p className="section-kicker">SCHOLARSHIP READINESS PILOT</p>
          <h1>Find scholarships worth preparing for.</h1>
          <p>
            Answer six basics. We show potential scholarship matches, the documents to keep ready, and the official next step.
          </p>
          <div className="checker-trust-line">
            <span><ShieldCheck size={16} /> No Aadhaar, bank or marksheet asked</span>
            <span><BadgeCheck size={16} /> Official portal remains final authority</span>
          </div>
        </div>
        <aside className="checker-hero-note">
          <Sparkles size={21} />
          <p>Built for students, parents and scholarship cells who need a clear next step—not another long list.</p>
        </aside>
      </section>

      <section className="checker-workspace" aria-label="Scholarship eligibility checker">
        <form className="checker-form" onSubmit={submit}>
          <div className="checker-form-heading">
            <span>01</span>
            <div>
              <p className="section-kicker">YOUR STUDENT PROFILE</p>
              <h2>Check potential eligibility</h2>
            </div>
          </div>
          <p className="checker-form-intro">These answers are used only for this check. We do not save this profile unless you later choose to sign in and save it.</p>

          <div className="checker-field-grid">
            <label>
              <span>Age</span>
              <input type="number" min="10" max="45" value={form.age} onChange={event => set("age", event.target.value)} required />
            </label>
            <label>
              <span>State / UT</span>
                <select value={form.state} onChange={event => set("state", event.target.value)} required>
                  <option value="" disabled>Choose your state</option>
                  {states.map(state => <option value={state} key={state}>{state}</option>)}
                </select>
            </label>
            <label>
              <span>Annual household income (₹)</span>
              <input type="number" min="0" max="100000000" placeholder="For example, 300000" value={form.annualIncome} onChange={event => set("annualIncome", event.target.value)} required />
            </label>
            <label>
              <span>Category</span>
              <select value={form.caste} onChange={event => set("caste", event.target.value)} required>
                <option value="General">General</option>
                <option value="OBC">OBC</option>
                <option value="SC">SC</option>
                <option value="ST">ST</option>
                <option value="EWS">EWS</option>
              </select>
            </label>
          </div>

          <fieldset className="checker-choice-group">
            <legend>Gender</legend>
            <div>
              {["Female", "Male", "Other"].map(gender => (
                <label className="checker-choice" key={gender}>
                  <input type="radio" name="gender" value={gender} checked={form.gender === gender} onChange={() => set("gender", gender)} required />
                  <span>{gender}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="checker-checkbox">
            <input type="checkbox" checked={form.isDisabled} onChange={event => set("isDisabled", event.target.checked)} />
            <span>I may need disability-related scholarship support.</span>
          </label>

          <button className="button button-primary checker-submit" disabled={eligibility.isPending}>
            {eligibility.isPending ? <><Loader2 className="spin" size={17} /> Checking…</> : <><Sparkles size={17} /> Check scholarship fit</>}
          </button>
          {fieldError && <p className="checker-error" role="alert">{fieldError}</p>}
          {eligibility.error && <p className="checker-error" role="alert">{eligibility.error.message}</p>}
        </form>

        <section className="checker-results" aria-live="polite">
          {!eligibility.data && !eligibility.isPending && (
            <div className="checker-empty">
              <BookOpen size={30} />
              <p className="section-kicker">YOUR NEXT STEP</p>
              <h2>Start with a potential match.</h2>
              <p>We will translate the result into eligibility reasons, a document list, and the official route to verify before applying.</p>
            </div>
          )}
          {eligibility.isPending && (
            <div className="checker-empty"><Loader2 className="spin" size={30} /><h2>Checking the scholarship catalogue…</h2></div>
          )}
          {eligibility.data && matches.length === 0 && (
            <div className="checker-empty checker-no-match">
              <BookOpen size={30} />
              <p className="section-kicker">NO CURRENT POTENTIAL MATCH</p>
              <h2>Try the wider Scheme Sathi search.</h2>
              <p>Our pilot scholarship list is deliberately narrow. A result here is not a decision about your eligibility.</p>
              <Link href="/discover" className="button button-secondary">Explore all schemes</Link>
            </div>
          )}
          {matches.map((scheme, index) => (
            <article className="checker-match" key={scheme.id}>
              <div className="checker-match-topline"><span>Potential match {String(index + 1).padStart(2, "0")}</span><strong>{scheme.score}% fit</strong></div>
              <h2>{scheme.name}</h2>
              <p className="checker-body-copy">{scheme.benefits}</p>
              <div className="checker-reason-list">
                <p><CheckCircle2 size={15} /> Student profile and provided basics match this pilot rule set.</p>
                <p><CheckCircle2 size={15} /> Your score factors: {scheme.factors.join(", ")}.</p>
              </div>
              <div className="checker-documents">
                <div><FileCheck2 size={18} /><span><b>Prepare first</b>{scheme.documents.slice(0, 3).join(" · ")}</span></div>
              </div>
              <a className="button button-primary" href={scheme.portalUrl} target="_blank" rel="noreferrer">
                Verify on official portal <ExternalLink size={16} />
              </a>
              <p className="checker-disclaimer">{eligibility.data?.disclaimer}</p>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}
