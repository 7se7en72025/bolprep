// Summarize exported turn metadata locally; no transcript/audio or provider calls.
const fs = require("node:fs");
const crypto = require("node:crypto");

const outcomes = ["completed", "failed", "cancelled"];
const toolNames = new Set(["start_quiz", "score_answer", "save_progress", "get_weak_topics"]);
const object = (value) => value && typeof value === "object" && !Array.isArray(value);
const duration = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0;

function record(raw, label) {
  const invalid = () => { throw new Error(`${label} has unsupported or missing turn metadata.`); };
  if (!object(raw) || !outcomes.includes(raw.outcome) || !["hi-IN", "en-IN"].includes(raw.language)
    || !duration(raw.client_duration_ms)) invalid();
  if (!(raw.request_id === null || (typeof raw.request_id === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw.request_id)))) invalid();
  if (typeof raw.started_at_utc !== "string"
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/.test(raw.started_at_utc)
    || !Number.isFinite(Date.parse(raw.started_at_utc))) invalid();
  const utc = raw.started_at_utc.replace(/\+00:00$/, "Z");
  const milliseconds = utc.includes(".")
    ? utc.replace(/\.(\d+)Z$/, (_, digits) => `.${(digits + "000").slice(0, 3)}Z`)
    : utc.replace(/Z$/, ".000Z");
  if (new Date(raw.started_at_utc).toISOString() !== milliseconds) invalid();
  const models = raw.provider_reported_models ?? null;
  if (models !== null && (!Array.isArray(models) || models.length > 4
    || models.length !== raw.model_response_count
    || (raw.mode !== "model" && models.length)
    || !models.every((model) => model === null || (typeof model === "string"
      && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(model))))) invalid();
  const status = raw.server_metadata_status === undefined ? "legacy" : raw.server_metadata_status;
  if (!["valid", "invalid", "unavailable", "legacy"].includes(status)
    || !(raw.server_duration_ms === null || duration(raw.server_duration_ms))
    || ![null, "offline", "model"].includes(raw.mode)
    || !(raw.configured_model === null || (typeof raw.configured_model === "string"
      && /^[a-z0-9_.:-]{1,128}$/i.test(raw.configured_model)))
    || !(raw.source_count === null || (Number.isSafeInteger(raw.source_count)
      && raw.source_count >= 0 && raw.source_count <= 100))
    || !Array.isArray(raw.tool_outcomes) || raw.tool_outcomes.length > 6
    || !raw.tool_outcomes.every((tool) => object(tool) && toolNames.has(tool.name)
      && typeof tool.ok === "boolean")) invalid();
  if (["invalid", "unavailable"].includes(status)
    && (raw.server_duration_ms !== null || raw.mode !== null || raw.configured_model !== null
      || raw.source_count !== null || raw.tool_outcomes.length || models !== null)) invalid();
  if (status === "valid" && (raw.server_duration_ms === null || raw.mode === null || raw.source_count === null)) invalid();
  return {
    request_id: raw.request_id?.toLowerCase() ?? null,
    started_at_utc: utc,
    outcome: raw.outcome,
    language: raw.language,
    client_duration_ms: raw.client_duration_ms,
    server_duration_ms: raw.server_duration_ms,
    mode: raw.mode,
    configured_model: raw.configured_model,
    provider_reported_models: models,
    source_count: raw.source_count,
    server_metadata_status: status,
    tool_outcomes: raw.tool_outcomes.map(({ name, ok }) => ({ name, ok })),
  };
}

function percentiles(values) {
  if (!values.length) return { sample_count: 0, p50_ms: null, p95_ms: null };
  const sorted = values.slice().sort((a, b) => a - b);
  const at = (fraction) => sorted[Math.ceil(sorted.length * fraction) - 1];
  return { sample_count: sorted.length, p50_ms: at(0.5), p95_ms: at(0.95) };
}

