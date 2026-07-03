/**
 * Editor: José Antonio Jiménez
 * Fecha: Fri, 26 Jun 2026 10:53:57 GMT
 * Hash: 7158629e47249d9a1b3d637bcb5a194d
 * Versión: 2026.6.26+7-josantoniojimnez
 * Anterior: 2026.6.26+6-josantoniojimnez
 * Proyecto: https://github.com/alpred/meteored-web-www.git
 */

import {Storage} from "@google-cloud/storage";

import {buffer2stream, pipeline} from "services-comun/modules/utiles/stream";

import {calcularDiffOps, DIFF_CONTEXTO, indicesConContexto} from "../../utiles/diff";

/**
 * Estado de un fichero en el log de push.
 *
 * - `"cambiado"`  — fichero modificado.
 * - `"nuevo"`     — fichero creado en esta versión.
 * - `"eliminado"` — fichero borrado en esta versión.
 */
export type TEstadoArchivoPush = "cambiado" | "nuevo" | "eliminado";

/**
 * Información de un fichero con su contenido original y nuevo para calcular el diff.
 *
 * @property archivo            - Ruta relativa al directorio raíz del paquete.
 * @property estado             - Estado del fichero en este push.
 * @property contenidoOriginal  - Contenido antes del push (sin bloque de autoría para `.ts`).
 * @property contenidoNuevo     - Contenido después del push (sin bloque de autoría para `.ts`).
 */
export interface IArchivoConDiff {
    archivo: string;
    estado: TEstadoArchivoPush;
    contenidoOriginal: string;
    contenidoNuevo: string;
}

/**
 * Datos completos de un push para generar el log HTML.
 *
 * @property autor           - Nombre del autor del push.
 * @property version         - Nueva versión publicada.
 * @property versionAnterior - Versión antes del push.
 * @property npmName         - Nombre npm del paquete.
 * @property proyecto        - URL del repositorio o homepage del paquete.
 * @property fecha           - Fecha y hora del push.
 * @property archivos        - Lista de ficheros con sus contenidos original y nuevo.
 */
export interface IPushLogData {
    autor: string;
    version: string;
    versionAnterior: string;
    npmName: string;
    proyecto: string;
    fecha: Date;
    archivos: IArchivoConDiff[];
}

/* ─── Algoritmo de diff ─────────────────────────────────────────────────────── */

type TDiffOp = "equal" | "add" | "remove" | "separator";

interface IDiffEntry {
    op: TDiffOp;
    value: string;
    lineOld: number;
    lineNew: number;
}

/** Máximo de líneas por lado para el diff de logs HTML (ficheros más grandes se muestran sin diff). */
const MAX_DIFF_LINES_HTML = 2000;

function splitLineas(text: string): string[] {
    if (text === "") {
        return [];
    }
    const lines = text.split("\n");
    if (lines[lines.length - 1] === "") {
        lines.pop();
    }
    return lines;
}

function computeLineDiff(oldText: string, newText: string): IDiffEntry[] {
    const oldLines = splitLineas(oldText);
    const newLines = splitLineas(newText);

    const rawOps = calcularDiffOps(oldLines, newLines, MAX_DIFF_LINES_HTML);

    if (rawOps === null) {
        // Fichero demasiado grande: mostrar todas las líneas eliminadas y luego todas las añadidas
        const result: IDiffEntry[] = [];
        for (let i = 0; i < oldLines.length; i++) {
            result.push({op: "remove", value: oldLines[i], lineOld: i + 1, lineNew: 0});
        }
        for (let i = 0; i < newLines.length; i++) {
            result.push({op: "add", value: newLines[i], lineOld: 0, lineNew: i + 1});
        }
        return result;
    }

    const mostrar = indicesConContexto(rawOps, DIFF_CONTEXTO);

    if (mostrar.size === 0) {
        return [];
    }

    let lineOld = 0;
    let lineNew = 0;
    const withNumbers: IDiffEntry[] = rawOps.map(raw => {
        if (raw.tipo === "equal") {
            return {op: raw.tipo, value: raw.linea, lineOld: ++lineOld, lineNew: ++lineNew};
        } else if (raw.tipo === "remove") {
            return {op: raw.tipo, value: raw.linea, lineOld: ++lineOld, lineNew: 0};
        } else {
            return {op: raw.tipo, value: raw.linea, lineOld: 0, lineNew: ++lineNew};
        }
    });

    // Filtrar al contexto con separadores entre bloques
    const result: IDiffEntry[] = [];
    let prevIncluido = false;
    for (let i = 0; i < withNumbers.length; i++) {
        if (mostrar.has(i)) {
            result.push(withNumbers[i]);
            prevIncluido = true;
        } else if (prevIncluido) {
            result.push({op: "separator", value: "", lineOld: 0, lineNew: 0});
            prevIncluido = false;
        }
    }
    return result;
}

