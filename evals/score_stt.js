// Score manually paired STT transcripts without uploading or printing their text.
const fs = require("node:fs");
const crypto = require("node:crypto");
const { TextDecoder } = require("node:util");
const maxInputBytes = 16 * 1024 * 1024;
const maxTrials = 10000;
const maxTextLength = 6000;
const failureReasons = new Set([
  "no-speech", "permission-denied", "device-error", "network-error",
  "unsupported-language", "empty-transcript", "other",
]);

function words(text) {
  return text.normalize("NFC").toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, " ").trim().split(/\s+/u).filter(Boolean);
}

function characters(text) {
  return Array.from(words(text).join(" "));
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
  if (!Array.isArray(trials) || !trials.length || trials.length > maxTrials) {
    throw new Error("Expected between 1 and 10,000 STT trials.");
  }
  const groups = new Map();
  const promptReferences = new Map();
  for (const [index, trial] of trials.entries()) {
    if (!trial || typeof trial !== "object" || Array.isArray(trial)) {
      throw new Error(`Trial ${index + 1} must be an object.`);
    }
    const { config, language, prompt_id: promptId, reference, transcript, failure_reason: failureReason } = trial;
    if (typeof config !== "string" || !config.trim() || config.length > 128
      || !["Hindi", "Hinglish", "English"].includes(language)
      || typeof promptId !== "string" || !promptId.trim() || promptId.length > 128
      || typeof reference !== "string" || reference.length > maxTextLength || !words(reference).length
      || (transcript !== null && (typeof transcript !== "string" || transcript.length > maxTextLength))) {
      throw new Error(`Trial ${index + 1} needs config, language, prompt_id, nonempty reference, and transcript (string or null).`);
    }
    const failed = !transcript || !words(transcript).length;
    if (failureReason !== undefined && (!failed || !failureReasons.has(failureReason))) {
      throw new Error(`Trial ${index + 1} needs a failed transcript and a supported failure_reason code.`);
    }
    const promptKey = JSON.stringify([language, promptId.trim()]);
    const normalizedReference = words(reference).join(" ");
    if (promptReferences.has(promptKey) && promptReferences.get(promptKey) !== normalizedReference) {
      throw new Error(`Trial ${index + 1} has a conflicting reference for the same prompt and language.`);
    }
    promptReferences.set(promptKey, normalizedReference);
    const key = JSON.stringify([config.trim(), language]);
    if (!groups.has(key)) groups.set(key, {
      config: config.trim(), language, attempts: 0, failures: 0, scored: 0,
      errors: 0, reference_words: 0, all_attempts_errors: 0, all_attempts_reference_words: 0,
      character_errors: 0, reference_characters: 0,
      all_attempts_character_errors: 0, all_attempts_reference_characters: 0,
      failure_reasons: {}, prompts: new Set(), attempts_by_prompt: new Map(), prompt_results: new Map(),
    });
    const group = groups.get(key);
    const referenceWords = words(reference);
    const normalizedPromptId = promptId.trim();
    group.prompts.add(normalizedPromptId);
    group.attempts_by_prompt.set(normalizedPromptId, (group.attempts_by_prompt.get(normalizedPromptId) || 0) + 1);
    if (!group.prompt_results.has(normalizedPromptId)) group.prompt_results.set(normalizedPromptId, {
      prompt_id: normalizedPromptId, attempts: 0, failures: 0,
      errors: 0, reference_words: 0, all_attempts_errors: 0, all_attempts_reference_words: 0,
      character_errors: 0, reference_characters: 0,
      all_attempts_character_errors: 0, all_attempts_reference_characters: 0,
    });
    const prompt = group.prompt_results.get(normalizedPromptId);
    group.attempts += 1;
    prompt.attempts += 1;
    const referenceCharacters = characters(reference);
    group.all_attempts_reference_characters += referenceCharacters.length;
    prompt.all_attempts_reference_characters += referenceCharacters.length;
    group.all_attempts_reference_words += referenceWords.length;
    prompt.all_attempts_reference_words += referenceWords.length;
    if (failed) {
      group.failures += 1;
      prompt.failures += 1;
      const reason = failureReason || "unclassified";
      group.failure_reasons[reason] = (group.failure_reasons[reason] || 0) + 1;
      group.all_attempts_errors += referenceWords.length;
      prompt.all_attempts_errors += referenceWords.length;
      group.all_attempts_character_errors += referenceCharacters.length;
      prompt.all_attempts_character_errors += referenceCharacters.length;
      continue;
    }
    const wordErrors = editDistance(referenceWords, words(transcript));
    const characterErrors = editDistance(referenceCharacters, characters(transcript));
    group.scored += 1;
    group.reference_words += referenceWords.length;
    group.errors += wordErrors;
    group.all_attempts_errors += wordErrors;
    prompt.reference_words += referenceWords.length;
    prompt.errors += wordErrors;
    prompt.all_attempts_errors += wordErrors;
    group.reference_characters += referenceCharacters.length;
    group.character_errors += characterErrors;
    group.all_attempts_character_errors += characterErrors;
    prompt.reference_characters += referenceCharacters.length;
    prompt.character_errors += characterErrors;
    prompt.all_attempts_character_errors += characterErrors;
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
      const { prompts, attempts_by_prompt: attemptsByPrompt, prompt_results: promptResults, ...summary } = group;
      return {
        ...summary,
        prompt_count: prompts.size,
        compared_config_count: comparisonGroups.length,
        common_prompt_count: commonPromptCount,
        prompt_set_match: promptSetMatch,
        repeat_counts_match: repeatCountsMatch,
        wer: group.reference_words ? Number((group.errors / group.reference_words).toFixed(4)) : null,
        all_attempts_wer: Number((group.all_attempts_errors / group.all_attempts_reference_words).toFixed(4)),
        cer: group.reference_characters ? Number((group.character_errors / group.reference_characters).toFixed(4)) : null,
        all_attempts_cer: Number((group.all_attempts_character_errors / group.all_attempts_reference_characters).toFixed(4)),
        prompt_results: [...promptResults.values()].sort((a, b) => a.prompt_id.localeCompare(b.prompt_id)).map((prompt) => ({
          ...prompt,
          wer: prompt.reference_words ? Number((prompt.errors / prompt.reference_words).toFixed(4)) : null,
          all_attempts_wer: Number((prompt.all_attempts_errors / prompt.all_attempts_reference_words).toFixed(4)),
          cer: prompt.reference_characters ? Number((prompt.character_errors / prompt.reference_characters).toFixed(4)) : null,
          all_attempts_cer: Number((prompt.all_attempts_character_errors / prompt.all_attempts_reference_characters).toFixed(4)),
        })),
      };
    });
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function buildReport(inputBytes, scorerBytes = fs.readFileSync(__filename)) {
  if (inputBytes.length > maxInputBytes) throw new Error("Input exceeds 16 MiB.");
  const trials = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(inputBytes));
  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    input_sha256: sha256(inputBytes),
    scorer_sha256: sha256(scorerBytes),
    runtime: { node: process.version, platform: process.platform, arch: process.arch, icu: process.versions.icu },
    normalization: "Unicode NFC; lowercase; punctuation/symbols replaced by spaces; whitespace collapsed. No transliteration or number-word normalization.",
    failure_policy: "Empty/null transcripts count as full reference deletion in all-attempts rates and are excluded from successful-only rates.",
    limits: { input_bytes: maxInputBytes, trials: maxTrials, text_utf16_units: maxTextLength },
    limitations: [
      "Input hashes identify supplied bytes, not authenticated recordings, provider results, or reviewer identity.",
      "Configuration and prompt labels are supplied metadata and require review before publishing.",
      "Paired prompt IDs, references, and repeat counts do not verify identical audio or completed-attempt pairing.",
      "WER/CER are transcript edit rates, not pronunciation quality, acoustic latency, or significance tests.",
    ],
    groups: score(trials),
  };
}

