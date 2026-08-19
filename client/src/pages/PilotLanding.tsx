import { useState } from "react";
import { Link } from "wouter";
import { ArrowRight, CheckCircle2, ClipboardPenLine, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";
import "./PilotLanding.css";

type PilotForm = {
  role: "student" | "parent" | "collegeStaff" | "ngoStaff" | "other";
  state: string;
  journeyStage: "searching" | "preparing" | "applying" | "missedDeadline" | "other";
  biggestBlocker: string;
  helpfulToday: string;
  contactEmail: string;
  contactConsent: boolean;
};

const initialForm: PilotForm = {
  role: "student",
  state: "",
  journeyStage: "searching",
  biggestBlocker: "",
  helpfulToday: "",
  contactEmail: "",
  contactConsent: false,
};

export default function PilotLanding() {
  const [form, setForm] = useState<PilotForm>(initialForm);
  const feedback = trpc.pilot.submitFeedback.useMutation({
    onSuccess: () => setForm(initialForm),
  });
  const set = <K extends keyof PilotForm>(key: K, value: PilotForm[K]) =>
    setForm(current => ({ ...current, [key]: value }));

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    feedback.mutate({
      ...form,
      contactEmail: form.contactConsent ? form.contactEmail : undefined,
    });
  };

  return (
    <main className="pilot-page">
      <header className="pilot-nav">
        <Link href="/" className="pilot-brand">Scheme Sathi <span>Scholarship pilot</span></Link>
        <Link href="/scholarships" className="pilot-nav-cta">Try checker <ArrowRight size={15} /></Link>
      </header>
      <section className="pilot-hero">
        <div className="pilot-hero-copy">
          <p className="section-kicker">HELP BUILD A BETTER SCHOLARSHIP JOURNEY</p>
          <h1>Tell us where the process gets difficult.</h1>
          <p>We are piloting a clearer route from “Which scholarship fits me?” to “What should I prepare next?” Your answers help us build for real blockers, not assumptions.</p>
          <div className="pilot-principles">
            <span><ShieldCheck size={16} /> No profile or documents needed</span>
            <span><ClipboardPenLine size={16} /> About 2 minutes</span>
          </div>
        </div>
        <div className="pilot-hero-panel">
          <span>01</span>
          <Sparkles size={24} />
          <h2>First, try the focused checker.</h2>
          <p>See potential scholarship matches, documents to prepare, and the official next step.</p>
          <Link href="/scholarships" className="button button-primary">Open eligibility checker <ArrowRight size={16} /></Link>
        </div>
      </section>

      <section className="pilot-layout">
        <aside className="pilot-why">
          <p className="section-kicker">WHY THIS PILOT</p>
          <h2>We want the moments people usually miss.</h2>
          <ol>
            <li><span>01</span><div><b>Search</b><p>Which terms, portals, or eligibility rules are confusing?</p></div></li>
            <li><span>02</span><div><b>Prepare</b><p>Which document or certificate delays the next step?</p></div></li>
            <li><span>03</span><div><b>Apply</b><p>What makes the official application journey hard to finish?</p></div></li>
          </ol>
        </aside>
        <section className="pilot-form-card">
          {!feedback.isSuccess ? <>
            <div className="pilot-form-heading"><p className="section-kicker">PILOT INTERVIEW FORM</p><h2>Share your experience</h2><p>Do not include Aadhaar, bank, application number, marksheet or other sensitive details.</p></div>
            <form onSubmit={submit}>
              <div className="pilot-grid">
                <label><span>I am a…</span><select value={form.role} onChange={event => set("role", event.target.value as PilotForm["role"])}><option value="student">Student</option><option value="parent">Parent / guardian</option><option value="collegeStaff">College / scholarship staff</option><option value="ngoStaff">NGO / community staff</option><option value="other">Other</option></select></label>
                <label><span>State / UT</span><input value={form.state} maxLength={96} onChange={event => set("state", event.target.value)} placeholder="For example, Maharashtra" required /></label>
                <label><span>Where are you in the journey?</span><select value={form.journeyStage} onChange={event => set("journeyStage", event.target.value as PilotForm["journeyStage"])}><option value="searching">Searching for scholarships</option><option value="preparing">Preparing documents</option><option value="applying">Applying on the official portal</option><option value="missedDeadline">Missed a deadline</option><option value="other">Other</option></select></label>
              </div>
              <label><span>What is the biggest blocker right now?</span><textarea value={form.biggestBlocker} maxLength={500} onChange={event => set("biggestBlocker", event.target.value)} placeholder="For example: I cannot tell which income certificate is needed." required /></label>
              <label><span>What would make Scheme Sathi helpful today?</span><textarea value={form.helpfulToday} maxLength={500} onChange={event => set("helpfulToday", event.target.value)} placeholder="For example: a clear checklist before I open the scholarship portal." required /></label>
              <label className="pilot-consent"><input type="checkbox" checked={form.contactConsent} onChange={event => set("contactConsent", event.target.checked)} /><span>I am happy for Scheme Sathi to contact me once about this pilot.</span></label>
              {form.contactConsent && <label><span>Email for one pilot follow-up</span><input type="email" value={form.contactEmail} maxLength={320} onChange={event => set("contactEmail", event.target.value)} placeholder="you@example.com" required /></label>}
              <button className="button button-primary pilot-submit" disabled={feedback.isPending}>{feedback.isPending ? <><Loader2 className="spin" size={16} /> Sending…</> : <>Send pilot feedback <ArrowRight size={16} /></>}</button>
              {feedback.error && <p className="pilot-error" role="alert">{feedback.error.message}</p>}
            </form>
          </> : <div className="pilot-success"><CheckCircle2 size={35} /><p className="section-kicker">THANK YOU</p><h2>Your feedback is in.</h2><p>We will use it to prioritise the real scholarship blockers people face. No action is required from you now.</p><Link href="/scholarships" className="button button-secondary">Try the checker <ArrowRight size={16} /></Link></div>}
        </section>
      </section>
    </main>
  );
}
