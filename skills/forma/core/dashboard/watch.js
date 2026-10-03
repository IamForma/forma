#!/usr/bin/env node
// Супервизор serve.js: перезапускает его при неожиданном падении, с нарастающей
// паузой между попытками, чтобы не уйти в бесконечный быстрый цикл рестартов.
// Запускать вместо serve.js напрямую, когда нужна защита от крашей на весь
// срок жизни процесса:
//   node .forma/dashboard/watch.js
// Обычно поднимается не вручную, а через ensure-running.js (см. рядом) —
// он делает это в фоне, detached, переживая завершение вызвавшего процесса.

const { spawn } = require('child_process');
const path = require('path');

const SERVE_PATH = path.join(__dirname, 'serve.js');
// Растущая пауза между рестартами подряд — защита от цикла мгновенных падений
// (например, порт занят другим процессом): не грузит машину бессмысленными
// попытками раз в секунду.
const BACKOFF_MS = [500, 1000, 2000, 5000, 10000, 30000];
let attempt = 0;

function launch() {
  const startedAt = Date.now();
  const child = spawn(process.execPath, [SERVE_PATH], { stdio: 'inherit', windowsHide: true });

  child.on('exit', (code, signal) => {
    const upMs = Date.now() - startedAt;
    // Прожил дольше полуминуты — падение не связано с предыдущими, счётчик сбрасывается.
    if (upMs > 30000) attempt = 0;

    console.log(`[watch] serve.js завершился (код ${code}, сигнал ${signal}), время жизни ${Math.round(upMs / 1000)}с`);
    const delay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
    attempt += 1;
    console.log(`[watch] перезапуск через ${delay} мс (попытка подряд: ${attempt})`);
    setTimeout(launch, delay);
  });

  child.on('error', (err) => {
    console.log(`[watch] не удалось запустить serve.js: ${err.message}`);
  });
}

console.log('[watch] супервизор запущен — следит за .forma/dashboard/serve.js, перезапускает при падении');
launch();
