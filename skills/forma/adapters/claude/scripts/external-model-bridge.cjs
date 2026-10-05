#!/usr/bin/env node
// Bridge-скрипт: вызов внешней модели (OpenAI-совместимый chat/completions) вместо Agent tool.
// Текст-в/текст-аут задачи без живого доступа к среде (`vneshnyaya-model-spec-core.md`).
// Нейтральное имя: мост к любому OpenAI-совместимому провайдеру (DeepSeek, OpenRouter).
//
// Использование:
//   node .claude/scripts/external-model-bridge.cjs --prompt-file <path> [--provider deepseek|openrouter] [--model ...] [--max-tokens 8192] [--out <path>]
//   node .claude/scripts/external-model-bridge.cjs --prompt "<текст>" ...
//
// Ключ — DEEPSEEK_API_KEY / OPENROUTER_API_KEY, читается из .env в корне проекта (не из процесса/оболочки — запрет 15, AGENTS.md §5).
// Печатает содержимое ответа модели в stdout (или пишет в --out, если задан); ничего лишнего не добавляет —
// вызывающий узел разбирает результат сам, как разбирал бы текст субагента.
//
// Стоимость: для DeepSeek считается по прайсу deepseek-flash (
// https://api-docs.deepseek.com/quick_start/pricing) — легаси-имена deepseek-chat/deepseek-reasoner
// принимаются, но обслуживаются той же базовой моделью (подтверждено полем `model` в ответе API),
// различие между ними — режим мышления, не разные базовые модели.
// Для OpenRouter — по прайсу конкретной модели (`--model`), таблица ниже; неизвестная модель даёт
// cost_usd_estimate: null вместо ложной цифры, а не молча использует чужой тариф.
// Прайс на другую модель/дату сверяй у провайдера заново, не считай эти числа константой навсегда.

const fs = require('fs');
const path = require('path');
const https = require('https');
const { parseKnown } = require('../../.forma/dashboard/lib/cli.cjs');

// $ за 1 токен (не за 1M — сразу поделено, чтобы не забыть /1e6 в новой строке)
const PRICING = {
  deepseek: {
    // off-peak (пиковые часы 01:00-04:00 и 06:00-10:00 UTC, Пн-Пт — вдвое дороже, не учтено здесь)
    inputCacheMiss: 0.15 / 1e6,
    inputCacheHit: 0.003 / 1e6,
    output: 0.6 / 1e6,
  },
  openrouter: {
    // Цена — openrouter.ai
    'z-ai/glm-5.3-flash': { input: 0.045 / 1e6, output: 0.14 / 1e6 },
    'qwen/qwen3.7-flash': { input: 0.03 / 1e6, output: 0.13 / 1e6 },
    // Цена — openrouter.ai
    'deepseek/deepseek-v4-flash': { input: 0.049 / 1e6, output: 0.097 / 1e6 },
  },
};

function estimateCostUsd(provider, model, usage) {
  if (provider === 'deepseek') {
    const p = PRICING.deepseek;
    const hit = usage.prompt_cache_hit_tokens ?? 0;
    const miss = usage.prompt_cache_miss_tokens ?? (usage.prompt_tokens ?? 0) - hit;
    const out = usage.completion_tokens ?? 0;
    return hit * p.inputCacheHit + miss * p.inputCacheMiss + out * p.output;
  }
  if (provider === 'openrouter') {
    const p = PRICING.openrouter[model];
    if (!p) return null; // неизвестная модель — не гадаем цену
    const inTok = usage.prompt_tokens ?? 0;
    const out = usage.completion_tokens ?? 0;
    return inTok * p.input + out * p.output;
  }
  return null;
}

function loadEnvKey(name) {
  // __dirname = .claude/scripts — два уровня вверх до корня проекта, где живёт
  // единственный .env (запрет 15, AGENTS.md §5: один файл, без копий по движкам).
  const envPath = path.join(__dirname, '..', '..', '.env');
  if (!fs.existsSync(envPath)) {
    throw new Error(`.env не найден в корне проекта (${envPath})`);
  }
  const text = fs.readFileSync(envPath, 'utf8');
  const re = new RegExp(`^${name}=(.*)$`, 'm');
  const m = text.match(re);
  if (!m || !m[1].trim()) {
    throw new Error(`${name} пуст или не найден в .env`);
  }
  return m[1].trim();
}

// Дефолт (project/config/CONFIG.md #deepseek-extraction-quality):
// OpenRouter GLM 5.3 Flash — почти втрое дешевле DeepSeek на сопоставимом качестве извлечения.
// DeepSeek остаётся резервом на случай, когда критично время (--provider deepseek явно).
const DEFAULT_PROVIDER = 'openrouter';
// Для графов — DeepSeek V4 Flash через OpenRouter.
const DEFAULT_MODEL = 'deepseek/deepseek-v4-flash';

