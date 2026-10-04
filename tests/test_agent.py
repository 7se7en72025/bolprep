import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import agent


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
                    "topic": "fundamental rights", "question_count": 1, "language": "en-IN"
                })], output_text=""),
                SimpleNamespace(output=[], output_text="Let's begin with Article 14."),
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

    def test_score_tool_uses_server_rubric_and_binds_write_to_session(self):
        args = json.dumps({
            "quiz_id": "quiz-one",
            "question_id": "art14_equality",
            "answer": "equality before the law",
            "language": "en-IN",
        })
        result = {"score": 50, "complete": False, "feedback": "Add another point."}
        with patch.object(agent, "score_answer", return_value=result) as scorer, patch.object(
            agent, "save_answer", return_value=result
        ) as save:
            output, event = agent._execute_tool("score_answer", args, "call-3", "session-one")
        self.assertTrue(output["ok"])
        self.assertEqual(event["result"], result)
        scorer.assert_called_once_with("art14_equality", "equality before the law", "en-IN")
        save.assert_called_once_with("session-one", "quiz-one", "art14_equality", "call-3", result)

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
