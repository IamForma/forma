#!/usr/bin/env node
'use strict';

// Owns only generated Codex files. Semantic sources remain .claude/agents and .claude/skills.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const rootFlag = process.argv.indexOf('--root');
const ROOT = rootFlag >= 0 ? path.resolve(process.argv[rootFlag + 1]) : path.resolve(__dirname, '../..');
const APPLY = process.argv.includes('--apply');
// Use this when the generated role layer needs refresh without taking ownership
// of the shared .agents skill mirror.
const CODEX_ONLY = process.argv.includes('--codex-only');
const roles = ['intent', 'spec', 'kit', 'run', 'core', 'extractor'];
const models = { intent:['gpt-5.6-sol','low'], spec:['gpt-5.6-terra','low'], kit:['gpt-5.6-terra','medium'], run:['gpt-5.6-luna','low'], core:['gpt-5.6-sol','low'], extractor:['gpt-5.6-luna','low'] };
const codex = path.join(ROOT, '.codex'), claude = path.join(ROOT, '.claude'), claudeAgents = path.join(claude, 'agents'), claudeSkills = path.join(claude, 'skills'), agentSkills = path.join(ROOT, '.agents', 'skills');
// The Forma plugin lives in `protocol/` inside the project; --plugin overrides it.
const pluginFlag = process.argv.indexOf('--plugin');
const pluginCandidates = [path.join(ROOT, '.forma', 'protocol', 'skills', 'forma'), path.join(ROOT, 'protocol', 'skills', 'forma')];
const PLUGIN = pluginFlag >= 0 ? path.resolve(process.argv[pluginFlag + 1])
  : process.env.FORMA_PLUGIN_ROOT ? path.resolve(process.env.FORMA_PLUGIN_ROOT)
  : (pluginCandidates.find(p => fs.existsSync(p)) || pluginCandidates[0]);
const template = fs.existsSync(path.join(PLUGIN, 'adapters', 'codex'))
  ? path.join(PLUGIN, 'adapters', 'codex') : path.join(PLUGIN, 'templates-codex');
