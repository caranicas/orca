# Custom Orca tools

This folder is versioned on `main` in your fork, which includes the original
`custom-orca` changes. It contains
local macOS and Windows launchers, dependency setup, a macOS upstream updater and profile migration
utilities. `Orca-sync` is a linked worktree of the same Git repository.

## Automatic fork updates

The Windows, Mac, and Linux custom launchers check this fork's `main` every 72
hours while running, and catch up when opened after being offline. Available
updates install automatically after normal close or before the next launch.
Keep the launcher console open until an update finishes. Running terminal daemons
are preserved; **Quit Completely** is never used.

Updates require a clean primary checkout on `main` and the existing selected
profile. Local commits, uncommitted changes, linked worktrees, and a running
desktop hold installation. Each install snapshots the profile using SQLite's
backup API, preserves the previous source and built output, and rebuilds native,
desktop, browser, CLI, and mobile assets. A failed build restores the previous
application. An interrupted update leaves a recovery record and backup instead
of launching an incomplete build. New toolchain requirements can require manual
installation before retrying.

These are source-install updates through the custom launchers. Run them with the
same Node, pnpm, Python, compiler, and Rust prerequisites as setup. On Linux,
after installing dependencies use `sh custom-tools/start-orca-custom.sh`;
`ORCA_DEV_USER_DATA_PATH` selects an existing profile, defaulting to the dev
profile under the user's config directory. Existing installations receive this
behavior after updating to the version containing these launchers.

```sh
node custom-tools/updates/fork-source-update.mjs status
node custom-tools/updates/fork-source-update.mjs check --force
node custom-tools/updates/fork-source-update.mjs disable
node custom-tools/updates/fork-source-update.mjs enable
```

Status, logs, and retained backups live in the sibling `.orca-local/updates`
directory. A force check allows another attempt at a previously failed commit;
automatic launch does not repeatedly rebuild the same failed candidate.

The fork maintainer can install the upstream integration job once, while their
Orca desktop and Codex provider are available:

```sh
node custom-tools/updates/install-maintenance.mjs
```

It creates or updates one **Orca fork upstream maintenance** automation in the
current profile, scheduled every three days at 09:00 in the local timezone. A
precheck skips agent runs when upstream has not changed. Orca's scheduler must
be running; missed runs catch up within three days. The job uses existing agent
permissions and GitHub credentials to resolve upstream changes in a separate
worktree and merge a PR only after required checks pass. Unresolved conflicts,
missing credentials, and failed checks stay pending in the automation's report.
Other fork users only need the launcher; they do not need maintainer credentials
or their own upstream-merging agent.

The reusable agent workflow is versioned in
[`skills/orca-fork-update/SKILL.md`](skills/orca-fork-update/SKILL.md). Copy that
directory into `~/.codex/skills` to install it for ordinary Codex sessions, or
read its path directly from an automation prompt.

## Windows

The custom sidebar features also run on Windows. The `.zsh` and `.command` files
are for macOS; use these commands in PowerShell from this checkout instead:

```powershell
# Requires Node 24, the pnpm version in package.json, Python 3, and
# Visual Studio 2022 Build Tools with Desktop development with C++ and a Windows SDK.
# Rust (MSVC toolchain) is required for the native CLI launcher and agent hooks.
./custom-tools/setup-orca-fork.ps1
./custom-tools/start-orca-custom.ps1
```

Double-click `custom-tools/start-orca-custom.cmd` to reopen the app, or create a
desktop shortcut to that file. Keep its console open while using Orca; quit the
app normally before closing the console or changing branches. This runs the same
source-based development app as the Mac launcher, with no installer or signing
certificate required. Setup builds the desktop, CLI, Windows native helpers,
browser client, and mobile workspace bundle. The phone app downloads its workspace
from this desktop, so rerun setup after upstream updates to keep them compatible.
It checks types unless `-SkipTypecheck`
is supplied.

The Windows scripts target the checkout containing them, including a linked
worktree. They reuse Node and pnpm from `PATH` or an existing
`%LOCALAPPDATA%/OrcaBuildTools` installation, and save their locations in the
sibling `.orca-local/windows-environment.json`. The custom profile is
`.orca-local/orca-dev-windows`; existing installed and development profiles stay
in place. Do not launch two Windows custom checkouts against that profile at once.
Mac profiles and the Mac `active-profile` selection are not migrated to Windows.
Sign in and add this PC's projects in the new profile.

### Bring existing Windows work into the custom build

Save any unsaved editor buffers, then quit both Orca windows normally and wait
for their launchers to finish. Use normal Quit, not **Quit Completely**, so
background agents can survive. Keep the old source checkout and tool installation
in place while its background terminals are running. Do not run both builds
against the same profile simultaneously.

The existing Windows source installation uses `%APPDATA%/orca-dev`. Back up both
profiles with the existing snapshot tool before switching:

