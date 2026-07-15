#!/usr/bin/env python3
"""Regression tests for eval provider and resume contracts."""
import importlib.util
import contextlib
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("run_eval", HERE / "run_eval.py")
run_eval = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(run_eval)


class EvalHarnessTest(unittest.TestCase):
    def test_sonnet5_disables_adaptive_thinking(self):
        provider, model, opts = run_eval.ARMS["sonnet5"]
        self.assertEqual(provider, "anthropic")
        self.assertEqual(model, "claude-sonnet-5")
        captured = {}

        def fake_post(url, headers, body, timeout=120):
            captured.update(body=body)
            return {"content": [{"text": "{}"}], "usage": {"output_tokens": 1}}, 1

        with patch.dict(os.environ, {"ANTHROPIC_BASE_URL": "https://eval.example", "ANTHROPIC_TOKEN": "test-token"}), patch.object(run_eval, "_post", fake_post):
            run_eval.gen_anthropic(model, "system rules", "genre request", opts)

        self.assertEqual(captured["body"]["thinking"], {"type": "disabled"})
        self.assertNotIn("system", captured["body"])
        self.assertEqual(captured["body"]["messages"], [{"role": "user", "content": "system rules\n\ngenre request"}])

    def test_retained_rows_keep_completed_unselected_arms(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            results_path = Path(tmpdir) / "results.json"
            results_path.write_text(json.dumps([
                {"arm": "haiku", "genre": "jazz"},
                {"arm": "sonnet5", "genre": "jazz"},
                {"arm": "grok45", "genre": "jazz"},
            ]))

            self.assertEqual(run_eval.retained_rows(results_path, ["grok45"]), [
                {"arm": "haiku", "genre": "jazz"},
                {"arm": "sonnet5", "genre": "jazz"},
            ])

    def test_retained_rows_reject_incompatible_metadata(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            results_path = Path(tmpdir) / "results.json"
            results_path.write_text(json.dumps({
                "metadata": {"prompt_sha256": "stale"},
                "rows": [{"arm": "haiku", "genre": "jazz"}],
            }))

            with self.assertRaisesRegex(ValueError, "incompatible"):
                run_eval.retained_rows(
                    results_path,
                    ["grok45"],
                    {"prompt_sha256": "current"},
                )

    def test_retained_rows_accept_json_round_trip_metadata(self):
        prompts = {"jazz": {"system": "system", "user": "user"}}
        metadata = run_eval.eval_metadata(prompts)
        with tempfile.TemporaryDirectory() as tmpdir:
            results_path = Path(tmpdir) / "results.json"
            results_path.write_text(json.dumps({
                "metadata": metadata,
                "rows": [{"arm": "haiku", "genre": "jazz"}],
            }))

            self.assertEqual(run_eval.retained_rows(results_path, ["grok45"], metadata), [
                {"arm": "haiku", "genre": "jazz"},
            ])

    def test_metadata_tracks_output_token_budget(self):
        prompts = {"jazz": {"system": "system", "user": "user"}}
        metadata = run_eval.eval_metadata(prompts)
        with patch.object(run_eval, "MAX_TOKENS", run_eval.MAX_TOKENS + 1):
            changed_metadata = run_eval.eval_metadata(prompts)

        self.assertNotEqual(metadata, changed_metadata)

    def test_report_includes_retained_comparison_arms(self):
        rows = [
            {"arm": "haiku", "genre": "jazz", "ms": 10, "think": 0, "comp": 0.8},
            {"arm": "sonnet5", "genre": "jazz", "ms": 20, "think": 0, "comp": 0.9},
            {"arm": "grok45", "genre": "jazz", "ms": 30, "think": 1, "comp": 1.0},
        ]
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            run_eval.print_report(rows, ["jazz"])

        self.assertIn("haiku", output.getvalue())
        self.assertIn("sonnet5", output.getvalue())
        self.assertIn("grok45", output.getvalue())

    def test_error_payload_reports_provider_error(self):
        with patch.dict(os.environ, {"OPENROUTER_API_KEY": "test-key"}), patch.object(
            run_eval, "_post", return_value=({"error": {"message": "provider unavailable"}}, 12)
        ):
            with self.assertRaisesRegex(RuntimeError, "OpenRouter error: provider unavailable"):
                run_eval.gen_openrouter("x-ai/grok-4.5", "system", "user", {})

    def test_empty_choices_reports_missing_choices(self):
        with patch.dict(os.environ, {"OPENROUTER_API_KEY": "test-key"}), patch.object(
            run_eval, "_post", return_value=({"choices": []}, 12)
        ):
            with self.assertRaisesRegex(RuntimeError, "OpenRouter response missing 'choices'"):
                run_eval.gen_openrouter("x-ai/grok-4.5", "system", "user", {})

    def test_choice_without_message_reports_invalid_message(self):
        with patch.dict(os.environ, {"OPENROUTER_API_KEY": "test-key"}), patch.object(
            run_eval, "_post", return_value=({"choices": [{"message": None}]}, 12)
        ):
            with self.assertRaisesRegex(RuntimeError, "OpenRouter response missing valid message"):
                run_eval.gen_openrouter("x-ai/grok-4.5", "system", "user", {})


if __name__ == "__main__":
    unittest.main()
