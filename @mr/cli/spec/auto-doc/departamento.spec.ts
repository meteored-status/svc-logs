/**
 * Editor: Juan C. Martínez
 * Fecha: Mon, 16 Nov 2026 13:01:58 GMT
 * Hash: 0cbbffa923db5473d671ee0402d7da4b
 * Versión: 2026.11.16+6-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-panel-intranet.git
 */

import {after, before, describe, it} from "node:test";
import assert from "node:assert/strict";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {calcularDepartamento, departamentoDeLambda, efectoDeParche, escribirDepartamento, esDepartamentoNoSoportado, esDepartamentoValido, interpretarKustomizacion, leerDepartamento, type INodoKustomize} from "../../src/clases/auto-doc/departamento";

/** Contenido que no debe aparecer nunca en un aviso. */
const CENTINELA = "CENTINELA-SECRETO-NO-LEER";

function op(operacion: string, ruta: string, valor?: unknown): string {
    return JSON.stringify([{op: operacion, path: ruta, ...(valor === undefined ? {} : {value: valor})}]);
}

const POD = "/spec/template/metadata/labels/dpto";
const CRONJOB = "/spec/jobTemplate/spec/template/metadata/labels/dpto";

function nodo(texto: string, {ficheros = {}, hijos = {}, archivos = []}: Partial<INodoKustomize> = {}): INodoKustomize {
    return {ruta: "n", texto, ficheros, hijos, archivos};
}

/** Componente del kustomizer: `resources` de base y un parche JSON6902 con la etiqueta. */
function componente(dpto: string): INodoKustomize {
    return nodo("resources:\n  - deployment.yaml\npatches:\n  - path: deployment.json\n    target:\n      kind: Deployment\n", {ficheros: {"deployment.json": op("add", POD, dpto)}, archivos: ["deployment.yaml"]});
}

describe("esDepartamentoValido", () => {
    it("admite minúsculas, números y guion, de 1 a 32 caracteres", () => {
        for (const valor of ["backoffice", "web", "a", "ads-2", "mrpress", "0", "a".repeat(32)]) {
            assert.equal(esDepartamentoValido(valor), true, valor);
        }
    });

    it("rechaza vacío, guion bajo, mayúsculas, espacios, puntos, más de 32 y lo que no es texto", () => {
        for (const valor of ["", "web_x", "mr_press", "Web", "a b", "a.b", "a/b", "a".repeat(33), "web\n", "ñ", 1, null, undefined, {}, ["web"]]) {
            assert.equal(esDepartamentoValido(valor), false, String(valor));
        }
    });
});