function parseArgs(argv) {
  const int = (v) => parseInt(v, 10);
  const args = parseKnown(argv, {
    '--prompt-file': 'promptFile', '--prompt': 'prompt', '--provider': 'provider', '--model': 'model',
    '--max-tokens': ['maxTokens', int], '--out': 'out', '--system': 'system',
    '--reasoning-effort': 'reasoningEffort', '--reasoning-max-tokens': ['reasoningMaxTokens', int],
  }, { provider: DEFAULT_PROVIDER, model: DEFAULT_MODEL, maxTokens: 8192 });
  // переключились на deepseek флагом, но не назвали модель явно — подставляем его дефолт,
  // не дефолт openrouter (иначе ушли бы в DeepSeek с несуществующей там моделью GLM)
  if (args.provider === 'deepseek' && args.model === DEFAULT_MODEL) {
    args.model = 'deepseek-chat';
  }
  // GLM по контракту извлечения требует reasoning.effort=low на файлах крупнее ~20K токенов —
  // ставим низким по умолчанию для дефолтной пары provider+model, если не переопределено явно
  if (args.provider === DEFAULT_PROVIDER && args.model === DEFAULT_MODEL && !args.reasoningEffort && !args.reasoningMaxTokens) {
    args.reasoningEffort = 'low';
  }
  return args;
}

const PROVIDER_HOSTS = {
  deepseek: { hostname: 'api.deepseek.com', path: '/chat/completions', envKey: 'DEEPSEEK_API_KEY' },
  openrouter: { hostname: 'openrouter.ai', path: '/api/v1/chat/completions', envKey: 'OPENROUTER_API_KEY' },
};

function callChatCompletions({ provider, apiKey, model, system, prompt, maxTokens, reasoningEffort, reasoningMaxTokens }) {
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt });

  const payload = {
    model,
    messages,
    max_tokens: maxTokens,
    stream: false,
  };
  // OpenRouter: ограничение бюджета reasoning отдельно от видимого вывода (openrouter.ai/docs/use-cases/reasoning-tokens)
  if (provider === 'openrouter' && (reasoningEffort || reasoningMaxTokens)) {
    payload.reasoning = reasoningEffort ? { effort: reasoningEffort } : { max_tokens: reasoningMaxTokens };
  }
  const body = JSON.stringify(payload);

  const { hostname, path: apiPath } = PROVIDER_HOSTS[provider];
  const options = {
    hostname,
    path: apiPath,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'Content-Length': Buffer.byteLength(body),
    },
  };

  // Таймаут на весь запрос — без него зависший коннект (обрыв на стороне провайдера,
  // сеть) висит вечно, ни успех, ни ошибка не приходят никогда (
  // сборка графа опыта закрытых карточек зависла на файле 32/53 без единой ошибки).
  const TIMEOUT_MS = 120000;

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`${provider} API ${res.statusCode}: ${data}`));
          return;
        }
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          reject(new Error(`Не удалось разобрать ответ ${provider}: ${e.message}\n${data.slice(0, 500)}`));
        }
      });
    });
    req.setTimeout(TIMEOUT_MS, () => {
      req.destroy(new Error(`${provider} API: нет ответа за ${TIMEOUT_MS / 1000} с (таймаут)`));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.prompt && !args.promptFile) {
    console.error('Нужен --prompt "<текст>" или --prompt-file <path>');
    process.exit(1);
  }
  if (!PROVIDER_HOSTS[args.provider]) {
    console.error(`Неизвестный --provider "${args.provider}" (deepseek|openrouter)`);
    process.exit(1);
  }
  if (args.provider === 'openrouter' && !args.model) {
    console.error('Для --provider openrouter нужен явный --model (например z-ai/glm-5.3-flash)');
    process.exit(1);
  }
  const prompt = args.prompt || fs.readFileSync(args.promptFile, 'utf8');
  const apiKey = loadEnvKey(PROVIDER_HOSTS[args.provider].envKey);

  const t0 = Date.now();
  const result = await callChatCompletions({
    provider: args.provider,
    apiKey,
    model: args.model,
    system: args.system,
    prompt,
    maxTokens: args.maxTokens,
    reasoningEffort: args.reasoningEffort,
    reasoningMaxTokens: args.reasoningMaxTokens,
  });
  const durationMs = Date.now() - t0;

  const text = result.choices?.[0]?.message?.content ?? '';
  const usage = result.usage || {};
  // OpenRouter отдаёт реальную стоимость в usage.cost — точнее собственного расчёта по прайсу, предпочитаем её
  const costUsd = typeof usage.cost === 'number' ? usage.cost : estimateCostUsd(args.provider, args.model, usage);

  const report = {
    text,
    usage: {
      prompt_tokens: usage.prompt_tokens ?? null,
      completion_tokens: usage.completion_tokens ?? null,
      total_tokens: usage.total_tokens ?? null,
      prompt_cache_hit_tokens: usage.prompt_cache_hit_tokens ?? null,
      prompt_cache_miss_tokens: usage.prompt_cache_miss_tokens ?? null,
    },
    cost_usd_estimate: costUsd === null ? null : Number(costUsd.toFixed(6)),
    duration_ms: durationMs,
    provider: args.provider,
    model_requested: args.model,
    model_served: result.model ?? null,
  };

  if (args.out) {
    fs.writeFileSync(args.out, JSON.stringify(report, null, 2), 'utf8');
    console.log(`Записано: ${args.out}`);
  } else {
    console.log(JSON.stringify(report, null, 2));
  }
}

main().catch((err) => {
  console.error('Ошибка bridge-скрипта:', err.message);
  process.exit(1);
});
