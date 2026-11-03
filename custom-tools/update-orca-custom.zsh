#!/bin/zsh
emulate -R zsh
setopt ERR_EXIT NO_UNSET PIPE_FAIL

orca_update_fork() {
  source "${${(%):-%x}:A:h}/orca-local-env.zsh"
  source "$orca_helper_dir/require-orca-closed.zsh"
  local orca_update_branch
  orca_update_branch=$(git branch --show-current)
  case "$orca_update_branch" in
    main|custom-orca) ;;
    *) print -u2 -- 'Switch the primary checkout to main or custom-orca before updating.'; return 1 ;;
  esac
  [[ -z $(git status --porcelain --untracked-files=all) ]] || {
    print -u2 -- 'Commit or save your changes before updating.'
    return 1
  }
  [[ $(git remote get-url upstream) == https://github.com/stablyai/orca.git ]] || return 1
  git fetch upstream main
  if ! git merge-base --is-ancestor upstream/main HEAD; then
    orca_backup="backup/custom-orca-$(date +%Y%m%d-%H%M%S)-$$"
    git branch "$orca_backup"
    if ! git merge --no-edit upstream/main; then
      print -u2 -- "Merge needs attention. Your pre-update code is saved as $orca_backup."
      print -u2 -- 'Resolve and commit the merge, or use git merge --abort, before retrying.'
      return 1
    fi
  fi
  /bin/zsh "$orca_repo/custom-tools/setup-orca-fork.zsh"
  pnpm check:changed --maxWorkers=2

  if [[ -f "$orca_sync_repo/.git" ]]; then
    local sync_common
    sync_common=$(git -C "$orca_sync_repo" rev-parse --git-common-dir)
    [[ "$sync_common" == /* ]] || sync_common="$orca_sync_repo/$sync_common"
    if [[ "${sync_common:A}" == "$orca_common_dir" ]] &&
      ! git -C "$orca_sync_repo" symbolic-ref --quiet HEAD >/dev/null &&
      [[ -z $(git -C "$orca_sync_repo" status --porcelain --untracked-files=all) ]] &&
      git -C "$orca_sync_repo" merge-base --is-ancestor HEAD "$orca_update_branch"; then
      git -C "$orca_sync_repo" merge --ff-only "$orca_update_branch"
    else
      print -- 'Orca-sync was left unchanged: it must be clean, detached and able to fast-forward.'
    fi
  fi
  print -- 'Upstream code integrated and checks passed. Start custom Orca with:'
  print -- "  /bin/zsh $orca_repo/custom-tools/start-orca-custom.command"
}

# Parse the complete workflow before Git can replace this script during a merge.
orca_update_fork "$@"
