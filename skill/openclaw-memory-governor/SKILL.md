---
name: openclaw-memory-governor
description: Use when working on an OpenClaw memory stack that uses lossless-claw, OpenViking, workspace memory files, or candidate memory promotion, especially for install, doctor, repair, reindex, promote, or explaining scoped memory governance.
---

# OpenClaw Memory Governor

Manage an OpenClaw memory stack through one entry point. Use this skill when the user wants to inspect, repair, reindex, promote, install, or explain a memory system built from `lossless-claw`, `OpenViking`, and workspace memory files.

## Resolve Paths First

Before acting, resolve the target OpenClaw home and Codex home:

1. If the user gives an explicit path, use it.
2. Else if `OPENCLAW_HOME` exists, use it.
3. Else default to `~/.openclaw`.

For Codex skill installation:

1. If the user gives an explicit Codex path, use it.
2. Else if `CODEX_HOME` exists, use it.
3. Else default to `~/.codex`.

Verify these paths before running commands:

- `<OPENCLAW_HOME>/openclaw.json`
- `<OPENCLAW_HOME>/scripts/openclaw-memory-governor.mjs`
- `<OPENCLAW_HOME>/workspace`

If the governor script is missing, the stack has not been installed yet. Read `references/stack-map.md` and switch to install guidance.

## Intent Mapping

Map the user's request to one of these actions:

- `install`: install the governor runtime and skill into a target OpenClaw + Codex setup
- `doctor`: inspect the live memory stack
- `repair`: backfill missing files and repair memory config drift
- `reindex`: rebuild `projects/default/facts-index.md`
- `promote`: move approved candidate memories into scoped long-term memory files
- `explain`: explain what belongs in `root`, `org`, `project`, `agent`, or `.memory-control`

If the user asks to inspect, diagnose, or health-check the memory stack, use `doctor`.
If the user asks to fix, repair, backfill, or stabilize the memory stack, use `repair`.
If the user asks to rebuild the facts index or refresh indexed truth sources, use `reindex`.
If the user asks to promote approved candidate memory into long-term memory, use `promote`.
If the user asks where a memory should live or how the architecture works, use `explain`.
If the user asks to add this stack to another machine or another OpenClaw instance, use `install`.

If the state is unclear, start with `doctor` before `repair`.

## Actions

### `install`

For Windows-first installs, use the repo installer if present:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

If the installer is not available, copy these files into the target OpenClaw home:

- `<REPO>/runtime/scripts/openclaw-memory-governor.mjs` -> `<OPENCLAW_HOME>/scripts/`
- `<REPO>/runtime/scripts/openclaw-memory-governor-lib.mjs` -> `<OPENCLAW_HOME>/scripts/`
- `<REPO>/runtime/scripts/openclaw-memory-governor.test.mjs` -> `<OPENCLAW_HOME>/scripts/`

Then copy this skill folder into:

- `<CODEX_HOME>/skills/openclaw-memory-governor`

After installation, run:

```powershell
node <OPENCLAW_HOME>/scripts/openclaw-memory-governor.mjs repair
node <OPENCLAW_HOME>/scripts/openclaw-memory-governor.mjs doctor
```

### `doctor`

1. Run:

```powershell
node <OPENCLAW_HOME>/scripts/openclaw-memory-governor.mjs doctor
```

2. Summarize passes and failures in plain language.
3. If `OpenViking health` fails because port `1933` is down and the venv exists, start the server with:

```powershell
Start-Process -FilePath '<OPENCLAW_HOME>\openviking-venv\Scripts\openviking-server.exe' -ArgumentList '--config','<OPENCLAW_HOME>\openviking-data\ov.conf','--host','127.0.0.1','--port','1933' -WindowStyle Hidden
```

4. Wait a few seconds and rerun `doctor`.

### `repair`

1. Run:

```powershell
node <OPENCLAW_HOME>/scripts/openclaw-memory-governor.mjs repair
```

2. Report created files and memory-specific config changes.
3. Immediately rerun `doctor` and report any remaining failures.

Important:

- Preserve unrelated chat provider settings in `openclaw.json`.
- Only repair memory-specific wiring, governance files, and the facts index.

### `reindex`

1. Run:

```powershell
node <OPENCLAW_HOME>/scripts/openclaw-memory-governor.mjs reindex
```

2. Read `<OPENCLAW_HOME>/workspace/projects/default/facts-index.md`.
3. Summarize which files are currently treated as truth sources.

### `promote`

1. Read `<OPENCLAW_HOME>/workspace/.memory-control/candidates.json`.
2. Promote only entries that are already `approved` and stable.
3. Run:

```powershell
node <OPENCLAW_HOME>/scripts/openclaw-memory-governor.mjs promote
```

4. Report promoted count and target files.
5. Mention `promotion-log.md` if the user asks for audit history.

Never silently rewrite candidate content or change scope without the user's request.

### `explain`

Use `references/stack-map.md`, then explain with these rules:

- `lossless-claw` holds current-session raw context
- `OpenViking` holds cross-session reusable summaries and retrieval hints
- project fulltext stays in files
- candidate memory stages in `.memory-control`
- retrieval order is `agent -> project -> org -> root`

## Safety Rules

- Never write raw session transcripts into long-term memory files.
- Never put project fulltext into `OpenViking`-backed long-term memory.
- Never store short-lived task state as long-term memory.
- Never overwrite unrelated parts of `openclaw.json`.
- If governor code changes, run both:

```powershell
node --test <OPENCLAW_HOME>/scripts/openclaw-memory-governor.test.mjs
node <OPENCLAW_HOME>/scripts/openclaw-memory-governor.mjs doctor
```

- If the target OpenClaw path differs from the default location, inspect it before running any install or repair command.

## Output Style

- Keep explanations concrete and scoped.
- When reporting health, group by `config`, `files`, `OpenViking`, `Ollama`, and `memory candidates`.
- When explaining memory placement, say clearly whether the answer is `root`, `org`, `project`, `agent`, or `.memory-control`.
