"""loco-pipeline.py — перевод ru_RU.po плагинов в wp-content/languages/loco/plugins/ одним прогоном (договор run-scripts).

  python .claude/scripts/loco-pipeline.py --domains fluent-roadmap[,..] --work <папка> --report <путь.json> [--dry-run] [--write] [--llm]

Этапы по каждому домену: fetch (чтение .po с сайта) → pot (шаблон Loco с сайта, слияние polib локально) →
translate (tokenator_translator.py) → check (po_shift_check.py, блоков сдвига 0) → upload + compile (Loco writeAll) → verify (главная 200).
Сайт только читается, пока нет --write. --dry-run: работа в <work>/dry-run/, Tokenator в режиме подсчёта, на сайт ничего.
Консоль: одна строка JSON. Коды: 0 все готовы · 1 остались пустые/сдвиги (повторный запуск продолжит) · 2 стоп.
"""
import argparse, base64, json, os, pathlib, subprocess, sys, tempfile, urllib.request

import polib

sys.stdout.reconfigure(encoding="utf-8")
HERE = pathlib.Path(__file__).resolve().parent
def _site_slug():
    if os.environ.get("SITE_SLUG"):
        return os.environ["SITE_SLUG"].strip()
    env = HERE.parent.parent / ".env"
    if env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith("SITE_SLUG="):
                return line.split("=", 1)[1].strip().strip("'\"")
    return ""


SITE = _site_slug()
REMOTE_DIR = "wp-content/languages/loco/plugins"


def php(code, site):
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as fh:
        json.dump({"code": code}, fh)
        tmp = fh.name
    try:
        r = subprocess.run(["novamira", "--site", site, "--json", "--yes", "--max-output", "10485760", "--timeout", "60000",
                            "run", "novamira/execute-php", "--input", "@" + tmp],
                           capture_output=True, text=True, encoding="utf-8", shell=os.name == "nt")
    finally:
        os.unlink(tmp)
    try:
        out = json.loads(r.stdout)
    except ValueError:
        raise RuntimeError("cli: " + (r.stderr or r.stdout)[:500])
    d = out.get("data") or {}
    if not out.get("ok") or d.get("success") is False:
        raise RuntimeError(json.dumps(out.get("error") or d.get("error_message"), ensure_ascii=False)[:500])
    return d.get("return_value")


PLUGIN = "$pf=null; foreach(get_plugins() as $f=>$h){ if(($h['TextDomain']??'')==='%s') $pf=$f; } if(!$pf) return ['error'=>'no plugin'];"


def fetch(dom, site):
    return php("$p=WP_LANG_DIR.'/loco/plugins/%s-ru_RU.po'; return file_exists($p)?base64_encode(file_get_contents($p)):null;" % dom, site)


def pot(dom, site):
    return php(PLUGIN % dom + " $b=Loco_package_Plugin::create($pf); $pr=$b->getDefaultProject(); $e=new Loco_gettext_Extraction($b);"
               " $e->addProject($pr); return base64_encode($e->includeMeta()->getTemplate($pr->getDomain()->getName())->msgcat());", site)


def compile_(dom, site):
    return php(PLUGIN % dom + " $f=new Loco_fs_File(WP_LANG_DIR.'/loco/plugins/%s-ru_RU.po'); $po=Loco_gettext_Data::load($f);"
               " $c=new Loco_gettext_Compiler($f); $c->writeAll($po, Loco_package_Plugin::create($pf)->getDefaultProject());"
               " $m=substr((string)$f,0,-3).'.mo'; return ['mo'=>file_exists($m)?filesize($m):0,'err'=>error_get_last()];" % dom, site)