function summarize(paths) {
  const seenIds = new Map();
  const seenWithoutIds = new Set();
  const groups = new Map();
  let inputCount = 0;
  let duplicatesById = 0;
  let duplicatesWithoutId = 0;
  paths.forEach((path, fileIndex) => {
    const label = `Input ${fileIndex + 1}`;
    let document;
    try {
      if (fs.statSync(path).size > 4 * 1024 * 1024) throw new Error("large");
      document = JSON.parse(fs.readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
    } catch { throw new Error(`${label} must be readable JSON no larger than 4 MiB.`); }
    if (!object(document) || ![12, 13, 14, 15].includes(document.schema_version)
      || !Array.isArray(document.tutor_turns) || document.tutor_turns.length > 500) {
      throw new Error(`${label} must be a schema 12-15 export with at most 500 tutor turns.`);
    }
    document.tutor_turns.forEach((raw, index) => {
      const turn = record(raw, `${label}, turn ${index + 1}`);
      inputCount += 1;
      const fingerprint = crypto.createHash("sha256").update(JSON.stringify(turn)).digest("hex");
      if (turn.request_id !== null) {
        if (seenIds.has(turn.request_id)) {
          if (seenIds.get(turn.request_id) !== fingerprint) {
            throw new Error(`${label}, turn ${index + 1} conflicts with an earlier request ID.`);
          }
          duplicatesById += 1;
          return;
        }
        seenIds.set(turn.request_id, fingerprint);
      } else {
        if (seenWithoutIds.has(fingerprint)) { duplicatesWithoutId += 1; return; }
        seenWithoutIds.add(fingerprint);
      }
      const configuration = {
        language: turn.language, mode: turn.mode, configured_model: turn.configured_model,
        provider_reported_models: turn.provider_reported_models,
        server_metadata_status: turn.server_metadata_status,
      };
      const key = JSON.stringify(configuration);
      if (!groups.has(key)) groups.set(key, { configuration, turns: [] });
      groups.get(key).turns.push(turn);
    });
  });
  return {
    report_schema_version: 1,
    generated_at_utc: new Date().toISOString(),
    input_export_count: paths.length,
    input_turn_count: inputCount,
    unique_turn_count: seenIds.size + seenWithoutIds.size,
    duplicates_removed: { by_request_id: duplicatesById, by_identical_metadata_without_id: duplicatesWithoutId },
    limitations: [
      "Client request time and server processing time exclude subsequent speech; neither is acoustic voice latency.",
      "Completed, failed, and canceled durations remain separate; missing server times are excluded with explicit sample counts.",
      "Metadata is self-reported; authenticity, answer quality, citation support, device/environment, and provider cancellation are not verified.",
      "Source counts indicate retrieved notes, and tool outcomes indicate reported execution; neither proves learner success or scoring correctness.",
      "Direct quiz/progress requests and speech attempts are outside these tutor traces. Exports retain at most 500 page-local turns.",
      "Deduplication compares only selected metadata. Null-ID identical records may collapse distinct turns; changed snapshots remain separate.",
      "ID and null-ID snapshots remain separate. Legacy and current metadata under one ID conflict; do not combine these snapshots.",
      "Usage and monetary cost are not summarized. No prompt pairing or controlled experiment is established.",
      "Provider-reported model IDs are grouped in response order; missing IDs stay null. IDs may be aliases, not immutable versions. Speech model IDs are outside this report.",
    ],
    groups: [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, group]) => {
      const tools = new Map();
      group.turns.forEach((turn) => turn.tool_outcomes.forEach(({ name, ok }) => {
        if (!tools.has(name)) tools.set(name, { name, succeeded: 0, failed: 0 });
        tools.get(name)[ok ? "succeeded" : "failed"] += 1;
      }));
      const completed = group.turns.filter((turn) => turn.outcome === "completed");
      return {
        configuration: group.configuration,
        turn_count: group.turns.length,
        outcomes: Object.fromEntries(outcomes.map((outcome) => {
          const turns = group.turns.filter((turn) => turn.outcome === outcome);
          return [outcome, {
            turn_count: turns.length,
            client_duration: percentiles(turns.map((turn) => turn.client_duration_ms)),
            server_duration: percentiles(turns.filter((turn) => turn.server_duration_ms !== null)
              .map((turn) => turn.server_duration_ms)),
          }];
        })),
        completed_source_metadata: {
          with_notes: completed.filter((turn) => turn.source_count > 0).length,
          without_notes: completed.filter((turn) => turn.source_count === 0).length,
          unavailable: completed.filter((turn) => turn.source_count === null).length,
        },
        reported_tools: [...tools.values()].sort((a, b) => a.name.localeCompare(b.name)),
      };
    }),
  };
}

const paths = process.argv.slice(2);
if (paths.length === 1 && paths[0] === "--help") {
  console.log("Usage: node evals/summarize_tutor_turns.js export1.json [export2.json ...]\nLocal schema 12-15 tutor outcome/timing summary; JSON stdout, no provider calls or acoustic latency claims.");
} else if (!paths.length || paths.length > 100) {
  console.error("Provide 1-100 diagnostics exports. Use --help for usage.");
  process.exitCode = 1;
} else {
  try { console.log(JSON.stringify(summarize(paths), null, 2)); }
  catch (error) {
    console.error(`Could not summarize tutor turns: ${error.message}`);
    process.exitCode = 1;
  }
}
