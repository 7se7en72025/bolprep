# Answer support review - version 1

This procedure reviews actual tutor answers against the exact study notes supplied to that turn. It complements retrieval evaluation: finding a relevant note does not prove that an answer uses it correctly. **No answers have been collected or reviewed under this procedure, and no report runner or measured results are claimed.**

## Prepare a collection

Use self-authored questions and authorized local/provider sessions. Include English, Devanagari Hindi, and Roman Hinglish; supported questions, ambiguous questions, unsupported subjects, explicit article references, and contextual follow-ups. Select and freeze the sample before inspecting outputs. Document the sampling method and exclusions; constructed prompts do not estimate real learner performance.

For each prompt, retain the exact current question, preceding context, language preference, and intended scope. Assign an expected disposition before reviewing output:

| Expected disposition | Meaning |
| --- | --- |
| `answered` | The frozen note collection can support the requested explanation. |
| `clarified` | The question needs more information to choose an answer within scope. |
| `abstained` | The requested subject is outside the frozen notes. |
| `inconclusive` | Reviewers cannot establish which disposition is appropriate. |

Use reviewers fluent in the output language and familiar with the relevant study material. Preserve source uncertainties from [SOURCE_REVIEW.md](../data/SOURCE_REVIEW.md). A claim supported by a repository summary can still expose a flawed summary; flag that separately and do not treat this exercise as legal correctness or redistribution approval.

## Freeze each observed attempt

Keep private collection files under `evals/local-answer-*.json`, which Git ignores. Do not store credentials, recordings, personal reviewer identities, or real learner data in these files. Record observed failures too; never fill a failed attempt with an invented answer.

| Field | Record |
| --- | --- |
| `rubric_version` | `1`. |
| `prompt_id`, `attempt_id`, `configuration_id` | Anonymous stable IDs; different attempts need different IDs. |
| `language`, `question`, `history` | Exact self-authored input and context used for the turn. |
| `expected_disposition` | Preassigned scope label and rationale. |
| `outcome` | `completed`, `failed`, or `cancelled`; failures need a reason. |
| `answer` | Exact displayed completed text, or null for unavailable output. Keep partial output separately and exclude it from completed-answer metrics. |
| `answer_sha256` | SHA-256 of exact UTF-8 answer bytes without normalization; null when no completed answer exists. |
| `provided_notes` | Exact note IDs/text/source metadata supplied to the turn, not merely the global corpus. |
| `displayed_sources` | Exact source records shown to the learner. |
| `corpus_sha256`, `code_revision`, `configuration` | Frozen corpus bytes, repository commit, scorer/mode/preferences, and requested/provider-reported model identifiers when available. |
| `request_id` | Observed request ID when available; it is not authenticated provenance. |

The current page export does not contain questions, answers, or full supplied-note snapshots. Saved conversations clip long text and omit some generation context. Neither artifact alone establishes this complete review record. Collect the missing self-authored text/evidence explicitly; do not reconstruct it from memory or infer resolved model versions from an alias.

## Define review units before labeling

Freeze one claim list per completed answer before independent support ratings. Use short, atomic factual statements: split sentences that assert several distinct facts. Keep the original wording and half-open start/end offsets measured in Unicode code points of the exact answer. Do not rewrite the answer while labeling it.

Headings, politeness, questions, uncertainty statements, and quiz instructions are not automatically factual study claims. Mark excluded spans with a reason. An answer with no factual claims has no factual-support denominator; it must not receive a perfect support score by default.

Reviewers use the same frozen units. If unit boundaries are disputed, retain that disagreement and resolve segmentation separately before comparing support labels. Preserve the original segmentation/version alongside any revised one.

## Label each factual claim independently

Review the complete prompt/context and provided notes. Keep configuration names and other reviewers' labels hidden during initial ratings.

| Label | Rule |
| --- | --- |
| `supported` | The provided notes support the whole claim, including its conditions, scope, and exceptions. Record supporting note IDs and evidence spans. |
| `contradicted` | The provided notes contradict a material part of the claim. Record the contradictory evidence. |
| `unbacked` | The provided notes do not establish the claim. Plausibility or outside knowledge is insufficient. |
| `inconclusive` | Ambiguity, translation, damaged evidence, or reviewer uncertainty prevents a defensible label. Record why. |

Record `reviewer_id`, `attempt_id`, `claim_id`, label, note IDs, evidence spans, and a brief rationale. Hindi/Hinglish paraphrases can be supported without word-for-word overlap, but dropped negation, broadened exceptions, or changed subjects require scrutiny. Report translation uncertainty separately rather than guessing a label.

## Review the answer and displayed sources

For each reviewer, record the observed answer disposition (`answered`, `clarified`, `abstained`, `mixed`, or `inconclusive`) and whether it addresses the actual question. A supported but irrelevant explanation is still an answer-relevance failure.

For each displayed note, label whether it supports at least one reviewed claim, is irrelevant, or is inconclusive. The UI usually shows answer-level retrieved-note links; it does not map each claim to a citation. Do not treat every displayed link as a claimed citation for every sentence. Human claim-to-note mappings are review annotations, not model-provided citation mappings.

An abstention can include unsupported factual claims, and an answered response can acknowledge uncertainty. Review its factual units as well as its disposition. Review claims of tool success against observed tool outcomes separately; these labels do not prove quiz scoring, persistence, speech quality, or interruption behavior.

## Report without hiding missing evidence

Publish only authorized, anonymized aggregates with the collection/configuration identifiers and rubric version. Include raw counts, denominators, language breakdowns, failures, cancellations, missing reviews, and examples that are safe to share.

- **Verified support fraction:** supported claims divided by all labeled factual claims, including inconclusive claims in the denominator. Also show the four label counts and the fraction among conclusive claims. Zero claims means unavailable, not 100%.
- **Fully supported answers:** completed reviewed answers with at least one factual claim and all claims supported. Show separate no-claim, contradicted, unbacked, and inconclusive answer counts; categories can overlap.
- **Displayed-note relevance:** supporting displayed notes divided by all reviewed displayed notes, including inconclusive notes. No displayed notes means unavailable. Report supported claims with no displayed supporting note separately.
- **Disposition/relevance:** show a confusion table of expected versus observed disposition, with inconclusive/mixed categories retained. Report answer-relevance labels separately. Appropriate abstentions are not measured by a lack of factual claims alone.
- **Agreement:** show exact initial support-label agreement on matched attempt/claim pairs and the disagreement table. Keep original independent ratings and any adjudicated labels separate; agreement is not correctness.

For configuration comparisons, match prompt, exact context, language, note snapshot, and reviewer coverage. Show the matched subset plus all collected attempts. Count failed/cancelled attempts in completion rates rather than silently dropping them; do not assign them invented factual-support labels. Different output claim counts make raw claim-level percentages descriptive, not a controlled significance result.

Keep missing evidence explicit. This protocol, a retrieval score, or a syntax check cannot establish answer quality. Actual collection, independent reviews, and reproducible report computation remain necessary.
