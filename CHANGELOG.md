# Changelog

## 0.5.29 — 2026-10-18

- Retrieve the selected checkout’s linked Vercel project and verified production
  domains automatically using host-local provider sign-in.
- Offer an explicit settings import in the Agents deployment workflow, with a
  domain choice for projects serving several production URLs. Preserve the
  application’s validation and HTTP acceptance settings.
- Report actionable setup errors and bounded public metadata without provider
  credentials, checkout paths or raw API responses. Discovery runs in the
  background and supports older servers through capability negotiation.

## 0.5.10 — 2026-10-15

- Validate explicit Claude Code model/effort overrides against the exact native
  runtime before fetching repository refs or claiming work. Unavailable or
  incompatible metadata leaves queued work pending.
- Pin the advertised resolved model and executable through execution and result
  attribution. Supported Claude effort overrides require an explicit model;
  runs with no overrides retain native defaults.
- Add `velocity-agent claude models --repo PATH` for metadata-only discovery
  without Velocity sign-in, inference or raw account details. Catalogs describe
  capabilities, not account entitlement or funded inference.

## 0.5.9 — 2026-10-15

- Verify the local Anthropic API model through the execution client before
  claiming work, resolving aliases to one model ID for the whole attempt.
- Leave queued work pending on invalid models, missing credentials, provider
  metadata failures or cancellation. Metadata reads have a ten-second deadline
  and no automatic retries; later attempts revalidate.
- Preserve native defaults and idle/status behavior. Metadata does not prove
  that inference quota or credits are available.

## 0.5.8 — 2026-10-15

- Check explicit Codex model/effort overrides against the exact execution
  runtime's model catalog before claiming work or changing a checkout.
  Unsupported or unreadable settings leave queued work pending.
- Resolve omitted choices from the selected repository's native configuration;
  carry the verified model, effort and provider into the task worktree.
  Runs with neither override retain the existing native defaults.
- Add `velocity-agent codex models --repo PATH` for a bounded read-only catalog
  without Velocity sign-in or inference. Catalog entries are capabilities, not
  proof of account entitlement; no account details or credentials are displayed.

## 0.5.3 — 2026-10-08

- Support source-bound LandingBoost runs for Codex and Claude Code in the
  mapped GitHub checkout. Check repository identity before claiming work;
  the platform rechecks current ready reports and source permissions.
- Document manual handoff with automatic work off and optional automatic
  queueing. Reports requiring input or review leave code fixes unqueued.
- Built by successful product CI and published after Node 18.20.8/22
  clean-install checks, with a SHA-256 checksum.

## 0.5.2 — 2026-10-06

- Recheck credential-lock ownership after a stopped-process probe so a released
  or replaced lock does not fail a concurrent sign-in, refresh or status command.
- Preserve explicit abandoned-lock recovery, serialized refresh and other server
  credentials. Shared-store regressions run before package artifacts are built.

## 0.5.1 — 2026-10-05

- Load the Anthropic API client when an API-backed run begins. Status, sign-in,
  idle polling and local executors no longer load its legacy Node transport at
  startup or emit the Node 22 `punycode` deprecation warning.
- Check installed commands for that warning in the package smoke suite.
