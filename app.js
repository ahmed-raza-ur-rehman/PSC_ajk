/* ═══════════════════════════════════════════════════════════════
   NeuroPrep — Professional Cognitive Engine v2
   CSS / PMS / PSC — Neuroscience, Psych, Bio, Human Factors
   Visual Load + Acoustic Load + Knowledge Graphs + Eyes-Free
   ═══════════════════════════════════════════════════════════════ */

const state = {
  banks: [],
  available: [],
  filtered: [],
  session: null,
  lastFilters: null,
  boardCatalog: [],
  builderManifest: null,
  shards: new Map(),
  voiceMode: false,
  noScreen: false,
  blackoutMode: false,
  focusMode: false,
  recognition: null,
  learning: {},
  misconceptions: {},
  voices: [],
  audioSettings: {
    voiceId: 'default',
    rate: 0.9,
    pitch: 1.0,
    volume: 1.0,
    earcons: true,
    autoSpeak: false,
    spatialAudio: false,
  },
  visualSettings: {
    theme: 'dark',
    fontFamily: 'inter',
    fontSize: 15,
    lineHeight: 1.65,
    letterSpacing: 0,
    blueFilter: 0,
    reduceMotion: false,
    focusMode: false,
    readingRuler: false,
  },
  currentNav: 'dashboard',
  currentQuestionIndex: 0,
  waitingConfidence: false,
  misconceptionFilter: 'all',
  graphNodes: [],
  graphEdges: [],
  graphOffset: { x: 0, y: 0 },
  graphScale: 1,
  graphSearch: '',
  graphSelectedNode: null,
  pomodoro: {
    running: false,
    timeLeft: 25 * 60,
    label: 'Focus',
    interval: null,
    mode: 'focus', // focus, break
  },
  visualLoad: { score: 0, details: {} },
  acousticLoad: { score: 0, details: {} },
};

const STORAGE_KEY = 'neuroprep-history-v3';
const LEARNING_KEY = 'neuroprep-learning-v3';
const THEME_KEY = 'neuroprep-theme-v3';
const VOICE_KEY = 'neuroprep-voice-v3';
const AUDIO_SETTINGS_KEY = 'neuroprep-audio-v3';
const VISUAL_SETTINGS_KEY = 'neuroprep-visual-v3';
const MISCONCEPTIONS_KEY = 'neuroprep-misconceptions-v3';

const LEITNER_INTERVALS = [
  10 * 60 * 1000,
  24 * 60 * 60 * 1000,
  3 * 24 * 60 * 60 * 1000,
  7 * 24 * 60 * 60 * 1000,
  14 * 24 * 60 * 60 * 1000,
  30 * 24 * 60 * 60 * 1000,
];

// ─── Helpers ───
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' })[c]);
const labelize = (v) => String(v || '').replaceAll('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
const shuffle = (a) => [...a].sort(() => Math.random() - 0.5);
const hasUrdu = (v) => /[\u0600-\u06ff]/.test(v || '');
const now = () => Date.now();
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const debounce = (fn, ms) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; };

// ─── Toast ───
let toastTimer;
function toast(msg, dur=2600){
  const el = $('#toast');
  if(!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> el.classList.add('hidden'), dur);
}

function setOverlayState(isOpen){
  document.body.classList.toggle('overlay-open', isOpen);
}

function closeOpenOverlays(){
  const closers = [
    ['#cmd-palette', closeCommandPalette],
    ['#settings-drawer', closeSettings],
    ['#voice-modal', closeVoiceModal],
    ['#shortcuts-modal', closeShortcuts],
  ];
  let closed = false;
  closers.forEach(([selector, close])=>{
    const el = $(selector);
    if(el && !el.classList.contains('hidden')){ close(); closed = true; }
  });
  return closed;
}

// ─── Theme & Visual Settings ───
function initTheme(){
  const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
  state.visualSettings.theme = savedTheme;
  document.documentElement.setAttribute('data-theme', savedTheme);
  const meta = $('#theme-color-meta');
  if(meta){
    const colors = { dark:'#0a0f1e', light:'#f8fafc', sepia:'#fdf6e3', oled:'#000000', 'high-contrast':'#000000', 'low-contrast':'#1a1a2e' };
    meta.setAttribute('content', colors[savedTheme] || '#0a0f1e');
  }
  loadVisualSettings();
  applyVisualSettings();
}
function toggleTheme(){
  const themes = ['dark','light','sepia','oled'];
  const cur = document.documentElement.getAttribute('data-theme') || 'dark';
  const idx = themes.indexOf(cur);
  const next = themes[(idx+1)%themes.length];
  setTheme(next);
}
function setTheme(theme){
  state.visualSettings.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  const sel = $('#set-theme'); if(sel) sel.value = theme;
  saveVisualSettings();
  calculateVisualLoad();
  toast(`Theme: ${labelize(theme)}`);
  const meta = $('#theme-color-meta');
  if(meta){
    const colors = { dark:'#0a0f1e', light:'#f8fafc', sepia:'#fdf6e3', oled:'#000000', 'high-contrast':'#000000', 'low-contrast':'#1a1a2e' };
    meta.setAttribute('content', colors[theme] || '#0a0f1e');
  }
}
function loadVisualSettings(){
  try{
    const saved = JSON.parse(localStorage.getItem(VISUAL_SETTINGS_KEY));
    if(saved) state.visualSettings = { ...state.visualSettings, ...saved };
  }catch{}
}
function saveVisualSettings(){
  localStorage.setItem(VISUAL_SETTINGS_KEY, JSON.stringify(state.visualSettings));
  localStorage.setItem(THEME_KEY, state.visualSettings.theme);
}
function applyVisualSettings(){
  const vs = state.visualSettings;
  document.documentElement.setAttribute('data-theme', vs.theme);
  document.documentElement.setAttribute('data-font', vs.fontFamily);
  document.documentElement.setAttribute('data-motion', vs.reduceMotion ? 'off' : 'on');
  document.documentElement.style.setProperty('--font-size-base', `${vs.fontSize}px`);
  document.documentElement.style.setProperty('--line-height-base', `${vs.lineHeight}`);
  document.documentElement.style.setProperty('--letter-spacing-base', `${vs.letterSpacing}em`);
  document.documentElement.style.setProperty('--blue-filter', `${vs.blueFilter}%`);
  document.body.classList.toggle('focus-mode', vs.focusMode);
  state.focusMode = vs.focusMode;

  // sync controls
  const map = {
    '#set-theme': vs.theme,
    '#set-font-family': vs.fontFamily,
    '#set-font-size': vs.fontSize,
    '#set-line-height': vs.lineHeight,
    '#set-letter-spacing': vs.letterSpacing,
    '#set-blue-filter': vs.blueFilter,
    '#set-reduce-motion': vs.reduceMotion,
    '#set-focus-mode': vs.focusMode,
    '#set-reading-ruler': vs.readingRuler,
  };
  Object.entries(map).forEach(([sel,val])=>{
    const el = $(sel);
    if(!el) return;
    if(el.type === 'checkbox') el.checked = val;
    else el.value = val;
  });
  const fontSizeVal = $('#set-font-size-val'); if(fontSizeVal) fontSizeVal.textContent = `${vs.fontSize}px`;
  const lhVal = $('#set-line-height-val'); if(lhVal) lhVal.textContent = Number(vs.lineHeight).toFixed(2);
  const lsVal = $('#set-letter-spacing-val'); if(lsVal) lsVal.textContent = `${Number(vs.letterSpacing).toFixed(2)}em`;
  const bfVal = $('#set-blue-filter-val'); if(bfVal) bfVal.textContent = `${vs.blueFilter}%`;

  // reading ruler
  const ruler = $('#reading-ruler');
  if(ruler) ruler.classList.toggle('hidden', !vs.readingRuler);
}

// ─── Visual Load Calculator (Human Factors Engineering) ───
function calculateVisualLoad(){
  const vs = state.visualSettings;
  // Factors 0-100 each
  let luminance = 0;
  switch(vs.theme){
    case 'oled': luminance = 2; break;
    case 'dark': luminance = 18; break;
    case 'low-contrast': luminance = 22; break;
    case 'sepia': luminance = 45; break;
    case 'light': luminance = 78; break;
    case 'high-contrast': luminance = 90; break;
    default: luminance = 30;
  }
  // Blue light adds to load for evening (circadian disruption)
  const hour = new Date().getHours();
  const isEvening = hour >= 19 || hour <= 5;
  let blueLight = vs.blueFilter > 0 ? Math.max(0, 60 - vs.blueFilter) : (isEvening ? 65 : 25);
  if(vs.theme === 'oled' || vs.theme === 'dark') blueLight = Math.max(0, blueLight - 30);

  // Contrast strain: high contrast = more strain for long sessions, low contrast = more effort
  let contrastStrain = 0;
  if(vs.theme === 'high-contrast') contrastStrain = 55;
  else if(vs.theme === 'low-contrast') contrastStrain = 40;
  else if(vs.theme === 'light') contrastStrain = 35;
  else contrastStrain = 15;

  // Font strain
  let fontStrain = 0;
  if(vs.fontSize < 13) fontStrain += 25;
  if(vs.fontSize > 20) fontStrain += 10;
  if(vs.lineHeight < 1.4) fontStrain += 20;
  if(vs.letterSpacing < -0.01) fontStrain += 15;
  if(vs.letterSpacing > 0.08) fontStrain += 10;
  if(vs.fontFamily === 'mono') fontStrain += 8;
  fontStrain = clamp(fontStrain, 0, 50);

  // Motion
  let motion = vs.reduceMotion ? 2 : 28;
  // Check orb count, animations
  const motionElements = document.querySelectorAll('.orb, .brain-map').length;
  motion += motionElements * 3;

  // Information density: elements in viewport
  const visibleElements = document.querySelectorAll('.panel, .technique-card, .stat-card, .question-card').length;
  let density = clamp(visibleElements * 2.5, 0, 40);

  // Overall weighted
  const score = Math.round(
    luminance * 0.22 +
    blueLight * 0.22 +
    contrastStrain * 0.18 +
    fontStrain * 0.18 +
    motion * 0.10 +
    density * 0.10
  );

  const details = { luminance, blueLight, contrastStrain, fontStrain, motion, density };
  state.visualLoad = { score, details };

  // Update UI badges
  updateVisualLoadUI(score, details);
  return { score, details };
}
function updateVisualLoadUI(score, details){
  const setVal = (id, v) => { const el = $(id); if(el) el.textContent = v; };
  const setWidth = (id, w) => { const el = $(id); if(el) el.style.width = `${clamp(w,0,100)}%`; };
  const badgeClass = (score) => score < 35 ? '' : score < 60 ? 'warn' : 'danger';

  setVal('#visual-load-val', `${score}`);
  setVal('#set-visual-load', `${score}/100`);
  setVal('#opt-visual-score', `${score}/100`);
  setWidth('#visual-load-dot', 100); // dot color handled via parent class
  setWidth('#mini-visual-bar', score);
  setWidth('#opt-visual-fill', score);
  setWidth('#set-visual-bar', score);

  const badge = $('#visual-load-badge');
  if(badge){ badge.className = `load-badge ${badgeClass(score)}`; }

  const advice = score < 30 ? 'Excellent — optimal for 90+ min deep work. Low luminance, low blue light, minimal motion.' :
                 score < 50 ? 'Good — suitable for 45-60 min sessions. Consider OLED or sepia for longer.' :
                 score < 70 ? 'Moderate — take 20-20-20 breaks. Enable blue filter & reduce motion for eye rest.' :
                 'High — risk of eye strain & fatigue. Switch to OLED/sepia, increase font size, enable reduce motion.';
  setVal('#set-visual-advice', advice);
  setVal('#opt-visual-desc', advice);
  setVal('#mini-visual-txt', score < 35 ? 'Low strain • Deep work ready' : score < 60 ? 'Moderate • 45m sessions' : 'High • Eye rest needed');

  const dot = $('#visual-load-dot');
  if(dot){
    dot.style.background = score < 35 ? 'var(--success)' : score < 60 ? 'var(--warning)' : 'var(--error)';
    dot.style.boxShadow = `0 0 8px ${score < 35 ? 'var(--success)' : score < 60 ? 'var(--warning)' : 'var(--error)'}`;
  }
}

// ─── Acoustic Load Calculator ───
function calculateAcousticLoad(){
  const as = state.audioSettings;
  const vs = state.visualSettings;
  // Speech rate: 0.5x ~75 WPM low load but slow comprehension, 1.4x ~210 WPM high load
  let rateLoad = 0;
  if(as.rate < 0.7) rateLoad = 35; // too slow = attentional drift
  else if(as.rate <= 0.95) rateLoad = 15; // optimal 135-145 WPM
  else if(as.rate <= 1.15) rateLoad = 30;
  else rateLoad = 55;

  // Volume: very low = strain, very high = fatigue
  let volumeLoad = 0;
  if(as.volume < 0.4) volumeLoad = 40;
  else if(as.volume < 0.7) volumeLoad = 20;
  else if(as.volume <= 1.0) volumeLoad = 12;
  else volumeLoad = 30;

  // Pitch variance: extreme pitch = more effort
  let pitchLoad = Math.abs(as.pitch - 1.0) * 80;

  // Duration: continuous listening (we track session time)
  let durationLoad = 0;
  if(state.session){
    const answered = state.session.answers.filter(a=>a!==null).length;
    const total = state.session.questions.length;
    const progress = total ? answered/total : 0;
    durationLoad = progress * 25; // up to 25
  }

  // Earcons: frequent = slightly higher but reduces visual load trade-off
  let earconLoad = as.earcons ? 8 : 0;

  // Spatial audio
  let spatialLoad = as.spatialAudio ? 6 : 0;

  // Blue filter interaction: if visual load high, acoustic load should be lower (balance)
  const visualCompensation = state.visualLoad.score > 60 ? -8 : 0;

  const score = Math.round(clamp(
    rateLoad*0.35 + volumeLoad*0.25 + pitchLoad*0.15 + durationLoad*0.15 + earconLoad*0.05 + spatialLoad*0.05 + visualCompensation,
    0, 100
  ));

  const details = { rateLoad, volumeLoad, pitchLoad, durationLoad, earconLoad, spatialLoad };
  state.acousticLoad = { score, details };
  updateAcousticLoadUI(score, details);
  return { score, details };
}
function updateAcousticLoadUI(score, details){
  const setVal = (id,v)=>{ const el=$(id); if(el) el.textContent=v; };
  const setWidth = (id,w)=>{ const el=$(id); if(el) el.style.width=`${clamp(w,0,100)}%`; };
  const badgeClass = (s)=> s<35 ? '' : s<60 ? 'warn' : 'danger';

  setVal('#acoustic-load-val', `${score}`);
  setVal('#set-acoustic-load', `${score}/100`);
  setVal('#opt-acoustic-score', `${score}/100`);
  setWidth('#mini-acoustic-bar', score);
  setWidth('#opt-acoustic-fill', score);
  setWidth('#set-acoustic-bar', score);

  const badge = $('#acoustic-load-badge');
  if(badge) badge.className = `load-badge ${badgeClass(score)}`;

  const advice = score < 30 ? 'Excellent — 135 WPM optimal for retention. Low fatigue, ideal for 60+ min eyes-free.' :
                 score < 50 ? 'Good — sustainable. Consider slowing to 0.9× for complex CSS topics.' :
                 score < 70 ? 'Moderate — take audio breaks every 20 min. Lower volume & rate.' :
                 'High — auditory fatigue risk. Reduce rate to 0.85×, volume 70%, enable pauses.';
  setVal('#set-acoustic-advice', advice);
  setVal('#opt-acoustic-desc', advice);
  setVal('#mini-acoustic-txt', score<35 ? 'Low fatigue • 60m+ ready' : score<60 ? 'Moderate • 40m sessions' : 'High • Break needed');

  const dot = $('#acoustic-load-dot');
  if(dot){
    dot.style.background = score < 35 ? 'var(--success)' : score < 60 ? 'var(--warning)' : 'var(--error)';
    dot.style.boxShadow = `0 0 8px ${score < 35 ? 'var(--success)' : score < 60 ? 'var(--warning)' : 'var(--error)'}`;
  }
}

