import os
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from bolprep import ask_model, offline_answer
from retrieval import load_corpus, retrieve


class RetrievalTests(unittest.TestCase):
    def test_article_number_ranks_matching_note_first(self):
        results = retrieve("What does Article 19 cover?")
        self.assertTrue(results)
        self.assertEqual(results[0]["id"], "article-19")

    def test_explicit_article_and_topic_avoid_unrelated_notes(self):
        results = retrieve("What does Article 14 say about equality?")
        self.assertEqual([document["id"] for document in results], ["article-14"])

    def test_english_keyword_finds_article_21(self):
        results = retrieve("right to life and personal liberty")
        self.assertEqual(results[0]["id"], "article-21")

    def test_hinglish_keyword_finds_equality_note(self):
        results = retrieve("samanta ka adhikar kya hai")
        self.assertEqual([document["id"] for document in results], ["article-14"])

    def test_devanagari_keyword_finds_equality_note(self):
        results = retrieve("समानता का अधिकार")
        self.assertEqual(results[0]["id"], "article-14")

    def test_uncovered_question_returns_no_notes(self):
        self.assertEqual(retrieve("Who is the current prime minister?"), [])

    def test_explicit_article_does_not_cover_missing_topic(self):
        self.assertEqual(retrieve("Does Article 21 guarantee privacy?"), [])

    def test_broad_hindi_fundamental_rights_returns_starter_notes(self):
        self.assertEqual(
            {document["id"] for document in retrieve("मौलिक अधिकार क्या हैं?")},
            {"article-14", "article-19", "article-21"},
        )

    def test_corpus_sources_are_linkable_and_checked(self):
        documents = load_corpus()
        self.assertEqual(len(documents), 3)
        for document in documents:
            self.assertTrue(document["source"]["url"].startswith("https://"))
            self.assertEqual(document["source"]["checked_on"], "2026-10-04")

    def test_offline_answer_uses_note_summary_and_labels_it(self):
        answer = offline_answer(retrieve("Article 14 equality"))
        self.assertIn("Offline study notes", answer)
        self.assertIn("Article 14", answer)

    def test_model_request_contains_retrieved_evidence(self):
        captured = {}

        class FakeResponses:
            def create(self, **kwargs):
                captured.update(kwargs)
                return SimpleNamespace(output_text="Article 14 is about equality.")

        class FakeOpenAI:
            def __init__(self, **kwargs):
                captured["client_options"] = kwargs
                self.responses = FakeResponses()

        fake_sdk = SimpleNamespace(OpenAI=FakeOpenAI)
        history = [{"role": "user", "content": "Tell me about equality."}]
        documents = retrieve("Article 14 equality")
        with patch.dict(sys.modules, {"openai": fake_sdk}), patch.dict(
            os.environ, {"OPENAI_MODEL": "test-model"}
        ):
            answer = ask_model("Explain Article 14", history, documents)

        self.assertEqual(answer, "Article 14 is about equality.")
        self.assertEqual(captured["model"], "test-model")
        self.assertEqual(captured["input"][0], history[0])
        self.assertIn("Article 14", captured["input"][-1]["content"])
        self.assertIn("Part III, Article 14", captured["input"][-1]["content"])
        self.assertEqual(captured["client_options"], {"timeout": 45.0, "max_retries": 1})


if __name__ == "__main__":
    unittest.main()
