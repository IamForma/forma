# Card materials

One folder per card, named by its code: `card-NNN/`. The code is the prefix of the card's filename on the board (`.devtool/features/card-NNN-<something>.md`); the card's title may change, the code never does, so the folder is never renamed.

**A folder is created only when there is something to put in it.** There are no empty ones: most cards have no materials, and a hundred and thirty empty directories are noise, not order.

---

## The boundary: what goes here, and what does not

| Here | Not here |
|---|---|
| what was **born of this card** and makes no sense outside it: an interview record, a prototype, a screenshot as evidence, a draft, an external model's output | **decisions** — they are in the five fields of `## Task` and in `## Result`, always. The card is the binding record, the folder is the ground |
| what otherwise has no home | **project materials** — design system, mockups, brief, references. They belong to the project, not to the task: the card **refers** to them |

**The folder keeps the ground, the card keeps the decision.** This is not style: a decision that moved into a nice document beside it stops being visible on the board, and a month later the card reads as if nobody had decided it (`intent.md`, "Interview on a card").

---

## The card moves, the folder stays

On closing, the card physically moves: `.devtool/features/card-NNN-x.md` → `.devtool/features/done/card-NNN-x.md` (`AGENTS.md` §7). The materials folder lies **outside the board** and does not move — so a link to it breaks neither on closing nor on reopening.

For the same reason materials are not put inside `.devtool/`: that is the kanban extension's territory, and foreign directories in it are someone else's property.

## How it is referenced

From the card — with an ordinary link in `## Result` or `## Kit`: `project/cards/card-NNN/`. There is no separate frontmatter field: the extension writes these files itself, and whether it survives an unfamiliar key is unknown.

## What the machine checks

- **a folder without a card** — left from a deleted one, or the code is mixed up;
- **a link to a nonexistent file** inside the folder;
- **a file heavier than 500 KB** — a warning, see below;
- how many materials a card has — for the summary.

These are exactly the quiet divergences that are otherwise found by accident and late.

## Heavy files — we link, we do not store

Four kinds of material, four different homes:

| Kind | Where it lives |
|---|---|
| **check evidence** — "I looked, and here" | **nowhere.** The card records the **measured fact**, as text: not a screenshot of a width but "1600 px, measured with `getBoundingClientRect()`". Text is searched, compared and understandable a year later; nobody will open the picture a year later |
| **an image read only by eye** — a reference, "before/after" | in the card's folder, **compressed**: a 500 KB ceiling per file. If it does not fit, it is not evidence but an asset, see below |
| **a generated asset** — 3D, images, video from an external provider | **at the provider**, by link: it already lies there and has a permanent address. A copy in the project is a second instance of the same, with all the consequences |
| **video** | never in git. Video is shown to the human once; the card gets a text description of the steps |

**A link must be recoverable.** A path to a file on disk is not a link: on another machine it does not exist. Next to a heavy material goes a text line — what it is, where it came from, at which address to fetch it again. Without it "we link" is not a decision but a hope.
