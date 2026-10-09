// Summarize human ratings locally. No audio/model calls or listener IDs in output.
const fs = require("node:fs");
const dimensions = ["pronunciation", "intelligibility", "naturalness"];
const failureReasons = new Set(["no-audio", "playback-error", "unsupported-language", "other"]);
const identifier = (value) => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(value);

function score(document) {
  if (!document || document.rubric_version !== 1 || !Array.isArray(document.trials)
    || !document.trials.length || document.trials.length > 10000) {
    throw new Error("Expected rubric_version 1 and 1-10000 trials.");
  }
  const groups = new Map();
  const seen = new Set();
  document.trials.forEach((trial, index) => {
    const invalid = () => { throw new Error(`Trial ${index + 1} has missing or invalid rating metadata.`); };
    if (!trial || typeof trial !== "object" || Array.isArray(trial)) invalid();
    const { config, language, prompt_id: prompt, listener_id: listener, outcome, ratings, failure_reason: reason } = trial;
    if (![config, prompt, listener].every(identifier) || !["Hindi", "Hinglish", "English"].includes(language)
      || !["completed", "failed"].includes(outcome)) invalid();
    if (outcome === "completed") {
      if (!ratings || typeof ratings !== "object" || Array.isArray(ratings) || reason !== undefined) invalid();
      for (const field of dimensions) if (!Number.isInteger(ratings[field]) || ratings[field] < 1 || ratings[field] > 5) invalid();
    } else if (ratings !== null || !failureReasons.has(reason)) invalid();
    const identity = JSON.stringify([config, language, prompt, listener]);
    if (seen.has(identity)) throw new Error(`Trial ${index + 1} duplicates a configuration/language/prompt/listener combination.`);
    seen.add(identity);
    const key = JSON.stringify([config, language]);
    if (!groups.has(key)) groups.set(key, { config, language, trials: [], pairs: new Set(), completedPairs: new Set(), prompts: new Set(), listeners: new Set() });
    const group = groups.get(key);
    group.trials.push({ outcome, ratings, reason });
    const pair = JSON.stringify([prompt, listener]);
    group.pairs.add(pair);
    if (outcome === "completed") group.completedPairs.add(pair);
    group.prompts.add(prompt);
    group.listeners.add(listener);
  });
  const sameSets = (sets) => sets.length < 2 ? null : sets.every((set) => set.size === sets[0].size
    && [...set].every((value) => sets[0].has(value)));
  const reports = [...groups.values()].sort((a, b) => `${a.language}|${a.config}`.localeCompare(`${b.language}|${b.config}`));
  return {
    report_schema_version: 1,
    rubric_version: 1,
    generated_at_utc: new Date().toISOString(),
    trial_count: document.trials.length,
    scope: "Descriptive human ratings; completed trials only for rating distributions. Failures are separate.",
    limitations: [
      "Ratings and configuration labels are manually supplied and not authenticated.",
      "Matched IDs do not verify identical prompt text, audio, listener identity, or environment.",
      "No transcript, audio, listener ID, or prompt ID is printed. Keep input files private.",
      "No significance, population quality, latency, or automatic best-voice claim is made.",
    ],
    pairing_by_language: [...new Set(reports.map((group) => group.language))].map((language) => {
      const selected = reports.filter((group) => group.language === language);
      return { language, configuration_count: selected.length,
        all_prompt_listener_sets_match: sameSets(selected.map((group) => group.pairs)),
        completed_prompt_listener_sets_match: sameSets(selected.map((group) => group.completedPairs)) };
    }),
    groups: reports.map((group) => {
      const completed = group.trials.filter((trial) => trial.outcome === "completed");
      const failureCounts = Object.create(null);
      group.trials.filter((trial) => trial.outcome === "failed").forEach((trial) => {
        failureCounts[trial.reason] = (failureCounts[trial.reason] || 0) + 1;
      });
      return { config: group.config, language: group.language, attempt_count: group.trials.length,
        completed_count: completed.length, failure_count: group.trials.length - completed.length,
        prompt_count: group.prompts.size, listener_count: group.listeners.size, failure_reasons: failureCounts,
        ratings: Object.fromEntries(dimensions.map((field) => {
          const values = completed.map((trial) => trial.ratings[field]).sort((a, b) => a - b);
          const histogram = Object.fromEntries([1, 2, 3, 4, 5].map((rating) => [rating, values.filter((value) => value === rating).length]));
          return [field, { sample_count: values.length,
            median: values.length ? values[Math.ceil(values.length * 0.5) - 1] : null, histogram }];
        })) };
    }),
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--help") {
    console.log("Usage: node evals/score_tts.js evals/local-tts-ratings.json\nSummarize rubric-version-1 human ratings and paired coverage locally.");
  } else if (args.length !== 1) {
    console.error("Provide one ratings JSON file. Use --help for usage.");
    process.exitCode = 1;
  } else {
    try {
      let document;
      try {
        if (fs.statSync(args[0]).size > 4 * 1024 * 1024) throw new Error("large");
        document = JSON.parse(fs.readFileSync(args[0], "utf8").replace(/^\uFEFF/, ""));
      } catch { throw new Error("Input must be readable UTF-8 JSON no larger than 4 MiB."); }
      console.log(JSON.stringify(score(document), null, 2));
    } catch (error) {
      console.error(`Could not score TTS ratings: ${error.message}`);
      process.exitCode = 1;
    }
  }
}

module.exports = { score };
