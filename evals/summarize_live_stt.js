// Summarize saved browser diagnostics locally; never upload or echo raw input.
const fs = require("node:fs");
const crypto = require("node:crypto");

const timingFields = [
  "connection_ms", "listening_to_first_partial_ms", "listening_duration_ms",
  "commit_to_final_ms", "total_duration_ms",
];
const failureReasons = new Set([
  "provider-failed", "no-speech", "connection-closed", "connection-failed",
  "final-transcript-timeout", "transcript-too-long", "empty-transcript",
  "buffer-clear-timeout", "analysis-unavailable", "analysis-suspended",
  "analysis-failed", "connection-timeout", "session-limit", "server-busy",
  "rate-limited", "capture-permission", "capture-failed", "capture-ended", "session-failed",
]);
const finishReasons = new Set(["manual", "quiet-pause", "capture-limit"]);
const fallbackReasons = new Set(["analysis-unavailable", "analysis-suspended", "analysis-failed"]);

function record(attempt, schema, label) {
  const invalid = () => { throw new Error(`${label} has unsupported or missing metadata.`); };
  if (!attempt || typeof attempt !== "object" || Array.isArray(attempt)) invalid();
  const result = {};
  if (schema >= 10 && attempt.attempt_id !== null && (typeof attempt.attempt_id !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(attempt.attempt_id))) invalid();
  result.attempt_id = schema >= 10 ? attempt.attempt_id : null;
  if (!["hi-IN", "en-IN"].includes(attempt.language) || attempt.model !== "gpt-live-transcribe") invalid();
  result.language = attempt.language;
  result.model = attempt.model;
  for (const field of ["auto_finish_requested", "continuous", "connection_reused", "pause_detection_used"]) {
    if (typeof attempt[field] !== "boolean") invalid();
    result[field] = attempt[field];
  }
  if (!Number.isInteger(attempt.turn_number) || attempt.turn_number < 1) invalid();
  result.turn_number = attempt.turn_number;
  if (attempt.started_at_utc !== null && (typeof attempt.started_at_utc !== "string"
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(attempt.started_at_utc)
    || !Number.isFinite(Date.parse(attempt.started_at_utc)))) invalid();
  result.started_at_utc = attempt.started_at_utc;
  if (!["completed", "failed", "cancelled"].includes(attempt.outcome)) invalid();
  result.outcome = attempt.outcome;
  for (const [field, allowed] of [
    ["failure_reason", failureReasons], ["finish_reason", finishReasons],
    ["pause_detection_fallback_reason", fallbackReasons],
  ]) {
    if (attempt[field] !== null && !allowed.has(attempt[field])) invalid();
    result[field] = attempt[field];
  }
  if ((result.outcome === "failed") !== (result.failure_reason !== null)) invalid();
  if (schema >= 9 && ![3000, 5000, 8000].includes(attempt.quiet_pause_ms)) invalid();
  // Older exports lack this field; do not infer a measured setting.
  result.quiet_pause_ms = schema >= 9 ? attempt.quiet_pause_ms : null;
  for (const field of timingFields) {
    const value = attempt[field];
    if (value !== null && (typeof value !== "number" || !Number.isFinite(value) || value < 0)) invalid();
    result[field] = value;
  }
  if (result.outcome !== "completed" && result.commit_to_final_ms !== null) invalid();
  return result;
}

function percentiles(values) {
  if (!values.length) return { sample_count: 0, p50_ms: null, p95_ms: null };
  const sorted = values.slice().sort((a, b) => a - b);
  const at = (fraction) => sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
  return { sample_count: values.length, p50_ms: at(0.5), p95_ms: at(0.95) };
}

function counts(attempts, field) {
  const result = Object.create(null);
  for (const attempt of attempts) {
    if (attempt[field] !== null) result[attempt[field]] = (result[attempt[field]] || 0) + 1;
  }
  return result;
}

