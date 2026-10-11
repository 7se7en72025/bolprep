const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { score, buildReport } = require("../evals/score_stt.js");

const trial = (overrides = {}) => ({
  config: "a", language: "English", prompt_id: "p1",
  reference: "Life and liberty", transcript: "Life and liberty", ...overrides,
});
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

test("STT reports hash exact inputs and scorer bytes without printing transcript text", () => {
  const bytes = Buffer.from(JSON.stringify([trial({ reference: "PRIVATE_WORD", transcript: "PRIVATE_WORD" })]));
  const scorer = Buffer.from("synthetic scorer bytes");
  const report = buildReport(bytes, scorer);
  assert.equal(report.schema_version, 1);
  assert.equal(report.input_sha256, hash(bytes));
  assert.equal(report.scorer_sha256, hash(scorer));
  assert.equal(report.runtime.node, process.version);
  assert.ok(Number.isFinite(Date.parse(report.generated_at)));
  assert.equal(report.groups[0].wer, 0);
  assert.equal(report.groups[0].cer, 0);
  assert.ok(!JSON.stringify(report).includes("PRIVATE_WORD"));
  assert.notEqual(buildReport(Buffer.concat([bytes, Buffer.from(" ")]), scorer).input_sha256, report.input_sha256);
});

test("STT failed attempts are counted without inventing successful-only accuracy", () => {
  const failed = score([trial({ transcript: null, failure_reason: "network-error" })])[0];
  assert.equal(failed.wer, null);
  assert.equal(failed.cer, null);
  assert.equal(failed.all_attempts_wer, 1);
  assert.equal(failed.all_attempts_cer, 1);
  assert.equal(failed.failures, 1);
  const mixed = score([trial(), trial({ transcript: "" })])[0];
  assert.equal(mixed.wer, 0);
  assert.equal(mixed.all_attempts_wer, 0.5);
});

test("STT pairing distinguishes one config, matching repeats, and mismatches", () => {
  assert.equal(score([trial()])[0].prompt_set_match, null);
  const paired = score([trial(), trial({ config: "b" })]);
  assert.ok(paired.every((group) => group.prompt_set_match && group.repeat_counts_match));
  const repeats = score([trial(), trial(), trial({ config: "b" })]);
  assert.ok(repeats.every((group) => group.prompt_set_match && !group.repeat_counts_match));
  const prompts = score([trial(), trial({ config: "b", prompt_id: "p2" })]);
  assert.ok(prompts.every((group) => !group.prompt_set_match && !group.repeat_counts_match));
});

test("STT normalization keeps multilingual text and does not transliterate Hinglish", () => {
  for (const [language, reference, transcript] of [
    ["English", "Caf\u00e9!", "CAFE\u0301"],
    ["Hindi", "\u091c\u0940\u0935\u0928\u0964", "\u091c\u0940\u0935\u0928"],
    ["Hinglish", "Jeevan aur liberty!", "jeevan aur LIBERTY"],
  ]) {
    assert.equal(score([trial({ language, reference, transcript })])[0].cer, 0);
  }
  assert.equal(score([trial({ language: "Hinglish", reference: "jeevan", transcript: "\u091c\u0940\u0935\u0928" })])[0].wer, 1);
});

test("STT input validation bounds files, arrays, fields and rejects invalid UTF-8", () => {
  assert.throws(() => buildReport(Buffer.alloc(16 * 1024 * 1024 + 1)));
  assert.throws(() => buildReport(Buffer.from([0xff])));
  assert.throws(() => score(Array.from({ length: 10001 }, () => trial())));
  assert.throws(() => score([trial({ reference: "x".repeat(6001) })]));
  assert.throws(() => score([trial({ transcript: "x".repeat(6001) })]));
  assert.throws(() => score([trial({ config: "x".repeat(129) })]));
  assert.throws(() => score([trial({ failure_reason: "network-error" })]));
  assert.throws(() => score([trial(), trial({ reference: "different" })]));
});

test("STT CLI preserves the legacy array, provides versioned reports and hides malformed input", () => {
  const base = path.resolve(__dirname, "../.codex/local-check");
  fs.mkdirSync(base, { recursive: true });
  const directory = fs.mkdtempSync(path.join(base, "stt-"));
  const input = path.join(directory, "trials.json");
  const script = path.resolve(__dirname, "../evals/score_stt.js");
  const invoke = (args) => spawnSync(process.execPath, [script, ...args], { encoding: "utf8", timeout: 10000 });
  try {
    const bytes = Buffer.from(JSON.stringify([trial()]));
    fs.writeFileSync(input, bytes);
    const legacy = invoke([input]);
    assert.equal(legacy.status, 0);
    assert.ok(Array.isArray(JSON.parse(legacy.stdout)));
    const versioned = invoke(["--report", input]);
    assert.equal(versioned.status, 0);
    const report = JSON.parse(versioned.stdout);
    assert.deepEqual(report.groups, JSON.parse(legacy.stdout));
    assert.equal(report.input_sha256, hash(bytes));
    assert.equal(report.scorer_sha256, hash(fs.readFileSync(script)));
    fs.writeFileSync(input, "PRIVATE_BROKEN_INPUT");
    const broken = invoke(["--report", input]);
    assert.equal(broken.status, 1);
    assert.equal(broken.stdout, "");
    assert.ok(!broken.stderr.includes("PRIVATE_BROKEN_INPUT"));
    assert.ok(!broken.stderr.includes(directory));
    assert.equal(invoke(["--unknown", input]).status, 1);
  } finally {
    fs.rmSync(directory, { recursive: true });
  }
});
