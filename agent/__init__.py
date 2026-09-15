"""DevNews v2 — the daily pipeline.

    python -m agent run            # the whole thing
    python -m agent --help         # every stage on its own

Console output is forced to UTF-8 here. Windows terminals default to cp1252, and headlines
routinely carry em dashes and curly quotes; without this, printing one kills the run.
"""
import sys

for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        try:
            _stream.reconfigure(encoding="utf-8", errors="replace")
        except (ValueError, OSError):
            pass
