import { buildDocs } from './build.mjs';
await buildDocs({ courseDir: 'test/fixtures/course/agentware', outputDir: 'dist-fixture', compatFile: 'test/fixtures/course/agentware-compat.json' });
console.log('Built fixture into dist-fixture/');
