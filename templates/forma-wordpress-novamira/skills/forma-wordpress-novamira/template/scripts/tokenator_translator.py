"""Автоперевод .po (en → ru) через Tokenator (OpenAI-совместимый API).

Запуск:
  python .claude/scripts/tokenator_translator.py [--dir <папка с new/ и completed/>] [--model ...] [--batch 50] [--dry-run]

Берёт *.po из <dir>/new, переводит пустые msgstr, сохраняет после каждого пакета,
полностью переведённый файл переносит в <dir>/completed. Перевод, в котором плейсхолдеры
или HTML-теги не совпали с оригиналом, отбрасывается и уходит на повтор; не прошедший
и повтор остаётся пустым. Расход (токены, время) пишется в <dir>/usage.json.
Ключ — TOKENATOR_API_KEY (.env), адрес — TOKENATOR_ENDP (.env).
"""
import argparse
import json
import os
import re
import shutil
import sys
import time

import polib
from dotenv import load_dotenv
from openai import OpenAI

sys.stdout.reconfigure(encoding="utf-8")  # консоль Windows иначе печатает кириллицу кракозябрами

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
load_dotenv(os.path.join(ROOT, ".env"))

API_KEY = os.getenv("TOKENATOR_API_KEY")
BASE_URL = os.getenv("TOKENATOR_ENDP", "https://api.tokenator.top/v1")
if not API_KEY:
    raise SystemExit("Нет TOKENATOR_API_KEY в .env")

# Не переводятся: имена продуктов и брендов (дополняется по мере встречи).
KEEP = ["BetterDocs", "WordPress", "Fluent", "FluentCRM", "Novamira", "WooCommerce", "Elementor", "Gutenberg"]

PH_RE = re.compile(r"%(?:\d+\$)?[-+ 0#']*\d*(?:\.\d+)?[bcdeEfFgGosuxX%]|\{\{?\s*[\w.]+\s*\}?\}|\{\d+\}")
TAG_RE = re.compile(r"</?[a-zA-Z][^>]*>")

usage = {"prompt_tokens": 0, "completion_tokens": 0, "requests": 0, "seconds": 0.0}


def signature(text):
    """Плейсхолдеры и имена тегов — должны совпасть у оригинала и перевода."""
    tags = sorted(re.sub(r"\s.*", "", t.strip("</>")).lower() for t in TAG_RE.findall(text))
    return sorted(PH_RE.findall(text)), tags


def valid(src, dst):
    return bool(dst and dst.strip()) and signature(src) == signature(dst)


def ask(client, model, items, nplurals):
    system = (
        "You are a professional software UI translator, English to Russian. "
        "Preserve exactly every placeholder (%s, %1$d, %%, {name}, {{var}}) and every HTML tag with its attributes. "
        f"Do not translate these names: {', '.join(KEEP)}. "
        "Keep UI tone concise and neutral. Output ONLY valid JSON."
    )
    user = (
        "Translate the items to Russian. Items may carry 'context' (msgctxt) and 'note' (developer comment) — use them, do not translate them.\n"
        "For 'singular' items return {\"id\": <id>, \"translation\": \"...\"}.\n"
        f"For 'plural' items return {{\"id\": <id>, \"translation_plural\": [ ... ]}} with EXACTLY {nplurals} strings by Russian plural rules: "
        "0 — ends in 1 except 11 (1 файл), 1 — ends in 2–4 except 12–14 (2 файла), 2 — the rest (5 файлов).\n"
        "Respond with {\"translations\": [...]}, one object per input id.\n\n"
        f"Input:\n{json.dumps(items, ensure_ascii=False)}"
    )
    for attempt in range(3):
        try:
            t0 = time.time()
            r = client.chat.completions.create(
                model=model,
                messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
                response_format={"type": "json_object"},
                temperature=0.1,
            )
            usage["seconds"] += time.time() - t0
            usage["requests"] += 1
            if r.usage:
                usage["prompt_tokens"] += r.usage.prompt_tokens or 0
                usage["completion_tokens"] += r.usage.completion_tokens or 0
            out = json.loads(r.choices[0].message.content).get("translations", [])
            return {o["id"]: o for o in out if isinstance(o, dict) and "id" in o}
        except Exception as e:  # сеть, лимит, битый JSON — повтор с паузой
            print(f"  ошибка API (попытка {attempt + 1}): {e}")
            time.sleep(2 * (attempt + 1))
    return {}


