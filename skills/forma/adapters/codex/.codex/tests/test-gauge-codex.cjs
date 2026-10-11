'use strict';

// Isolated fixtures: no live model, credentials, project writes or external sends.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-gauge-'));
function copy(rel) {
  function copyEntry(source, target) {
    if (fs.statSync(source).isDirectory()) {
      fs.mkdirSync(target,{recursive:true});
      for (const name of fs.readdirSync(source)) copyEntry(path.join(source,name),path.join(target,name));
    } else {
      fs.mkdirSync(path.dirname(target),{recursive:true});
      fs.copyFileSync(source,target);
    }
  }
  copyEntry(path.join(root,rel),path.join(fixture,rel));
}
function check(ok) {
  const r = spawnSync(process.execPath, [path.join(fixture, '.codex/scripts/sync-codex.cjs'), '--check', '--codex-only', '--root', fixture], {encoding:'utf8'});
  assert.equal(r.status, ok ? 0 : 1, r.stdout + r.stderr);
}
try {
  console.log('Gauge fixtures: preparing isolated inputs.');
  copy('.codex'); copy('.claude/agents'); copy('.claude/skills'); copy('.agents/skills'); copy('project/config/PROJECT.md'); copy('.forma/i18n');
  console.log('Gauge fixtures: checking generated contracts.');
  check(true);
  const mutations = [
    ['.codex/agents/gauge.toml', s => s.replace('sandbox_mode = "read-only"', 'sandbox_mode = "workspace-write"')],
    ['.codex/roles/spec.md', s => s.replace('why: gauge', 'why: ready')],
    ['.codex/roles/core.md', s => s.replace('measure 8', 'measure omitted')],
    ['.codex/roles/run/run-python.md', s => s.replace('## Takes / does not take', '## Missing criteria')],
    ['.codex/roles/gauge.md', s => s.replace('not a sixth node', 'a sixth node')]
  ];
  for (const [rel, change] of mutations) {
    const file=path.join(fixture,rel), original=fs.readFileSync(file,'utf8');
    fs.writeFileSync(file,change(original)); check(false); fs.writeFileSync(file,original);
  }
  // Regeneration excludes profiles registered as product-only in PROJECT.md.
  const r=spawnSync(process.execPath,[path.join(fixture,'.codex/scripts/sync-codex.cjs'),'--apply','--codex-only','--root',fixture],{encoding:'utf8'});
  assert.equal(r.status,0,r.stdout+r.stderr);
  const project=fs.readFileSync(path.join(fixture,'project/config/PROJECT.md'),'utf8');
  const section=/(?:\*\*|^#{1,6}\s*)(?:Профили Run проекта|Project Run profiles)[\s\S]*?(?=^#{1,6}\s|\n\*\*|(?![\s\S]))/m.exec(project)?.[0]||'';
  for(const m of section.matchAll(/\|\s*`(run-[\w-]+)`\s*\|/g)) {
    assert.equal(fs.existsSync(path.join(fixture,'.codex/roles/run',m[1]+'.md')),false);
    assert.equal(fs.existsSync(path.join(fixture,'.codex/agents',m[1]+'.toml')),false);
    assert.ok(!JSON.parse(fs.readFileSync(path.join(fixture,'.codex/generated-skill-mirror.json'),'utf8')).skills.includes(m[1]));
  }
  // A newly registered profile must be excluded by ownership, not a hardcoded name.
  const synthetic='run-fixture-owned';
  const registry=path.join(fixture,'project/config/PROJECT.md');
  fs.writeFileSync(registry,project.replace(section,section+'\n| `'+synthetic+'` | Fixture only |\n'));
  fs.copyFileSync(path.join(fixture,'.claude/agents/run/run-text.md'),path.join(fixture,'.claude/agents/run',synthetic+'.md'));
  const syntheticSkill=path.join(fixture,'.claude/skills',synthetic);
  fs.mkdirSync(syntheticSkill,{recursive:true});
  fs.writeFileSync(path.join(syntheticSkill,'SKILL.md'),'# Fixture only\n');
  // Full apply is run ONLY in the verified temporary fixture, never the live project.
  const full=spawnSync(process.execPath,[path.join(fixture,'.codex/scripts/sync-codex.cjs'),'--apply','--root',fixture],{encoding:'utf8'});
  assert.equal(full.status,0,full.stdout+full.stderr);
  const owned=[...section.matchAll(/\|\s*`(run-[\w-]+)`\s*\|/g)].map(m=>m[1]).concat(synthetic);
  for(const name of owned) {
    for(const rel of ['roles/run/'+name+'.md','roles/'+name+'.md','agents/'+name+'.toml']) {
      assert.equal(fs.existsSync(path.join(fixture,'.codex',rel)),false,rel);
    }
    assert.ok(!JSON.parse(fs.readFileSync(path.join(fixture,'.codex/generated-skill-mirror.json'),'utf8')).skills.includes(name));
  }
  // Existing contamination must fail the read-only check, not be silently accepted.
  for(const rel of ['roles/run/'+synthetic+'.md','agents/'+synthetic+'.toml']) {
    const file=path.join(fixture,'.codex',rel);
    fs.writeFileSync(file,'# Fixture contamination\n'); check(false); fs.unlinkSync(file);
  }
  const manifestFile=path.join(fixture,'.codex/generated-skill-mirror.json');
  const manifestText=fs.readFileSync(manifestFile,'utf8'), manifest=JSON.parse(manifestText);
  manifest.skills.push(synthetic); fs.writeFileSync(manifestFile,JSON.stringify(manifest)); check(false);
  fs.writeFileSync(manifestFile,manifestText); check(true);
  const rollout=path.join(fixture,'usage.jsonl'), card=path.join(fixture,'card.md');
  const stamp=seconds=>new Date(seconds*1000).toISOString();
  fs.writeFileSync(rollout,[
    {timestamp:stamp(0),type:'session_meta',payload:{id:'fixture-gauge',cwd:fixture,source:{subagent:{thread_spawn:{agent_role:'gauge'}}}}},
    {timestamp:stamp(2),type:'event_msg',payload:{type:'token_count',info:{total_token_usage:{total_tokens:100,cached_input_tokens:25}}}}
  ].map(JSON.stringify).join('\n')+'\n');
  fs.writeFileSync(card,'# Fixture\n\n## History\n\n## Result\n');
  const usage=spawnSync(process.execPath,[path.join(fixture,'.codex/scripts/codex-usage.cjs'),'--file',rollout,'--complete','--card',card,'--desc','role run-text, 90 % (gap 80, clarity 4), codex-gauge, fits'],{encoding:'utf8'});
  assert.equal(usage.status,0,usage.stdout+usage.stderr);
  const history=fs.readFileSync(card,'utf8');
  assert.match(history,/`Gauge`, .*attempt, 100 tokens \(25 cache-read\), 2 s, `fixture-gauge` — codex: role run-text/);
  console.log('Codex Gauge fixtures passed: role decisions, read-only declaration, profile criteria, product exclusion and measured Gauge spend.');
} finally {
  // Validate the exact temporary target before recursive cleanup on Windows.
  assert.equal(path.dirname(path.resolve(fixture)),path.resolve(os.tmpdir()));
  assert.ok(path.basename(fixture).startsWith('codex-gauge-'));
  fs.rmSync(fixture,{recursive:true,force:true});
}