describe("efectoDeParche", () => {
    it("add y replace sobre la etiqueta de un Deployment o de un CronJob fijan el valor", () => {
        assert.deepEqual(efectoDeParche(op("add", POD, "web")), {valor: "web"});
        assert.deepEqual(efectoDeParche(op("replace", POD, "ads")), {valor: "ads"});
        assert.deepEqual(efectoDeParche(op("add", CRONJOB, "mrpress")), {valor: "mrpress"});
    });

    it("de varias operaciones gana la última sobre la etiqueta", () => {
        const texto = JSON.stringify([{op: "add", path: POD, value: "backoffice"}, {op: "add", path: "/spec/template/metadata/labels/producto", value: "x"}, {op: "replace", path: POD, value: "web"}]);
        assert.deepEqual(efectoDeParche(texto), {valor: "web"});
    });

    it("las operaciones que no tocan la etiqueta no tienen efecto (hermanas, volúmenes, recursos)", () => {
        const texto = JSON.stringify([
            {op: "add", path: "/spec/template/metadata/labels/producto", value: "legacy"},
            {op: "add", path: "/spec/template/spec/volumes/-", value: {name: "buckets"}},
            {op: "add", path: "/spec/template/spec/containers/0/resources", value: {limits: {cpu: 1}}},
        ]);
        assert.deepEqual(efectoDeParche(texto), {});
    });

    it("también entiende una lista de operaciones escrita en YAML", () => {
        assert.deepEqual(efectoDeParche(`- op: replace\n  path: ${POD}\n  value: web\n`), {valor: "web"});
    });

    it("duda ante un remove, un move o un copy que toque la etiqueta", () => {
        assert.ok(efectoDeParche(op("remove", POD)).duda);
        assert.ok(efectoDeParche(JSON.stringify([{op: "move", from: "/spec/otro", path: POD}])).duda);
        assert.ok(efectoDeParche(JSON.stringify([{op: "copy", from: POD, path: "/spec/otro"}])).duda);
    });

    it("duda ante una operación sobre un padre de la etiqueta o sobre un hijo", () => {
        assert.ok(efectoDeParche(op("replace", "/spec/template/metadata/labels", {app: "x"})).duda);
        assert.ok(efectoDeParche(op("add", "/spec/template/metadata", {labels: {dpto: "web"}})).duda);
        assert.ok(efectoDeParche(op("remove", "/spec/template")).duda);
        assert.ok(efectoDeParche(op("replace", "", {})).duda);
        assert.ok(efectoDeParche(op("add", `${POD}/x`, "web")).duda);
    });

    it("un test sobre la etiqueta no tiene efecto", () => {
        assert.deepEqual(efectoDeParche(op("test", POD, "web")), {});
    });

    it("duda ante un valor que no cumple el formato o que no es texto", () => {
        for (const valor of ["Web", "web_x", "a b", "", "x".repeat(33), 5, null, ["web"], {a: 1}]) {
            assert.ok(efectoDeParche(op("add", POD, valor)).duda, JSON.stringify(valor));
        }
    });

    it("duda ante un parche que no es JSON6902 pero menciona dpto (strategic merge)", () => {
        assert.ok(efectoDeParche("spec:\n  template:\n    metadata:\n      labels:\n        dpto: meteo\n").duda);
        assert.ok(efectoDeParche(JSON.stringify({spec: {template: {metadata: {labels: {dpto: "web"}}}}})).duda);
        assert.ok(efectoDeParche("a: [").duda === undefined, "un YAML roto que no menciona dpto no es duda");
    });

    it("un parche que no es JSON6902 y no menciona dpto no tiene efecto", () => {
        assert.deepEqual(efectoDeParche("spec:\n  minReplicas: 2\n"), {});
    });

    it("duda si el parche que toca la etiqueta lleva un target con selectores", () => {
        assert.ok(efectoDeParche(op("add", POD, "web"), {kind: "Deployment", name: "otro"}).duda);
        assert.ok(efectoDeParche(op("add", POD, "web"), {kind: "Deployment", labelSelector: "a=b"}).duda);
        assert.deepEqual(efectoDeParche(op("add", POD, "web"), {kind: "Deployment"}), {valor: "web"});
        assert.deepEqual(efectoDeParche(op("add", "/spec/replicas", 2), {kind: "Deployment", name: "otro"}), {});
    });
});

describe("interpretarKustomizacion", () => {
    it("lee resources, components y patches en orden", () => {
        const k = interpretarKustomizacion("resources:\n  - ../a\n  - router.yaml\ncomponents:\n  - ../c\npatches:\n  - path: d.json\n    target:\n      kind: Deployment\n  - patch: '[]'\n");
        assert.deepEqual(k?.recursos, ["../a", "router.yaml", "../c"]);
        assert.deepEqual(k?.parches, [{path: "d.json", patch: undefined, target: {kind: "Deployment"}}, {path: undefined, patch: "[]", target: undefined}]);
        assert.deepEqual(k?.dudas, []);
    });

    it("marca como duda labels o commonLabels con dpto y las claves que no interpreta", () => {
        const casos = [
            "labels:\n  - pairs:\n      dpto: web\n",
            "commonLabels:\n  dpto: web\n",
            "patchesStrategicMerge:\n  - a.yaml\n",
            "patchesJson6902:\n  - path: a.json\n",
            "replacements: []\n",
            "transformers:\n  - t.yaml\n",
            "patches:\n  - {}\n",
            "patches:\n  - path: a.json\n    patch: '[]'\n",
            "resources: a\n",
        ];
        for (const texto of casos) {
            assert.ok((interpretarKustomizacion(texto)?.dudas.length ?? 0) > 0, texto);
        }
    });

    it("las labels que no son dpto (app, includeSelectors) no son duda", () => {
        assert.deepEqual(interpretarKustomizacion("labels:\n  - includeSelectors: true\n    pairs:\n      app: x\n")?.dudas, []);
    });

    it("undefined si no es un YAML con un objeto", () => {
        assert.equal(interpretarKustomizacion("- a"), undefined);
        assert.equal(interpretarKustomizacion("a: ["), undefined);
    });
});

