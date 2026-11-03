$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ($env:OS -ne 'Windows_NT') {
    throw 'Use the .zsh helpers on macOS. These PowerShell helpers are for Windows.'
}

$OrcaRepo = Split-Path -Parent $PSScriptRoot
$OrcaTools = Join-Path (Split-Path -Parent $OrcaRepo) '.orca-local'
$OrcaEnvironmentFile = Join-Path $OrcaTools 'windows-environment.json'
$OrcaToolDirectories = @()
if (Test-Path -LiteralPath $OrcaEnvironmentFile) {
    $OrcaSavedEnvironment = Get-Content -LiteralPath $OrcaEnvironmentFile -Raw | ConvertFrom-Json
    $OrcaToolDirectories += $OrcaSavedEnvironment.nodeDirectory
    $OrcaToolDirectories += $OrcaSavedEnvironment.pnpmDirectory
}
$OrcaExistingTools = Join-Path $env:LOCALAPPDATA 'OrcaBuildTools'
$OrcaToolDirectories += $OrcaExistingTools
$OrcaToolDirectories += Join-Path $OrcaExistingTools 'node_modules/.bin'
$OrcaToolDirectories = @($OrcaToolDirectories | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -Unique)
$env:Path = ($OrcaToolDirectories + $env:Path) -join [IO.Path]::PathSeparator

$OrcaNode = Get-Command node.exe -ErrorAction SilentlyContinue
$OrcaPnpm = Get-Command pnpm.cmd, pnpm.exe -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $OrcaNode -or -not $OrcaPnpm) {
    throw 'Install Node 24 and the pnpm version in package.json, then rerun setup-orca-fork.ps1.'
}
$OrcaPackage = Get-Content -LiteralPath (Join-Path $OrcaRepo 'package.json') -Raw | ConvertFrom-Json
$OrcaNodeVersion = & $OrcaNode.Source --version
if ($LASTEXITCODE -ne 0 -or $OrcaNodeVersion -notmatch '^v24\.') {
    throw 'This checkout requires Node 24. Select Node 24 before running these helpers.'
}
$OrcaExpectedPnpm = ($OrcaPackage.packageManager -split '\+')[0] -replace '^pnpm@', ''
$OrcaActualPnpm = & $OrcaPnpm.Source --version
if ($LASTEXITCODE -ne 0 -or $OrcaActualPnpm -ne $OrcaExpectedPnpm) {
    throw "This checkout requires pnpm $OrcaExpectedPnpm. Install it with npm install -g pnpm@$OrcaExpectedPnpm."
}

function Invoke-OrcaPnpm {
    # Windows PowerShell treats redirected progress on stderr as errors even when pnpm succeeds.
    $ErrorActionPreference = 'Continue'
    & $OrcaPnpm.Source @args 2>&1 | ForEach-Object { Write-Host $_ }
    if ($LASTEXITCODE -ne 0) {
        throw "pnpm $($args -join ' ') failed with exit code $LASTEXITCODE."
    }
}

function Assert-OrcaCustomStopped {
    $instanceFile = Join-Path $OrcaRepo 'out/dev-instance.json'
    if (Test-Path -LiteralPath $instanceFile) {
        $instance = Get-Content -LiteralPath $instanceFile -Raw | ConvertFrom-Json
        $runner = Get-Process -Id $instance.runnerPid -ErrorAction SilentlyContinue
        $recordedAt = (Get-Item -LiteralPath $instanceFile).LastWriteTimeUtc
        if ($runner -and $runner.StartTime.ToUniversalTime() -le $recordedAt) {
            throw 'Quit this custom Orca normally and wait for its launcher to finish before setup or another launch.'
        }
    }
}
