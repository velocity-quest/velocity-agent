import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const prefix = resolve(process.argv[2]);
const version = process.argv[3];
const binary = resolve(prefix, 'node_modules/velocity-agent/dist/index.js');
const manifest = JSON.parse(await readFile(resolve(prefix, 'node_modules/velocity-agent/package.json'), 'utf8'));
assert.equal(manifest.version, version);
assert.equal(manifest.private, false);
let calls = 0;
const server = createServer(async (request, response) => {
  let data = '';
  for await (const chunk of request) data += chunk;
  try {
    const rpc = JSON.parse(data);
    assert.equal(request.headers.authorization, 'Bearer vel_mcp_smoke_only');
    assert.equal(request.headers['x-workspace-slug'], 'smoke-workspace');
    assert.equal(rpc.params.name, 'get_pending_agent_runs');
    if (calls === 1) assert.deepEqual(rpc.params.arguments, { tier: 'claude_code', team: 'TEST' });
    calls++;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result: { content: [{ type: 'text', text: '{"runs":[]}' }] } }));
  } catch (error) { response.statusCode = 500; response.end(String(error)); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}`;
async function run(args) {
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [binary, ...args], { env: {
      ...process.env, VELOCITY_MCP_TOKEN: 'vel_mcp_smoke_only', VELOCITY_WORKSPACE: 'smoke-workspace',
      VELOCITY_API_KEY: '', ANTHROPIC_API_KEY: '',
    }, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', chunk => output += chunk);
    child.stderr.on('data', chunk => output += chunk);
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(output.trim()) : reject(new Error(output)));
  });
}
try {
  assert.equal(await run(['--version']), version);
  assert.match(await run(['run', '--help']), /--executor/);
  assert.match(await run(['status', '--base-url', url]), /Pending agent runs: 0/);
  await run(['run', '--once', '--executor', 'claude-code', '--repo', prefix, '--team', 'TEST', '--base-url', url]);
  assert.equal(calls, 2);
  console.log(`Clean install passed: Node ${process.versions.node}, velocity-agent ${version}, MCP token authentication, Claude Code without an Anthropic API key.`);
} finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
