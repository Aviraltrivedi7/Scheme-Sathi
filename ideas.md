# Scheme Sathi — Product Blueprint & Design Direction

## Existing Project Analysis

Original archive se ye clear hai ki product ka core idea strong hai: user profile collect karke government schemes ko eligibility score ke saath rank karna, bilingual content dikhana, scheme details explain karna, PDF/WhatsApp sharing dena, aur help chatbot provide karna. Original implementation React + TypeScript + Vite par based hai, local `public/data/schemes.json` fallback ke saath Supabase reads karta hai, aur English/Hindi translations already available hain.

Current version ki sabse important gaps ye hain: landing experience kaafi generic aur centered hai; profile form mein validation aur progress guidance limited hai; matcher `states` arrays, gender rules, caste `all`, aur dataset ke kuch occupation values ko fully handle nahi karta; loading screen ka copy result count se pehle galat context use karta hai; results page mein search, category browsing, saved schemes, empty-state recovery aur clearer scoring explanation missing hain; detail page useful hai par hierarchy aur mobile scanability improve ho sakti hai; chatbot ka UX useful hai lekin product navigation se loosely connected hai; README abhi starter template hai; aur architecture ko single-screen state machine se reusable layout, typed domain data aur deterministic client-side dataset ke around simplify karna chahiye.

## Three Possible Directions

### Approach 1 — Jan Seva Editorial

Government information ko ek calm, editorial public-service guide jaisa present karega: paper texture, ink blue, saffron accents, aur human illustrations. Emotional intent: trustworthy, warm, clear, non-intimidating.

**Probability:** 0.07

### Approach 2 — Civic Utility Desk

Ek precise, data-forward civic dashboard: cool slate surfaces, strong tables, compact filters, aur utility-first navigation. Emotional intent: fast, serious, operational, high information density.

**Probability:** 0.03

### Approach 3 — Bharat Futures

Ek optimistic, contemporary public-benefits portal: bright cream canvas, emerald signals, coral highlights, modular cards, aur subtle modernist geometry. Emotional intent: progress, agency, discoverability, younger audiences.

**Probability:** 0.09

## Chosen Approach: Jan Seva Editorial

### Design Movement

**Contemporary editorial civic design** — Indian public-service information ko magazine-like hierarchy, restrained print texture, aur modern digital affordances ke saath translate karna. Ye direction official-feeling rahegi, par bureaucratic ya cold nahi lagegi.

### Core Principles

1. **Clarity before decoration.** Har screen par user ko next action aur eligibility logic obvious dikhna chahiye.
2. **Human guidance, not government jargon.** Copy short, conversational aur bilingual parity ke saath hogi.
3. **Editorial rhythm.** Full-width centered stacks ki jagah asymmetrical split layouts, side rails, callouts aur staggered sections use honge.
4. **Trust through evidence.** Source, administering body, last-reviewed cue, match factors, documents aur application steps visible rahenge.

### Color Philosophy

Canvas ke liye warm **khadi cream** use hoga, jo government forms/paper ki familiarity laata hai. Primary **ink indigo** trust aur legibility ko anchor karega. **Haldi saffron** discovery, progress aur action ko signal karega; **paan emerald** verified match aur positive status ke liye use hoga; **gulabi coral** warnings aur human warmth ke liye reserved rahega. Colors ko large gradients ki tarah nahi, editorial highlights ki tarah use karna hai.

### Layout Paradigm

Home par left-aligned masthead + right-side illustration wala split hero hoga. Discovery content ke liye sticky left filter rail aur flexible result column hoga. Details page mein narrow reading column ke saath right-side sticky action card hoga. Mobile par rail bottom sheet/drawer mein collapse hogi. Cards same-size uniform grid ke bajay lead match + compact list rhythm follow karenge.

### Signature Elements

1. **Margin notes:** section labels, source notes aur small metadata editorial margin annotations ke form mein.
2. **Eligibility seal:** score ko simple circle/progress ring ke saath “Strong match” language mein explain karna.
3. **Paper grain + ink rules:** very subtle texture, thin dividers aur offset saffron rules, bina visual noise ke.

### Interaction Philosophy

User ko form fill karne wala applicant nahi, guided explorer feel karana hai. Har step par one-decision-at-a-time choices, visible completion state, inline explanation aur safe back path honge. Buttons press par subtle scale feedback denge; filters instant result count update karenge; saving local-only rahegi aur clearly labeled hogi.

### Animation

Entrance animations sirf opacity + translate ke restrained 180–240ms transitions honge. Profile steps mein progress rule smoothly advance hoga. Results cards 40ms stagger se reveal honge. Drawer/modal origin-aware scale 0.96 se enter honge. Hover par border/shadow shift hoga, layout jump nahi. `prefers-reduced-motion` par non-essential motion disable rahega.

### Typography System

Display headings ke liye **DM Serif Display** ya fallback Georgia-style serif, jo public editorial authority de. Body/UI ke liye **Plus Jakarta Sans** ya system sans; Hindi ke liye **Noto Sans Devanagari**. Headings high-contrast serif, body 15–17px readable, metadata uppercase small caps/letter spacing, aur score numerals tabular-feeling bold sans honge.

### Brand Essence

**Scheme Sathi: har parivaar ke liye sahi sarkari yojana samajhne aur dhoondhne ka seedha, bharosemand saathi.**

Personality: **warm, precise, empowering**.

### Brand Voice

Headlines clear aur encouraging honge; CTAs action-oriented but non-pushy; microcopy user ki uncertainty ko reduce karegi. Generic filler avoid karna hai.

Example lines:

> “Aapke profile ke hisaab se jo yojana sabse zyada fit baithti hain, unse shuru karein.”

