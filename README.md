# Velocity agent

Local workers for pending Velocity agent runs. This is separate from the general Velocity management CLI.

Requires Node 18.20 or newer. Install the compiled package from Velocity's public GitHub release:

```sh
npm install --global https://github.com/velocity-quest/velocity-agent/releases/download/agent-v0.5.54/velocity-agent-0.5.54.tgz
velocity-agent --version
```

After an upgrade, let active runs finish and restart the worker. An existing
process continues using the code it loaded at startup. If 0.5.18 reports
“This execution has no authenticated local connection” before claiming queued
work, upgrade to 0.5.19 and restart; the fix preserves the existing Velocity sign-in.

The package is distributed through GitHub releases, not the npm registry. Product CI builds and checks the package, then distribution CI publishes it with a SHA-256 checksum on an `agent-vVERSION` tag. The product repository and its workspace package remain private; the public distribution contains only the compiled package and release materials.

Maintainers relay a successful main **Agent CLI** workflow artifact with `node packages/agent/scripts/release-from-ci.mjs RUN_ID ENGIN-ISSUE_NUMBER` from the exact checked commit, using their existing GitHub sign-in. The relay stages that checksummed archive on a new immutable `release/agent-vVERSION` branch in the public distribution repository. It never uploads a locally built package, overwrites a candidate or publishes a release; distribution CI verifies the artifact and its branch/version identity, checks clean installs and publishes it. This avoids dispatch payload size limits and needs no registry credential or cross-repository CI secret.

For a trusted main release, maintainers can run the same workflow on temporary Linux x64 self-hosted runners labeled `velocity-agent-release`: `gh workflow run agent.yml --ref main -f runner=self-hosted`. Repository administrators must register the runners, keep them available for the package job and both Node installation jobs, and remove their registration and work directories afterward. Ephemeral runners accept one job each. PRs, pushes and dispatches of other refs always use GitHub-hosted runners. Both routes require every check and the verified artifact to succeed before relaying a release; this option does not change account billing or publish a locally built package.

Version 0.5 adds multiple workspace consent. Sign in again to expand an existing single-workspace grant; refresh never adds access automatically. Removed memberships stop working immediately.

Sign in to Velocity and select every workspace you want to authorize in your browser:

```sh
velocity-agent login
velocity-agent whoami
velocity-agent status
velocity-agent run
```

Login opens a browser and listens on an ephemeral 127.0.0.1 port. If the browser cannot reach that port, paste the full redirected URL into the terminal. For SSH, containers, or a browser on another machine, use `velocity-agent login --no-browser` and paste the value shown on Velocity's code page. SSH sessions automatically use this flow. Terminal input is hidden, and login expires after five minutes.

Saved credentials authorize exactly the selected workspace set. `run` and `status` process all currently authorized workspaces by default; `--workspace <id-or-slug>` focuses on one. They use saved sign-ins without a key, refresh automatically, and serialize refresh across CLI processes. Tokens are stored per server origin in `$XDG_CONFIG_HOME/velocity/credentials.json` (default `~/.config/velocity/credentials.json`) with mode 0600. `velocity-agent logout` revokes that server's grant and removes its entry; other server entries are preserved. Use the same `--base-url` for login, run, whoami, and logout on another instance.

Concurrent commands retry if a credential-lock owner releases or replaces its
lock during the ownership check. A genuinely abandoned credential lock requires
explicit recovery: close other Velocity commands, remove only the lock path
shown in the error, then retry. Locks are never reclaimed automatically.

For automation, create a workspace token in **Settings → MCP**, with `mcp:read` and `mcp:write`, and set `VELOCITY_MCP_TOKEN` privately. The legacy `VELOCITY_API_KEY` variable also works. An explicit key takes precedence over browser credentials. `--workspace` or `VELOCITY_WORKSPACE` is optional; if supplied it must be among the currently authorized workspaces. Keep tokens out of repository files.

## Complete work that needs no new source changes

Worker 0.5.42 streams long Claude Code runs without a cumulative output cap. It limits each event to 2 MB and pending tool state to 1,024 tools and 8 MB; malformed or oversized events, cancellation and execution timeouts still stop the run. The release also redacts supported workspace and personal API key formats from diagnostics without requiring local secret registration.

Worker 0.5.40 can reuse an earlier accepted native delivery for the same unchanged issue and exact base source. It rechecks the merged PR’s current checks and required reviews, then runs the pinned acceptance verifier when deployment is required. It creates no new commit, PR or deployment. Current authorization and workspace limits still apply.

When automatic proof is unavailable, the run remains blocked with `DELIVERY_NO_CHANGES`. Open **Review existing work** on that run, select an earlier delivery or link the existing PR in **Delivery continuations**, and run the command shown from the linked repository on the original worker host:

```sh
velocity-agent workflow verify-existing --workspace WORKSPACE --run RUN_ID --reference REFERENCE_ID --reference-kind run
```

Use `--reference-kind pull_request` for a linked PR. Add `--repo /path/to/checkout` when outside the repository. If the original run used a private workflow, supply the same `--workflow /private/workflow.json`; its command digest must match. The command locks the preserved owned task worktree, reruns validation and only the acceptance verifier, then records fresh proof. It never starts a model, commits, pushes or deploys.

The original requester must explicitly confirm acceptance in the browser within 15 minutes of verification. The issue transition and one completion comment are committed together. The original coding execution, outcome and no-change handoff remain in history, with links to the actual delivery. Changed requirements, assignment, pinned policy, current authority or minimum worker version require review or a new authorized attempt; model prose or an artifact URL alone cannot complete an issue. This flow supports merge and deployment workflows; local and PR handoffs keep their existing stopping behavior.

## Start now, select execution on the website

Worker 0.5.25 adds direct Agents-page repair, field sources and acknowledged configuration revisions. Install the verified release linked above.

After login, run `velocity-agent run` or `velocity-agent run --workspace YOUR_WORKSPACE`. No provider key, executor, model, effort, team or repository option is required to connect. Open **Agents → Local workers**, select **Fix setup** or **Configure** on this worker, choose its runtime and context, then **Save and start**. The same editor is available in **Settings → Agents → Workers**. No selection, no command or multiple detected runtimes leave the worker connected and waiting. The provider integration must still be enabled for assignments to queue.

Discovery checks Claude Code and the exact Codex runtime used by the adapter with bounded version and read-only authentication probes. The bundled Codex runtime counts as installed; it still needs your native sign-in. An executable with missing/unverified authentication is installed but unavailable. Muse is inventoried as unsupported, with no execution capabilities. Discovery never invokes login or inference, reads provider secret files or uploads raw diagnostics, account identifiers or local paths. Configured authentication does not prove model entitlement or full adapter compatibility; native catalog checks still run before claim.

