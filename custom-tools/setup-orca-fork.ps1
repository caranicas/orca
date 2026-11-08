param([switch]$SkipTypecheck)

. "$PSScriptRoot/orca-local-env.ps1"
Assert-OrcaCustomStopped

$OrcaVswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio/Installer/vswhere.exe'
if (-not (Test-Path -LiteralPath $OrcaVswhere)) {
    throw 'Install Visual Studio 2022 Build Tools with Desktop development with C++, including the Windows SDK.'
}
$OrcaCompiler = & $OrcaVswhere -latest -products '*' -version '[17.0,)' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $OrcaCompiler) {
    throw 'Install Visual Studio 2022 Build Tools with Desktop development with C++, including the Windows SDK.'
}
if (-not (Get-Command python.exe, py.exe -ErrorAction SilentlyContinue)) {
    throw 'Install Python 3 for node-gyp, then rerun setup.'
}
if (-not (Get-Command cargo.exe -ErrorAction SilentlyContinue)) {
    throw 'Install Rust with the Windows MSVC toolchain for the native CLI launcher and agent hooks, then rerun setup.'
}

New-Item -ItemType Directory -Path $OrcaTools -Force | Out-Null
Push-Location $OrcaRepo
try {
    Invoke-OrcaPnpm install --frozen-lockfile
    Invoke-OrcaPnpm -C mobile install --frozen-lockfile
    if (-not $SkipTypecheck) {
        Invoke-OrcaPnpm tc
    }
    Invoke-OrcaPnpm build:native
    Invoke-OrcaPnpm build:desktop:assets
    @{
        nodeDirectory = Split-Path -Parent $OrcaNode.Source
        pnpmDirectory = Split-Path -Parent $OrcaPnpm.Source
    } | ConvertTo-Json | Set-Content -LiteralPath $OrcaEnvironmentFile -Encoding UTF8
} finally {
    Pop-Location
}
Write-Host '[Orca setup] Windows dependencies ready. Double-click custom-tools/start-orca-custom.cmd to launch.'
