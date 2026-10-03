"""Поиск съехавших переводов в .po (перевод стоит не у своей строки).

Запуск:
  python .claude/scripts/po_shift_check.py <файл.po | папка> [--llm] [--model ...] [--batch 40]

Два слоя:
  1. Без модели, бесплатно — у каждой пары (msgid, msgstr) сравниваются «отпечатки»:
     плейсхолдеры, HTML-теги, числа, URL, длина. Несовпадение, которое у соседней строки
     (i±1..3) совпадает — признак сдвига. Серия подряд идущих сдвигов = съехавший блок.
  2. --llm — модель (Tokenator) судит каждую пару: перевод соответствует оригиналу или нет;
     если нет — какой из соседних оригиналов он переводит. Ловит сдвиг и там, где отпечатков нет
     (короткие строки без %s и тегов).
Отчёт: <папка>/shift-report.json и сводка в консоль. Файлы не меняются.
"""
import argparse
import json
import os
import re
import sys

import polib

sys.stdout.reconfigure(encoding="utf-8")

PH_RE = re.compile(r"%(?:\d+\$)?[-+ 0#']*\d*(?:\.\d+)?[bcdeEfFgGosuxX]|\{\{?\s*[\w.]+\s*\}?\}|\{\d+\}")
TAG_RE = re.compile(r"</?([a-zA-Z][\w-]*)")
NUM_RE = re.compile(r"\d+")
URL_RE = re.compile(r"https?://\S+|[\w.-]+@[\w.-]+")
NEIGHBORS = 3


def text_of(e):
    if e.msgid_plural:
        return e.msgid, (e.msgstr_plural.get(0) or e.msgstr_plural.get("0") or "")
    return e.msgid, e.msgstr


def fp(s):
    return (tuple(sorted(PH_RE.findall(s))), tuple(sorted(t.lower() for t in TAG_RE.findall(s))),
            tuple(sorted(NUM_RE.findall(PH_RE.sub("", s)))), tuple(sorted(URL_RE.findall(s))))


def informative(f):
    return any(f)


def length_odd(src, dst):
    a, b = len(src), len(dst)
    return a >= 12 and (b > a * 3.5 or b < a * 0.3)


def heuristic(entries):
    rows = []
    fps = [fp(text_of(e)[0]) for e in entries]
    for i, e in enumerate(entries):
        src, dst = text_of(e)
        f_src, f_dst = fps[i], fp(dst)
        mism = f_src != f_dst and (informative(f_src) or informative(f_dst))
        odd = length_odd(src, dst)
        if not (mism or odd):
            continue
        match = None
        if mism and informative(f_dst):
            for d in range(1, NEIGHBORS + 1):
                for j in (i - d, i + d):
                    if 0 <= j < len(entries) and fps[j] == f_dst and fps[j] != f_src:
                        match = j - i
                        break
                if match:
                    break
        rows.append({"i": i, "line": e.linenum, "msgid": src[:120], "msgstr": dst[:120],
                     "reason": "fingerprint" if mism else "length", "neighbor_offset": match})
    return rows


