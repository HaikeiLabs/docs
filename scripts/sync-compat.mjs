// Refreshes the vendored Agentware compatibility data and the generated block in
// content/agentware/build/overview.md from agentware's VERSION file and the README
// table between <!-- compat:begin --> and <!-- compat:end -->.
//
//   npm run sync:compat                         # fetch from HaikeiLabs/agentware main
//   npm run sync:compat -- --ref v0.16.0        # fetch a tag or branch
//   npm run sync:compat -- --from ../agentware  # read a local checkout (offline)
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMPAT_BEGIN, COMPAT_END, DATA_FILE, OVERVIEW_FILE, renderCompatBlock, replaceCompatBlock } from './check-compat.mjs';

const REPO = 'HaikeiLabs/agentware';

export function parseCompatTable(readme) {
  const start = readme.indexOf(COMPAT_BEGIN);
  const end = readme.indexOf(COMPAT_END);
  if (start < 0 || end < start) throw new Error(`agentware README has no ${COMPAT_BEGIN} … ${COMPAT_END} table`);
  const lines = readme.slice(start + COMPAT_BEGIN.length, end).split('\n').map((line) => line.trim()).filter((line) => line.startsWith('|'));
  const cells = (line) => line.replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
  const header = cells(lines[0] ?? '').join(' ').toLowerCase();
  if (!/agentware/.test(header) || !/kei-proxy/.test(header) || !/kei-cli/.test(header)) {
    throw new Error(`unexpected compat table header: ${lines[0]}`);
  }
  const rows = lines.slice(1).filter((line) => !/^\|[\s|:-]+\|$/.test(line)).map((line) => {
    const [sdk, keiProxy, keiCli] = cells(line);
    if (!sdk || !keiProxy || !keiCli) throw new Error(`malformed compat row: ${line}`);
    return { sdk, keiProxy, keiCli };
  });
  if (!rows.length) throw new Error('compat table has no rows');
  return rows;
}

async function fetchText(ref, file) {
  const url = `https://raw.githubusercontent.com/${REPO}/${ref}/${file}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GET ${url}: HTTP ${response.status}`);
  return response.text();
}

function parseArgs(argv) {
  const args = { ref: 'main', from: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--ref') args.ref = argv[++i];
    else if (argv[i] === '--from') args.from = argv[++i];
    else throw new Error(`unknown argument: ${argv[i]}`);
  }
  return args;
}

export async function syncCompat({ ref = 'main', from = null } = {}) {
  const read = from
    ? (file) => readFile(path.join(from, file), 'utf8')
    : (file) => fetchText(ref, file);
  const version = (await read('VERSION')).trim();
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`unexpected agentware VERSION: ${version}`);
  const data = { source: from ? 'local agentware checkout' : `${REPO}@${ref}`, version, rows: parseCompatTable(await read('README.md')) };
  const block = renderCompatBlock(data);
  await writeFile(DATA_FILE, `${JSON.stringify(data, null, 2)}\n`);
  await writeFile(OVERVIEW_FILE, replaceCompatBlock(await readFile(OVERVIEW_FILE, 'utf8'), block));
  return data;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const data = await syncCompat(parseArgs(process.argv.slice(2)));
  console.log(`Synced agentware ${data.version} (${data.rows.length} compat rows) from ${data.source}.`);
}
