import pytest

from agent.llm import router as router_module
from agent.llm.base import Completion, ProviderError


class FakeProvider:
    def __init__(self, name, outcomes):
        self.name = name
        self.model = f"{name}-model"
        self.outcomes = list(outcomes)
        self.calls = 0

    def complete_json(self, system, user, schema, max_output_tokens):
        self.calls += 1
        outcome = self.outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return Completion(data={"ok": True}, provider=self.name, model=self.model)


def router(monkeypatch, gemini, groq, records=None):
    providers = {"gemini": gemini, "groq": groq}

    def build(name):
        provider = providers[name]
        if isinstance(provider, Exception):
            raise provider
        return provider

    monkeypatch.setattr(router_module, "_build", build)
    monkeypatch.setattr(router_module, "RETRY_DELAY_SECONDS", 0)
    return router_module.Router(primary="gemini", on_call=(records.append if records is not None else None))


def call(r):
    return r.complete_json("analyze", "system", "user", {})


def test_an_overload_goes_straight_to_the_fallback(monkeypatch):
    gemini = FakeProvider("gemini", [ProviderError("ServerError: 503 UNAVAILABLE, high demand")])
    groq = FakeProvider("groq", ["ok"])
    records = []
    completion = call(router(monkeypatch, gemini, groq, records))
    assert completion.provider == "groq"
    assert (gemini.calls, groq.calls) == (1, 1)
    assert [r["ok"] for r in records] == [False, True]


def test_other_errors_retry_the_primary_first(monkeypatch):
    gemini = FakeProvider("gemini", [ProviderError("invalid JSON: Expecting ','"), "ok"])
    groq = FakeProvider("groq", [])
    completion = call(router(monkeypatch, gemini, groq))
    assert completion.provider == "gemini"
    assert (gemini.calls, groq.calls) == (2, 0)


def test_the_primary_is_tried_again_last_when_the_fallback_also_fails(monkeypatch):
    gemini = FakeProvider("gemini", [ProviderError("503 UNAVAILABLE"), "ok"])
    groq = FakeProvider("groq", [ProviderError("429 rate limit reached")])
    completion = call(router(monkeypatch, gemini, groq))
    assert completion.provider == "gemini"
    assert (gemini.calls, groq.calls) == (2, 1)


def test_everything_failing_raises_with_every_reason(monkeypatch):
    gemini = FakeProvider("gemini", [ProviderError("503 UNAVAILABLE"), ProviderError("503 UNAVAILABLE")])
    groq = FakeProvider("groq", [ProviderError("boom")])
    with pytest.raises(ProviderError, match="boom"):
        call(router(monkeypatch, gemini, groq))


def test_an_unconfigured_provider_is_skipped(monkeypatch):
    groq = FakeProvider("groq", ["ok"])
    completion = call(router(monkeypatch, ProviderError("GEMINI_API_KEY is not set"), groq))
    assert completion.provider == "groq"


def test_no_provider_at_all_says_so(monkeypatch):
    missing = ProviderError("key not set")
    with pytest.raises(ProviderError, match="no provider is configured"):
        call(router(monkeypatch, missing, missing))
