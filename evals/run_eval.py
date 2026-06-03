#!/usr/bin/env python3
"""Lick generation eval harness.

Runs each configured model "arm" N times per genre against the repo's real
prompt, scores every output with the deterministic musicality scorer, and
reports per-arm aggregates (parse rate, composite mean/sd/min, latency,
thinking tokens).

Quick start:
    npx tsx evals/dump_prompts.ts > evals/prompts.json   # refresh prompts
    python3 evals/run_eval.py                              # run the suite

Environment:
    ANTHROPIC_TOKEN, ANTHROPIC_BASE_URL   for claude-* arms
    GEMINI_API_KEY                        for gemini-* arms
    EVAL_N        samples per cell (default 5)
    EVAL_GENRES   comma list (default jazz,blues,funk)
    EVAL_ARMS     comma list of arm names (default: all defined below)
    EVAL_BARS     bar count, must match dump_prompts.ts (default 4)

Add or change arms in ARMS below. Each arm is (provider, model, options).

Findings baked into the defaults (see evals/README.md):
  - Gemini 3.x Flash is a thinking model; without thinking_budget=0 the
    reasoning eats the output budget and JSON truncates. A *small* cap (e.g.
    128) is the worst case: the model overruns it and still truncates. Use 0
    (off) or a large/dynamic budget, nothing in between.
"""
import os
import re
import json
import time
import statistics as st
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
import sys
sys.path.insert(0, str(HERE))
from scorer import score_lick  # noqa: E402

PROMPTS_PATH = HERE / "prompts.json"
RESULTS_PATH = HERE / "results.json"

N = int(os.environ.get("EVAL_N", "5"))
BARS = int(os.environ.get("EVAL_BARS", "4"))
GENRES = os.environ.get("EVAL_GENRES", "jazz,blues,funk").split(",")

# --- Arm registry -----------------------------------------------------------
# provider: "anthropic" | "gemini"
# options: anthropic -> {}, gemini -> {"thinking_budget": int}  (0=off, -1=dynamic)
ARMS = {
    "haiku":          ("anthropic", "claude-haiku-4-5", {}),
    "opus":           ("anthropic", "claude-opus-4-8", {}),
    "sonnet":         ("anthropic", "claude-sonnet-4-6", {}),
    "flash_think0":   ("gemini", "gemini-3.5-flash", {"thinking_budget": 0}),
    "flash_dynamic":  ("gemini", "gemini-3.5-flash", {"thinking_budget": -1}),
}
DEFAULT_ARMS = ["haiku", "flash_think0"]
SELECTED = os.environ.get("EVAL_ARMS", ",".join(DEFAULT_ARMS)).split(",")

MAX_TOKENS = 2048


def _post(url, headers, body, timeout=120):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=headers, method="POST")
    t = time.time()
    with urllib.request.urlopen(req, timeout=timeout) as r:
        data = json.loads(r.read())
    return data, (time.time() - t) * 1000


def _parse(txt):
    """Best-effort JSON extraction. Handles fenced ```json blocks and models
    that wrap the object in conversational text by falling back to the first
    balanced {...} span."""
    try:
        return json.loads(re.sub(r"```json?|```", "", txt).strip())
    except Exception:
        pass
    # Fallback: grab the outermost {...} and try that.
    start = txt.find("{")
    end = txt.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(txt[start:end + 1])
        except Exception:
            return None
    return None


def gen_anthropic(model, system, user, _opts):
    base = os.environ["ANTHROPIC_BASE_URL"].rstrip("/")
    headers = {
        "Content-Type": "application/json",
        "x-api-key": os.environ["ANTHROPIC_TOKEN"],
        "anthropic-version": "2023-06-01",
    }
    body = {"model": model, "max_tokens": MAX_TOKENS, "system": system,
            "messages": [{"role": "user", "content": user}]}
    data, ms = _post(f"{base}/v1/messages", headers, body)
    return data["content"][0]["text"], ms, data["usage"]["output_tokens"], 0


def gen_gemini(model, system, user, opts):
    key = os.environ["GEMINI_API_KEY"]
    gc = {"maxOutputTokens": MAX_TOKENS, "responseMimeType": "application/json",
          "thinkingConfig": {"thinkingBudget": opts.get("thinking_budget", 0)}}
    body = {"systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": gc}
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
    data, ms = _post(url, {"Content-Type": "application/json"}, body)
    cand = data["candidates"][0]
    txt = "".join(p.get("text", "") for p in cand.get("content", {}).get("parts", []))
    um = data.get("usageMetadata", {})
    return txt, ms, um.get("candidatesTokenCount", 0), um.get("thoughtsTokenCount", 0)


