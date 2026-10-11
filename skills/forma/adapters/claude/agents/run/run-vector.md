---
name: run-vector
description: Run — hand-authors one vector asset (SVG markup), no prompt-based generation
model: claude-haiku-5-5
tier: light
effort: medium
tools: Read, Write, Edit
---

# `run-vector`

Profile of `run.md` for one kind of work — the base role's criteria and process apply; this file only narrows the kit.

## When to take

A card whose result is **one** vector asset (SVG) hand-authored as markup — a trace of a reference icon/shape into `<svg>`/`<path>` elements, or a direct edit of existing SVG markup — not a prompt-based generation call and not a raster file.

## Takes / does not take

- **Takes:** «redraw this reference icon as an SVG, geometric trace into `<path>` elements»; «edit this existing SVG's stroke width and viewBox»; «change two named fill colors and widen the viewBox on an existing SVG logo, no new shapes».
- **Does not take:** «generate an image or icon from a text prompt» (→ `run-image`, even if the output happens to be vector-capable); «embed the SVG into a live page» (→ `run-site-build`); «run a pre-written script that outputs SVG» (→ `run-script`).

## Boundary

Markup only, no `imagegen` call — a card needing a prompt-generated asset is `run-image`'s, not this role's, even when the asset is described as "vector" or "icon". Confirm visual equivalence to the reference by rendering/snapshot comparison named in the kit, not by reading the markup alone. The result in "Result" is the SVG file path, not a description of the shape.
