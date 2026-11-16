# `@mr/core-log`

El logging de los servicios del monorepo: recoger lo que un servicio quiere dejar escrito y llevarlo a
donde toque —consola, Datadog o la ingesta remota—.

**Código fuente:** ver [`CODEMAP.md`](./CODEMAP.md).

> **Estado: en obras.** Hay dos destinos, los dos contra la ingesta de `status-external`: `http` y
> `websocket`. Consola y Datadog siguen, de momento, en `services-comun/modules/utiles/log`, que este
> paquete **no** sustituye todavía.

---

## Por qué existe

Los servicios ya escriben por consola con `services-comun/modules/utiles/log`, y aparte algunos mandan
logs a la ingesta de `status-external` por HTTP, cada uno con su propio código. Son dos caminos
distintos para la misma frase —«ha pasado esto»— y solo uno de ellos está en un sitio común.

Este paquete es el sitio común. Quien loguea escribe una vez; **a dónde va eso es configuración**, no
código repetido en cada servicio.

Vive en `@mr/core/*` y no en `framework/*` porque lo necesita cualquier servicio de cualquier proyecto,
tenga o no el dominio status: `@mr/core-*` es lo que todos tienen.

---

## Uso

```ts
import {DestinoHTTP} from "@mr/core-log/destino/http";
import {Logger} from "@mr/core-log/logger";

const log = Logger.build({
    proyecto: "MI-PROYECTO",
    servicio: "mi-servicio",
    destinos: [
        new DestinoHTTP(),   // o new DestinoWebSocket(), ver más abajo
    ],
});

log.info("arranque", "el servicio ha arrancado");
log.error("elastic", "no se ha podido indexar", ["índice: mr-algo", "id: 1234"]);

// Antes de dejar morir el proceso (un cronjob que termina, un Engine que baja):
await log.vaciar();
```

**`vaciar()` no es opcional en un cronjob.** Los destinos agrupan y encolan, así que lo último que se
escribe es justo lo que se pierde — y en un cronjob lo último suele ser el resultado. Devuelve cuando lo
que estuviera pendiente al llamarla ya ha salido, y deja el logger utilizable; `cerrar()` hace lo mismo y
además suelta el pool.

El primer argumento es el **tipo**: en el panel es un filtro con lista de valores, sacada de los propios
documentos. Conviene un puñado corto de valores estables por servicio, no una frase distinta cada vez.

El **entorno** —desarrollo, test o producción— no se pasa: se deduce de las constantes que inlina el
bundler. Se mira `TEST` antes que `PRODUCCION` porque test *también* es producción, que es el contrato de
`@mr/core-dev` y el error fácil de cometer. Si hiciera falta imponerlo, `Logger.build({..., entorno})`.

---

## Cuál de los dos destinos

Los dos hacen lo mismo contra el mismo servicio, con el mismo cuerpo y la misma agrupación: **toda esa
lógica está en `DestinoBuffer`, y lo que cambia es cómo se entrega el lote**. Cambiar de uno a otro es una
línea en el arranque del servicio.

|  | `DestinoHTTP` | `DestinoWebSocket` |
|--|--|--|
| Navegador | **sí** | no (`WSPool` es de Node) |
| Se entera de un fallo del servidor | sí, por el código | no, `head()` no contesta |
| Estado de conexión | ninguno | reconexión, heartbeat, circuit breaker |
| Reparto entre réplicas | por petición | por conexión, hasta 9 min pegado a una |
| Se depura con `curl` | sí | no |
| Coste por entrega | cabeceras y enrutado | prácticamente nada |

**Si no hay una razón para lo contrario, `DestinoHTTP`.** Lo que abarata el envío es agrupar, y eso lo
hacen los dos; lo que añade el WebSocket por encima —no repetir cabeceras, no recibir respuesta— es poco
cuando ya van cien logs por entrega, y a cambio hay que mantener una conexión viva.

El WebSocket se gana su sitio si el canal se va a usar para algo más que logs —empujar estado al panel,
un tail en vivo— o si el volumen sube lo bastante como para que el coste por petición pese. Con lotes de
cien, ese punto está lejos.

## Lo que hay que saber antes de enchufarlo

**No hace falta configurar nada para producción**: el `socket` es `https://status.meteored.com` por
defecto, que es donde publican los servicios del dominio status. Se cambia para apuntar a un entorno de
pruebas o para ir directo al servicio desde dentro del clúster (`ws://status-external:8080`).

**El socket va sin ruta: la pone el destino**, que le añade `/status/external/`. Eso es **lo que
enruta**: varios servicios comparten el dominio y lo único que mira el VirtualService de Istio para
decidir a cuál va el upgrade es la ruta. Omitirla no da un error de conexión — se la queda el servicio
por defecto, `status-frontend`—, así que el síntoma sería que los logs no llegan sin que nada parezca
roto. Se puede cambiar con `ruta` si el despliegue la mueve.

**No hay acuse de recibo.** El destino WebSocket usa `WSPool.head()`, que el servidor atiende sin
contestar. Nadie sabe si el log llegó a Elasticsearch, igual que ya pasaba con la ingesta por HTTP: se
contesta antes de indexar. Es deliberado —quien loguea no puede quedarse esperando— pero significa que
esto **no sirve para nada que tenga que estar sí o sí**.

