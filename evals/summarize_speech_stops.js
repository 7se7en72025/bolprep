// Local stop-command metadata summary; no transcripts, audio, or provider calls.
const fs = require("node:fs");
const crypto = require("node:crypto");

const reasons = new Set([
  "detected-speech", "follow-up", "stop-button", "escape", "request-failed", "other-control",
]);
const stateFields = [
  "browser_speaking", "browser_pending", "provider_request_active", "progressive_session_active",
];

function record(raw, label) {
  const invalid = () => { throw new Error(`${label} has unsupported or missing stop metadata.`); };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) invalid();
  if (typeof raw.started_at_utc !== "string"
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(raw.started_at_utc)
    || !Number.isFinite(Date.parse(raw.started_at_utc))
    || new Date(raw.started_at_utc).toISOString() !== raw.started_at_utc) invalid();
  if (!reasons.has(raw.reason)) invalid();
  const result = { started_at_utc: raw.started_at_utc, reason: raw.reason };
  for (const field of stateFields) {
    if (typeof raw[field] !== "boolean") invalid();
    result[field] = raw[field];
  }
  for (const field of ["speech_turn", "scheduled_pcm_sources", "source_stop_exceptions"]) {
    if (!Number.isSafeInteger(raw[field]) || raw[field] < 0) invalid();
    result[field] = raw[field];
  }
  if (result.source_stop_exceptions > result.scheduled_pcm_sources) invalid();
  if (typeof raw.stop_dispatch_ms !== "number" || !Number.isFinite(raw.stop_dispatch_ms)
    || raw.stop_dispatch_ms < 0) invalid();
  result.stop_dispatch_ms = raw.stop_dispatch_ms;
  return result;
}

function percentiles(values) {
  if (!values.length) return { sample_count: 0, p50_ms: null, p95_ms: null };
  const sorted = values.slice().sort((a, b) => a - b);
  const at = (fraction) => sorted[Math.ceil(sorted.length * fraction) - 1];
  return { sample_count: sorted.length, p50_ms: at(0.5), p95_ms: at(0.95) };
}

function summarize(paths) {
  const seen = new Set();
  const groups = new Map();
  const schemas = new Set();
  let inputCount = 0;
  paths.forEach((path, fileIndex) => {
    const label = `Input ${fileIndex + 1}`;
    let document;
    try {
      if (fs.statSync(path).size > 4 * 1024 * 1024) throw new Error("large");
      document = JSON.parse(fs.readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
    } catch {
      throw new Error(`${label} must be readable JSON no larger than 4 MiB.`);
    }
    if (!document || ![11, 12].includes(document.schema_version)
      || !Array.isArray(document.speech_stops) || document.speech_stops.length > 500) {
      throw new Error(`${label} must be a schema 11-12 export with at most 500 speech stops.`);
    }
    schemas.add(document.schema_version);
    document.speech_stops.forEach((raw, index) => {
      const stop = record(raw, `${label}, stop ${index + 1}`);
      inputCount += 1;
      const fingerprint = crypto.createHash("sha256").update(JSON.stringify(stop)).digest("hex");
      if (seen.has(fingerprint)) return;
      seen.add(fingerprint);
      const state = { reason: stop.reason };
      for (const field of stateFields) state[field] = stop[field];
      state.pcm_sources_scheduled = stop.scheduled_pcm_sources > 0;
      const key = JSON.stringify(state);
      if (!groups.has(key)) groups.set(key, { state, stops: [] });
      groups.get(key).stops.push(stop);
    });
  });
  return {
    report_schema_version: 1,
    generated_at_utc: new Date().toISOString(),
    input_export_count: paths.length,
    input_schema_versions: [...schemas].sort(),
    input_stop_count: inputCount,
    unique_stop_count: seen.size,
    identical_metadata_duplicates_removed: inputCount - seen.size,
    timing_scope: "Local stop-command dispatch, including history annotation; not acoustic interruption latency.",
    limitations: [
      "Inputs are self-reported browser metadata; authenticity is not verified.",
      "No event IDs exist: identical selected metadata is deduplicated, potentially collapsing distinct events. Changed snapshots remain separate.",
      "Each export retains at most 500 stops; missing events cannot be recovered.",
      "Active or pending stops only; idle stop calls are not recorded.",
      "Source-stop exceptions may indicate already-ended sources, not failed audible stops.",
      "Speech detection, audible stop, late playback, provider cancellation, and environment are not measured.",
    ],
    groups: [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, group]) => ({
      pre_stop_state: group.state,
      stop_count: group.stops.length,
      stop_dispatch: percentiles(group.stops.map((stop) => stop.stop_dispatch_ms)),
      stops_with_source_exceptions: group.stops.filter((stop) => stop.source_stop_exceptions > 0).length,
      source_stop_exception_count: group.stops.reduce((total, stop) => total + stop.source_stop_exceptions, 0),
    })),
  };
}

const paths = process.argv.slice(2);
if (paths.length === 1 && paths[0] === "--help") {
  console.log("Usage: node evals/summarize_speech_stops.js export1.json [export2.json ...]\nLocal schema 11-12 stop-command summary; JSON stdout, no acoustic latency claims or provider calls.");
} else if (!paths.length || paths.length > 100) {
  console.error("Provide 1-100 diagnostics exports. Use --help for usage.");
  process.exitCode = 1;
} else {
  try {
    console.log(JSON.stringify(summarize(paths), null, 2));
  } catch (error) {
    console.error(`Could not summarize speech stops: ${error.message}`);
    process.exitCode = 1;
  }
}
