# NeuroPrep — CSS / PMS / PSC / FPSC — Neuroscience-Backed Preparation Platform

**Professional, production-grade web app** for Central Superior Services (CSS) Pakistan, PMS, FPSC, PPSC, AJK PSC, BPSC, FIA and 80+ exam bodies. Built with evidence-based cognitive science, human factors engineering, and a full **eyes-free no-screen mode** for zero eye strain.

Live: `prep/index.html` → https://{port}-{sandbox}.e2b.app/prep/

## 🧬 Neuroscience Techniques Implemented (8 + extensions)

1. **Spaced Repetition (FSRS-inspired, Leitner 5-box)** — Intervals 10m → 1d → 3d → 7d → 30d aligned to Ebbinghaus forgetting curve. Each recall doubles half-life.
2. **Active Recall & Testing Effect** — Retrieve before feedback. 50% stronger than re-reading (Roediger & Karpicke 2006). Desirable difficulty.
3. **Interleaving** — Mixed subjects force discrimination, build transfer critical for CSS essay, précis, current affairs.
4. **Dual Coding + Elaborative Interrogation** — Verbal + intuition anchor + why. Links new facts to existing schema (Paivio 1986; Pressley 1987).
5. **Leitner + Confidence Calibration (Metacognition)** — 1-5 confidence. High-confidence errors trigger **hypercorrection effect** — largest neuroplastic window (Dunlosky & Rawson 2012).
6. **Misconception Weeding (Conceptual Change Theory)** — Diagnose → confront → replace false mental models. Trap analysis + verified intuition. Chi 2013, Vosniadou 1994, Posner 1982.
7. **Knowledge Graphs & Schema Transfer** — Force-directed graph visualizes subject hierarchy, retention strength (green Box 4-5 hardened, cyan consolidating, red misconception, gray unseen). Reveals gaps.
8. **Sleep, Circadian & Ultradian Optimization** — Review timing respects consolidation windows. Pomodoro 25/5 aligns to BRAC ultradian rhythm. No-screen reduces blue light & preserves melatonin (Diekelmann & Born 2010; Walker 2017).

Extensions: Generation effect, 20-20-20 eye rule, binaural earcons, spatial audio hints.

## 👁️‍🗨️ Eyes-Free No-Screen Mode — Zero Eye Strain

- **0 nits OLED pitch black** — display at 0 nits, tiny breathing dot only.
- **Full audio I/O** — Web Speech API TTS (auto Urdu/English detect) + SpeechRecognition for voice answers ("Option B" or "2").
- **Web Audio API earcons** — Harmonic chords: correct = C5-E5-G5 major triad, incorrect = soft minor, select = click, advance = airy chime. Reduces visual dependency.
- **Keyboard-only control** — 1-4 / A-D answer, N/P next/prev, R repeat all, Q question only, O options only, E explanation, W weed-out analysis, H hint, C + 1-5 confidence, Space pause/resume, S skip, B blackout toggle, Enter finish, Esc exit.
- **Circadian safe** — No blue light, no photon load. Recommended for 40+ min sessions.

## 📊 Visual Load & Acoustic Load Engineering

### Visual Load Calculator (Human Factors)
Measures: background luminance (cd/m² from theme), text contrast (WCAG), blue light %, motion (animation duration & count), information density (elements/viewport), font strain (size, weight, spacing, family).
- Score 0-100: <35 excellent for 90+ min deep work, <50 good for 45-60m, <70 moderate need 20-20-20 breaks, >70 high risk.
- Optimizations: OLED pure black, sepia paper, Lexend dyslexia-friendly, Atkinson hyperlegible, font size 12-22px, line height 1.2-2.2, letter spacing -0.02 to 0.12em, blue filter 0-80%, reduce motion (vestibular safety), focus mode (sentence highlight), reading ruler.

### Acoustic Load Calculator
Measures: speech rate (WPM, optimal 135-145 WPM at 0.9×), volume (dB eq), pitch variance, continuous listening duration, earcon frequency, spatial audio.
- Score 0-100 with advice for 60+ min sustainability.
- Optimizations: rate 0.5-1.4×, pitch 0.7-1.4, volume 20-100%, spatial hints (left ear A/B, right C/D).

