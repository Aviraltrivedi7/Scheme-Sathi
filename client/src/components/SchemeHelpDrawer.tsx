import { ArrowRight, Loader2, Send, Sparkles, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { Scheme, UserProfile } from "@/lib/schemes";

type Language = "en" | "hi";
type Screen = "home" | "profile" | "results" | "details" | "offlineSaved";
type HelpMessage = { role: "assistant" | "user"; content: string };
const languageText = (language: Language, english: string, hindi: string) => language === "hi" ? hindi : english;
const promptsByScreen: Record<Screen, [string, string, string]> = {
  home: ["What information helps find the right schemes?", "How does Scheme Sathi protect my details?", "Where should I begin?"],
  profile: ["Why do you ask about household income?", "Which profile details are optional?", "How will my answers affect matches?"],
  results: ["Why is this scheme a strong match?", "Which documents should I prepare first?", "How should I compare my top matches?"],
  details: ["What should I verify before applying?", "Which documents should I keep ready?", "What is the next application step?"],
  offlineSaved: ["How are these schemes available offline?", "What data is kept on this device?", "How do I refresh saved schemes?"],
};
const promptsByScreenHi: Record<Screen, [string, string, string]> = {
  home: ["सही योजनाएँ खोजने के लिए कौन-सी जानकारी मदद करती है?", "Scheme Sathi मेरी जानकारी को कैसे सुरक्षित रखता है?", "मुझे कहाँ से शुरू करना चाहिए?"],
  profile: ["आप घरेलू आय के बारे में क्यों पूछते हैं?", "कौन-सी प्रोफाइल जानकारी वैकल्पिक है?", "मेरे जवाब मिलान को कैसे प्रभावित करेंगे?"],
  results: ["यह योजना मेरे लिए मजबूत मिलान क्यों है?", "मुझे पहले कौन-से दस्तावेज़ तैयार करने चाहिए?", "मैं अपने अच्छे मिलानों की तुलना कैसे करूँ?"],
  details: ["आवेदन से पहले मुझे क्या जाँचना चाहिए?", "कौन-से दस्तावेज़ तैयार रखने चाहिए?", "आवेदन का अगला कदम क्या है?"],
  offlineSaved: ["ये योजनाएँ ऑफ़लाइन कैसे उपलब्ध हैं?", "इस डिवाइस पर कौन-सा डेटा रखा जाता है?", "मैं सहेजी योजनाएँ कैसे अपडेट करूँ?"],
};

export function SchemeHelpDrawer({ language, screen, profile, selectedScheme, onClose }: { language: Language; screen: Screen; profile: UserProfile; selectedScheme: (Scheme & { score?: number; factors?: string[] }) | null; onClose: () => void }) {
  const [question, setQuestion] = useState(""); const [messages, setMessages] = useState<HelpMessage[]>([]); const [isStreaming, setIsStreaming] = useState(false); const prompts = useMemo(() => language === "hi" ? promptsByScreenHi[screen] : promptsByScreen[screen], [language, screen]);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { abortRef.current?.abort(); onClose(); } };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      abortRef.current?.abort();
    };
  }, [onClose]);
  const ask = async (event?: FormEvent, predefined?: string) => { event?.preventDefault(); const query = (predefined ?? question).trim().slice(0, 800); if (!query || isStreaming) return; setQuestion(""); setMessages((current) => [...current, { role: "user", content: query }, { role: "assistant", content: "" }]); setIsStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try { const response = await fetch("/api/help/stream", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal, body: JSON.stringify({ question: query, language, profile, scheme: selectedScheme ? { name: selectedScheme.name, nameHindi: selectedScheme.nameHindi, benefits: selectedScheme.benefits, benefitsHindi: selectedScheme.benefitsHindi, documents: selectedScheme.documents, steps: selectedScheme.steps, applicationDeadline: selectedScheme.applicationDeadline, deadlineLabel: selectedScheme.deadlineLabel, portalUrl: selectedScheme.portalUrl, factors: selectedScheme.factors ?? [] } : null }) }); if (!response.ok || !response.body) throw new Error("Help request unavailable"); const reader = response.body.getReader(); let buffer = "";
      while (true) { const { done, value } = await reader.read(); if (done) break; buffer += new TextDecoder().decode(value, { stream: true }); const parts = buffer.split("\n\n"); buffer = parts.pop() ?? ""; for (const part of parts) { const data = part.split("\n").find((line) => line.startsWith("data:"))?.slice(5).trim(); if (!data) continue; const eventData = JSON.parse(data) as { type: string; text?: string; message?: string }; if (eventData.type === "delta" && eventData.text) setMessages((current) => current.map((message, index) => index === current.length - 1 ? { ...message, content: message.content + eventData.text! } : message)); if (eventData.type === "error") throw new Error(eventData.message); } }
    } catch (error) { if (error instanceof DOMException && error.name === "AbortError") return; setMessages((current) => current.map((message, index) => index === current.length - 1 ? { ...message, content: languageText(language, "I could not reach Scheme Sathi right now. Please try again, or verify the latest details on the official portal.", "Scheme Sathi अभी जवाब नहीं दे सका। कृपया फिर कोशिश करें या आधिकारिक पोर्टल पर नवीनतम जानकारी जाँचें।") } : message)); } finally { if (abortRef.current === controller) abortRef.current = null; setIsStreaming(false); } };
  return <div className="drawer-backdrop" onClick={onClose}><aside className="help-drawer" role="dialog" aria-modal="true" aria-label={languageText(language, "Scheme Sathi help", "Scheme Sathi मदद")} onClick={(event) => event.stopPropagation()}><div className="drawer-head"><div><span className="section-kicker">{languageText(language, "A little help", "थोड़ी मदद")}</span><h2>{languageText(language, "Ask Scheme Sathi", "Scheme Sathi से पूछें")}</h2></div><button onClick={onClose} className="icon-button" aria-label={languageText(language, "Close help", "मदद बंद करें")}><X size={18} /></button></div><div className="assistant-message"><span className="assistant-avatar"><Sparkles size={15} /></span><p>{languageText(language, "Ask in plain language. I use your current profile and selected scheme only to give more relevant guidance.", "साधारण भाषा में पूछें। बेहतर मार्गदर्शन के लिए मैं केवल आपके वर्तमान प्रोफाइल और चुनी हुई योजना का उपयोग करता हूँ।")}</p></div><div className="prompt-list">{prompts.map((prompt) => <button key={prompt} onClick={() => ask(undefined, prompt)} disabled={isStreaming} aria-label={prompt}>{prompt}<ArrowRight size={14} /></button>)}</div><div className="help-conversation" aria-live="polite">{messages.map((message, index) => <div className={`help-message ${message.role}`} key={`${message.role}-${index}`}><span>{message.role === "assistant" ? <Sparkles size={13} /> : languageText(language, "You", "??")}</span>{message.content ? <p>{message.content}</p> : <p className="help-typing"><Loader2 className="spin" size={14} />{languageText(language, "Scheme Sathi is typing…", "Scheme Sathi जवाब लिख रहा है…")}</p>}</div>)}</div><form className="help-form" onSubmit={(event) => ask(event)}><input value={question} maxLength={800} disabled={isStreaming} onChange={(event) => setQuestion(event.target.value)} placeholder={languageText(language, "Type your question…", "अपना सवाल लिखें…")} aria-label={languageText(language, "Ask Scheme Sathi a question", "Scheme Sathi से सवाल पूछें")} /><button className="button button-primary" disabled={!question.trim() || isStreaming} aria-label={languageText(language, "Send question", "सवाल भेजें")}><Send size={17} /></button></form><small className="help-disclaimer">{languageText(language, "AI guidance is informational. Always verify requirements and dates on the official portal.", "AI मार्गदर्शन केवल जानकारी के लिए है। आवश्यकताएँ और तारीखें हमेशा आधिकारिक पोर्टल पर जाँचें।")}</small></aside></div>;
}
