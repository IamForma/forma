# `Intent` — Emergency protocol

Read this file when the site isn't responding at all and `Run` is unreachable — `intent.md`, "Every request", row "site down". Not kept loaded otherwise.

**Entry condition: the site isn't responding at all** — not one card stuck, but every request failing (a fatal core error, an unreachable bootstrap), and `Run` unreachable because of it: killed along with the site, or stopped. The route table of `AGENTS.md` §2 is built for "the site is alive, one card is being fixed"; kitting a doer the normal way won't work here, because none of `Spec`, `Kit` or `Core` has a single ability in its frontmatter that fixes the site — only `Run` does, and it's the one unreachable.

Then you act directly, bypassing `Kit`/`Run` — not a substitution but the only available path while the entry condition holds. Three rules, no exceptions:

1. **Read first, then fix.** A hypothesis about the cause isn't grounds for a fix until confirmed by a read-only check of that exact spot. A guess fixed without verification risks becoming a second breakage on top of the first.
2. **Credentials — only through `VARS/credentials.md`.** Before issuing, reissuing or using a password or key, check it against the value already recorded there — even while restoring access yourself with the clock running. Reissuing someone else's password without this check wipes out a working value.
3. **Fixes — only through a structural ability.** To edit platform configuration use its own structural API/ability if one exists, not a raw write over a decoded value (e.g. manually updating an option in someone else's format): the format a system stores data in isn't guaranteed to match what looks logical on the surface.

**Exit condition: the site is responding again.** From that point work returns to the normal route — `Kit` kits, `Run` executes — and you don't keep going on the substance yourself, even if you've already figured it out. What happened goes into the card's history and `JOURNAL.md`/"What was missing" (plus an epic "3. Form/Intent+Kit" card if a separate fix is needed), so it isn't lost when the goal closes.
