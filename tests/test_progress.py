import tempfile
import unittest
import sqlite3
from pathlib import Path

from progress import ProgressConflict, clear_progress, create_quiz_run, ensure_session, get_progress, initialize, save_answer


class ProgressStorageTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.database = Path(self.temp_dir.name) / "progress.sqlite3"
        self.session_id = "session-one"
        ensure_session(self.session_id, self.database)

    def tearDown(self):
        self.temp_dir.cleanup()

    def make_result(self, score=50, complete=False):
        return {
            "question_id": "art14_equality",
            "score": score,
            "complete": complete,
            "feedback": "Try again.",
            "source": {"section": "Article 14"},
        }

    def start_run(self, session_id=None, quiz_id="quiz-one"):
        create_quiz_run(
            session_id or self.session_id,
            quiz_id,
            "fundamental rights",
            ["art14_equality"],
            self.database,
        )

    def test_saves_results_and_reports_weak_question(self):
        self.start_run()
        result = self.make_result()
        saved = save_answer(
            self.session_id, "quiz-one", "art14_equality", "request-one", result, self.database
        )
        progress = get_progress(self.session_id, self.database)
        self.assertEqual(saved, result)
        self.assertEqual(progress["attempt_count"], 1)
        self.assertEqual(progress["average_score"], 50)
        self.assertEqual(progress["weak_topics"][0]["topic"], "Article 14")

    def test_identical_retry_is_idempotent_and_changed_retry_conflicts(self):
        self.start_run()
        result = self.make_result()
        first = save_answer(
            self.session_id, "quiz-one", "art14_equality", "request-one", result, self.database
        )
        retry = save_answer(
            self.session_id, "quiz-one", "art14_equality", "request-one", result, self.database
        )
        self.assertEqual(retry, first)
        self.assertEqual(get_progress(self.session_id, self.database)["attempt_count"], 1)
        with self.assertRaises(ProgressConflict):
            save_answer(
                self.session_id, "quiz-one", "art14_equality", "request-two", result, self.database
            )

    def test_other_session_cannot_save_or_read_this_quiz(self):
        self.start_run()
        ensure_session("session-two", self.database)
        with self.assertRaises(ValueError):
            save_answer(
                "session-two", "quiz-one", "art14_equality", "request-two", self.make_result(), self.database
            )
        self.assertEqual(get_progress("session-two", self.database)["attempt_count"], 0)

    def test_clear_removes_progress_for_only_one_session(self):
        self.start_run()
        save_answer(
            self.session_id,
            "quiz-one",
            "art14_equality",
            "request-one",
            self.make_result(),
            self.database,
        )
        ensure_session("session-two", self.database)
        self.start_run("session-two", "quiz-two")
        save_answer(
            "session-two",
            "quiz-two",
            "art14_equality",
            "request-other",
            self.make_result(100, True),
            self.database,
        )
        clear_progress(self.session_id, self.database)
        self.assertEqual(get_progress(self.session_id, self.database)["attempt_count"], 0)
        self.assertEqual(get_progress("session-two", self.database)["attempt_count"], 1)

    def test_database_schema_does_not_store_raw_answers(self):
        connection = sqlite3.connect(self.database)
        try:
            columns = {row[1] for row in connection.execute("PRAGMA table_info(quiz_attempts)")}
        finally:
            connection.close()
        self.assertNotIn("answer", columns)
        self.assertNotIn("answer_hash", columns)

    def test_migrates_existing_scores_without_retaining_answer_hashes(self):
        legacy_database = self.database.with_name("legacy.sqlite3")
        connection = sqlite3.connect(legacy_database)
        try:
            connection.executescript(
                """
                CREATE TABLE sessions (id TEXT PRIMARY KEY, created_at TEXT NOT NULL);
                CREATE TABLE quiz_runs (id TEXT PRIMARY KEY, session_id TEXT, topic TEXT, created_at TEXT);
                CREATE TABLE quiz_run_questions (quiz_id TEXT, question_id TEXT, PRIMARY KEY (quiz_id, question_id));
                CREATE TABLE quiz_attempts (
                    quiz_id TEXT, question_id TEXT, answer_hash TEXT, score INTEGER, complete INTEGER,
                    result_json TEXT, saved_at TEXT, PRIMARY KEY (quiz_id, question_id)
                );
                INSERT INTO sessions VALUES ('session-one', '2026-10-04');
                INSERT INTO quiz_runs VALUES ('legacy-quiz', 'session-one', 'fundamental rights', '2026-10-04');
                INSERT INTO quiz_run_questions VALUES ('legacy-quiz', 'art14_equality');
                INSERT INTO quiz_attempts VALUES
                    ('legacy-quiz', 'art14_equality', 'old-hash', 75, 1, '{"score":75}', '2026-10-04');
                """
            )
        finally:
            connection.close()
        initialize(legacy_database)
        progress = get_progress(self.session_id, legacy_database)
        self.assertEqual(progress["attempt_count"], 1)
        self.assertEqual(progress["average_score"], 75)
        connection = sqlite3.connect(legacy_database)
        try:
            columns = {row[1] for row in connection.execute("PRAGMA table_info(quiz_attempts)")}
        finally:
            connection.close()
        self.assertNotIn("answer_hash", columns)
        self.assertIn("idempotency_key", columns)


if __name__ == "__main__":
    unittest.main()
