# Custom Orca tools

This folder is versioned with the `custom-orca` branch in your fork. It contains
the local macOS launcher, dependency setup, upstream updater and profile migration
utilities. `Orca-sync` is a linked worktree of the same Git repository.

From the primary checkout:

```sh
# Launch custom Orca with your selected profile.
/bin/zsh custom-tools/start-orca-custom.command

# Install or refresh this Mac's development dependencies.
/bin/zsh custom-tools/setup-orca-fork.zsh

# Integrate upstream/main, install dependencies and validate the update.
/bin/zsh custom-tools/update-orca-custom.zsh
```

The Desktop `start-orca-custom.command` is a shortcut to this folder's launcher.
Use that shortcut to reopen the app. The generated Electron `.app` inside `out/`
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
detached, and can fast-forward to `custom-orca`; otherwise it leaves it alone.
These updates include unreleased upstream work.

Commits share history across worktrees, but checkout files update only when that
worktree advances. To refresh a clean detached sync worktree after local commits:

```sh
git -C ../Orca-sync merge --ff-only custom-orca
```

To back up committed custom work to your GitHub fork, explicitly push the branch:

```sh
git push origin custom-orca
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
