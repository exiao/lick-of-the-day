#!/usr/bin/env python3
"""Self-test for the musicality scorer. No API keys or network required.

    python3 evals/test_scorer.py

Verifies the scorer rewards a clean lick and penalizes the specific defects it
exists to catch (rhythm that doesn't fill the bars, double-flat enharmonics,
out-of-range notes, a weak ending, missing chord-tone targeting).
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from scorer import score_lick, chord_tones, midi

failures = []


def check(name, cond):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if not cond:
        failures.append(name)


# A clean, idiomatic 4-bar lick over a ii-V-I in C.
GOOD = {
    "key": "C", "bars": 4,
    "chords": [
        {"chord": "Dm7", "bar": 1, "beat": 1},
        {"chord": "G7", "bar": 2, "beat": 1},
        {"chord": "Cmaj7", "bar": 3, "beat": 1},
        {"chord": "Cmaj7", "bar": 4, "beat": 1},
    ],
    "abc": "X:1\nM:4/4\nL:1/8\nK:C\n\"Dm7\" DEFA \"G7\" GBdf|\"Cmaj7\" ecGE C2 z2|\"Cmaj7\" EGce g2 z2|\"Cmaj7\" GECG C4|",
    "notes": [
        # bar 1: Dm7  (beat1 = D, a chord tone)
        {"pitch": "D4", "duration": "4n"}, {"pitch": "F4", "duration": "8n"},
        {"pitch": "A4", "duration": "8n"}, {"pitch": "C5", "duration": "4n"}, {"pitch": "rest", "duration": "4n"},
        # bar 2: G7   (beat1 = G)
        {"pitch": "G4", "duration": "4n"}, {"pitch": "B4", "duration": "8n"},
        {"pitch": "D5", "duration": "8n"}, {"pitch": "F4", "duration": "4n"}, {"pitch": "rest", "duration": "4n"},
        # bar 3: Cmaj7 (beat1 = E, the 3rd)
        {"pitch": "E4", "duration": "4n"}, {"pitch": "G4", "duration": "8n"},
        {"pitch": "C5", "duration": "8n"}, {"pitch": "E5", "duration": "4n"}, {"pitch": "rest", "duration": "4n"},
        # bar 4: resolve to C
        {"pitch": "G4", "duration": "8n"}, {"pitch": "E4", "duration": "8n"},
        {"pitch": "D4", "duration": "8n"}, {"pitch": "G4", "duration": "8n"},
        {"pitch": "C4", "duration": "2n"},
    ],
}


def total_beats(notes):
    from scorer import DUR_BEATS
    return sum(DUR_BEATS.get(n["duration"], 0.5) for n in notes)


print("chord_tones / midi sanity:")
check("Dm7 tones = D F A C", chord_tones("Dm7") == {2, 5, 9, 0})
check("G7 tones = G B D F", chord_tones("G7") == {7, 11, 2, 5})
check("Cmaj7 has B (maj 7th)", 11 in chord_tones("Cmaj7"))
check("C4 midi = 60", midi("C4") == 60)

print("\ngood lick scores high:")
s = score_lick(GOOD, 4)
print(f"  composite = {s['composite']}  (fills {total_beats(GOOD['notes'])}/16 beats)")
check("duration_fits == 1.0", s["duration_fits"] == 1.0)
check("strong_ending == 1.0", s["strong_ending"] == 1.0)
check("enharmonic_sane == 1.0", s["enharmonic_sane"] == 1.0)
check("in_range == 1.0", s["in_range"] == 1.0)
check("composite >= 0.85", s["composite"] >= 0.85)

print("\ndefects are penalized:")
# Rhythm too short (only fills half the bars).
short = {**GOOD, "notes": GOOD["notes"][:8]}
check("short rhythm lowers duration_fits", score_lick(short, 4)["duration_fits"] < 0.7)

# Double-flat enharmonic.
dflat = {**GOOD, "notes": [{**GOOD["notes"][0], "pitch": "Bbb4"}] + GOOD["notes"][1:]}
check("double-flat lowers enharmonic_sane", score_lick(dflat, 4)["enharmonic_sane"] < 1.0)

# Out-of-range note.
oor = {**GOOD, "notes": [{**GOOD["notes"][0], "pitch": "C7"}] + GOOD["notes"][1:]}
check("out-of-range lowers in_range", score_lick(oor, 4)["in_range"] < 1.0)

# Weak ending (last note a short non-chord tone).
weak = {**GOOD, "notes": GOOD["notes"][:-1] + [{"pitch": "F#4", "duration": "8n"}]}
ws = score_lick({**weak, "notes": weak["notes"]}, 4)
check("weak ending lowers strong_ending", ws["strong_ending"] < 1.0)

# Empty lick.
check("empty lick parse == 0", score_lick({"notes": []}, 4)["parse"] == 0)

print()
if failures:
    print(f"{len(failures)} FAILED: {failures}")
    sys.exit(1)
print("all scorer tests passed")