Only **Anthropic API** execution requires `ANTHROPIC_API_KEY` or `--anthropic-key` locally. Selecting Claude Code or Codex uses that runtime's existing authentication. Missing authentication, unavailable executors, incompatible model/effort settings and missing repository links leave queued work pending and show a waiting reason. Correct settings or sign in with the runtime's own CLI; discovery retries every minute.

The website shows each field's source. **CLI option** fields are locked and display the explicit value even when setup is incomplete; remove that option when restarting to give the website control. Explicit CLI options always override saved preferences, including explicit false options. Omitted options never select Claude/Anthropic implicitly. `--agent codex` selects native Codex; `--agent claude` selects Claude Code unless an explicit `--executor` accompanies it. `--no-allow-delivery` overrides website push/PR authorization; `--no-single-checkout` requires task worktrees. A local `--workflow` controls delivery instead of website PR handoff. Existing shared policy can restrict these choices.

Worker 0.5.40 reports the selected delivery stop and its source in normal startup output and in **Worker details → Selected delivery stop**. A loaded workflow can select local work, a PR, merge, or deployment independently of the separate push/PR handoff option. This is a reported selection: current issue requirements, enabled saved profiles and protected workspace limits are checked for each run.

Saved settings remain pending until the worker checks and acknowledges their revision. **Needs attention** includes specific setup actions, such as selecting a team or signing in locally. During a task, the summary retains the active configuration; changed settings apply after that task, before another claim. Idle workers pick up changes on their next poll without restarting. Offline workers cannot acknowledge changes until reconnected. A conflicting save preserves your edits; **Reload settings** fetches the current revision for review. Older workers that do not report applied revisions show **not reported**; update the worker to obtain acknowledgement.

The editor can select among this machine's declared repository links, but it cannot discover an arbitrary private checkout or create runtime credentials. Run `velocity-agent repo link` once for a new checkout. Your **Delivery profile settings** are available inside your own worker editor; shared defaults and protected limits retain their existing workspace permissions. Deployment/check adapters still require a private profile-enabled host workflow; a saved delivery preference cannot create missing adapters.

A private random machine ID is stored alongside credentials as `agent-machine.json`; each process gets a separate session ID. Website selections survive restart for that machine, workspace, owner and grant. Every approved workspace registers separately, including grants with `accountAccess: false`. Members can view/configure their own workers; owners/admins can manage workspace workers. Heartbeats run every 15 seconds, inventory refreshes every minute, and 90 seconds without contact displays offline. Failed requests use bounded reconnect backoff up to 30 seconds; no work is claimed without a fresh session/configuration read. Settings edits and Start/Pause/Stop apply at the next task boundary. Existing queues and atomic run leases still own assignment; this does not schedule unassigned issues.

An older server without `/api/agent/sessions` leaves this worker waiting. Deploy the session migration and API/UI before installing the new worker. `--once` registers and performs one configured batch; waiting for website selection exits successfully, while an unavailable selected runtime or failed connection exits unsuccessfully with queued work preserved.

## Link a repository once

First configure an unambiguous **Repo → Team** or **Repo → Project** mapping under **Settings → Integrations → GitHub**. A project mapping takes precedence. Then authenticate and link its local checkout:

```sh
velocity-agent repo link --workspace your-workspace --team YOUR_TEAM --repo /path/to/repository
velocity-agent repo list --workspace your-workspace
velocity-agent run --workspace your-workspace
# On Agents, choose Fix setup, Codex or Claude Code, the team and Save and start.
```

Add `--project PROJECT_UUID` when linking a project-specific repository. The link command verifies workspace/team/project access, the server's current GitHub mapping and default branch, the local `origin` identity and local Git fetch access. It does not switch branches or stash/reset your changes. Native workers recheck the mapping before claim and delivery; a moved issue or remapped repository requires relinking. Git diagnostics and credentials are never copied to Velocity.

The options select different things:

| Option or setting | Example | Meaning |
| --- | --- | --- |
| `--workspace` | `velocity-project` | An authorized Velocity workspace slug or UUID |
| `--team` | `ENGIN` | A team identifier or UUID within that workspace |
| `--repo` | `~/projects/velocity/velocity` | A local Git checkout directory on this machine |
| GitHub team/project mapping | `velocity-quest/velocity` | The GitHub `org/repo` configured in Velocity, checked against local `origin` |

`--repo velocity-project/engin` and `--repo velocity-quest/velocity` are treated as relative filesystem paths, not remote identifiers. Directory names never choose an account, authorize a workspace or infer a team. If `~/projects/velocity` is a wrapper containing the actual checkout at `~/projects/velocity/velocity`, select the inner directory. Quote paths containing spaces; an unquoted leading `~` is expanded by your shell.

`repo list` lists only saved links on this machine for the selected server and currently authorized workspaces. An empty `[]` means no matching saved links; it does not mean GitHub has no repositories. Run `repo link` for the intended checkout and workspace/team. `repo tasks` instead lists owned local task checkouts for that Git repository and authorized workspaces; it does not list the remote issue queue. An empty task list means no matching task manifests exist locally.

`repo link` and `repo tasks` accept the current directory by default, including a subdirectory of a checkout or an owned worktree. These commands work inside the checkout:

```sh
cd ~/projects/velocity/velocity
velocity-agent repo link --workspace velocity-project --team ENGIN
velocity-agent repo tasks --workspace velocity-project
# From anywhere, explicit selection still works:
velocity-agent repo link --workspace velocity-project --team ENGIN --repo ~/projects/velocity/velocity
```

Both commands check the local path before sign-in or server repository selection; linking also requires a GitHub `origin`. Missing paths and wrapper/non-Git directories explain how to select `--repo /path/to/checkout`. Absent and non-GitHub origins have separate guidance. A mapping mismatch requires the intended checkout or a corrected authorized mapping; it never fetches the mismatched remote. Git authentication/access failures ask you to authenticate Git locally and confirm read access; Velocity browser login does not authenticate Git. Other fetch failures point to network access and the configured base branch. Messages discard raw remote URLs, credential-helper diagnostics and Git stderr.

Links are local, private and scoped to server/workspace/team/project in `$XDG_CONFIG_HOME/velocity/agent-repositories.json`. A multi-workspace worker resolves each issue separately; it does not reuse another workspace's checkout. `--repo` is an explicit checkout override; Ordinary GitHub checkouts must still match the issue mapping. LandingBoost fixes use their separately verified page/repository grant; an explicit `--repo` may select that approved page checkout even when the general GitHub mapping points elsewhere. A local repository without a GitHub origin can be used explicitly for local work, with delivery disabled.

Ordinary linking leaves repository instructions untouched. Add `--write-context` only when you want the setup command to append the verified workspace context to `VELOCITY.md` and a small reference to `AGENTS.md`. Existing text is preserved and repeated matching setup adds no duplicate section. Links, context and task manifests contain no provider keys or account tokens.

