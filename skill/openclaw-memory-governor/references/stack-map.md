# OpenClaw Memory Stack Map

## Path Resolution

Use these resolution rules:

### OpenClaw home

1. User-provided path
2. `OPENCLAW_HOME`
3. `~/.openclaw`

### Codex home

1. User-provided path
2. `CODEX_HOME`
3. `~/.codex`

On a typical Windows install, these become:

- OpenClaw home: `%USERPROFILE%\.openclaw`
- Codex home: `%USERPROFILE%\.codex`

## Core Runtime Paths

- Main config: `<OPENCLAW_HOME>/openclaw.json`
- OpenViking config: `<OPENCLAW_HOME>/openviking-data/ov.conf`
- Governor CLI: `<OPENCLAW_HOME>/scripts/openclaw-memory-governor.mjs`
- Governor library: `<OPENCLAW_HOME>/scripts/openclaw-memory-governor-lib.mjs`
- Governor tests: `<OPENCLAW_HOME>/scripts/openclaw-memory-governor.test.mjs`

## Memory Layers

### Current session

- Engine: `lossless-claw`
- Purpose: raw session context and live context assembly

### Cross-session retrieval

- Engine: `openclaw-memory-openviking`
- Purpose: reusable summaries and retrieval hints
- Not for: project fulltext or raw transcripts
- Default sync boundary: `orgs` and `projects`
- Keep `agents/*` file-local by default to reduce cross-agent memory pollution

### File-grounded truth

- Root memory: `<OPENCLAW_HOME>/workspace/MEMORY.md`
- Organization rules: `<OPENCLAW_HOME>/workspace/orgs/default/memory-governance.md`
- Organization memory: `<OPENCLAW_HOME>/workspace/orgs/default/memories.md`
- Project architecture: `<OPENCLAW_HOME>/workspace/projects/default/architecture.md`
- Project facts index: `<OPENCLAW_HOME>/workspace/projects/default/facts-index.md`
- Project memory: `<OPENCLAW_HOME>/workspace/projects/default/memories.md`
- Agent-private experience: `<OPENCLAW_HOME>/workspace/agents/main/experience.md`

### Candidate staging

- Candidate queue: `<OPENCLAW_HOME>/workspace/.memory-control/candidates.json`
- Promotion audit log: `<OPENCLAW_HOME>/workspace/.memory-control/promotion-log.md`

## Placement Rules

- `root`: global long-term memory and top-level direction
- `org`: shared rules and reusable organization memory
- `project`: reusable project summaries and decision memory
- `agent`: private agent experience and stable working lessons
- `.memory-control`: candidate memory that is not ready for long-term sync

## Sync Boundary

- `OpenViking` is the shared cross-session retrieval layer for stable shared memory.
- By default, only `org` and `project` memory should sync into it.
- `agent` memory stays local unless someone deliberately rewrites part of it into shared summaries.

## Allowed Long-Term Memory

- stable preferences
- organization rules
- reusable experience
- decision summaries
- file indexes and retrieval hints

## Rejected Long-Term Memory

- raw session transcripts
- project fulltext
- short-lived task state
- speculative or unconfirmed claims

## Command Recipes

### Doctor

```powershell
node <OPENCLAW_HOME>/scripts/openclaw-memory-governor.mjs doctor
```

### Repair

```powershell
node <OPENCLAW_HOME>/scripts/openclaw-memory-governor.mjs repair
```

### Reindex

```powershell
node <OPENCLAW_HOME>/scripts/openclaw-memory-governor.mjs reindex
```

### Promote

```powershell
node <OPENCLAW_HOME>/scripts/openclaw-memory-governor.mjs promote
```

### Validate Governor Changes

```powershell
node --test <OPENCLAW_HOME>/scripts/openclaw-memory-governor.test.mjs
node <OPENCLAW_HOME>/scripts/openclaw-memory-governor.mjs doctor
```

## OpenViking Recovery

If `doctor` fails because `OpenViking` is not listening on `127.0.0.1:1933`, start it with:

```powershell
Start-Process -FilePath '<OPENCLAW_HOME>\openviking-venv\Scripts\openviking-server.exe' -ArgumentList '--config','<OPENCLAW_HOME>\openviking-data\ov.conf','--host','127.0.0.1','--port','1933' -WindowStyle Hidden
```

Then rerun `doctor`.
