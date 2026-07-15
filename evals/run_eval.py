#!/usr/bin/env python3
"""Lick generation eval harness.

Runs each configured model "arm" N times per genre against the repo's real
prompt, scores every output with the deterministic musicality scorer, and
reports per-arm aggregates (parse rate, composite mean/sd/min, latency,
thinking tokens).

Quick start:
    npm run dump-prompts   # refresh prompts (needs npm install once)
    python3 evals/run_eval.py                              # run the suite

Environment:
    ANTHROPIC_TOKEN, ANTHROPIC_BASE_URL   for claude-* arms
    GEMINI_API_KEY                        for gemini-* arms
    OPENROUTER_API_KEY                    for openrouter (OpenAI-compatible) arms
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
import hashlib
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
# provider: "anthropic" | "gemini" | "openrouter"
# options: anthropic -> {}, gemini -> {"thinking_budget": int}  (0=off, -1=dynamic)
#          openrouter -> {"reasoning": {...}}  (OpenAI-compatible; see gen_openrouter)
ARMS = {
    "haiku":          ("anthropic", "claude-haiku-4-5", {}),
    "opus":           ("anthropic", "claude-opus-4-8", {}),
    "sonnet":         ("anthropic", "claude-sonnet-4-6", {}),
    # Sonnet 5's current Anthropic API ID is claude-sonnet-5. Disable its
    # adaptive thinking so its latency and output budget are comparable to the
    # no-thinking production Haiku arm.
    # merge_system: the gateway only provisions haiku for requests with a system
    # field; any other Claude model 500s ("No OAuth token"). Folding system into
    # the user turn is the only way to evaluate non-haiku Claude here.
    "sonnet5":        ("anthropic", "claude-sonnet-5", {"merge_system": True, "thinking": {"type": "disabled"}}),
    # Grok 4.5 via OpenRouter (OpenAI-compatible chat/completions). Grok 4.5 is a
    # mandatory-reasoning model: OpenRouter rejects reasoning.enabled=false (400),
    # so we can't turn it off. In practice one call emits ~28k reasoning tokens
    # and takes ~4 min — see the eval findings. Long per-sample timeout needed.
    "grok45":         ("openrouter", "x-ai/grok-4.5", {"timeout": 300}),
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


def eval_metadata(prompts):
    """Fingerprint the prompt, scorer, and runner settings used for a result set."""
    return {
        "prompts_sha256": hashlib.sha256(json.dumps(prompts, sort_keys=True).encode()).hexdigest(),
        "scorer_sha256": hashlib.sha256((HERE / "scorer.py").read_bytes()).hexdigest(),
        "bars": BARS,
        "genres": GENRES,
        "samples_per_cell": N,
        "max_tokens": MAX_TOKENS,
        "arms": {arm: list(ARMS[arm]) for arm in sorted(ARMS)},
    }


def retained_rows(results_path, selected_arms, expected_metadata=None):
    """Keep completed arms only when they match the current eval configuration."""
    if not results_path.exists():
        return []
    existing = json.loads(results_path.read_text())
    if isinstance(existing, list):
        if expected_metadata is not None:
            raise ValueError("results are incompatible: missing eval metadata")
        rows = existing
    else:
        metadata = existing.get("metadata") if isinstance(existing, dict) else None
        rows = existing.get("rows") if isinstance(existing, dict) else None
        if metadata != expected_metadata:
            raise ValueError("results are incompatible with the current eval metadata")
        if not isinstance(rows, list):
            raise ValueError("results are incompatible: rows must be a list")
    return [row for row in rows if row.get("arm") not in selected_arms]


def gen_anthropic(model, system, user, opts):
    base = os.environ["ANTHROPIC_BASE_URL"].rstrip("/")
    # Mirror the production path (api/daily.ts, api/random.ts): send the static
    # system prompt as a cache_control text block with the prompt-caching beta
    # header, so latency reflects real cached requests rather than paying full
    # prompt cost on every sample.
    #
    # opts["no_cache"]=True falls back to a plain string system prompt with no
    # beta header. opts["merge_system"]=True instead folds the system text into
    # the user turn and sends NO system field. Both exist because this gateway
    # only provisions haiku for system-prompt requests: any other Claude model
    # 500s ("No OAuth token: promptpm") the moment a `system` field is present
    # (with OR without cache_control). merge_system is the only way to evaluate
    # non-haiku Claude here; the model sees identical instructions, just in the
    # user message. Latency then won't reflect prod prompt-caching.
    no_cache = opts.get("no_cache", False)
    merge_system = opts.get("merge_system", False)
    headers = {
        "Content-Type": "application/json",
        "x-api-key": os.environ["ANTHROPIC_TOKEN"],
        "anthropic-version": "2023-06-01",
    }
    body = {"model": model, "max_tokens": MAX_TOKENS}
    if "thinking" in opts:
        body["thinking"] = opts["thinking"]
    if merge_system:
        body["messages"] = [{"role": "user", "content": f"{system}\n\n{user}"}]
    else:
        if no_cache:
            body["system"] = system
        else:
            headers["anthropic-beta"] = "prompt-caching-2024-07-31"
            body["system"] = [{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}]
        body["messages"] = [{"role": "user", "content": user}]
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


def gen_openrouter(model, system, user, opts):
    """OpenAI-compatible chat/completions via OpenRouter. Grok 4.5 lives here.
    Sends system+user as messages. Grok 4.5 mandates reasoning (OpenRouter 400s
    on reasoning.enabled=false), so we can't suppress it; pass opts["reasoning"]
    only for models that accept it. Reports completion_tokens as output and
    reasoning_tokens as the 'thinking' column. opts["timeout"] widens the HTTP
    timeout for slow reasoning models."""
    key = os.environ["OPENROUTER_API_KEY"]
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {key}"}
    body = {
        "model": model,
        "max_tokens": MAX_TOKENS,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
    }
    if "reasoning" in opts:
        body["reasoning"] = opts["reasoning"]
    data, ms = _post("https://openrouter.ai/api/v1/chat/completions", headers, body,
                     timeout=opts.get("timeout", 120))
    if "error" in data:
        error = data["error"]
        if isinstance(error, dict):
            error = error.get("message", error)
        raise RuntimeError(f"OpenRouter error: {error}")
    choices = data.get("choices")
    if not choices:
        raise RuntimeError("OpenRouter response missing 'choices'")
    choice = choices[0]
    message = choice.get("message") if isinstance(choice, dict) else None
    if not isinstance(message, dict):
        raise RuntimeError("OpenRouter response missing valid message")
    txt = message.get("content") or ""
    um = data.get("usage", {}) or {}
    out_tok = um.get("completion_tokens", 0)
    think_tok = (um.get("completion_tokens_details") or {}).get("reasoning_tokens", 0)
    return txt, ms, out_tok, think_tok


PROVIDERS = {"anthropic": gen_anthropic, "gemini": gen_gemini, "openrouter": gen_openrouter}
REQUIRED_ENV = {
    "anthropic": ["ANTHROPIC_BASE_URL", "ANTHROPIC_TOKEN"],
    "gemini": ["GEMINI_API_KEY"],
    "openrouter": ["OPENROUTER_API_KEY"],
}


def print_report(rows, genres):
    """Print all retained and freshly generated arms in one comparison table."""
    report_arms = sorted({row.get("arm") for row in rows if row.get("arm")})
    print("\n" + "=" * 80)
    print(f"{'arm':15}{'n':>3}{'parse%':>8}{'comp_mean':>11}{'comp_sd':>9}{'comp_min':>10}{'ms_med':>9}{'think_med':>11}")
    for arm in report_arms:
        arm_rows = [row for row in rows if row["arm"] == arm]
        ok = [row for row in arm_rows if row.get("comp") is not None]
        comps = [row["comp"] for row in ok]
        mss = [row["ms"] for row in arm_rows if row.get("ms")]
        thinks = [row["think"] for row in arm_rows if row.get("think") is not None]
        mean = round(st.mean(comps), 3) if comps else 0
        sd = round(st.pstdev(comps), 3) if len(comps) > 1 else 0
        cmin = round(min(comps), 3) if comps else 0
        msmed = round(st.median(mss)) if mss else 0
        thmed = round(st.median(thinks)) if thinks else 0
        print(f"{arm:15}{len(arm_rows):>3}{100*len(ok)/len(arm_rows):>7.0f}%{mean:>11}{sd:>9}{cmin:>10}{msmed:>9}{thmed:>11}")

    print("\nPer-genre composite mean:")
    for arm in report_arms:
        line = f"  {arm:14}"
        for genre in genres:
            comps = [row["comp"] for row in rows if row["arm"] == arm and row["genre"] == genre and row.get("comp") is not None]
            line += f"{genre}={st.mean(comps):.3f} " if comps else f"{genre}=NA "
        print(line)


def main():
    if not PROMPTS_PATH.exists():
        raise SystemExit(f"Missing {PROMPTS_PATH}. Run: npm run dump-prompts")
    prompts = json.loads(PROMPTS_PATH.read_text())

    metadata = eval_metadata(prompts)
    rows = retained_rows(RESULTS_PATH, SELECTED, metadata)
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

    RESULTS_PATH.write_text(json.dumps({"metadata": metadata, "rows": rows}, indent=2))
    print_report(rows, GENRES)
    print(f"\nsaved {RESULTS_PATH}")


if __name__ == "__main__":
    main()
