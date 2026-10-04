// Целостность установки: установщик пишет опись, `verify-install` сверяет её с диском.
// Чистая установка (en и ru) — зелёная; каждое нарушение называется по адресу, с ожидаемым и найденным.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const FORMA = path.resolve(__dirname, '..', 'bin', 'forma.cjs');
const tmps = [];

const tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'forma-verify-')); tmps.push(d); return d; };
function install(lang, dir = tmp()) {
  const r = spawnSync(process.execPath, [FORMA, 'init', '--dir', dir, '--engines', 'claude', '--board', 'skip', '--lang', lang, '--yes'], { encoding: 'utf8' });
  return { dir, r };
}
const verify = (dir) => {
  const r = spawnSync(process.execPath, [path.join(dir, '.forma', 'verify', 'verify-install.cjs'), '--root', dir], { encoding: 'utf8' });
  return { status: r.status, out: r.stdout + r.stderr };
};
const read = (dir, rel) => fs.readFileSync(path.join(dir, rel), 'utf8');
const write = (dir, rel, t) => fs.writeFileSync(path.join(dir, rel), t);

test.after(() => { for (const d of tmps) fs.rmSync(d, { recursive: true, force: true }); });

for (const lang of ['en', 'ru']) {
  test(`установка --lang ${lang}: опись записана, сверка зелёная`, () => {
    const { dir, r } = install(lang);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /установка целостна/);
    const m = JSON.parse(read(dir, '.forma/install-manifest.json'));
    assert.equal(m.lang, lang);
    assert.ok(Object.keys(m.files).length > 100 && Object.keys(m.skeleton).length > 20);
    assert.match(read(dir, 'project/config/PROJECT.md'), new RegExp(`\\*\\*Project language\\*\\*[^\\n]*: ${lang === 'ru' ? 'Russian' : 'English'}\\.`));
    assert.equal(fs.existsSync(path.join(dir, '.forma/translation-pending.json')), lang === 'ru');
    const v = verify(dir);
    assert.equal(v.status, 0, v.out);
  });
}

test('перевод каркаса: текст заголовков меняется — сверка зелёная; потерян заголовок — красная с адресом', () => {
  const { dir } = install('ru');
  write(dir, 'project/ops/VALUE.md', read(dir, 'project/ops/VALUE.md').replace(/^# .*/m, '# Ценность').replace(/^## .*/gm, '## Раздел'));
  const ok = verify(dir);
  assert.equal(ok.status, 0, ok.out);
  write(dir, 'project/ops/VALUE.md', read(dir, 'project/ops/VALUE.md').replace(/^## .*/gm, ''));
  const v = verify(dir);
  assert.equal(v.status, 1);
  assert.match(v.out, /project\/ops\/VALUE\.md — заголовки «##» — ожидалось: ≥ \d+ — найдено: 0/);
});

test('красное называет адрес, ожидаемое и найденное', async (t) => {
  const { dir: base } = install('en');
  // каждый случай — на своей копии чистой установки; правка получает её корень
  const cases = [
    ['удалён хук', (d) => fs.rmSync(path.join(d, '.claude/hooks/intent-start.sh')),
      /\.claude\/hooks\/intent-start\.sh — ожидалось: файл установщика — найдено: нет файла/],
    ['хук выпал из settings.json', (d) => {
      const s = JSON.parse(read(d, '.claude/settings.json'));
      for (const g of s.hooks.SessionStart) g.hooks = g.hooks.filter((h) => !/check-ready/.test(h.command));
      write(d, '.claude/settings.json', JSON.stringify(s));
    }, /hooks\.SessionStart\[startup\] — ожидалось: команда «bash \.claude\/hooks\/check-ready\.sh»/],
    ['файл установщика изменён', (d) => write(d, '.forma/board/new-card.cjs', read(d, '.forma/board/new-card.cjs') + '\n// x\n'),
      /\.forma\/board\/new-card\.cjs — ожидалось: sha256 \w+… — найдено: sha256 \w+… \(файл изменён после установки\)/],
    ['синтаксис .cjs', (d) => write(d, '.forma/board/check-board.cjs', '(((\n'),
      /check-board\.cjs — ожидалось: разбирается как CommonJS — найдено: /],
    ['корневой CLAUDE.md', (d) => write(d, 'CLAUDE.md', 'x\n'),
      /CLAUDE\.md — ожидалось: нет корневого CLAUDE\.md/],
    ['плейсхолдер в tools:', (d) => write(d, '.claude/agents/spec.md', read(d, '.claude/agents/spec.md').replace(/^tools:.*/m, 'tools: Read, mcp__<srv>__*')),
      /spec\.md — tools: — ожидалось: имена инструментов без плейсхолдеров — найдено: mcp__<srv>__\*/],
    ['опись удалена', (d) => fs.rmSync(path.join(d, '.forma/install-manifest.json')),
      /install-manifest\.json — ожидалось: опись установки — найдено: нет файла/],
  ];
  for (const [name, apply, expect] of cases) {
    await t.test(name, () => {
      const copy = tmp();
      fs.cpSync(base, copy, { recursive: true });
      apply(copy);
      const v = verify(copy);
      assert.equal(v.status, 1, v.out);
      assert.match(v.out, expect);
    });
  }
});

test('повторная установка на живой проект: сверка зелёная, скелет не пересчитан', () => {
  const { dir } = install('en');
  write(dir, 'project/ops/ROADMAP.md', read(dir, 'project/ops/ROADMAP.md') + '\n## Человек дописал раздел\n');
  const again = install('en', dir).r;
  assert.equal(again.status, 0, again.stdout + again.stderr);
  const v = verify(dir);
  assert.equal(v.status, 0, v.out);
});
