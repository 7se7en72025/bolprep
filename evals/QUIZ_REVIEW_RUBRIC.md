# Quiz review rubric — version 1

Use this procedure to compare actual scoring results with independent human review of the same self-authored answers. The current quiz is a lexical matcher. Mentioning an alias can earn credit even in a negated, contradictory, quoted, or incomplete answer; equivalent paraphrases can lose credit. This review does not assume the matcher understands meaning.

## Matcher phrase rules

The scorer recognizes aliases plus the bank's existing English, Hindi, and Hinglish concept labels. After the scorer's NFC/case/punctuation token normalization, a phrase from one concept must not contain or be contained by a phrase from another concept in the same question. Bank loading rejects those collisions and wordless phrases. This is an authoring constraint: use separate phrases to identify each concept rather than a composite alias naming multiple concepts. A learner answer can still include both separate phrases. Article 14 equality-before-law aliases are now assigned only to that concept; equal-protection wording is separate. The change does not interpret negation, contradictions, quotation, or meaning. Previously stored scores remain unchanged. Keep historical reviews with their original bank hash and scorer checkout.

## Collect observations

1. Freeze the question bank and scoring configuration. Record its raw-file SHA-256, commit, environment, and scorer settings in private collection notes. The report checks the current bank hash; line-ending changes also change it. Keep an archived matching checkout for older reviews.
2. Use self-authored answers across English, Hindi, and Hinglish, including correct/partial/incorrect responses, equivalent paraphrases, negation, contradictions, quoted misconceptions, and STT substitutions. Keep the same answer text and question for each compared configuration. Do not invent scored observations or use real learner answers without consent.
3. Give each distinct answer an anonymous `answer_id` within its language and each reviewer an anonymous `reviewer_id`. Keep the private text and ID mapping separate from this metadata file. Repeated scoring attempts need distinct answer IDs and matched attempts across configurations; their answer text may repeat. Do not put names, recordings, tokens, or answer text into the review metadata.
4. A reviewer reads the prompt, source-backed reference concepts in `data/quiz_questions.json`, and answer without seeing the automated score. Award each listed concept once only when the answer correctly conveys it. A keyword by itself, an uncorrected contradiction, or a claim that denies the concept is insufficient. A quotation explicitly corrected by the learner may convey the correct concept. When scope or meaning is unclear, document the uncertainty privately rather than treating an alias as proof. Count the awarded concepts as `human_matched_concepts`.
5. Reviewers work independently. Preserve disagreements as separate reviews. For the same language/answer/reviewer, reuse the human concept count across compared configurations. The runner converts it to `min(100, round(100 × matched / minimum_concepts))` and rubric completion (`matched >= minimum_concepts`), matching the score scale in the bank.
6. Copy the actual automated `score` and `complete` result as `automated_score`/`automated_complete`. If scoring failed, use `outcome: "failed"`, both fields `null`, and a known `failure_reason`: `scoring-error`, `timeout`, `invalid-response`, or `other`. A failed attempt still needs its independent human concept count. Repeat the same automated result across its reviewer entries; inconsistent results for one configuration/language/answer are rejected.

## Input and command

Keep metadata in ignored `evals/local-quiz-reviews.json`. Obtain the hash without running a scoring trial:

```powershell
(Get-FileHash data/quiz_questions.json -Algorithm SHA256).Hash.ToLower()
```

The shape below is illustrative, not an observation. Replace the hash and values with actual collection data before scoring:

```json
{
  "rubric_version": 1,
  "question_bank_sha256": "REPLACE_WITH_CURRENT_BANK_HASH",
  "trials": [
    {
      "config": "lexical-v1",
      "language": "Hinglish",
      "question_id": "art14_equality",
      "answer_id": "answer-001",
      "reviewer_id": "reviewer-01",
      "outcome": "completed",
      "automated_score": 50,
      "automated_complete": false,
      "human_matched_concepts": 1
    }
  ]
}
```

```powershell
node evals/score_quiz_reviews.js evals/local-quiz-reviews.json
```

Input is bounded to 4 MiB and 10,000 answer/reviewer entries; the bank is bounded to 1 MiB. Configuration, answer, and reviewer IDs use 1–64 ASCII letters/digits/underscore/dot/hyphen and begin with a letter or digit. Languages are `English`, `Hindi`, or `Hinglish`. Duplicate configuration/language/answer/reviewer entries, unknown questions, inconsistent question mappings/results/reviews, extra trial fields, and out-of-range values are rejected with indexed generic errors. The runner never calls scoring APIs or reads private answer text. Keep generated JSON under the same ignored `local-quiz-*.json` pattern.

## Interpret the report

Groups are configuration and language. On completed answer/reviewer pairs, the report gives score MAE, signed error (automated minus human), nearest-rank p95 absolute error, exact score agreement, and a completeness confusion table. `false_complete` means the tool marked complete while that reviewer did not; `false_incomplete` is the reverse. Missing completed reviews produce null rates/errors, not zero error. Failure counts use distinct answers, so adding another reviewer does not duplicate a failure.

Compare configurations only after inspecting both all-review and completed-review coverage flags and failures. A single configuration has null coverage flags. Matching IDs/counts are necessary bookkeeping, not proof of identical input or settings. Each reviewer contributes equally; multiple reviewers of one answer are correlated and can change the weighting. The report omits answer/reviewer IDs and text, but configuration labels and aggregates are still manually supplied. It does not infer consensus, significance, semantic grading quality, or a winner. Report sample composition and disagreements with any measured results.

No human review collection or scoring-report runtime checks have been performed for this addition.
