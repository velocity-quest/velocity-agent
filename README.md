# Velocity agent

Local workers for pending Velocity agent runs. This is separate from the general Velocity management CLI.

Requires Node 18.20 or newer. Install the compiled package from Velocity's public GitHub release:

```sh
npm install --global https://github.com/velocity-quest/velocity-agent/releases/download/agent-v0.5.2/velocity-agent-0.5.2.tgz
velocity-agent --version
```

The package is distributed through GitHub releases, not the npm registry. Product CI builds and checks the package, then distribution CI publishes it with a SHA-256 checksum on an `agent-vVERSION` tag. The product repository and its workspace package remain private; the public distribution contains only the compiled package and release materials.

Maintainers relay a successful **Agent CLI** workflow artifact with `node packages/agent/scripts/release-from-ci.mjs RUN_ID` from the exact checked commit, using their existing GitHub sign-in. The relay never uploads a locally built package or publishes a release; distribution CI verifies the artifact and publishes it. This flow needs no registry credential or cross-repository CI secret.

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

## Codex worker

Enable Codex under **Settings → Integrations → Codex**, then assign an issue to Codex or mention `@codex` in a comment. Sign in with `codex login`, or privately set your own `CODEX_API_KEY`.

```sh
velocity-agent status --agent codex --team YOUR_TEAM
velocity-agent run --agent codex --repo /path/to/repository --team YOUR_TEAM
```

The worker only claims Codex issue runs in the selected team and authorized workspaces. Add `--workspace your-workspace` to focus on one; without it, each approved workspace is polled in turn. Use a clean, writable Git checkout with an initial commit and configured Git author. Existing changes are preserved; commit or stash them before starting the worker. Each attempt creates a new issue branch, runs Codex in `workspace-write` with Velocity MCP tools, and tests and edits code there. Issue text and comments are untrusted task data. The runner commits successful changes and links their real SHAs, then posts the final result as the Codex virtual member. Failed or stopped attempts cannot post a success result.

Commits stay local by default. `--allow-delivery` authorizes the runner to push its branch and open a linked PR; it needs local Git authentication and Velocity's GitHub repository mapping. The runner does not merge or mark the issue Done. Native execution is unattended, bounded to 30 minutes and renews its lease; stale recovery fails abandoned work. Velocity's optional action checkpoint is unsupported for native workers and off by default.

Codex uses your own account and configured model/effort, without Velocity AI metering. `--model` and `--effort` are optional explicit overrides; omit both to preserve native defaults. `VELOCITY_CODEX_BIN` can select an installed compatible Codex binary. The package includes the Codex SDK's native runtime. One worker owns a repository at a time. After an abrupt process exit, stop any remaining worker before removing a confirmed abandoned `.git/velocity-agent.lock`.

## Claude Code worker

Install Claude Code, then sign in with `claude auth login`. The worker starts the installed CLI using its existing authentication; it does not obtain or proxy Claude subscription credentials.

```sh
VELOCITY_WORKSPACE=your-workspace velocity-agent run \
  --executor claude-code --repo /path/to/repository --team YOUR_TEAM
```

Enable Claude Code execution and select it as the desired execution method in Velocity. The worker only selects pending issue runs for the specified team and workspace. It uses a branch in the repository you select, edits and runs checks in that writable checkout, and preserves unrelated changes. Without `--allow-delivery`, commits remain local. Add `--allow-delivery` to authorize pushing and opening a PR. Git/GitHub authentication must be available locally for delivery.

Native Claude Code does not implement Velocity's optional approval checkpoint. A workspace that requires that checkpoint cannot dispatch work to this worker; use the API executor for that policy. No checkpoint is required by default.

## Anthropic API worker

Set your `ANTHROPIC_API_KEY` and enable Local API execution in Velocity:

```sh
VELOCITY_WORKSPACE=your-workspace velocity-agent run --executor anthropic
```

This method calls the Anthropic API and uses API billing. It is not Claude Code subscription execution. Your Anthropic key stays on your machine.

Use `--base-url https://your-velocity-instance.example` for a different server, `--once` for one batch, and `velocity-agent run --help` for all options. `velocity-agent status` reports pending local API runs; it does not prove that a native worker is online. Enable a worker only for repositories and team work you authorize it to process.
