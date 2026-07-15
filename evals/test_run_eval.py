#!/usr/bin/env python3
"""Regression tests for eval provider response handling."""
import importlib.util
import os
from pathlib import Path
import unittest
from unittest.mock import patch


HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("run_eval", HERE / "run_eval.py")
run_eval = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(run_eval)


class OpenRouterResponseTest(unittest.TestCase):
    def test_sonnet5_arm_uses_sonnet5_api_id(self):
        provider, model, _opts = run_eval.ARMS["sonnet5"]

        self.assertEqual(provider, "anthropic")
        self.assertEqual(model, "claude-sonnet-5")

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


if __name__ == "__main__":
    unittest.main()