**Las entregas se encadenan, no se lanzan a la vez.** En el WebSocket eso es lo que garantiza una sola
conexión, y no es un detalle de eficiencia: `WSPool` reparte una conexión por petición en vuelo y crea las
que le falten, así que sin encadenar **cincuenta logs en el mismo tick abren cincuenta sockets** —medido:
53 conexiones para 53 logs, y 1 con la cola—. En HTTP hace lo propio con el agente: 52 logs salieron en 4
peticiones sobre 2 conexiones TCP. De propina, los lotes salen en orden.

La cola solo se llena si el otro extremo no está, y tiene tope (`pendientes`, 1000 por defecto): pasado
ese punto se descartan. Perder logs es mejor que comerse la memoria del proceso que los escribe.

**Los logs van agrupados**: hasta `lote` (100) por frame, o lo que haya cuando vencen `esperaMs`
(1000 ms) desde el primero. Lo que ahorra no está en Elasticsearch —el `BulkAuto` del receptor ya junta
lo que le llega cada segundo—, está en el camino: cada frame que entra abre **un span de Datadog**, pasa
por la contabilidad de concurrencia del servidor y se parsea aparte. Cincuenta logs eran cincuenta spans.

El precio es retraso —hasta un segundo para un log suelto en un servicio tranquilo— y, sobre todo, que
**lo que está en el buffer se pierde si el proceso muere de golpe**. Por eso `cerrar()` vuelca antes de
soltar el pool: un apagado ordenado no pierde nada, y solo un `SIGKILL` se lleva hasta un segundo de
logs. Si un servicio necesita que todo salga ya, `lote: 1` desactiva la agrupación.

**De `ERROR` para arriba no se espera** (`inmediatoDesde`). El log que más falta hace es el que precede a
una caída, y es justo el que se quedaría en el buffer. Van en un buffer aparte, así que salen sin
arrastrar a los que estaban esperando: entre ellos pueden desordenarse y da igual, porque los listados
ordenan por `@timestamp`, que lo pone quien escribe el log.

«Inmediato» es *en el siguiente turno del bucle*, no síncrono, y eso es a propósito por partida doble: el
envío ya era asíncrono —va encadenado—, así que volcar síncronamente no adelantaría nada; y así una
tormenta de errores en el mismo tick sigue saliendo en **un** frame en vez de degenerar en uno por error,
que es lo último que quieres cuando algo se está cayendo. Medido: 21 errores en un frame a los 6 ms,
mientras un `info` anterior salía a los 800.

**La severidad viaja como número** (`ESeveridad`). Se guardaba como cadena con un número dentro hasta el
2026-09-08 —herencia de `logs-web`, con un `parseInt` al leerla—, y se pudo arreglar porque el data
stream estaba vacío. Los emisores que la sigan mandando como texto no se rompen: la ingesta la normaliza.

---

## Qué se puede usar desde el navegador

El navegador solo es cliente, y de este paquete puede usar **`@mr/core-log/logger` y
`@mr/core-log/interface`**, que no tocan nada de Node. Está comprobado, y no de palabra: `yarn workspace
@mr/core-log test` los typechequea antes que nada con `tsconfig.browser.json` —`lib: ["esnext","dom"]` y
`types: []`—, así que el día que a uno de los dos se le cuele un `import` de Node, las pruebas no
arrancan.

A eso se suman **`@mr/core-log/destino/base` y `@mr/core-log/destino/http`**, que solo usan `fetch` y
`setTimeout`. O sea que desde el navegador se puede loguear con el mismo código que en Node.

**`@mr/core-log/destino/websocket` es lo único que es solo de Node**, y no por poco: usa `WSPool`, que a
su vez arrastra `dd-trace`, `node:crypto` y `services-comun/modules/utiles/log`, que importa `node:os` y
`node:cluster`.

---

## El contrato del cable vive aquí

`IWire` (`@mr/core-log/interface`) es el cuerpo que acepta la ingesta, y **es la única declaración**:
`services/status-external` lo importa de aquí, y su `ILogServicioPOST` no es más que un alias por el
nombre.

Va en esta dirección y no en la contraria porque el emisor no podría importarlo del receptor: `@mr/core-*`
lo tienen todos los proyectos y `services-comun-status` no. Al revés sí funciona, porque quien indexa
también tiene los `@mr/core-*`.

Dos detalles del tipo que conviene no perder. `timestamp` y `entorno` son **opcionales**. Quien emite con este paquete lo
pone siempre, pero llevan años entrando logs por HTTP de emisores que no lo mandan, y el receptor
construye el objeto con un `as` sobre el cuerpo sin validar. Darlos por obligatorios sería el tipo
mintiendo sobre lo que de verdad llega. Y cuando el entorno no viene **no se indexa nada**, en vez de
poner uno por defecto: un log sin entorno es un log del que no se sabe, no un log de desarrollo.

---

## Lo que falta

- Destinos de **consola** y **Datadog**, que es lo que hoy hace `services-comun/modules/utiles/log`.
- En el navegador, mandar lo que quede pendiente al cerrar la pestaña. `fetch` normal no sirve para eso;
  lo que sirve es `sendBeacon` o `fetch` con `keepalive`, que tiene un tope de 64 KB de cuerpo y por eso
  no se ha activado sin más.
- Decidir si esto termina sustituyendo a `services-comun/modules/utiles/log` o conviviendo con él. Su
  API es variádica (`info(...txt)`) y la de aquí es estructurada (`tipo`, `mensaje`, `extra`), que es lo
  que la ingesta necesita; convertir una en otra no es gratis y conviene decidirlo antes de migrar nada.
