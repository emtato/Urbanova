from types import SimpleNamespace
from unittest.mock import patch

from pydantic import SecretStr

from backend.scripts.check_access import check_access


def test_missing_gemini_key_does_not_pass_the_access_gate():
    config = SimpleNamespace(gemini_api_key=SecretStr(""), gemini_model="test-model")
    with patch("backend.scripts.check_access.settings", config), patch("backend.scripts.check_access.ping_database", return_value="3.6"):
        report = check_access()
    assert report["database"]["status"] == "ok"
    assert report["gemini"]["status"] == "not_configured"
    assert not report["gate_passed"]


def test_structured_gemini_response_is_validated_with_the_pinned_sdk():
    config = SimpleNamespace(gemini_api_key=SecretStr("test-secret"), gemini_model="test-model")
    with patch("backend.scripts.check_access.settings", config), patch("backend.scripts.check_access.ping_database", return_value="3.6"), patch("google.genai.Client", autospec=True) as client:
        client.return_value.models.generate_content.return_value = SimpleNamespace(
            text='{"status":"ok","origin":"futureproof-access-check"}'
        )
        report = check_access()
    assert report["gate_passed"]
    assert report["gemini"]["response"]["origin"] == "futureproof-access-check"


def test_invalid_gemini_response_and_database_errors_keep_the_gate_closed():
    config = SimpleNamespace(gemini_api_key=SecretStr("test-secret"), gemini_model="test-model")
    with patch("backend.scripts.check_access.settings", config), patch("backend.scripts.check_access.ping_database", side_effect=RuntimeError("secret")), patch("google.genai.Client", autospec=True) as client:
        client.return_value.models.generate_content.return_value = SimpleNamespace(text='{"status":"wrong"}')
        report = check_access()
    assert not report["gate_passed"]
    assert report["database"]["status"] == "failed"
    assert report["gemini"]["status"] == "failed"
    assert "test-secret" not in str(report)
