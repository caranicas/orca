#!/bin/zsh
emulate -R zsh
setopt ERR_EXIT NO_UNSET PIPE_FAIL
unsetopt XTRACE VERBOSE

source "${${(%):-%x}:A:h}/paths.zsh"
source "$orca_helper_dir/require-orca-closed.zsh"
fail() { print -u2 -r -- "[Orca setup] $*"; exit 1; }
trap 'print -u2 -- "[Orca setup] Stopped. Fix the error above, then rerun this script."' ZERR

[[ $(uname -s) == Darwin ]] || fail 'This local setup is for your Mac.'
command -v fnm >/dev/null || fail 'fnm is required.'
xcode-select -p >/dev/null || fail 'Install Xcode Command Line Tools first.'
source "$orca_helper_dir/orca-native-toolchain.zsh"

cd "$orca_repo"
[[ $(git remote get-url origin) == https://github.com/caranicas/orca.git ]] || fail 'This checkout does not point to your fork.'
[[ -z $(git status --porcelain --untracked-files=all) ]] || fail 'Save or commit your existing changes before running setup.'

if git remote get-url upstream >/dev/null 2>&1; then
  [[ $(git remote get-url upstream) == https://github.com/stablyai/orca.git ]] || fail 'Unexpected upstream remote; leaving it unchanged.'
else
  git remote add upstream https://github.com/stablyai/orca.git
fi
case $(git branch --show-current) in
  main|custom-orca) ;;
  *) fail 'Switch the primary checkout to main or custom-orca first.' ;;
esac
git config remote.pushDefault origin

mkdir -p "$orca_tools/bin"
export FNM_DIR="$orca_tools/node"
export XDG_STATE_HOME="$orca_tools/state"
fnm install 24
eval "$(fnm env --shell zsh)"
fnm use 24
export COREPACK_HOME="$orca_tools/corepack-cache"
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
unset PNPM_CONFIG_NPMRC_AUTH_FILE

if [[ ! -x "$orca_tools/corepack/node_modules/.bin/corepack" ]]; then
  npm install --prefix "$orca_tools/corepack" --no-save --package-lock=false corepack@latest
fi
"$orca_tools/corepack/node_modules/.bin/corepack" enable --install-directory "$orca_tools/bin"
export PATH="$orca_tools/bin:$PATH"

orca_bun_version=$(tr -d '[:space:]' < config/.bun-version)
[[ "$orca_bun_version" =~ '^[0-9]+\.[0-9]+\.[0-9]+$' ]] || fail 'Unexpected Bun version in config/.bun-version.'
case $(uname -m) in
  arm64) orca_bun_platform=darwin-aarch64 ;;
  x86_64) orca_bun_platform=darwin-x64 ;;
  *) fail 'Unsupported Mac architecture.' ;;
esac
orca_bun_dir="$orca_tools/bun/$orca_bun_version"
if [[ ! -x "$orca_bun_dir/bun-$orca_bun_platform/bun" ]]; then
  mkdir -p "$orca_bun_dir"
  orca_bun_archive=$(mktemp "$orca_tools/bun-download.XXXXXX")
  curl --fail --location --retry 2 "https://github.com/oven-sh/bun/releases/download/bun-v$orca_bun_version/bun-$orca_bun_platform.zip" -o "$orca_bun_archive"
  unzip -q -o "$orca_bun_archive" -d "$orca_bun_dir"
  rm "$orca_bun_archive"
fi
ln -sfn "$orca_bun_dir/bun-$orca_bun_platform/bun" "$orca_tools/bin/bun"
[[ $(bun --version) == "$orca_bun_version" ]] || fail 'The downloaded Bun version did not match.'

pnpm install --frozen-lockfile
pnpm -C mobile install --frozen-lockfile
pnpm tc

print -r -- '[Orca setup] Dependencies installed and typecheck passed.'
print -r -- '[Orca setup] Start the development app with:'
print -r -- "  /bin/zsh $orca_repo/custom-tools/start-orca-custom.command"
print -r -- '[Orca setup] Development environment ready.'
