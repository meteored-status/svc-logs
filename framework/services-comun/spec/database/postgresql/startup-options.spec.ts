/**
 * Editor: Juan C. Martínez
 * Fecha: Tue, 06 Oct 2026 13:34:18 GMT
 * Hash: 07677cec37b9bdfa25f001bbfc83dfee
 * Versión: 2026.10.6+1-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-localizacion.git
 */

import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {startupOptions} from "../../../modules/database/postgresql/startup-options";

describe("startupOptions: los settings de la conexion como opcion de arranque de libpq", () => {
    it("un -c por parametro, en orden, con numeros y con el prefijo de la extension", () => {
        assert.equal(startupOptions({"work_mem": "64MB", "pg_trgm.similarity_threshold": 0.35, "statement_timeout": "5s"}), "-c work_mem=64MB -c pg_trgm.similarity_threshold=0.35 -c statement_timeout=5s");
    });

    it("los espacios y las barras del valor van escapados con \\, que es lo que separa las opciones", () => {
        assert.equal(startupOptions({"search_path": "core, public"}), "-c search_path=core,\\ public");
        assert.equal(startupOptions({"application_name": "a\\b"}), "-c application_name=a\\\\b");
    });

    it("sin parametros, cadena vacia", () => {
        assert.equal(startupOptions({}), "");
    });

    it("un nombre que no es el de un parametro no se interpola: se rechaza", () => {
        for (const nombre of ["work_mem -c x", "1abc", "a.b.c", "", "a=b"]) {
            assert.throws(() => startupOptions({[nombre]: "1"}), /no valido/, nombre);
        }
    });
});