> “Sirf 3 minute mein apni eligibility ka seedha jawab paaiye.”

### Wordmark & Logo

Wordmark mein “Scheme Sathi” ko serif editorial wordmark ke saath use kiya jayega, lekin logo mark text-based nahi hoga. Mark ek folded government document + rising sun/guide-star ka compact symbol hoga, jo header aur favicon mein clearly visible rahega.

### Signature Brand Color

**Sathi Saffron — `#D9822B`**. Ye familiar national warmth ko action signal ke saath jodta hai, aur indigo/cream canvas par ownable contrast deta hai.

## Phase-wise Implementation Blueprint

### Phase 1 — Foundation & domain model

Typed `Scheme`, `UserProfile`, eligibility rule helpers, bilingual field helpers, local persistence keys, and normalized dataset adapter establish karna. Original dataset ke state-specific, gender-specific aur occupation edge cases preserve karne hain.

### Phase 2 — Brand system & shell

Global tokens, fonts, logo mark, responsive page shell, header, language switcher, theme behavior, toast system, and accessibility foundations build karna. Home, results aur details ke liye shared navigation escape routes define karna.

### Phase 3 — Discovery home

Editorial hero, trust strip, popular categories, featured schemes, “find my matches” onboarding CTA, search entry point, and a concise explanation of how matching works. Hero asset custom generated illustration se powered hoga.

### Phase 4 — Guided profile matcher

Three-step responsive form with validation, profile summary, progress state, clear labels, state/category/occupation normalization, optional special statuses, and local saved-profile reuse. Submit ke baad deterministic scoring engine all supported eligibility rules evaluate karega.

### Phase 5 — Results workspace

Match summary, lead match card, compact additional matches, search, level/category filters, minimum-score control, sorting, saved scheme toggle, match-factor explanations, edit-profile path, and no-result recovery. Mobile filter drawer aur sticky summary add karni hai.

### Phase 6 — Scheme detail & application readiness

Readable detail page with benefit, eligibility, documents checklist, application steps, administering body/source, match rationale, portal action, PDF export, WhatsApp/share action, and privacy-safe profile summary. Details layout mobile par action card ko bottom sticky bar mein adapt karega.

### Phase 7 — Guidance layer

Contextual chatbot/help drawer ko results aur details se connect karna; local FAQ fallback maintain karna; quick prompts profile/category-aware rakhna; placeholder network behavior ko transparent error state dena.

### Phase 8 — Verification & handoff

Build/type checks, responsive screenshot pass, keyboard/focus checks, empty/error/loading states, mobile verification, and final project checkpoint. Publish action manually Management UI se user karega.

## Acceptance Criteria

Application start se result tak bina dead-end ke chale; English aur Hindi views mein meaning parity rahe; state/gender/occupation rules dataset ke saath match hon; results clearly bataye ki scheme kyun match hui; details page par application-ready information scan ho; local saved profile aur saved schemes refresh ke baad persist karein; mobile viewport par controls accessible rahein; aur UI generic starter template jaisa na lage.

## Application Desk & Deadline Blueprint

### Product intent

Authenticated users ke liye **Application Desk** ek private, task-oriented workspace hoga. Har tracked scheme ke paas clear status, application reference, deadline, next action aur reminder signal hoga. User ko public scheme search aur private application progress ke beech context switch nahi karna padega.

### Data model

`scheme_catalog` mein optional `applicationDeadline` aur `deadlineLabel` add honge. `tracked_applications` user aur scheme ka unique relation rakhega, saath mein status (`considering`, `preparing`, `submitted`, `approved`, `rejected`, `closed`), reference number, user deadline, notes aur timestamps. `application_reminders` per tracked application reminder time, reminder kind, delivery state aur Heartbeat `taskUid` store karega. Scheduled callbacks hamesha `taskUid` se reminder lookup karenge, payload se ID trust nahi karenge.

### Dashboard structure

Top par **At a glance** counts, followed by an editorial deadline strip. Main board mein status columns ke badle compact application cards honge—current status, deadline countdown, next step, reminder state aur one-click status update ke saath. Mobile par same cards chronological due-date list mein stack honge. Sign-in ke bina dashboard account prompt dikhayega.

### Reminder behavior

User date/time choose karke ek application reminder schedule kar sakta hai. Backend six-field UTC Heartbeat schedule create karta hai, `taskUid` database row mein persist karta hai, aur callback `/api/scheduled/application-reminder` par cron identity authenticate karke reminder status ko delivered mark karta hai. Initial delivery channel in-app notification record hai; dashboard refresh par pending/delivered reminder timeline visible rahegi. Production schedule creation ke liye deployment required hoga.

### Discovery controls

Results workspace mein state selector, category filters, scheme level, deadline window (`Any`, `Closing soon`, `Open-ended`) aur sorting (`Best match`, `Deadline soonest`, `Recently reviewed`, `Name`, `Category`) honge. Profile match results still priority maintain karenge; deadline sort only visible catalogue data ko reorder karega.

## Style Decisions

- Discovery cards equal SaaS-style grid nahi honge; category shelf mein ek emphasized lead category aur quieter supporting entries ka editorial rhythm rahega.
- Scheme Sathi wordmark ko serif editorial masthead treatment diya gaya hai; folded-document plus guide-star mark ko saffron tile aur larger contrast ke saath header mein readable rakha gaya hai.
- Sathi Saffron `#D9822B` primary actions aur discovery emphasis own karta hai; Paan Emerald trust, privacy, verified aur positive eligibility signals ke liye reserved hai.
- Visible bilingual cues aur India-contextual copy landing page par intentionally rakhi gayi hai, taaki product generic benefits search jaisa na lage.
