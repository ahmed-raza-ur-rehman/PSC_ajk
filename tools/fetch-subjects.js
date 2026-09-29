const fs = require('node:fs/promises');
const path = require('node:path');

const API_URL = 'https://preppro.academy/api/exams/subject-detail';
const DEFAULT_INPUT = path.join(__dirname, 'subjects.json');
const DEFAULT_OUTPUT = path.join(__dirname, 'board');
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1_000;
const DEFAULT_CONCURRENCY = 8;

function getArgument(name, fallback) {
    const argument = process.argv.find((value) => value.startsWith(`${name}=`));
    return argument ? argument.slice(name.length + 1) : fallback;
}

function sleep(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchSubject(subject) {
    const url = new URL(API_URL);
    url.searchParams.set('board', subject.board);
    url.searchParams.set('subject', subject.subject);

    let lastError;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        try {
            const response = await fetch(url, { signal: controller.signal });
            const body = await response.text();

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`);
            }

            try {
                return JSON.parse(body);
            } catch {
                throw new Error('The API returned invalid JSON');
            }
        } catch (error) {
            lastError = error;
            if (attempt < MAX_RETRIES) {
                await sleep(RETRY_DELAY_MS * attempt);
            }
        } finally {
            clearTimeout(timeout);
        }
    }

    throw new Error(`${subject.board}/${subject.subject}: ${lastError.message}`);
}

function isSubjectResponse(value) {
    return value &&
        typeof value.category === 'string' &&
        typeof value.name === 'string' &&
        typeof value.board === 'string' &&
        typeof value.subject === 'string' &&
        typeof value.url === 'string' &&
        typeof value.country === 'string' &&
        typeof value.totalQuestions === 'number' &&
        Array.isArray(value.questions);
}

async function readExistingSubject(subjectPath) {
    try {
        const existing = JSON.parse(await fs.readFile(subjectPath, 'utf8'));
        return isSubjectResponse(existing) ? existing : null;
    } catch {
        return null;
    }
}

async function main() {
    const inputPath = getArgument('--input', DEFAULT_INPUT);
    const outputDirectory = getArgument('--output', DEFAULT_OUTPUT);
    const delayMs = Number(getArgument('--delay', '100'));
    const concurrency = Math.max(1, Number(getArgument('--concurrency', String(DEFAULT_CONCURRENCY))));
    const source = JSON.parse(await fs.readFile(inputPath, 'utf8'));

    if (!Array.isArray(source.subjects)) {
        throw new Error(`${inputPath} must contain a subjects array`);
    }

    await fs.mkdir(outputDirectory, { recursive: true });

    let nextIndex = 0;
    let completed = 0;
    const subjects = new Array(source.subjects.length);
    const worker = async () => {
        while (true) {
            const index = nextIndex;
            nextIndex += 1;
            if (index >= source.subjects.length) return;

            const subject = source.subjects[index];
            const boardDirectory = path.join(outputDirectory, subject.board);
            const subjectPath = path.join(boardDirectory, `${subject.subject}.json`);
            const existingSubject = await readExistingSubject(subjectPath);
            const fetchedSubject = existingSubject || await fetchSubject(subject);
            if (!existingSubject) {
                await fs.mkdir(boardDirectory, { recursive: true });
                await fs.writeFile(subjectPath, `${JSON.stringify(fetchedSubject, null, 4)}\n`, 'utf8');
            }

            completed += 1;
            subjects[index] = { ...subject, apiFile: path.relative(__dirname, subjectPath).replaceAll(path.sep, '/') };
            process.stdout.write(`[${completed}/${source.subjects.length}] ${subject.board}/${subject.subject}${existingSubject ? ' (cached)' : ''}\n`);
            if (delayMs > 0) await sleep(delayMs);
        }
    };

    await Promise.all(Array.from({ length: concurrency }, worker));

    const indexPath = path.join(outputDirectory, 'index.json');
    await fs.writeFile(indexPath, `${JSON.stringify({ subjects }, null, 4)}\n`, 'utf8');
    process.stdout.write(`Saved ${subjects.length} subjects under ${outputDirectory}\n`);
}

main().catch((error) => {
    console.error(`Fetch failed: ${error.message}`);
    process.exitCode = 1;
});