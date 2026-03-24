import path from "node:path";
import { access, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";

export const REQUIRED_SYNC_PATHS = ["orgs", "projects", "agents"];
export const REQUIRED_FILES = [
  "AGENTS.md",
  "MEMORY.md",
  "orgs/default/policies.md",
  "orgs/default/memory-governance.md",
  "orgs/default/memories.md",
  "projects/default/architecture.md",
  "projects/default/facts-index.md",
  "projects/default/memories.md",
  "agents/main/experience.md",
  ".memory-control/README.md",
  ".memory-control/candidates.json",
  ".memory-control/promotion-log.md",
];
export const CANDIDATE_STORE_TEMPLATE = {
  version: 1,
  entries: [],
};

const ALLOWED_MEMORY_TYPES = new Set([
  "stable-preference",
  "org-rule",
  "reusable-experience",
  "decision-summary",
  "file-index",
]);

const SCOPE_READ_ORDER = {
  root: ["root"],
  org: ["org", "root"],
  project: ["project", "org", "root"],
  agent: ["agent", "project", "org", "root"],
};

const TEMPLATE_FACT_SOURCES = [
  ["projects/default/architecture.md", "Project memory architecture and retrieval design"],
  ["projects/default/memories.md", "Curated project long-term memory summaries"],
  ["orgs/default/memory-governance.md", "Admission, routing, promotion, and repair rules"],
  ["orgs/default/policies.md", "Shared organization policies"],
  ["orgs/default/memories.md", "Shared organization memory ledger"],
  ["agents/main/experience.md", "Main agent private experience memory"],
];

export function resolveReadOrder(scope = "root") {
  return SCOPE_READ_ORDER[scope] ?? SCOPE_READ_ORDER.root;
}

export function evaluateCandidate(candidate) {
  const normalized = {
    status: "candidate",
    stability: "tentative",
    containsProjectFulltext: false,
    containsRawSession: false,
    isShortLived: false,
    ...candidate,
  };

  const reasons = [];
  let decision = "accept";

  if (!SCOPE_READ_ORDER[normalized.scope]) {
    decision = "reject";
    reasons.push(`Unknown scope: ${normalized.scope}`);
  }

  if (!ALLOWED_MEMORY_TYPES.has(normalized.memoryType)) {
    decision = "reject";
    reasons.push(`Unsupported memory type: ${normalized.memoryType}`);
  }

  if (normalized.containsProjectFulltext) {
    decision = "reject";
    reasons.push("Project fulltext must stay in files, not long-term memory.");
  }

  if (normalized.containsRawSession || normalized.sourceKind === "raw-session") {
    decision = "reject";
    reasons.push("Raw session payloads cannot be promoted into long-term memory.");
  }

  if (normalized.isShortLived) {
    decision = "reject";
    reasons.push("Short-lived task state cannot enter long-term memory.");
  }

  if (decision !== "reject" && normalized.stability !== "stable") {
    decision = "hold";
    reasons.push("Candidate is not stable yet.");
  }

  if (decision !== "reject" && normalized.status !== "approved") {
    decision = "hold";
    reasons.push("Candidate has not been approved for promotion.");
  }

  if (decision === "accept") {
    reasons.push("Candidate is stable, approved, and allowed into long-term memory.");
  }

  return {
    decision,
    reasons,
    candidate: normalized,
  };
}

export function patchOpenClawConfig(inputConfig, options) {
  const config = structuredClone(inputConfig ?? {});
  const changes = [];
  const openclawHome = options?.openclawHome ?? path.resolve(".");

  config.plugins ??= {};
  config.plugins.allow ??= [];
  config.plugins.entries ??= {};
  config.plugins.slots ??= {};

  ensureArrayValue(config.plugins.allow, "lossless-claw", changes, "plugins.allow");
  ensureArrayValue(
    config.plugins.allow,
    "openclaw-memory-openviking",
    changes,
    "plugins.allow"
  );

  setIfDifferent(config.plugins, "enabled", true, changes, "plugins.enabled");
  setIfDifferent(
    config.plugins.slots,
    "contextEngine",
    "lossless-claw",
    changes,
    "plugins.slots.contextEngine"
  );
  setIfDifferent(
    config.plugins.slots,
    "memory",
    "openclaw-memory-openviking",
    changes,
    "plugins.slots.memory"
  );

  const memoryEntry =
    (config.plugins.entries["openclaw-memory-openviking"] ??= {
      enabled: true,
      config: {},
    });
  setIfDifferent(
    memoryEntry,
    "enabled",
    true,
    changes,
    "plugins.entries.openclaw-memory-openviking.enabled"
  );
  memoryEntry.config ??= {};

  const memoryConfig = memoryEntry.config;
  if (!memoryConfig.baseUrl) {
    memoryConfig.baseUrl = "http://127.0.0.1:1933";
    changes.push("plugins.entries.openclaw-memory-openviking.config.baseUrl");
  }
  if (memoryConfig.tieredLoading !== true) {
    memoryConfig.tieredLoading = true;
    changes.push("plugins.entries.openclaw-memory-openviking.config.tieredLoading");
  }

  memoryConfig.sync ??= {};
  setIfDifferent(memoryConfig.sync, "onBoot", true, changes, "memory.sync.onBoot");
  setIfDifferent(memoryConfig.sync, "interval", "15m", changes, "memory.sync.interval");
  setIfDifferent(
    memoryConfig.sync,
    "waitForProcessing",
    true,
    changes,
    "memory.sync.waitForProcessing"
  );
  setIfDifferent(
    memoryConfig.sync,
    "waitTimeoutSec",
    30,
    changes,
    "memory.sync.waitTimeoutSec"
  );
  memoryConfig.sync.extraPaths ??= [];
  for (const extraPath of REQUIRED_SYNC_PATHS) {
    ensureArrayValue(memoryConfig.sync.extraPaths, extraPath, changes, "memory.sync.extraPaths");
  }

  memoryConfig.search ??= {};
  if (!memoryConfig.search.mode) {
    memoryConfig.search.mode = "find";
    changes.push("memory.search.mode");
  }
  if (!memoryConfig.search.defaultLimit) {
    memoryConfig.search.defaultLimit = 6;
    changes.push("memory.search.defaultLimit");
  }
  if (!memoryConfig.search.targetUri) {
    memoryConfig.search.targetUri = "viking://resources/openclaw/main/memory-sync";
    changes.push("memory.search.targetUri");
  }

  memoryConfig.server ??= {};
  setIfDifferent(memoryConfig.server, "enabled", true, changes, "memory.server.enabled");
  if (!memoryConfig.server.venvPath) {
    memoryConfig.server.venvPath = path.join(openclawHome, "openviking-venv");
    changes.push("memory.server.venvPath");
  }
  if (!memoryConfig.server.dataDir) {
    memoryConfig.server.dataDir = path.join(openclawHome, "openviking-data");
    changes.push("memory.server.dataDir");
  }
  if (!memoryConfig.server.host) {
    memoryConfig.server.host = "127.0.0.1";
    changes.push("memory.server.host");
  }
  if (!memoryConfig.server.port) {
    memoryConfig.server.port = 1933;
    changes.push("memory.server.port");
  }
  if (!memoryConfig.server.startupTimeoutMs) {
    memoryConfig.server.startupTimeoutMs = 30000;
    changes.push("memory.server.startupTimeoutMs");
  }

  const losslessEntry = (config.plugins.entries["lossless-claw"] ??= {
    enabled: true,
    config: {},
  });
  setIfDifferent(losslessEntry, "enabled", true, changes, "plugins.entries.lossless-claw.enabled");

  return { config, changes };
}

export function generateFactsIndexMarkdown({ generatedAt, truthSources }) {
  const lines = [
    "# Project Facts Index",
    "",
    `Generated At: ${generatedAt}`,
    "",
    "## Source-of-Truth Rule",
    "",
    "- Exact runtime and project facts must be read from files before relying on long-term memory summaries.",
    "- OpenViking stores reusable summaries and retrieval hints, not project fulltext.",
    "- When memory and files disagree, files win.",
    "",
    "## Lookup Order",
    "",
    "1. Read this index to find the right truth source.",
    "2. Open the exact file named here.",
    "3. Only then use long-term memory summaries for context.",
    "",
    "## Indexed Truth Sources",
    "",
  ];

  for (const source of truthSources) {
    lines.push(`- \`${source.path}\` - ${source.role}`);
  }

  return `${lines.join("\n")}\n`;
}

export async function promoteApprovedCandidates({ workspaceDir, store, promotedAt }) {
  const currentStore = structuredClone(store ?? CANDIDATE_STORE_TEMPLATE);
  const when = promotedAt ?? new Date().toISOString();
  let promotedCount = 0;

  for (const entry of currentStore.entries ?? []) {
    const evaluation = evaluateCandidate(entry);
    entry.lastDecision = evaluation.decision;
    entry.decisionReasons = evaluation.reasons;

    if (evaluation.decision === "reject") {
      entry.status = "rejected";
      continue;
    }

    if (evaluation.decision !== "accept") {
      continue;
    }

    const targetFile = path.join(workspaceDir, entry.targetFile);
    await mkdir(path.dirname(targetFile), { recursive: true });
    const existing = (await readTextIfExists(targetFile)) ?? "";
    const marker = `candidate_id: ${entry.id}`;

    if (!existing.includes(marker)) {
      const sectionHeader = existing.includes("## Promoted Memories")
        ? ""
        : `${existing.trimEnd() ? "\n\n" : ""}## Promoted Memories\n`;
      const block = [
        sectionHeader,
        `### ${entry.title}`,
        `- candidate_id: ${entry.id}`,
        `- promoted_at: ${when}`,
        `- scope: ${entry.scope}`,
        `- memory_type: ${entry.memoryType}`,
        `- source_kind: ${entry.sourceKind}`,
        "",
        entry.content.trimEnd(),
        "",
      ].join("\n");

      await writeFile(targetFile, `${existing}${block}`.replace(/\n{3,}/g, "\n\n"), "utf8");
    }

    entry.status = "promoted";
    entry.promotedAt = when;
    promotedCount += 1;
  }

  return {
    promotedCount,
    store: currentStore,
  };
}

export async function loadCandidateStore({ workspaceDir }) {
  const filePath = path.join(workspaceDir, ".memory-control", "candidates.json");
  const raw = await readTextIfExists(filePath);
  if (!raw) {
    return structuredClone(CANDIDATE_STORE_TEMPLATE);
  }
  return JSON.parse(raw);
}

export async function saveCandidateStore({ workspaceDir, store }) {
  const filePath = path.join(workspaceDir, ".memory-control", "candidates.json");
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  return filePath;
}

export async function appendPromotionLog({ workspaceDir, lines }) {
  const filePath = path.join(workspaceDir, ".memory-control", "promotion-log.md");
  const existing = (await readTextIfExists(filePath)) ?? "# Promotion Log\n\n";
  const suffix = lines.length > 0 ? `${lines.join("\n")}\n` : "";
  await writeFile(filePath, `${existing.trimEnd()}\n\n${suffix}`, "utf8");
  return filePath;
}

export async function discoverTruthSources({ workspaceDir, openclawHome }) {
  const truthSources = [];

  for (const [relativePath, role] of TEMPLATE_FACT_SOURCES) {
    const fullPath = path.join(workspaceDir, relativePath);
    if (await fileExists(fullPath)) {
      truthSources.push({ path: relativePath.replace(/\\/g, "/"), role });
    }
  }

  const projectDir = path.join(workspaceDir, "projects", "default");
  if (await fileExists(projectDir)) {
    const entries = await readdir(projectDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".md") || entry.name === "facts-index.md") {
        continue;
      }
      const relativePath = `projects/default/${entry.name}`;
      if (!truthSources.some((source) => source.path === relativePath)) {
        truthSources.push({
          path: relativePath,
          role: "Project markdown truth source",
        });
      }
    }
  }

  const externalSources = [
    [path.join(openclawHome, "openclaw.json"), "Runtime plugin wiring and chat provider config"],
    [path.join(openclawHome, "openviking-data", "ov.conf"), "OpenViking embedding backend and server config"],
    [
      path.join(openclawHome, "scripts", "openviking-resource-busy-regression.mjs"),
      "Regression proof for the OpenViking busy-delete fix",
    ],
    [
      path.join(openclawHome, "scripts", "openclaw-memory-governor.mjs"),
      "Doctor, repair, reindex, and promote entrypoint",
    ],
  ];

  for (const [sourcePath, role] of externalSources) {
    if (await fileExists(sourcePath)) {
      truthSources.push({ path: sourcePath, role });
    }
  }

  return truthSources;
}

