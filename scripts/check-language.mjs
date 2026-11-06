// Language lint for the guardrails wording contract (C1).
// Scans content/**/*.md and fails on the whole words governed/governance/
// governs/ungoverned outside code. Fenced code blocks and inline code are
// stripped before matching, so code identifiers (governed_call, JSON keys,
// shipped error strings) are never flagged.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PATTERN = /\b(?:governed|governance|governs|ungoverned)\b/gi;

// Strips fenced code blocks and inline code spans while keeping every input
// line (blanked), so reported line numbers match the source file.
export function stripCode(source) {
  const lines = source.split(/\r?\n/);
  const out = [];
  let fence = null; // { char, len } while inside a fenced block
  for (const line of lines) {
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);
    if (!fence && marker) {
      fence = { char: marker[1][0], len: marker[1].length };
      out.push('');
      continue;
    }
    if (fence && marker && marker[1][0] === fence.char && marker[1].length >= fence.len && marker[2].trim() === '') {
      fence = null;
      out.push('');
      continue;
    }
    out.push(fence ? '' : line.replace(/`[^`\n]*`/g, (span) => ' '.repeat(span.length)));
  }
  return out.join('\n');
}

export function findViolations(source) {
  const stripped = stripCode(source);
  const violations = [];
  const lines = stripped.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    PATTERN.lastIndex = 0;
    let match;
    while ((match = PATTERN.exec(lines[i])) !== null) {
      violations.push({ line: i + 1, word: match[0] });
    }
  }
  return violations;
}

async function markdownFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await markdownFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push(full);
  }
  return files.sort();
}

export async function checkLanguage(rootDir) {
  const root = path.resolve(rootDir);
  const files = await markdownFiles(root);
  const problems = [];
  for (const file of files) {
    const rel = path.relative(root, file).split(path.sep).join('/');
    if (rel === 'skills.md') continue; // content/skills.md is owned by the doc-skills lane
    const text = await readFile(file, 'utf8');
    for (const violation of findViolations(text)) {
      problems.push(`${rel}:${violation.line}: "${violation.word}"`);
    }
  }
  return problems;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const root = process.argv[2] ?? 'content';
  const problems = await checkLanguage(root);
  if (problems.length > 0) {
    for (const problem of problems) console.error(problem);
    console.error(
      `check:language failed: ${problems.length} non-code use(s) of governed/governance/governs/ungoverned. ` +
        'Use the C1 replacement table: protected tool call, a tool call that Kei checks, Kei guardrails, operations Kei allows or denies.',
    );
    process.exitCode = 1;
  } else {
    console.log('check:language passed: no non-code uses of governed/governance/governs/ungoverned');
  }
}
