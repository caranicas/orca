[[ $(uname -s) == Darwin ]] || {
  print -u2 -- 'These fork-management commands currently support macOS.'
  return 1
}
orca_running=$(/usr/bin/osascript -e 'application id "com.stablyai.orca.dev" is running') || {
  print -u2 -- 'Could not verify whether custom Orca is open. No update was started.'
  return 1
}
if [[ "$orca_running" == true ]]; then
  print -u2 -- 'Quit custom Orca with Cmd-Q and let its development terminal finish first.'
  print -u2 -- 'Use normal Quit so agents keep running; do not use Quit Completely.'
  return 1
fi
