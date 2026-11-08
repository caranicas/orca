---
name: orca-fork-update
description: 'Update a custom Orca fork from upstream, resolve conflicts, validate its main branch, and update source-built desktops while preserving profiles and terminals. Use for Orca fork maintenance or desktop/mobile version skew.'
---

# Orca Fork Update

Maintain the user's custom fork and installed desktop as two separate operations. Resolve upstream changes once in the fork; desktops consume its validated main branch. Read the repository's AGENTS.md and cross-platform/Git references before changing code or running an installation.

## Integrate upstream

- Discover the actual repository, fork remote, upstream ref, primary checkout, and current PRs. Preserve existing user changes and unrelated PRs. Work on an isolated branch/worktree; never merge upstream into a live desktop checkout.
- Fetch the named upstream branch and record both SHAs. If it is already an ancestor of fork main, finish without creating a PR or rebuilding the desktop.
- Merge with full ancestry. Resolve conflicts by retaining the fork's observable custom behavior while adopting upstream's current architecture. Locate renamed implementations before recreating old modules. For this fork, preserve General, named pinned groups, status sections, workspace colors, and profile selection.
- Run focused behavior tests, affected typechecks, and the required `check:changed` gate before pushing. Keep hooks enabled. Use the merged upstream ref as the disclosed ratchet baseline when importing existing upstream code; retain full runtime, package, and compatibility gates. Do not rewrite unrelated inherited findings merely to satisfy an old fork baseline.
- Create or update one PR. Watch the exact pushed SHA with `gh run watch --compact --exit-status`. Inspect failed jobs; rerun failed jobs only for transient failures. Code fixes require a new push and checks for the new SHA. Never merge without the required aggregate gate passing.
- Historical release tags are absent in new forks. Fetch compatibility fixtures from upstream. A multi-release integration can span an independent daemon protocol bump and runtime launcher change: apply the documented override label only after verifying legacy adoption and explaining it in the PR. Do not automatically label ordinary feature changes.
- Merge with ancestry preserved. Audit associated issues and close only completed scope. Leave unrelated PRs and pending adoption/playtest issues open.

## Install validated fork main

Use the fork's `custom-tools/updates/fork-source-update.mjs` when present. Automatic client updates must consume fork main, never independently merge upstream or resolve conflicts.

- Discover the running instance from `out/dev-instance.json` and verify its profile. Profile selection files and persisted CLI settings can override defaults. Do not create a blank replacement profile when the user wants their existing work.
- Queue installation while the desktop is running. Normal close must save its checkpoint and leave agents alive. Never use **Quit Completely**, kill terminal daemons, or stop processes by executable name. If an explicitly authorized immediate handover is necessary, use the existing checkpoint/beforeunload/confirmed-close APIs and stop when a checkpoint is refused.
- Make a full profile snapshot using the existing SQLite online-backup helper; require its success manifest. A failed or partial backup is not a usable backup. Preserve the previous source ref and built output before installation.
- Keep the previous checkout in place while legacy daemons use it. On Windows a loaded native module can block node-gyp cleanup even after the UI exits. Preserve its build directory with a checked same-volume directory rename, then build a new directory; do not kill the daemon to release the lock.
- Install pinned dependencies for root and mobile, then build native helpers and `build:desktop:assets`. A successful desktop build alone does not supply the phone's workspace. Require the mobile manifest and asset verification. Source package versions can remain unchanged across upstream commits; compatibility depends on the actual protocol and bundle, not a cosmetic version bump.
- Resolve pnpm through the existing `resolvePnpmCliInvocation` and pass its command/prefix arguments to the process wrapper. A bare `pnpm` can fail on Windows when only `pnpm.cmd` is installed. Smoke-test the actual resolved `--version` command before changing source; an injected test build does not verify command resolution.
- Resolve the development CLI from `package.json`'s `bin["orca-dev"]`; its source path can move upstream. Use existing process wrappers and preserve the selected profile.
- Preserve the renderer origin/port when using an existing dev profile: custom sidebar preferences live in localStorage. Validate the actual profile's project/repo IDs, saved nonempty workspace tab IDs, live terminal session IDs, groups/colors, and `mobileWeb.bundle.manifest` delivery.
- Any agent-launched UI validation must be hidden with `ORCA_BACKGROUND_LAUNCH=1`, using Electron/CDP. Never reveal/focus a window. Close a hidden validation instance normally so the user's launcher can reopen it.
- Record the installed commit, backup and verification. Report physical phone reconnection as unverified unless the user confirms it.

For recurring maintenance and recovery details, read [the automation workflow](references/automation.md).
