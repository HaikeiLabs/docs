import fs from 'node:fs';

// Version and date helpers for course content versioning. No locale: dates
// render the same on every build machine.
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Numeric X.Y.Z comparison: -1, 0 or 1.
export function compareVersions(a, b) {
  const [x, y] = [a, b].map(v => v.split('.').map(Number));
  for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  return 0;
}

// True when a YYYY-MM-DD string names a real calendar day.
export function isRealDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// "2026-11-27" -> "27 Nov 2026".
export function formatDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return `${day} ${months[month - 1]} ${year}`;
}

// The newest updated date among lessons, or undefined. ISO dates sort as strings.
export function newestUpdated(lessons) {
  return lessons.map(lesson => lesson.updated).filter(Boolean).sort().at(-1);
}

// The vendored "current Agentware release" (scripts/data/agentware-compat.json, refreshed by npm run sync:compat).
export function readLatestAgentware(file) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).version : undefined;
}