## Task worktrees and recovery

Worker 0.5.5 uses writable worktrees by default. Code lives under `$XDG_DATA_HOME/velocity-agent/worktrees` (default `~/.local/share/velocity-agent/worktrees`), outside protected Git metadata. The original Git common directory holds the ownership manifests and task locks in `velocity-agent-tasks`. Each manifest binds server, workspace, issue and run to the repository identity, branch, base commit and exact path. GitHub branch templates are reused with a unique task suffix. Worktrees start from the verified repository default-branch commit; explicit local-only repositories start from HEAD. Install project dependencies in the task checkout when needed; dependencies and private environment files are not copied automatically.

A failed or interrupted task keeps its branch, commits and diff. The source checkout stays on its original branch. A new execution of the same run resumes that owned worktree; it does not reset or replace it. Requeue/retry the failed run in Velocity before restarting a worker. List saved task identities first:

```sh
velocity-agent repo tasks --workspace your-workspace --repo /path/to/repository
velocity-agent repo recover --workspace your-workspace --repo /path/to/repository --issue ISSUE_UUID --run RUN_UUID
velocity-agent repo cleanup --workspace your-workspace --repo /path/to/repository --issue ISSUE_UUID --run RUN_UUID
```

Use `recover` only after stopping the worker. It checks that the recorded PID is dead and releases only that same task lock; live, replaced or invalid locks are refused. `cleanup` removes only a clean inactive registered worktree with matching ownership. Modified, untracked or ignored files and foreign paths/branches are refused. Preserve such files yourself before cleanup. Branches and commits remain for review/recovery; cleanup never force-removes or deletes a branch. An explicitly selected `--single-checkout` keeps the older writable-checkout mode, requires a clean source and serializes workers with the common `.git/velocity-agent.lock`. Never remove that lock until its worker is confirmed stopped. Keep `XDG_DATA_HOME` consistent for task resume/cleanup.

### Temporary storage and validation

Native attempts, host validation and built-in Vercel operations use private
temporary directories. On Linux the default volume is
`$XDG_DATA_HOME/velocity-agent/tmp`, or `~/.local/share/velocity-agent/tmp`
when XDG_DATA_HOME is unset. An explicit host TMPDIR (or TMP/TEMP) takes
precedence. Each attempt receives its own TMPDIR and Node compile-cache path;
account configuration, sign-in files and other configured caches stay in place.

The worker checks writable space and free inodes before claiming native work.
Low capacity leaves work queued and appears as temporary storage needing
attention on the Agents page. Polling checks again automatically. NORMAL output
also explains byte/inode exhaustion reported by failed commands. Check both
`df -h` and `df -i` for the affected volume: free bytes do not imply free inodes.
To choose another volume, restart with
`TMPDIR=/path/to/disk-scratch velocity-agent run` and your normal options.

An attempt removes only its own scratch directory after success, failure or
normal cancellation. On Linux and macOS, interrupted validation stops its command group before
removing scratch; the repository and preserved task worktree remain available.
Commands that explicitly write elsewhere own those files themselves. A hard
process or machine kill can leave scratch behind. Verify that the attempt and
its child processes have stopped before manually removing that directory.
The worker never sweeps shared /tmp, guesses ownership from a directory's age,
or deletes another worker's files.

## Shared workspace controls

Worker 0.5.7 reads **Settings → Agents → Loops** at startup and immediately before each claim. Emergency stop and a different provider or hosted execution preference leave this local worker waiting, without claiming or failing queued work. Disabling shared controls preserves the existing provider configuration; it does not requeue stopped runs. The runner never switches providers, models or billing methods automatically.

Each authorized workspace has a separate settings snapshot and journal cursor. The host checks committed policy invalidations at five-second heartbeat/safe boundaries, rereads after an expired cursor or journal failure, and refreshes settings at least every 30 seconds while polling. The queue interval is capped at 30 seconds; requests have a 10-second deadline. Unreadable, revoked or incompatible controls stop new work; an active task is interrupted and its changes remain available for recovery. Before commit, delivery or a final result, controls are read again. The server still enforces current scope, concurrency, integration permissions and cancellation atomically.

The configured server must support `get_agent_loop_settings`. An older server without it cannot authorize new work with this worker; update the server. Maintenance calls stay in the host and do not expose settings updates or the event journal as model tools. Existing repository links, native model/effort defaults and delivery authorization remain separate. Worker 0.5.19 also registers live runtime sessions; the full scheduler remains separate.

Before taking new queued work, the server selects eligible runs on In Progress issues already assigned to the same agent. Pending owned work comes first; already leased work stays with its owning worker and preserves configured concurrency. Native workers remain scoped to their selected team and executor. Todo-only selection governs new work and permits an existing queued assignment to continue its agent's In Progress issue. Explicit status allowlists and all other workspace/provider restrictions still apply. New work stays pending while yielding. This is server-side behavior, so existing workers need no upgrade.

Assign an issue to Codex/Claude or mention the agent to queue it; moving an unassigned issue to Todo does not queue it automatically. Blocked, review, waiting and terminal issues are skipped. Polling never restarts a failed/cancelled/completed attempt; explicitly retry/requeue a failed run to resume its preserved worktree.

Worker 0.5.17 explains idle queues and expected claim contention at normal verbosity. Shared workspace and provider concurrency limits both apply: a provider limit of two cannot override a shared Loops limit of one. Waiting output identifies the limiting setting and points to Settings → Agents; unchanged notices repeat at most once a minute. Another worker's lease is skipped without failing its run, and other eligible work continues. Genuine preflight errors remain visible, leave unclaimed work pending, and make a one-shot invocation unsuccessful.

Normal verbosity identifies each native command/tool as it starts and completes, with its exit status when reported and a bounded reason for failure. Successful output and detailed failure logs require FULL. The agent can recover and continue. Credentials and terminal controls are removed before display. QUIET suppresses step details, while FULL retains detailed diagnostics. Command failures also save redacted diagnostics in the task event, independently of console verbosity.

## Codex worker

Enable Codex under **Settings → Integrations → Codex**, then assign an issue to Codex or mention `@codex` in a comment. Sign in with `codex login`, or privately set your own `CODEX_API_KEY`.

```sh
velocity-agent status --agent codex --team YOUR_TEAM
velocity-agent run --agent codex --repo /path/to/repository --team YOUR_TEAM
```

The worker only claims Codex issue runs in the selected team and authorized workspaces. Add `--workspace your-workspace` to focus on one; without it, each approved workspace is polled in turn. Use a writable Git checkout with an initial commit and configured Git author. The default creates an owned writable worktree and task branch without changing the source checkout or its tracked, untracked or ignored files. Retried runs resume their saved branch and recoverable diff. Codex uses `workspace-write` with Velocity MCP tools and tests and edits code there. Issue text and comments are untrusted task data. The runner commits successful changes and links their real SHAs, then posts the final result as the Codex virtual member. Failed or stopped attempts cannot post a success result.

