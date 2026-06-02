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
# Fallback used only for timeline placement when a duration is unrecognized.
# Unknown durations are separately penalized via the `valid_durations` score.
FALLBACK_BEATS = 0.5

NOTE_PC = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}

# Playable one-hand range mandated by the prompt: C4..E5.
MIN_MIDI, MAX_MIDI = 60, 76
# Largest sensible consecutive melodic leap before it's awkward (major 10th).
MAX_LEAP = 16
# Note-count window the prompt mandates.
MIN_NOTES, MAX_NOTES = 12, 24


def pitch_class(pitch: str):
    """('C#4') -> (pitch_class 0..11, octave). None if unparseable/rest.

    Accidentals that cross the C/B octave boundary shift the octave so that
    `Cb4` reads as B3 and `B#4` reads as C5 (scientific pitch notation).
    """
    m = re.match(r"^([A-G])(b{1,2}|#{1,2})?(\d)$", pitch)
    if not m:
        return None
    acc = m.group(2) or ""
    pc_raw = NOTE_PC[m.group(1)] + acc.count("#") - acc.count("b")
    octave = int(m.group(3)) + pc_raw // 12  # floor div handles both directions
    return pc_raw % 12, octave


def midi(pitch: str):
    r = pitch_class(pitch)
    if r is None:
        return None
    pc, octv = r
    return (octv + 1) * 12 + pc


def _chord_intervals(symbol: str):
    """(root_pc, [intervals]) for a chord symbol, or None if unparseable.
    Intervals are ordered 1-3-5-(7), so the first three are always the triad."""
    m = re.match(r"^([A-G][b#]?)(.*)$", symbol)
    if not m:
        return None
    rm = re.match(r"^([A-G])(b|#)?$", m.group(1))
    if not rm:
        return None
    root = NOTE_PC[rm.group(1)] + (1 if rm.group(2) == "#" else -1 if rm.group(2) == "b" else 0)
    root %= 12
    g2 = m.group(2)
    q = g2.lower()
    # Major-seventh family, including extensions (maj7/9/11/13, M7/9, Δ).
    if re.search(r"(maj|ma)(7|9|11|13)", q) or re.search(r"M(7|9|11|13)", g2) or "Δ" in g2 or "∆" in g2:
        iv = [0, 4, 7, 11]
    elif "m7b5" in q or "ø" in q or "min7b5" in q:
        iv = [0, 3, 6, 10]
    elif "dim7" in q or "o7" in q:
        iv = [0, 3, 6, 9]
    elif "dim" in q:
        iv = [0, 3, 6]
    # Minor seventh family, including minor extensions (m7/9/11/13, -9, min11).
    elif re.search(r"(m|min|-)(7|9|11|13)", q):
        iv = [0, 3, 7, 10]
    elif "m6" in q or "min6" in q:
        iv = [0, 3, 7, 9]
    elif q.startswith(("m", "min", "-")):
        iv = [0, 3, 7]
    elif "maj" in q and "7" not in q:
        iv = [0, 4, 7]  # plain major triad (no 7th)
    elif "6" in q:
        iv = [0, 4, 7, 9]
    elif "7" in q:
        iv = [0, 4, 7, 10]  # dominant
    else:
        iv = [0, 4, 7]  # plain major triad
    return root, iv


def chord_tones(symbol: str) -> set[int]:
    """Pitch classes of the chord's 1-3-5-(7) from a chord symbol like 'Dm7'."""
    r = _chord_intervals(symbol)
    if r is None:
        return set()
    root, iv = r
    return {(root + i) % 12 for i in iv}


