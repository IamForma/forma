'use strict';

// Чистые зоны — запрет 16 (AGENTS.md §5): закон, адаптеры, роли, скрипты, хуки, скиллы, manual, dashboard,
// README/docs/templates/skills исходника протокола. Файлы слоя 4 — .claude/project-layer.txt.
// Метки времени ISO с «T» — формат, не дата. Одна правда: и проверка `engine-impersonal`, и хук check-clean-zone.sh
// (`sync-engines --file`) зовут scanCleanFile.

const fs = require('fs');
const path = require('path');

const CLEAN_ROOTS = ['AGENTS.md', '.claude/agents', '.claude/rules', '.claude/scripts', '.claude/hooks',
  '.claude/skills', '.forma/manual', '.forma/dashboard', '.forma/living/dictionary',
  '.forma/protocol/docs', '.forma/protocol/templates', '.forma/protocol/skills'];
const CLEAN_SKIP = new Set(['.cache', 'node_modules', 'graphify-out', 'data']);
// Собрано из частей, чтобы проверка не находила саму себя.
const CLEAN_RX = new RegExp(['card-\\d{3}', 'решени' + 'е человека', 'iam' + 'forma\\.pro', '\\b20' + '\\d{2}-\\d{2}-\\d{2}(?![T\\d])',
  '`(?=[0-9a-f]*\\d)(?=[0-9a-f]*[a-f])[0-9a-f]{7,40}`', '[\\w.+-]+' + '@' + '[\\w-]+\\.[a-z]{2,}\\b'].join('|'), 'i');

/** Файлы проекта, что сами хранят след проекта по замыслу (слой 4): строки `.claude/project-layer.txt`. */
function cleanOwn(root) {
  const layerFile = path.join(root, '.claude', 'project-layer.txt');
  return new Set(fs.existsSync(layerFile)
    ? fs.readFileSync(layerFile, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
    : []);
}

/** Запись слоя 4 — путь к файлу или к каталогу; каталог покрывает всё внутри. */
function isOwn(rel, own) {
  if (own.has(rel)) return true;
  for (const o of own) if (rel === o || rel.startsWith(o + '/')) return true;
  return false;
}

/** `rel` — путь от корня с «/». Вне чистых зон или в слое 4 — `false` (не проверяется). */
function inCleanZone(rel, own) {
  if (isOwn(rel, own) || !/\.(md|cjs|js|mjs|sh|py|html)$/.test(rel)) return false;
  if (rel.split('/').some((p) => CLEAN_SKIP.has(p) || (p.startsWith('.') && !['.claude', '.forma'].includes(p)))) return false;
  if (/^protocol\/README[^/]*\.md$/.test(rel)) return true;
  return CLEAN_ROOTS.some((r) => rel === r || rel.startsWith(r + '/'));
}

/** Следы проекта в тексте файла `rel`: строка `путь:номер: …`. Плюс ресурс проекта в `tools:` роли. */
function scanCleanFile(rel, text) {
  const problems = [];
  text.split(/\r?\n/).forEach((l, i) => {
    const m = l.match(CLEAN_RX);
    if (m) problems.push(`${rel}:${i + 1}: след проекта в чистой зоне — «${m[0]}»; запрет 16: ссылка — в карточке, дата — в .forma/living/checks.json`);
    // Ресурс проекта в разрешениях роли: `--site <домен>` или MCP-сервер с доменом в имени.
    if (/^tools:/.test(l) && rel.includes('/agents/')) {
      for (const t of l.matchAll(/--site\s+[\w-]+(\.[\w-]+)+|mcp__[\w-]*-(pro|ru|com|org|net|io|site|online)__/gi)) {
        problems.push(`${rel}:${i + 1}: ресурс проекта в tools: роли — «${t[0]}»; адрес — в .env / корневом .mcp.json, в роли — site.cjs и mcp__site__*`);
      }
    }
  });
  return problems;
}

module.exports = { CLEAN_ROOTS, CLEAN_SKIP, cleanOwn, isOwn, inCleanZone, scanCleanFile };
