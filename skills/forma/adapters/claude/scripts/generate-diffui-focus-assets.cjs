#!/usr/bin/env node
/* Generates the nine standalone focus illustrations.
 * Usage: node .forma/board/run-in-card.cjs <card> -- node generate-diffui-focus-assets.cjs [outputDir] [reportPath]
 * Paths: argv > CARD_ASSETS/CARD_DIR (set by run-in-card) > assets/focus in the repository root.
 * Credentials are read only from the repository-root .env file.
 */
const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const env = process.env;
const outputDir = path.resolve(root, process.argv[2] || (env.CARD_ASSETS ? path.join(env.CARD_ASSETS, 'focus') : path.join('assets', 'focus')));
const reportPath = path.resolve(root, process.argv[3] || path.join(env.CARD_DIR || '.', 'diffui-focus-assets-report.json'));

const assets = [
  ['focus-method.png', 'design', 'White ceramic robot assembling a complex luminous orange structure into three clear states: nuance, clarity, and completion. Dark engineering environment, thin orange grid, black graphite panels, cinematic wide composition, standalone focal illustration without words or UI.'],
  ['focus-intent.png', 'Intent', 'White ceramic robot studying a luminous result-image panel as a conversation becomes a brief and then a clear goal. Dark engineering environment, warm orange accents and thin technical grid, cinematic wide standalone focal illustration without words or UI.'],
  ['focus-spec.png', 'Spec_Task_Breakdown', 'White ceramic robot arranging a single luminous goal into connected task cards with visible relations and readiness markers. Dark engineering environment, warm orange light and thin grid, cinematic wide standalone focal illustration without words or UI.'],
  ['focus-keep.png', 'Work_Tools_Overview', 'White ceramic robot assembling a coherent work system around one task card, connecting tools, data, access and materials as luminous modules. Dark engineering environment, warm orange light and thin grid, cinematic wide standalone focal illustration without words or UI.'],
  ['focus-run.png', 'Project_Run_Status', 'White ceramic robot turns an active task card into a real web page artifact, checking the result beside it. Dark engineering environment, warm orange light and thin grid, cinematic wide standalone focal illustration without words or UI.'],
  ['focus-core.png', 'Core_Result_Overview', 'A human reviews a luminous connected kanban board while a white ceramic robot helps compare the whole result with the original intention. Dark engineering environment, warm orange light and thin grid, cinematic wide standalone focal illustration without words or UI.'],
  ['focus-example-project.png', 'Example_Project_Landing', 'A luminous project journey flows from result image to task cards to infrastructure modules to a finished landing page and a coherent board. Dark engineering environment, white ceramic robot, warm orange light, cinematic wide standalone focal illustration without words or UI.'],
  ['focus-mission.png', 'Prompt', 'White ceramic robot connects an individual project, a small team, and a wider community into one rising organized constellation of work. Dark engineering environment, warm orange light and thin grid, cinematic wide standalone focal illustration without words or UI.'],
  ['focus-natural-flow.png', 'design_2', 'A white ceramic robot moves through five connected stages: intention, clarity, preparation, action, and whole-result review, forming one continuous luminous path. Dark engineering environment, warm orange light and thin grid, cinematic wide standalone focal illustration without words or UI.'],
];

function readEnv(text) {
  return Object.fromEntries(text.split(/\r?\n/).flatMap((line) => {
    if (!line || line.startsWith('#')) return [];
    const index = line.indexOf('=');
    return index > 0 ? [[line.slice(0, index), line.slice(index + 1)]] : [];
  }));
}

async function fetchOrThrow(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const env = readEnv(await fs.readFile(path.join(root, '.env'), 'utf8'));
  const token = env.DIFFUI_BUILD_TOKEN;
  if (!token) throw new Error('DIFFUI_BUILD_TOKEN is absent from the root .env file.');
  const report = { dryRun, outputDir, assets: [], startedAt: new Date().toISOString() };
  if (dryRun) {
    report.assets = assets.map(([filename, reference]) => ({ filename, reference, status: 'planned' }));
  } else {
    await fs.mkdir(outputDir, { recursive: true });
    for (const [filename, reference, prompt] of assets) {
      const referenceImageUrl = `https://diffui.ai/image/${reference}.webp?authToken=${encodeURIComponent(token)}`;
      const generated = await fetchOrThrow('https://diffui.ai/api/build/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authToken: token, prompt, width: 1536, height: 1024, quality: 'high', transparentBackground: true, referenceImageUrl }),
      });
      const payload = await generated.json();
      if (!payload.url) throw new Error(`${filename}: Diffui returned no image URL.`);
      const image = await fetchOrThrow(payload.url);
      const target = path.join(outputDir, filename);
      await fs.writeFile(target, Buffer.from(await image.arrayBuffer()));
      const bytes = (await fs.stat(target)).size;
      if (bytes === 0) throw new Error(`${filename}: downloaded asset is empty.`);
      report.assets.push({ filename, reference, status: 'saved', bytes, path: target });
    }
  }
  report.finishedAt = new Date().toISOString();
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify({ status: 'ok', done: report.assets.length, left: 0, report: reportPath, dry_run: dryRun }));
}

main().catch(async (error) => {
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify({ error: error.message, at: new Date().toISOString() }, null, 2), 'utf8');
  console.log(JSON.stringify({ status: 'stop', done: 0, left: assets.length, report: reportPath }));
  process.exitCode = 2;
});
