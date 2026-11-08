source "${${(%):-%x}:A:h}/paths.zsh" || return 1
[[ -d "$orca_repo/.git" && -x "$orca_tools/bin/pnpm" ]] || {
  print -u2 -- "Run /bin/zsh $orca_repo/custom-tools/setup-orca-fork.zsh first."
  exit 1
}
command -v fnm >/dev/null || { print -u2 -- 'fnm is required.'; exit 1; }
source "$orca_helper_dir/orca-native-toolchain.zsh" || return 1
export FNM_DIR="$orca_tools/node"
export XDG_STATE_HOME="$orca_tools/state"
eval "$(fnm env --shell zsh)"
fnm use 24
export PATH="$orca_tools/bin:$PATH"
export COREPACK_HOME="$orca_tools/corepack-cache"
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
unset PNPM_CONFIG_NPMRC_AUTH_FILE
cd "$orca_repo"
