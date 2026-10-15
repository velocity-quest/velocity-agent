# Velocity agent

Local workers for pending Velocity agent runs. This is separate from the general Velocity management CLI.

Requires Node 18.20 or newer. Install the compiled package from Velocity's public GitHub release:

```sh
npm install --global https://github.com/velocity-quest/velocity-agent/releases/download/agent-v0.5.7/velocity-agent-0.5.7.tgz
velocity-agent --version
```

The package is distributed through GitHub releases, not the npm registry. Product CI builds and checks the package, then distribution CI publishes it with a SHA-256 checksum on an `agent-vVERSION` tag. The product repository and its workspace package remain private; the public distribution contains only the compiled package and release materials.

Maintainers relay a successful **Agent CLI** workflow artifact with `node packages/agent/scripts/release-from-ci.mjs RUN_ID` from the exact checked commit, using their existing GitHub sign-in. The relay never uploads a locally built package or publishes a release; distribution CI verifies the artifact and publishes it. This flow needs no registry credential or cross-repository CI secret.

For a trusted main release, maintainers can run the same workflow on temporary Linux x64 self-hosted runners labeled `velocity-agent-release`: `gh workflow run agent.yml --ref main -f runner=self-hosted`. Repository administrators must register the runners, keep them available for the package job and both Node installation jobs, and remove their registration and work directories afterward. Ephemeral runners accept one job each. PRs, pushes and dispatches of other refs always use GitHub-hosted runners. Both routes require every check and the verified artifact to succeed before relaying a release; this option does not change account billing or publish a locally built package.

Version 0.5 adds multiple workspace consent. Sign in again to expand an existing single-workspace grant; refresh never adds access automatically. Removed memberships stop working immediately.

Sign in to Velocity and select every workspace you want to authorize in your browser:

```sh
velocity-agent login
velocity-agent whoami
velocity-agent status
```

Login opens a browser and listens on an ephemeral 127.0.0.1 port. If the browser cannot reach that port, paste the full redirected URL into the terminal. For SSH, containers, or a browser on another machine, use `velocity-agent login --no-browser` and paste the value shown on Velocity's code page. SSH sessions automatically use this flow. Terminal input is hidden, and login expires after five minutes.

Saved credentials authorize exactly the selected workspace set. `run` and `status` process all currently authorized workspaces by default; `--workspace <id-or-slug>` focuses on one. They use saved sign-ins without a key, refresh automatically, and serialize refresh across CLI processes. Tokens are stored per server origin in `$XDG_CONFIG_HOME/velocity/credentials.json` (default `~/.config/velocity/credentials.json`) with mode 0600. `velocity-agent logout` revokes that server's grant and removes its entry; other server entries are preserved. Use the same `--base-url` for login, run, whoami, and logout on another instance.

Concurrent commands retry if a credential-lock owner releases or replaces its
lock during the ownership check. A genuinely abandoned credential lock requires
explicit recovery: close other Velocity commands, remove only the lock path
shown in the error, then retry. Locks are never reclaimed automatically.

For automation, create a workspace token in **Settings → MCP**, with `mcp:read` and `mcp:write`, and set `VELOCITY_MCP_TOKEN` privately. The legacy `VELOCITY_API_KEY` variable also works. An explicit key takes precedence over browser credentials. `--workspace` or `VELOCITY_WORKSPACE` is optional; if supplied it must be among the currently authorized workspaces. Keep tokens out of repository files.

## Link a repository once

First configure an unambiguous **Repo → Team** or **Repo → Project** mapping under **Settings → Integrations → GitHub**. A project mapping takes precedence. Then authenticate and link its local checkout:

```sh
velocity-agent repo link --workspace your-workspace --team YOUR_TEAM --repo /path/to/repository
velocity-agent repo list --workspace your-workspace
velocity-agent run --agent codex --team YOUR_TEAM --workspace your-workspace
# Or: velocity-agent run --executor claude-code --team YOUR_TEAM --workspace your-workspace
```

