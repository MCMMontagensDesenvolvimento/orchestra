import tempfile
import unittest
from pathlib import Path

from bridge import _resolve_secret


class SecretFileResolutionTests(unittest.TestCase):
    def test_environment_value_remains_available_for_local_development(self):
        env = {
            "OPENAI_API_KEY": "local-test-key",
            "OPENAI_API_KEY_FILE": "",
        }

        self.assertEqual(
            _resolve_secret(env, "OPENAI_API_KEY", "OPENAI_API_KEY_FILE"),
            "local-test-key",
        )

    def test_secret_file_has_precedence_over_environment_value(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "openai_api_key"
            path.write_text("file-test-key\n", encoding="utf-8")

            env = {
                "OPENAI_API_KEY": "environment-test-key",
                "OPENAI_API_KEY_FILE": str(path),
            }

            self.assertEqual(
                _resolve_secret(env, "OPENAI_API_KEY", "OPENAI_API_KEY_FILE"),
                "file-test-key",
            )

    def test_configured_missing_file_is_fail_closed(self):
        env = {
            "OPENAI_API_KEY": "environment-test-key",
            "OPENAI_API_KEY_FILE": "/definitely/missing/openai_api_key",
        }

        with self.assertRaises(ValueError):
            _resolve_secret(
                env,
                "OPENAI_API_KEY",
                "OPENAI_API_KEY_FILE",
            )

    def test_configured_empty_file_is_fail_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "openai_api_key"
            path.write_text("", encoding="utf-8")

            env = {
                "OPENAI_API_KEY": "environment-test-key",
                "OPENAI_API_KEY_FILE": str(path),
            }

            with self.assertRaises(ValueError):
                _resolve_secret(
                    env,
                    "OPENAI_API_KEY",
                    "OPENAI_API_KEY_FILE",
                )


if __name__ == "__main__":
    unittest.main()
