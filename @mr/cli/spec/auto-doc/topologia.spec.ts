/**
 * Editor: Juan C. Martínez
 * Fecha: Thu, 12 Nov 2026 13:17:55 GMT
 * Hash: a8e0664a6593012e30d057cacffb90fa
 * Versión: 2026.11.12+2-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-panel-intranet.git
 */

import {after, afterEach, before, describe, it, mock} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {calcularTopologia, esTopologiaNoSoportada, leerTopologia, zonaDeEntornos} from "../../src/clases/auto-doc/topologia";

/** Contenido que no debe aparecer nunca en un resultado ni leerse. */
const CENTINELA = "CENTINELA-SECRETO-NO-LEER";

function base(name: string, {componente = "proxy", router = true, namespace = "meteored-services", suffix = `-${name}`}: {componente?: string, router?: boolean, namespace?: string, suffix?: string} = {}): string {
    return `apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
generatorOptions:
  disableNameSuffixHash: true

namespace: ${namespace}
nameSuffix: ${suffix}
resources:
  - ../../_componentes/deployment
  - ../../../_componentes/${componente}
${router ? "  - router.yaml\n  - internal-router.yaml\n" : ""}secretGenerator:
  - name: credenciales
    behavior: merge
    files:
      - mysql.json=credenciales/mysql-services-\${ZONA}.json
`;
}

function overlay(aplicaRouter: boolean): string {
    return `apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../_all
patches:
  - path: autoscaler.json
    target:
      kind: HorizontalPodAutoscaler
${aplicaRouter ? "  - path: router.json\n    target:\n      kind: VirtualService\n" : ""}`;
}

function router(...hosts: string[]): string {
    return JSON.stringify([{op: "replace", path: "/spec/hosts", value: hosts}]);
}

const CFG = {name: "svc", kustomizer: "services", entorno: "test", alone: false, soloZona: null} as const;

