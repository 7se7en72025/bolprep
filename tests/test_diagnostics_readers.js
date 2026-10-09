// Synthetic export fixtures verify CLI compatibility, not speech observations.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

for (const [script, field, count] of [
  ["summarize_live_stt.js", "live_stt_attempts", "input_attempt_count"],
  ["summarize_tutor_turns.js", "tutor_turns", "input_turn_count"],
  ["summarize_speech_stops.js", "speech_stops", "input_stop_count"],
]) {
  test(`${script} accepts schema 13/14/15 and keeps version/record validation`, () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "bolprep-diagnostics-reader-"));
    const fixture = path.join(directory, "fixture.json");
    const invoke = (schema, rows = []) => {
      fs.writeFileSync(fixture, JSON.stringify({ schema_version: schema, [field]: rows }));
      return spawnSync(process.execPath, [path.join(__dirname, "..", "evals", script), fixture],
        { encoding: "utf8", timeout: 10000 });
    };
    try {
      for (const schema of [13, 14, 15]) {
        const result = invoke(schema);
        assert.equal(result.status, 0, result.stderr);
        const report = JSON.parse(result.stdout);
        assert.equal(report[count], 0);
        assert.equal(report.input_export_count, 1);
      }
      assert.equal(invoke(16).status, 1);
      assert.equal(invoke(14, [{ invalid: true }]).status, 1);
    } finally {
      if (fs.existsSync(fixture)) fs.unlinkSync(fixture);
      fs.rmdirSync(directory);
    }
  });
}

test("live reader separates unknown and validated session models without relaxing legacy validation", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "bolprep-live-model-"));
  const fixture = path.join(directory, "fixture.json");
  const attempt = (model) => ({
    attempt_id: null, started_at_utc: null, language: "hi-IN", model,
    auto_finish_requested: false, continuous: false, connection_reused: false,
    pause_detection_used: false, turn_number: 1, quiet_pause_ms: 3000, capture_limit_ms: 20000,
    outcome: "failed", failure_reason: "capture-permission", finish_reason: null,
    pause_detection_fallback_reason: null, connection_ms: null,
    listening_to_first_partial_ms: null, listening_duration_ms: null,
    commit_to_final_ms: null, total_duration_ms: 10,
  });
  const invoke = (schema, models) => {
    fs.writeFileSync(fixture, JSON.stringify({ schema_version: schema, live_stt_attempts: models.map(attempt) }));
    return spawnSync(process.execPath, [path.join(__dirname, "..", "evals", "summarize_live_stt.js"), fixture],
      { encoding: "utf8", timeout: 10000 });
  };
  try {
    const result = invoke(15, [null, "gpt-live-transcribe", "mock-model-v2"]);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.unique_attempt_count, 3);
    assert.equal(report.groups.length, 3);
    assert.deepEqual(new Set(report.groups.map((group) => group.configuration.model)),
      new Set([null, "gpt-live-transcribe", "mock-model-v2"]));
    assert.equal(invoke(14, ["gpt-live-transcribe"]).status, 0);
    assert.equal(invoke(14, [null]).status, 1);
    for (const model of ["bad model", "", "x".repeat(129), 42, undefined]) {
      assert.equal(invoke(15, [model]).status, 1);
    }
  } finally {
    if (fs.existsSync(fixture)) fs.unlinkSync(fixture);
    fs.rmdirSync(directory);
  }
});