Worker 0.5.31 lets both Codex execution paths report outcomes through their
authorized Velocity MCP tools without an interactive approval prompt. There is
no Agents-page approval switch for this. If an older resumable worker says
`report_agent_outcome` requires approval while approvals are disabled, update
the worker and restart it. Shell escalation, unrelated MCP tools and interactive
approval requests remain unavailable. A separate delivery error such as
`CI_FAILED` must still be corrected before delivery can continue.

Delivery follows the selected host workflow and website settings, within workspace limits. With no delivery configured, commits stay local. `--allow-delivery` explicitly authorizes PR handoff and `--no-allow-delivery` explicitly keeps work local; CLI options override the website. A configured full workflow can also check, merge, deploy and close the issue after its required evidence passes. The model cannot perform those host-owned effects itself; restricted model Git tools do not mean host delivery is disabled. Native execution is unattended, bounded to 30 minutes and renews its lease; stale recovery fails abandoned work. Velocity's optional action checkpoint is unsupported for native workers and off by default.

Codex uses your own account and configured model/effort, without Velocity AI metering. `--model` and `--effort` are optional explicit overrides; omit both to preserve native defaults. `VELOCITY_CODEX_BIN` can select an installed compatible Codex binary. The package includes the Codex SDK's native runtime. One runner executes one task at a time; independent runners use separate owned worktrees. See recovery below for interrupted tasks.

Worker 0.5.8 checks an explicit Codex override against that exact execution
runtime's catalog before claiming a run or changing a checkout. An omitted
model or effort comes from the selected repository's native configuration (or
the runtime's default when unconfigured). The verified pair and provider carry
into the task worktree; the worker never silently changes to a different pair.
Unsupported choices or unavailable metadata leave queued work pending. Correct
the flags/native configuration and restart, or remove both overrides to use the
existing native default behavior.

```sh
velocity-agent codex models --repo /path/to/repository
```

This local command needs no Velocity sign-in and starts no thread or inference.
It displays model/effort/default metadata only, with `entitlementVerified: false`.
The runtime catalog may be cached and is not proof that your account can use a
model. Normal execution still handles provider authentication and access errors.
Catalog reads time out after 15 seconds and honor cancellation; older or custom
Codex binaries must support the read-only app-server config/model methods. The
0.5.11 candidate also resolves and pins default choices through this metadata
check, so removing overrides does not bypass an unavailable catalog.

## Claude Code worker

Install Claude Code, then sign in with `claude auth login`. The worker starts the installed CLI using its existing authentication; it does not obtain or proxy Claude subscription credentials.

```sh
VELOCITY_WORKSPACE=your-workspace velocity-agent run \
  --executor claude-code --repo /path/to/repository --team YOUR_TEAM
```

Enable Claude Code execution and select it as the desired execution method in Velocity. The worker only selects pending issue runs for the specified team and workspace. It uses an owned writable worktree for each task, edits and runs checks there, and preserves the source checkout. The runner commits any remaining task edits, links the actual SHAs, and handles the effective host delivery workflow after rechecking the server lease, permissions and repository mapping. Configure delivery on the Agents page or use an explicit CLI override. Git/GitHub authentication must be available locally for delivery.

Native Claude Code does not implement Velocity's optional approval checkpoint. A workspace that requires that checkpoint cannot dispatch work to this worker; use the API executor for that policy. No checkpoint is required by default.

Worker 0.5.10 validates explicit `--model` and `--effort` choices before Git
fetches, claims or checkout changes. A listed alias resolves to one model ID,
and the same native executable, resolved model and optional effort are used for
execution and result attribution. Claude effort overrides require an explicit
model so the worker can verify the pair; omit both flags to retain native
configured defaults. Invalid choices, unavailable/old metadata and cancellation
leave work pending. Correct the flags or upgrade Claude Code and retry.
Advertised long-context suffixes such as `[1m]` are retained when resolving an alias.

```sh
velocity-agent claude models --repo /path/to/repository
velocity-agent run --executor claude-code --team YOUR_TEAM --model LISTED_MODEL --effort high
```

The local catalog command requires no Velocity sign-in and sends no user prompt
or inference request. It uses Claude Code's metadata-only SDK initialize
exchange, safe mode, disabled tools/hooks/MCP and no persistent session. Only
model IDs and supported efforts are displayed, with `entitlementVerified: false`;
account details and raw runtime diagnostics are discarded. The read has a
15-second deadline and honors cancellation. Catalog compatibility does not
guarantee provider access or quota. `VELOCITY_CLAUDE_BIN` selects the native
executable; otherwise it is resolved from PATH. Custom/older runtimes must
support safe-mode initialization with resolved model metadata to use overrides.

## LandingBoost fixes

Mapped LandingBoost fixes require the 0.5.3 worker (or later) with its approved GitHub checkout. The public installation above supports these tasks; older workers leave them pending.

In Velocity's LandingBoost settings, map the exact page, its approved `org/repo`, and Claude Code or Codex. Enable assignment events for that native agent. With **Manual handoff**, load delivery status and choose **Queue agent fix** for a current ready finding; automatic work can remain off. To start fixes as callbacks arrive, choose **Queue a native agent** and also enable automatic work. Saved plans that need input or review and monitoring notifications do not schedule fixes. Ordinary issue assignment remains available.

The worker verifies `origin` against the page grant before claiming a task or editing and uses an owned writable worktree. Its local Git sign-in reads the approved repository’s default branch; a generic issue mapping does not override the page grant. An explicit `--repo` can select the approved checkout, or an unambiguous saved link for that repository can be reused. `--allow-delivery` requires the workspace GitHub issue mapping to match the approved page repository before any host push/PR; a mismatch preserves local commits and reports the needed correction. Existing source-checkout changes are preserved. The platform rechecks the latest saved report at claim and stops revoked connections, mappings or permissions; manual handoff also requires the initiating person's current workspace admin access. Repeated findings reuse one run across manual clicks, callback retries and reconnects. Inspect the linked issue for actual checks, commits and proposed changes, and the LandingBoost delivery panel for run status. A failed fix can explicitly retry the same run twice; retries do not start new scans or deploy changes.

## Native usage and cost