/* ─── Utilidades HTML ───────────────────────────────────────────────────────── */

function pad2(n: number): string {
    return String(n).padStart(2, "0");
}

/**
 * Formatea una fecha en hora local con zona horaria explícita.
 * Ejemplo: `2026-06-26 14:32:07 Europe/Madrid (UTC+02:00)`
 *
 * @param fecha - Fecha a formatear.
 * @returns Cadena con formato `YYYY-MM-DD HH:MM:SS TZ (UTC±HH:MM)`.
 */
function formatearFechaLocal(fecha: Date): string {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const offsetMin = -fecha.getTimezoneOffset();
    const offsetSign = offsetMin >= 0 ? "+" : "-";
    const offsetH = pad2(Math.floor(Math.abs(offsetMin) / 60));
    const offsetM = pad2(Math.abs(offsetMin) % 60);
    return `${fecha.getFullYear()}-${pad2(fecha.getMonth() + 1)}-${pad2(fecha.getDate())} `
        + `${pad2(fecha.getHours())}:${pad2(fecha.getMinutes())}:${pad2(fecha.getSeconds())} `
        + `${tz} (UTC${offsetSign}${offsetH}:${offsetM})`;
}

/**
 * Determina si un fichero cambiado debe mostrarse en la sección de diffs del log HTML.
 * Se excluyen binarios (`bin/min/`) y ficheros de documentación generada que no aportan
 * valor como diff (`CHANGELOG.md`, `CODEMAP.md`).
 *
 * @param archivo - Ruta relativa al directorio raíz del paquete.
 */
function esDiffable(archivo: string): boolean {
    if (archivo.startsWith("bin/min/")) {
        return false;
    }
    const nombre = archivo.split("/").pop()!;
    return nombre !== "CHANGELOG.md" && nombre !== "CODEMAP.md";
}

