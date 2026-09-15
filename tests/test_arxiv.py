from agent.sources.arxiv import untex


def test_inline_math_becomes_readable_text():
    assert untex(r"Modeling Quantum Computing with $\pi$-calculus") == "Modeling Quantum Computing with π-calculus"
    assert untex(r"An $O(n \log n)$ bound") == "An O(n log n) bound"
    assert untex(r"Sparse $\ell_1$ recovery") == "Sparse ℓ1 recovery"


def test_unknown_commands_keep_their_name_and_plain_text_is_untouched():
    assert untex(r"The $\foo$ operator") == "The foo operator"
    assert untex("Costs $5 and $10") == "Costs $5 and $10"
    assert untex("No maths here") == "No maths here"
    assert untex(None) is None
