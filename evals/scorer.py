"""Deterministic musicality scorer for generated licks.

No LLM, no vibes: every check is an objective music-theory rule that the
generation prompt mandates, verified mechanically. Each sub-score is 0..1 and
they roll up into a weighted `composite`.

Why this exists: judging lick quality by eye (n=1) is unreliable and doesn't
scale. This scorer makes model/prompt comparisons reproducible and catches
defects the eye misses (e.g. note durations that don't fill the bar, or a
double-flat enharmonic).

Usage:
    from scorer import score_lick
    result = score_lick(lick_dict, bars=4)   # -> {"composite": 0.91, ...}

A lick dict is the parsed JSON the API returns: it must have `notes`
(list of {pitch, duration, ...}), `chords` (list of {chord, bar, beat}) and
optionally `abc`.
"""
from __future__ import annotations
import re
from typing import Any

# Tone.js duration string -> length in quarter-note beats.
DUR_BEATS = {
    "1n": 4, "2n.": 3, "2n": 2, "4n.": 1.5, "4n": 1,
    "8n.": 0.75, "8n": 0.5, "16n.": 0.375, "16n": 0.25, "32n": 0.125,
}

NOTE_PC = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}

# Playable one-hand range mandated by the prompt: C4..E5.
MIN_MIDI, MAX_MIDI = 60, 76
# Largest sensible consecutive melodic leap before it's awkward (major 10th).
MAX_LEAP = 16


def pitch_class(pitch: str):
    """('C#4') -> (pitch_class 0..11, octave). None if unparseable/rest."""
    m = re.match(r"^([A-G])(b{1,2}|#{1,2})?(\d)$", pitch)
    if not m:
        return None
    pc = NOTE_PC[m.group(1)]
    acc = m.group(2) or ""
    pc += acc.count("#") - acc.count("b")
    return pc % 12, int(m.group(3))


def midi(pitch: str):
    r = pitch_class(pitch)
    if r is None:
        return None
    pc, octv = r
    return (octv + 1) * 12 + pc


def chord_tones(symbol: str) -> set[int]:
    """Pitch classes of the chord's 1-3-5-(7) from a chord symbol like 'Dm7'."""
    m = re.match(r"^([A-G][b#]?)(.*)$", symbol)
    if not m:
        return set()
    rm = re.match(r"^([A-G])(b|#)?$", m.group(1))
    if not rm:
        return set()
    root = NOTE_PC[rm.group(1)] + (1 if rm.group(2) == "#" else -1 if rm.group(2) == "b" else 0)
    root %= 12
    q = m.group(2).lower()
    if "maj7" in q or "ma7" in q or "M7" in m.group(2):
        iv = [0, 4, 7, 11]
    elif "m7b5" in q or "ø" in q or "min7b5" in q:
        iv = [0, 3, 6, 10]
    elif "dim7" in q or "o7" in q:
        iv = [0, 3, 6, 9]
    elif "dim" in q:
        iv = [0, 3, 6]
    elif re.search(r"(m|min|-)7", q):
        iv = [0, 3, 7, 10]
    elif "m6" in q or "min6" in q:
        iv = [0, 3, 7, 9]
    elif q.startswith(("m", "min", "-")):
        iv = [0, 3, 7]
    elif "maj" in q and "7" not in q:
        iv = [0, 4, 7]
    elif "6" in q:
        iv = [0, 4, 7, 9]
    elif "7" in q:
        iv = [0, 4, 7, 10]  # dominant
    else:
        iv = [0, 4, 7]  # plain major triad
    return {(root + i) % 12 for i in iv}


def _active_chord_tones(chord_offsets, beat):
    cur = None
    for off, tones in chord_offsets:
        if off <= beat + 1e-6:
            cur = tones
        else:
            break
    return cur


