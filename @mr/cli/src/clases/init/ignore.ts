/**
 * Editor: Bixus
 * Fecha: Mon, 16 Nov 2026 08:32:54 GMT
 * Hash: 422cfdc8f3786e9050eca9a7295d4159
 * Versión: 2026.11.16+2-bixus
 * Anterior: 2026.9.7+1-bixus
 * Proyecto: https://github.com/alpred/meteored-svc-proxy.git
 */

export default `
**/.claude/settings.local.json
**/.claude/scheduled_tasks.lock
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
