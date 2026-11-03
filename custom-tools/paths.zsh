orca_helper_dir="${${(%):-%x}:A:h}"
orca_checkout="${orca_helper_dir:h}"
orca_common_dir=$(git -C "$orca_checkout" rev-parse --git-common-dir) || return 1
if [[ "$orca_common_dir" != /* ]]; then
  orca_common_dir="$orca_checkout/$orca_common_dir"
fi
orca_common_dir="${orca_common_dir:A}"
orca_repo="${orca_common_dir:h}"
orca_tools="${orca_repo:h}/.orca-local"
orca_sync_repo="${orca_repo}-sync"
orca_original_profile="$HOME/Library/Application Support/orca"
[[ -f "$orca_repo/package.json" && -d "$orca_repo/.git" ]] || {
  print -u2 -- 'Could not locate the primary Orca checkout.'
  return 1
}
