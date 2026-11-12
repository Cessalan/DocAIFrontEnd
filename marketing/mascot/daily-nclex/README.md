# Pip's Daily NCLEX Question

A reusable template for the series. One episode costs about 1 Runway credit
(the voice line). Everything else is made once and reused from `assets/`.

## What's reused (made once, don't regenerate)

| File | What | Cost when made |
|---|---|---|
| `assets/loop.mp4` | Pip at the desk, 5s seamless loop, 1080x1920, no audio | 60 credits |
| `assets/pip-desk.png` | The still the loop was made from (start/end frame) | 6 credits |
| `assets/music-bed.mp3` | Soft lo-fi bed, ~31s, looped under the voice | 4 credits |
| `assets/outfit-600.ttf`, `outfit-800.ttf` | Brand font (Outfit), from Fontsource | free |
| `assets/logo.png` | Coral heart matching `src/assets/favicon.svg` | free |

Pip's voice is the Runway preset **"Pip"** on the default speech model. Always
use that voice so the character sounds the same in every episode.

## Making a new episode

Shortcut: ask Claude Code for `/pip-episode <scenario>` (for example
`/pip-episode digoxin toxicity signs`). The skill in
`.claude/skills/pip-episode/` does every step below, voices each episode
once with Pip, and adds the episode to `POSTS.md`. The manual steps:

1. Copy `episodes/002/episode.json` to `episodes/<number>/episode.json` and edit it:
   - `voiceLine`: what Pip says. Keep it to the question, not the answer choices
     (3-6s is ideal). End each phrase that starts a card line with `.` or `?`
     so there is a pause the script can find (commas are too short).
   - `card`: the lines on screen, top to bottom. Styles: `intro`, `body`,
     `question`, `option`, `cta`. `at` is the spoken phrase (0-based) at which
     the line fades in. Several lines can share one phrase.
   - `answer`: the rationale to pin as a comment the next day.
   - `nurseReviewed`: flip to `true` only after the nurse signs off.
2. Generate the voice in Runway with voice "Pip" and the exact `voiceLine`,
   and save it as `episodes/<number>/voice.mp3`. (Ask Claude: "generate the voice for
   episode 004".)
3. Build:
   ```bash
   node make-episode.js episodes/004
   ```
   It prints the phrases it heard, writes `out/nursequizai-daily-nclex-004.mp4`
   and `out/004-check.png` (the full card with the TikTok/Reels/Shorts UI zones
   shaded red: no text should touch red).

If the voice has fewer pauses than the card's `at` values need, the build stops
and prints what it heard instead of guessing.

## Layout rules the script enforces

- Text stays inside x 120-960 and y 230-1050, clear of the top bar, the bottom
  caption area and the right button column on all three platforms.
- Long cards shrink together to fit and may cover the top of Pip's heart, never
  the face. It prints a note when it had to shrink a line a lot; shorten the
  wording rather than accept tiny text.
- Captions fade in 0.05s before Pip says the phrase; lines on the first phrase
  are on screen from frame 1 (the feed thumbnail).
- No full-screen end card: the clip loops, and its length is rounded up to a
  whole number of Pip cycles (~5s each) so the replay has no jump. Branding is
  the small `nursequizai.com` at the foot of the card. Add `"endCard": true` to
  an episode.json for the occasional episode that should end on the logo.

## When posting

- Add a trending sound in the TikTok/Instagram app at low volume under Pip;
  licensed sounds can't be baked into the file.
- Caption: `Comment your answer 👇 Answer pinned tomorrow`.
- Pin `answer` from episode.json the next day.

## Requirements

Node 20 and ffmpeg (installed with `winget install Gyan.FFmpeg`). The script
finds the winget copy itself; set `FFMPEG_DIR` to use another one.