def chord_triad(symbol: str) -> set[int]:
    """Pitch classes of just the root, 3rd, and 5th (no 7th). The prompt's
    'strong ending' rule allows only these for the final note."""
    r = _chord_intervals(symbol)
    if r is None:
        return set()
    root, iv = r
    return {(root + i) % 12 for i in iv[:3]}


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
    notes = lick.get("notes") or []
    if not notes:
        return {"parse": 0, "composite": 0.0}

    out: dict[str, Any] = {}

    # Build the onset timeline (in beats) from the duration sequence.
    t = 0.0
    timeline = []
    for n in notes:
        timeline.append((t, n))
        t += DUR_BEATS.get(n.get("duration"), FALLBACK_BEATS)
    total = t
    target = bars * beats_per_bar

    # 0. Valid durations: every note uses a recognized Tone.js value.
    bad_dur = sum(1 for n in notes if n.get("duration") not in DUR_BEATS)
    out["valid_durations"] = 1.0 if not bad_dur else max(0.0, 1 - bad_dur / len(notes))

    # 1. Duration fits the bar count exactly (broken rhythm = broken playback).
    out["duration_fits"] = 1.0 if abs(total - target) < 0.01 else max(0.0, 1 - abs(total - target) / target)

    chords = sorted(
        lick.get("chords") or [],
        key=lambda c: (((c.get("bar") or 1) - 1) * beats_per_bar + ((c.get("beat") or 1) - 1)),
    )
    chord_offsets = [
        (((c.get("bar") or 1) - 1) * beats_per_bar + ((c.get("beat") or 1) - 1), chord_tones(c.get("chord") or ""))
        for c in chords
    ]

    # 2. Strong-beat chord-tone targeting (beats 1 & 3 of each bar).
    #    A rest, unparseable pitch, or a beat the lick never reaches counts as a
    #    miss: the prompt mandates a chord tone on every beat 1 & 3, so silence
    #    or a too-short lick is non-compliant.
    hits = total_strong = 0
    for b in range(bars):
        for beat in (0, 2):
            gt = b * beats_per_bar + beat
            ct = _active_chord_tones(chord_offsets, gt)
            if not ct:
                continue
            total_strong += 1
            if gt >= total:
                continue  # lick ended before this strong beat = miss
            active = None
            for onset, n in timeline:
                if onset <= gt + 1e-6:
                    active = n
                else:
                    break
            if not active or active.get("pitch") == "rest":
                continue  # rest on a strong beat = miss
            pcm = pitch_class(active.get("pitch") or "")
            if pcm is None:
                continue  # unparseable pitch on a strong beat = miss
            if pcm[0] in ct:
                hits += 1
    out["strong_beat_chordtones"] = hits / total_strong if total_strong else 0.0

    pitched = [n for n in notes if n.get("pitch") and n.get("pitch") != "rest"]

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

    # 6. Strong ending: last note a root/3rd/5th of the final chord (prompt rule
    #    6 excludes the 7th), quarter+ long, AND landing on strong beat 1 or 3.
    last = notes[-1]
    last_onset = timeline[-1][0]
    beat_in_bar = last_onset % beats_per_bar
    on_strong = abs(beat_in_bar) < 1e-6 or abs(beat_in_bar - 2) < 1e-6
    ending = 0.0
    if DUR_BEATS.get(last.get("duration"), 0) >= 1:
        final_chord = chords[-1].get("chord") or "" if chords else ""
        triad = chord_triad(final_chord)
        pcm = pitch_class(last.get("pitch") or "") if last.get("pitch") != "rest" else None
        if pcm and pcm[0] in triad:
            ending = 1.0 if on_strong else 0.5
        elif pcm:
            ending = 0.5 if on_strong else 0.25
    out["strong_ending"] = ending

    # 7. Enharmonic sanity: no double accidentals (e.g. Bbb, F##).
    bad = sum(1 for n in pitched if re.search(r"(bb|##)", n.get("pitch", "")))
    out["enharmonic_sane"] = 1.0 if bad == 0 else max(0.0, 1 - bad / len(pitched))

    # 8. Playable leaps: no consecutive jump bigger than a major 10th.
    ms = pitched_midis
    leaps = [abs(ms[i + 1] - ms[i]) for i in range(len(ms) - 1)]
    big = sum(1 for l in leaps if l > MAX_LEAP)
    out["playable_leaps"] = 1.0 if not leaps else max(0.0, 1 - big / len(leaps))

    # 9. Note count within the mandated 12..24 window.
    nc = len(notes)
    if MIN_NOTES <= nc <= MAX_NOTES:
        out["note_count"] = 1.0
    elif nc < MIN_NOTES:
        out["note_count"] = nc / MIN_NOTES
    else:
        out["note_count"] = max(0.0, 1 - (nc - MAX_NOTES) / MAX_NOTES)

    # 10. ABC structure: required headers present and enough barlines.
    abc = lick.get("abc", "")
    has_hdr = all(h in abc for h in ["X:", "M:", "L:", "K:"])
    out["abc_valid"] = 1.0 if (has_hdr and abc.count("|") >= bars) else 0.5 if has_hdr else 0.0

    # Composite: weight correctness that breaks playback/theory highest.
    weights = {
        "duration_fits": 3, "strong_beat_chordtones": 3, "strong_ending": 2,
        "valid_durations": 2, "in_range": 1, "rhythmic_variety": 1,
        "rest_density": 1, "enharmonic_sane": 1, "playable_leaps": 1,
        "note_count": 1, "abc_valid": 1,
    }
    out["composite"] = round(sum(out[k] * w for k, w in weights.items()) / sum(weights.values()), 3)
    out["parse"] = 1
    return out
