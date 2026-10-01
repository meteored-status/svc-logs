import {probador} from "../../lib/probador.js";
import regla from "../../rules/jsdoc-type-members.js";

probador.run("jsdoc-type-members", regla, {
    valid: [
        `/**
 * Configuración de conexión.
 *
 * @property host - Nombre de host o IP del servidor.
 * @property port - Puerto TCP. Por defecto 8080.
 */
interface IConfig {
    host: string;
    port?: number;
}`,
        "interface IConfig { host: string; }",
        // Los comentarios de línea quedan fuera salvo que se pidan.
        `interface IConfig {
    // eslint-disable-next-line
    host: string;
}`,
        // Un tipo literal solo se mira si se pide.
        `type Config = {
    /** Host. */
    host: string;
};`,
        "enum Estado { Abierto = \"abierto\" }",
    ],
    invalid: [
        {
            code: `interface IConfig {
    /** Nombre de host o IP. */
    host: string;
    /** Puerto TCP. */
    port?: number;
}`,
            errors: [
                {messageId: "documentaEnElBloque", data: {tipo: "IConfig", miembro: "host"}},
                {messageId: "documentaEnElBloque", data: {tipo: "IConfig", miembro: "port"}},
            ],
        },
        {
            code: `enum CircuitState {
    /** Funcionamiento normal. */
    Closed = "closed",
}`,
            errors: [{messageId: "documentaEnElBloque", data: {tipo: "CircuitState", miembro: "Closed"}}],
        },
        {
            code: `interface IConfig {
    // Nombre de host.
    host: string;
}`,
            options: [{incluirComentariosDeLinea: true}],
            errors: [{messageId: "documentaEnElBloque", data: {tipo: "IConfig", miembro: "host"}}],
        },
        {
            code: `type Config = {
    /** Host. */
    host: string;
};`,
            options: [{incluirTiposLiterales: true}],
            errors: [{messageId: "documentaEnElBloque", data: {tipo: "Config", miembro: "host"}}],
        },
    ],
});
