// Score manually paired STT transcripts without uploading or printing their text.
const fs = require("node:fs");

function words(text) {
  return text.normalize("NFC").toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, " ").trim().split(/\s+/u).filter(Boolean);
}

function editDistance(reference, transcript) {
  let previous = Array.from({ length: transcript.length + 1 }, (_, index) => index);
  for (let row = 1; row <= reference.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= transcript.length; column += 1) {
      current[column] = Math.min(
        previous[column] + 1,
        current[column - 1] + 1,
        previous[column - 1] + (reference[row - 1] === transcript[column - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[transcript.length];
}

function score(trials) {
  if (!Array.isArray(trials) || !trials.length) throw new Error("Expected a nonempty JSON array of trials.");
  const groups = new Map();
  const promptReferences = new Map();
  for (const [index, trial] of trials.entries()) {
    if (!trial || typeof trial !== "object" || Array.isArray(trial)) {
      throw new Error(`Trial ${index + 1} must be an object.`);
    }
    const { config, language, prompt_id: promptId, reference, transcript } = trial;
    if (typeof config !== "string" || !config.trim()
      || !["Hindi", "Hinglish", "English"].includes(language)
      || typeof promptId !== "string" || !promptId.trim()
      || typeof reference !== "string" || !words(reference).length
      || (transcript !== null && typeof transcript !== "string")) {
      throw new Error(`Trial ${index + 1} needs config, language, prompt_id, nonempty reference, and transcript (string or null).`);
    }
    const promptKey = JSON.stringify([language, promptId.trim()]);
    const normalizedReference = words(reference).join(" ");
    if (promptReferences.has(promptKey) && promptReferences.get(promptKey) !== normalizedReference) {
      throw new Error(`Trial ${index + 1} has a different reference for prompt_id ${promptId.trim()} in ${language}.`);
    }
    promptReferences.set(promptKey, normalizedReference);
    const key = JSON.stringify([config.trim(), language]);
    if (!groups.has(key)) groups.set(key, {
      config: config.trim(), language, attempts: 0, failures: 0, scored: 0,
      errors: 0, reference_words: 0, all_attempts_errors: 0, all_attempts_reference_words: 0,
      prompts: new Set(), attempts_by_prompt: new Map(),
    });
    const group = groups.get(key);
    const referenceWords = words(reference);
    const normalizedPromptId = promptId.trim();
    group.prompts.add(normalizedPromptId);
    group.attempts_by_prompt.set(normalizedPromptId, (group.attempts_by_prompt.get(normalizedPromptId) || 0) + 1);
    group.attempts += 1;
    group.all_attempts_reference_words += referenceWords.length;
    if (!transcript || !words(transcript).length) {
      group.failures += 1;
      group.all_attempts_errors += referenceWords.length;
      continue;
    }
    const wordErrors = editDistance(referenceWords, words(transcript));
    group.scored += 1;
    group.reference_words += referenceWords.length;
    group.errors += wordErrors;
    group.all_attempts_errors += wordErrors;
  }
  const groupsByLanguage = new Map();
  for (const group of groups.values()) {
    if (!groupsByLanguage.has(group.language)) groupsByLanguage.set(group.language, []);
    groupsByLanguage.get(group.language).push(group);
  }
  return [...groups.values()].sort((a, b) => a.config.localeCompare(b.config) || a.language.localeCompare(b.language))
    .map((group) => {
      const comparisonGroups = groupsByLanguage.get(group.language);
      const promptSets = comparisonGroups.map((item) => item.prompts);
      const firstPromptSet = promptSets[0];
      const promptSetMatch = promptSets.length < 2 ? null : promptSets.every((set) =>
        set.size === firstPromptSet.size && [...firstPromptSet].every((promptId) => set.has(promptId))
      );
      const commonPromptCount = [...firstPromptSet].filter((promptId) =>
        promptSets.every((set) => set.has(promptId))
      ).length;
      const repeatCountsMatch = comparisonGroups.length < 2 ? null : promptSetMatch && comparisonGroups.every((item) =>
        [...firstPromptSet].every((promptId) => item.attempts_by_prompt.get(promptId) === group.attempts_by_prompt.get(promptId))
      );
      const { prompts, attempts_by_prompt: attemptsByPrompt, ...summary } = group;
      return {
        ...summary,
        prompt_count: prompts.size,
        compared_config_count: comparisonGroups.length,
        common_prompt_count: commonPromptCount,
        prompt_set_match: promptSetMatch,
        repeat_counts_match: repeatCountsMatch,
        wer: group.reference_words ? Number((group.errors / group.reference_words).toFixed(4)) : null,
        all_attempts_wer: Number((group.all_attempts_errors / group.all_attempts_reference_words).toFixed(4)),
      };
    });
}

if (process.argv.length !== 3) {
  console.error("Usage: node evals/score_stt.js path/to/local-stt-trials.json");
  process.exitCode = 1;
} else {
  try {
    const trials = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
    console.log(JSON.stringify(score(trials), null, 2));
  } catch (error) {
    const message = error instanceof SyntaxError ? "Input is not valid JSON." : error.message;
    console.error(`Could not score STT trials: ${message}`);
    process.exitCode = 1;
  }
}
