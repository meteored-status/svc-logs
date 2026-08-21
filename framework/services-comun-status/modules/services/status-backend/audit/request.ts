/**
 * Editor: Bixus
 * Fecha: Fri, 21 Aug 2026 06:11:54 GMT
 * Hash: bc35701b6110c7f57701363d5996b410
 * Versión: 2026.8.21+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {AUDIT_PATH_HEADER} from "./interface";

/**
 * Configuración de una petición al backend que puede acabar en un apunte de auditoría: el token de
 * siempre más la pantalla del panel desde la que se lanzó.
 *
 * Está aquí, junto a la cabecera, y no repetida en cada cliente (`user`, `rol`, `dpto`…) porque lo único
 * que hay que saber para usarla es cómo se llama esa cabecera, y ese nombre tiene que estar en un solo
 * sitio: si un cliente la escribiera con otro nombre, el backend no la vería y el apunte quedaría con la
 * ruta del endpoint sin que nada fallara. Un error así no da la cara, solo ensucia el registro.
 *
 * @param token     Token de la petición, tal y como llega.
 * @param auditPath Pantalla del panel. Vacía —que es lo que manda el BFF cuando el navegador no la
 *                  envió— significa «no la mandes»: sin cabecera el backend cae al endpoint, y eso es
 *                  justo lo que hay que registrar cuando la llamada no viene de ninguna pantalla.
 */
export const auditRequest = (token: string, auditPath: string): {auth: string; headers?: Record<string, string>} => {
    return {
        auth: token,
        ...auditPath.length > 0 ? {headers: {[AUDIT_PATH_HEADER]: auditPath}} : {},
    };
}
