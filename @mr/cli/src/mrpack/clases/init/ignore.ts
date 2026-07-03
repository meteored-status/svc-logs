/**
 * Editor: José Antonio Jiménez
 * Fecha: Thu, 25 Jun 2026 06:52:42 GMT
 * Hash: f7c3b605fd465bf66b08a131be490ed8
 * Versión: 2026.6.25+5-josantoniojimnez
 * Anterior: 2026.6.25+4-josantoniojimnez
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
vscode.code-workspace
`.trimStart();
