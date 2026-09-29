#!/usr/bin/env node
/**
 * build-banks.mjs — NeuroPrep data pipeline
 *
 * Splits the raw builder bank (data/source/questions.json, ~21k questions)
 * into per-subject shards under data/banks/builder/<subject>.json and emits a
 * compact data/banks/manifest.json used by the app for:
 *   - instant boot (no monolith download),
 *   - filter options & match counts without loading question bodies,
 *   - question-id → subject routing for due/Leitner/weakest pools.
 *
 * Usage:  node tools/build-banks.mjs
 */
import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'data', 'source', 'questions.json');
const OUT_DIR = path.join(ROOT, 'data', 'banks');
const SHARD_DIR = path.join(OUT_DIR, 'builder');

const json = (data) => JSON.stringify(data);
const jsonPretty = (data) => JSON.stringify(data, null, 2);

async function main() {
  const raw = JSON.parse(await readFile(SOURCE, 'utf8'));
  const questions = raw.questions ?? [];
  if (!questions.length) throw new Error('No questions found in source bank.');

  // Group by subject.
  const bySubject = new Map();
  for (const q of questions) {
    const subj = q.subj || 'general';
    if (!bySubject.has(subj)) bySubject.set(subj, []);
    bySubject.get(subj).push(q);
  }

  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(SHARD_DIR, { recursive: true });

  const subjects = [];
  const idIndex = {}; // questionId -> subject (for spaced-repetition pools)

  for (const [subj, qs] of [...bySubject.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    qs.sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
    for (const q of qs) idIndex[q.id] = subj;

    const examBodies = [...new Set(qs.map((q) => q.examBody).filter(Boolean))].sort();
    const years = [...new Set(qs.map((q) => String(q.paperYear)).filter((y) => y && y !== 'undefined'))].sort().reverse();
    const topics = [...new Set(qs.map((q) => q.topic).filter(Boolean))].sort();
    const topicCounts = {};
    for (const q of qs) if (q.topic) topicCounts[q.topic] = (topicCounts[q.topic] || 0) + 1;

    await writeFile(path.join(SHARD_DIR, `${subj}.json`), json({ subject: subj, totalQuestions: qs.length, questions: qs }));

    subjects.push({ subj, total: qs.length, examBodies, years, topics, topicCounts });
  }

  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    totalQuestions: questions.length,
    subjects,
    idIndex,
  };
  await writeFile(path.join(OUT_DIR, 'manifest.json'), json(manifest));

  // Human-readable summary.
  console.log(`✔ Builder bank split into ${subjects.length} shards (${questions.length.toLocaleString()} questions)`);
  for (const s of subjects) console.log(`  ${s.subj.padEnd(24)} ${String(s.total).padStart(5)} Qs · ${s.topics.length} topics`);

  // Sanity-check the board catalog so broken deploys are caught at build time.
  const boardIndex = JSON.parse(await readFile(path.join(ROOT, 'board', 'index.json'), 'utf8'));
  const { access } = await import('node:fs/promises');
  let missing = 0;
  for (const s of boardIndex.subjects) {
    try { await access(path.join(ROOT, s.apiFile)); } catch { missing += 1; }
  }
  if (missing) throw new Error(`${missing} board files referenced by board/index.json are missing.`);
  console.log(`✔ Board catalog verified: ${boardIndex.subjects.length} subjects across ${new Set(boardIndex.subjects.map((s) => s.board)).size} boards, 0 missing files`);
}

main().catch((err) => { console.error(err); process.exit(1); });
