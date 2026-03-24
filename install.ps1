[CmdletBinding()]
param(
  [string]$OpenClawHome = $(if ($env:OPENCLAW_HOME) { $env:OPENCLAW_HOME } else { Join-Path $HOME ".openclaw" }),
  [string]$CodexHome = $(if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME ".codex" }),
  [switch]$SkipRepair
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$skillSource = Join-Path (Join-Path $repoRoot "skill") "openclaw-memory-governor"
$runtimeSource = Join-Path (Join-Path $repoRoot "runtime") "scripts"

$skillTargetRoot = Join-Path $CodexHome "skills"
$skillTarget = Join-Path $skillTargetRoot "openclaw-memory-governor"
$runtimeTarget = Join-Path $OpenClawHome "scripts"
$configPath = Join-Path $OpenClawHome "openclaw.json"
$governorPath = Join-Path $runtimeTarget "openclaw-memory-governor.mjs"

function Ensure-Exists {
  param(
    [string]$PathValue,
    [string]$Label
  )

  if (-not (Test-Path $PathValue)) {
    throw "$Label not found: $PathValue"
  }
}

Ensure-Exists -PathValue $skillSource -Label "Skill source"
Ensure-Exists -PathValue $runtimeSource -Label "Runtime source"
Ensure-Exists -PathValue $configPath -Label "OpenClaw config"

New-Item -ItemType Directory -Path $skillTarget -Force | Out-Null
New-Item -ItemType Directory -Path $runtimeTarget -Force | Out-Null

Copy-Item -Path (Join-Path $skillSource "*") -Destination $skillTarget -Recurse -Force
Copy-Item -Path (Join-Path $runtimeSource "*") -Destination $runtimeTarget -Recurse -Force

Write-Host "Installed skill to: $skillTarget"
Write-Host "Installed runtime scripts to: $runtimeTarget"

if ($SkipRepair) {
  Write-Host "SkipRepair set. Next steps:"
  Write-Host "  node $governorPath repair"
  Write-Host "  node $governorPath doctor"
  exit 0
}

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
  Write-Warning "Node was not found in PATH. Files were copied, but repair/doctor were skipped."
  Write-Host "Run these manually once Node is available:"
  Write-Host "  node $governorPath repair"
  Write-Host "  node $governorPath doctor"
  exit 0
}

& $nodeCommand.Source $governorPath repair
if ($LASTEXITCODE -ne 0) {
  throw "Governor repair failed."
}

& $nodeCommand.Source $governorPath doctor
if ($LASTEXITCODE -ne 0) {
  throw "Governor doctor reported failures."
}

Write-Host "OpenClaw memory governor install completed."