describe("calcularTopologia", () => {
    it("proxy con router.yaml y router.json: hosts públicos y Service interno", () => {
        const {topologia, avisos} = calcularTopologia(CFG, {base: base("svc"), entorno: overlay(true), router: router("test-users.meteored.com", "test-newsletter.meteored.com")});
        assert.deepEqual(avisos, []);
        assert.deepEqual(topologia, {
            v: 1,
            entorno: "test",
            kustomizer: "services",
            publico: {hosts: ["test-users.meteored.com", "test-newsletter.meteored.com"], aplicaRouter: true, tieneRouter: true},
            interno: {servicio: "proxy-servicio-svc", namespace: "meteored-services", puerto: 80},
            alone: false,
            soloZona: null,
        });
    });

    it("router.json aplicado sin router.yaml (caso arts-backend): ningún host público", () => {
        const {topologia} = calcularTopologia(CFG, {base: base("svc", {componente: "switch", router: false}), entorno: overlay(true), router: router("test-services.meteored.com")});
        assert.deepEqual(topologia?.publico, {hosts: [], aplicaRouter: true, tieneRouter: false});
    });

    it("router.yaml declarado pero el entorno no aplica router.json: ningún host público", () => {
        const {topologia} = calcularTopologia(CFG, {base: base("svc"), entorno: overlay(false), router: router("test-users.meteored.com")});
        assert.deepEqual(topologia?.publico, {hosts: [], aplicaRouter: false, tieneRouter: true});
    });

    it("proxy y switch dan el prefijo de su Service", () => {
        const proxy = calcularTopologia(CFG, {base: base("svc", {componente: "proxy"}), entorno: overlay(false)});
        const sw = calcularTopologia(CFG, {base: base("svc", {componente: "switch"}), entorno: overlay(false)});
        assert.equal(proxy.topologia?.interno.servicio, "proxy-servicio-svc");
        assert.equal(sw.topologia?.interno.servicio, "switch-servicio-svc");
    });

    it("el namespace sale de _all (meteored-www)", () => {
        const {topologia} = calcularTopologia(CFG, {base: base("svc", {namespace: "meteored-www"}), entorno: overlay(false)});
        assert.equal(topologia?.interno.namespace, "meteored-www");
    });

    it("sin topología si el namespace lleva variables, el nameSuffix no casa o hay los dos componentes", () => {
        assert.equal(calcularTopologia(CFG, {base: base("svc", {namespace: "ns-${ZONA}"}), entorno: overlay(false)}).topologia, null);
        assert.equal(calcularTopologia(CFG, {base: base("svc", {suffix: "-otro"}), entorno: overlay(false)}).topologia, null);
        const dos = base("svc").replace("  - router.yaml", "  - ../../../_componentes/switch\n  - router.yaml");
        assert.equal(calcularTopologia(CFG, {base: dos, entorno: overlay(false)}).topologia, null);
        assert.equal(calcularTopologia(CFG, {base: "namespace: meteored-services\nnameSuffix: -svc\nresources: []\n", entorno: overlay(false)}).topologia, null);
    });

    it("sin topología, con aviso, si faltan los ficheros o no son YAML válido", () => {
        for (const ficheros of [{}, {base: base("svc")}, {base: "a: [", entorno: overlay(false)}, {base: base("svc"), entorno: "- 1"}]) {
            const {topologia, avisos} = calcularTopologia(CFG, ficheros);
            assert.equal(topologia, null);
            assert.equal(avisos.length, 1);
        }
    });

    it("aplica y declara router pero falta o está roto router.json: sin topología", () => {
        assert.equal(calcularTopologia(CFG, {base: base("svc"), entorno: overlay(true)}).topologia, null);
        assert.equal(calcularTopologia(CFG, {base: base("svc"), entorno: overlay(true), router: "{no es json"}).topologia, null);
        assert.equal(calcularTopologia(CFG, {base: base("svc"), entorno: overlay(true), router: "{}"}).topologia, null);
    });

    it("descarta con aviso los hosts que no son un nombre DNS (comodín, IP, puerto, mayúsculas, error) y quita duplicados", () => {
        const {topologia, avisos} = calcularTopologia(CFG, {
            base: base("svc"),
            entorno: overlay(true),
            router: router("ok.meteored.com", "*.meteored.com", "10.0.0.1", "host.meteored.com:8080", "Mayus.meteored.com", "error", "ok.meteored.com", "sin-punto", "a b.com", "-x.meteored.com"),
        });
        assert.deepEqual(topologia?.publico.hosts, ["ok.meteored.com"]);
        assert.equal(avisos.length, 1);
        assert.match(avisos[0], /8 host\(s\) descartado\(s\)/);
    });

    it("los avisos no llevan el contenido de los hosts descartados", () => {
        const {avisos} = calcularTopologia(CFG, {base: base("svc"), entorno: overlay(true), router: router("ok.meteored.com", "SECRETO-NO-LOGUEAR.meteored.com", "10.9.9.9")});

        assert.equal(avisos.length, 1);
        assert.ok(avisos.every(aviso => !aviso.includes("SECRETO") && !aviso.includes("10.9.9.9")), avisos.join("|"));
    });

    it("descarta los hosts con sufijo de red interna, etiquetas 0x… y formas que new URL convierte en IP", () => {
        const malos = ["a.svc", "a.ns.svc.cluster.local", "metadata.google.internal", "impresora.local", "a.localhost", "0x7f.0x1", "0x7f000001.meteored.com", "a.0x1", "svc.cluster.local"];
        const {topologia, avisos} = calcularTopologia(CFG, {base: base("svc"), entorno: overlay(true), router: router("ok.meteored.com", "svc.meteored.com", "internal.meteored.com", ...malos)});

        assert.deepEqual(topologia?.publico.hosts, ["ok.meteored.com", "svc.meteored.com", "internal.meteored.com"]);
        assert.match(avisos[0], new RegExp(`${malos.length} host`));
    });

    it("solo cuentan las operaciones replace sobre /spec/hosts", () => {
        const json = JSON.stringify([
            {op: "add", path: "/spec/hosts", value: ["add.meteored.com"]},
            {op: "replace", path: "/spec/gateways", value: ["gw.meteored.com"]},
            {op: "replace", path: "/spec/hosts", value: ["bueno.meteored.com"]},
        ]);
        const {topologia} = calcularTopologia(CFG, {base: base("svc"), entorno: overlay(true), router: json});
        assert.deepEqual(topologia?.publico.hosts, ["bueno.meteored.com"]);
    });

    it("alone: soloZona solo si el deployment es alone", () => {
        const sola = calcularTopologia({...CFG, alone: true, soloZona: "belgica"}, {base: base("svc"), entorno: overlay(false)});
        assert.equal(sola.topologia?.alone, true);
        assert.equal(sola.topologia?.soloZona, "belgica");
        const noSola = calcularTopologia({...CFG, alone: false, soloZona: "belgica"}, {base: base("svc"), entorno: overlay(false)});
        assert.equal(noSola.topologia?.soloZona, null);
    });

    it("el entorno y el kustomizer salen de la configuración", () => {
        const {topologia} = calcularTopologia({...CFG, entorno: "produccion", kustomizer: "tiempo-web"}, {base: base("svc"), entorno: overlay(false)});
        assert.equal(topologia?.entorno, "produccion");
        assert.equal(topologia?.kustomizer, "tiempo-web");
    });
});

