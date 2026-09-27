/* ═══════════════════════════════════════════════
   NeuroPrep — Application Engine
   Neuroscience-backed learning system
   ═══════════════════════════════════════════════ */

// ─── State ───
const state = {
  banks: [],
  available: [],
  filtered: [],
  session: null,
  lastFilters: null,
  boardCatalog: [],
  voiceMode: false,
  noScreen: false,
  blackoutMode: false,
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
  },
  currentNav: 'dashboard',
  currentQuestionIndex: 0,
  waitingConfidence: false,
  misconceptionFilter: 'all',
  graphNodes: [],
  graphEdges: [],
  graphDrag: null,
  graphOffset: { x: 0, y: 0 },
  graphScale: 1,
  graphSearch: '',
  graphSelectedNode: null,
};

const STORAGE_KEY = 'neuroprep-history-v2';
const LEARNING_KEY = 'neuroprep-learning-v2';
const THEME_KEY = 'neuroprep-theme';
const VOICE_KEY = 'neuroprep-voice';
const AUDIO_SETTINGS_KEY = 'neuroprep-audio-settings-v2';
const MISCONCEPTIONS_KEY = 'neuroprep-misconceptions-v2';

// ─── Leitner intervals (ms): Box 1 = 10min, Box 2 = 1day, Box 3 = 3days, Box 4 = 7days, Box 5 = 30days ───
const LEITNER_INTERVALS = [
  10 * 60 * 1000,
  24 * 60 * 60 * 1000,
  3 * 24 * 60 * 60 * 1000,
  7 * 24 * 60 * 60 * 1000,
  14 * 24 * 60 * 60 * 1000,
  30 * 24 * 60 * 60 * 1000,
];

// ─── Auditory Cues / Earcons (Web Audio API) ───
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) audioCtx = new AudioContextClass();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playEarcon(type) {
  if (!state.audioSettings.earcons) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'correct') {
      // Harmonic major third / chord (C5 -> E5 -> G5)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, t);
      osc.frequency.setValueAtTime(659.25, t + 0.08);
      osc.frequency.setValueAtTime(783.99, t + 0.16);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.start(t);
      osc.stop(t + 0.45);
    } else if (type === 'incorrect') {
      // Gentle soft minor interval (A4 -> F4), grounded and not harsh
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, t);
      osc.frequency.setValueAtTime(349.23, t + 0.12);
      gain.gain.setValueAtTime(0.16, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      osc.start(t);
      osc.stop(t + 0.38);
    } else if (type === 'select') {
      // Crisp subtle click
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, t);
      gain.gain.setValueAtTime(0.07, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      osc.start(t);
      osc.stop(t + 0.06);
    } else if (type === 'advance') {
      // Gentle airy chime sweep
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, t);
      osc.frequency.exponentialRampToValueAtTime(880, t + 0.12);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.start(t);
      osc.stop(t + 0.15);
    } else if (type === 'test') {
      // Harmonious sample chime
      [523.25, 659.25, 783.99].forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = freq;
        o.connect(g);
        g.connect(ctx.destination);
        g.gain.setValueAtTime(0.12, t + i * 0.08);
        g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.3);
        o.start(t + i * 0.08);
        o.stop(t + i * 0.08 + 0.3);
      });
    }
  } catch (err) {
    console.debug('Earcon playback skipped:', err);
  }
}

// ─── Helpers ───
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const escapeHtml = (val) => String(val ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c]);
const labelize = (val) => String(val || '').replaceAll('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);
const hasUrdu = (val) => /[\u0600-\u06ff]/.test(val || '');
const now = () => Date.now();
const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

// ─── Toast ───
let toastTimer;
function showToast(msg, duration = 2500) {
  const toast = $('#toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), duration);
}

// ─── Theme ───
function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const theme = saved || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
}
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(THEME_KEY, next);
  showToast(`Theme: ${next}`);
}

// ─── Navigation ───
function navigateTo(section) {
  state.currentNav = section;
  $$('.section-view').forEach((el) => el.classList.add('hidden'));
  const target = $(`#${section}-section`);
  if (target) target.classList.remove('hidden');
  $$('.nav-link').forEach((link) => {
    link.classList.toggle('active', link.dataset.nav === section);
  });
  if (section === 'knowledge') renderKnowledgeGraph();
  if (section === 'history') renderHistory();
  if (section === 'misconceptions') renderMisconceptions();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Audio Settings ───
function loadAudioSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(AUDIO_SETTINGS_KEY));
    if (saved) state.audioSettings = { ...state.audioSettings, ...saved };
  } catch { /* use defaults */ }
  const legacyVoice = localStorage.getItem(VOICE_KEY);
  if (legacyVoice) state.audioSettings.voiceId = legacyVoice;
  syncAudioControls();
}

function saveAudioSettings() {
  localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(state.audioSettings));
  localStorage.setItem(VOICE_KEY, state.audioSettings.voiceId);
}

function syncAudioControls() {
  const s = state.audioSettings;
  const speedInput = $('#speech-speed');
  if (speedInput) speedInput.value = s.rate;
  const speedVal = $('#speech-speed-value');
  if (speedVal) speedVal.textContent = `${Number(s.rate).toFixed(2)}×`;

  const mVoiceSel = $('#modal-voice-select');
  if (mVoiceSel) mVoiceSel.value = s.voiceId;
  const mSpeed = $('#modal-speech-speed');
  if (mSpeed) mSpeed.value = s.rate;
  const mSpeedVal = $('#modal-speed-val');
  if (mSpeedVal) mSpeedVal.textContent = `${Number(s.rate).toFixed(2)}×`;
  const mPitch = $('#modal-speech-pitch');
  if (mPitch) mPitch.value = s.pitch;
  const mPitchVal = $('#modal-pitch-val');
  if (mPitchVal) mPitchVal.textContent = Number(s.pitch).toFixed(2);
  const mVol = $('#modal-speech-volume');
  if (mVol) mVol.value = s.volume;
  const mVolVal = $('#modal-volume-val');
  if (mVolVal) mVolVal.textContent = `${Math.round(s.volume * 100)}%`;
  const earconToggle = $('#earcon-toggle');
  if (earconToggle) earconToggle.checked = s.earcons;
  const autoSpeakToggle = $('#auto-speak-toggle');
  if (autoSpeakToggle) autoSpeakToggle.checked = s.autoSpeak;
}

// ─── Misconceptions Engine (Chi, Vosniadou, Posner) ───
function loadMisconceptions() {
  try { state.misconceptions = JSON.parse(localStorage.getItem(MISCONCEPTIONS_KEY) || '{}'); } catch { state.misconceptions = {}; }
}

function saveMisconceptions() {
  localStorage.setItem(MISCONCEPTIONS_KEY, JSON.stringify(state.misconceptions));
}

function getIntuitionAnchor(question) {
  const exp = question.explanation || '';
  return {
    intuition: exp || `The core concept hinges on the fundamental principles and verified domain knowledge of ${labelize(question.subject)}.`,
    pitfall: `Plausible distractors often mimic surface keywords or popular misnomers. Active retrieval anchors the causal distinction into long-term semantic memory.`
  };
}

function recordMisconception(question, selectedOptionIdx, isCorrect, confidence) {
  if (!state.misconceptions) state.misconceptions = {};
  const isHypercorrection = (!isCorrect && confidence >= 4);

  if (!isCorrect) {
    const existing = state.misconceptions[question.id] || {};
    state.misconceptions[question.id] = {
      questionId: question.id,
      prompt: question.prompt,
      subject: question.subject,
      topic: question.topic,
      collection: question.collectionLabel,
      trappedAnswer: question.options[selectedOptionIdx] || 'None',
      correctAnswer: question.answerText,
      explanation: question.explanation || '',
      confidence,
      isHypercorrection: isHypercorrection || existing.isHypercorrection,
      timesFailed: (existing.timesFailed || 0) + 1,
      hardened: false,
      lastFailedAt: now(),
      question,
    };
  } else if (state.misconceptions[question.id]) {
    if (confidence >= 4) {
      state.misconceptions[question.id].hardened = true;
    }
  }
  saveMisconceptions();
}

function misconceptionQuestions() {
  const known = new Map(state.available.map((q) => [q.id, q]));
  const items = Object.values(state.misconceptions).filter((m) => !m.hardened);
  const qs = [];
  items.forEach((m) => {
    if (m.question) qs.push(m.question);
    else if (known.has(m.questionId)) qs.push(known.get(m.questionId));
  });
  return qs;
}

// ─── Learning Profiles (Leitner + Spaced Repetition) ───
function loadLearning() {
  try { state.learning = JSON.parse(localStorage.getItem(LEARNING_KEY) || '{}'); } catch { state.learning = {}; }
}

function getProfile(question) {
  return state.learning[question.id] || {
    box: 1,           // Leitner box (1-5)
    reps: 0,          // Total successful recalls
    lapses: 0,        // Total failures
    dueAt: 0,         // Next review timestamp
    interval: 0,      // Current interval
    lastCorrect: null,
    confidence: null,
    streak: 0,        // Consecutive correct
    totalAttempts: 0,
    firstSeen: null,
    lastSeen: null,
  };
}

function saveLearning() {
  localStorage.setItem(LEARNING_KEY, JSON.stringify(state.learning));
}

