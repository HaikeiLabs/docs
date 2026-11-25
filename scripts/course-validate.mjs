import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import YAML from 'yaml';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true });
const validators = Object.fromEntries(['hub', 'lesson-front-matter', 'compare', 'api', 'logs', 'debugger', 'runtime-trace', 'gaps'].map(name => [name, ajv.compile(JSON.parse(fs.readFileSync(path.join(root, 'schemas/course', `${name}.schema.json`))))]));
const anchors = {
  debugger: ['build_request(', 'call_model(', 'return final_text(', 'run_tool(', 'tool_results('],
  'runtime-trace': ['backend.complete(', 'reasoning.strip(', 'validator.validate(', 'check.nudge', 'policy.evaluate(', 'auditor.record(', 'denied by policy', 'tool(**call.args)', 'tool_message(', 'return answer'],
};
const widgets = { cycle: ['logs'], compare: null, api: null, debugger: ['logs', 'debugger'], rtdebugger: null, gaps: ['gaps'] };
const schemaFor = { cycle: 'logs', compare: 'compare', api: 'api', debugger: 'debugger', rtdebugger: 'runtime-trace', gaps: 'gaps' };
function frontmatter(file) {
  const text = fs.readFileSync(file, 'utf8');
  const match = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) throw new Error(`${file}: missing front matter`);
  return [YAML.parse(match[1]), match[2]];
}
function checkSchema(name, value, file) {
  if (!validators[name](value)) throw new Error(`${file}: ${ajv.errorsText(validators[name].errors)}`);
}
// Only contract fields marked as inline Markdown are checked here. Verbatim
// source fields can legitimately contain HTML-like tokens and entities.
function checkInlineMarkdown(value, field) {
  if (/<\/?[a-z][a-z0-9:-]*(?:\s[^<>]*?)?\s*\/?>/i.test(value) || /&(?:#[xX][0-9a-f]+|#\d+|[a-z][a-z0-9]+);/i.test(value)) {
    throw new Error(`${field}: use inline Markdown instead of HTML tags or entities`);
  }
}
export function validateCourse(dir) {
  const [hub] = frontmatter(path.join(dir, 'index.md')); checkSchema('hub', hub, 'index.md');
  const files = fs.readdirSync(path.join(dir, 'lessons')).filter(f => f.endsWith('.md')).map(f => f.slice(0, -3));
  if (files.length !== hub.lessons.length || files.some(f => !hub.lessons.includes(f))) throw new Error('lessons and files differ');
  if (hub.groups.some(g => !hub.lessons.includes(g.from))) throw new Error('group references unknown lesson');
  const checked = new Set();
  function data(stem, schema) {
    const file = path.join(dir, 'data', `${stem}.json`); const key = `${stem}:${schema}`;
    if (checked.has(key)) return;
    const value = JSON.parse(fs.readFileSync(file, 'utf8')); checkSchema(schema, value, file);
    if (schema === 'compare') {
      if (new Set(value.tabs.map(t => t.id)).size !== value.tabs.length) throw new Error(`${file}: duplicate tab id`);
      value.tabs.forEach((tab, i) => checkInlineMarkdown(tab.note, `${file}: tabs[${i}].note`));
    }
    for (const anchor of anchors[schema] ?? []) if (value.code.split('\n').filter(line => line.includes(anchor)).length !== 1) throw new Error(`${file}: anchor ${anchor} must appear exactly once`);
    checked.add(key);
  }
  for (const file of fs.readdirSync(path.join(dir, 'data'))) {
    if (/^compare-[a-z0-9-]+\.json$/.test(file)) data(file.slice(0, -5), 'compare');
  }
  hub.lessons.forEach((id, index) => {
    const file = path.join(dir, 'lessons', `${id}.md`); const [lesson, body] = frontmatter(file); checkSchema('lesson-front-matter', lesson, file);
    checkInlineMarkdown(lesson.lede, `${file}: lede`);
    if (lesson.id !== id || lesson.num !== index + 1) throw new Error(`${file}: id or number differs`);
    if (lesson.quiz.a >= lesson.quiz.opts.length) throw new Error(`${file}: quiz answer out of range`);
    if (lesson.finish && index !== hub.lessons.length - 1) throw new Error(`${file}: finish must be last`);
    const parts = body.split(/^# Reference\s*$/m); if (parts.length > 2) throw new Error(`${file}: duplicate reference`);
    function items(text, reference) {
      const chunks = text.split(/^##\s+.+$/m); const prefix = chunks.shift().trim();
      const steps = [...(prefix ? [prefix] : []), ...chunks.map(s => s.trim())];
      if (!reference && (steps.length < 1 || steps.length > 3)) throw new Error(`${file}: expected 1 to 3 steps`);
      let count = 0;
      for (const step of steps) {
        const fences = [...step.matchAll(/^```([^\n]*)\n([\s\S]*?)^```\s*$/gm)];
        const directives = [...step.matchAll(/^\[widget:([a-z-]+)(?: data=([a-z0-9-]+))?\]\s*$/gm)];
        if (fences.length + directives.length !== 1) throw new Error(`${file}: step requires one code block or widget`);
        count += directives.length;
        for (const match of directives) {
          const [, name, stem] = match; if (!(name in widgets)) throw new Error(`${file}: unknown widget ${name}`);
          if ((widgets[name] === null) !== Boolean(stem)) throw new Error(`${file}: incorrect widget data`);
          if (stem) data(stem, schemaFor[name]); else for (const dependency of widgets[name]) data(dependency, dependency);
        }
        const prose = step.replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm, '');
        const marks = fences[0]?.[1].match(/\bmarks="([^"]*)"/)?.[1]?.split(';').map(x => x.split('=')[1]) ?? [];
        for (const marker of prose.matchAll(/\[\[(\d+)\]\]/g)) if (!marks.includes(marker[1])) throw new Error(`${file}: marker ${marker[1]} missing mark`);
      }
      if (count > 1) throw new Error(`${file}: too many widgets in ${reference ? 'reference' : 'steps'}`);
    }
    items(parts[0], false); if (parts[1]) items(parts[1], true);
  });
  return hub;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2] ?? process.env.COURSE_DIR ?? 'content/agentware/course';
  // Same rule as the build: without a hub page the course is skipped, so there is nothing to validate.
  if (fs.existsSync(dir) && !fs.existsSync(path.join(dir, 'index.md'))) console.log(`No hub page at ${path.join(dir, 'index.md')}; course not built, nothing to validate.`);
  else if (fs.existsSync(dir)) { validateCourse(dir); console.log(`Course valid: ${dir}`); } else if (process.argv[2]) { throw new Error(`Course directory not found: ${dir}`); }
}
