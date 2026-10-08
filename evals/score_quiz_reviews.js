// Summarize supplied human reviews locally; never read answer text or call providers.
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const identifier = (value) => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(value);
const object = (value) => value && typeof value === "object" && !Array.isArray(value);
const reasons = new Set(["scoring-error", "timeout", "invalid-response", "other"]);

function readJson(filename, limit) {
  let fd;
  try {
    fd = fs.openSync(filename, "r");
    const info = fs.fstatSync(fd);
    if (!info.isFile() || info.size > limit) throw new Error("large");
    const buffer = Buffer.alloc(limit + 1);
    let length = 0;
    while (length < buffer.length) {
      const count = fs.readSync(fd, buffer, length, buffer.length - length, null);
      if (!count) break;
      length += count;
    }
    if (length > limit) throw new Error("large");
    const bytes = buffer.subarray(0, length);
    return { bytes, document: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "")) };
  } catch { throw new Error("Expected readable UTF-8 JSON within the documented file size limit."); }
  finally { if (fd !== undefined) fs.closeSync(fd); }
}

function summarize(document, bank, hash) {
  if (!object(document) || document.rubric_version !== 1 || document.question_bank_sha256 !== hash
    || !Array.isArray(document.trials) || !document.trials.length || document.trials.length > 10000) {
    throw new Error("Expected rubric_version 1, the current question-bank SHA-256, and 1-10000 reviews.");
  }
  if (!Array.isArray(bank) || !bank.length || !bank.every((question) => object(question)
    && identifier(question.id) && Array.isArray(question.concepts) && question.concepts.length > 0
    && Number.isInteger(question.minimum_concepts) && question.minimum_concepts >= 1
    && question.minimum_concepts <= question.concepts.length)
    || new Set(bank.map((question) => question.id)).size !== bank.length) {
    throw new Error("Question bank has invalid review-rubric metadata.");
  }
  const questions = new Map(bank.map((question) => [question.id, question]));
  const groups = new Map();
  const seen = new Set();
  const humanReviews = new Map();
  const automatedResults = new Map();
  const answerQuestions = new Map();
  for (const [index, trial] of document.trials.entries()) {
    const invalid = () => { throw new Error(`Review ${index + 1} has invalid or inconsistent metadata.`); };
    const fields = ["config", "language", "question_id", "answer_id", "reviewer_id", "outcome",
      "automated_score", "automated_complete", "human_matched_concepts", "failure_reason"];
    if (!object(trial) || Object.keys(trial).some((field) => !fields.includes(field))) invalid();
    const { config, language, question_id: questionId, answer_id: answerId, reviewer_id: reviewerId,
      outcome, automated_score: score, automated_complete: complete,
      human_matched_concepts: humanCount, failure_reason: reason } = trial;
    if (![config, answerId, reviewerId].every(identifier) || !questions.has(questionId)
      || !["Hindi", "Hinglish", "English"].includes(language) || !["completed", "failed"].includes(outcome)) invalid();
    const question = questions.get(questionId);
    if (!Number.isInteger(humanCount) || humanCount < 0 || humanCount > question.concepts.length) invalid();
    if (outcome === "completed") {
      if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 100
        || typeof complete !== "boolean" || reason !== undefined) invalid();
    } else if (score !== null || complete !== null || !reasons.has(reason)) invalid();
    const answerKey = JSON.stringify([language, answerId]);
    if (answerQuestions.has(answerKey) && answerQuestions.get(answerKey) !== questionId) invalid();
    answerQuestions.set(answerKey, questionId);
    const reviewKey = JSON.stringify([language, answerId, reviewerId]);
    if (humanReviews.has(reviewKey) && humanReviews.get(reviewKey) !== humanCount) invalid();
    humanReviews.set(reviewKey, humanCount);
    const resultKey = JSON.stringify([config, language, answerId]);
    const result = JSON.stringify([outcome, score, complete, reason || null]);
    if (automatedResults.has(resultKey) && automatedResults.get(resultKey) !== result) invalid();
    automatedResults.set(resultKey, result);
    const identity = JSON.stringify([config, language, answerId, reviewerId]);
    if (seen.has(identity)) throw new Error(`Review ${index + 1} duplicates a configuration/language/answer/reviewer pair.`);
    seen.add(identity);
    const key = JSON.stringify([config, language]);
    if (!groups.has(key)) groups.set(key, { config, language, reviews: [], pairs: new Set(), completedPairs: new Set(),
      answers: new Set(), completedAnswers: new Set(), reviewers: new Set(), failures: new Map() });
    const group = groups.get(key);
    group.answers.add(answerId);
    group.reviewers.add(reviewerId);
    group.pairs.add(reviewKey);
    if (outcome === "completed") {
      group.completedPairs.add(reviewKey);
      group.completedAnswers.add(answerId);
      group.reviews.push({ score, complete, humanScore: Math.min(100, Math.round(100 * humanCount / question.minimum_concepts)),
        humanComplete: humanCount >= question.minimum_concepts });
    } else group.failures.set(answerId, reason);
  }
  const reports = [...groups.values()].sort((a, b) => `${a.language}|${a.config}`.localeCompare(`${b.language}|${b.config}`));
  const sameSets = (sets) => sets.length >= 2 && sets.every((set) => set.size === sets[0].size
    && [...set].every((value) => sets[0].has(value)));
  const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  return {
    report_schema_version: 1, rubric_version: 1, question_bank_sha256: hash,
    generated_at_utc: new Date().toISOString(), review_count: document.trials.length,
    scope: "Descriptive agreement with supplied human concept reviews; not a measured benchmark without actual reviewed observations.",
    limitations: [
      "Scores, reviews, configuration labels, and answer identities are supplied and not authenticated.",
      "Each answer/reviewer pair contributes once per configuration; multiple reviewers of one answer are not independent answers.",
      "Coverage IDs do not prove identical answer text, devices, scoring settings, or representative sampling.",
      "Completed-review score errors and completeness agreement exclude failed answers; failures are reported per distinct answer.",
      "Human judgments can disagree. No consensus, significance, semantic accuracy, or winning configuration is inferred.",
    ],
    groups: reports.map((group) => {
      const peers = reports.filter((peer) => peer.language === group.language);
      const errors = group.reviews.map((review) => review.score - review.humanScore);
      const absolute = errors.map(Math.abs).sort((a, b) => a - b);
      const confusion = { true_complete: 0, false_complete: 0, false_incomplete: 0, true_incomplete: 0 };
      for (const review of group.reviews) {
        const key = review.complete ? (review.humanComplete ? "true_complete" : "false_complete")
          : (review.humanComplete ? "false_incomplete" : "true_incomplete");
        confusion[key] += 1;
      }
      return {
        config: group.config, language: group.language, answer_count: group.answers.size,
        reviewer_count: group.reviewers.size, review_count: group.pairs.size,
        completed_answer_count: group.completedAnswers.size, failed_answer_count: group.failures.size,
        completed_review_count: group.reviews.length,
        all_review_pair_coverage_match: peers.length < 2 ? null : sameSets(peers.map((peer) => peer.pairs)),
        completed_review_pair_coverage_match: peers.length < 2 ? null : sameSets(peers.map((peer) => peer.completedPairs)),
        failure_counts: Object.fromEntries([...reasons].map((reason) => [reason, [...group.failures.values()].filter((value) => value === reason).length])),
        score_agreement: { mean_absolute_error_points: mean(absolute), mean_signed_error_points: mean(errors),
          p95_absolute_error_points: absolute.length ? absolute[Math.ceil(absolute.length * 0.95) - 1] : null,
          exact_match_count: errors.filter((error) => error === 0).length,
          exact_match_rate: errors.length ? errors.filter((error) => error === 0).length / errors.length : null },
        completeness_agreement: { ...confusion,
          agreement_rate: group.reviews.length ? (confusion.true_complete + confusion.true_incomplete) / group.reviews.length : null },
      };
    }),
  };
}

const args = process.argv.slice(2);
if (args.length === 1 && args[0] === "--help") {
  console.log("Usage: node evals/score_quiz_reviews.js evals/local-quiz-reviews.json\nSee evals/QUIZ_REVIEW_RUBRIC.md. No answers, reviewer IDs, or provider calls in the report.");
} else if (args.length !== 1) {
  console.error("Provide one review JSON file. Use --help for usage.");
  process.exitCode = 1;
} else {
  try {
    const bank = readJson(path.join(__dirname, "../data/quiz_questions.json"), 1024 * 1024);
    const input = readJson(args[0], 4 * 1024 * 1024);
    const hash = createHash("sha256").update(bank.bytes).digest("hex");
    console.log(JSON.stringify(summarize(input.document, bank.document, hash), null, 2));
  } catch (error) {
    console.error(`Could not summarize quiz reviews: ${error.message}`);
    process.exitCode = 1;
  }
}
