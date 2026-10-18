'use strict';
// Порт дашборда по умолчанию — одно место. serve.js начинает поиск свободного порта с него,
// ensure-running.js откатывается на него без server.json, хук старта сессии берёт его для ссылки.
// Модуль без побочных эффектов: require не запускает сервер.
const DEFAULT_PORT = 5050;

module.exports = { DEFAULT_PORT };