def score_lick(lick: dict[str, Any], bars: int, beats_per_bar: int = 4) -> dict[str, Any]:
    """Score one lick. Returns sub-scores (0..1), a weighted `composite`, and
    `parse` (1 if scoreable, 0 if there were no notes)."""
    notes = lick.get("notes", [])
    if not notes:
        return {"parse": 0, "composite": 0.0}

    out: dict[str, Any] = {}

    # Build the onset timeline (in beats) from the duration sequence.
    t = 0.0
    timeline = []
    for n in notes:
        timeline.append((t, n))
        t += DUR_BEATS.get(n.get("duration"), 0.5)
    total = t
    target = bars * beats_per_bar

    # 1. Duration fits the bar count exactly (broken rhythm = broken playback).
    out["duration_fits"] = 1.0 if abs(total - target) < 0.01 else max(0.0, 1 - abs(total - target) / target)

    chords = sorted(
        lick.get("chords", []),
        key=lambda c: ((c.get("bar", 1) - 1) * beats_per_bar + (c.get("beat", 1) - 1)),
    )
    chord_offsets = [
        ((c.get("bar", 1) - 1) * beats_per_bar + (c.get("beat", 1) - 1), chord_tones(c.get("chord", "")))
        for c in chords
    ]

    # 2. Strong-beat chord-tone targeting (beats 1 & 3 of each bar).
    hits = total_strong = 0
    for b in range(bars):
        for beat in (0, 2):
            gt = b * beats_per_bar + beat
            if gt >= total:
                continue
            active = None
            for onset, n in timeline:
                if onset <= gt + 1e-6:
                    active = n
                else:
                    break
            if not active or active.get("pitch") == "rest":
                continue
            ct = _active_chord_tones(chord_offsets, gt)
            if not ct:
                continue
            pcm = pitch_class(active["pitch"])
            if pcm is None:
                continue
            total_strong += 1
            if pcm[0] in ct:
                hits += 1
    out["strong_beat_chordtones"] = hits / total_strong if total_strong else 0.0

    pitched = [n for n in notes if n.get("pitch") != "rest"]

    # 3. Range: all pitched notes within C4..E5.
    pitched_midis = [m for m in (midi(n["pitch"]) for n in pitched) if m is not None]
    in_range = sum(1 for m in pitched_midis if MIN_MIDI <= m <= MAX_MIDI)
    out["in_range"] = in_range / len(pitched) if pitched else 0.0

    # 4. Rhythmic variety: >=3 distinct durations.
    distinct = len({n.get("duration") for n in notes})
    out["rhythmic_variety"] = 1.0 if distinct >= 3 else 0.5 if distinct == 2 else 0.0

    # 5. Rest density: at least one rest per 2 bars.
    rests = sum(1 for n in notes if n.get("pitch") == "rest")
    want = max(1, bars // 2)
    out["rest_density"] = 1.0 if rests >= want else rests / want

    # 6. Strong ending: last note a chord tone of the final chord, quarter+ long.
    last = notes[-1]
    ending = 0.0
    if DUR_BEATS.get(last.get("duration"), 0) >= 1:
        ct = chord_offsets[-1][1] if chord_offsets else set()
        pcm = pitch_class(last.get("pitch", "")) if last.get("pitch") != "rest" else None
        if pcm and pcm[0] in ct:
            ending = 1.0
        elif pcm:
            ending = 0.5
    out["strong_ending"] = ending

    # 7. Enharmonic sanity: no double accidentals (e.g. Bbb, F##).
    bad = sum(1 for n in pitched if re.search(r"(bb|##)", n.get("pitch", "")))
    out["enharmonic_sane"] = 1.0 if bad == 0 else max(0.0, 1 - bad / len(pitched))

    # 8. Playable leaps: no consecutive jump bigger than a major 10th.
    ms = pitched_midis
    leaps = [abs(ms[i + 1] - ms[i]) for i in range(len(ms) - 1)]
    big = sum(1 for l in leaps if l > MAX_LEAP)
    out["playable_leaps"] = 1.0 if not leaps else max(0.0, 1 - big / len(leaps))

    # 9. ABC structure: required headers present and enough barlines.
    abc = lick.get("abc", "")
    has_hdr = all(h in abc for h in ["X:", "M:", "L:", "K:"])
    out["abc_valid"] = 1.0 if (has_hdr and abc.count("|") >= bars) else 0.5 if has_hdr else 0.0

    # Composite: weight correctness that breaks playback/theory highest.
    weights = {
        "duration_fits": 3, "strong_beat_chordtones": 3, "strong_ending": 2,
        "in_range": 1, "rhythmic_variety": 1, "rest_density": 1,
        "enharmonic_sane": 1, "playable_leaps": 1, "abc_valid": 1,
    }
    out["composite"] = round(sum(out[k] * w for k, w in weights.items()) / sum(weights.values()), 3)
    out["parse"] = 1
    return out
