# CODEMAP — `@mr/core-log`

Mapa técnico del workspace `@mr/core/log/`.

## Objetivo

Recoger los logs de un servicio y repartirlos entre destinos. Hoy solo hay un destino implementado, el
de WebSocket contra la ingesta de `status-external`; consola y Datadog están previstos y no escritos.

## Árbol de módulos

```text
@mr/core/log/
├─ modules/
│  ├─ interface.ts               — ESeveridad, EEntorno, entornoActual, IOrigen, ILog, ILogEmitido (con region/host), IWire, IDestino
│  ├─ pod.ts                     — solo Node: servicioDePod() y loggerDePod(), el logger de un servicio con lo que dice su pod
│  ├─ logger.ts                  — Logger: completa el log y lo reparte
│  └─ destino/
│     ├─ index.ts                — reexporta el vocabulario de destinos
│     ├─ base.ts                 — DestinoBuffer: buffer, urgencia, cola, avisos (sin transporte)
│     ├─ http.ts                 — DestinoHTTP: POST con fetch; sirve también en el navegador
│     └─ websocket.ts            — DestinoWebSocket: WSPool.head() (solo Node)
├─ spec/
│  ├─ destino-http.spec.ts       — 7 pruebas del destino, que valen para los dos (node:test)
│  └─ logger.spec.ts             — 13 pruebas del Logger y del entorno
├─ package.json                  — @mr/core-log; exports por módulo; script `test`
├─ tsconfig.json                 — extiende @mr/core-dev/tsconfig.json
├─ tsconfig.spec.json            — emite spec/ a tmp/spec para node --test
├─ tsconfig.browser.json         — typecheck de lo que puede usar el navegador (lib DOM, sin @types/node)
├─ tmp/                          — salida de las pruebas; generado, no se versiona
├─ README.md
├─ CODEMAP.md
└─ CHANGELOG.md
```

## Superficie pública

Los `exports` del `package.json` cierran el paquete: solo se puede importar lo declarado.

| Entrada | Qué expone |
|---------|------------|
| `@mr/core-log/interface` | `ESeveridad`, `EEntorno`, `entornoActual()`, `ILog`, `ILogEmitido`, `IWire`, `IDestino` |
| `@mr/core-log/logger` | `Logger`, `ILoggerConfig` |
| `@mr/core-log/destino` | el vocabulario de destinos, reexportado |
| `@mr/core-log/destino/base` | `DestinoBuffer`, `IDestinoBufferConfig` — para escribir un destino nuevo |
| `@mr/core-log/destino/http` | `DestinoHTTP`, `IDestinoHTTPConfig` |
| `@mr/core-log/destino/websocket` | `DestinoWebSocket`, `IDestinoWebSocketConfig` |

## Cómo encaja

```
log.info(tipo, mensaje, extra?)
        │
        ▼
  Logger.escribir()          — añade proyecto, servicio, severidad y timestamp
        │
        ├──► IDestino.enviar(ILogEmitido)     ── DestinoWebSocket ──► WSPool.head("/logs/service/")
        └──► …                                   (consola y Datadog, pendientes)
```

`Logger` no sabe a dónde va nada; los destinos no saben de quién es el log. Lo único que cruza esa
frontera es `ILogEmitido`.

Y en el otro sentido cruzan dos peticiones: `vaciar()` —entrega lo pendiente, el destino sigue vivo— y
`cerrar()` —lo mismo, y además suelta recursos—. Las dos son opcionales en `IDestino`: un destino que
escriba directo no tiene nada que vaciar.

Dentro de `DestinoWebSocket` hay dos etapas más, y conviene no confundirlas:

```
                     ┌─ severidad >= inmediatoDesde ─► urgentes[] ──(lote | siguiente turno | cerrar)─┐
enviar(log) ─────────┤                                                                                ├─► cola ─► entregar(IWire[])
                     └─ el resto ──────────────────► buffer[] ────(lote | vence esperaMs | cerrar)────┘   (uno a uno)
```

Todo eso vive en `DestinoBuffer`. Lo único que pone cada transporte es `entregar()` —y `liberar()`, si
tiene algo que soltar—: `pool.head()` en el de WebSocket, un `fetch` en el de HTTP. Por eso el de
WebSocket son 96 líneas y el de HTTP 75, con la misma funcionalidad.

Tres piezas y tres problemas distintos, que conviene no mezclar:

- **`buffer`** decide *cuántos logs normales van juntos* — ataca el coste por frame.
- **`urgentes`** decide *qué no espera* — ataca la pérdida del log que precede a una caída. Va aparte
  para no arrastrar a los que estaban esperando; el desorden entre ambos no importa porque los listados
  ordenan por `@timestamp`.
- **`cola`** decide *cuántos envíos hay a la vez* (uno) — ataca el número de conexiones.

## Decisiones que no se ven en el código

