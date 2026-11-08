#!/bin/zsh
emulate -R zsh
setopt ERR_EXIT NO_UNSET PIPE_FAIL
source "${${(%):-%x}:A:h}/orca-local-env.zsh"
orca_profile_mode='separate'
if [[ -f "$orca_tools/active-profile" ]]; then
  orca_profile_mode=$(<"$orca_tools/active-profile")
fi
case "$orca_profile_mode" in
  separate) export ORCA_DEV_USER_DATA_PATH="$orca_tools/profile" ;;
  original) export ORCA_DEV_USER_DATA_PATH="$orca_original_profile" ;;
  *) print -u2 -- 'Unrecognized Orca profile selection; launch stopped.'; exit 1 ;;
esac
print -- '[Orca custom] Starting your custom Orca from its source checkout.'
print -- '[Orca custom] Use this launcher to reopen Orca; the generated Electron app requires launch arguments.'
node "$orca_repo/custom-tools/updates/fork-update-supervisor.mjs"
