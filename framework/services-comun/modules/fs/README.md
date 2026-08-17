# `services-comun/modules/fs`

Utilidades de acceso a ficheros: documentos respaldados por el sistema de ficheros local
(`File`) o por Google Cloud Storage (`Storage`/`StorageError`/`StorageClient`), y resolución
segura de rutas dentro de un directorio `assets/` local (`resolveAsset`).

---

## Contenido

| Fichero | Descripción |
|---------|-------------|
| [`file.ts`](#file) | `File` — documento respaldado por un fichero local |
| [`storage.ts`](#storage--storageerror--storageclient) | `Storage` / `StorageError` / `StorageClient` — documentos respaldados por Google Cloud Storage |
| [`assets.ts`](#resolveasset) | `resolveAsset(...partes)` — resuelve una ruta relativa dentro de `assets/`, protegiendo contra path traversal |

---

## `File`

**Entrada:** `services-comun/modules/fs/file`

Documento mínimo respaldado por un fichero local: expone su contenido como `buffer` o `stream`
a partir de una ruta.

```ts
import {File} from "services-comun/modules/fs/file";

const doc = new File("assets/logo/meteored.svg");
await doc.buffer; // Buffer
doc.stream;       // NodeJS.ReadableStream
```

### Interfaz `IFile`

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `buffer` | `Promise<Buffer>` | Contenido completo del fichero. |
| `stream` | `NodeJS.ReadableStream` | Stream de lectura del fichero. |

---

## `Storage` / `StorageError` / `StorageClient`

**Entrada:** `services-comun/modules/fs/storage`

Documentos respaldados por Google Cloud Storage. Todas implementan `IDocumento` (extiende
`IFile` con `contentType`, `timeCreated`, `timeUpdated` y `size`), por lo que son
intercambiables entre sí desde el punto de vista de un handler HTTP.

### Interfaz `IDocumento`

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `contentType` | `string` | MIME type del documento. |
| `timeCreated` | `Date` | Fecha de creación. |
| `timeUpdated` | `Date` | Fecha de última modificación. |
| `size` | `Promise<number>` | Tamaño en bytes. |
| `buffer` | `Promise<Buffer>` | (heredado de `IFile`) contenido completo. |
| `stream` | `NodeJS.ReadableStream` | (heredado de `IFile`) stream de lectura. |

### `Storage`

Documento cuyo backend es un bucket de Google Cloud Storage (vía `@google-cloud/storage`).

| Método estático | Descripción |
|------------------|-------------|
| `Storage.get(config, buckets, file)` | Busca `file` en `buckets` (en orden) y devuelve el primero que exista; rechaza si no está en ninguno. |
| `Storage.getOne(config, bucket, file)` | Igual, pero sobre un único bucket ya conocido. |
| `Storage.getAll(config, buckets, prefix)` | Lista y descarga metadata de todos los ficheros bajo `prefix` en todos los `buckets`. |
| `Storage.list(config, bucket, prefix?)` | Lista los ficheros (sin descargar metadata) bajo `prefix`. |
| `Storage.uploadBuffer(config, buckets, filename, type, datos, retry?, options?)` | Sube un `Buffer` a todos los `buckets`, con reintentos automáticos (`Storage.MAX_RETRIES = 10`). |
| `Storage.uploadStream(config, buckets, filename, type, datos, options?)` | Sube un stream a todos los `buckets` en paralelo. |
| `Storage.delete(config, bucket, file)` | Borra un fichero; devuelve `false` si falla (no lanza). |
| `Storage.getFile(config, bucket, file)` | Devuelve el `File` del SDK de Google subyacente, sin descargar nada. |

### `StorageError`

`IDocumento` de fallback respaldado por un fichero **local** (usa las mismas utilidades de
`utiles/fs`). Se usa como sustituto cuando `Storage.get` rechaza (fichero no encontrado en
ningún bucket), para poder servir siempre una imagen/documento de error sin romper el flujo
del handler.

```ts
new StorageError("assets/error-news.jpg", "image/jpeg");
```

### `StorageClient`

Envoltorio con estado (`config`/`buckets` ya fijados) sobre los métodos de instancia más
comunes de `Storage`, para no repetirlos en cada llamada:

```ts
const client = StorageClient.build({config, buckets: [bucket]});
await client.get(file);
await client.uploadBuffer(filename, type, datos);
```

---

## `resolveAsset`

**Entrada:** `services-comun/modules/fs/assets`

Resuelve una ruta relativa dentro del directorio `assets/` (relativo al `cwd` del proceso) y
comprueba que el resultado no se escape de él. Uso obligatorio en cualquier handler HTTP que
construya una ruta de fichero local a partir de datos de la URL (segmentos `regex`/`prefix`):
sin esta comprobación, una URL como `/img/foo/../../etc/passwd` podría leer ficheros
arbitrarios del sistema fuera de `assets/`.

```ts
import fs from "node:fs";
import {resolveAsset} from "services-comun/modules/fs/assets";

const file = resolveAsset("logo", `${name}.svg`); // -> "<cwd>/assets/logo/<name>.svg", o null
if (file === null) {
    return conexion.error(404, "Not found");
}
return conexion.sendStream(fs.createReadStream(file));
```

### Firma

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `...partes` | `string[]` | Segmentos de ruta relativos a `assets/` (pueden incluir `/`). |

**Devuelve:** la ruta absoluta resuelta dentro de `assets/`, o `null` si el resultado se
saldría de ese directorio (path traversal).