**`IDestino.enviar()` devuelve `void` y no puede lanzar.** Las dos cosas son la misma decisión: un log
es un efecto secundario de lo que el servicio esté haciendo de verdad, y un destino caído no puede ni
tumbar ni frenar a quien escribe. Un destino que no pueda entregar se apaña por dentro. Aun así,
`Logger.escribir()` envuelve cada destino en un `try`: no es defensa contra lo previsible, es defensa
contra un destino mal implementado, porque una excepción que se escapara ahí subiría hasta quien
escribió el log.

**La severidad viaja tal cual, numérica.** Estuvo años guardada como cadena con un número dentro
—herencia de `logs-web`, deshecha con un `parseInt` al leerla—, y se pasó a `byte` el 2026-09-08
aprovechando que el data stream estaba vacío: con datos dentro habría sido una migración, que es
justamente por lo que seguía así. Quien normaliza lo que llega de emisores antiguos es la ingesta
(`severidadDe()` en `status-external`), en el borde por donde entra lo no validado, y no el que lee.

**El aviso de fallo va por consola y con cuentagotas.** Por consola porque avisar con el propio logger
sería alimentar el bucle. Con cuentagotas porque el fallo típico no es un log suelto sino la ingesta
caída: sin limitarlo, cada log escribiría su línea de error. El primer fallo se avisa de inmediato —así
que ese aviso dirá «1» aunque detrás venga una avería entera— y por eso el mensaje dice cuándo será el
siguiente: callarse no significa haberse recuperado.

**`vaciar()` existe por los cronjobs.** Un proceso que se muere en cuanto termina su trabajo se lleva por
delante lo último que escribió, y en un cronjob lo último suele ser el resultado. Devuelve cuando lo que
estuviera pendiente **al llamarla** ha salido: en `DestinoWebSocket` eso es un solo `await this.cola`
—leída después de volcar, así que ya encadena los dos frames—, y no dos, porque un segundo arrastraría
además lo que otro haya encolado mientras tanto y volvería indeterminado lo que el método promete.

**El entorno se deduce, y se pregunta por `TEST` antes que por `PRODUCCION`.** El contrato de
`@mr/core-dev` es que test *también* lleva `PRODUCCION=true`, así que el orden inverso —el intuitivo—
etiquetaría todo test como producción. `entornoActual()` lee las constantes con `typeof` porque las
inlina el bundler y este paquete puede correr sin él (sus propias pruebas): sin la guarda sería un
`ReferenceError`, y con ella no cuesta nada, porque `typeof true` se pliega en compilación.

**«Inmediato» es el siguiente turno del bucle, no síncrono.** El envío ya era asíncrono —va encadenado en
la cola—, así que volcar síncronamente no adelantaría ni un `ws.send()`, ni salvaría a un proceso que se
muere en ese mismo tick. A cambio, una tormenta de errores en un tick sale en un solo frame en vez de uno
por error.

**Se agrupa por el coste del camino, no por Elasticsearch.** El `BulkAuto` del receptor ya junta lo que
le llega cada segundo, así que agrupar aquí no le quita trabajo. Lo que quita es lo de antes de llegar:
cada frame abre un span de Datadog (`websocket.<method>`), entra en la contabilidad de concurrencia y se
parsea por separado. El precio es hasta `esperaMs` de retraso y perder el buffer si el proceso muere de
golpe — de ahí que `cerrar()` vuelque.

**El destino compone la URL, y la ruta es parte del contrato.** El dominio es
`https://status.meteored.com` salvo que se diga otra cosa, y se le añade `/status/external/`. No es cosmético: con varios servicios en el mismo dominio, esa ruta es lo único que
mira el VirtualService de Istio, y una URL sin ella se la queda el servicio por defecto
(`status-frontend`) sin que la conexión falle. `WSPool` no admitía rutas hasta el 2026-09-08 — su
normalización pegaba el puerto detrás de la ruta; ver el `CHANGELOG` de `@mr/core-network`.

**El transporte se separó del resto porque el resto es casi todo.** Las dos primeras versiones del
destino de WebSocket se fueron en el buffer, la urgencia, la cola y el techo de pendientes, y ninguno de
esos problemas tiene que ver con hablar WebSocket. Con `DestinoBuffer` por medio, elegir transporte es
barato de verdad: cambiar de uno a otro es una línea en el arranque del servicio, y escribir un tercero
son unas setenta.

**Una conexión, y quien lo garantiza es la cola de envío, no `minConnections`.** El pool reparte una
conexión por petición en vuelo y crea las que le falten (`available.pop() ?? addConnection()`), así que
sin encadenar los envíos una ráfaga de N logs en el mismo tick abre N sockets — medido: 53 conexiones
para 53 logs, 1 encadenando. `minConnections: 1` solo evita tener nueve paradas calientes sin usar. La
cola tiene tope (`pendientes`): con el destino caído se descarta lo que sobre en vez de acumularlo.

