# Changelog

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
