r"""Validate .env before a run. Prints shapes and role claims, never secret values.

    .\.venv\Scripts\python.exe scripts\check_env.py
"""
import base64
import json
import re
import sys

from dotenv import dotenv_values

V = dotenv_values(".env")
FAILED = []


def report(name, status, note=""):
    mark = {"ok": "  OK  ", "warn": " WARN ", "bad": " FAIL "}[status]
    if status == "bad":
        FAILED.append(name)
    print(f"[{mark}] {name:30} {note}")


def val(key):
    return (V.get(key) or "").strip()


# --- provider selection ------------------------------------------------------
provider = val("LLM_PROVIDER").lower()
if provider not in ("gemini", "groq"):
    report("LLM_PROVIDER", "bad", f"'gemini' ya 'groq' hona chahiye, mila: {provider!r}")
else:
    report("LLM_PROVIDER", "ok", provider)

# --- LLM keys ----------------------------------------------------------------
# Only the active provider's key is required; the other is a warning.
# Gemini issues both the legacy "AIza..." and the newer "AQ.A..." format.
for key, prefixes, owner in (("GEMINI_API_KEY", ("AIza", "AQ."), "gemini"),
                             ("GROQ_API_KEY", ("gsk_",), "groq")):
    k = val(key)
    active = owner == provider
    if not k:
        report(key, "bad" if active else "warn",
               "khaali — LLM_PROVIDER isi pe set hai" if active
               else "khaali (abhi active nahi, switch karne pe chahiye)")
    elif not k.startswith(prefixes):
        report(key, "bad", f"{' ya '.join(prefixes)} se shuru nahi hota")
    else:
        report(key, "ok", f"len={len(k)}" + ("  <-- active" if active else ""))

# --- Supabase URLs -----------------------------------------------------------
for key, required in (("SUPABASE_URL", True), ("NEXT_PUBLIC_SUPABASE_URL", False)):
    u = val(key)
    if not u:
        report(key, "bad" if required else "warn", "khaali")
        continue
    if u.endswith("/"):
        report(key, "bad", "end mein slash hai, hata do")
        continue
    m = re.fullmatch(r"https://([a-z0-9]{20})\.supabase\.co", u)
    report(key, "ok", f"ref={m.group(1)}") if m else \
        report(key, "bad", "format https://<20-char-ref>.supabase.co hona chahiye")

if val("SUPABASE_URL") and val("NEXT_PUBLIC_SUPABASE_URL"):
    same = val("SUPABASE_URL") == val("NEXT_PUBLIC_SUPABASE_URL")
    report("URL match", "ok" if same else "bad",
           "dono same" if same else "dono alag hain — same hone chahiye")


# --- Supabase keys: decode the role claim, don't trust the label -------------
def role_of(token):
    """Read the unsigned JWT payload. Signature is never verified or needed here."""
    try:
        payload = token.split(".")[1]
        payload += "=" * (-len(payload) % 4)
        return json.loads(base64.urlsafe_b64decode(payload)).get("role")
    except Exception:
        return None


for key, want, required in (("SUPABASE_SERVICE_KEY", "service_role", True),
                            ("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon", False)):
    k = val(key)
    if not k:
        report(key, "bad" if required else "warn", "khaali")
        continue
    if k.startswith("eyJ"):
        got = role_of(k)
        report(key, "ok" if got == want else "bad",
               f"role={got}" + ("" if got == want else f"  (chahiye: {want})"))
    elif k.startswith("sb_"):
        kind = "secret" if want == "service_role" else "publishable"
        report(key, "ok" if f"sb_{kind}_" in k else "bad",
               "new-style key" if f"sb_{kind}_" in k else f"sb_{kind}_ hona chahiye")
    else:
        report(key, "bad", "na 'eyJ' na 'sb_' se shuru hota hai")

if val("SUPABASE_SERVICE_KEY") and val("SUPABASE_SERVICE_KEY") == val("NEXT_PUBLIC_SUPABASE_ANON_KEY"):
    report("key mixup", "bad", "service aur anon key EK HI hain")

print()
if FAILED:
    print("Theek karne hain:", ", ".join(FAILED))
    sys.exit(1)
print("Sab sahi — run karne ke liye tayaar.")
