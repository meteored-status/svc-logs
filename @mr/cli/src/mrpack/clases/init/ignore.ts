/**
 * Editor: José Antonio Jiménez
 * Fecha: Fri, 17 Jul 2026 12:09:53 GMT
 * Hash: 8d9d654f9c8cca6abdfd7bb371d6a52c
 * Versión: 2026.7.17+3-josantoniojimnez
 * Anterior: 2026.7.17+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-logs.git
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
