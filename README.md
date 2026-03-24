# OpenClaw Memory Governor Kit

Windows-first GitHub-ready package for installing and sharing an OpenClaw memory governance stack.

## What It Installs

- Codex skill:
  - `skill/openclaw-memory-governor`
- OpenClaw runtime scripts:
  - `runtime/scripts/openclaw-memory-governor.mjs`
  - `runtime/scripts/openclaw-memory-governor-lib.mjs`
  - `runtime/scripts/openclaw-memory-governor.test.mjs`

The runtime scripts are copied into the target OpenClaw home, then `repair` can backfill governance files and memory config defaults.

## Default Target Paths

- OpenClaw home: `~/.openclaw`
- Codex home: `~/.codex`

On Windows these usually resolve to:

- `C:\Users\<YourUser>\.openclaw`
- `C:\Users\<YourUser>\.codex`

## Quick Install

From the repo root:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

If your paths are custom:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -OpenClawHome "D:\custom\.openclaw" -CodexHome "D:\custom\.codex"
```

If you only want file copy without running repair/doctor:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -SkipRepair
```

## What The Installer Does

1. Verifies the target OpenClaw home already exists and contains `openclaw.json`
2. Copies the skill into `<CODEX_HOME>/skills/openclaw-memory-governor`
3. Copies the runtime scripts into `<OPENCLAW_HOME>/scripts`
4. Optionally runs:
   - `node <OPENCLAW_HOME>/scripts/openclaw-memory-governor.mjs repair`
   - `node <OPENCLAW_HOME>/scripts/openclaw-memory-governor.mjs doctor`

## After Install

Use the skill from Codex with prompts like:

- `$openclaw-memory-governor doctor`
- `$openclaw-memory-governor repair`
- `$openclaw-memory-governor reindex`
- `$openclaw-memory-governor promote`

## Repo Layout

```text
.
├─ install.ps1
├─ README.md
├─ runtime/
│  └─ scripts/
└─ skill/
   └─ openclaw-memory-governor/
```
