import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';

const payload = JSON.parse(process.env.RELEASE_PAYLOAD || '{}');
assert.match(payload.version, /^\d+\.\d+\.\d+$/);
assert.match(payload.sourceSha, /^[a-f0-9]{40}$/);
assert.match(payload.sha256, /^[a-f0-9]{64}$/);
assert.ok(Number.isSafeInteger(payload.sourceRun) && payload.sourceRun > 0);
assert.ok(typeof payload.artifact === 'string' && payload.artifact.length < 60_000);
const artifact = Buffer.from(payload.artifact, 'base64');
assert.equal(createHash('sha256').update(artifact).digest('hex'), payload.sha256);
mkdirSync('release', { recursive: true });
const filename = `velocity-agent-${payload.version}.tgz`;
writeFileSync(`release/${filename}`, artifact);
writeFileSync(`release/${filename}.sha256`, `${payload.sha256}  ${filename}\n`);
writeFileSync('version.txt', payload.version + '\n');
writeFileSync('release-notes.txt', [
  'Compiled local worker for Claude Code and Anthropic API execution. Requires Node 18.20+.',
  'Published by distribution CI after Node 18 and Node 22 clean-install checks. See README.md for setup. Includes SHA-256 checksum.',
  `Built and tested by product CI run https://github.com/velocity-quest/velocity/actions/runs/${payload.sourceRun}`,
  `Product source commit: ${payload.sourceSha}`,
].join('\n'));
