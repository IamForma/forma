# Dashboard localization

The dashboard speaks two languages: English (default) and Russian. Only the interface is translated; the content of the project stays in the project language.

## What is translated

- Everything the dashboard itself draws: tabs, labels, buttons, hints, empty states, counters, status and stage names.
- Strings the server hands over as a key or a code with parameters — the browser translates them.

## What is not translated

- Card titles and card bodies, texts of checks, section names read from `project/` files, interview questions, file descriptions in the structure view.
- Server console output and CLI messages.
- API error messages: English.

## Dictionaries

`.forma/dashboard/locales/en.json` and `ru.json` — one flat object per language, the same keys in both.

- `{name}` is a substitution; plural forms use `one`, `few`, `many`, `other`.
- English is the fallback; a key found nowhere is shown as the key.
- A new language is a new `locales/<code>.json` file.

## In code

- In the browser: `t('key', {vars})`, `cnt('key', n)`; markup uses `data-i18n`, `data-i18n-ph`, `data-i18n-title`.
- Label tables are functions or getters, never constants: the language changes without a reload.
- Cyrillic in code that is data, not interface (a card field name matched against text, a language's own name), carries the mark `i18n-keep` on its line.

## The check

`locale-parity` runs with the engine check (`sync-engines --check`):

- both dictionaries hold the same keys;
- every key used in code or markup exists in the dictionaries;
- no dictionary key is unused (dynamic keys are covered by their prefix);
- no Cyrillic in `web/` outside comments and `i18n-keep` lines.

The test `.forma/dashboard/locale-parity.test.cjs` proves the check turns red on each kind of breakage and stays green on clean code.
