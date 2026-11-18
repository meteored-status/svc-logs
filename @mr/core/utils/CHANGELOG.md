# [Changelog](https://keepachangelog.com/en/1.1.0/)

## 2026.11.18 10:00 — [Miguel]

### Added

- **Unidades** (`src/unidades/`, exports `./unidades`, `./unidades/portal` y `./unidades/*`): las unidades de medida, movidas desde `services-comun` y separadas por magnitud, y su uso por portal.
- **APIs de geolocalización** (`src/navegador/apis/geolocation.ts`, export `./apis/geolocation`): `requestGeolocation` y `getLocation`, movidas desde `@mr/user-mr-components`.
- **Comunicación** (`src/navegador/communication/`, `src/navegador/objects/interceptar.ts` y `src/navegador/storages/cookies/`): `Comunicacion` con estrategias y eventos propios (`EstrategiaNavegador` y sus transportes), conexión directa de un objeto ya construido con `Comunicacion.conectar` y las cookies. **BREAKING:** desaparece la interfaz pública (`Comunicacion.add`, `conectarInterfaz`, `crearInterfazPublica`...): todo se conecta con `Comunicacion.conectar(nombre, instancia, signal?)`; `conectarInterfaz(this, {nombre, comunicacion})` pasa a `comunicacion?.conectar(nombre, this)`.

---

## 2026.6.17 — [Jose]

### Added

- **`README.md`** *(nuevo)* — documentación pública del paquete: descripción, tabla de
  módulos, patrón de extensión y jerarquía de configuración del monorepo.

- **`CODEMAP.md`** *(nuevo)* — mapa técnico: árbol de ficheros, superficie pública de
  `src/config.ts` y tabla de consumidores directos del paquete.

### Changed

- **`src/config.ts`** — JSDoc completo en `IConfiguracion` y `Configuracion<T>`:
  descripción de responsabilidades, parámetro genérico `@template T` y ejemplo de patrón
  de extensión en subclases.

---

## 2024.11.11+1
