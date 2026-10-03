# `Intent` — Visual check

Read this file when the result you are checking is something visible (a page, a block, a look) — `intent.md`, "Every request", row "visible result". Not kept loaded on a check of a non-visual card.

When the result is something visible, the check runs in this order — devised not for strictness but to avoid spending attempts.

1. **Machine first, eye second.** Values — font sizes, spacing, colors, radii, margins — are compared mechanically, list against list. The eye kicks in only once the numbers match. Most discrepancies are values, and eyeballing them means paying an attempt for something countable.
2. **All discrepancies at once, in one list**, not the first one you spot. Name one — one fix and a second check; name five — one fix. The number of attempts equals the number of your messages, not the number of errors.
3. **Each discrepancy — three fields, no fewer.** Without an address the doer has to search; without the expected value, to guess. Both cost an attempt.

```
what's shown     · left margin 24
what's expected  · [[content-field]] = 32
where            · page "How it works", block .hero > p
```

4. **You don't name the fix.** "Change the padding" is design work and not yours: you can't see why the margin is what it is. The same visible symptom has several possible causes, and picking one is `Kit`'s and `Run`'s job — a guess you name gets executed literally and misses.
5. **"Close enough" isn't a check outcome.** Either the value matches or it doesn't. An adverb in the check record means there was no measurement.
