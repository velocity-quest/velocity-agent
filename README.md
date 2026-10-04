# Velocity agent

Local workers for pending Velocity agent runs. This is separate from the general Velocity management CLI.

Requires Node 18.20 or newer. Install the compiled package from Velocity's public GitHub release:

```sh
npm install --global https://github.com/velocity-quest/velocity-agent/releases/download/agent-v0.2.0/velocity-agent-0.2.0.tgz
velocity-agent --version
```

The package is distributed through GitHub releases, not the npm registry. Product CI builds and checks the package, then distribution CI publishes it with a SHA-256 checksum on an `agent-vVERSION` tag. The product repository and its workspace package remain private; the public distribution contains only the compiled package and release materials.

Create a workspace token in **Settings → MCP**, with `mcp:read` and `mcp:write`. Set `VELOCITY_MCP_TOKEN` in your shell or secret manager and `VELOCITY_WORKSPACE` to the workspace slug. The legacy `VELOCITY_API_KEY` variable also works. Keep tokens out of repository files.

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
