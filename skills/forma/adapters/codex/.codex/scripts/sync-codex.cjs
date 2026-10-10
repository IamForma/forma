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
function files(dir, prefix = '') { if (!exists(dir)) return []; return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e => { const rel=path.posix.join(prefix,e.name); return e.isDirectory()?files(path.join(dir,e.name),rel):e.isFile()?[rel]:[]; }).sort(); }
function copyTree(src,dst) { for (const rel of files(src)) { const out=path.join(dst,rel); fs.mkdirSync(path.dirname(out),{recursive:true}); fs.copyFileSync(path.join(src,rel),out); } }
function sameTree(a,b,label) { const af=files(a), bf=files(b); if (af.join('\n')!==bf.join('\n')) { problems.push(`${label}: file set differs`); return; } for (const rel of af) if (digest(path.join(a,rel))!==digest(path.join(b,rel))) problems.push(`${label}: content differs at ${rel}`); }
function codexMechanics(name, onDemand) {
  const key = `${onDemand ? 'on-demand/' : ''}${name}`;
  const rules = {
    spec: 'For a ready routine profile, write the complete six-unit Run kit while slicing and choose `route-2` with `why: ready`; Intent then dispatches Run directly. One Spec call may slice any number of independent cards; record its measured spend share on every card.',
    kit: 'Run inherits `gpt-5.6-luna`/`low` from its matching Codex TOML. A stronger model or effort needs a reason in the card history before dispatch. One Kit call may kit at most four related independent cards; after return, record each measured share with the Codex batch procedure.',
    intent: 'On `route-2` with a ready profile, dispatch Run directly without Kit. Run inherits `gpt-5.6-luna`/`low`; do not raise its model or effort without the Kit history reason. Record each shared batch spend through the Codex procedure.',
    run: 'Run inherits `gpt-5.6-luna`/`low` from its matching Codex TOML. A stronger model or effort is valid only when Kit recorded its reason in the card history before dispatch.',
    'on-demand/route-choice': 'A ready routine profile uses `route-2` (`why: ready`): Spec writes its complete kit and Intent dispatches Run directly. Run inherits `gpt-5.6-luna`/`low`; a stronger model or effort needs Kit\'s prior history reason. Spec batches independent slicing without a cap; Kit batches at most four related independent cards.',
    'on-demand/spend-line': 'Do not use Claude usage fields or readers. For a completed Codex rollout, bind each batch card with `node .codex/scripts/codex-usage.cjs --file <rollout.jsonl> --complete --card <card.md> --split K --share I --desc "<what this card received>"`; it splits measured N/R/T and adds `(batch I/K)`.',
  };
  return rules[key] ? `\n## Codex mechanics\n\n${rules[key]}\n` : '';
}
function adapter(name,onDemand=false) { const source=onDemand?`.claude/agents/on-demand/${name}.md`:`.claude/agents/${name}.md`; const title=onDemand?`${name} · Codex procedure adapter`:`${name[0].toUpperCase()}${name.slice(1)} · Codex role`; return `# ${title}\n\nCanonical ${onDemand?'procedure':'role'}: \`${source}\`. Read it completely; this file is only its Codex adapter.\n\n- Ignore Claude YAML frontmatter and apply \`.codex/CLAUDE-COMPAT.md\` to Claude tools, skills, scripts, MCP, and subagent references.\n- Codex mechanics and model settings come from \`.codex/CODEX-8.md\` and the matching agent TOML; they never replace the canonical body.\n- An unavailable live tool is an environment limitation and follows the route; it is never silently substituted.\n${codexMechanics(name,onDemand)}`; }
function syncRoleLayer() {
  for (const role of roles) { const canonical=path.join(claudeAgents,`${role}.md`), toml=path.join(codex,'agents',`${role}.toml`), target=path.join(codex,'roles',`${role}.md`); if (!exists(canonical)||!exists(toml)) { problems.push(`missing role component: ${role}`); continue; } const [model,effort]=models[role]; const desiredToml=text(toml).replace(/^model\s*=.*$/m,`model = "${model}"`).replace(/^model_reasoning_effort\s*=.*$/m,`model_reasoning_effort = "${effort}"`); if(APPLY&&desiredToml!==text(toml))fs.writeFileSync(toml,desiredToml); if(text(toml)!==desiredToml)problems.push(`model/tier drift: ${role}`); const desired=adapter(role); if(APPLY){fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,desired);} if(!exists(target)||!sameText(text(target),desired))problems.push(`role link drift: ${role}`); }
  const source=path.join(claudeAgents,'on-demand'); for(const rel of files(source).filter(f=>f.endsWith('.md'))) { const target=path.join(codex,'roles','on-demand',rel), desired=adapter(rel.slice(0,-3),true); if(rel==='intent-documentation.md' && exists(target)){if(!text(target).includes(`.claude/agents/on-demand/${rel}`)||!text(target).includes('.codex/CLAUDE-COMPAT.md'))problems.push(`procedure link drift: ${rel}`);continue;} if(APPLY){fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,desired);} if(!exists(target)||!sameText(text(target),desired))problems.push(`procedure link drift: ${rel}`); }
}
function syncSkills() {
  const names=exists(claudeSkills)?fs.readdirSync(claudeSkills,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name).sort():[]; const manifest=path.join(codex,'generated-skill-mirror.json'); const old=exists(manifest)?JSON.parse(text(manifest)).skills||[]:[];
  if(APPLY){for(const n of old.filter(n=>!names.includes(n)))fs.rmSync(path.join(agentSkills,n),{recursive:true,force:true});for(const n of names){fs.rmSync(path.join(agentSkills,n),{recursive:true,force:true});copyTree(path.join(claudeSkills,n),path.join(agentSkills,n));}fs.writeFileSync(manifest,JSON.stringify({skills:names},null,2)+'\n');}
  if(!exists(manifest)||JSON.stringify(JSON.parse(text(manifest)).skills||[])!==JSON.stringify(names))problems.push('skill mirror manifest drift'); for(const n of names){const target=path.join(agentSkills,n);if(!exists(target))problems.push(`skill mirror missing: ${n}`);else sameTree(path.join(claudeSkills,n),target,`skill mirror ${n}`);}
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
  const source=path.join(claudeAgents,'run');
  const names=files(source).filter(f=>f.endsWith('.md'));
  for(const rel of files(path.join(codex,'roles','run')).filter(f=>f.endsWith('.md'))) {
    if(!names.includes(rel))problems.push('Run profile canonical source missing: '+rel);
  }
  for(const rel of names) {
    const role=path.join(codex,'roles','run',rel), agent=path.join(codex,'agents',rel.slice(0,-3)+'.toml');
    // Generic installations supply profiles through the base Run agent; explicit project profiles are checked when present.
    if(!exists(role)&&!exists(agent))continue;
    if(!exists(role)||!text(role).includes('.claude/agents/run/'+rel)||!text(role).includes('.codex/CLAUDE-COMPAT.md'))problems.push('Run profile link drift: '+rel);
    if(!exists(agent)||!/^model = "gpt-5.6-luna"$/m.test(text(agent))||!/^model_reasoning_effort = "low"$/m.test(text(agent)))problems.push('Run profile model drift: '+rel);
  }
}
syncRoleLayer();
if (!CODEX_ONLY) { syncSkills(); syncTemplate(); }
checkStatic();checkProfiles();
if(problems.length){console.error('Codex sync drift:\n- '+problems.join('\n- '));process.exit(1);}
console.log(APPLY ? (CODEX_ONLY ? 'Codex-only derived files synchronized.' : 'Codex derived files synchronized.') : (CODEX_ONLY ? 'Codex-only derived files are synchronized.' : 'Codex derived files are synchronized.'));
