import os
import sys
from datetime import date
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

    def test_hindi_right_to_equality_question_uses_the_exact_note_phrase(self):
        results = retrieve("समानता का अधिकार किस अनुच्छेद में है?")
        self.assertEqual([document["id"] for document in results], ["article-14"])

    def test_explicit_limit_caps_broad_results(self):
        self.assertEqual(len(retrieve("fundamental rights", limit=3)), 3)

    def test_new_articles_retrieve_by_english_topic(self):
        self.assertEqual(retrieve("Article 15 discrimination", limit=1)[0]["id"], "article-15")
        self.assertEqual(retrieve("Article 16 public employment", limit=1)[0]["id"], "article-16")
        self.assertEqual(retrieve("Article 21A education", limit=1)[0]["id"], "article-21a")

    def test_uncovered_question_returns_no_notes(self):
        self.assertEqual(retrieve("Who is the current prime minister?"), [])

    def test_explicit_article_does_not_cover_missing_topic(self):
        self.assertEqual(retrieve("Does Article 21 guarantee privacy?"), [])
        self.assertEqual(retrieve("क्या अनुच्छेद 21 निजता की गारंटी देता है?"), [])

    def test_primary_article_excludes_contextual_references(self):
        questions = (
            "What laws does Article 31C protect from rights under Articles 14 and 19?",
            "अनुच्छेद 31C के तहत अनुच्छेद 39(b) और 39(c) की नीति लागू करने वाले कानूनों को किन अधिकारों से संरक्षण मिलता है?",
            "Article 31C mein 39(b) aur 39(c) ki policy wale kanoon ko Article 14 aur 19 se kya protection milti hai?",
        )
        for question in questions:
            with self.subTest(question=question):
                self.assertEqual([document["id"] for document in retrieve(question)], ["article-31c"])

    def test_article_comparison_keeps_both_notes(self):
        results = retrieve("Compare Article 14 with Article 19")
        self.assertEqual([document["id"] for document in results], ["article-14", "article-19"])

    def test_separate_multi_article_requests_keep_both_notes(self):
        for question in (
            "Explain Article 14 and also explain Article 19",
            "Tell me Article 14 then Article 19",
        ):
            with self.subTest(question=question):
                self.assertEqual(
                    [document["id"] for document in retrieve(question)],
                    ["article-14", "article-19"],
                )

    def test_broad_hindi_fundamental_rights_returns_all_notes(self):
        self.assertEqual(
            {document["id"] for document in retrieve("मौलिक अधिकार क्या हैं?")},
            {document["id"] for document in load_corpus()},
        )

    def test_corpus_sources_are_linkable_and_checked(self):
        documents = load_corpus()
        self.assertEqual(len(documents), 48)
        for document in documents:
            self.assertTrue(document["source"]["url"].startswith("https://"))
            self.assertLessEqual(date.fromisoformat(document["source"]["checked_on"]), date.today())

    def test_offline_answer_uses_note_summary_and_labels_it(self):
        answer = offline_answer(retrieve("Article 14 equality"))
        self.assertIn("Offline study notes", answer)
        self.assertIn("Article 14", answer)

    def test_offline_answer_uses_devanagari_for_hindi_input(self):
        answer = offline_answer(retrieve("समानता का अधिकार"), "hi-IN", "समानता का अधिकार")
        self.assertIn("ऑफलाइन अध्ययन नोट्स", answer)
        self.assertIn("कानून के समक्ष समानता", answer)

    def test_offline_answer_uses_roman_hinglish_for_roman_input(self):
        answer = offline_answer(retrieve("Article 21 jeevan liberty"), "hi-IN", "Article 21 jeevan liberty")
        self.assertIn("Offline study notes", answer)
        self.assertIn("har person ke jeevan", answer)

    def test_unsupported_offline_answer_matches_selected_language(self):
        hindi = offline_answer([], "hi-IN", "मौलिक अधिकार का नया सवाल")
        hinglish = offline_answer([], "hi-IN", "Mera new sawal")
        english = offline_answer([], "en-IN", "A new question")
        self.assertIn("जाँचे हुए", hindi)
        self.assertIn("Mere checked", hinglish)
        self.assertIn("My checked", english)

    def test_model_request_contains_retrieved_evidence(self):
        captured = {}

        class FakeResponses:
            def create(self, **kwargs):
                captured.update(kwargs)
                return SimpleNamespace(output_text="Article 14 is about equality.", status="completed")

        class FakeOpenAI:
            def __init__(self, **kwargs):
                captured["client_options"] = kwargs
                self.responses = FakeResponses()

            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc_value, traceback):
                captured["client_closed"] = True

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
        self.assertTrue(captured["client_closed"])


if __name__ == "__main__":
    unittest.main()
