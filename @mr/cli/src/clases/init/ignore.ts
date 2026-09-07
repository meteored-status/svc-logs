/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: 8d9d654f9c8cca6abdfd7bb371d6a52c
 * Versión: 2026.9.7+1-bixus
 * Anterior: 2026.7.17+3-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

export default `
**/.claude/settings.local.json
.codex/
.DS_Store
.dev.vars
.idea/copilot/
.idea/dataSources.xml
.idea/jetClient/state-backup-*.xml
.idea/watcherTasks.xml
.idea/php.xml
.idea/sonarlint/
.idea/workspace.xml
.next/
.pnp.*
.wrangler/
.yarn/*
!.yarn/patches
!.yarn/plugins
!.yarn/releases
!.yarn/sdks
!.yarn/versions
**/files/*
**/output/*
!**/output/.foreverignore
config.workspaces.json
i18n/.credenciales
i18n/**/*.ts
node_modules/
services-*/files
services-*/output
tmp/
tsconfig.tsbuildinfo
vendor/
**/.dev*.local
**/.dev*.test
**/.env*.local
**/.env*.test
**/coverage/**
vscode.code-workspace
`.trimStart();
