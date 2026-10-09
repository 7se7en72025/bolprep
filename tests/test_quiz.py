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

    def test_clear_english_denial_does_not_earn_full_credit(self):
        result = score_answer(
            "art14_equality",
            "There is no equality before the law and no equal protection of the laws.",
        )
        self.assertEqual(result["score"], 0)
        self.assertFalse(result["complete"])
        self.assertEqual(result["matched_concepts"], [])
        self.assertIn("may deny or contradict", result["feedback"])

    def test_negation_of_one_concept_withholds_automatic_credit(self):
        result = score_answer(
            "art14_equality", "Equality before the law, but no equal protection of the laws."
        )
        self.assertEqual(result["score"], 0)
        self.assertFalse(result["complete"])
        self.assertEqual(result["matched_concepts"], [])
        self.assertIn("Automatic credit was withheld", result["feedback"])

    def test_extra_negated_article_19_concept_cannot_still_complete_quiz(self):
        result = score_answer(
            "art19_freedoms", "Speech and expression, movement, but no peaceful assembly."
        )
        self.assertEqual(result["score"], 0)
        self.assertFalse(result["complete"])
        self.assertEqual(result["total_concepts"], 6)
        self.assertEqual(len(result["missing_concepts"]), 6)

    def test_hindi_negated_protection_does_not_score_article_21(self):
        result = score_answer(
            "art21_protection", "अनुच्छेद 21 जीवन और व्यक्तिगत स्वतंत्रता की रक्षा नहीं करता।", "hi-IN"
        )
        self.assertEqual(result["score"], 0)
        self.assertFalse(result["complete"])
        self.assertIn("denial/contradiction", result["feedback"])

    def test_hinglish_negated_protection_does_not_score_article_21(self):
        result = score_answer(
            "art21_protection", "Article 21 jeevan aur personal liberty ko protect nahi karta.", "hi-IN"
        )
        self.assertEqual(result["score"], 0)
        self.assertFalse(result["complete"])

    def test_additive_not_only_wording_still_earns_credit(self):
        for answer, language in (
            ("Not only equality before the law but also equal protection of the laws.", "en-IN"),
            ("कानून के सामने समानता ही नहीं बल्कि कानूनों का समान संरक्षण भी है।", "hi-IN"),
            ("Sirf barabari hi nahi balki kanoon ka barabar sanrakshan bhi hai.", "hi-IN"),
        ):
            with self.subTest(answer=answer):
                result = score_answer("art14_equality", answer, language)
                self.assertEqual(result["score"], 100)
                self.assertTrue(result["complete"])

    def test_negated_unrelated_phrase_or_denial_verb_still_earns_credit(self):
        for answer in (
            "Without discrimination equality before the law and equal protection of the laws apply.",
            "No one can deny equality before the law or equal protection of the laws.",
            "The State cannot deny equality before the law or equal protection of the laws.",
            "Equality before the law is not denied, and equal protection of the laws is not denied.",
        ):
            with self.subTest(answer=answer):
                result = score_answer("art14_equality", answer)
                self.assertEqual(result["score"], 100)
                self.assertTrue(result["complete"])

    def test_unknown_question_and_empty_answer_are_rejected(self):
        with self.assertRaises(ValueError):
            score_answer("not-a-question", "an answer")
        with self.assertRaises(ValueError):
            score_answer("art21_protection", " ")


if __name__ == "__main__":
    unittest.main()