describe("calcularDepartamento (cadena ya leída)", () => {
    const usa = (...recursos: string[]): string => `resources:\n${recursos.map(r => `  - ${r}\n`).join("")}`;

    it("el componente del kustomizer pone el departamento (caso `services` → backoffice)", () => {
        const all = nodo(usa("../../_componentes/deployment", "router.yaml"), {hijos: {"../../_componentes/deployment": componente("backoffice")}, archivos: ["router.yaml"]});
        assert.deepEqual(calcularDepartamento("svc", all), {dpto: "backoffice", avisos: []});
    });

    it("el componente de tiempo-web da web", () => {
        const all = nodo(usa("../../_componentes/deployment"), {hijos: {"../../_componentes/deployment": componente("web")}});
        assert.equal(calcularDepartamento("svc", all).dpto, "web");
    });

    it("un parche con `_`, mayúscula o 33 caracteres da null con aviso, sin el valor", () => {
        for (const valor of ["web_x", "Web", "w".repeat(33)]) {
            const all = nodo(`${usa("../a")}patches:\n  - path: d.json\n`, {hijos: {"../a": componente("backoffice")}, ficheros: {"d.json": op("replace", POD, valor)}});
            const resultado = calcularDepartamento("svc", all);
            assert.equal(resultado.dpto, null, valor);
            assert.ok(resultado.avisos.length > 0, valor);
            assert.ok(resultado.avisos.every(aviso => !aviso.includes(valor)), resultado.avisos.join("|"));
        }
    });

    it("el servicio sobrescribe al componente con su propio parche", () => {
        const all = nodo(`${usa("../../_componentes/deployment")}patches:\n  - path: deployment.json\n    target:\n      kind: Deployment\n`, {
            hijos: {"../../_componentes/deployment": componente("backoffice")},
            ficheros: {"deployment.json": op("replace", POD, "ads")},
        });
        assert.equal(calcularDepartamento("svc", all).dpto, "ads");
    });

    it("el overlay del entorno gana a _all", () => {
        const all = nodo(usa("../../_componentes/deployment"), {hijos: {"../../_componentes/deployment": componente("backoffice")}});
        const entorno = nodo(`${usa("../_all")}patches:\n  - patch: '${op("replace", POD, "meteo")}'\n    target:\n      kind: Deployment\n`, {hijos: {"../_all": all}});
        assert.equal(calcularDepartamento("svc", entorno).dpto, "meteo");
    });

    it("null, con aviso, si ninguna kustomization pone la etiqueta", () => {
        const all = nodo(usa("router.yaml"), {archivos: ["router.yaml"]});
        const resultado = calcularDepartamento("svc", all);
        assert.equal(resultado.dpto, null);
        assert.equal(resultado.avisos.length, 1);
    });

    it("null si dos recursos fijan departamentos distintos (caso ambiguo)", () => {
        const all = nodo(usa("../a", "../b"), {hijos: {"../a": componente("backoffice"), "../b": componente("web")}});
        const resultado = calcularDepartamento("svc", all);
        assert.equal(resultado.dpto, null);
        assert.match(resultado.avisos.join("|"), /distintos/);
    });

    it("dos recursos con el mismo departamento no son conflicto", () => {
        const all = nodo(usa("../a", "../b"), {hijos: {"../a": componente("web"), "../b": componente("web")}});
        assert.equal(calcularDepartamento("svc", all).dpto, "web");
    });

    it("null si un parche posterior hace remove, aunque el componente lo ponga", () => {
        const all = nodo(`${usa("../a")}patches:\n  - path: d.json\n`, {hijos: {"../a": componente("web")}, ficheros: {"d.json": op("remove", POD)}});
        assert.equal(calcularDepartamento("svc", all).dpto, null);
    });

    it("null si un recurso o un parche relevante no se ha podido leer", () => {
        assert.equal(calcularDepartamento("svc", nodo(usa("../a"))).dpto, null);
        const sinParche = nodo(`${usa("../a")}patches:\n  - path: d.json\n`, {hijos: {"../a": componente("web")}});
        assert.equal(calcularDepartamento("svc", sinParche).dpto, null);
        assert.equal(calcularDepartamento("svc", undefined).dpto, null);
    });

    it("null si algo fija dpto por una vía que no se interpreta, aunque haya un valor claro", () => {
        for (const extra of ["labels:\n  - pairs:\n      dpto: otro\n", "commonLabels:\n  dpto: otro\n", "patchesStrategicMerge:\n  - x.yaml\n"]) {
            const all = nodo(`${usa("../a")}${extra}`, {hijos: {"../a": componente("web")}});
            assert.equal(calcularDepartamento("svc", all).dpto, null, extra);
        }
    });

    it("los parches a recursos sin pods ni se leen ni cuentan, aunque falte su fichero", () => {
        const all = nodo(`${usa("../a")}patches:\n  - path: autoscaler.json\n    target:\n      kind: HorizontalPodAutoscaler\n  - path: router.json\n    target:\n      kind: VirtualService\n`, {hijos: {"../a": componente("web")}});
        assert.equal(calcularDepartamento("svc", all).dpto, "web");
    });

    it("null si una kustomization no es un YAML con un objeto", () => {
        assert.equal(calcularDepartamento("svc", nodo("- a")).dpto, null);
    });
});