/** Hoja de estilos embebida en el HTML de log de push. */
const CSS_HTML_PUSH = `
:root{--bg:#f6f8fa;--card:#fff;--txt:#24292f;--muted:#636e7b;--border:#d0d7de;--add-bg:#e6ffec;--add-ln:#ccffd8;--add-txt:#1a7f37;--del-bg:#ffebe9;--del-ln:#ffd7d5;--del-txt:#cf222e;--sep-bg:#f6f8fa;--sep-txt:#8c959f;--ln-bg:#f6f8fa;--ln-txt:#8c959f;--mono:'ui-monospace','Cascadia Code','SFMono-Regular',Consolas,monospace;--radius:6px;}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:var(--bg);color:var(--txt);line-height:1.6;font-size:14px;overflow-anchor:none;}
a{color:#0969da;text-decoration:none;}a:hover{text-decoration:underline;}
.wrap{max-width:1100px;margin:0 auto;padding:32px 16px;}
header{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:20px 24px;margin-bottom:24px;position:sticky;top:0;z-index:100;transition:padding .2s ease,box-shadow .2s ease;}
header.compact{padding:8px 24px;box-shadow:0 2px 12px rgba(0,0,0,.18);border-top-left-radius:0;border-top-right-radius:0;}
header.compact .meta,header.compact .stats{display:none;}
header.compact .header-top{margin-bottom:0;}
header.compact h1{font-size:1.1em;}
header.compact .header-logo{height:26px;}
#back-top{position:fixed;bottom:28px;right:28px;display:none;align-items:center;justify-content:center;width:46px;height:46px;border-radius:50%;background:#0969da;color:#fff;font-size:1.4em;line-height:1;border:none;cursor:pointer;box-shadow:0 3px 12px rgba(0,0,0,.25);transition:background .15s;z-index:200;}
#back-top.visible{display:flex;}
#back-top:hover{background:#0550ae;}
.header-top{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:12px;}
.header-logo{height:36px;width:auto;flex-shrink:0;opacity:0.9;transition:height .2s ease;}
h1{font-size:1.4em;margin-bottom:0;transition:font-size .2s ease;}
h1 code{font-family:var(--mono);font-size:0.9em;background:#f0f0f0;padding:2px 6px;border-radius:4px;}
.meta{width:100%;border-collapse:collapse;}
.meta th{text-align:left;color:var(--muted);font-weight:600;padding:3px 16px 3px 0;width:160px;white-space:nowrap;}
.meta td{padding:3px 0;font-family:var(--mono);font-size:0.9em;}
.stats{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px;}
.badge{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 6px;border-radius:10px;font-size:0.75em;font-weight:700;vertical-align:middle;}
.bnew{background:#ddf4ff;color:#0969da;}
.bdel{background:#ffebe9;color:#cf222e;}
.bmod{background:#fff8c5;color:#9a6700;}
.stat-pill{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:20px;font-size:0.85em;font-weight:600;}
.snew{background:#ddf4ff;color:#0969da;}
.sdel{background:#ffebe9;color:#cf222e;}
.smod{background:#fff8c5;color:#9a6700;}
section{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:20px 24px;margin-bottom:16px;}
h2{font-size:1em;font-weight:700;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border);}
h2 .cnt{font-weight:400;color:var(--muted);margin-left:6px;}
.file-list{list-style:none;padding:0;}
.file-list li{padding:5px 0;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;}
.file-list li:last-child{border-bottom:none;}
.file-list code,.filepath{font-family:var(--mono);font-size:0.85em;}
.empty{color:var(--muted);font-style:italic;}
nav.toc{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:20px 24px;margin-bottom:16px;}
nav.toc h2{font-size:1em;font-weight:700;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border);}
nav.toc ul{list-style:none;padding:0;columns:2;column-gap:24px;}
@media(max-width:640px){nav.toc ul{columns:1;}}
nav.toc li{padding:3px 0;font-family:var(--mono);font-size:0.85em;}
details{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:12px;overflow:hidden;}
details>summary{list-style:none;padding:10px 16px;cursor:pointer;display:flex;align-items:center;gap:8px;background:#f6f8fa;border-bottom:1px solid var(--border);user-select:none;}
details>summary::-webkit-details-marker{display:none;}
details[open]>summary{border-bottom:1px solid var(--border);}
details>summary::before{content:'▶';font-size:0.7em;color:var(--muted);transition:transform .15s;}
details[open]>summary::before{transform:rotate(90deg);}
.diff-wrap{overflow-x:auto;}
.diff-table{width:100%;border-collapse:collapse;font-family:var(--mono);font-size:0.8em;white-space:pre;}
.diff-table td{padding:1px 0;vertical-align:top;}
.diff-table .ln{color:var(--ln-txt);background:var(--ln-bg);text-align:right;min-width:36px;padding:0 6px;border-right:1px solid var(--border);user-select:none;}
.diff-table .ct{padding-left:8px;width:100%;}
.da{background:var(--add-bg);}.da .ln{background:var(--add-ln);}.da .ct{color:var(--add-txt);}
.dr{background:var(--del-bg);}.dr .ln{background:var(--del-ln);}.dr .ct{color:var(--del-txt);}
.diff-sep td{background:var(--sep-bg);color:var(--sep-txt);text-align:center;padding:2px 0;border-top:1px dashed var(--border);border-bottom:1px dashed var(--border);}
.diff-nochange td{color:var(--muted);font-style:italic;padding:8px;text-align:center;}
#diffs-section{margin-top:24px;}
#diffs-section>h2{font-size:1.1em;font-weight:700;margin-bottom:16px;}
`;

function escHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function renderizarFilasDiff(oldText: string, newText: string): string {
    const entries = computeLineDiff(oldText, newText);
    if (entries.length === 0) {
        return '<tr class="diff-nochange"><td colspan="3"><em>Sin cambios detectados en el cuerpo del fichero</em></td></tr>';
    }
    return entries.map(e => {
        if (e.op === "separator") {
            return '<tr class="diff-sep"><td colspan="3">···</td></tr>';
        }
        const cls = e.op === "add" ? "da" : e.op === "remove" ? "dr" : "de";
        const pfx = e.op === "add" ? "+" : e.op === "remove" ? "−" : "\u00a0";
        const lnO = e.lineOld > 0 ? String(e.lineOld) : "";
        const lnN = e.lineNew > 0 ? String(e.lineNew) : "";
        return `<tr class="${cls}"><td class="ln">${lnO}</td><td class="ln">${lnN}</td><td class="ct">${pfx}${escHtml(e.value)}</td></tr>`;
    }).join("\n");
}

function renderizarSeccionDiffs(modificados: IArchivoConDiff[]): string {
    if (modificados.length === 0) {
        return '<p class="empty">No hay ficheros modificados en este push.</p>';
    }
    return modificados.map((a, idx) => {
        const filas = renderizarFilasDiff(a.contenidoOriginal, a.contenidoNuevo);
        return `<details id="diff-${idx}" open>
  <summary><span class="badge bmod">~</span> <code class="filepath">${escHtml(a.archivo)}</code></summary>
  <div class="diff-wrap">
    <table class="diff-table"><tbody>
${filas}
    </tbody></table>
  </div>
</details>`;
    }).join("\n\n");
}

function renderizarListaSimple(archivos: IArchivoConDiff[], estado: TEstadoArchivoPush, badgeCls: string, badgeTxt: string, {diffIndexMap}: {diffIndexMap?: Map<string, number>} = {}): string {
    const lista = archivos.filter(a => a.estado === estado);
    if (lista.length === 0) {
        return '<p class="empty">Ninguno</p>';
    }
    return `<ul class="file-list">${lista.map(a => {
        const idx = diffIndexMap?.get(a.archivo);
        const nombre = idx !== undefined
            ? `<a href="#diff-${idx}"><code>${escHtml(a.archivo)}</code></a>`
            : `<code>${escHtml(a.archivo)}</code>`;
        return `<li><span class="badge ${badgeCls}">${badgeTxt}</span> ${nombre}</li>`;
    }).join("\n")}</ul>`;
}

/**
 * Genera el HTML completo del log de un push.
 *
 * @param data - Datos del push a representar.
 * @returns Cadena HTML auto-contenida lista para subir a GCS.
 */
export function generarHtmlPush(data: IPushLogData): string {
    const nuevos     = data.archivos.filter(a => a.estado === "nuevo");
    const eliminados = data.archivos.filter(a => a.estado === "eliminado");
    const cambiados  = data.archivos.filter(a => a.estado === "cambiado");
    const diffables  = cambiados.filter(a => esDiffable(a.archivo));
    const diffIndexMap = new Map(diffables.map((a, idx) => [a.archivo, idx]));

    const fechaStr = formatearFechaLocal(data.fecha);
    const title    = `Push · ${data.npmName} · ${data.version}`;

    const tocModificados = diffables.length === 0
        ? '<li class="empty">Sin ficheros modificados</li>'
        : diffables.map((a, idx) => `<li><a href="#diff-${idx}"><code>${escHtml(a.archivo)}</code></a></li>`).join("\n");

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(title)}</title>
<style>${CSS_HTML_PUSH}</style>
</head>
<body>
<div class="wrap">

