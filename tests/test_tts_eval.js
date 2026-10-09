// Synthetic metadata exercises coverage bookkeeping, not real listener ratings.
const assert = require("node:assert/strict");
const test = require("node:test");
const { score } = require("../evals/score_tts.js");

function trial(config, prompt, outcome = "completed") {
  return {
    config, language: "English", prompt_id: prompt, listener_id: "listener-1", outcome,
    ratings: outcome === "completed"
      ? { pronunciation: 4, intelligibility: 4, naturalness: 4 } : null,
    ...(outcome === "failed" ? { failure_reason: "no-audio" } : {}),
  };
}

function coverage(trials) {
  return score({ rubric_version: 1, trials }).pairing_by_language[0];
}

test("one configuration has unavailable comparison coverage", () => {
  const result = coverage([trial("a", "p1")]);
  assert.equal(result.configuration_count, 1);
  assert.equal(result.all_prompt_listener_sets_match, null);
  assert.equal(result.completed_prompt_listener_sets_match, null);
});

test("matching configurations have matching all and completed pairs", () => {
  const result = coverage([trial("a", "p1"), trial("b", "p1")]);
  assert.equal(result.all_prompt_listener_sets_match, true);
  assert.equal(result.completed_prompt_listener_sets_match, true);
});

test("different prompt sets are reported as mismatched", () => {
  const result = coverage([trial("a", "p1"), trial("b", "p2")]);
  assert.equal(result.all_prompt_listener_sets_match, false);
  assert.equal(result.completed_prompt_listener_sets_match, false);
});

test("failed playback leaves all pairs matched but completed pairs mismatched", () => {
  const result = coverage([
    trial("a", "p1"), trial("a", "p2", "failed"),
    trial("b", "p1"), trial("b", "p2"),
  ]);
  assert.equal(result.all_prompt_listener_sets_match, true);
  assert.equal(result.completed_prompt_listener_sets_match, false);
});