function readBounded(path) {
  const descriptor = fs.openSync(path, "r");
  try {
    if (!fs.fstatSync(descriptor).isFile()) throw new Error("Input must be a regular file.");
    const bytes = Buffer.alloc(maxInputBytes + 1);
    let count = 0;
    while (count < bytes.length) {
      const read = fs.readSync(descriptor, bytes, count, bytes.length - count, null);
      if (!read) break;
      count += read;
    }
    if (count > maxInputBytes) throw new Error("Input exceeds 16 MiB.");
    return bytes.subarray(0, count);
  } finally {
    fs.closeSync(descriptor);
  }
}

function main(args) {
  const versioned = args.length === 2 && args[0] === "--report";
  if (!(args.length === 1 && !args[0].startsWith("--")) && !versioned) {
    console.error("Usage: node evals/score_stt.js [--report] path/to/local-stt-trials.json");
    process.exitCode = 1;
    return;
  }
  try {
    const report = buildReport(readBounded(args[versioned ? 1 : 0]));
    console.log(JSON.stringify(versioned ? report : report.groups, null, 2));
  } catch {
    // Parse errors and file-system messages can contain private text or paths.
    console.error("Could not score STT trials: check the private input format, size, and field limits.");
    process.exitCode = 1;
  }
}

if (require.main === module) main(process.argv.slice(2));
module.exports = { score, buildReport };
