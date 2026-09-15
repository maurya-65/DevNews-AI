from agent.env import sanitize

URL = "https://abcdefghijklmnopqrst.supabase.co"


def test_a_byte_order_mark_from_powershell_is_removed_and_named_without_the_value():
    env = {"SUPABASE_URL": "﻿" + URL, "GROQ_API_KEY": "﻿gsk_topsecret\r\n",
           "UNRELATED": "﻿left alone"}
    corrections = sanitize(env)
    assert env["SUPABASE_URL"] == URL
    assert env["GROQ_API_KEY"] == "gsk_topsecret"
    assert env["UNRELATED"] == "﻿left alone"
    assert set(corrections) == {"SUPABASE_URL", "GROQ_API_KEY"}
    reported = " ".join(p for problems in corrections.values() for p in problems)
    assert "topsecret" not in reported and "abcdefghijklmnopqrst" not in reported


def test_a_quoted_bare_ref_becomes_the_api_url():
    env = {"SUPABASE_URL": '"abcdefghijklmnopqrst"'}
    assert sanitize(env) == {"SUPABASE_URL": ["quotes", "bare project ref"]}
    assert env["SUPABASE_URL"] == URL


def test_clean_values_are_left_exactly_as_they_were():
    env = {"SUPABASE_URL": URL, "GEMINI_API_KEY": "abc", "EMAIL_FROM": "DevNews <a@b.example>"}
    before = dict(env)
    assert sanitize(env) == {}
    assert env == before
