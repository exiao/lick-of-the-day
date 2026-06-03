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

print("\nrobustness: malformed inputs don't crash:")
# null chords field.
check("null chords doesn't crash", score_lick({**GOOD, "chords": None}, 4)["parse"] == 1)
# null abc field doesn't crash.
check("null abc doesn't crash", score_lick({**GOOD, "abc": None}, 4)["parse"] == 1)
# chord missing bar/beat.
check("chord missing bar/beat", score_lick({**GOOD, "chords": [{"chord": "Dm7"}]}, 4)["parse"] == 1)
# note missing pitch key entirely.
nopitch = {**GOOD, "notes": [{"duration": "4n"}] + GOOD["notes"][1:]}
check("note missing pitch key", score_lick(nopitch, 4)["parse"] == 1)
# parsed-but-empty returns composite 0.0 (not None).
check("empty lick composite == 0.0", score_lick({"notes": []}, 4)["composite"] == 0.0)

print("\nextended-harmony chord tones:")
check("Fmaj9 contains its maj7 (E)", chord_tones("Fmaj9") == chord_tones("Fmaj7"))
check("Cmaj13 has maj 7th (B)", 11 in chord_tones("Cmaj13"))
check("CM9 has maj 7th (B)", 11 in chord_tones("CM9"))
check("Dm9 is a minor-7th chord (has b7 C)", chord_tones("Dm9") == chord_tones("Dm7"))
check("Am11 has minor 7th (G)", 7 in chord_tones("Am11") and chord_tones("Am11") == chord_tones("Am7"))

print("\nstrong ending excludes the 7th (prompt rule 6 = root/3rd/5th):")
from scorer import chord_triad
check("Cmaj7 triad has no B (maj7)", 11 not in chord_triad("Cmaj7"))
# Last note = B (the maj7 of Cmaj7) on a strong beat: allowed as a chord tone but
# NOT a valid strong ending per rule 6, so it should not get full 1.0 credit.
seventh_end = {**GOOD, "notes": GOOD["notes"][:-1] + [{"pitch": "B4", "duration": "2n"}]}
check("7th as final note not full strong_ending", score_lick(seventh_end, 4)["strong_ending"] < 1.0)

print("\noctave-boundary accidentals:")
check("Cb4 midi == B3 (59)", midi("Cb4") == 59)
check("B#4 midi == C5 (72)", midi("B#4") == 72)

print("\nunknown durations penalized:")
baddur = {**GOOD, "notes": [{"pitch": "C4", "duration": "7x"}] + GOOD["notes"][1:]}
check("unknown duration lowers valid_durations", score_lick(baddur, 4)["valid_durations"] < 1.0)
check("clean lick valid_durations == 1.0", score_lick(GOOD, 4)["valid_durations"] == 1.0)

print("\nstrong ending must land on beat 1 or 3:")
# Shift the final resolution so it lands on beat 4 (weak) instead of a strong beat.
# Replace bar-4 run with notes that push the long final note onto beat 4.
late = {**GOOD, "notes": GOOD["notes"][:-5] + [
    {"pitch": "G4", "duration": "4n"}, {"pitch": "E4", "duration": "4n"},
    {"pitch": "D4", "duration": "4n"}, {"pitch": "C4", "duration": "4n"},
]}
# That fills the bar but ends on a quarter at beat 4 -> not a strong landing.
le = score_lick(late, 4)
check("late (beat-4) ending not full credit", le["strong_ending"] < 1.0)

print("\nstrong beat: rest counts as a miss:")
# Put a rest on beat 1 of bar 1 (Dm7), pushing the chord tone off the strong beat.
restbeat = {**GOOD, "notes": [
    {"pitch": "rest", "duration": "4n"}, {"pitch": "F4", "duration": "8n"},
    {"pitch": "A4", "duration": "8n"}, {"pitch": "C5", "duration": "4n"},
] + GOOD["notes"][4:]}
clean_sbc = score_lick(GOOD, 4)["strong_beat_chordtones"]
rest_sbc = score_lick(restbeat, 4)["strong_beat_chordtones"]
check("rest on strong beat lowers strong_beat_chordtones", rest_sbc < clean_sbc)

# A lick scored as 4 bars but only filling 1 bar must NOT get full strong-beat
# credit: the unreached beats 1/3 count as misses, not skips.
onebar = {**GOOD, "notes": GOOD["notes"][:5]}  # ~2 beats of material
check("short lick counts unreached strong beats as misses",
      score_lick(onebar, 4)["strong_beat_chordtones"] < clean_sbc)

print("\nnote count window:")
check("good lick note_count == 1.0", score_lick(GOOD, 4)["note_count"] == 1.0)
toofew = {**GOOD, "notes": GOOD["notes"][:6]}
check("too few notes lowers note_count", score_lick(toofew, 4)["note_count"] < 1.0)
toomany = {**GOOD, "notes": GOOD["notes"] + GOOD["notes"]}  # 38 notes
check("too many notes lowers note_count", score_lick(toomany, 4)["note_count"] < 1.0)

print()
if failures:
    print(f"{len(failures)} FAILED: {failures}")
    sys.exit(1)
print("all scorer tests passed")
