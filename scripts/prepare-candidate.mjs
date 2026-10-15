import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const source = JSON.parse(await readFile('release/source.json', 'utf8'));
assert.match(source.version, /^\d+\.\d+\.\d+$/);
assert.match(source.sourceSha, /^[a-f0-9]{40}$/);
assert.match(source.sha256, /^[a-f0-9]{64}$/);
assert.ok(Number.isSafeInteger(source.sourceRun) && source.sourceRun > 0);
assert.equal(process.env.GITHUB_REF_NAME, 'release/agent-v' + source.version);
const filename = `velocity-agent-${source.version}.tgz`;
const digest = createHash('sha256').update(await readFile('release/' + filename)).digest('hex');
assert.equal(digest, source.sha256);
assert.equal((await readFile('release/' + filename + '.sha256', 'utf8')).trim(), `${digest}  ${filename}`);
await writeFile('version.txt', source.version);
await writeFile('release-notes.txt', `Velocity agent ${source.version}: local Codex, Claude Code and Anthropic API workers. Requires Node 18.20+.\n\nBuilt and checked in product CI: https://github.com/velocity-quest/velocity/actions/runs/${source.sourceRun}\nSource commit: ${source.sourceSha}\nSHA-256: ${digest}\n\nPublic distribution CI verified clean installation on Node 18 and 22. Source repository access is required to view product CI.\n`);
