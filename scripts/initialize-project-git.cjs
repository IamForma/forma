#!/usr/bin/env node
'use strict'

const { existsSync, statSync, writeFileSync, readFileSync, appendFileSync, copyFileSync } = require('node:fs')
const { resolve, join } = require('node:path')
const { spawnSync } = require('node:child_process')

const projectRoot = resolve(process.argv[2] || '.')

if (!existsSync(projectRoot) || !statSync(projectRoot).isDirectory()) {
  console.error(`Project root does not exist or is not a directory: ${projectRoot}`)
  process.exit(1)
}

const gitVersion = spawnSync('git', ['--version'], { encoding: 'utf8' })
if (gitVersion.error || gitVersion.status !== 0) {
  console.error('Git is required before installing Forma. Install Git and rerun the installer; no protocol files were copied.')
  process.exit(1)
}

// Секреты окружения (AGENTS.md, запрет 15): .env в корне, вне git — в любом репозитории, новом или существующем.
function ensureEnv() {
  const gitignore = join(projectRoot, '.gitignore')
  let ignoreState = 'unchanged'
  if (existsSync(gitignore)) {
    const text = readFileSync(gitignore, 'utf8')
    if (!text.split(/\r?\n/).some((l) => l.trim() === '.env')) {
      appendFileSync(gitignore, (text && !text.endsWith('\n') ? '\n' : '') + '\n# Local secrets (Forma, prohibition 15)\n.env\n', 'utf8')
      ignoreState = '.env added'
    }
  }
  const example = join(__dirname, '..', 'skills', 'forma', 'core', '.env.example')
  const env = join(projectRoot, '.env')
  let envState = 'unchanged'
  if (!existsSync(env)) {
    if (existsSync(example)) copyFileSync(example, env)
    else writeFileSync(env, '', 'utf8')
    envState = 'created'
  }
  const exampleTarget = join(projectRoot, '.env.example')
  if (!existsSync(exampleTarget) && existsSync(example)) copyFileSync(example, exampleTarget)
  return `.env: ${envState}; .gitignore .env rule: ${ignoreState}`
}

const gitMarker = join(projectRoot, '.git')
if (existsSync(gitMarker)) {
  console.log(`Repository: existing; history/remote unchanged; ${ensureEnv()}`)
  process.exit(0)
}

const initialized = spawnSync('git', ['-C', projectRoot, 'init'], { encoding: 'utf8' })
if (initialized.status !== 0) {
  process.stderr.write(initialized.stderr || `git init failed for '${projectRoot}'; no protocol files were copied.\n`)
  process.exit(1)
}

const gitignore = join(projectRoot, '.gitignore')
let gitignoreState = 'unchanged'
if (!existsSync(gitignore)) {
  writeFileSync(gitignore, [
    '# Local secrets and dependencies',
    '.env',
    '.env.*',
    '!.env.example',
    'node_modules/',
    '',
    '# Runtime caches and logs',
    '.cache/',
    'dashboard/.cache/',
    '*.log',
    ''
  ].join('\n'), 'utf8')
  gitignoreState = 'created'
}

console.log(`Repository: initialized; .gitignore: ${gitignoreState}; ${ensureEnv()}`)