// ─── Circadian & Cognitive Load ───
function calculateCircadian(){
  const hour = new Date().getHours();
  let phase = '', score = 0, fill = 0;
  if(hour >= 6 && hour < 10){ phase='Morning Peak • Declarative best'; score=85; fill=85; }
  else if(hour >=10 && hour <14){ phase='Late Morning • Peak memory'; score=92; fill=92; }
  else if(hour >=14 && hour <17){ phase='Afternoon Dip • Procedural good'; score=60; fill=60; }
  else if(hour >=17 && hour <21){ phase='Evening • Creative & transfer'; score=70; fill=70; }
  else { phase='Night • Consolidation • Sleep prep'; score=30; fill=30; }
  const el = $('#opt-circadian'); if(el) el.textContent = phase;
  const fillEl = $('#opt-circadian-fill'); if(fillEl) fillEl.style.width = `${fill}%`;
  return { phase, score };
}
function calculateCognitiveLoad(){
  const due = dueQuestions().length;
  const weak = Object.values(state.learning).filter(p=>p.lapses>0).length;
  const total = Object.keys(state.learning).length || 1;
  // Intrinsic: difficulty of material (weak ratio)
  const intrinsic = clamp((weak/total)*100, 0, 100);
  // Extraneous: visual+acoustic load average
  const extraneous = (state.visualLoad.score + state.acousticLoad.score)/2;
  // Germane: effortful but productive (due ratio)
  const germane = clamp((due/total)*80, 0, 100);
  const overall = Math.round(intrinsic*0.4 + extraneous*0.35 + germane*0.25);
  const el = $('#opt-cognitive-score'); if(el) el.textContent = `${overall}/100`;
  const fill = $('#opt-cognitive-fill'); if(fill) fill.style.width = `${overall}%`;
  return { intrinsic, extraneous, germane, overall };
}

// ─── Audio Engine ───
let audioCtx = null;
function getAudioContext(){
  if(!audioCtx){
    const AC = window.AudioContext || window.webkitAudioContext;
    if(AC) audioCtx = new AC();
  }
  if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
function playEarcon(type){
  if(!state.audioSettings.earcons) return;
  try{
    const ctx = getAudioContext();
    if(!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    if(type==='correct'){
      osc.type='sine';
      osc.frequency.setValueAtTime(523.25,t);
      osc.frequency.setValueAtTime(659.25,t+0.08);
      osc.frequency.setValueAtTime(783.99,t+0.16);
      gain.gain.setValueAtTime(0.18,t);
      gain.gain.exponentialRampToValueAtTime(0.001,t+0.45);
      osc.start(t); osc.stop(t+0.45);
    }else if(type==='incorrect'){
      osc.type='triangle';
      osc.frequency.setValueAtTime(440,t);
      osc.frequency.setValueAtTime(349.23,t+0.12);
      gain.gain.setValueAtTime(0.16,t);
      gain.gain.exponentialRampToValueAtTime(0.001,t+0.38);
      osc.start(t); osc.stop(t+0.38);
    }else if(type==='select'){
      osc.type='sine';
      osc.frequency.setValueAtTime(880,t);
      gain.gain.setValueAtTime(0.07,t);
      gain.gain.exponentialRampToValueAtTime(0.001,t+0.06);
      osc.start(t); osc.stop(t+0.06);
    }else if(type==='advance'){
      osc.type='sine';
      osc.frequency.setValueAtTime(587.33,t);
      osc.frequency.exponentialRampToValueAtTime(880,t+0.12);
      gain.gain.setValueAtTime(0.08,t);
      gain.gain.exponentialRampToValueAtTime(0.001,t+0.15);
      osc.start(t); osc.stop(t+0.15);
    }else if(type==='test'){
      [523.25,659.25,783.99].forEach((f,i)=>{
        const o=ctx.createOscillator(); const g=ctx.createGain();
        o.type='sine'; o.frequency.value=f; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.12,t+i*0.08);
        g.gain.exponentialRampToValueAtTime(0.001,t+i*0.08+0.3);
        o.start(t+i*0.08); o.stop(t+i*0.08+0.3);
      });
    }
  }catch(e){ console.debug('Earcon skip', e); }
}
function loadAudioSettings(){
  try{
    const saved = JSON.parse(localStorage.getItem(AUDIO_SETTINGS_KEY));
    if(saved) state.audioSettings = { ...state.audioSettings, ...saved };
  }catch{}
  const legacy = localStorage.getItem(VOICE_KEY);
  if(legacy) state.audioSettings.voiceId = legacy;
  syncAudioControls();
}
function saveAudioSettings(){
  localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(state.audioSettings));
  localStorage.setItem(VOICE_KEY, state.audioSettings.voiceId);
  calculateAcousticLoad();
}
function syncAudioControls(){
  const s = state.audioSettings;
  const vs = state.visualSettings;
  // voice selects
  const selIds = ['#voice-select','#modal-voice-select'];
  selIds.forEach(id=>{
    const el=$(id); if(el) el.value = s.voiceId;
  });
  // speed
  const pairs = [
    ['#speech-speed', '#speech-speed-value', (v)=>`${Number(v).toFixed(2)}×`],
    ['#modal-speech-speed', '#modal-speed-val', (v)=>`${Number(v).toFixed(2)}×`],
    ['#set-speech-rate', '#set-speech-rate-val', (v)=>`${Number(v).toFixed(2)}× ~${Math.round(v*150)} WPM`],
  ];
  pairs.forEach(([inputSel, outSel, fmt])=>{
    const inp=$(inputSel); if(inp) inp.value = s.rate;
    const out=$(outSel); if(out) out.textContent = fmt(s.rate);
  });
  // pitch
  const pitchPairs = [
    ['#modal-speech-pitch','#modal-pitch-val'],
    ['#set-pitch','#set-pitch-val'],
  ];
  pitchPairs.forEach(([i,o])=>{
    const inp=$(i); if(inp) inp.value = s.pitch;
    const out=$(o); if(out) out.textContent = Number(s.pitch).toFixed(2);
  });
  // volume
  const volPairs = [
    ['#modal-speech-volume','#modal-volume-val', (v)=>`${Math.round(v*100)}%`],
    ['#set-volume','#set-volume-val', (v)=>`${Math.round(v*100)}%`],
  ];
  volPairs.forEach(([i,o,fmt])=>{
    const inp=$(i); if(inp) inp.value = s.volume;
    const out=$(o); if(out) out.textContent = fmt(s.volume);
  });
  const ear1=$('#earcon-toggle'); if(ear1) ear1.checked=s.earcons;
  const ear2=$('#set-earcons'); if(ear2) ear2.checked=s.earcons;
  const auto1=$('#auto-speak-toggle'); if(auto1) auto1.checked=s.autoSpeak;
  const auto2=$('#set-auto-speak'); if(auto2) auto2.checked=s.autoSpeak;
  const spatial=$('#set-spatial-audio'); if(spatial) spatial.checked=s.spatialAudio;
}
function refreshVoices(){
  if(!('speechSynthesis' in window)) return;
  state.voices = window.speechSynthesis.getVoices();
  const cur = state.audioSettings.voiceId;
  const fmt = (v,i)=>{
    const isQuality = /natural|google|neural|premium|enhanced/i.test(v.name);
    const star = isQuality ? '★ ' : '';
    return `<option value="${i}">${star}${esc(v.name)} (${esc(v.lang)})</option>`;
  };
  const html = '<option value="default">System default • Auto Urdu/English</option>' + state.voices.map(fmt).join('');
  ['#voice-select','#modal-voice-select'].forEach(selId=>{
    const el=$(selId);
    if(el){
      el.innerHTML = html;
      el.value = state.voices.some((_,i)=>String(i)===cur) ? cur : 'default';
    }
  });
}
function getSelectedVoice(){
  const id = state.audioSettings.voiceId;
  if(!id || id==='default' || !state.voices.length) return null;
  return state.voices[Number(id)] || null;
}
function speakText(text, onend){
  if(!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  if(!text) return;
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = hasUrdu(text) ? 'ur-PK' : 'en-US';
  utt.rate = clamp(Number(state.audioSettings.rate||0.9),0.5,1.6);
  utt.pitch = clamp(Number(state.audioSettings.pitch||1.0),0.7,1.4);
  utt.volume = clamp(Number(state.audioSettings.volume??1.0),0,1);
  const voice = getSelectedVoice();
  if(voice){ utt.voice=voice; utt.lang=voice.lang; }
  if(onend) utt.onend = onend;
  // spatial audio hint: pan slightly based on option? For now center
  if(state.audioSettings.spatialAudio && window.AudioContext){
    // Could implement PannerNode but keep simple for speechSynthesis
  }
  window.speechSynthesis.speak(utt);
}
function stopSpeech(){ if('speechSynthesis' in window) window.speechSynthesis.cancel(); }
function openVoiceModal(){ refreshVoices(); syncAudioControls(); $('#voice-modal')?.classList.remove('hidden'); setOverlayState(true); $('#modal-voice-select')?.focus(); }
  function closeVoiceModal(){ $('#voice-modal')?.classList.add('hidden'); saveAudioSettings(); if(!document.querySelector('.modal-backdrop:not(.hidden), .drawer-backdrop:not(.hidden)')) setOverlayState(false); }
function testVoiceAudio(){
  playEarcon('test');
  const statusEl=$('#test-audio-status');
  if(statusEl) statusEl.textContent='Playing test…';
  setTimeout(()=>{
    speakText('Welcome to NeuroPrep audio engine. Active recall at 135 words per minute is optimal for retention.', ()=>{
      if(statusEl) statusEl.textContent='Voice test complete.';
      setTimeout(()=>{ if(statusEl) statusEl.textContent=''; }, 3000);
    });
  }, 350);
}
function optionFromTranscript(transcript, question){
  const norm = transcript.trim().toLowerCase();
  const letter = norm.match(/^(?:option\s*)?([a-d])\b/i);
  if(letter) return letter[1].toLowerCase().charCodeAt(0)-97;
  const num = norm.match(/^(?:option\s*)?([1-4])\b/i);
  if(num) return Number(num[1])-1;
  return question.options.findIndex(o=> norm.includes(String(o).toLowerCase()));
}
function listenForAnswer(index, button){
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!Rec){ if(button) button.textContent='Voice unavailable'; return; }
  if(state.recognition) state.recognition.abort();
  const q = state.session.questions[index];
  const rec = new Rec();
  state.recognition = rec;
  rec.lang = hasUrdu(q.prompt) ? 'ur-PK' : 'en-US';
  rec.interimResults=false; rec.maxAlternatives=3;
  if(button){ button.classList.add('listening'); button.textContent='Listening…'; }
  rec.onresult=(e)=>{
    const transcript = [...e.results[0]].map(r=>r.transcript).join(' ');
    const optIdx = optionFromTranscript(transcript, q);
    if(optIdx>=0 && optIdx<q.options.length){
      chooseAnswer($('#question-list').children[index], optIdx);
    }
  };
  rec.onerror=()=>{ if(button){ button.classList.remove('listening'); button.textContent='Answer by voice'; } };
  rec.onend=()=>{ if(button){ button.classList.remove('listening'); button.textContent='Answer by voice'; } state.recognition=null; };
  rec.start();
}
function speakQuestion(index, listenAfter=false){
  if(!state.session || index<0 || index>=state.session.questions.length) return;
  const q=state.session.questions[index];
  const btn=$('#question-list')?.children[index]?.querySelector('.answer-voice-button');
  const text=`Question ${index+1} of ${state.session.questions.length}. ${q.prompt}. Options: ${q.options.map((o,i)=>`${String.fromCharCode(65+i)}: ${o}`).join('. ')}`;
  speakText(text, listenAfter ? ()=> listenForAnswer(index, btn) : null);
}
function speakQuestionPromptOnly(index){
  if(!state.session) return;
  const q=state.session.questions[index];
  speakText(`Question ${index+1}: ${q.prompt}`);
}
function speakOptionsOnly(index){
  if(!state.session) return;
  const q=state.session.questions[index];
  speakText(`Options: ${q.options.map((o,i)=>`Option ${String.fromCharCode(65+i)}: ${o}`).join('. ')}`);
}
function speakExplanation(index){
  if(!state.session) return;
  const q=state.session.questions[index];
  const anchor=getIntuitionAnchor(q);
  speakText(`Explanation for question ${index+1}. Correct: ${q.answerText}. ${q.explanation||''}. Core intuition: ${anchor.intuition}`);
}
function speakMisconceptionWeedOut(index){
  if(!state.session) return;
  const q=state.session.questions[index];
  const anchor=getIntuitionAnchor(q);
  speakText(`Misconception analysis: Correct is ${q.answerText}. Common trap: ${anchor.pitfall}`);
}
function speakHint(index){
  if(!state.session) return;
  const q=state.session.questions[index];
  speakText(`Hint: Consider core principles of ${labelize(q.subject)} and cause-effect in question.`);
}

// ─── No-Screen Mode ───
function toggleNoScreen(){
  state.noScreen = !state.noScreen;
  const overlay=$('#no-screen-overlay');
  const btn=$('#no-screen-btn');
  if(state.noScreen){
    overlay.classList.remove('hidden');
    btn.classList.add('active');
    if(state.session && !state.session.finished){
      updateNoScreenStatus();
      playEarcon('advance');
      speakQuestion(state.currentQuestionIndex,false);
    }else{
      $('#ns-status').textContent='Eyes-Free active. Start a session or press Space. Display at 0 nits.';
      speakText('Eyes Free mode active. Zero eye strain. Press Escape to exit.');
    }
  }else{
    overlay.classList.add('hidden');
    btn.classList.remove('active');
    stopSpeech();
    toast('Exited Eyes-Free mode');
  }
  calculateVisualLoad();
}
function toggleBlackoutMode(){
  state.blackoutMode = !state.blackoutMode;
  const overlay=$('#no-screen-overlay');
  const btn=$('#ns-blackout-toggle');
  if(overlay) overlay.classList.toggle('blackout-active', state.blackoutMode);
  if(btn) btn.textContent = state.blackoutMode ? '☀️ Visual Mode' : '🌑 Pitch Black OLED';
  speakText(state.blackoutMode ? 'Pitch black eye-rest active. Zero photon mode.' : 'Visual audio wave restored.');
  calculateVisualLoad();
}
function updateNoScreenStatus(){
  if(!state.session) return;
  const idx=state.currentQuestionIndex;
  const total=state.session.questions.length;
  const answered=state.session.answers.filter(a=>a!==null).length;
  $('#ns-status').textContent=`Question ${idx+1} of ${total} • ${answered} answered • Box ${getProfile(state.session.questions[idx]).box}`;
  $('#ns-progress-text').textContent=`${answered} / ${total}`;
  const fill=$('#ns-progress-fill');
  if(fill) fill.style.width=`${total ? (answered/total)*100 : 0}%`;
}

