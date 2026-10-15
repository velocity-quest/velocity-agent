import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, writeFile, stat, rm, mkdir, chmod } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';

const prefix = resolve(process.argv[2]);
const version = process.argv[3];
const binary = resolve(prefix, 'node_modules/velocity-agent/dist/index.js');
const manifest = JSON.parse(await readFile(resolve(prefix, 'node_modules/velocity-agent/package.json'), 'utf8'));
assert.equal(manifest.version, version);
assert.equal(manifest.private, false);
assert.ok((await readFile(resolve(prefix, 'node_modules/velocity-agent/README.md'), 'utf8'))
  .includes(`npm install --global https://github.com/velocity-quest/velocity-agent/releases/download/agent-v${version}/velocity-agent-${version}.tgz`),
  'Installed README must document this immutable package version');
const config = join(prefix, 'smoke-config');
const file = join(config, 'velocity', 'credentials.json');
const code = 'a'.repeat(64);
const user = { id: 'smoke-user', email: 'smoke@example.test' };
const workspace = { id: '00000000-0000-4000-8000-000000000001', name: 'Smoke workspace', slug: 'smoke-workspace' };
let multi = false, nativePending = false, lifecycleWrites = 0;
let nativeClaudePending = false;
const claudeStatuses=[];
let apiPending = false, modelStatus = 200, modelReads = 0, inferenceCalls = 0, verifiedModel = false, modelLifecycle = 'active';
let calls = 0, refreshes = 0, refresh = 'vel_rt_smoke_initial', access = 'vel_at_smoke_initial', revoked = false, authorize;
const server = createServer(async (request, response) => {
  let data = '';
  for await (const chunk of request) data += chunk;
  const send = (value, status = 200) => { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(value)); };
  try {
    const path = new URL(request.url, url).pathname;
    if (path.startsWith('/v1/')) {
      assert.equal(request.headers['x-api-key'], 'smoke-anthropic-key');
      if (path === '/v1/models/smoke-alias') {
        assert.equal(request.method, 'GET'); modelReads++;
        if (modelStatus !== 200) return send({ type: 'error', error: { type: 'not_found_error', message: 'private-provider-secret' } }, modelStatus);
        verifiedModel = true; return send({ type: 'model', id: 'smoke-model-v1', lifecycle: modelLifecycle, display_name: 'Owned smoke model', created_at: '2026-10-15T00:00:00Z' });
      }
      assert.equal(path, '/v1/messages'); assert.equal(request.method, 'POST');
      assert.ok(verifiedModel); assert.equal(JSON.parse(data).model, 'smoke-model-v1'); inferenceCalls++;
      return send({ id: 'msg_owned', type: 'message', role: 'assistant', model: 'smoke-model-v1', content: [{ type: 'text', text: 'Owned smoke result' }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } });
    }
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
    if (path === '/api/cli/identity') return multi ? send({user, workspaces:[workspace, {...workspace, id:'00000000-0000-4000-8000-000000000002',slug:'second-workspace'}]}) : send({ error: 'old server' }, 404);
    assert.equal(path, '/api/mcp');
    const token = request.headers.authorization;
    if (token !== 'Bearer vel_mcp_smoke_only' && (revoked || token !== 'Bearer ' + access)) return send({ error: 'unauthorized' }, 401);
    const rpc = JSON.parse(data);
    if (rpc.method === 'tools/list') return send({ jsonrpc: '2.0', id: rpc.id, result: { tools: [
      { name: 'get_issue', description: 'Read the owned issue', inputSchema: { type: 'object', properties: {} } },
    ] } });
    if (rpc.params.name === 'update_agent_run') lifecycleWrites++;
    let result;
    if (rpc.params.name === 'get_current_user') result = user;
    else if (rpc.params.name === 'get_workspace') result = workspace;
    else if (nativeClaudePending && rpc.params.name === 'update_agent_run') {
      claudeStatuses.push(rpc.params.arguments.status);
      const proof=JSON.parse(await readFile(join(prefix,'smoke-claude','metadata.json'),'utf8'));
      assert.equal(proof.type,'control_request'); assert.equal(proof.request.subtype,'initialize');
      if(rpc.params.arguments.status==='completed') assert.equal(rpc.params.arguments.model,'claude-owned-model[1m]');
      result={id:rpc.params.arguments.runId,status:rpc.params.arguments.status,metadata:{}};
    }
    else if (nativeClaudePending && rpc.params.name === 'get_issue') result={identifier:'TEST-1'};
    else if (nativeClaudePending && ['get_issue_context','link_commit','add_comment'].includes(rpc.params.name)) result={ok:true};
    else if (apiPending && rpc.params.name === 'update_agent_run') {
      assert.ok(verifiedModel, 'Metadata must precede any claim');
      if (rpc.params.arguments.status === 'completed') assert.equal(rpc.params.arguments.model, 'smoke-model-v1');
      result = { id: rpc.params.arguments.runId, status: rpc.params.arguments.status };
    }
    else if (apiPending && ['get_issue_context', 'add_comment'].includes(rpc.params.name)) result = { ok: true };
    else if (rpc.params.name === 'list_workspace_events') result = {
      events: [], nextCursor: `v1:${workspace.id}:${workspace.id}:1:smoke`, hasMore: false, snapshotRequired: false,
    };
    else if (rpc.params.name === 'get_agent_loop_settings') {
      const workspaceId = request.headers['x-workspace-slug'] === 'second-workspace' ? '00000000-0000-4000-8000-000000000002' : workspace.id;
      result = { workspaceId, revision: 0, draftRevision: 0, publishedDraftRevision: null, enabled: false, protocolVersion: 2, controlScope: 'claims_and_execution', updatedAt: null, updatedBy: null,
        settings: { teamIds: [], projectIds: [], statusIds: [], selection: 'todo', concurrency: 1, providerPreference: 'configured', executionPreference: 'configured', emergencyStop: false, worktrees: false, deliveryMode: 'inherit' },
        enforcedFields: ['teamIds', 'projectIds', 'statusIds', 'selection', 'concurrency', 'providerPreference', 'executionPreference', 'emergencyStop', 'worktrees', 'deliveryMode'] };
    }
    else {
      assert.equal(rpc.params.name, 'get_pending_agent_runs');
      assert.ok([workspace.slug, ...(multi ? ['second-workspace'] : [])].includes(request.headers['x-workspace-slug']));
      if (rpc.params.arguments.tier === 'claude_code' || rpc.params.arguments.agent === 'codex') assert.equal(rpc.params.arguments.team, 'TEST');
      calls++; result = { runs: nativePending ? [{ id: '00000000-0000-4000-8000-000000000010', agent: 'codex', tier: 'local_agent',
        triggerType: 'assignment', triggerEntityType: 'issue', triggerEntityId: '00000000-0000-4000-8000-000000000011', createdAt: '', metadata: {} }] : nativeClaudePending ? [{id:'00000000-0000-4000-8000-000000000012',agent:'claude',tier:'claude_code',triggerType:'assignment',triggerEntityType:'issue',triggerEntityId:'00000000-0000-4000-8000-000000000011',createdAt:'',metadata:{}}] : apiPending ? [{ id: 'owned-api-run', agent: 'claude', triggerType: 'mention', triggerEntityType: 'issue', triggerEntityId: 'owned-issue', createdAt: '', metadata: {} }] : [] };
    }
    send({ jsonrpc: '2.0', id: rpc.id, result: { content: [{ type: 'text', text: JSON.stringify(result) }] } });
  } catch (error) { send({ error: String(error) }, 500); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}`;
async function run(args, { key = '', login = false, api = false, claude = '' } = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [binary, ...args], { env: {
      ...process.env, XDG_CONFIG_HOME: config, VELOCITY_MCP_TOKEN: key, VELOCITY_WORKSPACE: '',
      VELOCITY_API_KEY: '', ANTHROPIC_API_KEY: api ? 'smoke-anthropic-key' : '', ANTHROPIC_BASE_URL: url, SSH_CLIENT: '', SSH_CONNECTION: '',
      CODEX_HOME: join(prefix, 'smoke-codex'), XDG_DATA_HOME: join(prefix, 'smoke-data'), VELOCITY_CODEX_BIN: '',
      VELOCITY_CLAUDE_BIN: claude,
    }, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '', errors = '', entered = false;
    const timer = setTimeout(() => { child.kill(); reject(new Error(`Installed CLI smoke timed out: ${args[0]}`)); }, 30000);
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
        assert.ok(!combined.includes(code) && !combined.includes('vel_at_') && !combined.includes('vel_rt_') && !combined.includes('smoke-anthropic-key') && !combined.includes('private-provider-secret'), 'CLI printed a secret');
        // Actual API runs intentionally load the legacy SDK transport; idle/native commands must not.
        if (!api) assert.ok(!errors.includes('[DEP0040]'), 'CLI startup loaded deprecated Node punycode');
        status === 0 ? resolve(output.trim()) : reject(new Error(combined));
      } catch (error) { reject(error); }
    });
  });
}
try {
  await mkdir(join(prefix, 'smoke-codex'), { recursive: true });
  assert.equal(await run(['--version']), version);
  assert.match(await run(['run', '--help']), /--executor/);
  assert.match(await run(['login', '--help']), /--no-browser/);
  assert.match(await run(['run', '--help']), /--agent/);
  assert.match(await run(['run', '--help']), /--single-checkout/);
  assert.match(await run(['codex', 'models', '--help']), /entitlement\s+check/);
  assert.match(await run(['claude', 'models', '--help']), /entitlement\s+check/);
  assert.match(await run(['repo', 'link', '--help']), /--write-context/);
  assert.match(await run(['repo', 'cleanup', '--help']), /--run/);
  assert.match(await run(['repo', 'recover', '--help']), /--issue/);
  assert.match(await run(['repo', 'tasks', '--help']), /--repo/);
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
  await run(['run', '--once', '--executor', 'claude-code', '--workspace', '00000000-0000-4000-8000-000000000002', '--repo', prefix, '--team', 'TEST', '--base-url', url], {key:'vel_mcp_smoke_only'});
  assert.equal(calls,6);
  const catalog = JSON.parse(await run(['codex', 'models', '--repo', prefix]));
  assert.equal(catalog.entitlementVerified, false);
  assert.ok(catalog.models.length > 0 && catalog.models.every(model => model.supportedEfforts.length > 0));
  assert.deepEqual(Object.keys(catalog).sort(), ['configuredEffort', 'configuredModel', 'configuredModelListed', 'entitlementVerified', 'models']);
  assert.equal(calls,6, 'Local catalog must never call Velocity');
  const repository = join(prefix, 'smoke-native-repo'); await mkdir(repository);
  const git = args => execFileSync('git', ['-C', repository, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git(['init']); git(['config', 'user.name', 'Smoke']); git(['config', 'user.email', 'smoke@example.test']);
  await writeFile(join(repository, 'owned.txt'), 'unchanged\n'); git(['add', '.']); git(['commit', '-m', 'Initial']);
  const before = git(['rev-parse', 'HEAD']); nativePending = true;
  await assert.rejects(run(['run', '--once', '--agent', 'codex', '--workspace', workspace.slug, '--model', 'velocity-owned-unsupported-model', '--effort', 'low', '--team', 'TEST', '--repo', repository, '--base-url', url], { key: 'vel_mcp_smoke_only' }), /absent from this runtime catalog/);
  nativePending = false;
  assert.equal(git(['rev-parse', 'HEAD']), before); assert.equal(git(['status', '--porcelain']), '');
  assert.equal((git(['worktree', 'list', '--porcelain']).match(/^worktree /gm) || []).length, 1);
  await assert.rejects(run(['status', '--workspace', 'unapproved', '--base-url', url], {key:'vel_mcp_smoke_only'}), /does not authorize/);
  assert.equal(calls,7); assert.equal(lifecycleWrites,0, 'Invalid model must not claim or fail queued work');
  const claudeDirectory=join(prefix,'smoke-claude');await mkdir(claudeDirectory);
  const claude=join(claudeDirectory,'claude');
  await writeFile(claude,`#!/usr/bin/env node
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');const args=process.argv.slice(2);
if(args.includes('--input-format')){
 assert.ok(args.includes('--safe-mode')&&args.includes('--no-session-persistence')&&args.includes('--strict-mcp-config'));
 assert.equal(args[args.indexOf('--tools')+1],'');
 require('node:readline').createInterface({input:process.stdin}).on('line',line=>{
  const request=JSON.parse(line);assert.equal(request.type,'control_request');assert.equal(request.request.subtype,'initialize');fs.writeFileSync(path.join(__dirname,'metadata.json'),line);
  console.log(JSON.stringify({type:'control_response',response:{subtype:'success',request_id:request.request_id,response:{account:{key:'private-provider-secret'},models:[{value:'sonnet[1m]',resolvedModel:'claude-owned-model',supportsEffort:true,supportedEffortLevels:['low','high']},{value:'haiku',resolvedModel:'claude-owned-small'}]}}}));
 });
}else{
 assert.equal(args[args.indexOf('--model')+1],'claude-owned-model[1m]');assert.equal(args[args.indexOf('--effort')+1],'high');
 process.stdin.resume();process.stdin.on('end',()=>{fs.writeFileSync('owned.txt','native Claude changed this owned fixture\\n');console.log(JSON.stringify({result:'Owned native Claude result',usage:{input_tokens:1,output_tokens:1}}));});
}
`);await chmod(claude,0o700);
  const beforeClaudeCalls=calls;
  const claudeCatalog=JSON.parse(await run(['claude','models','--repo',repository],{claude}));
  assert.equal(claudeCatalog.entitlementVerified,false);assert.equal(claudeCatalog.models[0].model,'sonnet[1m]');assert.equal(calls,beforeClaudeCalls);
  nativeClaudePending=true;
  const claudeArgs=['run','--once','--executor','claude-code','--workspace',workspace.slug,'--team','TEST','--repo',repository,'--base-url',url];
  await assert.rejects(run([...claudeArgs,'--model','unknown'],{key:'vel_mcp_smoke_only',claude}),/absent or ambiguous/);
  await assert.rejects(run([...claudeArgs,'--model','haiku','--effort','high'],{key:'vel_mcp_smoke_only',claude}),/does not support/);
  assert.equal(lifecycleWrites,0);assert.equal(git(['rev-parse','HEAD']),before);assert.equal(git(['status','--porcelain']),'');
  await run([...claudeArgs,'--model','sonnet[1m]','--effort','high'],{key:'vel_mcp_smoke_only',claude});
  assert.ok(lifecycleWrites>=2);assert.equal(claudeStatuses.filter(status=>status==='completed').length,1);
  assert.equal(claudeStatuses.at(-1),'completed');assert.ok(claudeStatuses.slice(0,-1).every(status=>status==='running'));
  assert.equal(git(['rev-parse','HEAD']),before);assert.equal(git(['status','--porcelain']),'');
  assert.equal((git(['worktree','list','--porcelain']).match(/^worktree /gm)||[]).length,2);
  nativeClaudePending=false;lifecycleWrites=0;
  apiPending = true;
  const apiArgs = ['run', '--once', '--executor', 'anthropic', '--workspace', workspace.slug, '--model', 'smoke-alias', '--base-url', url];
  for (const status of [401, 404, 429, 500]) {
    modelStatus = status; const reads = modelReads;
    await assert.rejects(run(apiArgs, { key: 'vel_mcp_smoke_only', api: true }), /Could not verify the Anthropic API model/);
    assert.equal(modelReads, reads + 1, 'Metadata must not retry');
    assert.equal(lifecycleWrites, 0, 'Failed metadata must preserve pending work'); assert.equal(inferenceCalls, 0);
  }
  modelStatus = 200;
  modelLifecycle = 'retired';
  await assert.rejects(run(apiArgs, { key: 'vel_mcp_smoke_only', api: true }), /Could not verify the Anthropic API model/);
  assert.equal(modelReads, 5); assert.equal(lifecycleWrites, 0); assert.equal(inferenceCalls, 0);
  modelLifecycle = 'active';
  await run(apiArgs, { key: 'vel_mcp_smoke_only', api: true });
  assert.equal(modelReads, 6); assert.equal(inferenceCalls, 1); assert.equal(lifecycleWrites, 2);
  modelStatus = 401; verifiedModel = false;
  await assert.rejects(run(apiArgs, { key: 'vel_mcp_smoke_only', api: true }), /Could not verify the Anthropic API model/);
  assert.equal(modelReads, 7); assert.equal(inferenceCalls, 1); assert.equal(lifecycleWrites, 2);
  apiPending = false;
  console.log(`Clean install passed: Node ${process.versions.node}, velocity-agent ${version}, authentication/refresh/revocation, provider/team scope, native catalogs without Velocity calls, invalid native choices left pending, Claude resolved model/context/effort execution, and API metadata failure/no retries/alias pinning before claims.`);
} finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  for (const name of [config, join(prefix, 'smoke-codex'), join(prefix, 'smoke-claude'), join(prefix, 'smoke-data'), join(prefix, 'smoke-native-repo')]) await rm(name, { recursive: true, force: true }); }
