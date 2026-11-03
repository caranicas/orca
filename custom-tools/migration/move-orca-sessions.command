#!/bin/zsh
emulate -R zsh
setopt ERR_EXIT NO_UNSET PIPE_FAIL
source "${${(%):-%x}:A:h:h}/orca-local-env.zsh"
node "$orca_helper_dir/migration/move-orca-sessions.mjs"