// ─── Misconceptions Engine ───
function loadMisconceptions(){
  try{ state.misconceptions = JSON.parse(localStorage.getItem(MISCONCEPTIONS_KEY)||'{}'); }catch{ state.misconceptions={}; }
}
function saveMisconceptions(){ localStorage.setItem(MISCONCEPTIONS_KEY, JSON.stringify(state.misconceptions)); }
function getIntuitionAnchor(question){
  const exp=question.explanation||'';
  return {
    intuition: exp || `Core principle of ${labelize(question.subject)}: verified domain knowledge and causal reasoning.`,
    pitfall: `Distractors mimic surface keywords or popular misnomers. Active retrieval of causal distinction builds durable schema.`
  };
}
function recordMisconception(question, selectedIdx, isCorrect, confidence){
  if(!state.misconceptions) state.misconceptions={};
  const isHyper = (!isCorrect && confidence>=4);
  if(!isCorrect){
    const existing=state.misconceptions[question.id]||{};
    state.misconceptions[question.id]={
      questionId: question.id,
      prompt: question.prompt,
      subject: question.subject,
      topic: question.topic,
      collection: question.collectionLabel,
      trappedAnswer: question.options[selectedIdx]||'None',
      correctAnswer: question.answerText,
      explanation: question.explanation||'',
      confidence,
      isHypercorrection: isHyper || existing.isHypercorrection,
      timesFailed: (existing.timesFailed||0)+1,
      hardened: false,
      lastFailedAt: now(),
      question,
    };
  }else if(state.misconceptions[question.id]){
    if(confidence>=4) state.misconceptions[question.id].hardened=true;
  }
  saveMisconceptions();
}
function misconceptionQuestions(){
  const known=new Map(state.available.map(q=>[q.id,q]));
  const items=Object.values(state.misconceptions).filter(m=>!m.hardened);
  const qs=[];
  items.forEach(m=>{
    if(m.question) qs.push(m.question);
    else if(known.has(m.questionId)) qs.push(known.get(m.questionId));
  });
  return qs;
}

