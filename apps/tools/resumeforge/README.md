# ResumeForge

A dependency-free agentic **resume helper**: paste a rough note about something
you did and it rewrites it into **action-first, quantified, results-oriented**
resume bullets, plus the skill keywords to add to your skills section. Runs
entirely in the browser — nothing is sent anywhere.

## What it does

- Detects your domain (social media / support / engineering / sales / ops /
  general) from the note's vocabulary.
- Rewrites your note into strong bullets using action verbs appropriate to your
  chosen focus (**Impact**, **Effort**, or **Leadership**).
- Auto-suggests concrete, honest-style metrics where you left the outcome vague
  (e.g. "cut delivery time by 20%") — always edit numbers to match reality.
- Surfaces the skill keywords a recruiter/ATS would look for.
- Includes 5 one-click templates (social, support, engineering, sales, ops).

## Run it

Open `index.html` in any browser (or host it on a static server / Pages). No
build step, no dependencies.

## Try it

```bash
node -e "console.log(JSON.stringify(require('./resume-engine.js').forgeBullets('managed twitter and ran ads, worked with marketing','impact'),null,2))"
```

## Files

- `index.html` — UI + invocation
- `resume-engine.js` — pure engine (also `module.exports` for headless testing)
- `README.md` — this file

## Verified

Engine stress-tested in node across all templates × all three focuses plus
empty input — no errors, sensible output (see build log).
