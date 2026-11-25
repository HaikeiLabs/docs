import { buildDocs } from './build.mjs';
await buildDocs({ courseDir: 'test/fixtures/course/agentware', outputDir: 'dist-fixture' });
console.log('Built fixture into dist-fixture/');
