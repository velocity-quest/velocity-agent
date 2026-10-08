# Changelog

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
