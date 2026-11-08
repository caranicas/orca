param([string]$ProfilePath)

. "$PSScriptRoot/orca-local-env.ps1"
Assert-OrcaCustomStopped

if (-not (Test-Path -LiteralPath (Join-Path $OrcaRepo 'node_modules'))) {
    throw 'Run custom-tools/setup-orca-fork.ps1 before launching.'
}

$OrcaProfileSelection = Join-Path $OrcaTools 'windows-profile.txt'
if ($ProfilePath) {
    if (-not (Test-Path -LiteralPath $ProfilePath -PathType Container)) {
        throw 'The selected profile directory does not exist. No profile selection was changed.'
    }
    $ProfilePath = (Resolve-Path -LiteralPath $ProfilePath).ProviderPath
    New-Item -ItemType Directory -Path $OrcaTools -Force | Out-Null
    Set-Content -LiteralPath $OrcaProfileSelection -Value $ProfilePath -Encoding UTF8
} elseif (Test-Path -LiteralPath $OrcaProfileSelection) {
    $ProfilePath = (Get-Content -LiteralPath $OrcaProfileSelection -Raw).Trim()
    if (-not $ProfilePath -or -not (Test-Path -LiteralPath $ProfilePath -PathType Container)) {
        throw 'The saved profile directory is missing. Launch with -ProfilePath to select an existing profile.'
    }
} else {
    $ProfilePath = Join-Path $OrcaTools 'orca-dev-windows'
}
$env:ORCA_DEV_USER_DATA_PATH = $ProfilePath
Write-Host '[Orca custom] Starting your custom Windows build. Keep this console open while using Orca.'
Write-Host "[Orca custom] Profile: $env:ORCA_DEV_USER_DATA_PATH"
Push-Location $OrcaRepo
try {
    & $OrcaNode.Source (Join-Path $OrcaRepo 'custom-tools/updates/fork-update-supervisor.mjs')
    if ($LASTEXITCODE -ne 0) { throw "Orca launcher exited with code $LASTEXITCODE." }
} finally {
    Pop-Location
}