PROVIDERS = {"anthropic": gen_anthropic, "gemini": gen_gemini}
REQUIRED_ENV = {
    "anthropic": ["ANTHROPIC_BASE_URL", "ANTHROPIC_TOKEN"],
    "gemini": ["GEMINI_API_KEY"],
}


def main():
    if not PROMPTS_PATH.exists():
        raise SystemExit(f"Missing {PROMPTS_PATH}. Run: npx tsx evals/dump_prompts.ts > evals/prompts.json")
    prompts = json.loads(PROMPTS_PATH.read_text())

    rows = []
    for arm in SELECTED:
        if arm not in ARMS:
            print(f"!! unknown arm '{arm}', skipping"); continue
        provider, model, opts = ARMS[arm]
        # Skip an arm whose credentials are missing instead of raising a
        # KeyError on every sample and spamming the console.
        missing = [v for v in REQUIRED_ENV.get(provider, []) if v not in os.environ]
        if missing:
            print(f"!! {arm}: missing {', '.join(missing)}, skipping arm"); continue
        gen = PROVIDERS[provider]
        for g in GENRES:
            sysp, usr = prompts[g]["system"], prompts[g]["user"]
            for i in range(N):
                try:
                    txt, ms, out_tok, think_tok = gen(model, sysp, usr, opts)
                    j = _parse(txt)
                    if j is None:
                        rows.append({"arm": arm, "genre": g, "ms": ms, "out": out_tok,
                                     "think": think_tok, "comp": None, "fail": "parse"})
                        print(f"  {arm:14}{g:6} #{i} PARSE_FAIL ms={ms:.0f} out={out_tok} think={think_tok}")
                        continue
                    s = score_lick(j, BARS)
                    # Parsed-but-empty licks return only {parse, composite}; use
                    # .get so the row still records comp=0.0 (a real, low score)
                    # instead of falling into the exception handler as comp=None.
                    sub = {k: s.get(k) for k in ("duration_fits", "strong_beat_chordtones",
                                                 "enharmonic_sane", "strong_ending", "valid_durations",
                                                 "note_count")}
                    rows.append({"arm": arm, "genre": g, "ms": ms, "out": out_tok,
                                 "think": think_tok, "comp": s["composite"], **sub})
                    print(f"  {arm:14}{g:6} #{i} comp={s['composite']:.3f} ms={ms:.0f} out={out_tok} think={think_tok}")
                except Exception as e:
                    rows.append({"arm": arm, "genre": g, "ms": None, "comp": None, "fail": str(e)[:80]})
                    print(f"  {arm:14}{g:6} #{i} ERR {str(e)[:90]}")

    RESULTS_PATH.write_text(json.dumps(rows, indent=2))

    print("\n" + "=" * 80)
    print(f"{'arm':15}{'n':>3}{'parse%':>8}{'comp_mean':>11}{'comp_sd':>9}{'comp_min':>10}{'ms_med':>9}{'think_med':>11}")
    for arm in SELECTED:
        a = [r for r in rows if r["arm"] == arm]
        if not a:
            continue
        ok = [r for r in a if r.get("comp") is not None]
        comps = [r["comp"] for r in ok]
        mss = [r["ms"] for r in a if r.get("ms")]
        thinks = [r["think"] for r in a if r.get("think") is not None]
        mean = round(st.mean(comps), 3) if comps else 0
        sd = round(st.pstdev(comps), 3) if len(comps) > 1 else 0
        cmin = round(min(comps), 3) if comps else 0
        msmed = round(st.median(mss)) if mss else 0
        thmed = round(st.median(thinks)) if thinks else 0
        print(f"{arm:15}{len(a):>3}{100*len(ok)/len(a):>7.0f}%{mean:>11}{sd:>9}{cmin:>10}{msmed:>9}{thmed:>11}")

    print("\nPer-genre composite mean:")
    for arm in SELECTED:
        if not any(r["arm"] == arm for r in rows):
            continue
        line = f"  {arm:14}"
        for g in GENRES:
            c = [r["comp"] for r in rows if r["arm"] == arm and r["genre"] == g and r.get("comp") is not None]
            line += f"{g}={st.mean(c):.3f} " if c else f"{g}=NA "
        print(line)
    print(f"\nsaved {RESULTS_PATH}")


if __name__ == "__main__":
    main()