**`region` y `host` son del logger, no del log.** Van en `ILoggerConfig` junto a `proyecto` y `servicio`
porque no cambian entre dos logs del mismo proceso: quien escribe pone `info(tipo, mensaje)` y no tiene que
acordarse de dónde está corriendo.

**De dónde salen los tres es `modules/pod.ts`, y está aparte a propósito.** `loggerDePod({pod, proyecto,
destinos})` compone el nombre con el que se firma el servicio, la zona y el host a partir del `IPodInfo`
que cualquier servicio del monorepo tiene ya resuelto en su configuración, y deja a cada emisor en una
línea. Vive en su propio fichero porque **lee `process.env`** (`DD_SERVICE`, `K8S_NAMESPACE`) y `logger.ts`
tiene que poder cargarse en el navegador — misma separación que `destino/http` y `destino/websocket`.

Que esa convención esté aquí y no copiada en cada servicio no es comodidad: el nombre `<namespace>/<nombre>`
lo componen ya por su cuenta el `run.sh` del `Dockerfile` (para Datadog) y los prefijos de clave de redis y
de valkey, y cada emisor nuevo sería un cuarto sitio donde equivocarse distinto.

`ILoggerConfig` acepta el pod **y** los tres campos sueltos, y los sueltos ganan: es lo que permite
quedarse con el resto y corregir uno. `IOrigen` declara solo los tres campos que hacen falta en vez de
importar `IPodInfo`, que arrastraría `node:os` y `services-comun` a un paquete que tiene que servir en el
navegador; TypeScript es estructural, así que un `IPodInfo` encaja tal cual.

Una **cadena vacía cuenta como no tenerlos** y el campo no viaja: es lo que devuelve un `process.env` que
no está puesto, que es el caso normal en local, y un campo en blanco en el registro se lee como un dato y
no como un hueco. Mismo criterio que el `entorno` de la ingesta.

**`IWire` se declara aquí y `services/status-external` lo importa.** Tiene que ir en esta dirección: el
emisor no puede importarlo del receptor, porque `@mr/core-*` lo tienen todos los proyectos y
`services-comun-status` no.

## Qué puede usar el navegador

El navegador solo es cliente, y de aquí puede usar `modules/interface.ts`, `modules/logger.ts`,
`modules/destino/base.ts` y `modules/destino/http.ts`: no tocan nada de Node —solo `fetch` y
`setTimeout`—. `modules/destino/websocket.ts` **no**, porque `WSPool` arrastra `dd-trace`, `node:crypto` y
`services-comun/modules/utiles/log`, que importa `node:os` y `node:cluster`. Y `modules/pod.ts` tampoco,
que lee `process.env`.

No es una declaración de intenciones: `tsconfig.browser.json` typechequea esos cuatro ficheros con
`lib: ["esnext","dom"]` y `types: ["@mr/core-dev"]` —los globales del bundler, y nada de `@types/node`—,
y va **el primero** en el script `test`. Un `import` de Node en
cualquiera de los dos y las pruebas ni arrancan (comprobado metiendo `node:os` en `logger.ts`).

Lo único de Node que había en el código propio era el tipo del temporizador; ahora sale de
`ReturnType<typeof setTimeout>`, y el `unref()` —que no existe en el navegador— va con `?.`.

## Pruebas

```bash
yarn workspace @mr/core-log test
```

Typechequea primero lo que puede usar el navegador y luego compila `spec/` a `tmp/spec` con
`tsconfig.spec.json` para pasarlo por `node --test`, igual que `framework/services-comun` y
`@mr/core-i18n`.

**El destino se prueba a través de `DestinoHTTP`, y no es un apaño.** Solo usa `fetch`, así que se puede
cargar en este arnés; `DestinoWebSocket` importa `WSPool`, y los `exports` del monorepo apuntan a `.ts`,
que no se resuelven en runtime sin bundler. Como toda la lógica está en `DestinoBuffer`, lo que se
comprueba por HTTP —agrupación, urgencia, orden, `vaciar()`, techo de pendientes, avisos— vale igual para
el de WebSocket.

Lo que no cubre el arnés es lo propio de cada transporte, y eso se ha medido contra servidores de verdad:
por WebSocket, una sola conexión, la ruta `/status/external/`, 53 logs en 3 frames con `lote: 20` y 21
errores en un frame a los 6 ms mientras un `info` anterior esperaba sus 800; por HTTP, 52 logs en 4
peticiones sobre 2 conexiones TCP, con su `content-type` y su URL, y un 500 apareciendo en el aviso.

**Al borrar o renombrar una prueba, limpiar `tmp/spec`.** No se vacía entre ejecuciones, así que el
`.js` de una prueba que ya no existe se sigue ejecutando.
