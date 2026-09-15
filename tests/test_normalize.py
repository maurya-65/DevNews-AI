from agent.normalize import canonical_url, clean_text, domain_of, to_utc_iso


def test_scheme_host_port_fragment_and_tracking_are_noise():
    assert (canonical_url("http://www.Example.com:443/a/b?utm_source=x&id=3#frag")
            == "https://example.com/a/b?id=3")


def test_path_and_meaningful_query_are_kept():
    assert canonical_url("https://example.com/watch?v=abc") == "https://example.com/watch?v=abc"
    assert canonical_url("https://example.com/a/") != canonical_url("https://example.com/a")


def test_empty_path_becomes_root():
    assert canonical_url("https://example.com") == "https://example.com/"


def test_non_web_urls_are_rejected():
    assert canonical_url("mailto:someone@example.com") == ""
    assert canonical_url("") == ""
    assert canonical_url(None) == ""


def test_domain_of_strips_www_and_port():
    assert domain_of("https://www.jvns.ca:8443/post") == "jvns.ca"
    assert domain_of("") == ""


def test_clean_text_strips_markup_and_caps_on_a_word_boundary():
    assert clean_text("<p>Hello&nbsp;<b>world</b></p>") == "Hello world"
    capped = clean_text("word " * 200, 50)
    assert capped.endswith("…") and len(capped) <= 51 and "wor…" not in capped
    assert clean_text("   ") is None


def test_timestamps_normalise_to_utc():
    assert to_utc_iso("2026-09-14T10:00:00-05:00") == "2026-09-14T15:00:00+00:00"
    assert to_utc_iso("2026-09-14T10:00:00Z") == "2026-09-14T10:00:00+00:00"
    assert to_utc_iso((2026, 9, 14, 10, 0, 0, 0, 0, 0)) == "2026-09-14T10:00:00+00:00"
    assert to_utc_iso("not a date") is None