function summarize(paths) {
  const groups = new Map();
  const seen = new Map();
  let inputAttempts = 0;
  const duplicates = { by_attempt_id: 0, by_identical_metadata: 0 };
  let identified = 0;
  const schemas = new Set();
  paths.forEach((path, fileIndex) => {
    const label = `Input ${fileIndex + 1}`;
    let document;
    try {
      if (fs.statSync(path).size > 4 * 1024 * 1024) throw new Error("large");
      document = JSON.parse(fs.readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
    } catch {
      throw new Error(`${label} must be a readable JSON file no larger than 4 MiB.`);
    }
    if (!document || ![8, 9, 10, 11].includes(document.schema_version)
      || !Array.isArray(document.live_stt_attempts) || document.live_stt_attempts.length > 500) {
      throw new Error(`${label} must be a schema 8-11 diagnostics export with at most 500 live attempts.`);
    }
    schemas.add(document.schema_version);
    document.live_stt_attempts.forEach((raw, index) => {
      const attempt = record(raw, document.schema_version, `${label}, attempt ${index + 1}`);
      inputAttempts += 1;
      const fingerprint = crypto.createHash("sha256").update(JSON.stringify(attempt)).digest("hex");
      const identity = attempt.attempt_id ? `id:${attempt.attempt_id}` : `metadata:${fingerprint}`;
      if (seen.has(identity)) {
        if (seen.get(identity) !== fingerprint) {
          throw new Error(`${label}, attempt ${index + 1} conflicts with an earlier record for the same attempt ID.`);
        }
        duplicates[attempt.attempt_id ? "by_attempt_id" : "by_identical_metadata"] += 1;
        return;
      }
      seen.set(identity, fingerprint);
      if (attempt.attempt_id) identified += 1;
      const config = {
        language: attempt.language, model: attempt.model,
        auto_finish_requested: attempt.auto_finish_requested,
        pause_detection_used: attempt.pause_detection_used,
        continuous: attempt.continuous, connection_reused: attempt.connection_reused,
        quiet_pause_ms: attempt.quiet_pause_ms,
      };
      const key = JSON.stringify(config);
      if (!groups.has(key)) groups.set(key, { config, attempts: [] });
      groups.get(key).attempts.push(attempt);
    });
  });
  return {
    report_schema_version: 2,
    generated_at_utc: new Date().toISOString(),
    input_export_count: paths.length,
    input_schema_versions: [...schemas].sort(),
    input_attempt_count: inputAttempts,
    duplicates_removed: duplicates,
    unique_attempt_count: seen.size,
    unique_attempts_with_id: identified,
    unique_attempts_without_id: seen.size - identified,
    timing_scope: "Completed attempts only; software events, not acoustic speech-end latency.",
    limitations: [
      "Inputs are self-reported browser diagnostics; this tool does not verify their authenticity.",
      "Each export retains at most 500 attempts. Missing or overwritten attempts cannot be recovered.",
      "ID records deduplicate by attempt ID; conflicting selected metadata for the same ID is rejected.",
      "Records without IDs deduplicate by identical metadata; distinct attempts may collapse or changed snapshots may remain separate.",
      "Records with and without IDs are kept separate; mixing legacy and new snapshots can count an attempt twice.",
      "Schema 8 quiet-pause configuration is unknown and is kept separate from newer schemas.",
      "Prompt pairing, device/environment, transcript accuracy, and acoustic latency are unavailable.",
    ],
    groups: [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, group]) => {
      const completed = group.attempts.filter((item) => item.outcome === "completed");
      return {
        configuration: group.config,
        attempt_count: group.attempts.length,
        completed_count: completed.length,
        failure_count: group.attempts.filter((item) => item.outcome === "failed").length,
        cancellation_count: group.attempts.filter((item) => item.outcome === "cancelled").length,
        failure_reasons: counts(group.attempts, "failure_reason"),
        finish_reasons: counts(group.attempts, "finish_reason"),
        pause_detection_fallback_reasons: counts(group.attempts, "pause_detection_fallback_reason"),
        timings: Object.fromEntries(timingFields.map((field) => [field,
          percentiles(completed.map((item) => item[field]).filter((value) => value !== null))])),
      };
    }),
  };
}

const paths = process.argv.slice(2);
if (paths.length === 1 && paths[0] === "--help") {
  console.log("Usage: node evals/summarize_live_stt.js export1.json [export2.json ...]\nLocal schema 8-11 live-STT diagnostics summary; JSON report on stdout, no provider calls.");
} else if (!paths.length || paths.length > 100) {
  console.error("Provide 1-100 diagnostics exports. Use --help for usage.");
  process.exitCode = 1;
} else {
  try {
    console.log(JSON.stringify(summarize(paths), null, 2));
  } catch (error) {
    console.error(`Could not summarize live STT: ${error.message}`);
    process.exitCode = 1;
  }
}
