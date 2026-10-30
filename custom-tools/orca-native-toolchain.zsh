orca_configure_native_toolchain() {
  local orca_probe='#include <string>\n#include <functional>\n#include <memory>\n#include <atomic>\nint main() { std::string s; return s.size(); }\n'
  if printf '%b' "$orca_probe" | xcrun clang++ -std=c++20 -fsyntax-only -x c++ - >/dev/null 2>&1; then
    return 0
  fi
  local orca_sdk
  orca_sdk=$(xcrun --show-sdk-path) || return 1
  local orca_headers="$orca_sdk/usr/include/c++/v1"
  if [[ ! -f "$orca_headers/string" ]]; then
    print -u2 -- '[Orca setup] Standard C++ headers are missing from the selected SDK.'
    return 1
  fi
  export CPLUS_INCLUDE_PATH="$orca_headers${CPLUS_INCLUDE_PATH:+:$CPLUS_INCLUDE_PATH}"
  if ! printf '%b' "$orca_probe" | xcrun clang++ -std=c++20 -fsyntax-only -x c++ -; then
    print -u2 -- '[Orca setup] The C++ compiler still fails with explicit SDK headers.'
    return 1
  fi
  print -- '[Orca setup] Using explicit SDK C++ headers for this process.'
}
orca_configure_native_toolchain
unfunction orca_configure_native_toolchain