const problems = [];
const exists = p => fs.existsSync(p);
const text = p => fs.readFileSync(p, 'utf8');
const digest = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const sameText = (a,b) => a.replace(/\r/g,'') === b.replace(/\r/g,'');
function projectRunProfiles() {
  const projectFile = path.join(ROOT, 'project', 'config', 'PROJECT.md');
  const project = exists(projectFile) ? text(projectFile) : '';
  const section = /(?:\*\*|^#{1,6}\s*)(?:Профили Run проекта|Project Run profiles)[\s\S]*?(?=^#{1,6}\s|\n\*\*|(?![\s\S]))/m.exec(project)?.[0] || '';
  return new Set([...section.matchAll(/\|\s*`(run-[\w-]+)`\s*\|/g)].map(m => m[1]));
}
function files(dir, prefix = '') { if (!exists(dir)) return []; return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e => { const rel=path.posix.join(prefix,e.name); return e.isDirectory()?files(path.join(dir,e.name),rel):e.isFile()?[rel]:[]; }).sort(); }
function copyTree(src,dst) { for (const rel of files(src)) { const out=path.join(dst,rel); fs.mkdirSync(path.dirname(out),{recursive:true}); fs.copyFileSync(path.join(src,rel),out); } }
function sameTree(a,b,label) { const af=files(a), bf=files(b); if (af.join('\n')!==bf.join('\n')) { problems.push(`${label}: file set differs`); return; } for (const rel of af) if (digest(path.join(a,rel))!==digest(path.join(b,rel))) problems.push(`${label}: content differs at ${rel}`); }
function codexMechanics(name, onDemand) {
  const key = `${onDemand ? 'on-demand/' : ''}${name}`;
  const rules = {
    spec: 'After slicing, request Plumb through Intent as specified in CODEX-8.md. Decide from choice, score and noul using configured thresholds for the actual executor; do not borrow Claude calibration for the Codex model. A fitting leader and gap, sufficient noul and clarity: write all six kit units, inherit the profile model, route-2 with why: plumb. Below fit thresholds: leave Kit empty and send to Kit to create the exact role. Low clarity: restate once, measure again, then return the named ambiguity to Intent. Write the Plumb reading immediately with measured Codex spend and the codex: tag. Batch slicing spend is split across its cards.',
    kit: 'In role routing, Kit is called only for a below-threshold Plumb reading or a return. First create or correct the exact portable profile in .codex/roles/run/ with tools, access, boundaries and Takes / does not take examples; request the same Plumb through Intent to test it before issuing the kit. Card ambiguity returns to Spec. Product-only profiles are read from PROJECT.md, never copied into portable Codex files. Run inherits gpt-5.6-luna/low; overrides need a prior history reason. Kit batches at most four independent related cards and returns the kit or correction to Intent, never dispatching agents itself. Approved tooling routes still allow Kit to execute infrastructure work.',
    intent: 'Run Plumb on behalf of Spec (or Kit retesting a role): scrub with the shared script, dispatch the isolated Codex helper, return typed readings and measured call metadata to the requesting node. Spec decides and writes the Plumb line. Plumb is not a sixth node and never confirms work. A Plumb-confirmed route-2 (why: plumb) goes directly to Run after the required human approval; why: ready remains for an already complete card and kit. Run inherits gpt-5.6-luna/low; only a recorded Kit override changes it. Apply external-service cycle limits and fail-closed fallback from CODEX-8.md.',
    run: 'Read the assigned profile, including Takes / does not take, before the form check. A task outside that boundary returns to Kit by address and expected scope even when Plumb confirmed it. run.md is the base, never a selectable catalog profile. The Plumb reading does not waive the form check or confirm the result. Run inherits gpt-5.6-luna/low; an override needs Kit\'s prior history reason.',
    core: 'Read eight efficiency measures at cycle closing, including Plumb agreement (measure 8), from recorded card facts. Do not call Plumb. Compare Plumb ↔ Spec ↔ Kit ↔ Run and first-time acceptance per row: low clarity or small gap → Spec; confident role but different kit → Kit; confirmed profile rejecting the task → Kit profile correction; unaccepted result → the ordinary return table. Divergent executors require threshold/catalog review through a recorded stop. Calibration is executor-specific; Plumb agreement never replaces Intent\'s check.',
    'on-demand/route-choice': 'A routine profile confirmed by Plumb uses route-2 (why: plumb): Spec writes the six-unit kit and Intent dispatches Run directly after the required approval. Below fit thresholds → Kit, route-5 subject to enabled routes and approval; low clarity → Spec once. why: ready is reserved for an already complete card and kit. Run inherits gpt-5.6-luna/low; overrides need Kit\'s prior history reason. Plumb readings use the codex: tag and the actual executor name; see CODEX-8.md. Spec batches slicing; Kit batches at most four independent related cards.',
    'on-demand/spend-line': 'Do not use Claude usage fields or readers. For a completed Codex rollout, bind each batch card with `node .codex/scripts/codex-usage.cjs --file <rollout.jsonl> --complete --card <card.md> --split K --share I --desc "<what this card received>"`; it splits measured N/R/T and adds `(batch I/K)`. For the Plumb helper, Spec uses the same reader without batch flags and --desc "role <name>, N % (gap G, clarity C), <executor>, <fits / below threshold / returned>; scrub <types and counts>". The helper is attributed to Plumb, with the codex: tag. External spend uses the provider response, with its own-unit segment before the call id and dash; unknown fields require inspection of that call\'s transcript, never estimation.',
  };
  const catalogGrowth = 'Every call, including returns, infrastructure and batches, leaves or extends a role in .codex/roles/run/. Before writing, name the task shape (subject, takes line and 1–2 examples) and dup-check it through the same Plumb, executor and thresholds Spec uses. At or above threshold on an existing role, extend its examples or criterion instead of creating a file. Create a new profile only when every existing role is below threshold; name the nearest neighbor in its does-not-take boundary and retest through the same Plumb. Create a missing role inline in the same call, without a separate tooling card. Core reads the share of cards through Kit from `node .forma/dashboard/tally.cjs .devtool/features`: `byNode.Kit.files / cardsWithAttempt`, including route-4/route-5. This share should fall as the catalog grows; a rising share with a flat or shrinking catalog calls for checking whether dup-check was skipped.';
  return rules[key] ? `\n## Codex mechanics\n\n${rules[key]}\n${key === 'kit' ? `\n${catalogGrowth}\n` : ''}` : '';
}
function adapter(name,onDemand=false) { const source=onDemand?`.claude/agents/on-demand/${name}.md`:`.claude/agents/${name}.md`; const title=onDemand?`${name} · Codex procedure adapter`:`${name[0].toUpperCase()}${name.slice(1)} · Codex role`; return `# ${title}\n\nCanonical ${onDemand?'procedure':'role'}: \`${source}\`. Read it completely; this file is only its Codex adapter.\n\n- Ignore Claude YAML frontmatter and apply \`.codex/CLAUDE-COMPAT.md\` to Claude tools, skills, scripts, MCP, and subagent references.\n- Codex mechanics and model settings come from \`.codex/CODEX-8.md\` and the matching agent TOML; they never replace the canonical body.\n- An unavailable live tool is an environment limitation and follows the route; it is never silently substituted.\n${codexMechanics(name,onDemand)}`; }
function syncRoleLayer() {
  for (const role of roles) { const canonical=path.join(claudeAgents,`${role}.md`), toml=path.join(codex,'agents',`${role}.toml`), target=path.join(codex,'roles',`${role}.md`); if (!exists(canonical)||!exists(toml)) { problems.push(`missing role component: ${role}`); continue; } const [model,effort]=models[role]; const desiredToml=text(toml).replace(/^model\s*=.*$/m,`model = "${model}"`).replace(/^model_reasoning_effort\s*=.*$/m,`model_reasoning_effort = "${effort}"`); if(APPLY&&desiredToml!==text(toml))fs.writeFileSync(toml,desiredToml); if(text(toml)!==desiredToml)problems.push(`model/tier drift: ${role}`); const desired=adapter(role); if(APPLY){fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,desired);} if(!exists(target)||!sameText(text(target),desired))problems.push(`role link drift: ${role}`); }
  const source=path.join(claudeAgents,'on-demand'); for(const rel of files(source).filter(f=>f.endsWith('.md'))) { const target=path.join(codex,'roles','on-demand',rel), desired=adapter(rel.slice(0,-3),true); if(APPLY){fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,desired);} if(!exists(target)||!sameText(text(target),desired))problems.push(`procedure link drift: ${rel}`); }
}
function syncSkills() {
  const excluded=projectRunProfiles();
  const names=exists(claudeSkills)?fs.readdirSync(claudeSkills,{withFileTypes:true}).filter(e=>e.isDirectory()&&!excluded.has(e.name)).map(e=>e.name).sort():[]; const manifest=path.join(codex,'generated-skill-mirror.json'); const old=exists(manifest)?JSON.parse(text(manifest)).skills||[]:[];
  if(APPLY){
    // --codex-only owns the manifest but deliberately never mutates Gemini's
    // shared skill mirror under .agents/.
    if(!CODEX_ONLY){
      for(const n of old.filter(n=>!names.includes(n)))fs.rmSync(path.join(agentSkills,n),{recursive:true,force:true});
      for(const n of names){fs.rmSync(path.join(agentSkills,n),{recursive:true,force:true});copyTree(path.join(claudeSkills,n),path.join(agentSkills,n));}
    }
    fs.writeFileSync(manifest,JSON.stringify({skills:names},null,2)+'\n');
  }
  if(!exists(manifest)||JSON.stringify(JSON.parse(text(manifest)).skills||[])!==JSON.stringify(names))problems.push('skill mirror manifest drift');
  if(!CODEX_ONLY) for(const n of names){const target=path.join(agentSkills,n);if(!exists(target))problems.push(`skill mirror missing: ${n}`);else sameTree(path.join(claudeSkills,n),target,`skill mirror ${n}`);}
}
function checkStatic() {
  const appendix=path.join(codex,'CODEX-8.md'), readme=path.join(codex,'README.md'); const expected=[['Intent','gpt-5.6-sol','low'],['Spec','gpt-5.6-terra','low'],['Kit','gpt-5.6-terra','medium'],['Run','gpt-5.6-luna','low'],['Core','gpt-5.6-sol','low'],['Extractor','gpt-5.6-luna','low']];
  for(const [name,model,effort] of expected){
    const tableRow=`| ${name} | \`${model}\` | \`${effort}\` |`;
    const prose=`\`${name}\` \`${model}\`/\`${effort}\``;
    if(!exists(appendix)||!text(appendix).includes(tableRow))problems.push(`documentation model/tier drift: CODEX-8.md / ${name}`);
    if(!exists(readme)||!text(readme).includes(prose))problems.push(`documentation model/tier drift: README.md / ${name}`);
  }
  const hooks=exists(path.join(codex,'hooks.json'))?text(path.join(codex,'hooks.json')):'';for(const v of ['SessionStart','PreToolUse','check-ready.ps1','check-dashboard.ps1','check-plugin-update.ps1','guard-delete.ps1','tool-usage.ps1'])if(!hooks.includes(v))problems.push(`hook declaration drift: ${v}`);
  if(!exists(path.join(codex,'hooks','tool-usage.ps1')))problems.push('hook implementation missing: tool-usage.ps1');
  const guard=exists(path.join(codex,'hooks','guard-delete.ps1'))?text(path.join(codex,'hooks','guard-delete.ps1')):'';for(const v of ['.claude','.agents','.codex','.devtool','AGENTS\\.md','GOAL\\.md'])if(!guard.includes(v))problems.push(`guard protected-path drift: ${v}`);
  const plumbFile=path.join(codex,'agents','plumb.toml');
  const plumb=exists(plumbFile)?text(plumbFile):'';
  for(const line of ['name = "plumb"','model = "gpt-5.6-luna"','model_reasoning_effort = "low"','sandbox_mode = "read-only"'])
    if(!plumb.includes(line))problems.push('Plumb declaration drift: '+line);
  const contract=path.join(codex,'roles','plumb.md');
  for(const value of ['not a sixth node','choice','score','noul','Takes / does not take'])
    if(!exists(contract)||!text(contract).includes(value))problems.push('Plumb contract drift: '+value);
}
// The packaged template is a generic, hand-kept copy: it carries no project MCP servers and only
// the protocol's own skills. So it is never generated from a project (that leaked site-specific
// skills and servers into the public plugin), and these files legitimately differ from any project.
const TEMPLATE_GENERIC = new Set(['config.toml','generated-skill-mirror.json','CLAUDE-COMPAT.md','CODEX-8.md','README.md','CHANGELOG.md','scripts/sync-codex.cjs','tests/test-sync-codex.cjs','tests/verify-config.ps1','tests/verify-parity.ps1']);
function syncTemplate() {
  if(!exists(PLUGIN))return;
  const targetCodex=path.join(template,'.codex'), targetSkills=path.join(template,'.agents','skills');
  if(!exists(targetCodex)||!exists(targetSkills)){problems.push('template Codex tree missing');return;}
  const shared=files(codex).filter(rel=>!TEMPLATE_GENERIC.has(rel)&&!rel.startsWith('roles/')&&!/^agents\/run-.+\.toml$/.test(rel));
  for(const rel of shared){const t=path.join(targetCodex,rel);if(!exists(t))problems.push(`template .codex: missing ${rel}`);else if(text(t).replace(/\r/g,'')!==text(path.join(codex,rel)).replace(/\r/g,''))problems.push(`template .codex: content differs at ${rel}`);}
  for(const rel of files(path.join(codex,'roles'))){const t=path.join(targetCodex,'roles',rel);if(!exists(t)&&!rel.startsWith('run/')&&rel!=='on-demand/intent-documentation.md')problems.push(`template .codex: missing roles/${rel}`);}
  const tplManifest=path.join(targetCodex,'generated-skill-mirror.json');
  const names=exists(tplManifest)?JSON.parse(text(tplManifest)).skills:[];
  // Template skills are generalized copies (site names stripped), so only their presence is checked.
  for(const n of names){if(!exists(path.join(targetSkills,n,'SKILL.md')))problems.push(`template skill missing: ${n}`);}
}
function checkProfiles() {
  const excluded=projectRunProfiles();
  const manifestFile=path.join(codex,'generated-skill-mirror.json');
  const manifest=exists(manifestFile)?JSON.parse(text(manifestFile)).skills||[]:[];
  for(const name of excluded) {
    const nativeRole = path.join(codex, 'roles', 'run', name + '.md');
    const nativeOwned = exists(nativeRole) && /^origin: codex$/m.test(text(nativeRole));
    for(const rel of [`roles/run/${name}.md`,`roles/${name}.md`,`agents/${name}.toml`])
      if(exists(path.join(codex,rel)) && !(nativeOwned && rel !== `roles/${name}.md`))problems.push('Product Run profile in portable Codex layer: '+rel);
    if(manifest.includes(name))problems.push('Product Run profile in skill manifest: '+name);
  }
  const source=path.join(claudeAgents,'run');
  const names=files(source).filter(f=>f.endsWith('.md'));
  for(const rel of files(path.join(codex,'roles','run')).filter(f=>f.endsWith('.md'))) {
    const body=text(path.join(codex,'roles','run',rel));
    if(/^origin: codex$/m.test(body)) {
      if(!body.includes('## Takes / does not take')||!body.includes('## Boundary'))problems.push('Native Run profile criteria missing: '+rel);
      const nativeAgent=path.join(codex,'agents',rel.slice(0,-3)+'.toml');
      if(!exists(nativeAgent)||!/^model = "gpt-5.6-luna"$/m.test(text(nativeAgent))||!/^model_reasoning_effort = "low"$/m.test(text(nativeAgent)))problems.push('Native Run profile model drift: '+rel);
    } else if(!names.includes(rel))problems.push('Run profile canonical source missing: '+rel);
  }
  for(const rel of names) {
    const role=path.join(codex,'roles','run',rel), agent=path.join(codex,'agents',rel.slice(0,-3)+'.toml');
    if(exists(role)&&/^origin: codex$/m.test(text(role)))continue;
    // Generic installations supply profiles through the base Run agent; explicit project profiles are checked when present.
    if(!exists(role)&&!exists(agent))continue;
    if(!exists(role)||!text(role).includes('.claude/agents/run/'+rel)||!text(role).includes('.codex/CLAUDE-COMPAT.md'))problems.push('Run profile link drift: '+rel);
    if(!exists(agent)||!/^model = "gpt-5.6-luna"$/m.test(text(agent))||!/^model_reasoning_effort = "low"$/m.test(text(agent)))problems.push('Run profile model drift: '+rel);
  }
}
function syncProfiles() {
  const projectProfiles = projectRunProfiles();
  for (const rel of files(path.join(claudeAgents, 'run')).filter(f => f.endsWith('.md'))) {
    const name = rel.slice(0, -3);
    if (projectProfiles.has(name)) continue;
    const existing = path.join(codex, 'roles', 'run', rel);
    if (exists(existing) && /^origin: codex$/m.test(text(existing))) continue;
    const source = `.claude/agents/run/${rel}`;
    const desired = `# ${name} · Codex Run-profile adapter\n\nCanonical role: \`${source}\`. Read it completely with base \`.codex/roles/run.md\`; this file is only its Codex adapter.\n\n- Ignore Claude YAML frontmatter and apply \`.codex/CLAUDE-COMPAT.md\` to Claude tools, skills, scripts, MCP, and subagent references.\n- Codex mechanics and model settings come from \`.codex/CODEX-8.md\` and \`.codex/agents/${name}.toml\`; they never replace the canonical body.\n- Use only tools present in the live Codex session. Missing access or tools return to Kit through the route.\n`;
    const target = path.join(codex, 'roles', 'run', rel);
    const agent = path.join(codex, 'agents', name + '.toml');
    if (APPLY) {
      fs.mkdirSync(path.dirname(target), {recursive:true});
      fs.writeFileSync(target, desired);
      if (!exists(agent)) fs.writeFileSync(agent, text(path.join(codex, 'agents', 'run.toml'))
        .replace('name = "run"', `name = "${name}"`)
        .replace('Follow the Run form-check', `Read .codex/roles/run/${rel} and follow the Run form-check`));
    }
    if (!exists(target) || !sameText(text(target), desired)) problems.push('Run profile criteria drift: ' + rel);
  }
}
syncRoleLayer();
syncProfiles();
syncSkills();
if (!CODEX_ONLY) syncTemplate();
checkStatic();checkProfiles();
if(problems.length){console.error('Codex sync drift:\n- '+problems.join('\n- '));process.exit(1);}
console.log(APPLY ? (CODEX_ONLY ? 'Codex-only derived files synchronized.' : 'Codex derived files synchronized.') : (CODEX_ONLY ? 'Codex-only derived files are synchronized.' : 'Codex derived files are synchronized.'));
