/**
 * Editor: Bixus
 * Fecha: Fri, 13 Nov 2026 08:17:27 GMT
 * Hash: 5f646ed5a2addf99c96eb2e801c61971
 * Versión: 2026.11.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import "./stubs/instalar";

import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {avisos, infos, limpiarAvisos} from "./stubs/log";
import {resolverContexto} from "../heartbeat/contexto";
import type {IMetadatosPod} from "../heartbeat/metadatos";
import type {IContextoHeartbeat} from "../heartbeat/payload";

/**
 * Si construir el contexto falla, antes no se emitía nada y no había ni un aviso: el pod desaparecía del panel sin
 * una pista de por qué.
 */

const metadatos: IMetadatosPod = {
    cluster: {valor: "c", origen: "metadata"},
    proyecto: {valor: "p", origen: "env"},
    ubicacion: {valor: "", origen: "vacío"},
};
const contexto = {cluster: "c"} as IContextoHeartbeat;

/** `"pendiente"` si la promesa no resuelve en unos milisegundos. */
const estado = async (promesa: Promise<unknown>): Promise<string> => Promise.race([
    promesa.then(() => "resuelta", () => "rechazada"),
    new Promise<string>((resolve) => setTimeout(() => resolve("pendiente"), 50)),
]);

describe("resolverContexto", () => {
    it("resuelve con lo que construye y deja un info con los valores y su origen", async () => {
        limpiarAvisos();
        assert.equal(await resolverContexto(Promise.resolve(metadatos), () => contexto), contexto);
        assert.equal(infos.length, 1);
        assert.match(infos[0] ?? "", /cluster="c" \(metadata\), proyecto="p" \(env\), ubicación="" \(vacío\)/);
        assert.equal(avisos.length, 0);
    });

    it("si construir lanza, avisa y no emite: la promesa queda pendiente y no rechaza", async () => {
        limpiarAvisos();
        const resultado = resolverContexto(Promise.resolve(metadatos), () => { throw new Error("hostname roto"); });
        assert.equal(await estado(resultado), "pendiente");
        assert.equal(avisos.length, 1);
        assert.match(avisos[0] ?? "", /no se pudo construir el contexto/);
    });

    it("si fallan los metadatos, lo mismo", async () => {
        limpiarAvisos();
        const resultado = resolverContexto(Promise.reject(new Error("x")), () => contexto);
        assert.equal(await estado(resultado), "pendiente");
        assert.equal(avisos.length, 1);
    });
});
