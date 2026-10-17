import { loadDocs } from './build.mjs';

try {
  const pages = await loadDocs();
  console.log(`Validated front matter for ${pages.length} pages`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
