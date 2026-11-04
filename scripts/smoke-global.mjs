// Verify the documented global install as well as the prefix install (ENGIN-773).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const prefix = resolve(process.argv[2]);
const version = process.argv[3];
const digest = process.argv[4];
assert.match(digest ?? '', /^[a-f0-9]{64}$/);
const root = join(prefix, ...(process.platform === 'win32' ? [] : ['lib']), 'node_modules', 'velocity-agent');
const { verifyDependencyTree, contentsDigest } = await import(pathToFileURL(join(root, 'scripts/verify-dependency-tree.mjs')));
const checked = await verifyDependencyTree(root, { digest, exclusive: true });
assert.equal(JSON.parse(await readFile(join(root, 'package.json'))).version, version);
const tree = JSON.parse(await readFile(join(root, 'dependency-tree.json')));
async function nativeContents(packageRoot, checkedTree) {
  const entries = new Map();
  for (const path of checkedTree.runtime) {
    const directory = join(dirname(dirname(packageRoot)), path);
    const p = JSON.parse(await readFile(join(directory, 'package.json')));
    entries.set(`${p.name}@${p.version}`, { directory, contents: await contentsDigest(directory) });
  }
  return entries;
}
const natives = await nativeContents(root, checked);
if (process.argv[5]) {
  const reference = join(resolve(process.argv[5]), 'node_modules', 'velocity-agent');
  const referenceTree = await verifyDependencyTree(reference, { digest, exclusive: true, requireIntegrity: true });
  assert.equal(await contentsDigest(root), await contentsDigest(reference), 'Global code differs from the accepted prefix archive');
  const expected = await nativeContents(reference, referenceTree);
  assert.deepEqual([...natives.keys()].sort(), [...expected.keys()].sort());
  for (const [key, actual] of natives) assert.equal(actual.contents, expected.get(key).contents, `${key} differs from the integrity-checked prefix installation`);
}
const scratch = await mkdtemp(join(tmpdir(), 'velocity-global-smoke-'));
try {
  const env = { PATH: process.env.PATH, HOME: scratch, USERPROFILE: scratch,
    XDG_CONFIG_HOME: scratch, XDG_DATA_HOME: scratch,
    ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1', DISABLE_AUTOUPDATER: '1' };
  const run = (command, args) => {
    const result = spawnSync(command, args, { env, encoding: 'utf8', timeout: 30_000, maxBuffer: 1024 * 1024 });
    assert.equal(result.error, undefined, 'Installed command could not run');
    assert.equal(result.status, 0, 'Installed command did not complete successfully');
    return result.stdout.trim();
  };
  assert.equal(run(process.execPath, [join(root, 'dist/index.js'), '--version']), version);
  assert.match(run(process.execPath, [join(root, 'dist/index.js'), 'loop', '--help']), /--watch/);
  const codex = Object.entries(tree.packages).find(([, entry]) => entry.name === '@openai/codex');
  assert(codex, 'The portable Codex launcher must be present');
  const codexRoot = join(root, codex[0]);
  const codexPackage = JSON.parse(await readFile(join(codexRoot, 'package.json')));
  const codexVersion = run(process.execPath, [join(codexRoot, codexPackage.bin.codex), '--version']);
  assert.match(codexVersion, /\d+\.\d+\.\d+/);
  const claude = [...natives].find(([name]) => name.startsWith('@anthropic-ai/claude-agent-sdk-'));
  assert(claude, 'The native Claude package for this platform must be present');
  const claudeVersion = run(join(claude[1].directory, process.platform === 'win32' ? 'claude.exe' : 'claude'), ['--version']);
  assert.match(claudeVersion, /\d+\.\d+\.\d+/);
  console.log(JSON.stringify({ passed: true, version, dependencyTreeSha256: checked.digest,
    portablePackages: checked.packages, nativePackages: natives.size,
    prefixBytesCompared: !!process.argv[5], codexVersion, claudeVersion,
    node: process.version, platform: process.platform, architecture: process.arch, modelCalls: 0 }));
} finally { await rm(scratch, { recursive: true, force: true }); }
