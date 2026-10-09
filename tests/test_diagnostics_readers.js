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
  test(`${script} accepts schema 13/14 and keeps version/record validation`, () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "bolprep-diagnostics-reader-"));
    const fixture = path.join(directory, "fixture.json");
    const invoke = (schema, rows = []) => {
      fs.writeFileSync(fixture, JSON.stringify({ schema_version: schema, [field]: rows }));
      return spawnSync(process.execPath, [path.join(__dirname, "..", "evals", script), fixture],
        { encoding: "utf8", timeout: 10000 });
    };
    try {
      for (const schema of [13, 14]) {
        const result = invoke(schema);
        assert.equal(result.status, 0, result.stderr);
        const report = JSON.parse(result.stdout);
        assert.equal(report[count], 0);
        assert.equal(report.input_export_count, 1);
      }
      assert.equal(invoke(15).status, 1);
      assert.equal(invoke(14, [{ invalid: true }]).status, 1);
    } finally {
      if (fs.existsSync(fixture)) fs.unlinkSync(fixture);
      fs.rmdirSync(directory);
    }
  });
}
