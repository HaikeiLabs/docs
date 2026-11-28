// check:updated — warn when a course lesson, or a data file it shows, changed
// against a base ref while the lesson's updated date did not. updated stays
// hand-set (a typo fix need not move it), so this only warns and always exits 0.
//
//   npm run check:updated [-- <base-ref>]     default base: origin/main
//
// Changes are compared with the merge base of <base-ref> and HEAD, and include
// uncommitted and untracked files, so it gives the same answer locally and in a PR.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lessonDataStems, parseFrontMatter } from './course-validate.mjs';

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const lines = text => text.split('\n').filter(Boolean);
const updatedOf = text => { try { return parseFrontMatter(text)[0]?.updated; } catch { return undefined; } };

// Returns warnings as { lesson, file, message }; file is relative to the repo root.
export function checkUpdated({ base = 'origin/main', cwd = process.cwd(), courseDir = 'content/agentware/course' } = {}) {
  const top = git(cwd, 'rev-parse', '--show-toplevel').trim();
  if (!fs.existsSync(path.resolve(cwd, courseDir))) return [];
  const course = path.relative(fs.realpathSync(top), fs.realpathSync(path.resolve(cwd, courseDir))).split(path.sep).join('/');
  if (!fs.existsSync(path.join(top, course, 'index.md'))) return [];
  let since;
  try { since = git(top, 'merge-base', base, 'HEAD').trim(); } catch {
    return [{ lesson: null, file: course, message: `check:updated: base ref ${base} not found; fetch it (git fetch origin main) to compare lesson dates` }];
  }
  const changed = new Set([...lines(git(top, 'diff', '--name-only', since, '--', course)), ...lines(git(top, 'ls-files', '--others', '--exclude-standard', '--', course))]);
  const warnings = [];
  for (const name of fs.readdirSync(path.join(top, course, 'lessons')).filter(f => f.endsWith('.md')).sort()) {
    const id = name.slice(0, -3);
    const file = `${course}/lessons/${name}`;
    const text = fs.readFileSync(path.join(top, file), 'utf8');
    const touched = [file, ...[...new Set(lessonDataStems(text))].map(stem => `${course}/data/${stem}.json`)].filter(f => changed.has(f));
    if (!touched.length) continue;
    let before;
    try { before = git(top, 'show', `${since}:${file}`); } catch { continue; } // a new lesson: its date is new too
    const now = updatedOf(text);
    if (now !== undefined && now !== updatedOf(before)) continue;
    const what = touched.map(f => path.posix.basename(f)).join(', ');
    warnings.push({ lesson: id, file, message: `${id}: ${what} changed but ${now ? `updated is still ${now}` : 'the lesson has no updated date'}. Bump updated if readers should notice the change (a typo fix can keep the date).` });
  }
  return warnings;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const base = process.argv[2] ?? 'origin/main';
  const ci = process.env.GITHUB_ACTIONS === 'true';
  let warnings;
  try { warnings = checkUpdated({ base }); } catch (error) { warnings = [{ file: '.', message: `check:updated skipped: ${error.message}` }]; }
  for (const { file, message } of warnings) {
    if (ci) console.log(`::warning file=${file}::${message}`); else console.error(`warning: ${message}`);
  }
  console.log(`check:updated: ${warnings.length} warning${warnings.length === 1 ? '' : 's'} against ${base}`);
}