describe("departamentoDeLambda", () => {
    it("con etiqueta válida, la devuelve", () => {
        assert.deepEqual(departamentoDeLambda("videos-webhook", "mrpress"), {dpto: "mrpress", avisos: []});
    });

    it("sin etiqueta: null y un aviso", () => {
        const resultado = departamentoDeLambda("panel-usuarios-ou-webhook", undefined);
        assert.equal(resultado.dpto, null);
        assert.equal(resultado.avisos.length, 1);
    });

    it("con una etiqueta que no cumple el formato: null y un aviso", () => {
        for (const valor of ["web_x", "Web", "a b", "", "x".repeat(33), 3, null]) {
            const resultado = departamentoDeLambda("l", valor);
            assert.equal(resultado.dpto, null, String(valor));
            assert.equal(resultado.avisos.length, 1);
        }
    });

    it("el aviso por un formato inválido no incluye el valor", () => {
        for (const valor of ["web_SECRETO", "Web-SECRETO", "x".repeat(33)]) {
            const [aviso] = departamentoDeLambda("l", valor).avisos;
            assert.ok(aviso !== undefined && !aviso.includes(valor), aviso);
        }
    });
});

describe("esDepartamentoNoSoportado", () => {
    it("reconoce la columna inexistente y la falta de permiso", () => {
        for (const code of ["ER_BAD_FIELD_ERROR", "ER_COLUMNACCESS_DENIED_ERROR", "ER_TABLEACCESS_DENIED_ERROR", "ER_DBACCESS_DENIED_ERROR"]) {
            assert.equal(esDepartamentoNoSoportado(Object.assign(new Error("x"), {code})), true, code);
        }
    });

    it("no reconoce otros errores", () => {
        assert.equal(esDepartamentoNoSoportado(Object.assign(new Error("x"), {code: "ER_LOCK_DEADLOCK"})), false);
        assert.equal(esDepartamentoNoSoportado(new Error("x")), false);
        assert.equal(esDepartamentoNoSoportado(undefined), false);
    });
});

