# MRPack Root Manifest V1
El archivo de manifiesto de MRPack es un archivo JSON que contiene información sobre el workspace y sus dependencias. El archivo de manifiesto se llama `mrpack.json` y debe estar en la raíz de cada workspace que dará lugar a una compilación.

---
## IManifest
```typescript
interface IManifest {
    deploy: IManifestDeployment;
}
```
- `deploy`: Información sobre el despliegue.
    - **tipo** [IManifestDeployment](#imanifestdeployment).

---
## IManifestDeployment
```typescript
interface IManifestDeployment {
    build: IManifestDeploymentBuild;
    run: IManifestDeploymentRun;
}
```
- `build`: Información relativa a la compilación de los workspaces.
    - **tipo**: [IManifestDeploymentBuild](#imanifestdeploymentbuild).
    - **opcional**: Por defecto `true`.
- `run`: Información relativa a la ejecución del despliegue.
    - **tipo**: [IManifestDeploymentRun](#imanifestdeploymentrun).
    - **opcional**: Por defecto `true`.

---
## IManifestDeploymentBuild
```typescript
interface IManifestDeploymentBuild {
    enabled: boolean;
    force: boolean;
}
```
- `enabled`: Indica si se ha de compilar el proyecto o no.
    - **tipo**: boolean
    - **opcional**: Por defecto `true`.
- `force`: Indica si se ha de forzar una nueva versión aunque no haya cambios.
    - **tipo**: boolean
    - **opcional**: Por defecto `false`.

---
## IManifestDeploymentRun
```typescript
interface IManifestDeploymentRun {
    enabled: boolean;
    latest: boolean;
}
```
- `enabled`: Indica si se ha de ejecutar el despliegue o no.
    - **tipo**: boolean
    - **opcional**: Por defecto `true`.
- `latest`: Indica si se ha de desplegar la última versión o la actual. Esto es útil cuando se ha generado previamente
  una versión nueva pero no se ha desplegado, por lo que se seguiría desplegando la versión anterior en caso de solo
  desplegar (sin generar)
    - **tipo**: boolean
    - **opcional**: Por defecto `false`.
