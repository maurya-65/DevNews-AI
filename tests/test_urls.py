import pytest

from agent.store.urls import describe, supabase_url

GOOD = "https://abcdefghijklmnopqrst.supabase.co"


@pytest.mark.parametrize("raw", [
    GOOD,
    f"  {GOOD}\n",
    f'"{GOOD}"',
    f"'{GOOD}/'",
    "abcdefghijklmnopqrst.supabase.co",
    "abcdefghijklmnopqrst",
    "https://supabase.com/dashboard/project/abcdefghijklmnopqrst/settings/api",
])
def test_the_ways_a_pasted_url_goes_wrong_all_become_the_api_url(raw):
    assert supabase_url(raw) == GOOD


def test_a_clean_url_reports_no_problems_and_a_broken_one_says_why_without_echoing_it():
    assert describe(GOOD) == ""
    report = describe(' "abcdefghijklmnopqrst" ')
    assert report == "surrounding whitespace, quotes, bare project ref"
    assert "abcdefghijklmnopqrst" not in report