def needs(e, nplurals):
    if e.obsolete or not e.msgid.strip() or "fuzzy" in e.flags:
        return False
    if e.msgid_plural:
        return any(not e.msgstr_plural.get(i) for i in range(nplurals))
    return not e.msgstr


def apply(e, res, nplurals):
    if e.msgid_plural:
        forms = res.get("translation_plural") or []
        if len(forms) < nplurals:
            return False
        # форма «1» часто берёт плейсхолдеры множественного оригинала — годится совпадение с любым из двух
        if not all(valid(e.msgid, str(forms[i])) or valid(e.msgid_plural, str(forms[i])) for i in range(nplurals)):
            return False
        e.msgstr_plural = {i: str(forms[i]) for i in range(nplurals)}
        return True
    t = str(res.get("translation", ""))
    if not valid(e.msgid, t):
        return False
    e.msgstr = t
    return True


def item(i, e):
    it = {"id": i, "type": "plural" if e.msgid_plural else "singular"}
    if e.msgid_plural:
        it.update(text_singular=e.msgid, text_plural=e.msgid_plural)
    else:
        it["text"] = e.msgid
    if e.msgctxt:
        it["context"] = e.msgctxt
    if e.comment:
        it["note"] = e.comment
    return it


def process(client, args, path):
    po = polib.pofile(path)
    m = re.search(r"nplurals\s*=\s*(\d+)", po.metadata.get("Plural-Forms", ""))
    nplurals = int(m.group(1)) if m else 3
    todo = [e for e in po if needs(e, nplurals)]
    # Строки без букв (числа, символы, одиночные плейсхолдеры) переводить незачем — копируются как есть.
    for e in [e for e in todo if not e.msgid_plural and not re.search(r"[A-Za-z]{2,}", PH_RE.sub("", TAG_RE.sub("", e.msgid)))]:
        e.msgstr = e.msgid
        todo.remove(e)
    print(f"\n== {os.path.basename(path)}: к переводу {len(todo)}")
    if args.dry_run or not todo:
        if not args.dry_run:
            po.save(path)
        return not todo

    for rnd in range(2):  # второй круг — только отброшенные проверкой
        pending = [e for e in po if needs(e, nplurals)]
        if not pending:
            break
        for s in range(0, len(pending), args.batch):
            chunk = pending[s:s + args.batch]
            res = ask(client, args.model, [item(i, e) for i, e in enumerate(chunk)], nplurals)
            ok = sum(apply(e, res[i], nplurals) for i, e in enumerate(chunk) if i in res)
            po.save(path)
            print(f"  круг {rnd + 1}, пакет {s // args.batch + 1}: принято {ok}/{len(chunk)}")
    left = sum(needs(e, nplurals) for e in po)
    if left:
        print(f"  осталось пустых: {left} — файл остаётся в new/")
    return left == 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default=os.getcwd(), help="папка с new/ и completed/")
    ap.add_argument("--model", default="gemini-3.1-flash-lite")
    ap.add_argument("--batch", type=int, default=50)
    ap.add_argument("--dry-run", action="store_true", help="только посчитать пустые строки")
    args = ap.parse_args()

    new, done = os.path.join(args.dir, "new"), os.path.join(args.dir, "completed")
    os.makedirs(new, exist_ok=True)
    os.makedirs(done, exist_ok=True)
    client = OpenAI(api_key=API_KEY, base_url=BASE_URL)

    files = sorted(f for f in os.listdir(new) if f.endswith(".po"))
    if not files:
        print(f"Папка {new} пуста.")
        return 0
    incomplete = []
    for f in files:
        p = os.path.join(new, f)
        if process(client, args, p):
            if not args.dry_run:
                shutil.move(p, os.path.join(done, f))
        else:
            incomplete.append(f)

    usage["seconds"] = round(usage["seconds"])
    usage["model"] = args.model
    if not args.dry_run:
        with open(os.path.join(args.dir, "usage.json"), "w", encoding="utf-8") as fh:
            json.dump(usage, fh, ensure_ascii=False, indent=2)
    print(f"\nРасход: {usage}")
    if incomplete:
        print("Не доведены:", ", ".join(incomplete))
    return 1 if incomplete else 0


if __name__ == "__main__":
    sys.exit(main())