describe("esTopologiaNoSoportada y zonaDeEntornos", () => {
    it("reconoce columna inexistente y falta de permiso, y nada más", () => {
        for (const code of ["ER_BAD_FIELD_ERROR", "ER_COLUMNACCESS_DENIED_ERROR", "ER_TABLEACCESS_DENIED_ERROR", "ER_DBACCESS_DENIED_ERROR"]) {
            assert.equal(esTopologiaNoSoportada({code}), true, code);
        }
        for (const err of [{code: "ER_DUP_ENTRY"}, {code: "ER_LOCK_DEADLOCK"}, new Error("x"), null, undefined, "ER_BAD_FIELD_ERROR"]) {
            assert.equal(esTopologiaNoSoportada(err), false);
        }
    });

    it("la zona es la del primer clúster de entornos.json", () => {
        assert.equal(zonaDeEntornos(JSON.stringify([{resourceLabels: {zona: "belgica"}}, {resourceLabels: {zona: "oregon"}}])), "belgica");
        assert.equal(zonaDeEntornos(JSON.stringify([{resourceLabels: {}}])), null);
        assert.equal(zonaDeEntornos(JSON.stringify([{resourceLabels: {zona: "../x"}}])), null);
        assert.equal(zonaDeEntornos("[]"), null);
        assert.equal(zonaDeEntornos("no json"), null);
    });
});

