/**
 * Editor: Bixus
 * Fecha: Fri, 13 Nov 2026 08:17:27 GMT
 * Hash: 8a7009f04962c5f00681fd53f8ea1850
 * Versión: 2026.11.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import "./stubs/instalar";

import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {PRESUPUESTO_ANTES_DE_CERRAR_MS, SHUTDOWN_TIMEOUT_PRODUCCION_MS, limiteDuroMs} from "@mr/core-network/server/http/config/net";

import {DESPEDIDA_MAX_MS, ESPERA_WORKERS_MS} from "../heartbeat/cierre-primario";
import {HOLGURA_PRESUPUESTO_MS, MARGEN_ENDPOINTS_MS} from "../engine/lock";

/**
 * Invariantes del reparto de los 25 s de `terminationGracePeriodSeconds` (el máximo de Autopilot), contados desde
 * el inicio del preStop. El peor caso de cada proceso suma el **presupuesto** de `antesDeCerrar` (lo máximo que puede
 * durar el margen aunque se cuelgue), no el margen nominal, y el límite duro es el de `cerrarYSalir` (`limiteDuroMs`).
 */

const GRACIA_MS = 25_000;
const LIMITE_DURO_MS = 23_000;

describe("presupuesto del apagado", () => {
    it("el margen de endpoints cabe en el presupuesto de antesDeCerrar del servidor, y queda holgura para el stat", () => {
        assert.ok(MARGEN_ENDPOINTS_MS <= PRESUPUESTO_ANTES_DE_CERRAR_MS);
        assert.ok(HOLGURA_PRESUPUESTO_MS > 0 && HOLGURA_PRESUPUESTO_MS < PRESUPUESTO_ANTES_DE_CERRAR_MS);
    });

    it("un servicio HTTP: presupuesto de antesDeCerrar + límite duro de cerrarYSalir caben en 23 s", () => {
        assert.ok(PRESUPUESTO_ANTES_DE_CERRAR_MS + limiteDuroMs(SHUTDOWN_TIMEOUT_PRODUCCION_MS) <= LIMITE_DURO_MS);
    });

    it("el primario de un cluster: presupuesto + espera a los workers + despedida caben en 23 s", () => {
        assert.ok(PRESUPUESTO_ANTES_DE_CERRAR_MS + ESPERA_WORKERS_MS + DESPEDIDA_MAX_MS <= LIMITE_DURO_MS);
    });

    it("el límite duro deja al menos 2 s de la gracia", () => {
        assert.ok(GRACIA_MS - LIMITE_DURO_MS >= 2_000);
    });
});