describe("escribirDepartamento", () => {
    interface ISentencia {
        sql: string;
        params: (string | number | null)[];
    }

    function transaccion(falla?: Error): {tx: {update(sql: string, params: (string | number | null)[]): Promise<void>}, sentencias: ISentencia[]} {
        const sentencias: ISentencia[] = [];

        return {
            sentencias,
            tx: {
                update: async (sql, params) => {
                    if (falla !== undefined) {
                        throw falla;
                    }
                    sentencias.push({sql, params});
                },
            },
        };
    }

    it("con un departamento lo escribe con parámetros", async () => {
        const {tx, sentencias} = transaccion();

        assert.deepEqual(await escribirDepartamento(tx, 7, "backoffice"), {guardado: true, sinSoporte: false});
        assert.deepEqual(sentencias, [{sql: "UPDATE openapi_service SET dpto = ? WHERE id = ?", params: ["backoffice", 7]}]);
    });

    it("con `null` (se intentó y no se sabe) escribe NULL: no conserva el departamento viejo", async () => {
        const {tx, sentencias} = transaccion();

        assert.deepEqual(await escribirDepartamento(tx, 7, null), {guardado: true, sinSoporte: false});
        assert.deepEqual(sentencias[0]?.params, [null, 7]);
    });

    it("ausente (no se intentó) no toca la columna", async () => {
        const {tx, sentencias} = transaccion();

        assert.deepEqual(await escribirDepartamento(tx, 7, undefined), {guardado: false, sinSoporte: false});
        assert.equal(sentencias.length, 0);
    });

    it("sin la columna o sin GRANT sigue sin dpto, sin lanzar", async () => {
        for (const code of ["ER_BAD_FIELD_ERROR", "ER_COLUMNACCESS_DENIED_ERROR", "ER_TABLEACCESS_DENIED_ERROR", "ER_DBACCESS_DENIED_ERROR"]) {
            const {tx} = transaccion(Object.assign(new Error("x"), {code}));

            assert.deepEqual(await escribirDepartamento(tx, 7, "web"), {guardado: false, sinSoporte: true}, code);
        }
    });

    it("cualquier otro error se propaga", async () => {
        const {tx} = transaccion(Object.assign(new Error("boom"), {code: "ER_LOCK_DEADLOCK"}));

        await assert.rejects(escribirDepartamento(tx, 7, "web"), /boom/);
    });
});