Live badges in topbar show VIS and ACU scores in real-time. Settings drawer shows detailed breakdown.

## 🎨 Visual Controls & Theming

- Themes: dark (8 nits), light (180 nits), sepia (60 nits paper), OLED pure black (0-2 nits), high-contrast WCAG AAA, low-contrast dyslexia.
- Fonts: Inter UI optimized (default), Lexend dyslexia-friendly research-backed, Atkinson hyperlegible low vision, Fraunces serif for essay/comprehension, JetBrains Mono precise, Noto Nastaliq Urdu.
- Blue light filter, reduce motion respects prefers-reduced-motion, focus mode dims non-focused, reading ruler follows cursor.

## ⌨️ Keyboard Shortcuts — Vim-inspired, Minimal Hand Movement

Global: Ctrl+K command palette, ? shortcuts help, T theme, , settings, Ctrl+Shift+N no-screen, G D/S/W/K/H navigation (two-key).
Quiz visual: 1-4 / A-D answer, N/J/→ next, P/K/← prev, Space speak, C then 1-5 confidence, E/X explanation, W weed-out, H hint, S skip, Enter finish, Esc exit, F focus mode.
Eyes-free: R repeat all, Q question only, O options only, B OLED blackout, voice "Option A".

## 🕸️ Knowledge Graph

Canvas-based force simulation, zoom/pan, search, filter (weak/strong/unseen), inspector card with retention meter and drill button. Nodes glow based on health. Edges show subject → topic hierarchy. Supports CSS cross-linking: Pak Affairs → Current Affairs → International Relations.

## 📈 Analytics

- Leitner boxes dashboard, due queue, weakest list.
- Retention forecast 7-day chart (exponential decay per box half-life).
- Confidence calibration chart (ideal diagonal vs actual, detects overconfidence).
- Session history, repair rate, hypercorrection alerts.

## 🚀 Platform Optimization

- PWA: manifest.json + sw.js offline cache for JSON banks (21k+ questions + 80+ boards).
- Debounced search, lazy canvas rendering, requestAnimationFrame brain animation, prefers-reduced-motion support.
- LocalStorage persistence for learning profiles, misconceptions, history.
- Fully responsive: 320px to 4K, print styles, keyboard accessible, screen reader friendly.
- No build step — vanilla JS modules, <150KB total (excluding question banks), loads in <1s on 3G.

## 📂 Structure

- `prep/index.html` — Main app, semantic, accessible, SEO optimized.
- `prep/styles.css` — Design system with CSS variables, visual load theming.
- `prep/app.js` — Cognitive engine: Leitner, spaced, misconceptions, audio, visual load, graphs, pomodoro, command palette.
- `prep/manifest.json` — PWA.
- `prep/sw.js` — Offline.
- `board/` — 80+ exam bodies JSON.
- `builder/questions.json` — 21k curated Qs.

## 🧪 How to Use for CSS

1. Dashboard shows retention, due, visual/acoustic load.
2. Study → filter Collection = CSS-related (or FPSC/PPSC), Subject = e.g., Pakistan Affairs, Current Affairs, English.
3. Choose mode: Practice for learning, Interleaved for transfer, Due for spaced, Weed-Out for misconceptions.
4. Enable No-Screen for eyes-free sessions (recommended evening).
5. Quiz: answer via 1-4, rate confidence C+1-5, get trap analysis + verified intuition.
6. Review Analytics: retention forecast, calibration.
7. Knowledge Graph to see gaps.
8. Pomodoro 25/5 for ultradian rhythm, 20-20-20 eye rule.

## 🔬 Research References

Ebbinghaus 1885, Roediger & Karpicke 2006, Kornell & Bjork 2008, Paivio 1986, Pressley 1987, Leitner 1972, Dunlosky & Rawson 2012, Chi 2013, Vosniadou 1994, Posner 1982, Novak & Cañas 2008, Cepeda et al 2008, Diekelmann & Born 2010, Walker 2017, Rayner 1998.

---
Built for prolonged retention, intuition hardening, weeding out bad concepts, zero eye strain.
