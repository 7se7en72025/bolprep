import unittest

from quiz import score_answer, start_quiz


class QuizToolTests(unittest.TestCase):
    def test_start_quiz_returns_bounded_prompts_and_sources(self):
        quiz = start_quiz("fundamental rights", 3)
        self.assertEqual(len(quiz["questions"]), 3)
        self.assertEqual(len({item["id"] for item in quiz["questions"]}), 3)
        self.assertTrue(all("source" in item and "prompt" in item for item in quiz["questions"]))
        self.assertTrue(all("concepts" not in item for item in quiz["questions"]))

    def test_start_quiz_returns_selected_language(self):
        quiz = start_quiz("fundamental rights", 1, "en-IN")
        self.assertIn(quiz["questions"][0]["prompt"], {
            "What two ideas does Article 14 protect?",
            "Name any two freedoms listed in Article 19(1).",
            "Which two interests does Article 21 protect?",
            "Name two safeguards for an arrested person under Article 22(1)-(2).",
        })

    def test_start_quiz_rejects_unavailable_topic_and_unbounded_count(self):
        with self.assertRaises(ValueError):
            start_quiz("all subjects", 1)
        with self.assertRaises(ValueError):
            start_quiz("fundamental rights", 20)

    def test_score_answer_awards_full_credit_for_both_article_14_ideas(self):
        result = score_answer(
            "art14_equality",
            "Equality before the law and equal protection of the laws.",
        )
        self.assertEqual(result["score"], 100)
        self.assertTrue(result["complete"])

    def test_score_answer_gives_partial_credit_and_missing_concept_feedback(self):
        result = score_answer("art21_protection", "Article 21 protects life.", "hi-IN")
        self.assertEqual(result["score"], 50)
        self.assertFalse(result["complete"])
        self.assertIn("vyaktigat swatantrata", result["feedback"])

    def test_score_answer_gives_devanagari_feedback_for_devanagari_answer(self):
        result = score_answer("art21_protection", "जीवन का अधिकार", "hi-IN")
        self.assertEqual(result["score"], 50)
        self.assertIn("व्यक्तिगत स्वतंत्रता", result["feedback"])

    def test_unknown_question_and_empty_answer_are_rejected(self):
        with self.assertRaises(ValueError):
            score_answer("not-a-question", "an answer")
        with self.assertRaises(ValueError):
            score_answer("art21_protection", " ")


if __name__ == "__main__":
    unittest.main()
