import json
import unittest
import uuid
from functools import partial
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import patch

import agent
import progress


def function_call(name, arguments, call_id="call-1"):
    return SimpleNamespace(
        type="function_call",
        name=name,
        arguments=json.dumps(arguments),
        call_id=call_id,
    )


class FakeResponses:
    def __init__(self, responses):
        self.pending = list(responses)
        self.requests = []

    def create(self, **request):
        self.requests.append(request)
        return self.pending.pop(0)


class AgentToolTests(unittest.TestCase):
    def test_responses_tool_call_executes_quiz_and_sends_result_back(self):
        quiz = {
            "topic": "fundamental rights",
            "questions": [{"id": "art14_equality", "prompt": "Question", "source": {"section": "Article 14"}}],
        }
        fake = FakeResponses(
            [
                SimpleNamespace(output=[function_call("start_quiz", {
                    "topic": "fundamental rights", "question_count": 1, "language": "en-IN",
                    "difficulty": "standard",
                })], output_text="", status="completed"),
                SimpleNamespace(output=[], output_text="Let's begin with Article 14.", status="completed"),
            ]
        )
        with patch.object(agent, "start_quiz", return_value=quiz), patch.object(agent, "create_quiz_run") as create_run:
            result = agent.run_agent_turn("Give me a quiz", [], "session-one", "en-IN", fake)

        self.assertEqual(result["answer"], "Let's begin with Article 14.")
        event = result["tool_events"][0]
        self.assertEqual(event["name"], "start_quiz")
        self.assertTrue(event["ok"])
        create_run.assert_called_once()
        self.assertEqual(len(fake.requests), 2)
        self.assertEqual(fake.requests[0]["tools"], agent.TOOLS)
        self.assertTrue(all(tool["strict"] for tool in agent.TOOLS))
        self.assertTrue(all(
            set(tool["parameters"]["properties"]) == set(tool["parameters"]["required"])
            and tool["parameters"]["additionalProperties"] is False
            for tool in agent.TOOLS
        ))
        self.assertFalse(fake.requests[0]["parallel_tool_calls"])
        self.assertEqual(fake.requests[1]["input"][-1]["type"], "function_call_output")
        self.assertEqual(fake.requests[1]["input"][-1]["call_id"], "call-1")

    def test_unfinished_response_does_not_execute_tool(self):
        fake = FakeResponses([
            SimpleNamespace(output=[function_call("start_quiz", {
                "topic": "fundamental rights", "question_count": 1,
                "language": "en-IN", "difficulty": "standard",
            })], output_text="", status="incomplete"),
        ])
        with patch.object(agent, "start_quiz") as start, patch.object(agent, "create_quiz_run") as create_run:
            with self.assertRaisesRegex(RuntimeError, "did not finish"):
                agent.run_agent_turn("Give me a quiz", [], "session-one", "en-IN", fake)
        start.assert_not_called()
        create_run.assert_not_called()

    def test_invalid_tool_fields_are_reported_without_running_function(self):
        args = json.dumps({
            "topic": "fundamental rights",
            "question_count": 1,
            "language": "en-IN",
            "unexpected": "value",
        })
        with patch.object(agent, "start_quiz") as start:
            output, event = agent._execute_tool("start_quiz", args, "call-2", "session-one")
        self.assertFalse(output["ok"])
        self.assertFalse(event["ok"])
        start.assert_not_called()

    def test_score_preview_then_save_uses_server_result_and_stable_id(self):
        args = json.dumps({
            "quiz_id": "quiz-one",
            "question_id": "art14_equality",
            "language": "en-IN",
        })
        result = {"score": 50, "complete": False, "feedback": "Add another point."}
        pending = {}
        with patch.object(agent, "validate_quiz_question") as validate, patch.object(
            agent, "score_answer", return_value=result
        ) as scorer, patch.object(agent, "save_answer", return_value=result) as save:
            output, event = agent._execute_tool(
                "score_answer", args, "call-3", "session-one", learner_answer="equality before the law",
                pending_scores=pending,
            )
            self.assertTrue(output["ok"])
            self.assertFalse(event["result"]["saved"])
            score_id = event["result"]["score_id"]
            self.assertEqual(uuid.UUID(score_id).version, 4)
            self.assertEqual(output["result"], event["result"])
            self.assertEqual(pending[score_id]["session_id"], "session-one")
            self.assertEqual(pending[score_id]["result"], result)
            save.assert_not_called()
            output["result"]["feedback"] = "model-side mutation"
            save_args = json.dumps({"score_id": score_id})
            saved, saved_event = agent._execute_tool(
                "save_progress", save_args, "call-4", "session-one", pending_scores=pending,
            )
            self.assertTrue(saved["ok"])
            self.assertTrue(saved_event["result"]["saved"])
            self.assertEqual(saved_event["result"]["score_id"], score_id)
            self.assertEqual(saved_event["result"]["feedback"], result["feedback"])
            retry, _ = agent._execute_tool(
                "save_progress", save_args, "call-5", "session-one", pending_scores=pending,
            )
            self.assertEqual(retry["result"], saved["result"])
        validate.assert_called_once_with("session-one", "quiz-one", "art14_equality")
        scorer.assert_called_once_with("art14_equality", "equality before the law", "en-IN")
        self.assertEqual(save.call_count, 2)
        self.assertEqual(save.call_args.args, ("session-one", "quiz-one", "art14_equality", score_id, result))

    def test_score_tool_rejects_model_answer_and_missing_submission(self):
        fields = {"quiz_id": "quiz-one", "question_id": "art14_equality", "language": "en-IN"}
        with patch.object(agent, "validate_quiz_question") as validate, patch.object(agent, "score_answer") as scorer, patch.object(agent, "save_answer") as save:
            for arguments, submitted in (
                ({**fields, "answer": "invented perfect answer"}, "actual learner answer"),
                (fields, None), (fields, ""), (fields, "a" * 1001),
            ):
                with self.subTest(arguments=arguments, submitted=submitted):
                    output, event = agent._execute_tool(
                        "score_answer", json.dumps(arguments), "call-4", "session-one", learner_answer=submitted,
                    )
                    self.assertFalse(output["ok"])
                    self.assertFalse(event["ok"])
            scorer.assert_not_called()
            save.assert_not_called()
            validate.assert_not_called()

    def test_model_score_uses_current_message_not_history_or_evidence(self):
        question = "Score my answer: equality before the law"
        fake = FakeResponses([
            SimpleNamespace(output=[function_call("score_answer", {
                "quiz_id": "quiz-one", "question_id": "art14_equality", "language": "en-IN",
            })], output_text="", status="completed"),
            SimpleNamespace(output=[], output_text="Add equal protection.", status="completed"),
        ])
        with patch.object(agent, "validate_quiz_question"), patch.object(
            agent, "score_answer", return_value={"score": 50}
        ) as scorer, patch.object(agent, "save_answer") as save:
            result = agent.run_agent_turn(
                question, [{"role": "user", "content": "older answer"}], "session-one", "en-IN", fake,
            )
        scorer.assert_called_once_with("art14_equality", question, "en-IN")
        save.assert_not_called()
        self.assertTrue(result["tool_events"][0]["ok"])
        self.assertEqual(result["pending_score_count"], 1)
        self.assertIn("not saved", result["answer"])

    def test_model_score_then_save_progress_across_tool_rounds(self):
        score_id = "12345678-1234-4234-8234-123456789abc"
        score = {"question_id": "art14_equality", "score": 50, "complete": False,
                 "feedback": "Add equal protection."}
        fake = FakeResponses([
            SimpleNamespace(output=[function_call("score_answer", {
                "quiz_id": "quiz-one", "question_id": "art14_equality", "language": "en-IN",
            }, "score-call")], output_text="", status="completed"),
            SimpleNamespace(output=[function_call("save_progress", {"score_id": score_id}, "save-call")],
                            output_text="", status="completed"),
            SimpleNamespace(output=[], output_text="Your score is saved.", status="completed"),
        ])
        observed_tools = []
        with patch.object(agent, "validate_quiz_question"), patch.object(
            agent, "score_answer", return_value=score
        ), patch.object(agent, "save_answer", return_value=score) as save, patch.object(
            agent.uuid, "uuid4", return_value=uuid.UUID(score_id)
        ):
            result = agent.run_agent_turn("Score my answer: equality before the law", [],
                                          "session-one", "en-IN", fake,
                                          on_tool_event=observed_tools.append)
        self.assertEqual(len(fake.requests), 3)
        self.assertEqual([event["name"] for event in result["tool_events"]], ["score_answer", "save_progress"])
        self.assertEqual(result["tool_events"][0]["result"]["saved"], False)
        self.assertEqual(result["tool_events"][1]["result"]["saved"], True)
        self.assertEqual(result["pending_score_count"], 0)
        self.assertEqual(result["answer"], "Score: 50/100. Add equal protection.\n\nThis score was saved to quiz progress.")
        self.assertEqual(observed_tools, [
            {"name": "score_answer", "ok": True}, {"name": "save_progress", "ok": True},
        ])
        save.assert_called_once_with("session-one", "quiz-one", "art14_equality", score_id, score)

    def test_start_and_score_cannot_both_succeed_in_one_turn(self):
        quiz = {"topic": "fundamental rights", "questions": [{"id": "art14_equality", "prompt": "Question"}]}
        start = function_call("start_quiz", {
            "topic": "fundamental rights", "question_count": 1, "language": "en-IN", "difficulty": "standard",
        }, "start-call")
        score = function_call("score_answer", {
            "quiz_id": "quiz-one", "question_id": "art14_equality", "language": "en-IN",
        }, "score-call")
        for calls, successful, denied in (
            ([start, score], "start_quiz", "score_answer"),
            ([score, start], "score_answer", "start_quiz"),
        ):
            with self.subTest(successful=successful):
                fake = FakeResponses([
                    SimpleNamespace(output=calls, output_text="", status="completed"),
                    SimpleNamespace(output=[], output_text="Done.", status="completed"),
                ])
                with patch.object(agent, "start_quiz", return_value=quiz) as start_quiz, patch.object(
                    agent, "create_quiz_run"
                ), patch.object(agent, "validate_quiz_question"), patch.object(
                    agent, "score_answer", return_value={"score": 50, "feedback": "Add a point."}
                ) as score_answer, patch.object(agent, "save_answer") as save:
                    result = agent.run_agent_turn("Start a quiz and score my answer", [],
                                                  "session-one", "en-IN", fake)
                self.assertEqual([(event["name"], event["ok"]) for event in result["tool_events"]],
                                 [(successful, True), (denied, False)])
                self.assertEqual(start_quiz.call_count, int(successful == "start_quiz"))
                self.assertEqual(score_answer.call_count, int(successful == "score_answer"))
                save.assert_not_called()

    def test_tool_callbacks_survive_later_model_failure(self):
        score_id = "12345678-1234-4234-8234-123456789abc"
        score = {"question_id": "art14_equality", "score": 50, "complete": False,
                 "feedback": "Add another point."}
        fake = FakeResponses([
            SimpleNamespace(output=[function_call("score_answer", {
                "quiz_id": "quiz-one", "question_id": "art14_equality", "language": "en-IN",
            })], output_text="", status="completed"),
            SimpleNamespace(output=[function_call("save_progress", {"score_id": score_id})],
                            output_text="", status="completed"),
        ])
        observed = []
        with patch.object(agent, "validate_quiz_question"), patch.object(
            agent, "score_answer", return_value=score
        ), patch.object(agent, "save_answer", return_value=score) as save, patch.object(
            agent.uuid, "uuid4", return_value=uuid.UUID(score_id)
        ):
            with self.assertRaises(IndexError):
                agent.run_agent_turn("Score my answer: equality before law", [],
                                     "session-one", "en-IN", fake,
                                     on_tool_event=observed.append)
        save.assert_called_once()
        self.assertEqual(observed, [
            {"name": "score_answer", "ok": True}, {"name": "save_progress", "ok": True},
        ])

    def test_save_progress_rejects_fake_id_other_session_and_model_marks(self):
        pending = {"12345678-1234-4234-8234-123456789abc": {
            "session_id": "session-one", "quiz_id": "quiz-one", "question_id": "art14_equality",
            "result": {"score": 50, "complete": False}, "saved": False,
        }}
        with patch.object(agent, "save_answer") as save:
            for arguments, session in (
                ({"score_id": str(uuid.uuid4())}, "session-one"),
                ({"score_id": "12345678-1234-4234-8234-123456789abc"}, "session-two"),
                ({"score_id": "12345678-1234-4234-8234-123456789abc", "score": 100}, "session-one"),
            ):
                with self.subTest(arguments=arguments, session=session):
                    output, event = agent._execute_tool(
                        "save_progress", json.dumps(arguments), "save-call", session,
                        pending_scores=pending,
                    )
                    self.assertFalse(output["ok"])
                    self.assertFalse(event["ok"])
            save.assert_not_called()

    def test_scoring_rejects_unowned_quiz_before_rubric(self):
        arguments = json.dumps({"quiz_id": "other-quiz", "question_id": "art14_equality", "language": "en-IN"})
        with patch.object(agent, "validate_quiz_question", side_effect=ValueError("Not this browser")), patch.object(
            agent, "score_answer"
        ) as score, patch.object(agent, "save_answer") as save:
            output, event = agent._execute_tool(
                "score_answer", arguments, "score-call", "session-one",
                learner_answer="equality before law", pending_scores={},
            )
        self.assertFalse(output["ok"])
        self.assertFalse(event["ok"])
        score.assert_not_called()
        save.assert_not_called()

    def test_real_storage_preview_then_save_retry_and_owner_boundary(self):
        learner_text = "PRIVATE_LEARNER_TEXT equality before the law and equal protection of the laws"
        arguments = json.dumps({"quiz_id": "quiz-one", "question_id": "art14_equality", "language": "en-IN"})
        with TemporaryDirectory() as temporary:
            database = Path(temporary) / "progress.sqlite3"
            progress.create_quiz_run("session-one", "quiz-one", "fundamental rights",
                                     ["art14_equality"], database)
            pending = {}
            with patch.object(agent, "validate_quiz_question", partial(progress.validate_quiz_question, path=database)), patch.object(
                agent, "save_answer", partial(progress.save_answer, path=database)
            ):
                with patch.object(agent, "score_answer") as scorer:
                    denied, _ = agent._execute_tool(
                        "score_answer", arguments, "score-call", "session-two",
                        learner_answer=learner_text, pending_scores={},
                    )
                    self.assertFalse(denied["ok"])
                    scorer.assert_not_called()
                preview, _ = agent._execute_tool(
                    "score_answer", arguments, "score-call", "session-one",
                    learner_answer=learner_text, pending_scores=pending,
                )
                self.assertTrue(preview["ok"])
                self.assertFalse(preview["result"]["saved"])
                self.assertEqual(progress.get_progress("session-one", database)["attempt_count"], 0)
                score_id = preview["result"]["score_id"]
                save_args = json.dumps({"score_id": score_id})
                saved, _ = agent._execute_tool(
                    "save_progress", save_args, "save-call", "session-one", pending_scores=pending,
                )
                retry, _ = agent._execute_tool(
                    "save_progress", save_args, "retry-call", "session-one", pending_scores=pending,
                )
                self.assertTrue(saved["ok"])
                self.assertEqual(retry["result"], saved["result"])
                self.assertTrue(saved["result"]["saved"])
                self.assertEqual(progress.get_progress("session-one", database)["attempt_count"], 1)
                self.assertEqual(progress.get_progress("session-two", database)["attempt_count"], 0)
            self.assertNotIn(b"PRIVATE_LEARNER_TEXT", database.read_bytes())

    def test_score_intent_is_specific(self):
        for phrase in ("Score my answer: equality before the law", "Check my answer please",
                       "Mera jawab score karo", "मेरा जवाब जाँचो"):
            self.assertTrue(agent._has_tool_intent(phrase), phrase)
        for phrase in ("Explain Article 14", "What is the score of this match?", "Answer this question"):
            self.assertFalse(agent._has_tool_intent(phrase), phrase)

    def test_second_score_in_one_turn_is_rejected_without_rescoring(self):
        score_call = function_call("score_answer", {
            "quiz_id": "quiz-one", "question_id": "art14_equality", "language": "en-IN",
        })
        fake = FakeResponses([
            SimpleNamespace(output=[score_call], output_text="", status="completed"),
            SimpleNamespace(output=[score_call], output_text="", status="completed"),
            SimpleNamespace(output=[], output_text="I saved everything.", status="completed"),
        ])
        with patch.object(agent, "validate_quiz_question"), patch.object(
            agent, "score_answer", return_value={"score": 50, "feedback": "Add another point."}
        ) as scorer, patch.object(agent, "save_answer") as save:
            result = agent.run_agent_turn("Score my answer: equality before the law", [],
                                          "session-one", "en-IN", fake)
        scorer.assert_called_once()
        save.assert_not_called()
        self.assertEqual([event["ok"] for event in result["tool_events"]], [True, False])
        self.assertEqual(result["pending_score_count"], 1)
        self.assertNotIn("I saved everything.", result["answer"])
        self.assertIn("not saved", result["answer"])

    def test_offline_quiz_request_still_starts_a_checked_quiz(self):
        quiz = {
            "topic": "fundamental rights",
            "questions": [{"id": "art14_equality", "prompt": "Question", "source": {"section": "Article 14"}}],
        }
        with patch.object(agent, "api_is_configured", return_value=False), patch.object(
            agent, "start_quiz", return_value=quiz
        ), patch.object(agent, "create_quiz_run") as create_run:
            result = agent.run_agent_turn("Mera quiz lo", [], "session-one", "hi-IN")
        self.assertEqual(result["mode"], "offline")
        self.assertEqual(result["tool_events"][0]["name"], "start_quiz")
        self.assertTrue(result["tool_events"][0]["ok"])
        create_run.assert_called_once()


if __name__ == "__main__":
    unittest.main()
