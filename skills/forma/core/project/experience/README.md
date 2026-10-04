# Experience — what turned out in practice

A store of findings worth reusing. **One file per subject**, the filename is the word by which the finding will be searched.

## Who writes, and when

`Run` and `Kit` — **at the moment of the finding**, not as a summary at a goal's closing. Experience arriving a circle later is usually already outdated.

They write **only when the way was non-obvious or cost attempts**: a gotcha, an environment limit, what did not work and why. A log of everything is a log of nothing.

## Who reads, and when

`Kit` before kitting (`kit.md`, "Four checks") and `Run` before starting work — **by grepping the card's subject, not the whole file and not the whole directory**. This is deliberate: the store may grow as much as it likes, the price of reading stays the same. A store that is read whole punishes the system for learning.

## Format

```markdown
# <subject, as it will be searched>

The finding in one or two sentences: what does not work, what works instead.
YYYY-MM-DD · source: .devtool/features/done/<card>.md

## Used by
- .devtool/features/<card>.md
```

**The subject already has a file — append a line to it, do not start a second one.** And enter your card in "Used by": that list is how two nodes working on one subject in parallel find each other. A grep over the board cannot do that: it matches by words, and each node invents its own words.

## Promotion to a contract

A line that has been used and confirmed moves to `project/config/CONFIG.md`, "Technical contracts of the environment", as a contract with an anchor — roles refer to such anchors. `Kit` does it in passing, at the moment of use; not as a separate pass.

## Weeding

Diverged keys (one subject recorded twice under different names) and contradicting records — a card of epic "8. Experience/Intent+Kit". On the fact of disorder, not as a ritual for every goal.
