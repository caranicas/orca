# Recurring maintenance

Use Orca's existing automation scheduler rather than adding a second agent scheduler. `custom-tools/updates/install-maintenance.mjs` installs or updates one maintainer automation with a three-day RRULE. Read the current automation before changing it; retain its identity and do not create duplicates. It uses the configured provider and the user's existing provider permissions. Scheduling does not grant GitHub access or override agent approval settings.

The precheck fetches only the named upstream branch and skips paid agent runs when no new commit exists. The prompt authorizes upstream integration, conflict resolution, focused checks, PR publication, and merge after required checks pass. It must leave failures pending with evidence rather than looping, force-pushing main, disabling gates, or changing unrelated features.

After merge, queue the client update. The launcher's supervisor checks every 72 hours while running and catches up on launch. It installs after normal exit or before the next launch, taking a fresh backup first. A closed or offline desktop cannot check on the wall clock; it catches up when available. The maintainer's agent schedule likewise needs its Orca scheduler running.

Use `node custom-tools/updates/fork-source-update.mjs status` to inspect the client's state and `check --force` to fetch now. `apply` requires a clean primary checkout on the configured branch, an existing selected profile, and no live desktop runner. Diverged, dirty, detached, or linked worktrees are held. A build failure restores the prior source and output and records the failure; it does not retry the same failed commit every launch.

If the toolchain pin changes, install the required Node/pnpm version before retrying. Do not rewrite tracked package pins just to use the currently installed tools. If rollback cannot complete, stop and report the retained backup and exact failing step; do not launch the partially built candidate.

Keep private paths, profile data, credentials, run logs, and backup manifests outside the Git repository. Use Git credential lookup in memory when a command requires authenticated GitHub access; never print tokens. A `repo`-scoped token can support REST even when `gh pr` GraphQL fails for missing `read:org`. Use structured plugin tools or `gh api` instead of requesting broader permissions unnecessarily.

`node custom-tools/updates/with-github-auth.mjs <gh arguments>` reuses existing GitHub environment credentials or the Git credential manager without printing the token. It finds `gh` on PATH or the private portable tool directory; `ORCA_GH_PATH` selects a different installed binary. Use it for `run watch <id> --compact --exit-status --repo <fork>`, or `api` with a JSON request file when GraphQL scopes are insufficient.

Future Orca refactors may move launch scripts or persistence APIs. Discover their current implementations instead of copying a previous machine's fixed paths or process IDs. Preserve the invariants in the skill while adapting the commands.