function updateLearningProfile(question, correct, confidence) {
  const profile = getProfile(question);
  profile.totalAttempts += 1;
  profile.lastSeen = now();
  if (!profile.firstSeen) profile.firstSeen = now();

  if (correct) {
    profile.streak += 1;
    profile.lastCorrect = true;
    // Leitner: move up one box (max 5)
    if (confidence >= 4) {
      profile.box = Math.min(5, profile.box + 1);
      profile.reps += 1;
    } else {
      // Correct but low confidence — stay in current box
      profile.reps = Math.max(1, profile.reps);
    }
  } else {
    profile.streak = 0;
    profile.lastCorrect = false;
    profile.lapses += 1;
    // Leitner: fall back to Box 1
    profile.box = 1;
    profile.reps = 0;
  }

  profile.confidence = confidence || 3;
  profile.interval = LEITNER_INTERVALS[Math.min(profile.box - 1, LEITNER_INTERVALS.length - 1)];
  profile.dueAt = now() + (correct ? profile.interval : LEITNER_INTERVALS[0]);
  profile.question = question;
  state.learning[question.id] = profile;
}

function dueQuestions() {
  const known = new Map(state.available.map((q) => [q.id, q]));
  Object.values(state.learning).forEach((p) => { if (p.question) known.set(p.question.id, p.question); });
  return [...known.values()].filter((q) => getProfile(q).dueAt <= now());
}

function weakestQuestions() {
  const scored = state.available.map((q) => {
    const p = getProfile(q);
    const score = p.lapses * 3 - p.reps * 1 - (p.lastCorrect ? 2 : 0) + (p.box === 1 ? 5 : 0);
    return { question: q, score };
  });
  return scored.sort((a, b) => b.score - a.score).map((s) => s.question);
}

function leitnerDrillQuestions() {
  // Prioritize Box 1, then Box 2, then due items
  const box1 = state.available.filter((q) => getProfile(q).box === 1);
  const box2 = state.available.filter((q) => getProfile(q).box === 2);
  const due = dueQuestions();
  return [...box1, ...box2, ...due.filter((q) => getProfile(q).box > 2)];
}

function interleaveQuestions(questions) {
  const groups = new Map();
  questions.forEach((q) => {
    const key = `${q.subject}:${q.topic || 'general'}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(q);
  });
  const result = [];
  while ([...groups.values()].some((g) => g.length)) {
    groups.forEach((g) => { if (g.length) result.push(g.shift()); });
  }
  return result;
}

// ─── Leitner Dashboard ───
function renderLeitnerBoxes() {
  const profiles = Object.values(state.learning);
  const counts = [0, 0, 0, 0, 0];
  profiles.forEach((p) => { if (p.box >= 1 && p.box <= 5) counts[p.box - 1]++; });
  const total = Math.max(1, profiles.length);

  for (let i = 1; i <= 5; i++) {
    const el = $(`#leitner-${i}`);
    if (el) el.textContent = counts[i - 1];
    const bar = $(`#leitner-bar-${i}`);
    if (bar) bar.style.width = `${(counts[i - 1] / total) * 100}%`;
  }
}

// ─── Learning Dashboard ───
function renderLearningDashboard() {
  const due = dueQuestions();
  const profiles = Object.values(state.learning);
  const weak = profiles.filter((p) => p.lapses > 0 || p.lastCorrect === false).length;
  const stable = profiles.filter((p) => p.box >= 4 && p.lastCorrect === true).length;
  const retention = profiles.length
    ? Math.round((profiles.filter((p) => p.lastCorrect === true).length / profiles.length) * 100)
    : 0;

  $('#stat-due').textContent = due.length.toLocaleString();
  $('#stat-retention').textContent = profiles.length ? `${retention}%` : '—';
  $('#due-count').textContent = due.length;
  $('#weak-count').textContent = weak;
  $('#mastered-count').textContent = stable;

  const dueBtn = $('#due-button');
  const heroDueBtn = $('#hero-due');
  if (dueBtn) dueBtn.disabled = due.length === 0;
  if (heroDueBtn) {
    heroDueBtn.disabled = due.length === 0;
    $('#hero-due-badge').textContent = due.length;
  }

  renderLeitnerBoxes();
}

// ─── Voice & Audio Engine ───
function refreshVoices() {
  if (!('speechSynthesis' in window)) return;
  state.voices = window.speechSynthesis.getVoices();
  const currentVoiceId = state.audioSettings.voiceId || localStorage.getItem(VOICE_KEY) || 'default';

  const formatVoiceOption = (v, i) => {
    const isQuality = /natural|google|neural|premium|enhanced/i.test(v.name);
    const star = isQuality ? '★ ' : '';
    return `<option value="${i}">${star}${escapeHtml(v.name)} (${escapeHtml(v.lang)})</option>`;
  };

  const optionsHtml = '<option value="default">System default</option>' +
    state.voices.map(formatVoiceOption).join('');

  const sel = $('#voice-select');
  if (sel) {
    sel.innerHTML = optionsHtml;
    sel.value = state.voices.some((_, i) => String(i) === currentVoiceId) ? currentVoiceId : 'default';
  }

  const modalSel = $('#modal-voice-select');
  if (modalSel) {
    modalSel.innerHTML = optionsHtml;
    modalSel.value = state.voices.some((_, i) => String(i) === currentVoiceId) ? currentVoiceId : 'default';
  }
}

function getSelectedVoice() {
  const vId = state.audioSettings.voiceId;
  if (!vId || vId === 'default' || !state.voices.length) return null;
  return state.voices[Number(vId)] || null;
}

function speakText(text, onend) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  if (!text) return;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = hasUrdu(text) ? 'ur-PK' : 'en-US';
  utterance.rate = clamp(Number(state.audioSettings.rate || 0.9), 0.5, 1.6);
  utterance.pitch = clamp(Number(state.audioSettings.pitch || 1.0), 0.7, 1.4);
  utterance.volume = clamp(Number(state.audioSettings.volume ?? 1.0), 0.0, 1.0);

  const voice = getSelectedVoice();
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  }
  if (onend) utterance.onend = onend;
  window.speechSynthesis.speak(utterance);
}

function stopSpeech() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

function openVoiceModal() {
  refreshVoices();
  syncAudioControls();
  $('#voice-modal')?.classList.remove('hidden');
}

function closeVoiceModal() {
  $('#voice-modal')?.classList.add('hidden');
  saveAudioSettings();
}

function testVoiceAudio() {
  playEarcon('test');
  const statusEl = $('#test-audio-status');
  if (statusEl) statusEl.textContent = 'Playing test audio…';
  setTimeout(() => {
    speakText('Welcome to NeuroPrep audio engine. Active recall and spaced retrieval are calibrated.', () => {
      if (statusEl) statusEl.textContent = 'Voice test complete.';
      setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 3000);
    });
  }, 350);
}

function optionFromTranscript(transcript, question) {
  const normalized = transcript.trim().toLowerCase();
  const letter = normalized.match(/^(?:option\s*)?([a-d])(?:\b|$)/i);
  if (letter) return letter[1].toLowerCase().charCodeAt(0) - 97;
  const number = normalized.match(/^(?:option\s*)?([1-4])(?:\b|$)/i);
  if (number) return Number(number[1]) - 1;
  return question.options.findIndex((opt) => normalized.includes(String(opt).toLowerCase()));
}

function listenForAnswer(index, button) {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) { if (button) button.textContent = 'Voice unavailable'; return; }
  if (state.recognition) state.recognition.abort();
  const question = state.session.questions[index];
  const rec = new Recognition();
  state.recognition = rec;
  rec.lang = hasUrdu(question.prompt) ? 'ur-PK' : 'en-US';
  rec.interimResults = false;
  rec.maxAlternatives = 3;
  if (button) { button.classList.add('listening'); button.textContent = 'Listening…'; }
  rec.onresult = (event) => {
    const transcript = [...event.results[0]].map((r) => r.transcript).join(' ');
    const optIdx = optionFromTranscript(transcript, question);
    if (optIdx >= 0 && optIdx < question.options.length) {
      chooseAnswer($('#question-list').children[index], optIdx);
    }
  };
  rec.onerror = () => { if (button) { button.classList.remove('listening'); button.textContent = 'Answer by voice'; } };
  rec.onend = () => { if (button) { button.classList.remove('listening'); button.textContent = 'Answer by voice'; } state.recognition = null; };
  rec.start();
}

function speakQuestion(index, listenAfter = false) {
  if (!state.session || index < 0 || index >= state.session.questions.length) return;
  const q = state.session.questions[index];
  const btn = $('#question-list')?.children[index]?.querySelector('.answer-voice-button');
  const text = `Question ${index + 1} of ${state.session.questions.length}. ${q.prompt}. Options: ${q.options.map((o, i) => `${String.fromCharCode(65 + i)}: ${o}`).join('. ')}`;
  speakText(text, listenAfter ? () => listenForAnswer(index, btn) : null);
}

function speakQuestionPromptOnly(index) {
  if (!state.session || index < 0 || index >= state.session.questions.length) return;
  const q = state.session.questions[index];
  speakText(`Question ${index + 1}: ${q.prompt}`);
}