export async function reindexFacts({ workspaceDir, openclawHome, generatedAt }) {
  const truthSources = await discoverTruthSources({ workspaceDir, openclawHome });
  const markdown = generateFactsIndexMarkdown({
    generatedAt: generatedAt ?? new Date().toISOString(),
    truthSources,
  });
  const factsIndexPath = path.join(workspaceDir, "projects", "default", "facts-index.md");
  await mkdir(path.dirname(factsIndexPath), { recursive: true });
  await writeFile(factsIndexPath, markdown, "utf8");
  return {
    factsIndexPath,
    truthSources,
  };
}

export async function ensureGovernanceFiles({ workspaceDir, openclawHome }) {
  const created = [];
  const templates = buildTemplates({ workspaceDir, openclawHome });

  for (const [relativePath, content] of Object.entries(templates)) {
    const fullPath = path.join(workspaceDir, relativePath);
    if (await fileExists(fullPath)) {
      continue;
    }
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content, "utf8");
    created.push(relativePath.replace(/\\/g, "/"));
  }

  return created;
}

export async function runRepair({ workspaceDir, openclawHome }) {
  const createdFiles = await ensureGovernanceFiles({ workspaceDir, openclawHome });
  const configPath = path.join(openclawHome, "openclaw.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const patched = patchOpenClawConfig(config, { openclawHome });

  if (patched.changes.length > 0) {
    await writeFile(configPath, `${JSON.stringify(patched.config, null, 2)}\n`, "utf8");
  }

  const reindex = await reindexFacts({ workspaceDir, openclawHome });

  return {
    createdFiles,
    configChanges: patched.changes,
    factsIndexPath: reindex.factsIndexPath,
    indexedSources: reindex.truthSources.length,
  };
}

export async function runDoctor({ workspaceDir, openclawHome }) {
  const checks = [];
  const configPath = path.join(openclawHome, "openclaw.json");
  const ovConfigPath = path.join(openclawHome, "openviking-data", "ov.conf");

  try {
    const config = JSON.parse(await readFile(configPath, "utf8"));
    const patched = patchOpenClawConfig(config, { openclawHome });
    checks.push({
      name: "OpenClaw memory config",
      status: patched.changes.length === 0 ? "pass" : "warn",
      details:
        patched.changes.length === 0
          ? "Required memory settings are already in place."
          : `Repair would update: ${patched.changes.join(", ")}`,
    });
  } catch (error) {
    checks.push({
      name: "OpenClaw memory config",
      status: "fail",
      details: formatError(error),
    });
  }

  let ovConfig;
  try {
    ovConfig = JSON.parse(await readFile(ovConfigPath, "utf8"));
    const provider = ovConfig?.embedding?.dense?.provider ?? "unknown";
    checks.push({
      name: "OpenViking embedding config",
      status: "pass",
      details: `Provider=${provider}, model=${ovConfig?.embedding?.dense?.model ?? "unknown"}`,
    });
  } catch (error) {
    checks.push({
      name: "OpenViking embedding config",
      status: "fail",
      details: formatError(error),
    });
  }

  const missingFiles = [];
  for (const relativePath of REQUIRED_FILES) {
    const fullPath = path.join(workspaceDir, relativePath);
    if (!(await fileExists(fullPath))) {
      missingFiles.push(relativePath.replace(/\\/g, "/"));
    }
  }
  checks.push({
    name: "Workspace governance files",
    status: missingFiles.length === 0 ? "pass" : "fail",
    details:
      missingFiles.length === 0
        ? "All required governance files are present."
        : `Missing: ${missingFiles.join(", ")}`,
  });

  try {
    const store = await loadCandidateStore({ workspaceDir });
    const valid = store && store.version === 1 && Array.isArray(store.entries);
    checks.push({
      name: "Candidate store",
      status: valid ? "pass" : "fail",
      details: valid
        ? `Candidate store is valid with ${store.entries.length} entries.`
        : "Candidate store schema is invalid.",
    });
  } catch (error) {
    checks.push({
      name: "Candidate store",
      status: "fail",
      details: formatError(error),
    });
  }

  const openVikingBaseUrl = await readOpenVikingBaseUrl(configPath);
  checks.push(await probeJsonEndpoint("OpenViking health", `${openVikingBaseUrl}/health`, true));
  checks.push(
    await probeJsonEndpoint(
      "OpenViking system status",
      `${openVikingBaseUrl}/api/v1/system/status`,
      false
    )
  );

  const embeddingProvider = ovConfig?.embedding?.dense?.provider;
  if (embeddingProvider === "ollama") {
    const apiBase = ovConfig?.embedding?.dense?.api_base ?? "http://127.0.0.1:11434/v1";
    const ollamaBase = apiBase.replace(/\/v1\/?$/, "");
    checks.push(await probeJsonEndpoint("Ollama tags", `${ollamaBase}/api/tags`, true));
  } else {
    checks.push({
      name: "Ollama tags",
      status: "warn",
      details: `Skipped because embedding provider is ${embeddingProvider ?? "unknown"}.`,
    });
  }

  const counts = checks.reduce(
    (result, check) => {
      result[check.status] += 1;
      return result;
    },
    { pass: 0, warn: 0, fail: 0 }
  );

  return {
    checks,
    summary: counts,
    ok: counts.fail === 0,
  };
}

function buildTemplates({ openclawHome }) {
  const configPath = path.join(openclawHome, "openclaw.json").replace(/\\/g, "/");
  const ovConfigPath = path.join(openclawHome, "openviking-data", "ov.conf").replace(/\\/g, "/");

  return {
    "AGENTS.md": `# Workspace Agents Guide

## Memory Governance

- Read \`orgs/default/memory-governance.md\` before editing long-term memory.
- Use \`projects/default/facts-index.md\` to find exact truth-source files.
- Stage uncertain memories in \`.memory-control/candidates.json\`.
- Only approved, stable, scoped memories may be promoted.
`,
    "MEMORY.md": `# Long-Term Memory

## System Direction

- Session context comes from \`lossless-claw\`.
- Cross-session memory comes from \`OpenViking\`.
- Project facts stay in files and documents.

## Governance Model

- Only stable, approved, scoped memories belong in long-term memory.
- Raw session text, project fulltext, and short-lived task state do not belong in long-term memory.
- Read \`orgs/default/memory-governance.md\` for the full routing and promotion policy.
`,
    "orgs/default/policies.md": `# Organization Policies

- Prefer explicit boundaries between session context, long-term memory, and project facts.
- When memory rules are unclear, choose the option that reduces leakage and confusion.
`,
    "orgs/default/memory-governance.md": `# Memory Governance

## Admission Rules

- Allow: stable preferences, organization rules, reusable experience, decision summaries, file indexes.
- Reject: raw session payloads, project fulltext, short-lived task state, speculative guesses.

## Scope Routing

- root -> \`MEMORY.md\`
- org -> \`orgs/default/memories.md\`
- project -> \`projects/default/memories.md\`
- agent -> \`agents/main/experience.md\`

## Promotion Flow

1. Stage candidate entries in \`.memory-control/candidates.json\`
2. Approve only stable entries with the right scope
3. Run \`node ${path.join(openclawHome, "scripts", "openclaw-memory-governor.mjs").replace(/\\/g, "/")} promote\`
4. Use \`promotion-log.md\` as the audit trail
`,
    "orgs/default/memories.md": `# Organization Memories

Use this file for shared long-term organization memory only.
`,
    "projects/default/architecture.md": `# Project Architecture Memory

## Current Memory Architecture

- \`contextEngine\` -> \`lossless-claw\`
- \`memory\` -> \`openclaw-memory-openviking\`
- Project facts remain grounded in files.

## Governance Extensions

- Admission gate decides what may enter long-term memory.
- Scope routing follows \`agent -> project -> org -> root\`.
- Candidate memories must stage outside synced paths first.
`,
    "projects/default/memories.md": `# Project Memories

Use this file for stable project summaries and reusable project lessons.
Do not paste project fulltext here.
`,
    "agents/main/experience.md": `# Main Agent Experience

## Working Style

- Explain architecture in plain language first.
- Prefer step-by-step system design over abstract terminology.

## Memory Rules

- Put uncertain memories into \`.memory-control/candidates.json\` first.
- Promote only approved stable entries.
- Read exact files before answering exact runtime questions.
`,
    ".memory-control/README.md": `# Memory Control

This hidden directory stores candidate memories before promotion.

- \`candidates.json\` is the staging queue
- \`promotion-log.md\` is the audit trail
- files here do not sync into OpenViking automatically
`,
    ".memory-control/candidates.json": `${JSON.stringify(CANDIDATE_STORE_TEMPLATE, null, 2)}\n`,
    ".memory-control/promotion-log.md": `# Promotion Log

No promotions yet.
`,
    "projects/default/facts-index.md": generateFactsIndexMarkdown({
      generatedAt: new Date().toISOString(),
      truthSources: [
        { path: "projects/default/architecture.md", role: "Project memory architecture and retrieval design" },
        { path: "orgs/default/memory-governance.md", role: "Admission, routing, promotion, and repair rules" },
        { path: configPath, role: "Runtime plugin wiring and chat provider config" },
        { path: ovConfigPath, role: "OpenViking embedding backend and server config" },
      ],
    }),
  };
}

async function readOpenVikingBaseUrl(configPath) {
  try {
    const config = JSON.parse(await readFile(configPath, "utf8"));
    return (
      config?.plugins?.entries?.["openclaw-memory-openviking"]?.config?.baseUrl ??
      "http://127.0.0.1:1933"
    );
  } catch {
    return "http://127.0.0.1:1933";
  }
}

async function probeJsonEndpoint(name, url, raw) {
  try {
    const payload = await fetchJson(url);
    const detail = raw ? JSON.stringify(payload) : JSON.stringify(payload?.result ?? payload);
    return {
      name,
      status: "pass",
      details: detail,
    };
  } catch (error) {
    return {
      name,
      status: "fail",
      details: formatError(error),
    };
  }
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    const text = await response.text();
    const payload = text.trim() ? JSON.parse(text) : {};
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}: ${text}`);
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function ensureArrayValue(array, value, changes, changeLabel) {
  if (!array.includes(value)) {
    array.push(value);
    changes.push(changeLabel);
  }
}

function setIfDifferent(object, key, value, changes, changeLabel) {
  if (object[key] !== value) {
    object[key] = value;
    changes.push(changeLabel);
  }
}

async function readTextIfExists(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}
