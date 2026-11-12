---
name: pip-episode
description: Make one or more episodes of "Pip's Daily NCLEX Question", the NurseQuizAI TikTok/Reels/Shorts series with the Pip mascot. Use when the user gives a scenario, topic or question and wants a Pip video, e.g. "pip episode on digoxin toxicity", "make 3 Pip videos on cardiac meds", "turn this question into a Pip video".
---

# Pip episode: scenario in, finished video out

The user gives a scenario (a topic, a clinical situation, or a full question).
Do everything else without asking: write the question, voice it, render it,
add it to the posting sheet. The only paid step is the voice line (about 1
Runway credit), and it runs exactly once per episode.

Everything lives in `marketing/mascot/daily-nclex/` (run commands from there).
`README.md` there has the full template rules; this skill is the short path.

## 1. Pick the number

Next episode = highest folder in `episodes/` + 1, zero-padded to 3 digits.
For a batch, number them in order.

## 2. Write `episodes/NNN/episode.json`

Copy the shape of an existing episode (e.g. `episodes/009/episode.json`):

```json
{
  "number": 11,
  "topic": "Short topic label",
  "voiceLine": "Short spoken question. Ends each phrase with a full stop or question mark?",
  "card": [
    { "text": "Stem line", "style": "body", "at": 0 },
    { "text": "The question?", "style": "question", "at": 1 },
    { "text": "A. Option", "style": "option", "at": 1 }
  ],
  "answer": "Letter(s). Why it's right, and why the tempting wrong ones are wrong.",
  "nurseReviewed": false
}
```

Rules. Breaking them either wastes the voice credit or gets text shrunk:

- **Question.** One NCLEX-style item. Pick the format that fits the scenario:
  single answer (4 options A–D), select-all-that-apply (5 options A–E, 2–4
  correct, and the card says "Select all that apply."), prioritization ("Who
  first?"), or a calculation with no options. Content must be standard,
  textbook-accurate nursing. If the scenario is ambiguous or clinically
  contested, pick the textbook reading and say so in your reply.
- **voiceLine.** 2–3 short sentences, 3–6 seconds spoken. Say the stem and the
  question, never the options or the answer. Every phrase that starts a card
  line ends with `.` or `?` (commas do not make a long enough pause). Write
  numbers and units the way Pip should say them ("one liter", "52"), and spell
  out abbreviations she would stumble on ("intracranial pressure", not "ICP").
- **card.** `at` is the 0-based spoken phrase at which a line appears; the
  number of phrases equals the sentences in `voiceLine`. Options share the
  question's `at`. Keep every line at 34 characters or fewer, options
  included. Abbreviations are fine on the card (ICP, HOB, SpO2, %).
- **answer.** The rationale that gets pinned as a comment the next day.
- **nurseReviewed** is always `false`. Only the user flips it.

## 3. Voice: one call, no choices

Call the Runway `generate_speech` tool with exactly:

- `text`: the `voiceLine`, verbatim
- `voice`: `"Pip"`
- `name`: `"Pip daily NCLEX NNN"`

Nothing else. No model, speed, stability or other settings; do not search or
preview voices. For a batch, send all the calls in one message.

Then `get_task` each task id and download the returned `url` with
`curl -sfL -o episodes/NNN/voice.mp3 "<url>"` (keep the query string; it is
the auth).

**Never regenerate a voice to fix timing or layout.** Both are fixed for free
in step 4. Regenerate only if the user asks, or the audio is plainly wrong
(wrong words, cut off), and say it costs another credit.

## 4. Render and fix for free

```bash
node make-episode.js episodes/NNN
```

- `only N phrases were heard`: lower the `at` values to fit the phrases the
  build printed (lines can share a phrase), then rebuild.
- `note: shrunk to fit: "..."`: shorten that line's wording, then rebuild.
- Repeat until it prints `wrote out/nursequizai-daily-nclex-NNN.mp4` with no
  shrink note.

Then Read `out/NNN-check.png`: no text may touch the red zones, and Pip's face
must stay visible.

## 5. Add it to `POSTS.md`

Append a section in the same format as the existing ones:

```
## NNN · <topic>

    Pip's Daily NCLEX Question #NNN 🩺

    Comment your answer 👇 Answer pinned tomorrow

    #nclex #nursingschool #nursingstudent #nclexprep #<topic tag> #<topic tag>

**Pin tomorrow:** <answer>
```

## 6. Hand it over

Send the MP4 with SendUserFile (`display: "render"`); for a batch, send one
and list the rest. In the reply, give the question, the answer and the
credits Runway reports remaining, and remind the user that the episode needs
nurse review before posting. Do not commit unless asked.