def empties(path):
    po = polib.pofile(str(path))
    return sum(1 for e in po if not e.obsolete and e.msgid and not (e.msgstr or any(e.msgstr_plural.values()))), len(po)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--domains", required=True)
    ap.add_argument("--work", required=True)
    ap.add_argument("--report", required=True)
    ap.add_argument("--site", default=SITE)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--llm", action="store_true", help="проверка сдвигов моделью (платно)")
    a = ap.parse_args()
    work = pathlib.Path(a.work) / ("dry-run" if a.dry_run else "")
    new, done_dir = work / "new", work / "completed"
    new.mkdir(parents=True, exist_ok=True); done_dir.mkdir(parents=True, exist_ok=True)
    details, done, left, fatal = [], 0, 0, False
    for dom in [d.strip() for d in a.domains.split(",") if d.strip()]:
        rec = {"domain": dom}
        name = f"{dom}-ru_RU.po"
        try:
            raw = fetch(dom, a.site)
            rec["remote_bytes"] = len(base64.b64decode(raw)) if raw else 0
            src = done_dir / name if (done_dir / name).exists() else new / name
            t = pot(dom, a.site)
            if isinstance(t, dict):
                raise RuntimeError(t.get("error"))
            tpl = polib.pofile(base64.b64decode(t).decode("utf-8"))
            po = polib.pofile(base64.b64decode(raw).decode("utf-8")) if raw else polib.POFile()
            if not raw:
                po.metadata = dict(tpl.metadata, Language="ru_RU",
                                   **{"Plural-Forms": "nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2);"})
            before = len(po)
            po.merge(tpl)
            rec.update(pot_entries=len(tpl), before=before, after=len(po))
            for p in (new / name, done_dir / name):
                if p.exists():
                    p.unlink()
            po.save(str(new / name))
            rec["empty_before"], rec["total"] = empties(new / name)
            tr = subprocess.run([sys.executable, str(HERE / "tokenator_translator.py"), "--dir", str(work)] + (["--dry-run"] if a.dry_run else []),
                                capture_output=True, text=True, encoding="utf-8")
            rec["translate_exit"] = tr.returncode
            rec["translate_tail"] = tr.stdout.strip().splitlines()[-2:]
            src = done_dir / name if (done_dir / name).exists() else new / name
            rec["empty_after"], _ = empties(src)
            sc = subprocess.run([sys.executable, str(HERE / "po_shift_check.py"), str(src)] + (["--llm"] if a.llm else []),
                                capture_output=True, text=True, encoding="utf-8")
            sr = json.loads((src.parent / "shift-report.json").read_text(encoding="utf-8"))[0]
            rec["shift_blocks"], rec["suspicious"] = len(sr["blocks"]), len(sr["suspicious"])
            ready = rec["empty_after"] == 0 and rec["shift_blocks"] == 0
            if a.write and not a.dry_run and ready:
                up = subprocess.run(["novamira", "--site", a.site, "--json", "--yes", "upload", str(src), f"{REMOTE_DIR}/{name}"],
                                    capture_output=True, text=True, encoding="utf-8", shell=os.name == "nt")
                rec["upload"] = up.stdout.strip()[:300]
                rec["compile"] = compile_(dom, a.site)
            else:
                rec["site_write"] = "skipped: " + ("dry-run" if a.dry_run else "no --write" if not a.write else "not ready")
            done += ready
            left += not ready
        except Exception as ex:  # noqa: BLE001
            rec["fatal"] = str(ex)[:500]
            fatal = True
        details.append(rec)
    try:
        rec_home = urllib.request.urlopen(f"https://{a.site}/", timeout=30).status
    except Exception as ex:  # noqa: BLE001
        rec_home = str(ex)[:200]
    details.append({"verify_home": rec_home})
    pathlib.Path(a.report).parent.mkdir(parents=True, exist_ok=True)
    pathlib.Path(a.report).write_text(json.dumps(details, ensure_ascii=False, indent=1), encoding="utf-8")
    status = "stop" if fatal or rec_home != 200 else ("work" if left else "ok")
    print(json.dumps({"status": status, "done": done, "left": left, "report": a.report, "dry_run": a.dry_run, "write": a.write}))
    sys.exit({"ok": 0, "work": 1, "stop": 2}[status])


if __name__ == "__main__":
    main()