describe("leerTopologia (sobre un directorio kustomize falso)", () => {
    let tmp: string;
    let raiz: string;
    let fuera: string;

    function escribir(relativa: string, contenido: string): void {
        const ruta = path.join(raiz, relativa);
        fs.mkdirSync(path.dirname(ruta), {recursive: true});
        fs.writeFileSync(ruta, contenido);
    }

    /** Deployment `svc` con todo lo que un repo kustomize real tiene alrededor y que no se puede leer. */
    function arbol(): void {
        escribir("services/svc/_all/kustomization.tmpl.yaml", base("svc"));
        escribir("services/svc/_all/router.yaml", "kind: VirtualService\n");
        escribir("services/svc/_all/credenciales/mysql.json", `{"password": "${CENTINELA}"}`);
        escribir("services/svc/_all/secret.yaml", `kind: Secret\ndata:\n  x: ${CENTINELA}\n`);
        escribir("services/svc/test/kustomization.yaml", overlay(true));
        escribir("services/svc/test/router.json", router("test-svc.meteored.com"));
        escribir("services/svc/test/credenciales/stripe.json", CENTINELA);
        escribir("services/svc/test/secret.yaml", `kind: Secret\ndata:\n  x: ${CENTINELA}\n`);
        escribir("services/svc/produccion/kustomization.yaml", overlay(false));
        escribir("services/svc/produccion/router.json", router("prod-svc.meteored.com"));
        escribir("tmp/credenciales/mysql.json", CENTINELA);
        escribir("credenciales/mysql.json", CENTINELA);
        fs.mkdirSync(path.join(fuera, "_all"), {recursive: true});
        fs.mkdirSync(path.join(fuera, "test"), {recursive: true});
        fs.writeFileSync(path.join(fuera, "_all/kustomization.tmpl.yaml"), base("evil"));
        fs.writeFileSync(path.join(fuera, "test/kustomization.yaml"), overlay(false));
    }

    const leidos: string[] = [];

    before(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), "topologia-spec-"));
        raiz = path.join(tmp, "kustomizar");
        fuera = path.join(tmp, "fuera");
        fs.mkdirSync(raiz, {recursive: true});
        fs.mkdirSync(fuera, {recursive: true});
        arbol();
    });

    after(() => {
        fs.rmSync(tmp, {recursive: true, force: true});
    });

    afterEach(() => {
        mock.restoreAll();
        leidos.length = 0;
    });

    /** Registra todas las rutas que se abren con `readFile` (y deja pasar la lectura). */
    function espiar(): void {
        const original = fsp.readFile.bind(fsp);
        mock.method(fsp, "readFile", (ruta: unknown, ...resto: unknown[]) => {
            leidos.push(String(ruta));

            return (original as (...a: unknown[]) => Promise<unknown>)(ruta, ...resto);
        });
    }

    const lectura = {raiz: "", dir: "services", name: "svc", entorno: "test", alone: false, soloZona: null};

    it("calcula la topología y solo lee la lista cerrada de ficheros, nunca Secret ni credenciales/ ni tmp/", async () => {
        espiar();
        const {topologia, avisos} = await leerTopologia({...lectura, raiz});
        assert.deepEqual(avisos, []);
        assert.deepEqual(topologia?.publico, {hosts: ["test-svc.meteored.com"], aplicaRouter: true, tieneRouter: true});
        assert.equal(topologia?.interno.servicio, "proxy-servicio-svc");
        assert.ok(!JSON.stringify(topologia).includes(CENTINELA));

        const real = fs.realpathSync(path.join(raiz, "services/svc"));
        assert.deepEqual(leidos.sort(), [
            path.join(real, "_all/kustomization.tmpl.yaml"),
            path.join(real, "test/kustomization.yaml"),
            path.join(real, "test/router.json"),
        ].sort());
    });

    it("sin aplicar router.json no abre router.json", async () => {
        espiar();
        const {topologia} = await leerTopologia({...lectura, raiz, entorno: "produccion"});
        assert.deepEqual(topologia?.publico, {hosts: [], aplicaRouter: false, tieneRouter: true});
        assert.ok(leidos.every(r => !r.endsWith("router.json")), leidos.join());
    });

    it("rechaza `..`, rutas y nombres que no son [a-z0-9-] sin leer nada", async () => {
        espiar();
        const casos = [
            {dir: "..", name: "svc"},
            {dir: "services", name: ".."},
            {dir: "services/../..", name: "svc"},
            {dir: "../fuera", name: "svc"},
            {dir: "services", name: "../../fuera"},
            {dir: "services", name: "svc/../svc"},
            {dir: "Services", name: "svc"},
            {dir: "services", name: ""},
            {dir: "tmp", name: "svc"},
            {dir: "credenciales", name: "svc"},
            {dir: "services", name: "tmp"},
            {dir: "services", name: "credenciales"},
        ];
        for (const caso of casos) {
            const {topologia, avisos} = await leerTopologia({...lectura, raiz, ...caso});
            assert.equal(topologia, null, JSON.stringify(caso));
            assert.equal(avisos.length, 1);
            assert.match(avisos[0], /no son válidos/, JSON.stringify(caso));
        }
        assert.deepEqual(leidos, []);
    });

    it("rechaza un entorno que no es test ni produccion (incluido `../tmp`)", async () => {
        espiar();
        for (const entorno of ["../tmp", "dev", "", "_all", "test/../_all"]) {
            const {topologia} = await leerTopologia({...lectura, raiz, entorno});
            assert.equal(topologia, null, entorno);
        }
        assert.deepEqual(leidos, []);
    });

    it("no sigue un enlace simbólico a un directorio fuera del clon", async () => {
        fs.symlinkSync(fuera, path.join(raiz, "services/evil"), "dir");
        try {
            espiar();
            const {topologia, avisos} = await leerTopologia({...lectura, raiz, name: "evil"});
            assert.equal(topologia, null);
            assert.equal(avisos.length, 1);
            assert.deepEqual(leidos, []);
        } finally {
            fs.rmSync(path.join(raiz, "services/evil"));
        }
    });

    it("no lee un fichero de la lista que sea un enlace simbólico (router.json → credenciales, aunque el destino esté dentro del deployment)", async () => {
        const ruta = path.join(raiz, "services/svc/test/router.json");
        const original = fs.readFileSync(ruta);
        fs.rmSync(ruta);
        fs.symlinkSync(path.join(raiz, "services/svc/_all/credenciales/mysql.json"), ruta);
        try {
            espiar();
            const {topologia, avisos} = await leerTopologia({...lectura, raiz});
            assert.equal(topologia, null);
            assert.ok(avisos.some(a => a.includes("test/router.json")), avisos.join());
            assert.ok(!JSON.stringify(avisos).includes(CENTINELA));
            assert.ok(leidos.every(r => !r.endsWith("router.json")), leidos.join());
        } finally {
            fs.rmSync(ruta);
            fs.writeFileSync(ruta, original);
        }
    });

    it("no lee un fichero de más de 64 KiB", async () => {
        const ruta = path.join(raiz, "services/svc/test/router.json");
        const original = fs.readFileSync(ruta);
        fs.writeFileSync(ruta, JSON.stringify([{op: "replace", path: "/spec/hosts", value: ["a.meteored.com"], relleno: "x".repeat(70 * 1024)}]));
        try {
            const {topologia, avisos} = await leerTopologia({...lectura, raiz});
            assert.equal(topologia, null);
            assert.ok(avisos.some(a => a.includes("64 KiB")), avisos.join());
        } finally {
            fs.writeFileSync(ruta, original);
        }
    });

    it("sin directorio, sin entorno o con `.yaml` en vez de `.tmpl.yaml`", async () => {
        assert.equal((await leerTopologia({...lectura, raiz, name: "no-existe"})).topologia, null);
        escribir("services/solo-yaml/_all/kustomization.yaml", base("solo-yaml", {router: false}));
        escribir("services/solo-yaml/test/kustomization.yaml", overlay(false));
        const ok = await leerTopologia({...lectura, raiz, name: "solo-yaml"});
        assert.equal(ok.topologia?.interno.servicio, "proxy-servicio-solo-yaml");
        assert.equal((await leerTopologia({...lectura, raiz, name: "solo-yaml", entorno: "produccion"})).topologia, null);
    });
});
