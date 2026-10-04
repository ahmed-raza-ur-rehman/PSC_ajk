/* NeuroPrep Command Center — modular productivity and study utilities. */
(() => {
  'use strict';
  const KEY = 'neuroprep-command-center-v1';
  const safe = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const today = () => new Date().toISOString().slice(0, 10);
  const uid = (prefix = 'item') => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const read = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
  };
  const defaults = {
    goals: { daily: 20, weekly: 100 },
    completed: {},
    bookmarks: [],
    notes: [],
    queue: [],
    sessions: [],
    tags: [],
    lastSeen: today(),
    streak: 0,
    xp: 0,
    activeTab: 'overview',
    filters: { subject: 'all', difficulty: 'all', type: 'all' },
  };
  const data = { ...defaults, ...read() };
  data.goals = { ...defaults.goals, ...(data.goals || {}) };
  data.completed = data.completed || {};
  data.bookmarks = data.bookmarks || [];
  data.notes = data.notes || [];
  data.queue = data.queue || [];
  data.sessions = data.sessions || [];
  let timer = null;
  let timerSeconds = 25 * 60;
  let timerMode = 'focus';
  let activeQuestion = null;

  function save() { localStorage.setItem(KEY, JSON.stringify(data)); }
  function notify(message, tone = 'success') {
    const toast = $('#toast');
    if (toast) { toast.textContent = message; toast.dataset.tone = tone; toast.classList.remove('hidden'); clearTimeout(notify.timer); notify.timer = setTimeout(() => toast.classList.add('hidden'), 3200); }
    document.dispatchEvent(new CustomEvent('neuroprep:notice', { detail: { message, tone } }));
  }
  function questionBank() {
    const source = window.state?.available || window.state?.banks?.flatMap((bank) => bank.questions || []) || [];
    return source.filter(Boolean);
  }
  function normalizeQuestion(question, index) {
    return {
      id: question.id || question._id || `question-${index}`,
      prompt: question.question || question.prompt || question.text || 'Untitled question',
      answer: question.answer || question.correctAnswer || question.correct || '',
      subject: question.subject || question.category || question.topic || 'General',
      difficulty: question.difficulty || question.level || 'Core',
      explanation: question.explanation || question.rationale || '',
      options: question.options || question.choices || [],
      tags: question.tags || [],
    };
  }
  function getQuestions() { return questionBank().map(normalizeQuestion); }
  function completedToday() { return Number(data.completed[today()] || 0); }
  function updateStreak() {
    const dates = Object.keys(data.completed).filter((date) => data.completed[date] > 0).sort();
    let streak = 0; let cursor = new Date();
    for (let i = dates.length - 1; i >= 0; i -= 1) {
      const date = cursor.toISOString().slice(0, 10);
      if (dates[i] === date) { streak += 1; cursor.setDate(cursor.getDate() - 1); } else if (dates[i] < date) break;
    }
    data.streak = streak;
    return streak;
  }
  function recordProgress(amount = 1, kind = 'recall') {
    const key = today();
    data.completed[key] = completedToday() + amount;
    data.xp += amount * (kind === 'correct' ? 12 : 5);
    data.sessions.unshift({ id: uid('session'), date: new Date().toISOString(), amount, kind });
    data.sessions = data.sessions.slice(0, 100);
    updateStreak(); save(); renderCommandCenter();
  }
  function subjects() {
    const values = getQuestions().map((question) => question.subject).filter(Boolean);
    return [...new Set(values)].sort((a, b) => a.localeCompare(b));
  }
  function queueQuestions() {
    const questions = getQuestions();
    const filtered = questions.filter((question) => {
      const subjectMatch = data.filters.subject === 'all' || question.subject === data.filters.subject;
      const difficultyMatch = data.filters.difficulty === 'all' || question.difficulty === data.filters.difficulty;
      return subjectMatch && difficultyMatch;
    });
    return filtered.sort((a, b) => (data.bookmarks.some((item) => item.id === b.id) ? 1 : 0) - (data.bookmarks.some((item) => item.id === a.id) ? 1 : 0));
  }
  function renderMetric(label, value, detail, tone = '') { return `<div class="cc-metric ${tone}"><span>${safe(label)}</span><strong>${safe(value)}</strong><small>${safe(detail)}</small></div>`; }
  function renderProgressRing(percent) { return `<div class="cc-ring" style="--progress:${Math.min(percent, 100)}%"><span>${Math.round(percent)}%</span></div>`; }
  function renderOverview() {
    const done = completedToday(); const goal = Number(data.goals.daily) || 20; const percent = (done / goal) * 100;
    const questions = getQuestions(); const due = Number(window.state?.learning ? Object.values(window.state.learning).filter((item) => item.due && item.due <= Date.now()).length : 0);
    const recent = data.sessions.slice(0, 5);
    return `<div class="cc-overview-grid"><section class="cc-card cc-daily-card"><div class="cc-card-heading"><div><span class="cc-kicker">Today’s protocol</span><h3>Build a reliable recall loop</h3></div>${renderProgressRing(percent)}</div><p class="cc-muted">Complete a small, focused set instead of chasing an arbitrary marathon. Your target resets at midnight.</p><div class="cc-goal-bar"><span style="width:${Math.min(percent, 100)}%"></span></div><div class="cc-goal-row"><b>${done} / ${goal} recalls</b><button class="cc-text-button" data-action="edit-goal">Edit goal</button></div><div class="cc-action-row"><button class="btn btn-primary" data-action="start-quick">Start 10-question sprint</button><button class="btn btn-outline" data-action="open-queue">Open queue</button></div></section><section class="cc-card"><div class="cc-card-heading"><div><span class="cc-kicker">Readiness pulse</span><h3>Your study system</h3></div><span class="cc-status-dot">Live</span></div><div class="cc-metrics">${renderMetric('Question bank', questions.length || '—', 'available now')}${renderMetric('Due reviews', due || 0, 'retrieval priority', due ? 'warning' : 'good')}${renderMetric('Current streak', `${data.streak}d`, 'consistency signal', data.streak > 2 ? 'good' : '')}</div><div class="cc-insight"><span class="cc-insight-icon">i</span><p><b>Next best action:</b> ${due ? 'clear your due reviews before learning new material.' : 'run a short mixed sprint to keep interleaving active.'}</p></div></section></div><section class="cc-card cc-activity-card"><div class="cc-card-heading"><div><span class="cc-kicker">Recent activity</span><h3>Momentum ledger</h3></div><button class="cc-text-button" data-action="clear-activity">Clear</button></div>${recent.length ? `<div class="cc-activity-list">${recent.map((item) => `<div class="cc-activity"><span class="cc-activity-mark">${item.kind === 'correct' ? '✓' : '↗'}</span><div><b>${item.amount} ${item.kind === 'correct' ? 'correct recall' : 'practice'}${item.amount === 1 ? '' : 's'}</b><small>${new Date(item.date).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</small></div><span class="cc-xp">+${item.amount * (item.kind === 'correct' ? 12 : 5)} XP</span></div>`).join('')}</div>` : `<div class="cc-empty"><b>Your ledger is quiet.</b><span>Start a sprint and your progress will appear here.</span></div>`}</section>`;
  }
  function renderQueue() {
    const questions = queueQuestions();
    return `<section class="cc-card cc-queue-card"><div class="cc-card-heading"><div><span class="cc-kicker">Adaptive queue</span><h3>Choose what earns your attention</h3></div><span class="cc-count">${questions.length} items</span></div><div class="cc-filter-row"><label>Subject<select data-filter="subject"><option value="all">All subjects</option>${subjects().map((subject) => `<option value="${safe(subject)}" ${data.filters.subject === subject ? 'selected' : ''}>${safe(subject)}</option>`).join('')}</select></label><label>Difficulty<select data-filter="difficulty"><option value="all">All levels</option><option value="easy" ${data.filters.difficulty === 'easy' ? 'selected' : ''}>Easy</option><option value="medium" ${data.filters.difficulty === 'medium' ? 'selected' : ''}>Medium</option><option value="hard" ${data.filters.difficulty === 'hard' ? 'selected' : ''}>Hard</option></select></label><button class="btn btn-outline cc-filter-reset" data-action="reset-filters">Reset</button></div>${questions.length ? `<div class="cc-question-list">${questions.slice(0, 12).map((question, index) => renderQuestionRow(question, index)).join('')}</div>` : `<div class="cc-empty"><b>No questions match this filter.</b><span>Try a broader queue or load a question bank.</span></div>`}</section>`;
  }
  function renderQuestionRow(question, index) {
    const marked = data.bookmarks.some((item) => item.id === question.id);
    const queued = data.queue.some((item) => item.id === question.id);
    return `<article class="cc-question-row"><div class="cc-question-number">${String(index + 1).padStart(2, '0')}</div><div class="cc-question-copy"><div class="cc-chip-row"><span class="cc-chip">${safe(question.subject)}</span><span class="cc-chip cc-chip-muted">${safe(question.difficulty)}</span></div><h4>${safe(question.prompt)}</h4><p>${safe(question.explanation || 'Use active recall first. Reveal the explanation only after committing to an answer.')}</p></div><div class="cc-question-actions"><button class="cc-icon-action ${marked ? 'is-active' : ''}" data-action="bookmark" data-id="${safe(question.id)}" aria-label="${marked ? 'Remove bookmark' : 'Bookmark question'}">${marked ? '★' : '☆'}</button><button class="btn btn-sm ${queued ? 'btn-primary' : 'btn-outline'}" data-action="queue" data-id="${safe(question.id)}">${queued ? 'Queued' : 'Add to queue'}</button></div></article>`;
  }
  function renderBookmarks() {
    return `<section class="cc-card"><div class="cc-card-heading"><div><span class="cc-kicker">Deliberate practice</span><h3>Saved for a reason</h3></div><span class="cc-count">${data.bookmarks.length} saved</span></div>${data.bookmarks.length ? `<div class="cc-question-list">${data.bookmarks.map((question, index) => renderQuestionRow(question, index)).join('')}</div>` : `<div class="cc-empty"><b>Nothing saved yet.</b><span>Bookmark a difficult or high-value prompt from the adaptive queue.</span><button class="btn btn-outline" data-action="open-queue">Browse queue</button></div>`}</section>`;
  }
  function renderNotes() {
    return `<section class="cc-card cc-notes-card"><div class="cc-card-heading"><div><span class="cc-kicker">Externalize the model</span><h3>Study notes</h3></div><button class="btn btn-outline btn-sm" data-action="new-note">New note</button></div><div class="cc-note-editor hidden" id="cc-note-editor"><input id="cc-note-title" placeholder="Note title" maxlength="80"><textarea id="cc-note-body" placeholder="Capture the rule, connection, or question you want future-you to retrieve..." maxlength="1000"></textarea><div class="cc-action-row"><button class="btn btn-primary btn-sm" data-action="save-note">Save note</button><button class="btn btn-ghost btn-sm" data-action="cancel-note">Cancel</button></div></div><div class="cc-notes-grid">${data.notes.length ? data.notes.map((note) => `<article class="cc-note"><div class="cc-note-top"><span class="cc-chip">${safe(note.tag || 'Personal')}</span><button class="cc-icon-action" data-action="delete-note" data-id="${safe(note.id)}" aria-label="Delete note">×</button></div><h4>${safe(note.title)}</h4><p>${safe(note.body)}</p><small>${new Date(note.updatedAt).toLocaleDateString()}</small></article>`).join('') : `<div class="cc-empty"><b>Notes are a retrieval tool, not a transcript.</b><span>Write one explanation in your own words to strengthen encoding.</span></div>`}</div></section>`;
  }
  function renderTimer() {
    const mins = String(Math.floor(timerSeconds / 60)).padStart(2, '0'); const secs = String(timerSeconds % 60).padStart(2, '0');
    return `<section class="cc-card cc-timer-card"><div><span class="cc-kicker">Ultradian focus block</span><h3>${timerMode === 'focus' ? 'Protected focus' : 'Recovery break'}</h3><p class="cc-muted">A timer creates a clear start and stop, reducing decision fatigue.</p></div><div class="cc-timer-display" aria-live="polite">${mins}:${secs}</div><div class="cc-timer-controls"><button class="btn btn-primary" data-action="timer-toggle">${timer ? 'Pause timer' : 'Start timer'}</button><button class="btn btn-outline" data-action="timer-reset">Reset</button><button class="btn btn-ghost" data-action="timer-switch">Switch to ${timerMode === 'focus' ? 'break' : 'focus'}</button></div></section>`;
  }
  function renderCenter() {
    const host = $('#command-center'); if (!host) return;
    const tabs = [['overview', 'Overview'], ['queue', 'Adaptive queue'], ['bookmarks', `Saved (${data.bookmarks.length})`], ['notes', 'Notes'], ['focus', 'Focus timer']];
    host.innerHTML = `<div class="cc-shell"><div class="cc-header"><div><span class="eyebrow">Command center</span><h2 class="section-title">Turn intention into <span class="gradient-text">consistent recall</span>.</h2><p class="section-subtitle">A lightweight control surface for the next best study action, without burying you in dashboards.</p></div><div class="cc-header-actions"><span class="cc-xp-pill">${data.xp} XP</span><button class="btn btn-outline btn-sm" data-action="export-data">Export data</button><button class="btn btn-ghost btn-sm" data-action="reset-center">Reset center</button></div></div><div class="cc-tabs" role="tablist">${tabs.map(([id, label]) => `<button role="tab" aria-selected="${data.activeTab === id}" class="cc-tab ${data.activeTab === id ? 'is-active' : ''}" data-tab="${id}">${label}</button>`).join('')}</div><div class="cc-tab-panel">${data.activeTab === 'overview' ? renderOverview() : ''}${data.activeTab === 'queue' ? renderQueue() : ''}${data.activeTab === 'bookmarks' ? renderBookmarks() : ''}${data.activeTab === 'notes' ? renderNotes() : ''}${data.activeTab === 'focus' ? renderTimer() : ''}</div></div>`;
    bindCenter(host);
  }
  function renderCommandCenter() { if ($('#command-center')) renderCenter(); }
  function openStudyWithQuestions(items) {
    const app = window.startSession || window.beginSession || window.startStudy;
    if (typeof app === 'function') { app(items); notify('Study session prepared'); return; }
    const link = $('[data-nav="study"]'); if (link) link.click(); else notify('Study area is ready from the navigation');
  }
  function bindCenter(host) {
    $$('.cc-tab', host).forEach((button) => button.addEventListener('click', () => { data.activeTab = button.dataset.tab; save(); renderCenter(); }));
    $$('[data-filter]', host).forEach((control) => control.addEventListener('change', () => { data.filters[control.dataset.filter] = control.value; save(); renderCenter(); }));
    $$('[data-action]', host).forEach((button) => button.addEventListener('click', () => handleAction(button.dataset.action, button)));
  }
  function handleAction(action, button) {
    const id = button?.dataset.id;
    if (action === 'start-quick') { const items = queueQuestions().slice(0, 10); openStudyWithQuestions(items); recordProgress(0, 'sprint-start'); return; }
    if (action === 'open-queue') { data.activeTab = 'queue'; save(); renderCenter(); return; }
    if (action === 'bookmark') { const question = getQuestions().find((item) => item.id === id); if (!question) return; const existing = data.bookmarks.findIndex((item) => item.id === id); if (existing >= 0) { data.bookmarks.splice(existing, 1); notify('Removed from saved questions'); } else { data.bookmarks.unshift(question); notify('Saved for deliberate practice'); } save(); renderCenter(); return; }
    if (action === 'queue') { const question = getQuestions().find((item) => item.id === id); if (!question) return; const existing = data.queue.findIndex((item) => item.id === id); if (existing >= 0) { data.queue.splice(existing, 1); notify('Removed from queue'); } else { data.queue.push(question); notify('Added to your queue'); } save(); renderCenter(); return; }
    if (action === 'reset-filters') { data.filters = { subject: 'all', difficulty: 'all', type: 'all' }; save(); renderCenter(); return; }
    if (action === 'edit-goal') { const value = window.prompt('Daily recall target', data.goals.daily); const numeric = Number(value); if (numeric > 0 && numeric <= 500) { data.goals.daily = Math.round(numeric); save(); renderCenter(); notify('Daily target updated'); } return; }
    if (action === 'new-note') { $('#cc-note-editor')?.classList.remove('hidden'); $('#cc-note-title')?.focus(); return; }
    if (action === 'cancel-note') { $('#cc-note-editor')?.classList.add('hidden'); return; }
    if (action === 'save-note') { const title = $('#cc-note-title')?.value.trim(); const body = $('#cc-note-body')?.value.trim(); if (!title || !body) { notify('Add a title and note before saving', 'warning'); return; } data.notes.unshift({ id: uid('note'), title, body, tag: 'Personal', updatedAt: new Date().toISOString() }); save(); renderCenter(); notify('Note saved'); return; }
    if (action === 'delete-note') { data.notes = data.notes.filter((note) => note.id !== id); save(); renderCenter(); notify('Note deleted'); return; }
    if (action === 'clear-activity') { data.sessions = []; save(); renderCenter(); notify('Activity cleared'); return; }
    if (action === 'timer-toggle') { toggleTimer(); return; }
    if (action === 'timer-reset') { stopTimer(); timerSeconds = timerMode === 'focus' ? 25 * 60 : 5 * 60; renderCenter(); return; }
    if (action === 'timer-switch') { stopTimer(); timerMode = timerMode === 'focus' ? 'break' : 'focus'; timerSeconds = timerMode === 'focus' ? 25 * 60 : 5 * 60; renderCenter(); return; }
    if (action === 'export-data') { exportData(); return; }
    if (action === 'reset-center') { if (window.confirm('Reset command center data? This does not delete study banks.')) { localStorage.removeItem(KEY); Object.assign(data, structuredClone(defaults)); renderCenter(); notify('Command center reset'); } return; }
  }
  function toggleTimer() {
    if (timer) { stopTimer(); renderCenter(); notify('Focus timer paused', 'warning'); return; }
    timer = setInterval(() => { timerSeconds -= 1; if (timerSeconds <= 0) { stopTimer(); recordProgress(1, 'focus'); timerSeconds = timerMode === 'focus' ? 5 * 60 : 25 * 60; timerMode = timerMode === 'focus' ? 'break' : 'focus'; notify(`${timerMode === 'focus' ? 'Break complete' : 'Focus block complete'}`); } renderCenter(); }, 1000);
    renderCenter(); notify(`${timerMode === 'focus' ? 'Focus block' : 'Break'} started`);
  }
  function stopTimer() { if (timer) clearInterval(timer); timer = null; }
  function exportData() {
    const payload = { exportedAt: new Date().toISOString(), version: 1, ...data };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `neurop​​rep-study-data-${today()}.json`; anchor.click(); URL.revokeObjectURL(url); notify('Study data exported');
  }
  function addCenterMarkup() {
    if ($('#command-center')) return;
    const dashboard = $('#dashboard-section'); if (!dashboard) return;
    const anchor = document.createElement('div'); anchor.id = 'command-center'; anchor.setAttribute('aria-label', 'Study command center');
    const target = $('.optimizer-strip', dashboard); if (target) target.insertAdjacentElement('afterend', anchor); else dashboard.append(anchor);
  }
  function bindGlobalShortcuts() {
    document.addEventListener('keydown', (event) => {
      if (event.target.matches('input, textarea, select')) return;
      if (event.key.toLowerCase() === 'j') { data.activeTab = 'queue'; save(); renderCenter(); }
      if (event.key.toLowerCase() === 'b') { data.activeTab = 'bookmarks'; save(); renderCenter(); }
      if (event.key.toLowerCase() === 'n') { data.activeTab = 'notes'; save(); renderCenter(); }
      if (event.key.toLowerCase() === 'f') { data.activeTab = 'focus'; save(); renderCenter(); }
    });
  }
  function observeProgress() {
    document.addEventListener('neuroprep:answer', (event) => recordProgress(1, event.detail?.correct ? 'correct' : 'recall'));
    document.addEventListener('neuroprep:session-complete', (event) => { const count = Number(event.detail?.count || 0); if (count) recordProgress(count, 'session'); });
  }
  function boot() {
    updateStreak(); addCenterMarkup(); renderCenter(); bindGlobalShortcuts(); observeProgress();
    document.addEventListener('click', (event) => { const nav = event.target.closest('[data-nav]'); if (nav && nav.dataset.nav === 'dashboard') setTimeout(renderCommandCenter, 100); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

/* Compatibility helpers and explicit module boundaries. */
window.NeuroPrepModules = window.NeuroPrepModules || {};
window.NeuroPrepModules.CommandCenter = { version: '1.0.0', storageKey: 'neuroprep-command-center-v1' };

// Future-ready event contracts for additional modules.
document.addEventListener('neuroprep:session-start', (event) => { document.documentElement.dataset.sessionActive = 'true'; document.dispatchEvent(new CustomEvent('neuroprep:telemetry', { detail: { type: 'session-start', ...event.detail } })); });
document.addEventListener('neuroprep:session-complete', () => { delete document.documentElement.dataset.sessionActive; });

// Small utilities are intentionally exported for other feature modules.
window.NeuroPrepModules.utils = { safe: (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]), today: () => new Date().toISOString().slice(0, 10), uid: (prefix = 'item') => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };

// Accessible announcement bridge.
window.NeuroPrepModules.announce = (message) => { let live = document.querySelector('#cc-live-region'); if (!live) { live = document.createElement('div'); live.id = 'cc-live-region'; live.className = 'sr-only'; live.setAttribute('aria-live', 'polite'); document.body.append(live); } live.textContent = ''; requestAnimationFrame(() => { live.textContent = message; }); };

// Keep the feature surface resilient when the legacy renderer changes sections.
new MutationObserver(() => { if (document.querySelector('#dashboard-section') && !document.querySelector('#command-center')) { setTimeout(() => { const event = new Event('DOMContentLoaded'); document.dispatchEvent(event); }, 0); } }).observe(document.body, { childList: true, subtree: true });

// Storage errors should never prevent the core study experience from loading.
window.addEventListener('storage', (event) => { if (event.key === 'neuroprep-command-center-v1') window.NeuroPrepModules.announce('Command center data updated in another tab'); });

// Respect visibility to avoid spending work on hidden timer displays.
document.addEventListener('visibilitychange', () => { if (document.hidden) document.documentElement.dataset.backgrounded = 'true'; else delete document.documentElement.dataset.backgrounded; });

// Version marker for diagnostics and future migrations.
document.documentElement.dataset.commandCenter = 'v1';

// Additional reusable formatters.
window.NeuroPrepModules.format = {
  date(value) { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)); },
  time(value) { return new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(new Date(value)); },
  duration(seconds) { const minutes = Math.floor(seconds / 60); const remainder = seconds % 60; return `${minutes}:${String(remainder).padStart(2, '0')}`; },
  percent(value, total) { return total ? `${Math.round((value / total) * 100)}%` : '0%'; },
};

// Keyboard navigation for tabs is kept separate from rendering for reuse.
document.addEventListener('keydown', (event) => {
  const current = event.target.closest?.('[role="tab"]');
  if (!current || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  const tabs = [...current.parentElement.querySelectorAll('[role="tab"]')]; const index = tabs.indexOf(current); const next = event.key === 'ArrowRight' ? tabs[(index + 1) % tabs.length] : tabs[(index - 1 + tabs.length) % tabs.length]; next.focus(); next.click();
});

// Add a stable semantic landmark after the command center is mounted.
document.addEventListener('DOMContentLoaded', () => { const center = document.querySelector('#command-center'); if (center) center.setAttribute('role', 'region'); });

// Ensure stale timers do not keep a page alive during navigation.
window.addEventListener('pagehide', () => { document.documentElement.dataset.commandCenterUnmounted = 'true'; });

// Expose a safe refresh hook for future server-synced data sources.
window.NeuroPrepModules.refresh = () => { document.dispatchEvent(new CustomEvent('neuroprep:refresh')); };

// The module intentionally avoids network calls: all data remains local and offline-friendly.
const OFFLINE_CAPABILITY = { name: 'Command Center', offline: true, syncReady: false };
window.NeuroPrepModules.capabilities = [OFFLINE_CAPABILITY];

// Keep browser history useful when the command center is the active focus.
window.addEventListener('hashchange', () => { if (location.hash === '#dashboard') window.NeuroPrepModules.refresh(); });

// Final safety hook.
window.addEventListener('error', (event) => { if (event.message?.includes('command center')) window.NeuroPrepModules.announce('Some optional command center controls are unavailable'); });

// End of modular command center.