function speakOptionsOnly(index) {
  if (!state.session || index < 0 || index >= state.session.questions.length) return;
  const q = state.session.questions[index];
  const text = `Options: ${q.options.map((o, i) => `Option ${String.fromCharCode(65 + i)}: ${o}`).join('. ')}`;
  speakText(text);
}

function speakExplanation(index) {
  if (!state.session || index < 0 || index >= state.session.questions.length) return;
  const q = state.session.questions[index];
  const intuition = getIntuitionAnchor(q);
  const text = `Explanation for question ${index + 1}. Correct answer: ${q.answerText}. ${q.explanation || ''}. Core concept: ${intuition.intuition}`;
  speakText(text);
}

function speakMisconceptionWeedOut(index) {
  if (!state.session || index < 0 || index >= state.session.questions.length) return;
  const q = state.session.questions[index];
  const intuition = getIntuitionAnchor(q);
  const text = `Misconception analysis: The correct answer is ${q.answerText}. Common pitfall to weed out: ${intuition.pitfall}`;
  speakText(text);
}

function speakHint(index) {
  if (!state.session || index < 0 || index >= state.session.questions.length) return;
  const q = state.session.questions[index];
  const text = `Intuition hint: Consider the core principles of ${labelize(q.subject)} and the direct cause-and-effect relationship in the question.`;
  speakText(text);
}

// ─── No-Screen Mode ───
function toggleNoScreen() {
  state.noScreen = !state.noScreen;
  const overlay = $('#no-screen-overlay');
  const btn = $('#no-screen-btn');
  if (state.noScreen) {
    overlay.classList.remove('hidden');
    btn.classList.add('active');
    if (state.session && !state.session.finished) {
      updateNoScreenStatus();
      playEarcon('advance');
      speakQuestion(state.currentQuestionIndex, false);
    } else {
      $('#ns-status').textContent = 'No-Screen Eyes-Free Mode active. Start a session or press Space to study.';
      speakText('Eyes Free mode active. Press Escape to exit, or select a session.');
    }
  } else {
    overlay.classList.add('hidden');
    btn.classList.remove('active');
    stopSpeech();
    showToast('Exited Eyes-Free mode');
  }
}

function toggleBlackoutMode() {
  state.blackoutMode = !state.blackoutMode;
  const overlay = $('#no-screen-overlay');
  const toggleBtn = $('#ns-blackout-toggle');
  if (overlay) overlay.classList.toggle('blackout-active', state.blackoutMode);
  if (toggleBtn) toggleBtn.textContent = state.blackoutMode ? '☀️ Visual Mode' : '🌙 Pitch Black (0 nits)';
  speakText(state.blackoutMode ? 'Pitch black eye-rest active.' : 'Visual audio wave restored.');
}

function updateNoScreenStatus() {
  if (!state.session) return;
  const idx = state.currentQuestionIndex;
  const total = state.session.questions.length;
  const answered = state.session.answers.filter((a) => a !== null).length;
  $('#ns-status').textContent = `Question ${idx + 1} of ${total} · ${answered} answered`;
  $('#ns-progress-text').textContent = `${answered} / ${total}`;
  const fill = $('#ns-progress-fill');
  if (fill) fill.style.width = `${total ? (answered / total) * 100 : 0}%`;
}

// ─── Data normalization ───
function normalizeBuilderQuestion(q) {
  return {
    id: `builder:${q.id}`,
    source: 'builder',
    collection: q.examBody,
    collectionLabel: labelize(q.examBody),
    subject: q.subj,
    topic: q.topic,
    year: q.paperYear,
    prompt: q.q,
    options: q.options,
    answerIndex: q.options.indexOf(q.answer),
    answerText: q.answer,
    explanation: q.explanation,
    reference: q.paperTitle,
  };
}

function normalizeBoardQuestion(subject, q) {
  return {
    id: `board:${subject.board}:${subject.subject}:${q.id}`,
    source: 'board',
    collection: subject.board,
    collectionLabel: subject.category,
    subject: subject.subject,
    topic: '',
    year: '2026',
    prompt: q.question_text,
    options: q.options,
    answerIndex: q.correct_answer_index,
    answerText: q.options[q.correct_answer_index],
    explanation: q.explanation,
    reference: `${subject.name} (${subject.category})`,
  };
}

async function loadJson(url) {
  const resp = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!resp.ok) throw new Error(`Unable to load ${url}`);
  return resp.json();
}

async function loadBanks() {
  const builder = loadJson('../builder/questions.json').then((data) => ({
    id: 'builder', label: 'Builder question bank',
    questions: data.questions.map(normalizeBuilderQuestion),
  }));
  const board = loadJson('../board/index.json').then((index) => {
    state.boardCatalog = index.subjects;
    return { id: 'board', label: 'Board subject bank', questions: [] };
  });
  state.banks = await Promise.all([builder, board]);
  state.available = state.banks.flatMap((b) => b.questions);
}