Add `--project PROJECT_UUID` when linking a project-specific repository. The link command verifies workspace/team/project access, the server's current GitHub mapping and default branch, the local `origin` identity and local Git fetch access. It does not switch branches or stash/reset your changes. Native workers recheck the mapping before claim and delivery; a moved issue or remapped repository requires relinking. Git diagnostics and credentials are never copied to Velocity.

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

## Shared workspace controls

Worker 0.5.7 reads **Settings → Agents → Loops** at startup and immediately before each claim. Emergency stop and a different provider or hosted execution preference leave this local worker waiting, without claiming or failing queued work. Disabling shared controls preserves the existing provider configuration; it does not requeue stopped runs. The runner never switches providers, models or billing methods automatically.

Each authorized workspace has a separate settings snapshot and journal cursor. The host checks committed policy invalidations at five-second heartbeat/safe boundaries, rereads after an expired cursor or journal failure, and refreshes settings at least every 30 seconds while polling. The queue interval is capped at 30 seconds; requests have a 10-second deadline. Unreadable, revoked or incompatible controls stop new work; an active task is interrupted and its changes remain available for recovery. Before commit, delivery or a final result, controls are read again. The server still enforces current scope, concurrency, integration permissions and cancellation atomically.

The configured server must support `get_agent_loop_settings`. An older server without it cannot authorize new work with this worker; update the server. Maintenance calls stay in the host and do not expose settings updates or the event journal as model tools. Existing repository links, native model/effort defaults and delivery authorization remain separate. This refresh does not register live sessions or automatically schedule unassigned issues.

## Codex worker

Enable Codex under **Settings → Integrations → Codex**, then assign an issue to Codex or mention `@codex` in a comment. Sign in with `codex login`, or privately set your own `CODEX_API_KEY`.

```sh
velocity-agent status --agent codex --team YOUR_TEAM
velocity-agent run --agent codex --repo /path/to/repository --team YOUR_TEAM
```

The worker only claims Codex issue runs in the selected team and authorized workspaces. Add `--workspace your-workspace` to focus on one; without it, each approved workspace is polled in turn. Use a writable Git checkout with an initial commit and configured Git author. The default creates an owned writable worktree and task branch without changing the source checkout or its tracked, untracked or ignored files. Retried runs resume their saved branch and recoverable diff. Codex uses `workspace-write` with Velocity MCP tools and tests and edits code there. Issue text and comments are untrusted task data. The runner commits successful changes and links their real SHAs, then posts the final result as the Codex virtual member. Failed or stopped attempts cannot post a success result.

Commits stay local by default. `--allow-delivery` authorizes the runner to push its branch and open a linked PR; it needs local Git authentication and Velocity's GitHub repository mapping. The runner does not merge or mark the issue Done. Native execution is unattended, bounded to 30 minutes and renews its lease; stale recovery fails abandoned work. Velocity's optional action checkpoint is unsupported for native workers and off by default.

Codex uses your own account and configured model/effort, without Velocity AI metering. `--model` and `--effort` are optional explicit overrides; omit both to preserve native defaults. `VELOCITY_CODEX_BIN` can select an installed compatible Codex binary. The package includes the Codex SDK's native runtime. One runner executes one task at a time; independent runners use separate owned worktrees. See recovery below for interrupted tasks.

## Claude Code worker

Install Claude Code, then sign in with `claude auth login`. The worker starts the installed CLI using its existing authentication; it does not obtain or proxy Claude subscription credentials.

```sh
VELOCITY_WORKSPACE=your-workspace velocity-agent run \
  --executor claude-code --repo /path/to/repository --team YOUR_TEAM
```

Enable Claude Code execution and select it as the desired execution method in Velocity. The worker only selects pending issue runs for the specified team and workspace. It uses an owned writable worktree for each task, edits and runs checks there, and preserves the source checkout. The runner commits any remaining task edits, links the actual SHAs, and handles authorized delivery after rechecking the server lease and repository mapping. Without `--allow-delivery`, commits remain local. Add `--allow-delivery` to authorize pushing and opening a PR. Git/GitHub authentication must be available locally for delivery.