// ─── Learning Profiles ───
function loadLearning(){ try{ state.learning=JSON.parse(localStorage.getItem(LEARNING_KEY)||'{}'); }catch{ state.learning={}; } }
function getProfile(question){
  return state.learning[question.id] || {
    box:1, reps:0, lapses:0, dueAt:0, interval:0, lastCorrect:null, confidence:null, streak:0, totalAttempts:0, firstSeen:null, lastSeen:null,
  };
}
function saveLearning(){ localStorage.setItem(LEARNING_KEY, JSON.stringify(state.learning)); }
function updateLearningProfile(question, correct, confidence){
  const p=getProfile(question);
  p.totalAttempts+=1; p.lastSeen=now(); if(!p.firstSeen) p.firstSeen=now();
  if(correct){
    p.streak+=1; p.lastCorrect=true;
    if(confidence>=4){ p.box=Math.min(5,p.box+1); p.reps+=1; }
    else p.reps=Math.max(1,p.reps);
  }else{
    p.streak=0; p.lastCorrect=false; p.lapses+=1; p.box=1; p.reps=0;
  }
  p.confidence=confidence||3;
  p.interval=LEITNER_INTERVALS[Math.min(p.box-1, LEITNER_INTERVALS.length-1)];
  p.dueAt=now() + (correct ? p.interval : LEITNER_INTERVALS[0]);
  p.question=question;
  state.learning[question.id]=p;
}
function dueQuestions(){
  const known=new Map(state.available.map(q=>[q.id,q]));
  Object.values(state.learning).forEach(p=>{ if(p.question) known.set(p.question.id,p.question); });
  return [...known.values()].filter(q=> getProfile(q).dueAt <= now());
}
function weakestQuestions(){
  const scored=state.available.map(q=>{
    const p=getProfile(q);
    const score=p.lapses*3 - p.reps*1 - (p.lastCorrect?2:0) + (p.box===1?5:0);
    return {question:q, score};
  });
  return scored.sort((a,b)=>b.score-a.score).map(s=>s.question);
}
function leitnerDrillQuestions(){
  const box1=state.available.filter(q=>getProfile(q).box===1);
  const box2=state.available.filter(q=>getProfile(q).box===2);
  const due=dueQuestions();
  return [...box1, ...box2, ...due.filter(q=> getProfile(q).box>2)];
}
function interleaveQuestions(questions){
  const groups=new Map();
  questions.forEach(q=>{
    const key=`${q.subject}:${q.topic||'general'}`;
    if(!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(q);
  });
  const result=[];
  while([...groups.values()].some(g=>g.length)){
    groups.forEach(g=>{ if(g.length) result.push(g.shift()); });
  }
  return result;
}
function renderLeitnerBoxes(){
  const profiles=Object.values(state.learning);
  const counts=[0,0,0,0,0];
  profiles.forEach(p=>{ if(p.box>=1 && p.box<=5) counts[p.box-1]++; });
  const total=Math.max(1,profiles.length);
  for(let i=1;i<=5;i++){
    const el=$(`#leitner-${i}`); if(el) el.textContent=counts[i-1];
    const bar=$(`#leitner-bar-${i}`); if(bar) bar.style.width=`${(counts[i-1]/total)*100}%`;
  }
}
function renderLearningDashboard(){
  const due=dueQuestions();
  const profiles=Object.values(state.learning);
  const weak=profiles.filter(p=>p.lapses>0 || p.lastCorrect===false).length;
  const stable=profiles.filter(p=>p.box>=4 && p.lastCorrect===true).length;
  const retention=profiles.length ? Math.round((profiles.filter(p=>p.lastCorrect===true).length/profiles.length)*100) : 0;

  const statDue=$('#stat-due'); if(statDue) statDue.textContent=due.length.toLocaleString();
  const statRet=$('#stat-retention'); if(statRet) statRet.textContent=profiles.length ? `${retention}%` : '—';
  const dueCount=$('#due-count'); if(dueCount) dueCount.textContent=due.length;
  const weakCount=$('#weak-count'); if(weakCount) weakCount.textContent=weak;
  const masteredCount=$('#mastered-count'); if(masteredCount) masteredCount.textContent=stable;

  const dueBtn=$('#due-button'); if(dueBtn) dueBtn.disabled=due.length===0;
  const heroDueBtn=$('#hero-due'); if(heroDueBtn){ heroDueBtn.disabled=due.length===0; const b=$('#hero-due-badge'); if(b) b.textContent=due.length; }

  renderLeitnerBoxes();
  calculateVisualLoad();
  calculateAcousticLoad();
  calculateCircadian();
  calculateCognitiveLoad();
}

// ─── Data layer — manifest-driven, lazy-loaded shards ───
// Boot downloads only the bank manifest + board catalog. Question shards
// (data/banks/builder/<subject>.json) and board subject files are fetched on
// demand when a session actually needs them, then cached in memory.
const BUILDER_SHARD_URL = (subj) => `data/banks/builder/${subj}.json`;

function normalizeBuilderQuestion(q){
  return {
    id:`builder:${q.id}`,
    source:'builder',
    collection:q.examBody,
    collectionLabel:labelize(q.examBody),
    subject:q.subj,
    topic:q.topic,
    year:q.paperYear,
    prompt:q.q,
    options:q.options,
    answerIndex:q.options.indexOf(q.answer),
    answerText:q.answer,
    explanation:q.explanation,
    reference:q.paperTitle,
  };
}
function normalizeBoardQuestion(subject,q){
  return {
    id:`board:${subject.board}:${subject.subject}:${q.id}`,
    source:'board',
    collection:subject.board,
    collectionLabel:subject.category,
    subject:subject.subject,
    topic:'',
    year:'2026',
    prompt:q.question_text,
    options:q.options,
    answerIndex:q.correct_answer_index,
    answerText:q.options[q.correct_answer_index],
    explanation:q.explanation,
    reference:`${subject.name} (${subject.category})`,
  };
}
async function loadJson(url){
  const resp=await fetch(url,{headers:{Accept:'application/json'}});
  if(!resp.ok) throw new Error(`Unable to load ${url}`);
  return resp.json();
}
async function loadBanks(){
  const manifest=loadJson('data/banks/manifest.json').then(data=>{
    state.builderManifest=data;
    return {id:'builder', label:'Builder — curated bank', questions:[]};
  });
  const board=loadJson('board/index.json').then(index=>{
    state.boardCatalog=index.subjects;
    return {id:'board', label:'Board subjects — 80+ exam bodies', questions:[]};
  });
  state.banks=await Promise.all([manifest, board]);
  state.available=[];
}
// Load a builder shard once; normalized questions are cached and merged into state.available.
async function builderShard(subj){
  if(state.shards.has(subj)) return state.shards.get(subj);
  const data=await loadJson(BUILDER_SHARD_URL(subj));
  const qs=(data.questions||[]).map(normalizeBuilderQuestion);
  state.shards.set(subj,qs);
  state.available.push(...qs);
  return qs;
}
// Progressive shard loader: fetches candidate shards in small batches until
// `need` matching questions are pooled (or everything matched for marathons).
async function collectShards(candidates, match, need, progressLabel){
  const matched=[];
  const queue=candidates.filter(Boolean);
  const total=queue.length;
  let loaded=0;
  while(queue.length && (need===Infinity || matched.length<need)){
    const batch=queue.splice(0,3);
    const results=await Promise.all(batch.map(s=>builderShard(s.subj)));
    results.forEach(qs=>{ qs.forEach(q=>{ if(!match || match(q)) matched.push(q); }); });
    loaded+=batch.length;
    if(total>3) toast(`${progressLabel} — ${Math.round(loaded/total*100)}%`, 900);
  }
  return matched;
}
function builderCandidates(filters){
  const m=state.builderManifest; if(!m) return [];
  return m.subjects.filter(s=>
    (filters.collection==='all' || s.examBodies.includes(filters.collection)) &&
    (filters.subject==='all' || s.subj===filters.subject) &&
    (filters.year==='all' || s.years.includes(filters.year)) &&
    (filters.topic==='all' || (s.topicCounts && s.topicCounts[filters.topic]>0))
  );
}
async function collectBuilderQuestions(filters, need){
  const candidates=builderCandidates(filters);
  if(!candidates.length) return [];
  return collectShards(candidates,
    q=> (filters.year==='all' || String(q.year)===String(filters.year)) && (filters.topic==='all' || q.topic===filters.topic),
    need, 'Loading builder bank');
}
async function collectBoardQuestions(filters, need){
  const subjects=state.boardCatalog.filter(s=>
    (filters.collection==='all' || s.board===filters.collection) &&
    (filters.subject==='all' || s.subject===filters.subject) &&
    (filters.year==='all' || filters.year==='2026')
  );
  const matched=[]; const queue=[...subjects]; const total=queue.length;
  while(queue.length && (need===Infinity || matched.length<need)){
    const batch=queue.splice(0,8);
    const results=await Promise.all(batch.map(async s=>{
      const data=await loadJson(s.apiFile);
      return (data.questions||[]).map(q=>normalizeBoardQuestion(data,q)).filter(q=> filters.topic==='all' || q.topic===filters.topic);
    }));
    results.forEach(qs=>matched.push(...qs));
    if(total>8) toast(`Loading board subjects — ${Math.round((total-queue.length)/total*100)}%`, 900);
  }
  return matched;
}
// Route stored learning-profile ids back to their shards so due / Leitner /
// weakest pools cover the full history even in lazy mode.
async function ensureProfileShards(){
  const m=state.builderManifest; if(!m) return;
  const need=new Set();
  for(const id of [...Object.keys(state.learning), ...Object.keys(state.misconceptions)]){
    if(!id.startsWith('builder:')) continue;
    const subj=m.idIndex?.[id.slice(8)];
    if(subj && !state.shards.has(subj)) need.add(subj);
  }
  if(need.size){
    toast('Restoring your learning history…', 1500);
    await Promise.all([...need].map(builderShard));
  }
}
function fillSelect(sel, values, allLabel){
  if(!sel) return;
  sel.innerHTML=`<option value="all">${allLabel}</option>`+values.map(v=>`<option value="${esc(v)}">${esc(labelize(v))}</option>`).join('');
}
function refreshFilters(changed){
  const source=$('#source-filter')?.value||'all';
  const m=state.builderManifest;
  const catalog=source==='builder' ? [] : state.boardCatalog;
  const builderSubjects=source==='board' ? [] : (m?.subjects||[]);
  const questions=state.available.filter(q=> source==='all' || q.source===source);
  const collections=[...new Set([
    ...builderSubjects.flatMap(s=>s.examBodies),
    ...catalog.map(q=>q.board),
  ])].sort();
  if(changed!=='collection') fillSelect($('#collection-filter'), collections, 'All collections');
  const collection=$('#collection-filter')?.value||'all';
  const builderScoped=builderSubjects.filter(s=> collection==='all' || s.examBodies.includes(collection));
  const catalogScoped=catalog.filter(q=> collection==='all' || q.board===collection);
  if(changed!=='subject') fillSelect($('#subject-filter'), [...new Set([...builderScoped.map(s=>s.subj), ...catalogScoped.map(q=>q.subject)])].sort(), 'All subjects');
  const subject=$('#subject-filter')?.value||'all';
  const subjectScoped=builderScoped.filter(s=> subject==='all' || s.subj===subject);
  const catalogSubjectScoped=catalogScoped.filter(q=> subject==='all' || q.subject===subject);
  if(changed!=='topic') fillSelect($('#topic-filter'), [...new Set(subjectScoped.flatMap(s=>s.topics))].sort(), 'All topics');
  if(changed!=='year') fillSelect($('#year-filter'), [...new Set([...subjectScoped.flatMap(s=>s.years), ...catalogSubjectScoped.map(()=> '2026')])].sort().reverse(), 'All years');
  void questions;
  updateMatches();
}
function updateMatches(){
  const filters={
    source:$('#source-filter')?.value||'all',
    collection:$('#collection-filter')?.value||'all',
    subject:$('#subject-filter')?.value||'all',
    topic:$('#topic-filter')?.value||'all',
    year:$('#year-filter')?.value||'all',
  };
  const m=state.builderManifest;
  const builderCount=(filters.source==='board' ? 0 : (m?.subjects||[]))
    .filter(s=>
      (filters.collection==='all' || s.examBodies.includes(filters.collection)) &&
      (filters.subject==='all' || s.subj===filters.subject) &&
      (filters.year==='all' || s.years.includes(filters.year)) &&
      (filters.topic==='all' || (s.topicCounts ? (s.topicCounts[filters.topic]||0) : 0) > 0)
    )
    .reduce((t,s)=> t + (filters.topic==='all' ? s.total : (s.topicCounts?.[filters.topic]||0)), 0);
  const boardCount=state.boardCatalog.filter(s=> filters.source!=='builder' && (filters.collection==='all' || s.board===filters.collection) && (filters.subject==='all' || s.subject===filters.subject) && (filters.year==='all' || filters.year==='2026')).reduce((t,s)=>t+s.totalQuestions,0);
  const total=builderCount+boardCount;
  state.filtered=[];
  const matchEl=$('#match-count'); if(matchEl) matchEl.textContent=`${total.toLocaleString()} questions match • Visual load ${state.visualLoad.score} • Acoustic load ${state.acousticLoad.score}`;
  const startBtn=$('#start-button'); if(startBtn) startBtn.disabled=total===0;
}

// ─── Recent & History ───
function renderRecent(){
  const history=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');
  const sessionCount=$('#session-count'); if(sessionCount) sessionCount.textContent=history.length;
  const list=$('#recent-list'); if(!list) return;
  list.innerHTML=history.length ? history.slice(0,8).map(item=>`<div class="recent-item"><strong>${esc(item.title)}</strong><span>${item.percent}% • ${item.correct}/${item.total} correct • ${esc(new Date(item.date).toLocaleDateString())} • Box progression</span></div>`).join('') : '<p class="empty-state">Completed sessions will appear here. Your circadian rhythm log helps optimize timing.</p>';
}
function renderHistory(){
  const history=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');
  const avgScore=history.length ? Math.round(history.reduce((s,h)=>s+h.percent,0)/history.length) : 0;
  const totalPracticed=history.reduce((s,h)=>s+h.total,0);
  const sessionCount=$('#session-count'); if(sessionCount) sessionCount.textContent=history.length;
  const avgScoreEl=$('#avg-score'); if(avgScoreEl) avgScoreEl.textContent=history.length ? `${avgScore}%` : '—';
  const totalPracticedEl=$('#total-practiced'); if(totalPracticedEl) totalPracticedEl.textContent=totalPracticed.toLocaleString()||'—';
  // calibration bias
  const allConfidences = Object.values(state.learning).map(p=>p.confidence).filter(Boolean);
  const avgConf = allConfidences.length ? (allConfidences.reduce((a,b)=>a+b,0)/allConfidences.length) : 0;
  const bias = avgConf ? `${(avgConf*20 - avgScore).toFixed(0)}% ${avgConf*20>avgScore?'overconfident':'underconfident'}` : '—';
  const biasEl=$('#calibration-bias'); if(biasEl) biasEl.textContent=bias;

  const list=$('#history-list'); if(!list) return;
  list.innerHTML=history.length ? history.map(item=>`<div class="recent-item"><strong>${esc(item.title)}</strong><span>${item.percent}% • ${item.correct}/${item.total} correct • ${esc(new Date(item.date).toLocaleDateString())}</span></div>`).join('') : '<p class="empty-state">Complete a session to see analytics.</p>';

  drawRetentionChart();
  drawCalibrationChart();
}
function drawRetentionChart(){
  const canvas=$('#retention-chart'); if(!canvas) return;
  const ctx=canvas.getContext('2d');
  const dpr=window.devicePixelRatio||1;
  canvas.width=canvas.clientWidth*dpr; canvas.height=canvas.clientHeight*dpr;
  ctx.scale(dpr,dpr);
  const W=canvas.clientWidth, H=canvas.clientHeight;
  ctx.clearRect(0,0,W,H);
  // background
  ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--bg-secondary') || '#111';
  ctx.fillRect(0,0,W,H);
  // data: forecast retention based on Leitner boxes
  const profiles=Object.values(state.learning);
  if(!profiles.length){ ctx.fillStyle='#64748b'; ctx.font='12px Inter'; ctx.fillText('Complete sessions to see retention forecast', 20, H/2); return; }
  const boxes=[0,0,0,0,0];
  profiles.forEach(p=>{ if(p.box>=1&&p.box<=5) boxes[p.box-1]++; });
  const total=profiles.length||1;
  // forecast 7 days: assume decay based on box
  const forecast=[];
  for(let d=0; d<7; d++){
    let retained=0;
    profiles.forEach(p=>{
      const daysSince = (now() - (p.lastSeen||now()))/(24*60*60*1000);
      const halfLife = [0.5,1,3,7,21][p.box-1]||0.5;
      const prob = Math.exp(- (daysSince+d) * Math.log(2) / halfLife);
      retained+=prob;
    });
    forecast.push((retained/total)*100);
  }
  // draw line
  ctx.strokeStyle='#06b6d4'; ctx.lineWidth=2; ctx.beginPath();
  forecast.forEach((v,i)=>{
    const x=(i/(forecast.length-1))* (W-40) +20;
    const y=H-20 - (v/100)*(H-40);
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.stroke();
  // points
  forecast.forEach((v,i)=>{
    const x=(i/(forecast.length-1))* (W-40) +20;
    const y=H-20 - (v/100)*(H-40);
    ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.fillStyle='#8b5cf6'; ctx.fill();
  });
  // labels
  ctx.fillStyle='#94a3b8'; ctx.font='10px Inter';
  forecast.forEach((v,i)=>{ if(i%2===0){ const x=(i/(forecast.length-1))* (W-40) +20; ctx.fillText(`D${i}`, x-6, H-4); } });
}
function drawCalibrationChart(){
  const canvas=$('#calibration-chart'); if(!canvas) return;
  const ctx=canvas.getContext('2d');
  const dpr=window.devicePixelRatio||1;
  canvas.width=canvas.clientWidth*dpr; canvas.height=canvas.clientHeight*dpr;
  ctx.scale(dpr,dpr);
  const W=canvas.clientWidth, H=canvas.clientHeight;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--bg-secondary') || '#111';
  ctx.fillRect(0,0,W,H);
  const profiles=Object.values(state.learning).filter(p=>p.confidence && p.lastCorrect!==null);
  if(!profiles.length){ ctx.fillStyle='#64748b'; ctx.font='12px Inter'; ctx.fillText('Confidence data will appear after rated sessions', 20, H/2); return; }
  // buckets 1-5
  const buckets=[0,0,0,0,0].map(()=>({correct:0,total:0}));
  profiles.forEach(p=>{
    const idx=clamp(Math.round(p.confidence)-1,0,4);
    buckets[idx].total++; if(p.lastCorrect) buckets[idx].correct++;
  });
  // ideal diagonal
  ctx.strokeStyle='rgba(148,163,184,0.3)'; ctx.setLineDash([4,4]); ctx.beginPath(); ctx.moveTo(20,H-20); ctx.lineTo(W-20,20); ctx.stroke(); ctx.setLineDash([]);
  // actual
  ctx.strokeStyle='#10b981'; ctx.lineWidth=2; ctx.beginPath();
  buckets.forEach((b,i)=>{
    const acc=b.total ? (b.correct/b.total)*100 : 0;
    const conf=(i+1)*20;
    const x=20 + (conf/100)*(W-40);
    const y=H-20 - (acc/100)*(H-40);
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.stroke();
  buckets.forEach((b,i)=>{
    const acc=b.total ? (b.correct/b.total)*100 : 0;
    const conf=(i+1)*20;
    const x=20 + (conf/100)*(W-40);
    const y=H-20 - (acc/100)*(H-40);
    ctx.beginPath(); ctx.arc(x,y,4,0,Math.PI*2); ctx.fillStyle='#06b6d4'; ctx.fill();
  });
  ctx.fillStyle='#94a3b8'; ctx.font='10px Inter'; ctx.fillText('Confidence →', W/2-30, H-4); ctx.save(); ctx.translate(10,H/2); ctx.rotate(-Math.PI/2); ctx.fillText('Accuracy →', -30,0); ctx.restore();
}

// ─── Question Rendering ───
function renderQuestion(question, index){
  const urduClass=hasUrdu(question.prompt) ? ' urdu-text' : '';
  const profile=getProfile(question);
  const boxLabel=profile.box ? `Box ${profile.box}` : 'New';
  return `<article class="question-card" data-question-id="${esc(question.id)}" style="animation-delay:${index*0.04}s">
    <div class="question-meta"><span>Question ${index+1} • ${boxLabel} • ${profile.streak?`Streak ${profile.streak}`:'New'}</span><span>${esc(question.collectionLabel)} • ${esc(labelize(question.subject))}</span></div>
    <h3 class="${urduClass.trim()}">${esc(question.prompt)}</h3>
    <div class="options">
      ${question.options.map((opt,oi)=>`<button class="option" data-option-index="${oi}"><span class="option-letter">${String.fromCharCode(65+oi)}</span><span class="${hasUrdu(opt)?'urdu-text':''}">${esc(opt)}</span></button>`).join('')}
    </div>
    <div class="voice-actions">
      <button type="button" class="voice-button listen-button" data-voice-index="${index}">🔊 Listen</button>
      <button type="button" class="voice-button answer-voice-button" data-voice-answer-index="${index}">🎤 Voice answer</button>
      <button type="button" class="voice-button hint-button" data-hint-index="${index}">💡 Hint</button>
    </div>
    <div class="confidence-row"><span>Metacognitive confidence — how certain? (C then 1-5)</span><div>${[1,2,3,4,5].map(v=>`<button type="button" class="confidence-button" data-confidence-index="${index}" data-confidence="${v}">${v}</button>`).join('')}</div></div>
    <div class="feedback hidden"></div>
  </article>`;
}
function updateQuizProgress(){
  if(!state.session) return;
  const answered=state.session.answers.filter(a=>a!==null).length;
  const total=state.session.questions.length;
  const percent=total ? Math.round((answered/total)*100) : 0;
  const progress=$('#quiz-progress'); if(progress) progress.textContent=`${answered} / ${total}`;
  const remaining=$('#answered-count'); if(remaining) remaining.textContent=`${answered} answered • ${total-answered} remaining`;
  const fill=$('#progress-fill'); if(fill){ fill.style.width=`${percent}%`; fill.parentElement?.setAttribute('aria-valuenow', String(percent)); }
  renderSessionQueue();
  updateSessionNavigation();
  calculateAcousticLoad();
}
function renderSessionQueue(){
  const queue=$('#session-queue'); if(!queue || !state.session) return;
  queue.innerHTML=state.session.questions.map((_,i)=>`<button type="button" class="queue-dot ${state.session.answers[i]!==null?'answered':''} ${i===state.currentQuestionIndex?'current':''}" data-queue-index="${i}" aria-label="Question ${i+1}${state.session.answers[i]!==null?' answered':''}" aria-current="${i===state.currentQuestionIndex?'step':'false'}">${i+1}</button>`).join('');
}
function updateSessionNavigation(){
  if(!state.session) return;
  const idx=state.currentQuestionIndex;
  const prev=$('#prev-question'); const next=$('#next-question');
  if(prev) prev.disabled=idx<=0;
  if(next){ next.disabled=idx>=state.session.questions.length-1; next.textContent=idx>=state.session.questions.length-1?'Last question':'Next →'; }
}
function moveToQuestion(index){
  if(!state.session || state.session.finished) return;
  state.currentQuestionIndex=clamp(index,0,state.session.questions.length-1);
  renderSessionQueue(); updateSessionNavigation(); scrollToQuestion(state.currentQuestionIndex);
  playEarcon('advance');
  if(state.voiceMode) speakQuestion(state.currentQuestionIndex);
}
function chooseAnswer(card, optionIndex){
  if(!state.session || state.session.finished) return;
  const index=[...$('#question-list').children].indexOf(card);
  if(index<0) return;
  state.session.answers[index]=optionIndex;
  card.querySelectorAll('.option').forEach((opt,i)=> opt.classList.toggle('selected', i===optionIndex));
  const q=state.session.questions[index];
  const isCorrect=optionIndex===q.answerIndex;
  playEarcon(isCorrect?'correct':'incorrect');
  recordMisconception(q, optionIndex, isCorrect, state.session.confidence[index]||3);
  if(state.session.mode==='practice') revealFeedback(card,index);
  updateQuizProgress();
  if(state.voiceMode || state.noScreen){
    const nextIdx=state.session.answers.findIndex(a=>a===null);
    if(nextIdx>=0){
      state.currentQuestionIndex=nextIdx;
      setTimeout(()=>{
        playEarcon('advance');
        if(state.audioSettings.autoSpeak || state.noScreen) speakQuestion(nextIdx,false);
        if(state.noScreen) updateNoScreenStatus();
        if(!state.noScreen) scrollToQuestion(nextIdx);
      }, 700);
    }else{
      if(state.noScreen) speakText('All questions answered. Press Enter to finish and consolidate memory.');
    }
  }
}
function setConfidence(index,value,button){
  if(!state.session) return;
  state.session.confidence[index]=value;
  button.parentElement.querySelectorAll('.confidence-button').forEach(b=> b.classList.toggle('selected', b===button));
  playEarcon('select');
  if(state.noScreen) speakText(`Confidence ${value}`);
}
function revealFeedback(card,index){
  const q=state.session.questions[index];
  const sel=state.session.answers[index];
  card.querySelectorAll('.option').forEach((opt,i)=>{
    opt.classList.toggle('correct', i===q.answerIndex);
    opt.classList.toggle('incorrect', i===sel && sel!==q.answerIndex);
  });
  const fb=card.querySelector('.feedback');
  const isCorrect=sel===q.answerIndex;
  const intuition=getIntuitionAnchor(q);
  fb.innerHTML=`
    <div style="font-weight:700;font-size:13px;margin-bottom:6px;color:var(--${isCorrect?'success':'error'})">${isCorrect?'✓ Correct recall — memory trace strengthened':'✗ Correct: '+esc(q.answerText)+' — prediction error primes plasticity'}</div>
    ${q.explanation?`<div class="${hasUrdu(q.explanation)?'urdu-text':''}" style="color:var(--text-secondary);font-size:12.5px;line-height:1.5;margin-bottom:10px;">${esc(q.explanation)}</div>`:''}
    <div class="cognitive-analysis-grid">
      <div class="intuition-box"><b>🧠 Verified Intuition</b><p>${esc(intuition.intuition)}</p></div>
      <div class="trap-box"><b>🚫 Distractor Trap to Weed Out</b><p>${esc(intuition.pitfall)}</p></div>
    </div>
  `;
  fb.classList.remove('hidden');
  if(state.voiceMode || state.noScreen){
    speakText(isCorrect?'Correct.':'Incorrect. Correct answer: '+q.answerText+'.');
  }
}
function scrollToQuestion(index){
  const cards=$('#question-list')?.children;
  if(cards && cards[index]) cards[index].scrollIntoView({behavior:'smooth',block:'center'});
}

// ─── Session Management ───
async function startSession(){
  const startBtn=$('#start-button'); if(startBtn) startBtn.disabled=true;
  const filters={
    source:$('#source-filter')?.value||'all',
    collection:$('#collection-filter')?.value||'all',
    subject:$('#subject-filter')?.value||'all',
    topic:$('#topic-filter')?.value||'all',
    year:$('#year-filter')?.value||'all',
  };
  const mode=document.querySelector('input[name="mode"]:checked')?.value||'practice';
  const limitRaw=$('#limit-filter')?.value||'20';
  const limit=limitRaw==='all' ? Infinity : Number(limitRaw);
  const matchEl=$('#match-count'); if(matchEl) matchEl.textContent='Preparing session — loading question shards…';
  let allQ;
  switch(mode){
    case 'due': case 'leitner': case 'weakest': case 'misconceptions': {
      await ensureProfileShards();
      allQ = mode==='due' ? dueQuestions()
           : mode==='leitner' ? leitnerDrillQuestions()
           : mode==='weakest' ? weakestQuestions()
           : misconceptionQuestions();
      if(!allQ.length && mode==='misconceptions') allQ=weakestQuestions();
      if(!allQ.length){
        toast('No review items yet — starting a fresh practice set instead');
        const need=limit===Infinity ? 120 : limit*3;
        const builderQ=filters.source==='board' ? [] : await collectBuilderQuestions(filters, need);
        const boardNeed=filters.source==='builder' || limit!==Infinity && builderQ.length>=limit ? 0 : (limit===Infinity ? Infinity : Math.max(limit-builderQ.length, limit));
        const boardQ=filters.source==='builder' ? [] : await collectBoardQuestions(filters, boardNeed);
        allQ=[...builderQ, ...boardQ];
      }
      break;
    }
    default: {
      const need=limit===Infinity ? Infinity : limit*3;
      const builderQ=filters.source==='board' ? [] : await collectBuilderQuestions(filters, need);
      const boardNeed=filters.source==='builder' ? 0 : (limit===Infinity ? Infinity : Math.max(limit-builderQ.length, limit));
      const boardQ=filters.source==='builder' ? [] : await collectBoardQuestions(filters, boardNeed);
      allQ=[...builderQ, ...boardQ];
      break;
    }
  }
  const questions=(mode==='interleaved' ? interleaveQuestions(shuffle(allQ)) : shuffle(allQ)).slice(0,limit===Infinity ? allQ.length : limit);
  if(questions.length===0){
    toast('No questions match — broaden filters or review due items');
    if(startBtn) startBtn.disabled=false;
    return;
  }
  state.lastFilters={
    title: $('#source-filter')?.value==='all' ? 'Mixed practice • CSS/PMS' : ($('#source-filter')?.options[$('#source-filter')?.selectedIndex]?.text||'Practice'),
    questions,
  };
  state.session={ questions, answers:new Array(questions.length).fill(null), confidence:new Array(questions.length).fill(null), mode, finished:false };
  state.currentQuestionIndex=0;
  $$('.section-view').forEach(el=> el.classList.add('hidden'));
  $('#quiz-view').classList.remove('hidden');
  $('#result-view').classList.add('hidden');
  const modeLabels={ practice:'Practice • Immediate feedback', assessment:'Assessment • Delayed feedback', interleaved:'Interleaved • Transfer', due:'Due Review • Spaced', leitner:'Leitner Drill • Fragile first', weakest:'Weakest First • Repair', misconceptions:'Weed-Out Lab • Hypercorrection' };
  $('#quiz-kicker').textContent=modeLabels[mode]||'Session';
  $('#quiz-title').textContent=`${questions.length} questions • ${labelize(mode)} • Desirable difficulty`;
  const summary=$('#session-mode-summary'); if(summary) summary.textContent=`${questions.length} question${questions.length===1?'':'s'} • ${labelize(mode)}`;
  const modeBadge=$('#quiz-mode-badge'); if(modeBadge) modeBadge.textContent=labelize(mode);
  $('#question-list').innerHTML=questions.map(renderQuestion).join('');
  updateQuizProgress();
  if(startBtn) startBtn.disabled=false;
  if($('#no-screen-toggle')?.checked){
    state.noScreen=true;
    $('#no-screen-overlay').classList.remove('hidden');
    $('#no-screen-btn').classList.add('active');
    updateNoScreenStatus();
    setTimeout(()=> speakQuestion(0,false), 600);
  }else if(state.voiceMode || state.audioSettings.autoSpeak){
    speakQuestion(0,false);
  }
  // pomodoro auto start if not running
  if(!state.pomodoro.running) startPomodoro();
  window.scrollTo({top:0,behavior:'smooth'});
  calculateVisualLoad();
}
function finishSession(){
  if(!state.session || state.session.finished) return;
  state.session.finished=true;
  playEarcon('test');
  const {questions, answers, confidence} = state.session;
  const correct=questions.reduce((t,q,i)=> t+(answers[i]===q.answerIndex?1:0),0);
  const attempted=answers.filter(a=>a!==null).length;
  const percent=Math.round((correct/questions.length)*100)||0;
  const hyperCount=questions.reduce((c,q,i)=>{
    const isCorrect=answers[i]===q.answerIndex;
    const conf=confidence[i]||3;
    return c + (!isCorrect && conf>=4 ? 1 : 0);
  },0);

  questions.forEach((q,i)=>{ updateLearningProfile(q, answers[i]===q.answerIndex, confidence[i]||3); revealFeedback($('#question-list').children[i], i); });
  saveLearning();

  const history=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');
  history.unshift({ title: state.lastFilters.title, percent, correct, total: questions.length, date: new Date().toISOString(), hyper: hyperCount });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0,80)));

  $$('.section-view').forEach(el=> el.classList.add('hidden'));
  $('#result-view').classList.remove('hidden');
  if(state.noScreen){ $('#no-screen-overlay').classList.add('hidden'); state.noScreen=false; $('#no-screen-btn').classList.remove('active'); }

  const circ=2*Math.PI*52;
  const offset=circ - (percent/100)*circ;
  const scoreCircle=$('#score-circle');
  if(scoreCircle){
    scoreCircle.style.strokeDasharray=circ;
    scoreCircle.style.strokeDashoffset=circ;
    requestAnimationFrame(()=>{ scoreCircle.style.transition='stroke-dashoffset 1.2s ease-out'; scoreCircle.style.strokeDashoffset=offset; });
  }
  $('#result-score').textContent=`${percent}%`;
  $('#result-correct').textContent=correct;
  $('#result-attempted').textContent=attempted;
  $('#result-total').textContent=questions.length;
  const hyperEl=$('#result-hyper'); if(hyperEl) hyperEl.textContent=hyperCount;

  const messages=[
    {min:90,title:'Outstanding — Crystallized!',sub:'Near-perfect recall. Memory traces hardened into intuition. Sleep tonight will consolidate.'},
    {min:75,title:'Strong session — Consolidating',sub:'Solid retrieval. Effortful recall builds durable schema. Review weakest in 24h.'},
    {min:50,title:'Useful struggle — High plasticity',sub:'Desirable difficulty! Errors prime anterior cingulate for hypercorrection. Revisit misconceptions.'},
    {min:0,title:'Misconceptions diagnosed — Max learning window',sub:'High prediction error = max neuroplastic update. Weed-Out Lab will target these traps.'},
  ];
  const msg=messages.find(m=> percent>=m.min);
  $('#result-title').textContent=msg.title;
  $('#result-subtitle').textContent=`${correct} correct from ${attempted} attempted. ${msg.sub}`;
  const neuroTips=[
    'Sleep-dependent consolidation: review Box 1 items before sleep. Hippocampal replay strengthens traces overnight (Diekelmann & Born 2010).',
    'Hypercorrection effect: high-confidence errors are remembered better after correction. Your brain tags them as important.',
    'Interleaving: mixing subjects today improves transfer to CSS essay & interview. Discrimination > blocking.',
    'Testing effect: retrieval today is 50% more effective than re-reading. You just did the harder, better thing.',
    '20-20-20 rule: every 20 min, look 20 ft away for 20 sec. Or use eyes-free mode for zero eye strain.',
  ];
  const tipEl=$('#result-neuro-tip'); if(tipEl) tipEl.textContent='🧬 Neuroscience tip: '+ neuroTips[Math.floor(Math.random()*neuroTips.length)];

  $('#result-review').innerHTML=questions.map((q,i)=>{
    const isCorrect=answers[i]===q.answerIndex;
    const intuition=getIntuitionAnchor(q);
    return `<div class="review-item ${isCorrect?'correct-review':''}"><strong class="${hasUrdu(q.prompt)?'urdu-text':''}">${isCorrect?'✓':'✗'} ${esc(q.prompt)}</strong><span class="${hasUrdu(q.answerText)?'urdu-text':''}">${answers[i]===null?'Not attempted':`Your: ${esc(q.options[answers[i]])}`} • Correct: ${esc(q.answerText)} • Conf: ${confidence[i]||3}/5 • Box ${getProfile(q).box}</span><div style="margin-top:6px;font-size:11px;color:var(--text-muted);"><b>Intuition:</b> ${esc(intuition.intuition)}</div></div>`;
  }).join('');

  renderRecent(); renderLearningDashboard(); renderHistory(); renderMisconceptions();
  if(state.voiceMode || state.noScreen) speakText(`Session complete. ${percent} percent. ${correct} out of ${questions.length} correct. ${hyperCount} hypercorrection opportunities.`);
  window.scrollTo({top:0,behavior:'smooth'});
}
function showSetup(){
  $$('.section-view').forEach(el=> el.classList.add('hidden'));
  $('#study-section').classList.remove('hidden');
  $$('.nav-link').forEach(l=> l.classList.toggle('active', l.dataset.nav==='study'));
  state.currentNav='study';
  window.scrollTo({top:0,behavior:'smooth'});
}
function toggleVoiceMode(){
  state.voiceMode=!state.voiceMode;
  const btn=$('#voice-toggle');
  if(btn){
    btn.setAttribute('aria-pressed', String(state.voiceMode));
    btn.innerHTML=`🔊 Voice: ${state.voiceMode?'On':'Off'}`;
  }
  toast(`Voice mode: ${state.voiceMode?'on':'off'}`);
  if(state.voiceMode && state.session){
    const nextIdx=state.session.answers.findIndex(a=>a===null);
    if(nextIdx>=0) speakQuestion(nextIdx,true);
  }
  if(!state.voiceMode) stopSpeech();
}
function toggleFocusMode(){
  state.visualSettings.focusMode = !state.visualSettings.focusMode;
  document.body.classList.toggle('focus-mode', state.visualSettings.focusMode);
  saveVisualSettings();
  const btn=$('#focus-toggle');
  if(btn) btn.textContent = state.visualSettings.focusMode ? '◑ Exit Focus' : '◐ Focus Mode';
  toast(state.visualSettings.focusMode ? 'Focus mode — sentence highlight, dim rest' : 'Focus mode off');
}

// ─── Misconceptions Rendering ───
function renderMisconceptions(){
  loadMisconceptions();
  const list=Object.values(state.misconceptions);
  const active=list.filter(m=>!m.hardened);
  const hypers=list.filter(m=>m.isHypercorrection && !m.hardened);
  const hardened=list.filter(m=>m.hardened);
  const activeEl=$('#stat-active-misconceptions'); if(activeEl) activeEl.textContent=active.length;
  const hyperEl=$('#stat-hypercorrections'); if(hyperEl) hyperEl.textContent=hypers.length;
  const hardEl=$('#stat-hardened'); if(hardEl) hardEl.textContent=hardened.length;
  const repairRateEl=$('#stat-repair-rate'); if(repairRateEl){
    const rate = list.length ? Math.round((hardened.length/list.length)*100) : 0;
    repairRateEl.textContent = list.length ? `${rate}%` : '—';
  }
  const drillBtn=$('#drill-misconceptions-btn'); if(drillBtn) drillBtn.disabled=active.length===0;
  const badge=$('#misconception-badge'); if(badge) badge.textContent=active.length;
  const container=$('#misconception-list'); if(!container) return;
  const filter=state.misconceptionFilter||'all';
  let filtered=list;
  if(filter==='hypercorrection') filtered=list.filter(m=>m.isHypercorrection);
  else if(filter==='unresolved') filtered=active;
  else if(filter==='hardened') filtered=hardened;
  if(filtered.length===0){
    container.innerHTML=`<p class="empty-state">${list.length===0 ? 'No misconceptions yet. Take a retrieval session — high-confidence errors will be flagged as hypercorrection alerts (max learning window).' : 'No items in this filter.'}</p>`;
    return;
  }
  container.innerHTML=filtered.map(m=>{
    const isHyper=m.isHypercorrection;
    const isHard=m.hardened;
    const tagClass=isHard?'tag-hardened':isHyper?'tag-hyper':'tag-unresolved';
    const tagLabel=isHard?'✓ Resolved':isHyper?'⚡ Hypercorrection Alert':'⚠️ Needs Hardening';
    const cardClass=isHard?'is-hardened':isHyper?'is-hypercorrection':'';
    const intuition=getIntuitionAnchor(m);
    return `<div class="misconception-card ${cardClass}" data-qid="${esc(m.questionId)}">
      <div class="misconception-meta"><span class="misconception-tag ${tagClass}">${tagLabel}</span><span style="font-size:11px;color:var(--text-muted);">${esc(m.collection||'')} • ${esc(labelize(m.subject||''))} • Failed ${m.timesFailed||1}×</span></div>
      <div class="misconception-question ${hasUrdu(m.prompt)?'urdu-text':''}">${esc(m.prompt)}</div>
      <div class="cognitive-analysis-grid">
        <div class="trap-box"><b>🚫 Diagnosed Trap</b><p>Selected: <em class="${hasUrdu(m.trappedAnswer)?'urdu-text':''}">${esc(m.trappedAnswer)}</em></p><p style="margin-top:4px;">${esc(intuition.pitfall)}</p></div>
        <div class="intuition-box"><b>🧠 Verified Intuition</b><p>Correct: <strong class="${hasUrdu(m.correctAnswer)?'urdu-text':''}">${esc(m.correctAnswer)}</strong></p><p class="${hasUrdu(intuition.intuition)?'urdu-text':''}" style="margin-top:4px;">${esc(intuition.intuition)}</p></div>
      </div>
      <div class="misconception-actions"><button class="btn btn-outline btn-sm drill-single-btn" data-qid="${esc(m.questionId)}" type="button">Rehearse This Concept</button></div>
    </div>`;
  }).join('');
}

// ─── Knowledge Graph ───
function buildGraphData(){
  const concepts=new Map();
  // Full landscape from the bank manifest (no need to load every shard).
  const m=state.builderManifest;
  (m?.subjects||[]).forEach(s=>{
    concepts.set(s.subj,{id:s.subj,label:labelize(s.subj),type:'subject',total:s.total,health:0,children:new Set()});
    // Top topics per subject keep the force simulation performant.
    const topics=Object.entries(s.topicCounts||{}).sort((a,b)=>b[1]-a[1]).slice(0,24);
    topics.forEach(([topic,count])=>{
      const topicKey=`${s.subj}:${topic}`;
      concepts.set(topicKey,{id:topicKey,label:labelize(topic),type:'topic',parent:s.subj,total:count,health:0,children:new Set()});
      concepts.get(s.subj).children.add(topicKey);
    });
  });
  // Health from what the learner has actually loaded & answered.
  state.available.forEach(q=>{
    const entry=concepts.get(q.subject);
    if(entry) entry.health+= getProfile(q).lastCorrect===true ? 1 : getProfile(q).lastCorrect===false ? -1 : 0;
    const topicEntry=q.topic ? concepts.get(`${q.subject}:${q.topic}`) : null;
    if(topicEntry) topicEntry.health+= getProfile(q).lastCorrect===true ? 1 : getProfile(q).lastCorrect===false ? -1 : 0;
  });
  state.boardCatalog.forEach(s=>{
    const key=`board:${s.board}:${s.subject}`;
    if(!concepts.has(key)) concepts.set(key,{id:key,label:labelize(s.subject),type:'subject',total:s.totalQuestions,health:0,children:new Set()});
  });
  const nodes=[]; const edges=[];
  const conceptList=[...concepts.values()];
  conceptList.forEach(c=>{
    const r=clamp(Math.sqrt(c.total)*4+14,16,56);
    let color;
    const ratio=c.total>0 ? c.health/c.total : 0;
    if(c.health===0 && !Object.values(state.learning).some(p=>p.question && concepts.has(c.id))){
      color={r:100,g:116,b:139,a:0.45};
    }else if(ratio>0.25) color={r:16,g:185,b:129,a:0.9};
    else if(ratio>-0.2) color={r:6,g:182,b:212,a:0.85};
    else color={r:239,g:68,b:68,a:0.9};
    nodes.push({...c,r,color,ratio,x:150+Math.random()*800,y:100+Math.random()*400,vx:0,vy:0});
    if(c.parent) edges.push({source:c.parent,target:c.id});
  });
  state.graphNodes=nodes; state.graphEdges=edges;
}
function renderKnowledgeGraph(){
  buildGraphData();
  const canvas=$('#knowledge-graph'); if(!canvas) return;
  const ctx=canvas.getContext('2d');
  const dpr=window.devicePixelRatio||1;
  canvas.width=canvas.clientWidth*dpr; canvas.height=canvas.clientHeight*dpr;
  ctx.scale(dpr,dpr);
  const W=canvas.clientWidth, H=canvas.clientHeight;
  const nodes=state.graphNodes; const edges=state.graphEdges;
  const filter=$('#graph-filter')?.value||'all';
  const query=(state.graphSearch||'').toLowerCase().trim();
  const nodeMap=new Map(nodes.map(n=>[n.id,n]));

  function simulate(){
    for(let i=0;i<nodes.length;i++){
      for(let j=i+1;j<nodes.length;j++){
        const dx=nodes[j].x-nodes[i].x; const dy=nodes[j].y-nodes[i].y;
        const dist=Math.max(Math.sqrt(dx*dx+dy*dy),1);
        const force=900/(dist*dist);
        const fx=(dx/dist)*force; const fy=(dy/dist)*force;
        nodes[i].vx-=fx; nodes[i].vy-=fy; nodes[j].vx+=fx; nodes[j].vy+=fy;
      }
    }
    edges.forEach(e=>{
      const s=nodeMap.get(e.source); const t=nodeMap.get(e.target);
      if(!s||!t) return;
      const dx=t.x-s.x; const dy=t.y-s.y;
      const dist=Math.max(Math.sqrt(dx*dx+dy*dy),1);
      const force=(dist-130)*0.02;
      const fx=(dx/dist)*force; const fy=(dy/dist)*force;
      s.vx+=fx; s.vy+=fy; t.vx-=fx; t.vy-=fy;
    });
    nodes.forEach(n=>{
      n.vx+=(W/2-n.x)*0.0012; n.vy+=(H/2-n.y)*0.0012;
      n.vx*=0.85; n.vy*=0.85;
      n.x+=n.vx; n.y+=n.vy;
      n.x=clamp(n.x,n.r+10,W-n.r-10); n.y=clamp(n.y,n.r+10,H-n.r-10);
    });
  }
  function draw(){
    ctx.clearRect(0,0,W,H);
    ctx.save();
    const scale=state.graphScale||1;
    ctx.translate(W/2,H/2); ctx.scale(scale,scale); ctx.translate(-W/2+state.graphOffset.x,-H/2+state.graphOffset.y);
    ctx.lineWidth=1.2;
    edges.forEach(e=>{
      const s=nodeMap.get(e.source); const t=nodeMap.get(e.target);
      if(!s||!t) return;
      ctx.beginPath(); ctx.moveTo(s.x,s.y); ctx.lineTo(t.x,t.y);
      ctx.strokeStyle='rgba(148,163,184,0.18)'; ctx.stroke();
    });
    nodes.forEach(n=>{
      if(filter==='weak' && n.health>=0) return;
      if(filter==='strong' && n.health<=0) return;
      if(filter==='unseen' && n.color.a>0.5) return;
      const isMatch=!query || n.label.toLowerCase().includes(query);
      const opMult=isMatch?1:0.2;
      ctx.beginPath(); ctx.arc(n.x,n.y,n.r+(isMatch&&query?8:4),0,Math.PI*2);
      ctx.fillStyle=`rgba(${n.color.r},${n.color.g},${n.color.b},${0.18*opMult})`; ctx.fill();
      ctx.beginPath(); ctx.arc(n.x,n.y,n.r,0,Math.PI*2);
      ctx.fillStyle=`rgba(${n.color.r},${n.color.g},${n.color.b},${n.color.a*opMult})`; ctx.fill();
      ctx.strokeStyle=`rgba(${n.color.r},${n.color.g},${n.color.b},${0.6*opMult})`;
      ctx.lineWidth=isMatch&&query?2.5:1.5; ctx.stroke();
      ctx.fillStyle=isMatch?'#fff':'rgba(255,255,255,0.3)';
      ctx.font=`${n.r>24?11:9}px Inter, sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
      const label=n.label.length>16 ? n.label.substring(0,14)+'…' : n.label;
      ctx.fillText(label,n.x,n.y);
      if(n.r>18){ ctx.font='8px Inter, sans-serif'; ctx.fillStyle='rgba(255,255,255,0.6)'; ctx.fillText(`${n.total}q`,n.x,n.y+n.r+10); }
    });
    ctx.restore();
  }
  let frame=0;
  function tick(){ simulate(); draw(); frame++; if(frame<200) requestAnimationFrame(tick); }
  tick();
  canvas.onclick=(e)=>{
    const rect=canvas.getBoundingClientRect();
    const scale=state.graphScale||1;
    const clickX=(e.clientX-rect.left-W/2)/scale + W/2 - state.graphOffset.x;
    const clickY=(e.clientY-rect.top-H/2)/scale + H/2 - state.graphOffset.y;
    for(const n of nodes){
      const dx=n.x-clickX; const dy=n.y-clickY;
      if(dx*dx+dy*dy < n.r*n.r){
        state.graphSelectedNode=n;
        playEarcon('select');
        const insp=$('#graph-inspector');
        if(insp){
          insp.classList.remove('hidden');
          $('#inspector-title').textContent=n.label;
          $('#inspector-type').textContent=n.type==='subject'?'Subject Cluster':'Topic Node';
          $('#inspector-stats').textContent=`${n.total} questions • ${n.children? n.children.size : 0} subtopics`;
          const pct=Math.max(0,Math.min(100,Math.round(((n.ratio||0)+1)*50)));
          $('#inspector-pct').textContent=`${pct}% Retention Strength`;
          const fill=$('#inspector-fill'); if(fill) fill.style.width=`${pct}%`;
        }
        break;
      }
    }
  };
}

// ─── Brain Canvas Animation ───
function animateBrainCanvas(){
  const canvas=$('#brain-canvas'); if(!canvas) return;
  const ctx=canvas.getContext('2d');
  const dpr=window.devicePixelRatio||1;
  const size=400;
  canvas.width=size*dpr; canvas.height=size*dpr;
  ctx.scale(dpr,dpr);
  const W=size,H=size,cx=W/2,cy=H/2;
  const neurons=Array.from({length:26},()=>({x:cx+(Math.random()-0.5)*280,y:cy+(Math.random()-0.5)*280,r:3+Math.random()*5,pulse:Math.random()*Math.PI*2,speed:0.02+Math.random()*0.03}));
  const connections=[];
  neurons.forEach((n,i)=>{
    const closest=neurons.map((m,j)=>({j,d:Math.hypot(m.x-n.x,m.y-n.y)})).filter(c=>c.j!==i).sort((a,b)=>a.d-b.d).slice(0,2+Math.floor(Math.random()*2));
    closest.forEach(c=> connections.push({from:i,to:c.j,progress:Math.random()}));
  });
  function draw(time){
    if(state.visualSettings.reduceMotion) return;
    ctx.clearRect(0,0,W,H);
    const t=time*0.001;
    connections.forEach(c=>{
      const a=neurons[c.from], b=neurons[c.to];
      ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y);
      const alpha=0.08+0.06*Math.sin(t*2+c.progress*Math.PI*4);
      ctx.strokeStyle=`rgba(6,182,212,${alpha})`; ctx.lineWidth=0.8; ctx.stroke();
      c.progress=(c.progress+0.003)%1;
      const px=a.x+(b.x-a.x)*c.progress; const py=a.y+(b.y-a.y)*c.progress;
      ctx.beginPath(); ctx.arc(px,py,1.5,0,Math.PI*2); ctx.fillStyle=`rgba(6,182,212,${0.3+0.3*Math.sin(t*3+c.progress*10)})`; ctx.fill();
    });
    neurons.forEach(n=>{
      n.pulse+=n.speed;
      const glow=0.3+0.3*Math.sin(n.pulse);
      const grad=ctx.createRadialGradient(n.x,n.y,0,n.x,n.y,n.r*3);
      grad.addColorStop(0,`rgba(6,182,212,${glow*0.3})`); grad.addColorStop(1,'rgba(6,182,212,0)');
      ctx.beginPath(); ctx.arc(n.x,n.y,n.r*3,0,Math.PI*2); ctx.fillStyle=grad; ctx.fill();
      ctx.beginPath(); ctx.arc(n.x,n.y,n.r,0,Math.PI*2); ctx.fillStyle=`rgba(6,182,212,${0.5+glow*0.5})`; ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
}

// ─── Pomodoro ───
function startPomodoro(){
  if(state.pomodoro.running) return;
  state.pomodoro.running=true;
  state.pomodoro.mode='focus';
  state.pomodoro.timeLeft=25*60;
  state.pomodoro.label='Focus';
  updatePomodoroUI();
  state.pomodoro.interval=setInterval(()=>{
    state.pomodoro.timeLeft--;
    if(state.pomodoro.timeLeft<=0){
      if(state.pomodoro.mode==='focus'){
        state.pomodoro.mode='break';
        state.pomodoro.timeLeft=5*60;
        state.pomodoro.label='Break • Eye rest 20-20-20';
        playEarcon('correct');
        toast('Focus complete! 5 min break — look 20 ft away for 20 sec.');
        if(state.noScreen) speakText('Focus complete. Five minute break. Rest your eyes.');
      }else{
        state.pomodoro.mode='focus';
        state.pomodoro.timeLeft=25*60;
        state.pomodoro.label='Focus';
        playEarcon('advance');
        toast('Break over — back to retrieval.');
      }
    }
    updatePomodoroUI();
  },1000);
}
function resetPomodoro(){
  clearInterval(state.pomodoro.interval);
  state.pomodoro.running=false;
  state.pomodoro.timeLeft=25*60;
  state.pomodoro.mode='focus';
  state.pomodoro.label='Ready';
  updatePomodoroUI();
}
function updatePomodoroUI(){
  const m=Math.floor(state.pomodoro.timeLeft/60).toString().padStart(2,'0');
  const s=(state.pomodoro.timeLeft%60).toString().padStart(2,'0');
  const timeEl=$('#pomodoro-time'); if(timeEl) timeEl.textContent=`${m}:${s}`;
  const labelEl=$('#pomodoro-label'); if(labelEl) labelEl.textContent=state.pomodoro.label;
  const focusInd=$('#quiz-focus-indicator'); if(focusInd) focusInd.textContent=`${state.pomodoro.label}: ${m}:${s}`;
}

// ─── Command Palette ───
const commands=[
  {id:'dashboard',label:'Go to Dashboard',desc:'G D',action:()=>navigateTo('dashboard')},
  {id:'study',label:'Go to Study Setup',desc:'G S',action:()=>navigateTo('study')},
  {id:'weed',label:'Go to Weed-Out Lab',desc:'G W',action:()=>navigateTo('misconceptions')},
  {id:'graph',label:'Go to Knowledge Graph',desc:'G K',action:()=>navigateTo('knowledge')},
  {id:'history',label:'Go to Analytics',desc:'G H',action:()=>navigateTo('history')},
  {id:'due',label:'Start Due Review',desc:'Spaced repetition',action:()=>{ navigateTo('study'); const r=document.querySelector('input[name="mode"][value="due"]'); if(r) r.checked=true; startSession(); }},
  {id:'leitner',label:'Start Leitner Drill',desc:'Box 1 & 2',action:()=>{ navigateTo('study'); const r=document.querySelector('input[name="mode"][value="leitner"]'); if(r) r.checked=true; startSession(); }},
  {id:'interleaved',label:'Start Interleaved Session',desc:'Mix subjects',action:()=>{ navigateTo('study'); const r=document.querySelector('input[name="mode"][value="interleaved"]'); if(r) r.checked=true; startSession(); }},
  {id:'misconceptions',label:'Drill Misconceptions',desc:'Weed-Out',action:()=>{ navigateTo('study'); const r=document.querySelector('input[name="mode"][value="misconceptions"]'); if(r) r.checked=true; startSession(); }},
  {id:'no-screen',label:'Toggle No-Screen Eyes-Free',desc:'Ctrl+Shift+N',action:()=>toggleNoScreen()},
  {id:'theme',label:'Toggle Theme',desc:'T',action:()=>toggleTheme()},
  {id:'settings',label:'Open Experience Settings',desc:',',action:()=>openSettings()},
  {id:'voice',label:'Open Voice Engine',desc:'Shift+V',action:()=>openVoiceModal()},
  {id:'shortcuts',label:'Show Shortcuts',desc:'?',action:()=>openShortcuts()},
  {id:'focus',label:'Toggle Focus Mode',desc:'Zen',action:()=>toggleFocusMode()},
  {id:'pomodoro',label:'Start Pomodoro Focus',desc:'25m',action:()=>startPomodoro()},
];
function openCommandPalette(){
  const pal=$('#cmd-palette'); if(!pal) return;
  pal.classList.remove('hidden');
  setOverlayState(true);
  const input=$('#cmd-input'); if(input){ input.value=''; input.focus(); renderCommandList(''); }
  }
  function closeCommandPalette(){ $('#cmd-palette')?.classList.add('hidden'); if(!document.querySelector('.modal-backdrop:not(.hidden), .drawer-backdrop:not(.hidden)')) setOverlayState(false); }
function renderCommandList(q){
  const list=$('#cmd-list'); if(!list) return;
  const query=q.toLowerCase();
  const filtered=query ? commands.filter(c=> c.label.toLowerCase().includes(query) || c.desc.toLowerCase().includes(query) || c.id.includes(query)) : commands;
  list.innerHTML=filtered.map((c,i)=>`<div class="palette-item ${i===0?'active':''}" data-cmd="${c.id}"><b>${esc(c.label)}</b><small>${esc(c.desc)}</small></div>`).join('') || '<div class="empty-state">No commands found</div>';
  list.querySelectorAll('.palette-item').forEach(el=>{
    el.addEventListener('click',()=>{
      const cmd=commands.find(x=>x.id===el.dataset.cmd);
      if(cmd){ closeCommandPalette(); cmd.action(); }
    });
  });
}

// ─── Settings Drawer ───
function openSettings(){
  $('#settings-drawer')?.classList.remove('hidden');
  setOverlayState(true);
  calculateVisualLoad(); calculateAcousticLoad();
  $('#set-theme')?.focus();
  }
  function closeSettings(){ $('#settings-drawer')?.classList.add('hidden'); saveVisualSettings(); saveAudioSettings(); if(!document.querySelector('.modal-backdrop:not(.hidden), .drawer-backdrop:not(.hidden)')) setOverlayState(false); }

// ─── Shortcuts Modal ───
function openShortcuts(){ $('#shortcuts-modal')?.classList.remove('hidden'); setOverlayState(true); $('#shortcuts-close')?.focus(); }
  function closeShortcuts(){ $('#shortcuts-modal')?.classList.add('hidden'); if(!document.querySelector('.modal-backdrop:not(.hidden), .drawer-backdrop:not(.hidden)')) setOverlayState(false); }

// ─── Navigation ───
function navigateTo(section){
  state.currentNav=section;
  $$('.section-view').forEach(el=> el.classList.add('hidden'));
  const target=$(`#${section}-section`);
  if(target) target.classList.remove('hidden');
  $$('.nav-link, .mobile-nav-link').forEach(link=> link.classList.toggle('active', link.dataset.nav===section));
  if(section==='knowledge') renderKnowledgeGraph();
  if(section==='history') renderHistory();
  if(section==='misconceptions') renderMisconceptions();
  window.scrollTo({top:0,behavior:'smooth'});
  calculateVisualLoad();
}

// ─── Keyboard Handler ───
document.addEventListener('keydown',(event)=>{
  const tag=document.activeElement?.tagName;
  const isInput=['INPUT','SELECT','TEXTAREA'].includes(tag);

  // Command palette
  if((event.ctrlKey||event.metaKey) && event.key.toLowerCase()==='k'){
    event.preventDefault(); openCommandPalette(); return;
  }
  if(event.key===',' && !isInput && !event.ctrlKey && !event.metaKey){
    event.preventDefault(); openSettings(); return;
  }
  if(event.key==='?' && !isInput){
    event.preventDefault(); openShortcuts(); return;
  }
  // Global shortcuts
  if(!isInput){
    if((event.key==='t'||event.key==='T') && !event.ctrlKey && !event.metaKey){ event.preventDefault(); toggleTheme(); return; }
    if((event.key==='v'||event.key==='V') && event.shiftKey){ event.preventDefault(); openVoiceModal(); return; }
    if((event.ctrlKey&&event.shiftKey&&(event.key==='n'||event.key==='N'))){ event.preventDefault(); toggleNoScreen(); return; }
    // G then ? navigation (two-key)
    if(event.key.toLowerCase()==='g' && !state._gMode){
      state._gMode=true; setTimeout(()=> state._gMode=false, 1200); return;
    }
    if(state._gMode){
      const k=event.key.toLowerCase();
      const map={d:'dashboard',s:'study',w:'misconceptions',k:'knowledge',h:'history'};
      if(map[k]){ event.preventDefault(); state._gMode=false; navigateTo(map[k]); return; }
    }
  }

  // Command palette navigation
  const paletteVisible = !$('#cmd-palette')?.classList.contains('hidden');
  if(paletteVisible){
    if(event.key==='Escape'){ closeCommandPalette(); return; }
    if(event.key==='ArrowDown' || event.key==='ArrowUp'){
      event.preventDefault();
      const items=[...$$('#cmd-list .palette-item')];
      const active=items.findIndex(i=>i.classList.contains('active'));
      if(active>=0) items[active].classList.remove('active');
      let next=0;
      if(event.key==='ArrowDown') next=(active+1)%items.length;
      else next=(active-1+items.length)%items.length;
      if(items[next]) items[next].classList.add('active');
      return;
    }
    if(event.key==='Enter'){
      event.preventDefault();
      const active=$('#cmd-list .palette-item.active');
      if(active){ const cmd=commands.find(x=>x.id===active.dataset.cmd); if(cmd){ closeCommandPalette(); cmd.action(); } }
      return;
    }
  }

  // Eyes-Free mode
  if(state.noScreen && state.session && !state.session.finished){
    if(isInput && event.key!=='Escape') return;
    event.preventDefault();
    const idx=state.currentQuestionIndex;
    const cards=$('#question-list')?.children;
    const totalQ=state.session.questions.length;

    if(state.waitingConfidence && /^[1-5]$/.test(event.key)){
      state.session.confidence[idx]=Number(event.key);
      state.waitingConfidence=false;
      playEarcon('select');
      speakText(`Confidence ${event.key}`);
      return;
    }
    if(/^[1-4]$/.test(event.key)){
      if(cards && cards[idx]) chooseAnswer(cards[idx], Number(event.key)-1);
      return;
    }
    const lm=event.key.toLowerCase();
    if(['a','b','c','d'].includes(lm) && !event.ctrlKey && !event.altKey){
      const optIdx=lm.charCodeAt(0)-97;
      if(cards && cards[idx] && optIdx<state.session.questions[idx].options.length){ chooseAnswer(cards[idx],optIdx); return; }
    }
    switch(lm){
      case 'n': case 'arrowright': case 'j':
        state.currentQuestionIndex=Math.min(idx+1,totalQ-1); updateNoScreenStatus(); playEarcon('advance'); speakQuestion(state.currentQuestionIndex,false); return;
      case 'p': case 'arrowleft': case 'k':
        state.currentQuestionIndex=Math.max(idx-1,0); updateNoScreenStatus(); playEarcon('advance'); speakQuestion(state.currentQuestionIndex,false); return;
      case 'r': playEarcon('select'); speakQuestion(idx,false); return;
      case 'q': playEarcon('select'); speakQuestionPromptOnly(idx); return;
      case 'o': playEarcon('select'); speakOptionsOnly(idx); return;
      case 'e': case 'x': playEarcon('select'); speakExplanation(idx); return;
      case 'w': playEarcon('select'); speakMisconceptionWeedOut(idx); return;
      case 'h': playEarcon('select'); speakHint(idx); return;
      case ' ': 
        if('speechSynthesis' in window){
          if(window.speechSynthesis.paused) window.speechSynthesis.resume();
          else if(window.speechSynthesis.speaking) window.speechSynthesis.pause();
          else speakQuestion(idx,false);
        }
        return;
      case 's':
        state.currentQuestionIndex=Math.min(idx+1,totalQ-1); updateNoScreenStatus(); playEarcon('advance'); speakText('Skipped.'); setTimeout(()=> speakQuestion(state.currentQuestionIndex,false),500); return;
      case 'c': state.waitingConfidence=true; speakText('Confidence: 1 low to 5 absolute.'); return;
      case 'enter': finishSession(); return;
      case 'escape': toggleNoScreen(); return;
      case 'b': if(event.shiftKey) toggleBlackoutMode(); else { if(cards && cards[idx]) chooseAnswer(cards[idx],1); } return;
    }
    if(event.key==='F9' || (lm==='b' && event.shiftKey)){ toggleBlackoutMode(); return; }
    return;
  }

  // Visual quiz
  if(state.session && !state.session.finished && !$('#quiz-view')?.classList.contains('hidden')){
    if(isInput) return;
    const currentIdx=state.session.answers.findIndex(a=>a===null);
    const activeIdx=currentIdx>=0 ? currentIdx : state.currentQuestionIndex;
    const cards=$('#question-list')?.children;

    if(state.waitingConfidence && /^[1-5]$/.test(event.key)){
      event.preventDefault();
      state.session.confidence[activeIdx]=Number(event.key);
      state.waitingConfidence=false;
      const confBtns=cards[activeIdx]?.querySelectorAll('.confidence-button');
      if(confBtns) confBtns.forEach(b=> b.classList.toggle('selected', Number(b.dataset.confidence)===Number(event.key)));
      playEarcon('select'); toast(`Confidence: ${event.key}/5`);
      return;
    }
    if(/^[1-4]$/.test(event.key) && activeIdx>=0 && cards && cards[activeIdx]){
      event.preventDefault(); chooseAnswer(cards[activeIdx], Number(event.key)-1); return;
    }
    const kl=event.key.toLowerCase();
    if(['a','b','c','d'].includes(kl) && !event.ctrlKey && !event.altKey){
      const optIdx=kl.charCodeAt(0)-97;
      if(activeIdx>=0 && cards && cards[activeIdx] && optIdx<state.session.questions[activeIdx].options.length){
        event.preventDefault(); chooseAnswer(cards[activeIdx],optIdx); return;
      }
    }
    switch(kl){
      case 'v': event.preventDefault(); toggleVoiceMode(); return;
      case ' ': event.preventDefault(); speakQuestion(activeIdx, state.voiceMode); return;
      case 'n': case 'arrowright': case 'j':
        event.preventDefault();
        if(state.currentQuestionIndex < state.session.questions.length-1){ moveToQuestion(state.currentQuestionIndex+1); }
        return;
      case 'p': case 'arrowleft': case 'k':
        event.preventDefault();
        if(state.currentQuestionIndex>0){ state.currentQuestionIndex-=1; scrollToQuestion(state.currentQuestionIndex); playEarcon('advance'); if(state.voiceMode) speakQuestion(state.currentQuestionIndex); }
        return;
      case 'r': event.preventDefault(); speakQuestion(state.currentQuestionIndex, state.voiceMode); return;
      case 'e': case 'x': event.preventDefault(); speakExplanation(state.currentQuestionIndex); return;
      case 'w': event.preventDefault(); speakMisconceptionWeedOut(state.currentQuestionIndex); return;
      case 'h': event.preventDefault(); speakHint(state.currentQuestionIndex); return;
      case 's':
        event.preventDefault();
        if(state.currentQuestionIndex < state.session.questions.length-1){ state.currentQuestionIndex+=1; scrollToQuestion(state.currentQuestionIndex); toast('Skipped'); }
        return;
      case 'c': event.preventDefault(); state.waitingConfidence=true; toast('Set confidence 1–5'); return;
      case 'enter': event.preventDefault(); finishSession(); return;
      case 'escape': event.preventDefault(); if(state.recognition) state.recognition.abort(); showSetup(); return;
      case 'f': event.preventDefault(); toggleFocusMode(); return;
    }
  }
});

// ─── Event Listeners ───
function setupEventListeners(){
  // Nav
  $$('.nav-link, .mobile-nav-link').forEach(link=>{
    link.addEventListener('click',(e)=>{ e.preventDefault(); navigateTo(link.dataset.nav); });
  });
  $('.brand')?.addEventListener('click',(e)=>{ e.preventDefault(); navigateTo('dashboard'); });

  // Topbar
  $('#theme-toggle')?.addEventListener('click', toggleTheme);
  $('#cmd-palette-btn')?.addEventListener('click', openCommandPalette);
  $('#settings-btn')?.addEventListener('click', openSettings);
  $('#open-experience-settings')?.addEventListener('click', openSettings);
  $('#voice-modal-btn')?.addEventListener('click', openVoiceModal);
  $('#ns-voice-quick')?.addEventListener('click', openVoiceModal);
  $('#ns-settings-quick')?.addEventListener('click', openSettings);
  $('#shortcuts-btn')?.addEventListener('click', openShortcuts);
  $('#no-screen-btn')?.addEventListener('click', toggleNoScreen);
  $('#ns-blackout-toggle')?.addEventListener('click', toggleBlackoutMode);

  // Voice modal
  $('#voice-modal-close')?.addEventListener('click', closeVoiceModal);
  $('#voice-modal-save')?.addEventListener('click', closeVoiceModal);
  $('#voice-modal')?.addEventListener('click',(e)=>{ if(e.target.id==='voice-modal') closeVoiceModal(); });
  $('#modal-voice-test')?.addEventListener('click', testVoiceAudio);
  $('#modal-voice-select')?.addEventListener('change',(e)=>{ state.audioSettings.voiceId=e.target.value; const sel=$('#voice-select'); if(sel) sel.value=e.target.value; saveAudioSettings(); });
  $('#voice-select')?.addEventListener('change',(e)=>{ state.audioSettings.voiceId=e.target.value; const ms=$('#modal-voice-select'); if(ms) ms.value=e.target.value; saveAudioSettings(); });
  $('#modal-speech-speed')?.addEventListener('input',(e)=>{ state.audioSettings.rate=Number(e.target.value); $('#modal-speed-val').textContent=`${state.audioSettings.rate.toFixed(2)}×`; const si=$('#speech-speed'); if(si) si.value=state.audioSettings.rate; const sv=$('#speech-speed-value'); if(sv) sv.textContent=`${state.audioSettings.rate.toFixed(2)}×`; const ssr=$('#set-speech-rate'); if(ssr) ssr.value=state.audioSettings.rate; const ssv=$('#set-speech-rate-val'); if(ssv) ssv.textContent=`${state.audioSettings.rate.toFixed(2)}× ~${Math.round(state.audioSettings.rate*150)} WPM`; saveAudioSettings(); });
  $('#speech-speed')?.addEventListener('input',(e)=>{ state.audioSettings.rate=Number(e.target.value); $('#speech-speed-value').textContent=`${state.audioSettings.rate.toFixed(2)}×`; const ms=$('#modal-speech-speed'); if(ms) ms.value=state.audioSettings.rate; const mv=$('#modal-speed-val'); if(mv) mv.textContent=`${state.audioSettings.rate.toFixed(2)}×`; const ssr=$('#set-speech-rate'); if(ssr) ssr.value=state.audioSettings.rate; const ssv=$('#set-speech-rate-val'); if(ssv) ssv.textContent=`${state.audioSettings.rate.toFixed(2)}× ~${Math.round(state.audioSettings.rate*150)} WPM`; saveAudioSettings(); });
  $('#set-speech-rate')?.addEventListener('input',(e)=>{ state.audioSettings.rate=Number(e.target.value); $('#set-speech-rate-val').textContent=`${state.audioSettings.rate.toFixed(2)}× ~${Math.round(state.audioSettings.rate*150)} WPM`; const si=$('#speech-speed'); if(si) si.value=state.audioSettings.rate; const sv=$('#speech-speed-value'); if(sv) sv.textContent=`${state.audioSettings.rate.toFixed(2)}×`; const ms=$('#modal-speech-speed'); if(ms) ms.value=state.audioSettings.rate; const mv=$('#modal-speed-val'); if(mv) mv.textContent=`${state.audioSettings.rate.toFixed(2)}×`; saveAudioSettings(); });
  $('#modal-speech-pitch')?.addEventListener('input',(e)=>{ state.audioSettings.pitch=Number(e.target.value); $('#modal-pitch-val').textContent=state.audioSettings.pitch.toFixed(2); const sp=$('#set-pitch'); if(sp) sp.value=state.audioSettings.pitch; const spv=$('#set-pitch-val'); if(spv) spv.textContent=state.audioSettings.pitch.toFixed(2); saveAudioSettings(); });
  $('#set-pitch')?.addEventListener('input',(e)=>{ state.audioSettings.pitch=Number(e.target.value); $('#set-pitch-val').textContent=state.audioSettings.pitch.toFixed(2); const mp=$('#modal-speech-pitch'); if(mp) mp.value=state.audioSettings.pitch; const mpv=$('#modal-pitch-val'); if(mpv) mpv.textContent=state.audioSettings.pitch.toFixed(2); saveAudioSettings(); });
  $('#modal-speech-volume')?.addEventListener('input',(e)=>{ state.audioSettings.volume=Number(e.target.value); $('#modal-volume-val').textContent=`${Math.round(state.audioSettings.volume*100)}%`; const sv=$('#set-volume'); if(sv) sv.value=state.audioSettings.volume; const svv=$('#set-volume-val'); if(svv) svv.textContent=`${Math.round(state.audioSettings.volume*100)}%`; saveAudioSettings(); });
  $('#set-volume')?.addEventListener('input',(e)=>{ state.audioSettings.volume=Number(e.target.value); $('#set-volume-val').textContent=`${Math.round(state.audioSettings.volume*100)}%`; const mv=$('#modal-speech-volume'); if(mv) mv.value=state.audioSettings.volume; const mvv=$('#modal-volume-val'); if(mvv) mvv.textContent=`${Math.round(state.audioSettings.volume*100)}%`; saveAudioSettings(); });
  $('#earcon-toggle')?.addEventListener('change',(e)=>{ state.audioSettings.earcons=e.target.checked; const se=$('#set-earcons'); if(se) se.checked=e.target.checked; saveAudioSettings(); if(e.target.checked) playEarcon('correct'); });
  $('#set-earcons')?.addEventListener('change',(e)=>{ state.audioSettings.earcons=e.target.checked; const et=$('#earcon-toggle'); if(et) et.checked=e.target.checked; saveAudioSettings(); if(e.target.checked) playEarcon('correct'); });
  $('#auto-speak-toggle')?.addEventListener('change',(e)=>{ state.audioSettings.autoSpeak=e.target.checked; const sas=$('#set-auto-speak'); if(sas) sas.checked=e.target.checked; saveAudioSettings(); });
  $('#set-auto-speak')?.addEventListener('change',(e)=>{ state.audioSettings.autoSpeak=e.target.checked; const ast=$('#auto-speak-toggle'); if(ast) ast.checked=e.target.checked; saveAudioSettings(); });
  $('#set-spatial-audio')?.addEventListener('change',(e)=>{ state.audioSettings.spatialAudio=e.target.checked; saveAudioSettings(); });

  // Visual settings
  $('#set-theme')?.addEventListener('change',(e)=> setTheme(e.target.value));
  $('#set-font-family')?.addEventListener('change',(e)=>{ state.visualSettings.fontFamily=e.target.value; document.documentElement.setAttribute('data-font', e.target.value); saveVisualSettings(); calculateVisualLoad(); toast(`Font: ${labelize(e.target.value)}`); });
  $('#set-font-size')?.addEventListener('input',(e)=>{ state.visualSettings.fontSize=Number(e.target.value); $('#set-font-size-val').textContent=`${e.target.value}px`; document.documentElement.style.setProperty('--font-size-base', `${e.target.value}px`); saveVisualSettings(); calculateVisualLoad(); });
  $('#set-line-height')?.addEventListener('input',(e)=>{ state.visualSettings.lineHeight=Number(e.target.value); $('#set-line-height-val').textContent=Number(e.target.value).toFixed(2); document.documentElement.style.setProperty('--line-height-base', e.target.value); saveVisualSettings(); calculateVisualLoad(); });
  $('#set-letter-spacing')?.addEventListener('input',(e)=>{ state.visualSettings.letterSpacing=Number(e.target.value); $('#set-letter-spacing-val').textContent=`${Number(e.target.value).toFixed(2)}em`; document.documentElement.style.setProperty('--letter-spacing-base', `${e.target.value}em`); saveVisualSettings(); calculateVisualLoad(); });
  $('#set-blue-filter')?.addEventListener('input',(e)=>{ state.visualSettings.blueFilter=Number(e.target.value); $('#set-blue-filter-val').textContent=`${e.target.value}%`; document.documentElement.style.setProperty('--blue-filter', `${e.target.value}%`); saveVisualSettings(); calculateVisualLoad(); });
  $('#set-reduce-motion')?.addEventListener('change',(e)=>{ state.visualSettings.reduceMotion=e.target.checked; document.documentElement.setAttribute('data-motion', e.target.checked?'off':'on'); saveVisualSettings(); calculateVisualLoad(); toast(e.target.checked?'Reduce motion on — vestibular safe':'Motion restored'); });
  $('#set-focus-mode')?.addEventListener('change',(e)=>{ state.visualSettings.focusMode=e.target.checked; document.body.classList.toggle('focus-mode', e.target.checked); saveVisualSettings(); });
  $('#set-reading-ruler')?.addEventListener('change',(e)=>{ state.visualSettings.readingRuler=e.target.checked; $('#reading-ruler')?.classList.toggle('hidden', !e.target.checked); saveVisualSettings(); });

  // Settings drawer
  $('#settings-close')?.addEventListener('click', closeSettings);
  $('#settings-save')?.addEventListener('click', closeSettings);
  $('#settings-drawer')?.addEventListener('click',(e)=>{ if(e.target.id==='settings-drawer') closeSettings(); });

  // Command palette
  $('#cmd-input')?.addEventListener('input',(e)=> renderCommandList(e.target.value));
  $('#cmd-palette')?.addEventListener('click',(e)=>{ if(e.target.id==='cmd-palette') closeCommandPalette(); });

  // Shortcuts modal
  $('#shortcuts-close')?.addEventListener('click', closeShortcuts);
  $('#shortcuts-close-2')?.addEventListener('click', closeShortcuts);
  $('#shortcuts-modal')?.addEventListener('click',(e)=>{ if(e.target.id==='shortcuts-modal') closeShortcuts(); });

  // Hero
  $('#hero-start')?.addEventListener('click',()=> navigateTo('study'));
  $('#hero-due')?.addEventListener('click',()=>{
    navigateTo('study');
    const r=document.querySelector('input[name="mode"][value="due"]'); if(r) r.checked=true;
    startSession().catch(e=> toast(e.message));
  });
  $('#hero-no-screen')?.addEventListener('click',()=>{
    navigateTo('study');
    const cb=$('#no-screen-toggle'); if(cb) cb.checked=true;
    toast('No-screen enabled — start session for eyes-free');
  });

  // Misconceptions
  $('#drill-misconceptions-btn')?.addEventListener('click',()=>{
    navigateTo('study');
    const r=document.querySelector('input[name="mode"][value="misconceptions"]'); if(r) r.checked=true;
    startSession().catch(e=> toast(e.message));
  });
  $$('.misconception-filter-bar .chip').forEach(chip=>{
    chip.addEventListener('click',()=>{
      $$('.misconception-filter-bar .chip').forEach(c=> c.classList.remove('active'));
      chip.classList.add('active');
      state.misconceptionFilter=chip.dataset.filter;
      renderMisconceptions();
    });
  });
  $('#misconception-list')?.addEventListener('click',(e)=>{
    const btn=e.target.closest('.drill-single-btn'); if(!btn) return;
    const qid=btn.dataset.qid;
    const q=state.available.find(item=> item.id===qid) || state.misconceptions[qid]?.question;
    if(q){
      state.lastFilters={title:`Misconception Drill: ${labelize(q.subject)}`, questions:[q]};
      state.session={questions:[q],answers:[null],confidence:[null],mode:'practice',finished:false};
      state.currentQuestionIndex=0;
      $$('.section-view').forEach(el=> el.classList.add('hidden'));
      $('#quiz-view').classList.remove('hidden');
      $('#quiz-kicker').textContent='Targeted Cognitive Drill';
      $('#quiz-title').textContent=`${labelize(q.subject)} intuition repair`;
      $('#question-list').innerHTML=renderQuestion(q,0);
      updateQuizProgress();
      window.scrollTo({top:0,behavior:'smooth'});
    }
  });

  // Filters
  $('#source-filter')?.addEventListener('change',()=> refreshFilters());
  $('#collection-filter')?.addEventListener('change',()=> refreshFilters('collection'));
  $('#subject-filter')?.addEventListener('change',()=> refreshFilters('subject'));
  $('#topic-filter')?.addEventListener('change', updateMatches);
  $('#year-filter')?.addEventListener('change', updateMatches);
  $('#start-button')?.addEventListener('click',()=> startSession().catch(e=>{ const mc=$('#match-count'); if(mc) mc.textContent=e.message; const sb=$('#start-button'); if(sb) sb.disabled=false; }));
  $('#due-button')?.addEventListener('click',()=>{
    const r=document.querySelector('input[name="mode"][value="due"]'); if(r) r.checked=true;
    navigateTo('study');
    startSession().catch(e=> toast(e.message));
  });

  // Voice toggle
  $('#voice-toggle')?.addEventListener('click', toggleVoiceMode);
  $('#voice-preview')?.addEventListener('click', testVoiceAudio);
  $('#focus-toggle')?.addEventListener('click', toggleFocusMode);

  // Quiz
  $('#submit-button')?.addEventListener('click', finishSession);
  $('#exit-button')?.addEventListener('click', showSetup);
  $('#new-session-button')?.addEventListener('click', showSetup);
  $('#retry-button')?.addEventListener('click',()=> startSession().catch(e=> toast(e.message)));
  $('#drill-weak-button')?.addEventListener('click',()=>{
    navigateTo('study');
    const r=document.querySelector('input[name="mode"][value="weakest"]'); if(r) r.checked=true;
    startSession().catch(e=> toast(e.message));
  });

  $('#prev-question')?.addEventListener('click',()=> moveToQuestion(state.currentQuestionIndex-1));
  $('#next-question')?.addEventListener('click',()=> moveToQuestion(state.currentQuestionIndex+1));
  $('#session-queue')?.addEventListener('click',(event)=>{
    const button=event.target.closest('.queue-dot');
    if(button) moveToQuestion(Number(button.dataset.queueIndex));
  });

  $('#question-list')?.addEventListener('click',(event)=>{
    const confBtn=event.target.closest('.confidence-button');
    if(confBtn){ setConfidence(Number(confBtn.dataset.confidenceIndex), Number(confBtn.dataset.confidence), confBtn); return; }
    const listenBtn=event.target.closest('.listen-button');
    if(listenBtn){ speakQuestion(Number(listenBtn.dataset.voiceIndex), false); return; }
    const voiceBtn=event.target.closest('.answer-voice-button');
    if(voiceBtn){ listenForAnswer(Number(voiceBtn.dataset.voiceAnswerIndex), voiceBtn); return; }
    const hintBtn=event.target.closest('.hint-button');
    if(hintBtn){ speakHint(Number(hintBtn.dataset.hintIndex)); toast('Hint: think cause-effect & core principle'); return; }
    const option=event.target.closest('.option');
    if(option) chooseAnswer(option.closest('.question-card'), Number(option.dataset.optionIndex));
  });

  // Graph
  $('#graph-reset')?.addEventListener('click',()=>{ state.graphScale=1; state.graphOffset={x:0,y:0}; renderKnowledgeGraph(); });
  $('#graph-zoom-in')?.addEventListener('click',()=>{ state.graphScale=Math.min(2.2,(state.graphScale||1)+0.25); renderKnowledgeGraph(); });
  $('#graph-zoom-out')?.addEventListener('click',()=>{ state.graphScale=Math.max(0.55,(state.graphScale||1)-0.25); renderKnowledgeGraph(); });
  $('#graph-search')?.addEventListener('input', debounce((e)=>{ state.graphSearch=e.target.value; renderKnowledgeGraph(); }, 250));
  $('#graph-filter')?.addEventListener('change', renderKnowledgeGraph);
  $('#inspector-close')?.addEventListener('click',()=>{ $('#graph-inspector')?.classList.add('hidden'); state.graphSelectedNode=null; });
  $('#inspector-drill-btn')?.addEventListener('click',()=>{
    const node=state.graphSelectedNode; if(!node) return;
    navigateTo('study');
    const sf=$('#subject-filter');
    if(sf){
      for(const opt of sf.options){
        if(labelize(opt.value)===node.label || opt.value===node.id){ sf.value=opt.value; refreshFilters('subject'); break; }
      }
    }
    toast(`Filtered to ${node.label}`);
  });

  // Pomodoro
  $('#pomodoro-start')?.addEventListener('click',()=>{ if(state.pomodoro.running) resetPomodoro(); else startPomodoro(); const btn=$('#pomodoro-start'); if(btn) btn.textContent=state.pomodoro.running?'Reset':'Start 25m Focus'; });
  $('#pomodoro-reset')?.addEventListener('click',()=>{ resetPomodoro(); const btn=$('#pomodoro-start'); if(btn) btn.textContent='Start 25m Focus'; });

  // Reading ruler mouse
  document.addEventListener('mousemove',(e)=>{
    if(!state.visualSettings.readingRuler) return;
    const ruler=$('#reading-ruler'); if(!ruler) return;
    ruler.style.top=`${e.clientY-14}px`;
  });

  // Voice init
  if('speechSynthesis' in window){
    window.speechSynthesis.onvoiceschanged=refreshVoices;
    refreshVoices();
  }

  // Visual load recalcs
  window.addEventListener('resize', debounce(()=>{ calculateVisualLoad(); }, 300));
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden) calculateCircadian(); });

  // Escape closes the topmost overlay before quiz shortcuts run.
  document.addEventListener('keydown',(e)=>{
    if(e.key==='Escape' && closeOpenOverlays()){
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
}

// ─── Init ───
async function init(){
  initTheme();
  loadAudioSettings();
  setupEventListeners();
  animateBrainCanvas();
  calculateVisualLoad();
  calculateAcousticLoad();
  calculateCircadian();
  try{
    loadLearning();
    loadMisconceptions();
    await loadBanks();
    const builderTotal=state.builderManifest?.totalQuestions||0;
    const boardCount=state.boardCatalog.reduce((t,s)=>t+s.totalQuestions,0);
    $('#stat-questions').textContent=(builderTotal+boardCount).toLocaleString();
    $('#stat-banks').textContent=state.banks.length;
    $('#stat-subjects').textContent=((state.builderManifest?.subjects.length)||0)+state.boardCatalog.length;
    $('#load-status').textContent='Ready • Cognitive engine online';
    $('.status-dot')?.classList.remove('pulsing'); $('.status-dot')?.classList.add('ready');
    const sourceSel=$('#source-filter');
    if(sourceSel){
      const opts=state.banks.map(b=>`<option value="${b.id}">${esc(b.label)}</option>`).join('');
      sourceSel.innerHTML=`<option value="all">All banks (Builder + Board)</option>`+opts;
    }
    refreshFilters();
    renderRecent();
    renderLearningDashboard();
    renderHistory();
    renderMisconceptions();
    if('serviceWorker' in navigator){
      navigator.serviceWorker.register('sw.js').catch((err)=>console.warn('Offline mode unavailable:', err.message));
    }
    toast('NeuroPrep ready — visual load & acoustic load optimized • Press ? for shortcuts • Ctrl+K for commands');
  }catch(error){
    $('#load-status').textContent='Error loading data';
    const mc=$('#match-count'); if(mc) mc.textContent=error.message;
    console.error('Init error', error);
  }
}
init();
