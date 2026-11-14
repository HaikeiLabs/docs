import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const page = (relativePath) =>
  readFile(new URL(`../content/kei/${relativePath}`, import.meta.url), 'utf8');

function tableRows(source) {
  return source
    .split('\n')
    .filter((line) => line.startsWith('|'))
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
}

function dataRows(source) {
  return tableRows(source).filter(
    (row) => row[0] !== 'Connector' && !row.every((cell) => /^-+$/.test(cell)),
  );
}

function connectorRow(source, name) {
  return dataRows(source).find((row) => row[0].startsWith(name));
}

// Operations with proto contracts under proto/kei/connectors/ in
// kei-connector-contracts, keyed by the proto directory name.
const CONTRACT_OPERATIONS = {
  github: ['github.issues.get', 'github.issues.list', 'github.pulls.get', 'github.contents.put'],
  linear: ['linear.issues.get', 'linear.issues.create', 'linear.issues.search'],
  http_api: ['http_api.records.list', 'http_api.records.get'],
  database: ['database.query.run'],
};

// Connectors with a proto contract under proto/kei/connectors/.
const CONTRACTED_CONNECTORS = ['GitHub', 'Linear', 'Generic HTTP API', 'Database'];

// Connectors creatable today with `kei connectors create`: the CLI's built-in
// provider list plus MCP catalog templates. Source of truth:
// `kei connectors create --help`.
const USABLE_TODAY = [
  'GitHub',
  'Linear',
  'Generic HTTP API',
  'Google Drive',
  'Gmail',
  'Generic MCP server',
];

// Connectors whose operation contract has not landed yet.
const PLANNED_CONTRACT_CONNECTORS = [
  'Google Drive',
  'Gmail',
  'Generic MCP',
  'Notion',
  'Omni',
  'Power BI',
  'Snowflake',
  'Postgres',
  'Supabase',
  'MySQL',
  'MSSQL',
  'Google Sheets',
  'Airtable',
  'HubSpot',
  'Atlassian',
  'Sentry',
];

test('catalog links every contracted operation to its proto file', async () => {
  const source = await page('connectors/connector-catalog.md');
  for (const [connector, operations] of Object.entries(CONTRACT_OPERATIONS)) {
    assert.match(
      source,
      new RegExp(`https://github\\.com/HaikeiLabs/kei-connector-contracts/blob/main/proto/kei/connectors/${connector}/`),
      `missing contracts link for ${connector}`,
    );
    for (const operation of operations) {
      assert.ok(source.includes(operation), `missing operation ${operation}`);
    }
  }
});

test('catalog intro defines usable today and operation contract as separate columns', async () => {
  const source = await page('connectors/connector-catalog.md');
  assert.match(source, /"Usable today" means/);
  assert.match(source, /"Operation contract" means/);
  assert.match(source, /kei connectors create --help/);
  assert.match(source, /proto\/kei\/connectors\//);
});

test('every catalog row states usable today and operation contract', async () => {
  const source = await page('connectors/connector-catalog.md');
  const rows = dataRows(source);
  assert.equal(rows.length, 20, `expected 20 catalog rows, found ${rows.length}`);
  for (const row of rows) {
    assert.match(
      row.at(-2),
      /^(?:Yes|No)$/,
      `${row[0]} must state Usable today Yes or No`,
    );
    assert.match(
      row.at(-1),
      /^(?:Available|Planned)$/,
      `${row[0]} must state Operation contract Available or Planned`,
    );
  }
});

test('usable today matches the kei connectors create provider list', async () => {
  const source = await page('connectors/connector-catalog.md');
  for (const name of USABLE_TODAY) {
    const row = connectorRow(source, name);
    assert.ok(row, `missing catalog row for ${name}`);
    assert.equal(row.at(-2), 'Yes', `${name} is creatable with kei connectors create today`);
  }
  for (const row of dataRows(source)) {
    if (USABLE_TODAY.some((n) => row[0].startsWith(n))) continue;
    assert.equal(row.at(-2), 'No', `${row[0]} is not in the kei connectors create provider list yet`);
  }
});

test('operation contract is available only for connectors with protos', async () => {
  const source = await page('connectors/connector-catalog.md');
  for (const name of CONTRACTED_CONNECTORS) {
    const row = connectorRow(source, name);
    assert.ok(row, `missing catalog row for ${name}`);
    assert.equal(row.at(-1), 'Available', `${name} has a proto contract`);
  }
  for (const name of PLANNED_CONTRACT_CONNECTORS) {
    const row = connectorRow(source, name);
    assert.ok(row, `missing catalog row for ${name}`);
    assert.equal(row.at(-1), 'Planned', `${name} has no proto contract yet`);
  }
});

test('usable today and operation contract are independent', async () => {
  const source = await page('connectors/connector-catalog.md');
  const database = connectorRow(source, 'Database');
  assert.ok(database, 'missing catalog row for Database');
  assert.equal(database.at(-2), 'No', 'Database is not creatable with kei connectors create today');
  assert.equal(database.at(-1), 'Available', 'Database has a proto contract');
  for (const name of ['Google Drive', 'Gmail', 'Generic MCP server']) {
    const row = connectorRow(source, name);
    assert.ok(row, `missing catalog row for ${name}`);
    assert.equal(row.at(-2), 'Yes', `${name} is creatable today`);
    assert.equal(row.at(-1), 'Planned', `${name} has no proto contract yet`);
  }
});

test('catalog records the pilot test gate', async () => {
  const source = await page('connectors/connector-catalog.md');
  assert.match(source, /unmarshal/i);
  assert.match(source, /Go, Python, (?:and )?Rust/);
});

test('auth page documents every credential model from the matrix', async () => {
  const source = await page('connectors/connector-auth.md');
  for (const term of [
    '`sso_reuse`',
    'tier 1',
    'tier 2',
    '`secret_ref`',
    '`opaque_ref`',
    '`KEI_SECRETS_BACKEND`',
    '`kei_token_exchange`',
    '`service_principal_key`',
    '`saml`',
  ]) {
    assert.ok(source.includes(term), `missing auth model ${term}`);
  }
  assert.match(source, /Kei policies/);
});

test('auth page never publishes ticket ids or banned wording', async () => {
  const source = await page('connectors/connector-auth.md');
  assert.doesNotMatch(source, /HAI-\d+/);
  assert.doesNotMatch(source, /guardrails?/i);
});

test('explained and contracts pages describe operation contracts', async () => {
  const explained = await page('connectors/connectors-explained.md');
  assert.match(explained, /operation contract/i);
  assert.match(explained, /proto/i);
  assert.match(explained, /decision-only/);
  assert.match(explained, /buf generates/);

  const contracts = await readFile(
    new URL('../content/kei/reference/contracts-vs-agentware.md', import.meta.url),
    'utf8',
  );
  assert.match(contracts, /## Operation contracts/);
  assert.match(contracts, /proto/i);
  assert.match(contracts, /no gRPC services/);
  assert.match(contracts, /buf breaking/);
  assert.match(contracts, /decision-only/);
});
