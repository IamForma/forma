'use strict';

/**
 * guard-delete.cjs — кроссплатформенный модуль защиты охраняемых файлов и каталогов.
 * Реализует AGENTS.md §2 (Запрет 1).
 * Проверяет команды удаления/перемещения (POSIX sh, Windows CMD, PowerShell)
 * и прямые обращения к файлам на предмет совпадения с .forma/rules/protected-paths.json.
 *
 * Одноразовая разблокировка фразой «Отключи сенсорику»:
 * маркер .delete-unlock в .forma/ или .agents/.state/ снимается при первом срабатывании.
 */

const fs = require('fs');
const path = require('path');

const REGISTRY_PATH = path.join(__dirname, 'protected-paths.json');

function loadProtectedConfig() {
  try {
    if (fs.existsSync(REGISTRY_PATH)) {
      return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
    }
  } catch {}
  return {
    protectedRoots: ['.claude', '.agents', '.codex', '.devtool', '.forma', 'VARS'],
    protectedFiles: ['AGENTS.md', 'CLAUDE.md', 'PROJECT.md', 'GOAL.md', 'gemini-8.md', 'CODEX-8.md'],
    protectedPatterns: ['^\\.(claude|agents|codex|devtool|forma)(/|\\\\|$)', '(^|/|\\\\)AGENTS\\.md$'],
  };
}

const config = loadProtectedConfig();
const PATTERNS = config.protectedPatterns.map((p) => new RegExp(p, 'i'));

/**
 * Проверяет, является ли путь охраняемым
 */
function isProtectedPath(targetPath, root) {
  if (!targetPath) return false;
  let norm = targetPath.trim().replace(/^['"]|['"]$/g, '');
  if (root && path.isAbsolute(norm)) {
    norm = path.relative(root, norm);
  }
  norm = norm.replace(/\\/g, '/').replace(/^\.\//, '');

  // 1. Проверка по regex-паттернам
  for (const rx of PATTERNS) {
    if (rx.test(norm)) return true;
  }

  // 2. Проверка по корням и именам
  const parts = norm.split('/');
  const first = parts[0];
  const last = parts[parts.length - 1];

  for (const r of config.protectedRoots) {
    if (first.toLowerCase() === r.toLowerCase()) return true;
  }
  for (const f of config.protectedFiles) {
    if (last.toLowerCase() === f.toLowerCase()) return true;
  }

  // 3. Любой файл с именем GOAL.md
  if (/^goal\.md$/i.test(last)) return true;

  return false;
}

/**
 * Проверка маркера одноразовой разблокировки («Отключи сенсорику»)
 */
function getUnlockMarkerPaths(root) {
  const r = root || process.cwd();
  return [
    path.join(r, '.forma', '.delete-unlock'),
    path.join(r, '.agents', '.state', '.delete-unlock'),
    path.join(r, '.claude', 'hooks', '.delete-unlock'),
  ];
}

function isUnlockActive(root) {
  return getUnlockMarkerPaths(root).some((p) => fs.existsSync(p));
}

function unlockDeletion(root) {
  const p = path.join(root || process.cwd(), '.forma', '.delete-unlock');
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, 'unlocked by phrase: Отключи сенсорику\n' + new Date().toISOString());
  return p;
}

function consumeUnlock(root) {
  let consumed = false;
  for (const p of getUnlockMarkerPaths(root)) {
    if (fs.existsSync(p)) {
      try {
        fs.unlinkSync(p);
        consumed = true;
      } catch {}
    }
  }
  return consumed;
}

/**
 * Разбор командной строки на наличие деструктивных операций
 */
function checkCommand(commandLine, root) {
  if (!commandLine || typeof commandLine !== 'string') return { blocked: false };

  const cmd = commandLine.trim();

  // Регексы команд удаления/перемещения (не должны матчить дефисы внутри имен вроде card-move.cjs)
  const isDeleteCmd =
    /(^|[;&|\s])(rm|rmdir|unlink|del|erase|rd|Remove-Item|ri)(\.exe)?(\s|$)/i.test(cmd) ||
    /\bfind\s+.*-delete\b/i.test(cmd) ||
    /\bgit\s+clean\b/i.test(cmd) ||
    /(^|[;&|\s])(mv|move|Move-Item|mi)(\.exe)?(\s|$)/i.test(cmd);

  if (!isDeleteCmd) return { blocked: false };

  // Извлечение потенциальных путей/токенов из команды
  const tokens = cmd
    .split(/[ \t;|&'"<>`()]+/)
    .map((t) => t.trim())
    .filter((t) => t && !t.startsWith('-') && !/^(rm|rmdir|unlink|del|erase|rd|Remove-Item|ri|mv|move|Move-Item|mi|find|git|clean|powershell|cmd|bash|sh|exec)$/i.test(t));

  for (const tok of tokens) {
    if (isProtectedPath(tok, root)) {
      if (consumeUnlock(root)) {
        return { blocked: false, unblockedByPhrase: true, target: tok };
      }
      return {
        blocked: true,
        target: tok,
        reason: `Запрет 1: удаление или перемещение охраняемого пути «${tok}» заблокировано (AGENTS.md §2). Для разовой разблокировки назовите парольную фразу «Отключи сенсорику».`,
      };
    }

    // Проверка опасных рекурсивных масок (например, `.*`, `*`, `project/*`)
    if (/^(\.\*|\*|\.\/\*|\.\/|\.)$/.test(tok) && /\b(-r|-rf|--recursive|-recurse|\/s)\b/i.test(cmd)) {
      if (consumeUnlock(root)) {
        return { blocked: false, unblockedByPhrase: true, target: tok };
      }
      return {
        blocked: true,
        target: tok,
        reason: `Запрет 1: рекурсивная очистка маски «${tok}» затрагивает охраняемые пути (AGENTS.md §2). Для разовой разблокировки назовите парольную фразу «Отключи сенсорику».`,
      };
    }
  }

  // git clean без путей очищает весь репозиторий
  if (/\bgit\s+clean\b/i.test(cmd) && /\b(-[a-z]*x|-f|-d)\b/i.test(cmd)) {
    if (consumeUnlock(root)) {
      return { blocked: false, unblockedByPhrase: true, target: 'git clean' };
    }
    return {
      blocked: true,
      target: 'git clean',
      reason: `Запрет 1: git clean может удалить охраняемые нетрекаемые файлы и каталоги (AGENTS.md §2). Для разовой разблокировки назовите парольную фразу «Отключи сенсорику».`,
    };
  }

  return { blocked: false };
}

/**
 * Обработка в контексте PreToolUse хука
 */
function runGuard({ toolName, args, root }) {
  if (!toolName) return { decision: 'allow' };

  if (toolName === 'run_command' && args && args.CommandLine) {
    const res = checkCommand(args.CommandLine, root);
    if (res.blocked) {
      return { decision: 'deny', reason: res.reason };
    }
  }

  return { decision: 'allow' };
}

module.exports = {
  isProtectedPath,
  isUnlockActive,
  unlockDeletion,
  consumeUnlock,
  checkCommand,
  runGuard,
  loadProtectedConfig,
};
