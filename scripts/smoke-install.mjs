import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, writeFile, stat, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const prefix = resolve(process.argv[2]);
const version = process.argv[3];
const binary = resolve(prefix, 'node_modules/velocity-agent/dist/index.js');
const manifest = JSON.parse(await readFile(resolve(prefix, 'node_modules/velocity-agent/package.json'), 'utf8'));
assert.equal(manifest.version, version);
assert.equal(manifest.private, false);
const config = join(prefix, 'smoke-config');
const file = join(config, 'velocity', 'credentials.json');
const code = 'a'.repeat(64);
const user = { id: 'smoke-user', email: 'smoke@example.test' };
const workspace = { id: 'smoke-workspace-id', name: 'Smoke workspace', slug: 'smoke-workspace' };
let multi = false;
let calls = 0, refreshes = 0, refresh = 'vel_rt_smoke_initial', access = 'vel_at_smoke_initial', revoked = false, authorize;
const server = createServer(async (request, response) => {
  let data = '';
  for await (const chunk of request) data += chunk;
  const send = (value, status = 200) => { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(value)); };
  try {
    const path = new URL(request.url, url).pathname;
    if (path === '/.well-known/oauth-authorization-server') return send({ issuer: url, authorization_endpoint: url + '/api/oauth/authorize', token_endpoint: url + '/api/oauth/token' });
    if (path === '/api/oauth/token') {
      const params = new URLSearchParams(data); assert.equal(params.get('client_id'), 'velocity-cli');
      if (params.get('grant_type') === 'refresh_token') {
        if (revoked || params.get('refresh_token') !== refresh) return send({ error: 'invalid_grant' }, 400);
        refreshes++; refresh = 'vel_rt_smoke_rotated'; access = 'vel_at_smoke_rotated';
      } else {
        assert.equal(params.get('code'), code); assert.equal(params.get('redirect_uri'), url + '/oauth/code');
        assert.equal(createHash('sha256').update(params.get('code_verifier')).digest('base64url'), authorize.searchParams.get('code_challenge'));
      }
      return send({ access_token: access, refresh_token: refresh, expires_in: 3600, token_type: 'bearer' });
    }
    if (path === '/api/oauth/revoke') { assert.equal(new URLSearchParams(data).get('token'), refresh); revoked = true; return send({}); }
    if (path === '/api/cli/identity') return multi ? send({user, workspaces:[workspace, {...workspace, id:'second-id',slug:'second-workspace'}]}) : send({ error: 'old server' }, 404);
    assert.equal(path, '/api/mcp');
    const token = request.headers.authorization;
    if (token !== 'Bearer vel_mcp_smoke_only' && (revoked || token !== 'Bearer ' + access)) return send({ error: 'unauthorized' }, 401);
    const rpc = JSON.parse(data);
    let result;
    if (rpc.params.name === 'get_current_user') result = user;
    else if (rpc.params.name === 'get_workspace') result = workspace;
    else {
      assert.equal(rpc.params.name, 'get_pending_agent_runs');
      assert.ok([workspace.slug, ...(multi ? ['second-workspace'] : [])].includes(request.headers['x-workspace-slug']));
      if (rpc.params.arguments.tier === 'claude_code' || rpc.params.arguments.agent === 'codex') assert.equal(rpc.params.arguments.team, 'TEST');
      calls++; result = { runs: [] };
    }
    send({ jsonrpc: '2.0', id: rpc.id, result: { content: [{ type: 'text', text: JSON.stringify(result) }] } });
  } catch (error) { send({ error: String(error) }, 500); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}`;
async function run(args, { key = '', login = false } = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [binary, ...args], { env: {
      ...process.env, XDG_CONFIG_HOME: config, VELOCITY_MCP_TOKEN: key, VELOCITY_WORKSPACE: '',
      VELOCITY_API_KEY: '', ANTHROPIC_API_KEY: '', SSH_CLIENT: '', SSH_CONNECTION: '',
    }, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '', errors = '', entered = false;
    const timer = setTimeout(() => { child.kill(); reject(new Error('Installed CLI smoke timed out')); }, 15000);
    child.stdout.on('data', chunk => {
      output += chunk;
      if (login && !entered) {
        const line = output.split('\n').find(value => value.startsWith(url + '/api/oauth/authorize?'));
        if (line) { authorize = new URL(line); entered = true; child.stdin.end(code + '.' + authorize.searchParams.get('state') + '\n'); }
      }
    });
    child.stderr.on('data', chunk => errors += chunk);
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', status => {
      clearTimeout(timer);
      try {
        const combined = output + errors;
        assert.ok(!combined.includes(code) && !combined.includes('vel_at_') && !combined.includes('vel_rt_'), 'CLI printed a secret');
        status === 0 ? resolve(output.trim()) : reject(new Error(combined));
      } catch (error) { reject(error); }
    });
  });
}
try {
  assert.equal(await run(['--version']), version);
  assert.match(await run(['run', '--help']), /--executor/);
  assert.match(await run(['login', '--help']), /--no-browser/);
  assert.match(await run(['run', '--help']), /--agent/);
  assert.match(await run(['status', '--agent', 'codex', '--team', 'TEST', '--base-url', url], { key: 'vel_mcp_smoke_only' }), /Pending agent runs: 0/);
  await run(['run', '--once', '--agent', 'codex', '--repo', prefix, '--team', 'TEST', '--base-url', url], { key: 'vel_mcp_smoke_only' });
  assert.match(await run(['status', '--base-url', url], { key: 'vel_mcp_smoke_only' }), /Pending agent runs: 0/);
  await run(['run', '--once', '--executor', 'claude-code', '--repo', prefix, '--team', 'TEST', '--base-url', url], { key: 'vel_mcp_smoke_only' });
  assert.match(await run(['login', '--no-browser', '--base-url', url], { login: true }), /"signedIn": true/);
  assert.equal((await stat(file)).mode & 0o777, 0o600);
  assert.deepEqual(JSON.parse(await run(['whoami', '--base-url', url])), { user, workspace });
  assert.match(await run(['status', '--base-url', url]), /Pending agent runs: 0/);
  await run(['run', '--once', '--executor', 'claude-code', '--repo', prefix, '--team', 'TEST', '--base-url', url]);
  const saved = JSON.parse(await readFile(file, 'utf8')); saved.credentials[url].expiresAt = 0;
  await writeFile(file, JSON.stringify(saved));
  await Promise.all([1, 2].map(() => run(['whoami', '--base-url', url]))); assert.equal(refreshes, 1);
  assert.match(await run(['logout', '--base-url', url]), /grant was revoked/);
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')).credentials, {}); assert.equal(revoked, true);
  await assert.rejects(run(['whoami', '--base-url', url]), /velocity-agent login/);
  assert.equal(calls, 6);
  multi = true; calls = 0;
  await run(['status', '--base-url', url], {key:'vel_mcp_smoke_only'});
  await run(['run', '--once', '--executor', 'claude-code', '--repo', prefix, '--team', 'TEST', '--base-url', url], {key:'vel_mcp_smoke_only'});
  assert.equal(calls,4);
  await run(['status', '--workspace', 'second-workspace', '--base-url', url], {key:'vel_mcp_smoke_only'});
  await run(['run', '--once', '--executor', 'claude-code', '--workspace', 'second-id', '--repo', prefix, '--team', 'TEST', '--base-url', url], {key:'vel_mcp_smoke_only'});
  assert.equal(calls,6);
  await assert.rejects(run(['status', '--workspace', 'unapproved', '--base-url', url], {key:'vel_mcp_smoke_only'}), /does not authorize/);
  assert.equal(calls,6);
  console.log(`Clean install passed: Node ${process.versions.node}, velocity-agent ${version}, token and browser-code authentication, private storage, workspace discovery, concurrent refresh, logout, and provider/team-bound native workers without an Anthropic API key.`);
} finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(config, { recursive: true, force: true }); }
