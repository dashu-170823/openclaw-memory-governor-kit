import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  appendPromotionLog,
  loadCandidateStore,
  promoteApprovedCandidates,
  reindexFacts,
  runDoctor,
  runRepair,
  saveCandidateStore,
} from "./openclaw-memory-governor-lib.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const scriptsDir = path.dirname(scriptPath);
const openclawHome = path.dirname(scriptsDir);
const workspaceDir = path.join(openclawHome, "workspace");

const [command = "doctor"] = process.argv.slice(2);

try {
  switch (command) {
    case "doctor":
      await doctor();
      break;
    case "repair":
      await repair();
      break;
    case "reindex":
      await reindex();
      break;
    case "promote":
      await promote();
      break;
    case "help":
    case "--help":
    case "-h":
      printHelp();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
}

async function doctor() {
  const result = await runDoctor({ workspaceDir, openclawHome });

  console.log("OpenClaw Memory Doctor");
  console.log("");
  for (const check of result.checks) {
    console.log(`[${check.status.toUpperCase()}] ${check.name}`);
    console.log(`  ${check.details}`);
  }

  console.log("");
  console.log(
    `Summary: pass=${result.summary.pass} warn=${result.summary.warn} fail=${result.summary.fail}`
  );

  if (!result.ok) {
    process.exitCode = 1;
  }
}

async function repair() {
  const result = await runRepair({ workspaceDir, openclawHome });

  console.log("OpenClaw Memory Repair");
  console.log("");
  console.log(`Created files: ${result.createdFiles.length}`);
  for (const createdFile of result.createdFiles) {
    console.log(`- ${createdFile}`);
  }
  console.log(`Config changes: ${result.configChanges.length}`);
  for (const change of result.configChanges) {
    console.log(`- ${change}`);
  }
  console.log(`Facts index: ${result.factsIndexPath}`);
  console.log(`Indexed truth sources: ${result.indexedSources}`);
}

async function reindex() {
  const result = await reindexFacts({ workspaceDir, openclawHome });

  console.log("OpenClaw Memory Reindex");
  console.log("");
  console.log(`Facts index: ${result.factsIndexPath}`);
  console.log(`Indexed truth sources: ${result.truthSources.length}`);
}

async function promote() {
  const store = await loadCandidateStore({ workspaceDir });
  const result = await promoteApprovedCandidates({ workspaceDir, store });
  const storePath = await saveCandidateStore({ workspaceDir, store: result.store });

  const promotedEntries = result.store.entries.filter((entry) => entry.status === "promoted");
  const lines = promotedEntries.map(
    (entry) => `- ${entry.promotedAt} | ${entry.id} | ${entry.scope} | ${entry.targetFile}`
  );
  await appendPromotionLog({ workspaceDir, lines });

  console.log("OpenClaw Memory Promote");
  console.log("");
  console.log(`Promoted entries: ${result.promotedCount}`);
  console.log(`Candidate store: ${storePath}`);
}

function printHelp() {
  console.log("Usage: node openclaw-memory-governor.mjs <doctor|repair|reindex|promote>");
}