<!-- ═══ Cabecera ═══════════════════════════════════════════════════════════════ -->
<header id="main-header">
  <div class="header-top">
    <h1>🚀 Push — <code>${escHtml(data.npmName)}</code></h1>
    <img class="header-logo" src="https://www.meteored.com/img/web/meteored.svg" alt="Meteored" />
  </div>
  <table class="meta">
    <tr><th>Autor</th><td>${escHtml(data.autor)}</td></tr>
    <tr><th>Proyecto</th><td>${data.proyecto ? `<a href="${escHtml(data.proyecto)}" target="_blank" rel="noopener noreferrer">${escHtml(data.proyecto)}</a>` : "<em>—</em>"}</td></tr>
    <tr><th>Versión anterior</th><td>${escHtml(data.versionAnterior)}</td></tr>
    <tr><th>Versión publicada</th><td><strong>${escHtml(data.version)}</strong></td></tr>
    <tr><th>Fecha</th><td>${fechaStr}</td></tr>
  </table>
  <div class="stats">
    <span class="stat-pill snew">+${nuevos.length} creado${nuevos.length !== 1 ? "s" : ""}</span>
    <span class="stat-pill sdel">−${eliminados.length} eliminado${eliminados.length !== 1 ? "s" : ""}</span>
    <span class="stat-pill smod">~${cambiados.length} modificado${cambiados.length !== 1 ? "s" : ""}</span>
  </div>
</header>
<div id="scroll-sentinel" aria-hidden="true" style="height:0;overflow:hidden;pointer-events:none;"></div>

<!-- ═══ Índice de ficheros modificados ════════════════════════════════════════ -->
<nav class="toc" aria-label="Índice de ficheros modificados">
  <h2>Índice de cambios</h2>
  <ul>
${tocModificados}
  </ul>
</nav>

<!-- ═══ Ficheros creados ══════════════════════════════════════════════════════ -->
<section id="creados" aria-label="Ficheros creados">
  <h2>Ficheros creados <span class="cnt">(${nuevos.length})</span></h2>
  ${renderizarListaSimple(data.archivos, "nuevo", "bnew", "+")}
</section>

<!-- ═══ Ficheros eliminados ═══════════════════════════════════════════════════ -->
<section id="eliminados" aria-label="Ficheros eliminados">
  <h2>Ficheros eliminados <span class="cnt">(${eliminados.length})</span></h2>
  ${renderizarListaSimple(data.archivos, "eliminado", "bdel", "−")}
</section>

<!-- ═══ Ficheros modificados ══════════════════════════════════════════════════ -->
<section id="cambiados" aria-label="Ficheros modificados">
  <h2>Ficheros modificados <span class="cnt">(${cambiados.length})</span></h2>
  ${renderizarListaSimple(data.archivos, "cambiado", "bmod", "~", {diffIndexMap})}
</section>

<!-- ═══ Detalle de cambios ════════════════════════════════════════════════════ -->
<div id="diffs-section">
  <h2>Detalle de cambios</h2>
  ${renderizarSeccionDiffs(diffables)}
</div>

</div>

<button id="back-top" aria-label="Volver arriba">↑</button>

<script>
(function(){
  var hdr=document.getElementById('main-header');
  var btn=document.getElementById('back-top');
  var sentinel=document.getElementById('scroll-sentinel');
  new IntersectionObserver(function(entries){
    var compact=!entries[0].isIntersecting;
    hdr.classList.toggle('compact',compact);
    btn.classList.toggle('visible',compact);
  },{threshold:0}).observe(sentinel);
  btn.addEventListener('click',function(){window.scrollTo({top:0,behavior:'smooth'});});
}());
</script>

</body>
</html>
`;
}

/* ─── Subida a GCS ──────────────────────────────────────────────────────────── */

function sanitizarFramework(npmName: string): string {
    return npmName.replace(/[@/]/g, "-").replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-");
}

/**
 * Genera el HTML del log de push y lo sube al bucket GCS en la ruta
 * `logs/{framework}/{version}.html`.
 *
 * @param bucket - Nombre del bucket GCS de destino.
 * @param data   - Datos del push.
 */
export async function subirLogHtmlPush(bucket: string, data: IPushLogData): Promise<void> {
    const html      = generarHtmlPush(data);
    const storage   = new Storage();
    const framework = sanitizarFramework(data.npmName);
    const version   = data.version.replace(/\+/g, "_");
    const ruta      = `logs/${framework}/${version}.html`;
    const file      = storage.bucket(bucket).file(ruta);
    const stream    = file.createWriteStream({contentType: "text/html; charset=utf-8"});
    await pipeline(buffer2stream(Buffer.from(html, "utf-8")), stream);
}