Worker 0.5.15 records native model usage separately from Velocity
AI credits. Requires the native usage server/migration. Codex now
resolves and pins inherited native defaults before claiming work. Claude Code
captures resolved models from terminal telemetry when supported. Run details
label API-equivalent estimates, actual reported charges and unavailable data;
subscription estimates do not imply an additional invoice or marginal charge.
See [native usage and pricing coverage](https://docs.velocity.quest/integrations/codex).

## Anthropic API worker

Set your `ANTHROPIC_API_KEY` and enable Local API execution in Velocity:

```sh
VELOCITY_WORKSPACE=your-workspace velocity-agent run --executor anthropic
```

Worker 0.5.9 verifies the configured model through the same API client before claiming a run. A valid alias resolves to one model ID used for every turn and the run result; each subsequent attempt checks again. Invalid models, unavailable metadata, missing credentials and cancellation leave queued work pending. The metadata check has a ten-second deadline with no automatic retry and does not run inference or guarantee remaining credits. Use `--model MODEL_ID` to select an available model; the worker never falls back to another model. Idle polling, status and native workers do not make this API check.

This method calls the Anthropic API and uses API billing. It is not Claude Code subscription execution. Your Anthropic key stays on your machine.

## PRDs and user stories

Worker 0.5.4 adds PRD, requirement and user-story context and manual planning operations to Claude Code and Codex. The configured Velocity server must provide the planning MCP tools. Only operator-selected changes should be applied; PRD approval always remains with a human.

The API executor discovers its issue and planning schemas through authenticated `tools/list` for the current workspace and execution. It does not carry a separate copy of the server schemas or grant account administration/deletion tools. Discovery has a 10-second deadline, a 1 MB response limit and a bounded, two-minute in-memory cache scoped to the exact claim. An older server without planning tools can still provide ordinary issue tools; a missing or malformed catalogue fails the run before a model request.

The API executor can also request metered planning proposals. It presents generated proposals for human review and cannot apply them in the same execution, including by creating an ordinary issue. Apply the selected changes in a subsequent explicitly requested manual run. Cost estimates alone do not create proposals. Native workers expose manual planning tools, without enabling the platform's AI proposal tools. Planning writes remain subject to current role/scope, run policy, emergency stop and server validation; restricted automation and source-bound LandingBoost fixes cannot use them to expand their scope. Platform AI plan, credit and budget rules remain in force.

Use `--base-url https://your-velocity-instance.example` for a different server, `--once` for one batch, and `velocity-agent run --help` for all options. `velocity-agent status` reports pending local API runs; it does not prove that a native worker is online. Enable a worker only for repositories and team work you authorize it to process.

### Console verbosity

Set `velocity-agent run --verbosity QUIET|NORMAL|FULL` or
`VELOCITY_AGENT_VERBOSITY`. Values are case-insensitive; the command-line option
overrides the environment variable. Invalid values stop startup.

| Level | Console output |
| --- | --- |
| `QUIET` | Warnings and errors only. |
| `NORMAL` (default) | Work-start notices after a successful claim, progress, issue comment/status actions and concise command/tool identities and outcomes. Failures include a brief reason. Full command output, detailed logs, model text and tool arguments/results require FULL. |
| `FULL` | All available execution events, including model text, prompts, commands/output, tool inputs/results, native diagnostics and runner activity. |

```sh
velocity-agent run --agent codex --team YOUR_TEAM --verbosity FULL
VELOCITY_AGENT_VERBOSITY=QUIET velocity-agent run --executor claude-code --team YOUR_TEAM
```

The level applies to the runner, Codex, Claude Code, API execution and live
progress output, including `--once`. It controls worker activity logs; commands
such as `login`, `status` and `repo list` retain their requested output.
`FULL` is a local diagnostic view and can display sensitive issue and repository
material. Authentication headers and credential configuration are not logged;
known worker/environment credentials and structured credential fields are
redacted. This is not a general-purpose secret scanner for arbitrary file or
command output. All levels publish the same progress codes and bounded,
redacted command failure diagnostics to Velocity. Other detailed console activity
remains local.

Execution summaries are bounded to 240 characters each for the command/tool
identifier and failure reason. They may include paths or task content from a
command. Successful command output is omitted. For example:

```text
[velocity-agent] Command succeeded (exit 0): pnpm test
[velocity-agent] Command failed (exit 128): git fetch origin — fatal: unable to connect: Connection refused
[velocity-agent] Tool succeeded: velocity/get_issue_context
```


Shared execution controls require worker 0.5.7 or later. **Require isolated worktrees** keeps workers with `--single-checkout` and API-only workers idle. **Local changes only** overrides `--allow-delivery`: the host keeps and links local commits without pushing or opening a PR. Existing delivery permissions still require local `--allow-delivery`; shared settings never grant it. Controls refresh before delivery, and restrictions changing in flight preserve your local changes. Delivery eligibility can only narrow during a run; lifting local-only controls applies to a subsequent attempt after fresh repository verification. Older workers cannot claim work while these restrictions are active. Private draft preferences are not activated by upgrading.

### Delivery authorization and recovered runs (0.5.36)

Allow delivery selects what a worker may attempt. Current issue ownership,
workspace policy, integration approval requirements and the authenticated
connection still apply. When one prevents delivery, normal output identifies
the issue/run and explains the specific restriction and where to review it.
Temporary failures are checked again after 30 seconds; unchanged messages are
repeated at most every five minutes.

A closed issue, changed source/workflow or superseded execution needs a new
authorized attempt rather than replaying the old delivery. The worker records
a local stop and preserves the branch and worktree. When external delivery is
recorded on an already closed issue, follow its links on the original run page.
This reconciliation does not rewrite the original model outcome or claim that
the old worker completed delivery itself.

### Live run progress

Upgraded workers publish safe activity to the terminal and the run detail page
through `append_agent_run_events`. Deploy the run-progress migration and API
before installing the upgraded worker. Older servers show a telemetry warning;
execution and existing lease/stop checks continue. The detail page refreshes
automatically while visible, resumes from its last event cursor after a network
failure, and can load earlier pages. It retains the latest 2,000 events per run.
A worker restart uses a new execution lease; previously recorded history remains.

Progress includes checkout preparation, SDK activity, tools, recognized validation
commands, commits, delivery and the server-recorded terminal outcome. Native Codex
provides command exit status. Claude Code reports tool boundaries; validation
results without an explicit exit status say so. The API executor reports turn and
tool boundaries. Failed commands retain the command (up to 4,000 characters),
the actual exit code when reported, and up to 8,000 characters of output. Long
output keeps its beginning and end and is marked truncated. Known credentials,
common credential syntax and terminal controls are removed before upload.
Confirmed process-launch failures, including `Text file busy`, have a separate
event and no invented exit code; missing exit status without launch evidence
remains unknown. Native runtimes own command retries: the worker does not replay
a task or command with potentially completed side effects. A later retry result
is recorded separately, preserving the earlier failure.
Unknown SDK events, other tool arguments/results and private reasoning are
omitted; `FULL` console output includes available execution events.
Deploy `20261016160000_agent_command_diagnostics.sql` and the API before upgrading
workers to this diagnostic format. CI/review/deployment waits require an executor to
report them explicitly; opening a PR does not mean those steps completed.

Last worker contact is independent of activity. A quiet connected task can still
be working; contact older than 30 seconds is shown as stale. Execution completion,
worker completion and delivery are displayed separately. Delivery remains local
unless authorized by the operator and workspace controls. A dropped telemetry
response is retried with the same sequence; a partial outage keeps prior history
and buffers up to 2,000 pending events in memory. Unsent events can be lost when a
worker process exits during an outage; accepted events survive refresh/reconnect.


### Task identity and final worker status (0.5.26)

Every task-related output line includes its workspace and issue identifier, for
example `[velocity-agent] [my-workspace ENGIN-629] command started`. Multiline
errors retain the same identity on every line. Workspace heartbeats keep their
own scope; unavailable identifiers use a bounded run ID.

Before a clean or error exit the worker attempts a bounded final status report.
The Agents page distinguishes stopped workers from error exits, and late
heartbeats cannot revive that same exited session. Reporting failures preserve
the original exit outcome. A new process registers a new session.

### Configure deployment commands on the Agents page (0.5.27)

Expand **Worker details and settings**. The worker’s owner can enable website
workflow commands, select the default delivery stop, and enter named validation
checks plus deployment and acceptance commands. Use `Name :: executable arguments`
for each validation line. Save and start; the worker loads changes before the next
task, reports its applied revision and loaded capabilities, and rechecks the saved
revision before claiming. An active attempt keeps its pinned workflow.

Choose **Vercel** to use built-in deployment and HTTP acceptance. Supply the
project/team IDs, existing production URL, acceptance path and expected response
text. Vercel CLI and its local sign-in (or VERCEL_TOKEN) must be available on this
host. The worker builds from a clean checkout of the exact merged commit, waits
for Ready, guards production alias changes, promotes the selected project, and
checks the source/artifact/alias identity around the HTTP 200 and response-text
check. It refuses to replace a known deployed descendant with older source and
can reuse an already Ready exact-source artifact. Custom commands support more
involved acceptance, multiple projects and other providers. No token enters the
website settings, child command arguments or recorded receipt.

Commands execute directly in the task checkout. Use real scripts for shell pipelines
and provider adapters. The deployment and acceptance receipt contract is documented
below and in the editor. Credentials remain in the host environment or provider
sign-in; do not paste them into website commands. Only the machine owner’s signed-in
browser can change executable commands. Issue text and managed tools cannot.

An explicit `--workflow` file takes precedence; its changes require a restart.
Explicit `--allow-delivery` or `--no-allow-delivery` also override website workflows.
Protected requirements are never lowered to clear a blocker. A blocked preflight
identifies the issue and missing commands once at NORMAL verbosity, keeps unclaimed
work queued, and permits other compatible issues. Only successful preflight or an
authoritative empty eligible queue clears it. Details show the actual reported
worker version separately from the native runtime version; older workers need an
upgrade to enable website command configuration.

### Discover project workflow defaults (0.5.30)

The worker retrieves the Vercel project linked with `vercel link` in its selected
checkout. New workflow drafts automatically fill project/team IDs and a single
verified production URL. When several production domains exist, choose one in
**Use discovered settings**. Validation commands, a conventional health endpoint
and the applicable `vercel.json` path are detected from the selected application.
Review the editable draft, then save and start; discovery never enables delivery.

For Node projects, discovery reads `package.json`, the package manager and lockfiles.
It prefers `test:ci` over `test`, then typecheck and lint, with build as a fallback
when no validation scripts exist. Commands target the selected app in a monorepo.
Known watch scripts are omitted; a simple Vitest script receives `--run`. Other
project types or missing scripts need a manual validation command or an explicit
validation waiver. Script bodies are never uploaded or executed during discovery.

Next.js App/Pages and conventional Vercel health files supply `/api/health`,
`/health`, `/healthz` or `/readyz`. A literal Next.js `basePath` is included.
Only a simple constant successful response supplies expected text. Dynamic
responses use an explicit **Only require HTTP 200** check; when no health route
is found, the default checks `/`. Redirects and non-200 responses fail acceptance.
A status check still requires the exact source, project, Ready artifact and
production alias. Add a stronger text check or custom acceptance command for
application-specific requirements. Existing saved workflows and manual edits,
including deliberately emptied fields, are preserved on refresh.

Discovery uses local Vercel sign-in or `VERCEL_TOKEN`; no provider credential,
absolute checkout path, environment variable or raw API response is sent to Velocity.
It reads `.vercel/project.json`, bounded project files and only Vercel’s read APIs. It does not
deploy, link a project, run repository scripts or enable delivery. A monorepo’s
selected checkout must have the intended project link; custom/multiple-project
workflows and manual fields remain available.

Details refresh automatically about once a minute and arrive on the next
heartbeat. Missing links, sign-in and access errors appear in the form. An
explicit `--repo` wins over website repository selection; otherwise select an
unambiguous workspace/team/project repository link. Old servers keep working
without discovery, and older workers show upgrade guidance in the website.

### Private delivery configuration

Run a native worker with `--workflow /absolute/path/workflow.json`. Keep the file
private (`chmod 600`); commands come from the operator, never issue prose.
Existing local-only behavior and the legacy `--allow-delivery` PR handoff remain
available. Choose one option. Example for a repository whose tests are `pnpm test`:

```json
{
  "version": 1,
  "policy": {
    "mode": "merge",
    "validationRequired": true,
    "deploymentRequired": false,
    "maxRepairAttempts": 1
  },
  "checks": [{ "name": "Repository tests", "argv": ["pnpm", "test"] }]
}
```

Modes `local` and `pr` produce explicit handoffs without marking the issue Done.
Modes `merge` and `deploy` require workspace owner/admin access. Protected workspace
limits, current membership/grants, mapping, approval settings and emergency stop
remain authoritative. Validation is bound to the exact Git tree, including new
files. Required checks cannot be skipped. For an intentional low-impact skip,
set `validationRequired: false` and a meaningful `skipValidationReason`.
Commands execute without a shell; pass credentials through the environment,
never argument values. Outcomes, command identities and source SHAs are recorded.

A deployment requirement needs `mode: "deploy"`, `deploymentRequired: true` and
`deployment: { "deploy": ["your-release-script"], "verify": ["your-acceptance-script"] }`.
Both adapters receive `VELOCITY_DELIVERY_SOURCE_SHA` containing the confirmed
merge SHA. Deploy prints a single JSON receipt `{ "sourceSha": "...", "artifactId":
"...", "url": "https://..." }`; diagnostics go to stderr. Verify receives the
receipt on stdin, verifies the actual released artifact and meaningful acceptance
checks, and prints the same identity with `"acceptancePassed": true`. No adapter,
failed acceptance, or a source mismatch means no Done. Merge-only never claims
a production deployment. Operator scripts must be idempotent for the source SHA.

CI waits persist in Velocity and in private Git metadata, release the native
turn, and resume on a later poll/restart with the same authorized account,
repository mapping and configuration. An active checkout lock cannot be stolen;
after confirming a crashed worker is stopped, use `velocity-agent repo recover`.
Jobs preserve their original stop point and commands, so editing a configuration
cannot silently upgrade an existing job. Relevant validation/CI failures may
queue 0–3 bounded native repair attempts (default 0), retaining the original
runtime deadline. Exhaustion records Blocked and preserves work. Provider outages
wait for a later poll without another coding turn. GitHub checks/reviews are
re-read on the exact PR SHA at the merge boundary, without protection bypass.

The run detail page distinguishes coding completion from validation, PR, CI,
merge, deployment and issue closure. The final evidence comment and Done transition
commit together and survive a lost response without duplication. Saved delivery profiles and per-issue choices refine the same operator workflow as described below.

When another run or person takes over, open **Delivery continuations** on the
original run and link the specific successor run, PR or follow-up contact. The
successor links back to its originating runs. Coding completion and an issue
marked Done never establish deployment acceptance. A removed source or repository
grant hides its old references; the original run's execution outcome is retained.

A failed Vercel build or acceptance check records a blocked handoff rather than
starting another deployment on each poll. Temporary provider API failures keep
the existing delivery stage pending without another coding turn.

For a deployment completed outside that run, an owner/admin can record a host
acceptance receipt for its merged PR. With the Vercel preset, rerun the same
`velocity-agent workflow vercel-verify` command with `--external-receipt`, passing
the deployment receipt on stdin and redirecting stdout to a private JSON file.
This performs the real Ready, exact-source, production alias and HTTP acceptance
checks. Artifact links identify the immutable deployment; HTTP acceptance checks
the configured production origin. Then run:

```bash
velocity-agent workflow record-delivery --workspace my-workspace \
  --run ORIGINAL_RUN_UUID --pr https://github.com/org/repo/pull/123 \
  --receipt /private/path/accepted-deployment.json
```

The host uses its existing Velocity authentication. The server confirms the
current repository mapping, exact merged commit, head checks and required reviews,
and records a PR origin reference before accepting the receipt. A missing check,
rejected acceptance or revoked authorization keeps delivery unverified. Recording
external acceptance does not change the original execution result or close the
issue. Review and close the issue separately after its acceptance criteria pass.

Stop an unfinished workflow from its run detail page (runner owner or workspace
administrator), even after the coding turn has completed. This records Blocked
and preserves code. A single checkout stays reserved for its pending delivery;
only its queued repair may resume until the workflow hands off or finishes.

### Per-issue model choices (worker 0.5.16)

Open **Agent model overrides** on an issue to save model/effort choices separately
for `codex`, `claudeCode` and the local `anthropic` API worker. Empty fields inherit;
clear all overrides to restore defaults. Claude Code effort requires a model;
Anthropic API accepts a model only. Hosted execution keeps its platform policy.

Explicit `--model` and `--effort` flags override their corresponding issue fields.
Issue fields override inherited worker/provider defaults. Shared workspace scope,
concurrency, runtime, stop and delivery limits remain authoritative. This feature
does not select another billing method, provider, repository or permission grant.

The worker reads server-authoritative settings before Git fetches/claims and
validates them using its exact native runtime or API metadata client. Invalid or
unavailable settings leave work pending. Current settings apply to queued/new
attempts; running attempts and approval resumes retain their validated selection.
Older workers cannot claim applicable issue overrides. A pre-upgrade suspended API
conversation without a saved choice requires recovery using its original worker.

Issue editors with member access can read/set/clear settings through GraphQL,
REST, MCP `create_issue`/`update_issue`, and management CLI 0.2.25. Managed workers
cannot edit these execution settings. See the public Codex/Claude integration
guides for API fields and CLI examples; model IDs and effort are configuration,
never credentials.

### Per-issue workflow choices (worker 0.5.22)

Open **Agent workflow** on an issue before assigning an agent. Choose local
implementation, PR handoff, merge after CI, or deployment with verification;
require validation and name existing host checks. Save applies settings only to
that issue. **Clear workflow overrides**, then Save, restores inheritance and
clears recorded cues. Merge and deployment require an owner or admin.

The worker inherits its profile/user delivery preference when no issue choice
exists. An explicit `--workflow` wins by default. To let authorized issue choices
replace its defaults, add `"issueOverrides": true` alongside `"version": 1` in
the private workflow file. Website workflows provide the same opt-in in the editor.
An issue cannot remove required host checks, supply commands, bypass workspace
approval or repository protections, or authorize merge for a member. An explicit
CLI delivery flag also takes precedence. The preview uses recent connected-worker
reports; the worker resolves actual settings again before claiming.

For a direct user cue, write one of these lines in an issue description paragraph
or a new comment in Velocity:

```text
/agent-workflow implement and test only
/agent-workflow open a PR but do not merge
/agent-workflow complete delivery and mark Done after verification
```

Use only one directive. `local`, `pr`, `merge`, `deploy` and `inherit` are also
supported. Quoted text, code, attachments, imports, API text and agent comments
cannot grant rights. Structured overrides take precedence over cues. Conflicting
or unsupported directives need a structured selection before work proceeds.
The issue shows the recorded interpretation and source, effective worker values,
and the last pinned attempt/revision.

Queued changes apply on the next attempt. A workflow edit during active work
stops delivery at the next authorization boundary and requires a new attempt;
it never silently widens an existing attempt. Once delivery is prepared, reassign
the agent to start a new run; an ordinary retry preserves the original delivery
evidence. Recover saved changes with `velocity-agent repo tasks`. Changes and immutable attempt
receipts are audited. Local edits remain available for recovery. A worker without
configured checks/adapters reports unsupported settings and leaves work queued.


### Saved delivery profiles (worker 0.5.24)

In **Settings → Agents → Delivery profiles**, owners/admins save shared defaults
and protected limits; members save their own preferences within those limits.
Personal preferences belong to the connected worker’s signed-in account in this workspace.
Stable IDs are `codex`, `claudeCode` and `anthropic`. Codex/Claude Code support
native delivery. Claude API has no native Git/CI/deployment adapter support; that profile is read-only.
Capabilities are defined by the installed release, not a second platform defaults
system. Model/effort settings remain independent.

Profiles support `local`, `pr`, `merge` and `deploy` stops, validation and deployment
verification requirements, and named host checks. Local/PR stops preserve an open
issue for handoff. Merge/deploy require current owner/admin authority. CI/review
and closure dependencies cannot be disabled separately. Deployment requires both
operator-owned deploy and acceptance adapters.

Add `"profilePreferences": true` once to the private `--workflow` file to inherit
saved defaults/personal preferences without repeating `--allow-delivery`. Keep
credentials on the host; commands may also be configured in the owner-only website editor. Existing files keep their
explicit stop; existing local-only installations are never automatically upgraded
to delivery. `--no-allow-delivery` stays authoritative. A workflow and an explicit
delivery flag are mutually exclusive. To allow only per-issue choices while
retaining host defaults, the existing `issueOverrides` opt-in remains supported.

Protected system/workspace/provider policy and profile limits apply first. Within
those boundaries, precedence is explicit CLI > issue/cue > personal > shared >
host fallback. Host-required checks and deployment verification cannot be waived.
A nonempty check list requires validation. An empty personal check list clears inherited check preferences; protected check names remain required.
A profile grants no repository, credential, GitHub or deployment access.

The connected worker reports the next-attempt profile, shared/personal revisions,
sources and missing checks/adapters. Claim pins the profile with the issue choice;
write and delivery boundaries revalidate it. Any saved edit requires a fresh
attempt, even if it only relaxes a limit: in-flight delivery cannot gain rights.
Retry preserves prepared evidence; reassign for a new run and recover saved work
with `velocity-agent repo tasks`. Older workers cannot ignore newly configured
shared profiles: upgrade them. Run details show frozen settings separately from
actual delivery progress. Settings retain an audit history of shared and your own
changes.

Use MCP `get_agent_delivery_profile` / `update_agent_delivery_profile` or GraphQL
`agentDeliveryProfile` / `updateAgentDeliveryProfile`. Updates require both the
edited scope's `expectedRevision` and `expectedSharedRevision`; reload conflicts.
Personal settings are the workflow fields above; shared settings contain
`defaults` plus `limits` (`maxMode`, `validationRequired`, `deploymentRequired`,
`requiredChecks`). Clear personal settings with `{}` to inherit again. Caller
identity owns personal preferences; no user selector is accepted. Managed runs
cannot change these controls. The management CLI exposes `agents delivery-profile`
and `agents update-delivery-profile` in the selected authorized workspace.


## Live provider sessions and steering

New session-control servers let native Codex workers use Codex App Server. The worker records the provider thread and active turn, streams progress, and accepts separately authenticated operator steering. Existing servers and older workers retain their one-shot executor; they do not advertise live steering.

For code-capable Claude Agent SDK execution, configure a local `ANTHROPIC_API_KEY` (or `--anthropic-key`) and select the native `claude-code` executor. The packaged SDK provides its code harness; it uses a private session directory and does not inherit Claude subscription or OAuth sign-in. Without an API key, the existing local Claude CLI executor remains available and does not offer these session controls. The `anthropic` executor remains the separate metadata-only Messages tool loop.

An owner or admin can read `velocity-agent session status --run <run-id>` and then use `steer`, `interrupt`, or `resume` for that run. Commands include the expected execution, generation, provider session and turn. Refresh status after a turn changes. An old command cannot interrupt a newer turn, and an operator removed before command delivery loses authority over queued commands too.

Codex steering targets the active turn. Claude SDK steering is queued for the next turn boundary. Model and effort changes require an interrupted session and a supported resume boundary; provider changes require a new run. Explicit CLI model and effort settings take precedence over web/operator overrides. Protected workspace model constraints still apply. Unsupported operations are rejected and reported in session status rather than silently choosing another model or executor.

Interrupting preserves the owned task worktree and provider session. The worker stays connected and maintains its lease while waiting for an explicit resume, subject to its run timeout and current authorization. Lease loss, membership/grant revocation, stop controls and shutdown stop execution and retain local state; they do not authorize automatic re-execution. A recovered active session requires an explicit resume. Checkpoints are private under the local Velocity agent data directory; `VELOCITY_SESSION_STATE_ROOT` can place them in a persistent, tenant-isolated hosted directory. Preserve the corresponding provider session files as well.

Issue/comment journal events invalidate queue selection at the next task boundary. Priority, due date and age are handled deterministically; comment text cannot grant steering authority, expand scope or become a system instruction.

Provider contracts: [Codex App Server](https://learn.chatgpt.com/docs/app-server), [Claude Agent SDK overview and API authentication](https://code.claude.com/docs/en/agent-sdk/overview), [streaming input](https://code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode), and [session resume](https://code.claude.com/docs/en/agent-sdk/sessions). Runtime-specific wire fields are checked against the pinned Codex runtime's generated schema.

### Issue monitoring (0.5.32)

Workers can call `monitor_issue` for issue-scoped committed edits, linked integration callbacks and agent status changes. Resume with its cursor and reread issue context before acting. `wait_for_issue_checks` waits up to 20 seconds for the exact linked PR, repository, branches and head; repeat the same call after timeout. Completion can mean failed checks. Neither tool starts a background model turn or grants merge/deployment authority; emergency stops and execution leases still apply.

### User configuration for a hosted run

In a pending Claude Code issue run, open **Hosted execution → Run in Instabox**
and select an optional **Agent configuration** JSON file before queuing. The
file is an explicit selection for this run; Velocity does not copy the machine
operator's home or another user's saved settings. For example:

```json
{
  "version": 1,
  "files": [
    { "path": ".claude/CLAUDE.md", "content": "Use concise explanations." },
    { "path": ".claude/settings.json", "content": "{\"language\":\"French\",\"alwaysThinkingEnabled\":true}" },
    { "path": ".claude/skills/review/SKILL.md", "content": "---\nname: review\ndescription: Review changes\n---\nCheck tenant isolation." }
  ]
}
```

Bundles are limited to 6 KB of JSON and 20 files. Supported paths are
`.claude/CLAUDE.md`, `.claude/settings.json`, and Markdown files under
`.claude/skills/<skill>/`. User settings accept `language`, `outputStyle`, and
`alwaysThinkingEnabled`. Authentication, environment, permissions, hooks and
MCP settings stay controlled by the hosted workflow; credential files are
rejected. The same bundle can be sent as `agentConfiguration` with the
browser-authenticated `/api/agent/hosted` `enqueue` action.

The server requires `INTEGRATION_ENCRYPTION_KEY`, encrypts the entire selection
at rest, and binds it to the submitting user, workspace and run. The guest
fetches it using the active run capability, installs private files in a fresh
attempt home under `/run`, and loads only those user settings. Transfer or
setup failure stops execution and reaches the existing hosted result workflow.
Raw process logs are disabled for configured runs; diagnostic redactions and
checkpoint scanning also protect selected file contents. Configuration and
provider session state for these runs stay ephemeral; repository work and
sanitized hosted result evidence remain checkpointed. A resumed task must
install its configuration again with a newly authorized attempt. Existing runs
without a selection keep their current behavior.
