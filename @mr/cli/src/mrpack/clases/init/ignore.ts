/**
 * Editor: José Antonio Jiménez
 * Fecha: Tue, 26 May 2026 12:02:26 GMT
 * Hash: ad667199f510b646125988bbd754f86d
 * Versión: 2026.5.26+1-josantoniojimnez
 */

export default `
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
**/.vscode/**
vscode.code-workspace
`.trimStart();