```powershell
python ./custom-tools/migration/orca-profile-backup.py `
  --original "$env:APPDATA/orca-dev" `
  --custom ../.orca-local/orca-dev-windows `
  --output "../.orca-local/migration-backups/windows-$(Get-Date -Format yyyyMMdd-HHmmss)"
./custom-tools/start-orca-custom.ps1 -ProfilePath "$env:APPDATA/orca-dev"
```

The launcher saves that profile selection in `.orca-local/windows-profile.txt`;
the **Orca Custom** desktop shortcut uses it on subsequent launches. This reuses
the existing profile in place, including project paths, saved tabs, settings and
history. Project files and uncommitted Git changes stay in their current folders;
they are not moved to this checkout. Running terminals can reconnect when their
daemon survives; stopped agents need their usual resume command. This does not
move work from another computer.

To return to the separate custom profile, quit normally and run:

```powershell
./custom-tools/start-orca-custom.ps1 -ProfilePath ../.orca-local/orca-dev-windows
```

After saving your changes and quitting this custom app, update the Windows branch
with a normal Git merge and rerun setup. The macOS updater is not used on Windows.
PowerShell must permit local scripts (for example, an existing `RemoteSigned`
policy); these helpers do not change or bypass execution policy.

## macOS

From the primary checkout:

```sh
# Launch custom Orca with your selected profile.
/bin/zsh custom-tools/start-orca-custom.command

# Install or refresh this Mac's development dependencies.
/bin/zsh custom-tools/setup-orca-fork.zsh

# Integrate upstream/main, install dependencies and validate the update.
/bin/zsh custom-tools/update-orca-custom.zsh
```

Double-click this folder's `start-orca-custom.command` to reopen the app from
Finder. The generated Electron `.app` inside `out/`
needs launch arguments; opening it directly shows Electron's welcome screen.

Quit custom Orca normally with **Cmd-Q** and wait for its development command to
finish before setup, branch changes, rebases or upstream updates. The live dev
server watches the checkout and can crash while Git rearranges files. Normal quit
preserves background agents; **Quit Completely** ends them.

## Paths and local state

Helpers resolve the primary checkout through Git's common directory, so launching
a helper from `Orca-sync` still targets the primary app. Moving the repository and
its sibling state folder together preserves this layout:

```text
DEV/
  Orca/
    custom-tools/       versioned helper scripts and this guide
  Orca-sync/            linked worktree, including the same committed helpers
  .orca-local/          private tools, profiles, logs and backups; outside Git
```

The existing `.orca-local/active-profile` selection is retained. After the profile
handover, the app uses `~/Library/Application Support/orca` and reconnects to its
existing terminal services. The separate development profile remains backed up.
Do not run both app versions against the same profile simultaneously.

Node, Corepack, Bun and the SDK C++ header workaround stay local to these commands.
No credentials, profiles, terminal history or profile backups belong in Git.
Original Desktop helpers and notes are archived under
`.orca-local/desktop-script-backups/`; the old setup log is under `.orca-local/logs/`.

## Updating and syncing

The updater creates a backup branch before merging `upstream/main`, stops on
conflicts, refreshes dependencies and runs validation. It never force pushes or
publishes to GitHub. It refreshes `Orca-sync` only when that worktree is clean,
detached, and can fast-forward to the current `main` or `custom-orca` branch;
otherwise it leaves it alone.
These updates include unreleased upstream work.

Commits share history across worktrees, but checkout files update only when that
worktree advances. To refresh a clean detached sync worktree after local commits:

```sh
git -C ../Orca-sync merge --ff-only main
```

To back up committed custom work to your GitHub fork, explicitly push the branch:

```sh
git push origin main
```

## Custom features

- **General** in the sidebar opens one normal workspace for standalone agent tabs.
  Its working folder is created automatically; use the tab bar's **+** menu for
  more agents. Existing tabs follow Orca's normal session persistence.
- **Pinned groups** can be named, reordered, collapsed and removed. Group removal
  keeps the workspaces. Named groups contain status subheadings in configured
  status order, with the selected sidebar sort applied within each status.
- **Workspace color** is available in the context menu and Workspace details,
  including Deep blue. Cards have a bright edge and a subdued full-card tint.
  Agent status and active-selection indicators remain distinct.
- Groups and colors are local renderer preferences. They do not sync to Mobile;
  their membership does not change Git branches or files.

## Migration and recovery utilities

The one-time handover tools live in `migration/`. They back up both profiles,
export/import custom groups and colors, quit the apps normally and configure the
launcher to reuse the original profile in place. They never copy daemon sockets.

```sh
/bin/zsh custom-tools/migration/move-orca-sessions.command
```

It is safe to rerun after completion: the helper reports that the original profile
is already selected. Encrypted Orca integrations may need fresh sign-in in the dev
app; AWS and GitHub CLI credentials stay in their existing locations on this Mac.

Profile backups are private files under `.orca-local/migration-backups/`. Only
completed snapshots containing a `manifest.json` should be used for recovery.
Quit both app windows normally before any restoration and never restore old live
socket paths. Rebooting the Mac ends running agent processes.
