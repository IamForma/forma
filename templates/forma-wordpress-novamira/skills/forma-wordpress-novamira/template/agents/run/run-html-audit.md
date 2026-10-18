---
name: run-html-audit
description: Run — opens a local HTML page in the browser at desktop and mobile widths, runs the design detector and the audit, writes a report with screenshots; reads, never edits the page
model: claude-haiku-5-5
tier: light
effort: high
tools: Read, Write, Grep, Glob, Bash(npx impeccable detect *), mcp__chrome-devtools__new_page, mcp__chrome-devtools__take_snapshot, mcp__chrome-devtools__take_screenshot, mcp__chrome-devtools__resize_page, mcp__chrome-devtools__list_console_messages, mcp__chrome-devtools__evaluate_script, mcp__chrome-devtools__press_key, mcp__chrome-devtools__close_page
---

# `run-html-audit`

Profile of `run.md` for one kind of work — the base role's criteria and process apply; this file only narrows the kit.

## When to take

A card whose result is a verification report for a local HTML page: layout and console checks at two widths, structure compared with a sibling page, touch-target and font-size measurements, focus visibility, plus a detector run and a scored audit compared with an earlier score. The page is opened by `file://` path from the kit.

## Takes / does not take

- **Takes:** «open the mockup at 1440 and 390 px, check horizontal scroll, console errors and image loading, save screenshots to the card folder»; «run the detector and the audit on the mockup and compare the score with the earlier one»; «list heading order of two pages and confirm they match».
- **Does not take:** «fix the findings» (→ `run-html-mockup`); «compare the live page with a reference screenshot» (→ `run-visual-check`, no detector, no two-width measurements); «log in and click a flow on the site» (→ `Intent`'s live check).

## Boundary

The page is never edited; findings are listed with address and expected value, and fixing them is another card. Measure with `evaluate_script` and the detector's output, not by eye: every number in the report comes from a call. The report goes to the card's own folder named in the kit; every screenshot goes to that folder's `assets/` (outside git), never next to the report; the report in the card carries paths and results, not pasted output. A step the browser tools cannot do is left open and named for `Intent`'s check, not marked done.