Native Claude Code does not implement Velocity's optional approval checkpoint. A workspace that requires that checkpoint cannot dispatch work to this worker; use the API executor for that policy. No checkpoint is required by default.

## LandingBoost fixes

Mapped LandingBoost fixes require the 0.5.3 worker (or later) with its approved GitHub checkout. The public installation above supports these tasks; older workers leave them pending.

In Velocity's LandingBoost settings, map the exact page, its approved `org/repo`, and Claude Code or Codex. Enable assignment events for that native agent. With **Manual handoff**, load delivery status and choose **Queue agent fix** for a current ready finding; automatic work can remain off. To start fixes as callbacks arrive, choose **Queue a native agent** and also enable automatic work. Saved plans that need input or review and monitoring notifications do not schedule fixes. Ordinary issue assignment remains available.

The worker verifies `origin` against the page grant before claiming a task or editing and uses an owned writable worktree. Its local Git sign-in reads the approved repository’s default branch; a generic issue mapping does not override the page grant. An explicit `--repo` can select the approved checkout, or an unambiguous saved link for that repository can be reused. `--allow-delivery` requires the workspace GitHub issue mapping to match the approved page repository before any host push/PR; a mismatch preserves local commits and reports the needed correction. Existing source-checkout changes are preserved. The platform rechecks the latest saved report at claim and stops revoked connections, mappings or permissions; manual handoff also requires the initiating person's current workspace admin access. Repeated findings reuse one run across manual clicks, callback retries and reconnects. Inspect the linked issue for actual checks, commits and proposed changes, and the LandingBoost delivery panel for run status. A failed fix can explicitly retry the same run twice; retries do not start new scans or deploy changes.

## Anthropic API worker

Set your `ANTHROPIC_API_KEY` and enable Local API execution in Velocity:

```sh
VELOCITY_WORKSPACE=your-workspace velocity-agent run --executor anthropic
```

This method calls the Anthropic API and uses API billing. It is not Claude Code subscription execution. Your Anthropic key stays on your machine.

## PRDs and user stories

Worker 0.5.4 adds PRD, requirement and user-story context and manual planning operations to Claude Code and Codex. The configured Velocity server must provide the planning MCP tools. Only operator-selected changes should be applied; PRD approval always remains with a human.

The API executor discovers its issue and planning schemas through authenticated `tools/list` for the current workspace and execution. It does not carry a separate copy of the server schemas or grant account administration/deletion tools. Discovery has a 10-second deadline, a 1 MB response limit and a bounded, two-minute in-memory cache scoped to the exact claim. An older server without planning tools can still provide ordinary issue tools; a missing or malformed catalogue fails the run before a model request.

The API executor can also request metered planning proposals. It presents generated proposals for human review and cannot apply them in the same execution, including by creating an ordinary issue. Apply the selected changes in a subsequent explicitly requested manual run. Cost estimates alone do not create proposals. Native workers expose manual planning tools, without enabling the platform's AI proposal tools. Planning writes remain subject to current role/scope, run policy, emergency stop and server validation; restricted automation and source-bound LandingBoost fixes cannot use them to expand their scope. Platform AI plan, credit and budget rules remain in force.

Use `--base-url https://your-velocity-instance.example` for a different server, `--once` for one batch, and `velocity-agent run --help` for all options. `velocity-agent status` reports pending local API runs; it does not prove that a native worker is online. Enable a worker only for repositories and team work you authorize it to process.


Shared execution controls require worker 0.5.7 or later. **Require isolated worktrees** keeps workers with `--single-checkout` and API-only workers idle. **Local changes only** overrides `--allow-delivery`: the host keeps and links local commits without pushing or opening a PR. Existing delivery permissions still require local `--allow-delivery`; shared settings never grant it. Controls refresh before delivery, and restrictions changing in flight preserve your local changes. Delivery eligibility can only narrow during a run; lifting local-only controls applies to a subsequent attempt after fresh repository verification. Older workers cannot claim work while these restrictions are active. Private draft preferences are not activated by upgrading.