def llm(entries, model, batch):
    from dotenv import load_dotenv
    from openai import OpenAI
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    load_dotenv(os.path.join(root, ".env"))
    client = OpenAI(api_key=os.getenv("TOKENATOR_API_KEY"), base_url=os.getenv("TOKENATOR_ENDP", "https://api.tokenator.top/v1"))
    usage = [0, 0]
    bad = []
    for s in range(0, len(entries), batch):
        chunk = entries[s:s + batch]
        items = [{"id": s + k, "en": text_of(e)[0], "ru": text_of(e)[1]} for k, e in enumerate(chunk)]
        prompt = (
            "Each item is an English UI string and its Russian translation, in file order. "
            "Judge whether 'ru' translates 'en'. Loose wording is fine; wrong meaning is not. "
            "If it does not, check whether it translates the 'en' of a nearby item (up to 3 before or after) and give that item's id.\n"
            "Respond with JSON {\"bad\": [{\"id\": <id>, \"translates_id\": <id or null>}]} listing ONLY mismatched items.\n\n"
            + json.dumps(items, ensure_ascii=False))
        try:
            r = client.chat.completions.create(model=model, temperature=0,
                                               response_format={"type": "json_object"},
                                               messages=[{"role": "user", "content": prompt}])
            if r.usage:
                usage[0] += r.usage.prompt_tokens or 0
                usage[1] += r.usage.completion_tokens or 0
            raw = r.choices[0].message.content or ""
            m = re.search(r"\{.*\}", raw, re.S)  # модель иногда оборачивает JSON в ```json … ```
            for b in json.loads(m.group(0) if m else raw).get("bad", []):
                i = b.get("id")
                if isinstance(i, int) and 0 <= i < len(entries):
                    t = b.get("translates_id")
                    src, dst = text_of(entries[i])
                    bad.append({"i": i, "line": entries[i].linenum, "msgid": src[:120], "msgstr": dst[:120],
                                "reason": "llm", "neighbor_offset": (t - i) if isinstance(t, int) and t != i else None})
        except Exception as ex:
            print(f"  ошибка API на пакете {s // batch + 1}: {ex}")
    return bad, usage


def runs(rows):
    """Серии соседних строк со сдвигом на одно и то же смещение — съехавшие блоки."""
    out, cur = [], []
    for r in sorted((r for r in rows if r["neighbor_offset"]), key=lambda r: r["i"]):
        if cur and r["i"] - cur[-1]["i"] <= 2 and r["neighbor_offset"] == cur[-1]["neighbor_offset"]:
            cur.append(r)
        else:
            if len(cur) >= 2:
                out.append(cur)
            cur = [r]
    if len(cur) >= 2:
        out.append(cur)
    return [{"from_line": c[0]["line"], "to_line": c[-1]["line"], "offset": c[0]["neighbor_offset"], "count": len(c)} for c in out]


def check(path, args):
    po = polib.pofile(path)
    entries = [e for e in po if not e.obsolete and e.msgid and (e.msgstr or any(e.msgstr_plural.values()))]
    rows = heuristic(entries)
    usage = None
    if args.llm:
        bad, usage = llm(entries, args.model, args.batch)
        seen = {r["i"] for r in rows}
        for b in bad:
            if b["i"] in seen:
                next(r for r in rows if r["i"] == b["i"])["reason"] += "+llm"
            else:
                rows.append(b)
    rows.sort(key=lambda r: r["i"])
    blocks = runs(rows)
    shifted = sum(1 for r in rows if r["neighbor_offset"])
    print(f"{os.path.basename(path)}: переводов {len(entries)}, подозрительных {len(rows)}, со сдвигом {shifted}, блоков {len(blocks)}"
          + (f", токены {usage[0]}+{usage[1]}" if usage else ""))
    for b in blocks:
        print(f"   блок: строки {b['from_line']}–{b['to_line']}, смещение {b['offset']:+d}, пар {b['count']}")
    return {"file": os.path.basename(path), "translated": len(entries), "suspicious": rows, "blocks": blocks, "tokens": usage}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("path")
    ap.add_argument("--llm", action="store_true")
    ap.add_argument("--model", default="gemini-3.1-flash-lite")
    ap.add_argument("--batch", type=int, default=40)
    args = ap.parse_args()
    files = [args.path] if os.path.isfile(args.path) else sorted(
        os.path.join(args.path, f) for f in os.listdir(args.path) if f.endswith(".po"))
    report = [check(f, args) for f in files]
    out_dir = args.path if os.path.isdir(args.path) else os.path.dirname(os.path.abspath(args.path))
    with open(os.path.join(out_dir, "shift-report.json"), "w", encoding="utf-8") as fh:
        json.dump(report, fh, ensure_ascii=False, indent=2)
    print(f"\nОтчёт: {os.path.join(out_dir, 'shift-report.json')}")


if __name__ == "__main__":
    main()