describe("leerDepartamento (sobre un clon de kustomize falso con la estructura real)", () => {
    let raiz: string;

    async function escribir(ruta: string, contenido: string): Promise<void> {
        const destino = path.join(raiz, ruta);
        await fsp.mkdir(path.dirname(destino), {recursive: true});
        await fsp.writeFile(destino, contenido);
    }

    /** Un deployment `<dir>/<name>` con `_all` y overlay de test. */
    async function deployment(dir: string, name: string, recursos: string[], {parche, overlayExtra = ""}: {parche?: string, overlayExtra?: string} = {}): Promise<void> {
        const lista = recursos.map(r => `  - ${r}\n`).join("");
        const patches = parche === undefined ? "" : "patches:\n  - path: deployment.json\n    target:\n      kind: Deployment\n";
        await escribir(`${dir}/${name}/_all/kustomization.yaml`, `namespace: meteored-services\nnameSuffix: -${name}\nresources:\n${lista}  - router.yaml\n${patches}`);
        await escribir(`${dir}/${name}/_all/router.yaml`, "kind: VirtualService\n");
        if (parche !== undefined) {
            await escribir(`${dir}/${name}/_all/deployment.json`, parche);
        }
        await escribir(`${dir}/${name}/test/kustomization.yaml`, `resources:\n  - ../_all\npatches:\n  - path: autoscaler.json\n    target:\n      kind: HorizontalPodAutoscaler\n${overlayExtra}`);
        await escribir(`${dir}/${name}/test/autoscaler.json`, "[]");
    }

    before(async () => {
        raiz = await fsp.mkdtemp(path.join(os.tmpdir(), "kustomize-dpto-"));
        for (const base of ["autoscaler", "deployment", "pdb", "proxy"]) {
            await escribir(`_componentes/${base}/kustomization.yaml`, `resources:\n  - ${base}.yaml\n`);
            await escribir(`_componentes/${base}/${base}.yaml`, "kind: X\n");
        }
        for (const [dir, valor] of [["services", "backoffice"], ["tiempo-web", "web"]] as const) {
            await escribir(`${dir}/_componentes/deployment/kustomization.yaml`, "namespace: x\nresources:\n  - ../../../_componentes/autoscaler\n  - ../../../_componentes/deployment\n  - ../../../_componentes/pdb\npatches:\n  - path: deployment.json\n    target:\n      kind: Deployment\n");
            await escribir(`${dir}/_componentes/deployment/deployment.json`, op("add", POD, valor));
        }
        await escribir("services/_componentes/cronjob/kustomization.yaml", "resources:\n  - ../../../_componentes/deployment\npatches:\n  - path: cronjob.json\n    target:\n      kind: CronJob\n");
        await escribir("services/_componentes/cronjob/cronjob.json", op("add", CRONJOB, "backoffice"));

        await deployment("services", "generico", ["../../_componentes/deployment", "../../../_componentes/proxy"], {parche: op("add", "/spec/template/metadata/labels/producto", "legacy")});
        await deployment("tiempo-web", "estaticos", ["../../_componentes/deployment", "../../../_componentes/proxy"]);
        await deployment("tiempo-web", "widget-legacy", ["../../../services/_componentes/deployment", "../../../_componentes/proxy"], {parche: op("add", "/spec/template/metadata/labels/producto", "widget")});
        await deployment("services", "ads-display", ["../../_componentes/deployment"], {parche: JSON.stringify([{op: "replace", path: POD, value: "ads"}, {op: "add", path: "/spec/template/metadata/labels/producto", value: "ads"}])});
        await deployment("services", "sin-etiqueta", ["../../../_componentes/deployment", "../../../_componentes/proxy"]);
        await deployment("services", "ambiguo", ["../../_componentes/deployment", "../../../tiempo-web/_componentes/deployment"]);
        await deployment("services", "con-remove", ["../../_componentes/deployment"], {parche: op("remove", POD)});
        await deployment("services", "valor-malo", ["../../_componentes/deployment"], {parche: op("replace", POD, "Web Site")});
        await deployment("services", "strategic", ["../../_componentes/deployment"], {parche: "spec:\n  template:\n    metadata:\n      labels:\n        dpto: meteo\n"});
        await deployment("services", "overlay-gana", ["../../_componentes/deployment"], {overlayExtra: `  - patch: '${op("replace", POD, "meteo")}'\n    target:\n      kind: Deployment\n`});
        await deployment("services", "cron", ["../../_componentes/cronjob"]);
        await deployment("services", "falta-parche", ["../../_componentes/deployment"]);
        await escribir("services/falta-parche/_all/kustomization.yaml", "nameSuffix: -falta-parche\nresources:\n  - ../../_componentes/deployment\npatches:\n  - path: no-existe.json\n    target:\n      kind: Deployment\n");
        await deployment("services", "tmpl", ["../../_componentes/deployment"]);
        await escribir("services/tmpl/_all/kustomization.tmpl.yaml", "nameSuffix: -tmpl\nresources:\n  - ../../../tiempo-web/_componentes/deployment\nfiles:\n  - mysql.json=credenciales/mysql-${ZONA}.json\n");
        await deployment("services", "ciclo-a", ["../../_componentes/deployment", "../../ciclo-b/_all"]);
        await deployment("services", "ciclo-b", ["../../ciclo-a/_all"]);
        await deployment("services", "sin-overlay", ["../../_componentes/deployment"]);
        await fsp.rm(path.join(raiz, "services/sin-overlay/test"), {recursive: true});
        // Componentes con un departamento válido que no se deben leer: fuera del clon y dentro de `tmp/`.
        const parcheFuga = `patches:\n  - patch: '${op("add", POD, "fuga")}'\n    target:\n      kind: Deployment\n`;
        await deployment("services", "fuera", [`../../../../${path.basename(raiz)}-fuera`]);
        await fsp.mkdir(`${raiz}-fuera`);
        await fsp.writeFile(`${raiz}-fuera/kustomization.yaml`, parcheFuga);
        await deployment("services", "hacia-tmp", ["../../../tmp/otro"]);
        await escribir("tmp/otro/kustomization.yaml", parcheFuga);
        await deployment("services", "secreto", ["../../_componentes/deployment"], {parche: JSON.stringify([{op: "add", path: "/spec/template/spec/containers/0/env/-", value: {name: "SEED", value: CENTINELA}}, {op: "replace", path: POD, value: "Mal Valor"}])});
        await deployment("services", "grande", ["../../_componentes/deployment"], {parche: JSON.stringify([{op: "add", path: "/spec/x", value: "x".repeat(70 * 1024)}])});
        // Un enlace simbólico a un componente legítimo, dentro del propio clon: tampoco se sigue.
        await deployment("services", "enlace", ["enlace-comp"]);
        await fsp.symlink(path.join(raiz, "services/_componentes/deployment"), path.join(raiz, "services/enlace/_all/enlace-comp"));
        // Un directorio intermedio que es un enlace simbólico a un deployment legítimo (ads): el último tramo no lo es.
        await fsp.symlink(path.join(raiz, "services/ads-display"), path.join(raiz, "services/dir-enlazado"));
        await deployment("services", "via-dir-enlazado", ["../../dir-enlazado/_all"]);
        await deployment("services", "enlace-parche", ["../../_componentes/deployment"], {parche: "[]"});
        await fsp.rm(path.join(raiz, "services/enlace-parche/_all/deployment.json"));
        await fsp.symlink(path.join(raiz, "services/ads-display/_all/deployment.json"), path.join(raiz, "services/enlace-parche/_all/deployment.json"));
    });

    after(async () => {
        await fsp.rm(raiz, {recursive: true, force: true});
        await fsp.rm(`${raiz}-fuera`, {recursive: true, force: true});
    });

    async function dpto(dir: string, name: string, entorno = "test"): Promise<{dpto: string | null, avisos: string[]}> {
        return leerDepartamento({raiz, dir, name, entorno});
    }

    it("`services` sin sobrescritura: backoffice, del componente del kustomizer", async () => {
        assert.deepEqual(await dpto("services", "generico"), {dpto: "backoffice", avisos: []});
    });

    it("`tiempo-web`: web", async () => {
        assert.deepEqual(await dpto("tiempo-web", "estaticos"), {dpto: "web", avisos: []});
    });

    it("`tiempo-web/widget-legacy` usa el componente de `services`: backoffice, no web", async () => {
        assert.deepEqual(await dpto("tiempo-web", "widget-legacy"), {dpto: "backoffice", avisos: []});
    });

    it("un servicio que sobrescribe con replace en `_all/deployment.json` (ads-display): ads", async () => {
        assert.deepEqual(await dpto("services", "ads-display"), {dpto: "ads", avisos: []});
    });

    it("un parche del overlay del entorno sobrescribe al de `_all`", async () => {
        assert.equal((await dpto("services", "overlay-gana")).dpto, "meteo");
    });

    it("un CronJob toma la etiqueta de la ruta de CronJob", async () => {
        assert.equal((await dpto("services", "cron")).dpto, "backoffice");
    });

    it("prefiere `kustomization.tmpl.yaml` a `kustomization.yaml` en `_all`", async () => {
        assert.equal((await dpto("services", "tmpl")).dpto, "web");
    });

    it("sin etiqueta en ningún componente: null con aviso", async () => {
        const resultado = await dpto("services", "sin-etiqueta");
        assert.equal(resultado.dpto, null);
        assert.equal(resultado.avisos.length, 1);
    });

    it("caso ambiguo (dos componentes con departamentos distintos): null", async () => {
        assert.equal((await dpto("services", "ambiguo")).dpto, null);
    });

    it("remove, valor inválido y strategic merge con dpto: null", async () => {
        assert.equal((await dpto("services", "con-remove")).dpto, null);
        assert.equal((await dpto("services", "valor-malo")).dpto, null);
        assert.equal((await dpto("services", "strategic")).dpto, null);
    });

    it("falta el parche, falta el overlay del entorno o el entorno no es válido: null", async () => {
        assert.equal((await dpto("services", "falta-parche")).dpto, null);
        assert.equal((await dpto("services", "sin-overlay")).dpto, null);
        assert.equal((await dpto("services", "generico", "dev")).dpto, null);
        assert.equal((await dpto("services", "generico", "_all")).dpto, null, "un «entorno» que es otro directorio no vale");
        assert.equal((await dpto("services", "no-existe")).dpto, null);
    });

    it("nombre o directorio no válidos, o `tmp`/`credenciales`: null sin tocar disco", async () => {
        for (const {dir, name} of [{dir: "..", name: "generico"}, {dir: "services", name: ".."}, {dir: "services/x", name: "generico"}, {dir: "tmp", name: "otro"}, {dir: "services", name: "credenciales"}, {dir: "Services", name: "generico"}]) {
            const resultado = await dpto(dir, name);
            assert.equal(resultado.dpto, null, `${dir}/${name}`);
        }
    });

    it("un ciclo entre kustomizations: null, sin colgarse", async () => {
        assert.equal((await dpto("services", "ciclo-a")).dpto, null);
    });

    it("un recurso que sale del clon o entra en `tmp/`: null", async () => {
        assert.equal((await dpto("services", "fuera")).dpto, null);
        assert.equal((await dpto("services", "hacia-tmp")).dpto, null);
    });

    it("no sigue enlaces simbólicos (ni a un componente ni a un parche)", async () => {
        assert.equal((await dpto("services", "enlace")).dpto, null);
        assert.equal((await dpto("services", "enlace-parche")).dpto, null);
        assert.equal((await dpto("services", "via-dir-enlazado")).dpto, null);
    });

    it("un parche de más de 64 KiB no se lee: null", async () => {
        assert.equal((await dpto("services", "grande")).dpto, null);
    });

    it("los avisos nunca llevan el contenido de los parches", async () => {
        const resultado = await dpto("services", "secreto");
        assert.equal(resultado.dpto, null);
        assert.ok(resultado.avisos.length > 0);
        assert.ok(resultado.avisos.every(aviso => !aviso.includes(CENTINELA) && !aviso.includes("Mal Valor")), resultado.avisos.join("|"));
    });

    it("el clon puede ser un enlace simbólico (como `kustomizar/`): se resuelve una vez", async () => {
        const enlace = `${raiz}-enlace`;
        await fsp.symlink(raiz, enlace);
        try {
            assert.equal((await leerDepartamento({raiz: enlace, dir: "services", name: "generico", entorno: "test"})).dpto, "backoffice");
        } finally {
            await fsp.rm(enlace, {force: true});
        }
    });

    it("si no existe el clon: null", async () => {
        assert.equal((await leerDepartamento({raiz: `${raiz}-no-existe`, dir: "services", name: "generico", entorno: "test"})).dpto, null);
    });
});
