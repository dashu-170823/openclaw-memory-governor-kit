import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";

import {
  evaluateCandidate,
  generateFactsIndexMarkdown,
  patchOpenClawConfig,
  promoteApprovedCandidates,
  resolveReadOrder,
} from "./openclaw-memory-governor-lib.mjs";

test("rejects project fulltext from long-term memory", () => {
  const result = evaluateCandidate({
    id: "cand-001",
    title: "Whole project doc dump",
    scope: "project",
    targetFile: "projects/default/memories.md",
    memoryType: "file-index",
    sourceKind: "doc-extract",
    stability: "stable",
    status: "approved",
    content: "Large document body",
    containsProjectFulltext: true,
  });

  assert.equal(result.decision, "reject");
  assert.match(result.reasons.join(" "), /project fulltext/i);
});

test("scope routing prefers nearest scope first", () => {
  assert.deepEqual(resolveReadOrder("agent"), ["agent", "project", "org", "root"]);
  assert.deepEqual(resolveReadOrder("project"), ["project", "org", "root"]);
  assert.deepEqual(resolveReadOrder("org"), ["org", "root"]);
});

test("config repair preserves unrelated provider config and keeps agent-private memory out of OpenViking sync", () => {
  const original = {
    models: {
      providers: {
        custom: {
          baseUrl: "https://example.com/v1",
        },
      },
    },
    plugins: {
      entries: {
        "openclaw-memory-openviking": {
          enabled: true,
          config: {
            baseUrl: "http://127.0.0.1:1933",
            sync: {
              onBoot: false,
              interval: "5m",
              extraPaths: ["orgs", "projects", "agents"],
            },
          },
        },
      },
    },
  };

  const { config, changes } = patchOpenClawConfig(original, {
    openclawHome: "C:/Users/Administrator/.openclaw",
  });

  assert.equal(config.models.providers.custom.baseUrl, "https://example.com/v1");
  assert.equal(config.plugins.entries["openclaw-memory-openviking"].config.sync.onBoot, true);
  assert.equal(config.plugins.entries["openclaw-memory-openviking"].config.sync.interval, "15m");
  assert.equal(config.plugins.entries["openclaw-memory-openviking"].config.sync.waitForProcessing, true);
  assert.deepEqual(
    config.plugins.entries["openclaw-memory-openviking"].config.sync.extraPaths,
    ["orgs", "projects"]
  );
  assert.ok(changes.length > 0);
});

test("facts index rendering includes truth sources", () => {
  const markdown = generateFactsIndexMarkdown({
    generatedAt: "2026-03-25T10:00:00.000Z",
    truthSources: [
      {
        path: "projects/default/architecture.md",
        role: "Project architecture summary",
      },
      {
        path: "C:/Users/Administrator/.openclaw/openclaw.json",
        role: "Runtime plugin wiring",
      },
    ],
  });

  assert.match(markdown, /Project architecture summary/);
  assert.match(markdown, /openclaw\.json/);
  assert.match(markdown, /Generated At/);
});

test("approved candidate promotion writes to target file and marks entry as promoted", async () => {
  const workspaceDir = await mkdtemp(path.join(os.tmpdir(), "openclaw-memory-governor-"));
  const targetFile = path.join(workspaceDir, "agents", "main", "experience.md");

  await mkdir(path.dirname(targetFile), { recursive: true });
  await writeFile(targetFile, "# Main Agent Experience\n\n## Promoted Memories\n", "utf8");

  const store = {
    version: 1,
    entries: [
      {
        id: "cand-approve-001",
        title: "Stable troubleshooting lesson",
        scope: "agent",
        targetFile: "agents/main/experience.md",
        memoryType: "reusable-experience",
        sourceKind: "session-summary",
        stability: "stable",
        status: "approved",
        content: "- Reindex facts before answering exact runtime config questions.\n",
      },
    ],
  };

  const result = await promoteApprovedCandidates({
    workspaceDir,
    store,
    promotedAt: "2026-03-25T10:00:00.000Z",
  });

  const written = await readFile(targetFile, "utf8");
  assert.equal(result.promotedCount, 1);
  assert.match(written, /Stable troubleshooting lesson/);
  assert.equal(result.store.entries[0].status, "promoted");
});
