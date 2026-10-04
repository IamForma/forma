# Mockups

Here a reference is refined to the state in which it can be dressed onto a real build.

## Two states, and they must not be confused

**While being refined — it is work.** It goes by goals and tasks like everything else: it has a result image, a criterion, a check. Not "I'll fix it along the way".

**Fixed as a version — it is a reference.** From that moment the mockup is not edited: a link to its item enters the readiness criterion of every page, and a change is an event with a record in `JOURNAL.md`.

The transition between states is a moment that must be named aloud. Until it is named, work and measure are mixed, and the drift is invisible.

## What lies here

```
mockups/
  <page>/
    v1/                 export from the tool: files, screenshots
    tokens.md           values: fonts, sizes, spacings, colors, radii
    notes.md            what was refined and why
```

Values from `tokens.md` are carried into `VARS/` and live only there afterwards — cards refer `[[name]]`, they do not carry numbers.

## When reality objects

The environment does not give what is drawn — the mockup is **not edited silently**. It is a reference, and a reference changes by version.

1. `Spec` stopped and reported to the human: which value is unattainable, what is available instead.
2. The decision is an event with a record in `JOURNAL.md`.
3. The mockup gets `v2`. `v1` stays: pages were made by it, and it must be known which.
4. In the composition reference, pages checked against `v1` are marked. They are fixed by tooling tasks of the next circle.

A silent edit of a mockup is the most expensive thing that can be done here: the measure slides along with the work, and the divergence stops being visible.

## What the finished is compared with

| What | How | Tolerance |
|---|---|---|
| values | list against list | exact match |
| geometry | overlay of screenshots at three widths | name it in pixels |
| impression | show side by side to two people | they cannot tell apart |