// ─── Filters ───
function valuesFor(key) {
  return [...new Set(state.available.map((q) => q[key]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

function fillSelect(sel, values, allLabel) {
  sel.innerHTML = `<option value="all">${allLabel}</option>` +
    values.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(labelize(v))}</option>`).join('');
}

function refreshFilters(changed) {
  const source = $('#source-filter').value;
  const catalog = source === 'builder' ? [] : state.boardCatalog;
  const questions = state.available.filter((q) => source === 'all' || q.source === source);
  const collections = [...new Set([...questions.map((q) => q.collection), ...catalog.map((q) => q.board)])].sort();
  if (changed !== 'collection') fillSelect($('#collection-filter'), collections, 'All collections');
  const collection = $('#collection-filter').value;
  const scoped = questions.filter((q) => collection === 'all' || q.collection === collection);
  const catalogScoped = catalog.filter((q) => collection === 'all' || q.board === collection);
  if (changed !== 'subject') fillSelect($('#subject-filter'), [...new Set([...scoped.map((q) => q.subject), ...catalogScoped.map((q) => q.subject)])].sort(), 'All subjects');
  const subject = $('#subject-filter').value;
  const subjectScoped = scoped.filter((q) => subject === 'all' || q.subject === subject);
  const catalogSubjectScoped = catalogScoped.filter((q) => subject === 'all' || q.subject === subject);
  if (changed !== 'topic') fillSelect($('#topic-filter'), [...new Set(subjectScoped.map((q) => q.topic))].sort(), 'All topics');
  if (changed !== 'year') fillSelect($('#year-filter'), [...new Set([...subjectScoped.map((q) => q.year), ...catalogSubjectScoped.map(() => '2026')])].sort().reverse(), 'All years');
  updateMatches();
}

function updateMatches() {
  const filters = {
    source: $('#source-filter').value,
    collection: $('#collection-filter').value,
    subject: $('#subject-filter').value,
    topic: $('#topic-filter').value,
    year: $('#year-filter').value,
  };
  state.filtered = state.available.filter((q) => Object.entries(filters).every(([k, v]) => v === 'all' || q[k] === v));
  const boardCount = state.boardCatalog
    .filter((s) => filters.source !== 'builder' && (filters.collection === 'all' || s.board === filters.collection) && (filters.subject === 'all' || s.subject === filters.subject) && (filters.year === 'all' || filters.year === '2026'))
    .reduce((t, s) => t + s.totalQuestions, 0);
  const total = (filters.source === 'board' ? 0 : state.filtered.length) + (filters.source === 'builder' ? 0 : boardCount);
  $('#match-count').textContent = `${total.toLocaleString()} questions match these filters`;
  $('#start-button').disabled = total === 0;
}

// ─── Render Recent Sessions ───
function renderRecent() {
  const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  $('#session-count').textContent = history.length;
  const list = $('#recent-list');
  if (!list) return;
  list.innerHTML = history.length
    ? history.slice(0, 8).map((item) => `<div class="recent-item"><strong>${escapeHtml(item.title)}</strong><span>${item.percent}% · ${item.correct}/${item.total} correct · ${escapeHtml(new Date(item.date).toLocaleDateString())}</span></div>`).join('')
    : '<p class="empty-state">Your completed sessions will appear here.</p>';
}

// ─── Render History ───
function renderHistory() {
  const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const avgScore = history.length ? Math.round(history.reduce((s, h) => s + h.percent, 0) / history.length) : 0;
  const totalPracticed = history.reduce((s, h) => s + h.total, 0);
  $('#session-count').textContent = history.length;
  $('#avg-score').textContent = history.length ? `${avgScore}%` : '—';
  $('#total-practiced').textContent = totalPracticed.toLocaleString() || '—';
  const list = $('#history-list');
  if (!list) return;
  list.innerHTML = history.length
    ? history.map((item) => `<div class="recent-item"><strong>${escapeHtml(item.title)}</strong><span>${item.percent}% · ${item.correct}/${item.total} correct · ${escapeHtml(new Date(item.date).toLocaleDateString())}</span></div>`).join('')
    : '<p class="empty-state">Complete a session to see your history.</p>';
}

// ─── Render Question ───
function renderQuestion(question, index) {
  const urduClass = hasUrdu(question.prompt) ? ' urdu-text' : '';
  const profile = getProfile(question);
  const boxLabel = profile.box ? `Box ${profile.box}` : 'New';

  return `<article class="question-card" data-question-id="${escapeHtml(question.id)}" style="animation-delay: ${index * 0.05}s">
    <div class="question-meta">
      <span>Question ${index + 1}</span>
      <span>${escapeHtml(question.collectionLabel)} · ${escapeHtml(labelize(question.subject))} · <b>${boxLabel}</b></span>
    </div>
    <h3 class="${urduClass.trim()}">${escapeHtml(question.prompt)}</h3>
    <div class="options">
      ${question.options.map((opt, oi) => `<button class="option" data-option-index="${oi}">
        <span class="option-letter">${String.fromCharCode(65 + oi)}</span>
        <span class="${hasUrdu(opt) ? 'urdu-text' : ''}">${escapeHtml(opt)}</span>
      </button>`).join('')}
    </div>
    <div class="voice-actions">
      <button type="button" class="voice-button listen-button" data-voice-index="${index}">🔊 Listen</button>
      <button type="button" class="voice-button answer-voice-button" data-voice-answer-index="${index}">🎤 Voice answer</button>
    </div>
    <div class="confidence-row">
      <span>How certain were you?</span>
      <div>${[1, 2, 3, 4, 5].map((v) => `<button type="button" class="confidence-button" data-confidence-index="${index}" data-confidence="${v}">${v}</button>`).join('')}</div>
    </div>
    <div class="feedback hidden"></div>
  </article>`;
}

// ─── Quiz Progress ───
function updateQuizProgress() {
  const answered = state.session.answers.filter((a) => a !== null).length;
  const total = state.session.questions.length;
  $('#quiz-progress').textContent = `${answered} / ${total}`;
  $('#answered-count').textContent = `${answered} answered`;
  $('#progress-fill').style.width = `${total ? (answered / total) * 100 : 0}%`;
}

// ─── Choose Answer ───
function chooseAnswer(card, optionIndex) {
  if (!state.session || state.session.finished) return;
  const index = [...$('#question-list').children].indexOf(card);
  if (index < 0) return;
  state.session.answers[index] = optionIndex;
  card.querySelectorAll('.option').forEach((opt, i) => opt.classList.toggle('selected', i === optionIndex));

  const q = state.session.questions[index];
  const isCorrect = optionIndex === q.answerIndex;
  playEarcon(isCorrect ? 'correct' : 'incorrect');
  recordMisconception(q, optionIndex, isCorrect, state.session.confidence[index] || 3);

  if (state.session.mode === 'practice') revealFeedback(card, index);
  updateQuizProgress();

  if (state.voiceMode || state.noScreen) {
    const nextIdx = state.session.answers.findIndex((a) => a === null);
    if (nextIdx >= 0) {
      state.currentQuestionIndex = nextIdx;
      setTimeout(() => {
        playEarcon('advance');
        if (state.audioSettings.autoSpeak || state.noScreen) {
          speakQuestion(nextIdx, false);
        }
        if (state.noScreen) updateNoScreenStatus();
        if (!state.noScreen) scrollToQuestion(nextIdx);
      }, 700);
    } else {
      if (state.noScreen) {
        speakText('All questions in set answered. Press Enter to review and submit session.');
      }
    }
  }
}

function setConfidence(index, value, button) {
  state.session.confidence[index] = value;
  button.parentElement.querySelectorAll('.confidence-button').forEach((b) => b.classList.toggle('selected', b === button));
  playEarcon('select');
  if (state.noScreen) speakText(`Confidence set to ${value}`);
}

function revealFeedback(card, index) {
  const q = state.session.questions[index];
  const sel = state.session.answers[index];
  card.querySelectorAll('.option').forEach((opt, i) => {
    opt.classList.toggle('correct', i === q.answerIndex);
    opt.classList.toggle('incorrect', i === sel && sel !== q.answerIndex);
  });
  const fb = card.querySelector('.feedback');
  const isCorrect = sel === q.answerIndex;
  const intuition = getIntuitionAnchor(q);

  fb.innerHTML = `
    <div style="font-weight: 700; font-size: 14px; margin-bottom: 6px; color: var(--${isCorrect ? 'success' : 'error'})">
      ${isCorrect ? '✓ Correct recall' : `✗ Correct answer: ${escapeHtml(q.answerText)}`}
    </div>
    ${q.explanation ? `<div class="${hasUrdu(q.explanation) ? 'urdu-text' : ''}" style="color: var(--text-secondary); font-size: 13px; line-height: 1.5; margin-bottom: 10px;">${escapeHtml(q.explanation)}</div>` : ''}
    <div class="cognitive-analysis-grid">
      <div class="intuition-box">
        <b>🧠 Core Intuition</b>
        <p>${escapeHtml(intuition.intuition)}</p>
      </div>
      <div class="trap-box">
        <b>🚫 Distractor Pitfall</b>
        <p>${escapeHtml(intuition.pitfall)}</p>
      </div>
    </div>
  `;
  fb.classList.remove('hidden');

  if (state.voiceMode || state.noScreen) {
    const spokenFeedback = isCorrect ? 'Correct.' : `Incorrect. The correct answer is ${q.answerText}.`;
    speakText(spokenFeedback);
  }
}

function scrollToQuestion(index) {
  const cards = $('#question-list')?.children;
  if (cards && cards[index]) cards[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ─── Start Session ───
async function startSession() {
  const startBtn = $('#start-button');
  if (startBtn) startBtn.disabled = true;

  const filters = {
    source: $('#source-filter').value,
    collection: $('#collection-filter').value,
    subject: $('#subject-filter').value,
    topic: $('#topic-filter').value,
    year: $('#year-filter').value,
  };

  const builderQ = filters.source === 'board' ? [] : state.available.filter((q) => Object.entries(filters).every(([k, v]) => k === 'source' || v === 'all' || q[k] === v));
  const boardSubjects = filters.source === 'builder' ? [] : state.boardCatalog.filter((s) => (filters.collection === 'all' || s.board === filters.collection) && (filters.subject === 'all' || s.subject === filters.subject) && (filters.year === 'all' || filters.year === '2026'));
  const boardQ = (await Promise.all(boardSubjects.map(async (s) => {
    const data = await loadJson(`../${s.apiFile}`);
    return data.questions.map((q) => normalizeBoardQuestion(data, q)).filter((q) => filters.topic === 'all' || q.topic === filters.topic);
  }))).flat();

  const mode = document.querySelector('input[name="mode"]:checked')?.value || 'practice';
  let allQ;
  switch (mode) {
    case 'due': allQ = dueQuestions(); break;
    case 'leitner': allQ = leitnerDrillQuestions(); break;
    case 'weakest': allQ = weakestQuestions(); break;
    case 'misconceptions':
      allQ = misconceptionQuestions();
      if (!allQ.length) allQ = weakestQuestions();
      break;
    default: allQ = [...builderQ, ...boardQ]; break;
  }

  const limit = $('#limit-filter').value === 'all' ? allQ.length : Number($('#limit-filter').value);
  const questions = (mode === 'interleaved' ? interleaveQuestions(shuffle(allQ)) : shuffle(allQ)).slice(0, limit);

  if (questions.length === 0) {
    showToast('No questions match these criteria');
    if (startBtn) startBtn.disabled = false;
    return;
  }

  state.lastFilters = {
    title: $('#source-filter').value === 'all' ? 'Mixed practice' : $('#source-filter').options[$('#source-filter').selectedIndex].text,
    questions,
  };
  state.session = {
    questions,
    answers: new Array(questions.length).fill(null),
    confidence: new Array(questions.length).fill(null),
    mode,
    finished: false,
  };
  state.currentQuestionIndex = 0;

  // Show quiz view
  $$('.section-view').forEach((el) => el.classList.add('hidden'));
  $('#quiz-view').classList.remove('hidden');
  $('#result-view').classList.add('hidden');

  const modeLabels = {
    practice: 'Practice session',
    assessment: 'Assessment session',
    interleaved: 'Interleaved session',
    due: 'Due review',
    leitner: 'Leitner drill',
    weakest: 'Weakest-first repair',
    misconceptions: 'Weed-Out drill',
  };
  $('#quiz-kicker').textContent = modeLabels[mode] || 'Session';
  $('#quiz-title').textContent = `${questions.length} questions selected`;
  $('#question-list').innerHTML = questions.map(renderQuestion).join('');
  updateQuizProgress();

  if (startBtn) startBtn.disabled = false;

  // No-screen auto-start
  if ($('#no-screen-toggle')?.checked) {
    state.noScreen = true;
    $('#no-screen-overlay').classList.remove('hidden');
    $('#no-screen-btn').classList.add('active');
    updateNoScreenStatus();
    setTimeout(() => speakQuestion(0, false), 600);
  } else if (state.voiceMode || state.audioSettings.autoSpeak) {
    speakQuestion(0, false);
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Finish Session ───
function finishSession() {
  if (!state.session || state.session.finished) return;
  state.session.finished = true;
  playEarcon('complete');

  const { questions, answers } = state.session;
  const correct = questions.reduce((t, q, i) => t + (answers[i] === q.answerIndex ? 1 : 0), 0);
  const attempted = answers.filter((a) => a !== null).length;
  const percent = Math.round((correct / questions.length) * 100) || 0;

  // Update learning profiles
  questions.forEach((q, i) => {
    updateLearningProfile(q, answers[i] === q.answerIndex, state.session.confidence[i] || 3);
    revealFeedback($('#question-list').children[i], i);
  });
  saveLearning();

  // Save to history
  const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  history.unshift({
    title: state.lastFilters.title,
    percent, correct, total: questions.length,
    date: new Date().toISOString(),
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 50)));

  // Show result view
  $$('.section-view').forEach((el) => el.classList.add('hidden'));
  $('#result-view').classList.remove('hidden');
  if (state.noScreen) {
    $('#no-screen-overlay').classList.add('hidden');
    state.noScreen = false;
    $('#no-screen-btn').classList.remove('active');
  }

  // Animate score ring
  const circumference = 2 * Math.PI * 52;
  const offset = circumference - (percent / 100) * circumference;
  const scoreCircle = $('#score-circle');
  if (scoreCircle) {
    scoreCircle.style.strokeDasharray = circumference;
    scoreCircle.style.strokeDashoffset = circumference;
    requestAnimationFrame(() => {
      scoreCircle.style.transition = 'stroke-dashoffset 1.2s ease-out';
      scoreCircle.style.strokeDashoffset = offset;
    });
  }

  $('#result-score').textContent = `${percent}%`;
  $('#result-correct').textContent = correct;
  $('#result-attempted').textContent = attempted;
  $('#result-total').textContent = questions.length;

  const messages = [
    { min: 90, title: 'Outstanding!', sub: 'Near-perfect recall. Memory traces crystallized.' },
    { min: 75, title: 'Strong session.', sub: 'Solid retrieval performance across concepts.' },
    { min: 50, title: 'Useful progress.', sub: 'Effortful retrieval creates high neuroplastic consolidation.' },
    { min: 0, title: 'Misconceptions diagnosed.', sub: 'Prediction errors prime the brain for maximum updating.' },
  ];
  const msg = messages.find((m) => percent >= m.min);
  $('#result-title').textContent = msg.title;
  $('#result-subtitle').textContent = `${correct} correct from ${attempted} attempted. ${msg.sub}`;

  $('#result-review').innerHTML = questions.map((q, i) => {
    const isCorrect = answers[i] === q.answerIndex;
    const intuition = getIntuitionAnchor(q);
    return `<div class="review-item ${isCorrect ? 'correct-review' : ''}">
      <strong class="${hasUrdu(q.prompt) ? 'urdu-text' : ''}">${isCorrect ? '✓' : '✗'} ${escapeHtml(q.prompt)}</strong>
      <span class="${hasUrdu(q.answerText) ? 'urdu-text' : ''}">${answers[i] === null ? 'Not attempted' : `Your answer: ${escapeHtml(q.options[answers[i]])}`} · Correct: ${escapeHtml(q.answerText)} · Confidence: ${state.session.confidence[i] || 3}/5</span>
      <div style="margin-top:6px; font-size:11px; color:var(--text-muted);">
        <b>Intuition:</b> ${escapeHtml(intuition.intuition)}
      </div>
    </div>`;
  }).join('');

  renderRecent();
  renderLearningDashboard();
  renderHistory();
  renderMisconceptions();

  if (state.voiceMode || state.noScreen) {
    speakText(`Session complete. You scored ${percent} percent. ${correct} out of ${questions.length} correct.`);
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showSetup() {
  $$('.section-view').forEach((el) => el.classList.add('hidden'));
  $('#study-section').classList.remove('hidden');
  $$('.nav-link').forEach((l) => l.classList.toggle('active', l.dataset.nav === 'study'));
  state.currentNav = 'study';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleVoiceMode() {
  state.voiceMode = !state.voiceMode;
  const btn = $('#voice-toggle');
  if (btn) {
    btn.setAttribute('aria-pressed', String(state.voiceMode));
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><polygon points="2,5 6,5 10,2 10,14 6,11 2,11" stroke="currentColor" stroke-width="1.3" fill="currentColor" opacity="0.2"/><path d="M12 5.5a3.5 3.5 0 010 5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg> Voice: ${state.voiceMode ? 'On' : 'Off'}`;
  }
  showToast(`Voice mode: ${state.voiceMode ? 'on' : 'off'}`);
  if (state.voiceMode && state.session) {
    const nextIdx = state.session.answers.findIndex((a) => a === null);
    if (nextIdx >= 0) speakQuestion(nextIdx, true);
  }
  if (!state.voiceMode) stopSpeech();
}

// ─── Render Misconceptions (Weed-Out Cognitive Section) ───
function renderMisconceptions() {
  loadMisconceptions();
  const list = Object.values(state.misconceptions);
  const active = list.filter((m) => !m.hardened);
  const hypers = list.filter((m) => m.isHypercorrection && !m.hardened);
  const hardened = list.filter((m) => m.hardened);

  const activeEl = $('#stat-active-misconceptions');
  if (activeEl) activeEl.textContent = active.length;
  const hyperEl = $('#stat-hypercorrections');
  if (hyperEl) hyperEl.textContent = hypers.length;
  const hardEl = $('#stat-hardened');
  if (hardEl) hardEl.textContent = hardened.length;

  const drillBtn = $('#drill-misconceptions-btn');
  const badge = $('#misconception-badge');
  if (drillBtn) drillBtn.disabled = active.length === 0;
  if (badge) badge.textContent = active.length;

  const container = $('#misconception-list');
  if (!container) return;

  const filter = state.misconceptionFilter || 'all';
  let filtered = list;
  if (filter === 'hypercorrection') filtered = list.filter((m) => m.isHypercorrection);
  else if (filter === 'unresolved') filtered = active;
  else if (filter === 'hardened') filtered = hardened;

  if (filtered.length === 0) {
    container.innerHTML = `<p class="empty-state">${
      list.length === 0
        ? 'No misconceptions recorded yet. Complete a retrieval session to identify cognitive blind spots and weed out false concepts.'
        : 'No diagnosed misconceptions in this filter category.'
    }</p>`;
    return;
  }

  container.innerHTML = filtered.map((m) => {
    const isHyper = m.isHypercorrection;
    const isHard = m.hardened;
    const tagClass = isHard ? 'tag-hardened' : isHyper ? 'tag-hyper' : 'tag-unresolved';
    const tagLabel = isHard ? '✓ Resolved' : isHyper ? '⚡ Hypercorrection Alert' : '⚠️ Needs Hardening';
    const cardClass = isHard ? 'is-hardened' : isHyper ? 'is-hypercorrection' : '';
    const intuition = getIntuitionAnchor(m);

    return `<div class="misconception-card ${cardClass}" data-qid="${escapeHtml(m.questionId)}">
      <div class="misconception-meta">
        <span class="misconception-tag ${tagClass}">${tagLabel}</span>
        <span style="font-size:11px; color:var(--text-muted);">${escapeHtml(m.collection || '')} · ${escapeHtml(labelize(m.subject || ''))}</span>
      </div>
      <div class="misconception-question ${hasUrdu(m.prompt) ? 'urdu-text' : ''}">
        ${escapeHtml(m.prompt)}
      </div>
      <div class="cognitive-analysis-grid">
        <div class="trap-box">
          <b>🚫 Diagnosed Misconception / Trap</b>
          <p>Selected: <em class="${hasUrdu(m.trappedAnswer) ? 'urdu-text' : ''}">${escapeHtml(m.trappedAnswer)}</em></p>
          <p style="margin-top:4px;">${escapeHtml(intuition.pitfall)}</p>
        </div>
        <div class="intuition-box">
          <b>🧠 Verified Intuition & Ground Truth</b>
          <p>Correct: <strong class="${hasUrdu(m.correctAnswer) ? 'urdu-text' : ''}">${escapeHtml(m.correctAnswer)}</strong></p>
          <p class="${hasUrdu(intuition.intuition) ? 'urdu-text' : ''}" style="margin-top:4px;">${escapeHtml(intuition.intuition)}</p>
        </div>
      </div>
      <div class="misconception-actions">
        <button class="btn btn-outline btn-sm drill-single-btn" data-qid="${escapeHtml(m.questionId)}" type="button">
          Rehearse This Concept
        </button>
      </div>
    </div>`;
  }).join('');
}

// ─── Knowledge Graph (Canvas-based) ───
function buildGraphData() {
  const concepts = new Map();

  state.available.forEach((q) => {
    const subKey = q.subject;
    if (!concepts.has(subKey)) {
      concepts.set(subKey, {
        id: subKey, label: labelize(q.subject), type: 'subject',
        total: 0, health: 0, children: new Set(),
      });
    }
    const entry = concepts.get(subKey);
    entry.total += 1;
    const p = getProfile(q);
    entry.health += p.lastCorrect === true ? 1 : p.lastCorrect === false ? -1 : 0;

    if (q.topic) {
      const topicKey = `${q.subject}:${q.topic}`;
      if (!concepts.has(topicKey)) {
        concepts.set(topicKey, {
          id: topicKey, label: labelize(q.topic), type: 'topic',
          parent: subKey, total: 0, health: 0, children: new Set(),
        });
      }
      const topicEntry = concepts.get(topicKey);
      topicEntry.total += 1;
      topicEntry.health += p.lastCorrect === true ? 1 : p.lastCorrect === false ? -1 : 0;
      entry.children.add(topicKey);
    }
  });

  // Also add board catalog topics
  state.boardCatalog.forEach((s) => {
    const key = `board:${s.board}:${s.subject}`;
    if (!concepts.has(key)) {
      concepts.set(key, {
        id: key, label: labelize(s.subject), type: 'subject',
        total: s.totalQuestions, health: 0, children: new Set(),
      });
    }
  });

  // Build nodes and edges
  const nodes = [];
  const edges = [];
  const conceptList = [...concepts.values()];

  conceptList.forEach((c) => {
    const r = clamp(Math.sqrt(c.total) * 4 + 14, 16, 56);
    let color;
    const ratio = c.total > 0 ? c.health / c.total : 0;
    if (c.health === 0 && !Object.values(state.learning).some((p) => p.question && concepts.has(c.id))) {
      color = { r: 100, g: 116, b: 139, a: 0.45 }; // unseen
    } else if (ratio > 0.25) {
      color = { r: 16, g: 185, b: 129, a: 0.9 }; // strong recall
    } else if (ratio > -0.2) {
      color = { r: 6, g: 182, b: 212, a: 0.85 }; // moderate
    } else {
      color = { r: 239, g: 68, b: 68, a: 0.9 }; // weak / misconceptions
    }

    nodes.push({
      ...c, r, color, ratio,
      x: 150 + Math.random() * 800,
      y: 100 + Math.random() * 400,
      vx: 0, vy: 0,
    });

    if (c.parent) {
      edges.push({ source: c.parent, target: c.id });
    }
  });

  state.graphNodes = nodes;
  state.graphEdges = edges;
}

function renderKnowledgeGraph() {
  buildGraphData();
  const canvas = $('#knowledge-graph');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;
  ctx.scale(dpr, dpr);
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;

  const nodes = state.graphNodes;
  const edges = state.graphEdges;
  const filter = $('#graph-filter')?.value || 'all';
  const query = (state.graphSearch || '').toLowerCase().trim();

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  function simulate() {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = 900 / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        nodes[i].vx -= fx; nodes[i].vy -= fy;
        nodes[j].vx += fx; nodes[j].vy += fy;
      }
    }

    edges.forEach((e) => {
      const s = nodeMap.get(e.source);
      const t = nodeMap.get(e.target);
      if (!s || !t) return;
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const force = (dist - 130) * 0.02;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      s.vx += fx; s.vy += fy;
      t.vx -= fx; t.vy -= fy;
    });

    nodes.forEach((n) => {
      n.vx += (W / 2 - n.x) * 0.0012;
      n.vy += (H / 2 - n.y) * 0.0012;
      n.vx *= 0.85; n.vy *= 0.85;
      n.x += n.vx; n.y += n.vy;
      n.x = clamp(n.x, n.r + 10, W - n.r - 10);
      n.y = clamp(n.y, n.r + 10, H - n.r - 10);
    });
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    const scale = state.graphScale || 1;
    ctx.translate(W / 2, H / 2);
    ctx.scale(scale, scale);
    ctx.translate(-W / 2 + state.graphOffset.x, -H / 2 + state.graphOffset.y);

    // Draw neural filaments
    ctx.lineWidth = 1.2;
    edges.forEach((e) => {
      const s = nodeMap.get(e.source);
      const t = nodeMap.get(e.target);
      if (!s || !t) return;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(t.x, t.y);
      ctx.strokeStyle = 'rgba(148,163,184,0.18)';
      ctx.stroke();
    });

    // Draw nodes
    nodes.forEach((n) => {
      if (filter === 'weak' && n.health >= 0) return;
      if (filter === 'strong' && n.health <= 0) return;
      if (filter === 'unseen' && n.color.a > 0.5) return;

      const isMatch = !query || n.label.toLowerCase().includes(query);
      const opacityMultiplier = isMatch ? 1 : 0.2;

      // Glow
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r + (isMatch && query ? 8 : 4), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${n.color.r},${n.color.g},${n.color.b},${0.18 * opacityMultiplier})`;
      ctx.fill();

      // Node circle
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${n.color.r},${n.color.g},${n.color.b},${n.color.a * opacityMultiplier})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(${n.color.r},${n.color.g},${n.color.b},${0.6 * opacityMultiplier})`;
      ctx.lineWidth = isMatch && query ? 2.5 : 1.5;
      ctx.stroke();

      // Label
      ctx.fillStyle = isMatch ? '#fff' : 'rgba(255,255,255,0.3)';
      ctx.font = `${n.r > 24 ? 11 : 9}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = n.label.length > 16 ? n.label.substring(0, 14) + '…' : n.label;
      ctx.fillText(label, n.x, n.y);

      // Question count below
      if (n.r > 18) {
        ctx.font = '8px Inter, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText(`${n.total}q`, n.x, n.y + n.r + 10);
      }
    });

    ctx.restore();
  }

  let frame = 0;
  function tick() {
    simulate();
    draw();
    frame++;
    if (frame < 180) requestAnimationFrame(tick);
  }
  tick();

  // Click handler to open inspector card
  canvas.onclick = (e) => {
    const rect = canvas.getBoundingClientRect();
    const scale = state.graphScale || 1;
    const clickX = (e.clientX - rect.left - W / 2) / scale + W / 2 - state.graphOffset.x;
    const clickY = (e.clientY - rect.top - H / 2) / scale + H / 2 - state.graphOffset.y;

    for (const n of nodes) {
      const dx = n.x - clickX;
      const dy = n.y - clickY;
      if (dx * dx + dy * dy < n.r * n.r) {
        state.graphSelectedNode = n;
        playEarcon('select');

        const inspector = $('#graph-inspector');
        if (inspector) {
          inspector.classList.remove('hidden');
          $('#inspector-title').textContent = n.label;
          $('#inspector-type').textContent = n.type === 'subject' ? 'Subject Cluster' : 'Topic Node';
          $('#inspector-stats').textContent = `${n.total} questions in question banks`;
          const pct = Math.max(0, Math.min(100, Math.round(((n.ratio || 0) + 1) * 50)));
          $('#inspector-pct').textContent = `${pct}% Retention Strength`;
          const fill = $('#inspector-fill');
          if (fill) fill.style.width = `${pct}%`;
        }
        break;
      }
    }
  };
}

// ─── Brain Canvas Animation (Hero) ───
function animateBrainCanvas() {
  const canvas = $('#brain-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = 360 * dpr;
  canvas.height = 360 * dpr;
  ctx.scale(dpr, dpr);
  const W = 360, H = 360, cx = W / 2, cy = H / 2;

  // Generate neuron positions
  const neurons = Array.from({ length: 24 }, () => ({
    x: cx + (Math.random() - 0.5) * 260,
    y: cy + (Math.random() - 0.5) * 260,
    r: 3 + Math.random() * 5,
    pulse: Math.random() * Math.PI * 2,
    speed: 0.02 + Math.random() * 0.03,
  }));

  // Generate connections
  const connections = [];
  neurons.forEach((n, i) => {
    const closest = neurons
      .map((m, j) => ({ j, d: Math.hypot(m.x - n.x, m.y - n.y) }))
      .filter((c) => c.j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, 2 + Math.floor(Math.random() * 2));
    closest.forEach((c) => connections.push({ from: i, to: c.j, progress: Math.random() }));
  });

  function draw(time) {
    ctx.clearRect(0, 0, W, H);
    const t = time * 0.001;

    // Draw connections
    connections.forEach((c) => {
      const a = neurons[c.from], b = neurons[c.to];
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      const alpha = 0.08 + 0.06 * Math.sin(t * 2 + c.progress * Math.PI * 4);
      ctx.strokeStyle = `rgba(6,182,212,${alpha})`;
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // Traveling pulse
      c.progress = (c.progress + 0.003) % 1;
      const px = a.x + (b.x - a.x) * c.progress;
      const py = a.y + (b.y - a.y) * c.progress;
      ctx.beginPath();
      ctx.arc(px, py, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(6,182,212,${0.3 + 0.3 * Math.sin(t * 3 + c.progress * 10)})`;
      ctx.fill();
    });

    // Draw neurons
    neurons.forEach((n) => {
      n.pulse += n.speed;
      const glow = 0.3 + 0.3 * Math.sin(n.pulse);

      // Outer glow
      const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 3);
      grad.addColorStop(0, `rgba(6,182,212,${glow * 0.3})`);
      grad.addColorStop(1, 'rgba(6,182,212,0)');
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r * 3, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Core
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(6,182,212,${0.5 + glow * 0.5})`;
      ctx.fill();
    });

    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
}

// ─── Keyboard Handler ───
document.addEventListener('keydown', (event) => {
  const tag = document.activeElement?.tagName;
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) return;

  // Global shortcuts
  if ((event.key === 't' || event.key === 'T') && !event.ctrlKey && !event.metaKey) {
    event.preventDefault();
    toggleTheme();
    return;
  }
  if ((event.key === 'v' || event.key === 'V') && event.shiftKey) {
    event.preventDefault();
    openVoiceModal();
    return;
  }
  if ((event.ctrlKey && event.shiftKey && (event.key === 'n' || event.key === 'N')) ||
      (event.key === 'b' && !state.session && !state.noScreen)) {
    event.preventDefault();
    toggleNoScreen();
    return;
  }

  // ════ Eyes-Free / No-Screen Mode Keyboard Controls ════
  if (state.noScreen && state.session && !state.session.finished) {
    event.preventDefault();
    const idx = state.currentQuestionIndex;
    const cards = $('#question-list')?.children;
    const totalQ = state.session.questions.length;

    // Confidence setting
    if (state.waitingConfidence && /^[1-5]$/.test(event.key)) {
      const confVal = Number(event.key);
      state.session.confidence[idx] = confVal;
      state.waitingConfidence = false;
      playEarcon('select');
      speakText(`Confidence recorded as ${confVal}.`);
      return;
    }

    // Number option selection: 1 to 4
    if (/^[1-4]$/.test(event.key)) {
      if (cards && cards[idx]) {
        chooseAnswer(cards[idx], Number(event.key) - 1);
      }
      return;
    }

    // Letter option selection: A, B, C, D
    const letterMatch = event.key.toLowerCase();
    if (['a', 'b', 'c', 'd'].includes(letterMatch) && !event.ctrlKey && !event.altKey) {
      // Check if 'b' was meant for blackout or option B
      // If user presses B when question has options, we can support either option B or blackout via Shift+B
      const optIdx = letterMatch.charCodeAt(0) - 97;
      if (cards && cards[idx] && optIdx < state.session.questions[idx].options.length) {
        chooseAnswer(cards[idx], optIdx);
        return;
      }
    }

    switch (letterMatch) {
      case 'n':
      case 'arrowright':
      case 'j':
        state.currentQuestionIndex = Math.min(idx + 1, totalQ - 1);
        updateNoScreenStatus();
        playEarcon('advance');
        speakQuestion(state.currentQuestionIndex, false);
        return;
      case 'p':
      case 'arrowleft':
      case 'k':
        state.currentQuestionIndex = Math.max(idx - 1, 0);
        updateNoScreenStatus();
        playEarcon('advance');
        speakQuestion(state.currentQuestionIndex, false);
        return;
      case 'r':
        playEarcon('select');
        speakQuestion(idx, false);
        return;
      case 'q':
        playEarcon('select');
        speakQuestionPromptOnly(idx);
        return;
      case 'o':
        playEarcon('select');
        speakOptionsOnly(idx);
        return;
      case 'e':
      case 'x':
        playEarcon('select');
        speakExplanation(idx);
        return;
      case 'w':
        playEarcon('select');
        speakMisconceptionWeedOut(idx);
        return;
      case 'h':
        playEarcon('select');
        speakHint(idx);
        return;
      case ' ':
        if ('speechSynthesis' in window) {
          if (window.speechSynthesis.paused) window.speechSynthesis.resume();
          else if (window.speechSynthesis.speaking) window.speechSynthesis.pause();
          else speakQuestion(idx, false);
        }
        return;
      case 's':
        state.currentQuestionIndex = Math.min(idx + 1, totalQ - 1);
        updateNoScreenStatus();
        playEarcon('advance');
        speakText('Skipped.');
        setTimeout(() => speakQuestion(state.currentQuestionIndex, false), 500);
        return;
      case 'c':
        state.waitingConfidence = true;
        speakText('Metacognitive confidence check. Press 1 for low certainty, up to 5 for absolute certainty.');
        return;
      case 'enter':
        finishSession();
        return;
      case 'escape':
        toggleNoScreen();
        return;
    }

    if (event.key === 'F9' || (event.key === 'b' && event.shiftKey)) {
      toggleBlackoutMode();
      return;
    }

    return;
  }

  // ════ Visual Mode Quiz Keyboard Controls ════
  if (state.session && !state.session.finished && !$('#quiz-view')?.classList.contains('hidden')) {
    const currentIdx = state.session.answers.findIndex((a) => a === null);
    const activeIdx = currentIdx >= 0 ? currentIdx : state.currentQuestionIndex;
    const cards = $('#question-list')?.children;

    if (state.waitingConfidence && /^[1-5]$/.test(event.key)) {
      event.preventDefault();
      state.session.confidence[activeIdx] = Number(event.key);
      state.waitingConfidence = false;
      const confBtns = cards[activeIdx]?.querySelectorAll('.confidence-button');
      if (confBtns) confBtns.forEach((b) => b.classList.toggle('selected', Number(b.dataset.confidence) === Number(event.key)));
      playEarcon('select');
      showToast(`Confidence: ${event.key}/5`);
      return;
    }

    // Numbers 1-4 for options
    if (/^[1-4]$/.test(event.key) && activeIdx >= 0 && cards && cards[activeIdx]) {
      event.preventDefault();
      chooseAnswer(cards[activeIdx], Number(event.key) - 1);
      return;
    }

    // Letters A-D for options
    const keyLower = event.key.toLowerCase();
    if (['a', 'b', 'c', 'd'].includes(keyLower) && !event.ctrlKey && !event.altKey) {
      const optIdx = keyLower.charCodeAt(0) - 97;
      if (activeIdx >= 0 && cards && cards[activeIdx] && optIdx < state.session.questions[activeIdx].options.length) {
        event.preventDefault();
        chooseAnswer(cards[activeIdx], optIdx);
        return;
      }
    }

    switch (keyLower) {
      case 'v':
        event.preventDefault(); toggleVoiceMode(); return;
      case ' ':
        event.preventDefault(); speakQuestion(activeIdx, state.voiceMode); return;
      case 'n':
      case 'arrowright':
      case 'j':
        event.preventDefault();
        if (state.currentQuestionIndex < state.session.questions.length - 1) {
          state.currentQuestionIndex += 1;
          scrollToQuestion(state.currentQuestionIndex);
          playEarcon('advance');
          if (state.voiceMode) speakQuestion(state.currentQuestionIndex);
        }
        return;
      case 'p':
      case 'arrowleft':
      case 'k':
        event.preventDefault();
        if (state.currentQuestionIndex > 0) {
          state.currentQuestionIndex -= 1;
          scrollToQuestion(state.currentQuestionIndex);
          playEarcon('advance');
          if (state.voiceMode) speakQuestion(state.currentQuestionIndex);
        }
        return;
      case 'r':
        event.preventDefault(); speakQuestion(state.currentQuestionIndex, state.voiceMode); return;
      case 'e':
      case 'x':
        event.preventDefault(); speakExplanation(state.currentQuestionIndex); return;
      case 'w':
        event.preventDefault(); speakMisconceptionWeedOut(state.currentQuestionIndex); return;
      case 'h':
        event.preventDefault(); speakHint(state.currentQuestionIndex); return;
      case 's':
        event.preventDefault();
        if (state.currentQuestionIndex < state.session.questions.length - 1) {
          state.currentQuestionIndex += 1;
          scrollToQuestion(state.currentQuestionIndex);
          showToast('Question skipped');
        }
        return;
      case 'c':
        event.preventDefault();
        state.waitingConfidence = true;
        showToast('Set confidence (1–5)');
        return;
      case 'enter':
        event.preventDefault(); finishSession(); return;
      case 'escape':
        event.preventDefault();
        if (state.recognition) state.recognition.abort();
        showSetup();
        return;
    }
  }
});

// ─── Event Listeners ───
function setupEventListeners() {
  // Navigation
  $$('.nav-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(link.dataset.nav);
    });
  });

  // Theme
  $('#theme-toggle')?.addEventListener('click', toggleTheme);

  // Voice & Audio Modal triggers
  $('#voice-modal-btn')?.addEventListener('click', openVoiceModal);
  $('#ns-voice-quick')?.addEventListener('click', openVoiceModal);
  $('#voice-modal-close')?.addEventListener('click', closeVoiceModal);
  $('#voice-modal-save')?.addEventListener('click', closeVoiceModal);
  $('#modal-voice-test')?.addEventListener('click', testVoiceAudio);

  // Audio controls synchronization
  $('#modal-voice-select')?.addEventListener('change', (e) => {
    state.audioSettings.voiceId = e.target.value;
    const sel = $('#voice-select');
    if (sel) sel.value = e.target.value;
    saveAudioSettings();
  });
  $('#voice-select')?.addEventListener('change', (e) => {
    state.audioSettings.voiceId = e.target.value;
    const modalSel = $('#modal-voice-select');
    if (modalSel) modalSel.value = e.target.value;
    saveAudioSettings();
  });

  $('#modal-speech-speed')?.addEventListener('input', (e) => {
    state.audioSettings.rate = Number(e.target.value);
    $('#modal-speed-val').textContent = `${state.audioSettings.rate.toFixed(2)}×`;
    const speedInput = $('#speech-speed');
    if (speedInput) speedInput.value = state.audioSettings.rate;
    const speedVal = $('#speech-speed-value');
    if (speedVal) speedVal.textContent = `${state.audioSettings.rate.toFixed(2)}×`;
    saveAudioSettings();
  });
  $('#speech-speed')?.addEventListener('input', (e) => {
    state.audioSettings.rate = Number(e.target.value);
    $('#speech-speed-value').textContent = `${state.audioSettings.rate.toFixed(2)}×`;
    const mSpeed = $('#modal-speech-speed');
    if (mSpeed) mSpeed.value = state.audioSettings.rate;
    const mSpeedVal = $('#modal-speed-val');
    if (mSpeedVal) mSpeedVal.textContent = `${state.audioSettings.rate.toFixed(2)}×`;
    saveAudioSettings();
  });

  $('#modal-speech-pitch')?.addEventListener('input', (e) => {
    state.audioSettings.pitch = Number(e.target.value);
    $('#modal-pitch-val').textContent = state.audioSettings.pitch.toFixed(2);
    saveAudioSettings();
  });
  $('#modal-speech-volume')?.addEventListener('input', (e) => {
    state.audioSettings.volume = Number(e.target.value);
    $('#modal-volume-val').textContent = `${Math.round(state.audioSettings.volume * 100)}%`;
    saveAudioSettings();
  });
  $('#earcon-toggle')?.addEventListener('change', (e) => {
    state.audioSettings.earcons = e.target.checked;
    saveAudioSettings();
    if (e.target.checked) playEarcon('correct');
  });
  $('#auto-speak-toggle')?.addEventListener('change', (e) => {
    state.audioSettings.autoSpeak = e.target.checked;
    saveAudioSettings();
  });

  // No-screen buttons
  $('#no-screen-btn')?.addEventListener('click', toggleNoScreen);
  $('#ns-blackout-toggle')?.addEventListener('click', toggleBlackoutMode);

  // Hero buttons
  $('#hero-start')?.addEventListener('click', () => navigateTo('study'));
  $('#hero-due')?.addEventListener('click', () => {
    navigateTo('study');
    const dueRadio = document.querySelector('input[name="mode"][value="due"]');
    if (dueRadio) dueRadio.checked = true;
    startSession().catch((e) => showToast(e.message));
  });

  // Misconception Section actions
  $('#drill-misconceptions-btn')?.addEventListener('click', () => {
    navigateTo('study');
    const discRadio = document.querySelector('input[name="mode"][value="misconceptions"]');
    if (discRadio) discRadio.checked = true;
    startSession().catch((e) => showToast(e.message));
  });

  // Misconception filter chips
  $$('.misconception-filter-bar .chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      $$('.misconception-filter-bar .chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      state.misconceptionFilter = chip.dataset.filter;
      renderMisconceptions();
    });
  });

  // Single misconception rehearsal click
  $('#misconception-list')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.drill-single-btn');
    if (!btn) return;
    const qid = btn.dataset.qid;
    const q = state.available.find((item) => item.id === qid) || state.misconceptions[qid]?.question;
    if (q) {
      state.lastFilters = { title: `Misconception Drill: ${labelize(q.subject)}`, questions: [q] };
      state.session = {
        questions: [q],
        answers: [null],
        confidence: [null],
        mode: 'practice',
        finished: false,
      };
      state.currentQuestionIndex = 0;
      $$('.section-view').forEach((el) => el.classList.add('hidden'));
      $('#quiz-view').classList.remove('hidden');
      $('#quiz-kicker').textContent = 'Targeted Cognitive Drill';
      $('#quiz-title').textContent = `${labelize(q.subject)} intuition repair`;
      $('#question-list').innerHTML = renderQuestion(q, 0);
      updateQuizProgress();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  // Filters
  $('#source-filter')?.addEventListener('change', () => refreshFilters());
  $('#collection-filter')?.addEventListener('change', () => refreshFilters('collection'));
  $('#subject-filter')?.addEventListener('change', () => refreshFilters('subject'));
  $('#topic-filter')?.addEventListener('change', updateMatches);
  $('#year-filter')?.addEventListener('change', updateMatches);

  // Start session
  $('#start-button')?.addEventListener('click', () => startSession().catch((e) => { $('#match-count').textContent = e.message; $('#start-button').disabled = false; }));

  // Due button
  $('#due-button')?.addEventListener('click', () => {
    const dueRadio = document.querySelector('input[name="mode"][value="due"]');
    if (dueRadio) dueRadio.checked = true;
    navigateTo('study');
    startSession().catch((e) => showToast(e.message));
  });

  // Voice toggle in quiz view
  $('#voice-toggle')?.addEventListener('click', toggleVoiceMode);
  $('#voice-preview')?.addEventListener('click', testVoiceAudio);

  // Quiz interactions
  $('#submit-button')?.addEventListener('click', finishSession);
  $('#exit-button')?.addEventListener('click', showSetup);
  $('#new-session-button')?.addEventListener('click', showSetup);
  $('#retry-button')?.addEventListener('click', () => startSession().catch((e) => showToast(e.message)));

  // Question list event delegation
  $('#question-list')?.addEventListener('click', (event) => {
    const confBtn = event.target.closest('.confidence-button');
    if (confBtn) {
      setConfidence(Number(confBtn.dataset.confidenceIndex), Number(confBtn.dataset.confidence), confBtn);
      return;
    }
    const listenBtn = event.target.closest('.listen-button');
    if (listenBtn) { speakQuestion(Number(listenBtn.dataset.voiceIndex), false); return; }
    const answerVoiceBtn = event.target.closest('.answer-voice-button');
    if (answerVoiceBtn) { listenForAnswer(Number(answerVoiceBtn.dataset.voiceAnswerIndex), answerVoiceBtn); return; }
    const option = event.target.closest('.option');
    if (option) chooseAnswer(option.closest('.question-card'), Number(option.dataset.optionIndex));
  });

  // Graph controls
  $('#graph-reset')?.addEventListener('click', () => {
    state.graphScale = 1;
    state.graphOffset = { x: 0, y: 0 };
    renderKnowledgeGraph();
  });
  $('#graph-zoom-in')?.addEventListener('click', () => {
    state.graphScale = Math.min(2.2, (state.graphScale || 1) + 0.25);
    renderKnowledgeGraph();
  });
  $('#graph-zoom-out')?.addEventListener('click', () => {
    state.graphScale = Math.max(0.55, (state.graphScale || 1) - 0.25);
    renderKnowledgeGraph();
  });
  $('#graph-search')?.addEventListener('input', (e) => {
    state.graphSearch = e.target.value;
    renderKnowledgeGraph();
  });
  $('#graph-filter')?.addEventListener('change', renderKnowledgeGraph);

  // Inspector card actions
  $('#inspector-close')?.addEventListener('click', () => {
    $('#graph-inspector')?.classList.add('hidden');
    state.graphSelectedNode = null;
  });
  $('#inspector-drill-btn')?.addEventListener('click', () => {
    const node = state.graphSelectedNode;
    if (!node) return;
    navigateTo('study');
    const sf = $('#subject-filter');
    if (sf) {
      for (const opt of sf.options) {
        if (labelize(opt.value) === node.label || opt.value === node.id) {
          sf.value = opt.value;
          refreshFilters('subject');
          break;
        }
      }
    }
    showToast(`Session filtered to ${node.label}`);
  });

  // Voice init
  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = refreshVoices;
    refreshVoices();
  }
}

// ─── SVG Gradient for Score Ring ───
function injectScoreGradient() {
  const svg = document.querySelector('.score-svg');
  if (!svg) return;
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
  grad.id = 'score-gradient';
  grad.setAttribute('x1', '0%'); grad.setAttribute('y1', '0%');
  grad.setAttribute('x2', '100%'); grad.setAttribute('y2', '100%');
  const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  stop1.setAttribute('offset', '0%'); stop1.setAttribute('stop-color', '#06b6d4');
  const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  stop2.setAttribute('offset', '50%'); stop2.setAttribute('stop-color', '#8b5cf6');
  const stop3 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  stop3.setAttribute('offset', '100%'); stop3.setAttribute('stop-color', '#ec4899');
  grad.appendChild(stop1); grad.appendChild(stop2); grad.appendChild(stop3);
  defs.appendChild(grad); svg.insertBefore(defs, svg.firstChild);
}

// ─── Initialization ───
async function init() {
  initTheme();
  loadAudioSettings();
  injectScoreGradient();
  setupEventListeners();
  animateBrainCanvas();

  try {
    loadLearning();
    loadMisconceptions();
    await loadBanks();

    const boardQuestionCount = state.boardCatalog.reduce((t, s) => t + s.totalQuestions, 0);
    $('#stat-questions').textContent = (state.available.length + boardQuestionCount).toLocaleString();
    $('#stat-banks').textContent = state.banks.length;
    $('#stat-subjects').textContent = new Set([
      ...state.available.map((q) => `${q.source}:${q.subject}`),
      ...state.boardCatalog.map((q) => `board:${q.board}:${q.subject}`),
    ]).size;

    $('#load-status').textContent = 'Ready';
    $('.status-dot').classList.remove('pulsing');
    $('.status-dot').classList.add('ready');

    fillSelect($('#source-filter'), state.banks.map((b) => b.id), 'All banks');
    const sourceOpts = $('#source-filter').options;
    if (sourceOpts[1]) sourceOpts[1].textContent = state.banks[0].label;
    if (sourceOpts[2]) sourceOpts[2].textContent = state.banks[1].label;

    refreshFilters();
    renderRecent();
    renderLearningDashboard();
    renderHistory();
    renderMisconceptions();

    showToast('NeuroPrep ready — cognitive engines online');
  } catch (error) {
    $('#load-status').textContent = 'Error loading data';
    $('#match-count').textContent = error.message;
    console.error('NeuroPrep init error:', error);
  }
}

init();