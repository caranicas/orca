#!/usr/bin/env sh
set -eu
orca_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
export ORCA_DEV_USER_DATA_PATH=${ORCA_DEV_USER_DATA_PATH:-${XDG_CONFIG_HOME:-$HOME/.config}/orca-dev}
cd "$orca_root"
exec node custom-tools/updates/fork-update-supervisor.mjs
