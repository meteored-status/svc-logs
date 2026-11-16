/**
 * Editor: Juan C. Martínez
 * Fecha: Wed, 11 Nov 2026 10:30:11 GMT
 * Hash: 868110b8b835949af4747327a743576f
 * Versión: 2026.11.11+2-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-panel-usuarios.git
 */

import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {construirOpenAPI} from "../../src/clases/auto-doc/openapi";
import {validarOpenAPI} from "../../src/clases/auto-doc/validar";
import {IMPORT_RG, rutasDe} from "./programa-virtual";

const IMPORT_CONTRATO = `import {Contract} from "@mr/core-network/server/http/routes/group/contract";\n`;

const TIPOS = `
/** Entrada. @property nombre - Nombre. */
interface IIn {nombre: string; edad?: number}
/** Salida. */
interface IOut {id: string}
interface IQuery {pagina: number; filtro?: "a" | "b"}
interface IHeaders {
    /** ID token. */
    authorization: string;
}
interface IHeadersMixtos {authorization?: string; "x-clave": string; accept: string; "Content-Type": string}
`;

/** Lee y construye el documento de un grupo `G` con el `getHandlers` dado. */
function generar(handlers: string, extra: Record<string, string> = {}, tipos = TIPOS): {doc: ReturnType<typeof construirOpenAPI>; avisos: ReturnType<typeof rutasDe>["avisos"]} {
    const rutas = rutasDe(`${IMPORT_RG}${IMPORT_CONTRATO}${tipos}
class G extends RouteGroup {
    protected getHandlers(): IRouteGroup[] {
        return ${handlers};
    }
}`, extra);

    return {doc: construirOpenAPI(rutas.grupos, {name: "svc"}, rutas.componentes), avisos: rutas.avisos};
}

const REF = (n: string): {$ref: string} => ({$ref: `#/components/schemas/${n}`});

describe("contract: tipos y envoltorio", () => {
    const {doc, avisos} = generar(`[{expresiones: [{
        metodos: ["POST"], exact: "/a", resumen: "/a",
        contract: Contract<{post: IIn; response: IOut; headers: IHeaders}>({errors: [400, 401, 500], description: "Crea algo"}),
    }]}]`);
    const op = doc.paths!["/a"].post!;

    it("sin avisos y con un documento válido", () => {
        assert.deepEqual(avisos, []);
        assert.deepEqual(validarOpenAPI(doc), []);
    });

    it("requestBody apunta al componente y es obligatorio", () => {
        assert.deepEqual(op.requestBody, {content: {"application/json": {schema: REF("IIn")}}, required: true});
        assert.deepEqual(Object.keys(doc.components!.schemas!), ["IIn", "IOut", "RespuestaKO", "RespuestaOK_IOut"]);
    });

    it("la respuesta correcta va envuelta en RespuestaOK_<Nombre>", () => {
        assert.deepEqual(op.responses!["200"], {description: "Respuesta correcta", content: {"application/json": {schema: REF("RespuestaOK_IOut")}}});
        assert.deepEqual(doc.components!.schemas!["RespuestaOK_IOut"], {
            type: "object",
            properties: {
                ok: {type: "boolean", const: true},
                expiracion: {type: "number", description: "Fecha de expiración de la respuesta, en milisegundos desde la época Unix"},
                data: REF("IOut"),
            },
            required: ["ok", "expiracion", "data"],
        });
    });

    it("cada código de errores es una respuesta con RespuestaKO, en el orden escrito", () => {
        assert.deepEqual(Object.keys(op.responses!), ["200", "400", "401", "500"]);
        assert.deepEqual(op.responses!["401"], {description: "No autenticado", content: {"application/json": {schema: REF("RespuestaKO")}}});
        assert.deepEqual(doc.components!.schemas!["RespuestaKO"].required, ["ok", "expiracion", "info"]);
    });

    it("la descripción es el summary; Authorization no es un parámetro sino un esquema de seguridad", () => {
        assert.equal(op.summary, "Crea algo");
        assert.equal(op.parameters, undefined);
        assert.deepEqual(op.security, [{IdToken: []}]);
        assert.deepEqual(doc.components!.securitySchemes, {IdToken: {type: "apiKey", in: "header", name: "Authorization", description: "ID token."}});
    });
});

describe("contract: data opcional, sin respuesta y envoltorio:false", () => {
    it("data admite undefined: no es obligatorio; void: no hay data", () => {
        const {doc} = generar(`[{expresiones: [
            {metodos: ["GET"], exact: "/a", resumen: "/a", contract: Contract<{response: IOut | undefined}>()},
            {metodos: ["GET"], exact: "/b", resumen: "/b", contract: Contract<{response: void}>()},
            {metodos: ["GET"], exact: "/c", resumen: "/c", contract: Contract({errors: [404]})},
        ]}]`);
        assert.deepEqual(doc.components!.schemas!["RespuestaOK_IOut_opcional"].required, ["ok", "expiracion"]);
        assert.equal(doc.components!.schemas!["RespuestaOK"].properties!["data"], undefined);
        assert.deepEqual(doc.paths!["/b"].get!.responses!["200"].content!["application/json"].schema, REF("RespuestaOK"));
        assert.deepEqual(Object.keys(doc.paths!["/c"].get!.responses!), ["200", "404"]);
    });

    it("una respuesta en línea nombra el envoltorio por su contenido: dos operaciones iguales lo comparten", () => {
        const {doc} = generar(`[{expresiones: [
            {metodos: ["GET"], exact: "/lista", resumen: "/lista", contract: Contract<{response: string[]}>()},
            {metodos: ["GET"], exact: "/otra", resumen: "/otra", contract: Contract<{response: string[]}>()},
            {metodos: ["GET"], exact: "/numeros", resumen: "/numeros", contract: Contract<{response: number[]}>()},
        ]}]`);
        const ref = (ruta: string): string => doc.paths![ruta].get!.responses!["200"].content!["application/json"].schema.$ref!;
        assert.equal(ref("/lista"), ref("/otra"));
        assert.notEqual(ref("/lista"), ref("/numeros"));
        assert.match(ref("/lista"), /^#\/components\/schemas\/RespuestaOK_[0-9a-f]{8}$/);
        assert.deepEqual(doc.components!.schemas![ref("/lista").split("/").pop()!].properties!["data"], {type: "array", items: {type: "string"}});
        assert.equal(Object.keys(doc.components!.schemas!).filter(n => n.startsWith("RespuestaOK_")).length, 2);
    });

    it("el mismo $ref con data opcional y obligatoria no comparte el required del envoltorio", () => {
        const {doc} = generar(`[{expresiones: [
            {metodos: ["GET"], exact: "/a", resumen: "/a", contract: Contract<{response: IOut}>()},
            {metodos: ["GET"], exact: "/b", resumen: "/b", contract: Contract<{response: IOut | undefined}>()},
        ]}]`);
        assert.deepEqual(doc.components!.schemas!["RespuestaOK_IOut"].required, ["ok", "expiracion", "data"]);
        assert.deepEqual(doc.components!.schemas!["RespuestaOK_IOut_opcional"].required, ["ok", "expiracion"]);
        assert.deepEqual(doc.paths!["/b"].get!.responses!["200"].content!["application/json"].schema, REF("RespuestaOK_IOut_opcional"));
    });

    it("sin respuesta en el contrato, el response literal es el data", () => {
        const {doc} = generar(`[{expresiones: [{
            metodos: ["GET"], exact: "/a", resumen: "/a",
            response: {listo: {type: "boolean", required: true, description: "ok"}},
            contract: Contract({errors: [404]}),
        }]}]`);
        const nombre = doc.paths!["/a"].get!.responses!["200"].content!["application/json"].schema.$ref!.split("/").pop()!;
        assert.deepEqual(doc.components!.schemas![nombre].properties!["data"], {type: "object", properties: {listo: {type: "boolean", description: "ok"}}, required: ["listo"]});
    });

    it("un tipo del código llamado RespuestaKO o RespuestaOK_x no pisa los envoltorios", () => {
        const {doc} = generar(`[{expresiones: [{metodos: ["POST"], exact: "/a", resumen: "/a", contract: Contract<{response: RespuestaKO; post: RespuestaOK_x}>({errors: [400]})}]}]`, {}, `${TIPOS}
interface RespuestaKO {mio: string}
interface RespuestaOK_x {mio: number}`);
        const nombres = Object.keys(doc.components!.schemas!);
        assert.ok(nombres.includes("RespuestaKO"));
        assert.deepEqual(doc.components!.schemas!["RespuestaKO"].required, ["ok", "expiracion", "info"]);
        assert.ok(nombres.some(n => /^RespuestaKO_/.test(n)), nombres.join());
        assert.ok(nombres.includes("Tipo_RespuestaOK_x"), nombres.join());
        assert.deepEqual(validarOpenAPI(doc), []);
    });

    it("envoltorio:false documenta la respuesta cruda y los errores sin cuerpo", () => {
        const {doc} = generar(`[{expresiones: [{metodos: ["GET"], exact: "/raw", resumen: "/raw", contract: Contract<{response: IOut}>({envelope: false, errors: [404]})}]}]`);
        const op = doc.paths!["/raw"].get!;
        assert.deepEqual(op.responses!["200"], {description: "Respuesta correcta", content: {"application/json": {schema: REF("IOut")}}});
        assert.deepEqual(op.responses!["404"], {description: "No encontrado"});
        assert.equal(doc.components!.schemas!["RespuestaKO"], undefined);
    });

    it("una ruta sin contrato no cambia: 200 genérico y sin components", () => {
        const {doc} = generar(`[{expresiones: [{metodos: ["GET"], exact: "/s", resumen: "/s"}]}]`);
        assert.deepEqual(doc.paths!["/s"].get!.responses, {"200": {description: "Respuesta correcta"}});
        assert.equal(doc.components, undefined);
    });
});

describe("contract: herencia, precedencia y orígenes", () => {
    it("el contrato del bloque lo heredan las expresiones; el de la expresión lo sustituye", () => {
        const {doc} = generar(`[{
            contract: Contract<{post: IIn; response: IOut}>({errors: [400]}),
            expresiones: [
                {metodos: ["POST"], exact: "/heredado", resumen: "/heredado"},
                {metodos: ["POST"], exact: "/propio", resumen: "/propio", contract: Contract<{post: IQuery}>({errors: [404]})},
            ],
        }]`);
        const heredado = doc.paths!["/heredado"].post!;
        assert.deepEqual(heredado.requestBody!.content["application/json"].schema, REF("IIn"));
        assert.deepEqual(Object.keys(heredado.responses!), ["200", "400"]);

        const propio = doc.paths!["/propio"].post!;
        assert.deepEqual(propio.requestBody!.content["application/json"].schema, REF("IQuery"));
        assert.deepEqual(Object.keys(propio.responses!), ["200", "404"]);
        assert.deepEqual(propio.responses!["200"].content!["application/json"].schema, REF("RespuestaOK"));
    });

    it("el contrato puede ser una const del mismo fichero o importada", () => {
        const {doc, avisos} = generar(`[{expresiones: [
            {metodos: ["POST"], exact: "/local", resumen: "/local", contract: LOCAL},
            {metodos: ["POST"], exact: "/importado", resumen: "/importado", contract: IMPORTADO},
        ]}]`, {
            "/v/externo.ts": `import {Contract} from "@mr/core-network/server/http/routes/group/contract";\nexport interface IExterno {z: number}\nexport const IMPORTADO = Contract<{response: IExterno}>({errors: [409]});`,
        }, `${TIPOS}\nimport {IMPORTADO} from "./externo";\nconst LOCAL = Contract<{post: IIn}>({errors: [400]});`);
        assert.deepEqual(avisos, []);
        assert.deepEqual(doc.paths!["/local"].post!.requestBody!.content["application/json"].schema, REF("IIn"));
        assert.deepEqual(Object.keys(doc.paths!["/importado"].post!.responses!), ["200", "409"]);
        assert.deepEqual(doc.paths!["/importado"].post!.responses!["200"].content!["application/json"].schema, REF("RespuestaOK_IExterno"));
        assert.deepEqual(validarOpenAPI(doc), []);
    });

    it("el contrato manda sobre los spec literales de post, query y headers", () => {
        const {doc} = generar(`[{expresiones: [{
            metodos: ["POST"], exact: "/a", resumen: "/a",
            post: {viejo: {type: "string", required: true, description: "x"}},
            query: {viejo: {type: "string"}},
            headers: {"x-viejo": {type: "string", required: true, description: "h"}},
            contract: Contract<{post: IIn; query: IQuery; headers: IHeaders}>(),
        }]}]`);
        const op = doc.paths!["/a"].post!;
        assert.deepEqual(op.requestBody!.content["application/json"].schema, REF("IIn"));
        assert.deepEqual(op.parameters, [
            {name: "pagina", in: "query", required: true, schema: {type: "number"}},
            {name: "filtro", in: "query", required: false, schema: {type: "string", enum: ["a", "b"]}},
        ]);
        assert.deepEqual(op.security, [{IdToken: []}]);
    });

    it("sin la clave en el contrato, siguen valiendo los spec literales", () => {
        const {doc} = generar(`[{expresiones: [{
            metodos: ["POST"], exact: "/a", resumen: "/a",
            post: {campo: {type: "string", required: true, description: "x"}},
            contract: Contract<{response: IOut}>(),
        }]}]`);
        assert.deepEqual(Object.keys(doc.paths!["/a"].post!.requestBody!.content["application/json"].schema.properties!), ["campo"]);
    });

    it("la descripción de propiedades de query sale del JSDoc", () => {
        const {doc} = generar(`[{expresiones: [{metodos: ["GET"], exact: "/a", resumen: "/a", contract: Contract<{query: IBusqueda}>()}]}]`, {}, `
/** @property q - Texto a buscar. */
interface IBusqueda {q: string}`);
        assert.deepEqual(doc.paths!["/a"].get!.parameters, [{name: "q", in: "query", required: true, schema: {type: "string"}, description: "Texto a buscar."}]);
    });
});

describe("contract: avisos y errores", () => {
    it("una clave desconocida de los tipos y de la configuración avisa", () => {
        const {avisos} = generar(`[{expresiones: [{metodos: ["POST"], exact: "/a", resumen: "/a", contract: Contract<{post: IIn; resposta: IOut}>({erorres: [400]} as never)}]}]`);
        const mensajes = avisos.map(a => a.mensaje);
        assert.equal(mensajes.length, 2);
        assert.match(mensajes[0], /«resposta» no es una clave de los tipos del contract/);
        assert.match(mensajes[1], /«erorres» no es una clave del contract/);
        assert.ok(avisos.every(a => a.severidad === "aviso" && a.ubicacion?.startsWith("main.ts:")));
    });

    it("códigos de error inválidos o repetidos", () => {
        const rutas = rutasDe(`${IMPORT_RG}${IMPORT_CONTRATO}
class G extends RouteGroup {
    protected getHandlers(): IRouteGroup[] {
        return [{expresiones: [{metodos: ["GET"], exact: "/a", resumen: "/a", contract: Contract({errors: [404, 404, 200, 700]})}]}];
    }
}`);
        const avisos = rutas.avisos;
        assert.deepEqual(rutas.grupos[0].operaciones[0].contrato!.errores, [404]);
        assert.equal(avisos.length, 2);
        assert.match(avisos[0].mensaje, /«200» no es un código de error HTTP/);
    });

    it("un campo contrato que no es un Contract<T>() avisa y se ignora", () => {
        const {doc, avisos} = generar(`[{expresiones: [{metodos: ["GET"], exact: "/a", resumen: "/a", contract: {errors: [400]} as never}]}]`);
        assert.equal(avisos.length, 1);
        assert.match(avisos[0].mensaje, /no es un Contract<T>\(\)/);
        assert.deepEqual(doc.paths!["/a"].get!.responses, {"200": {description: "Respuesta correcta", content: {"application/json": {schema: REF("RespuestaOK")}}}});
    });

    it("contract.post en una ruta que acepta GET avisa y no pone requestBody en GET", () => {
        const {doc, avisos} = generar(`[{expresiones: [{metodos: ["GET", "POST"], exact: "/a", resumen: "/a", contract: Contract<{post: IIn}>()}]}]`);
        assert.equal(avisos.length, 1);
        assert.match(avisos[0].mensaje, /GET\/HEAD\/OPTIONS/);
        assert.equal(doc.paths!["/a"].get!.requestBody, undefined);
        assert.ok(doc.paths!["/a"].post!.requestBody);
    });

    it("un tipo de contrato que no se resuelve es un error", () => {
        const {avisos} = generar(`[{expresiones: [{metodos: ["POST"], exact: "/a", resumen: "/a", contract: Contract<{post: Roto}>()}]}]`, {}, `${TIPOS}\nimport type {Roto} from "./no-existe";`);
        assert.ok(avisos.some(a => a.severidad === "error" && /no se puede resolver el tipo/.test(a.mensaje)));
    });

    it("los avisos de tipos no representables salen con la ubicación del contrato", () => {
        const {avisos} = generar(`[{expresiones: [{metodos: ["POST"], exact: "/a", resumen: "/a", contract: Contract<{post: IGrande}>()}]}]`, {}, `${TIPOS}\ninterface IGrande {n: bigint}`);
        assert.equal(avisos.length, 1);
        assert.match(avisos[0].mensaje, /bigint.*en «n»/);
        assert.match(avisos[0].ubicacion ?? "", /^main\.ts:\d+$/);
    });
});

describe("contract: determinismo", () => {
    it("dos generaciones dan exactamente el mismo JSON", () => {
        const codigo = `[{expresiones: [
            {metodos: ["POST"], exact: "/a", resumen: "/a", contract: Contract<{post: IIn; response: IOut}>({errors: [400, 500]})},
            {metodos: ["GET"], exact: "/b", resumen: "/b", contract: Contract<{query: IQuery; response: IOut[]}>({errors: [404]})},
        ]}]`;
        assert.equal(JSON.stringify(generar(codigo).doc), JSON.stringify(generar(codigo).doc));
    });
});

describe("contract: cabeceras que OpenAPI ignora", () => {
    const {doc, avisos} = generar(`[{expresiones: [{metodos: ["GET"], exact: "/a", resumen: "/a", contract: Contract<{headers: IHeadersMixtos}>()}]}]`);
    const op = doc.paths!["/a"].get!;

    it("Authorization opcional es un esquema de seguridad con alternativa vacía", () => {
        assert.deepEqual(op.security, [{IdToken: []}, {}]);
        assert.deepEqual(doc.components!.securitySchemes, {IdToken: {type: "apiKey", in: "header", name: "Authorization"}});
        assert.deepEqual(validarOpenAPI(doc), []);
    });

    it("Accept y Content-Type no se emiten como parámetro y avisan; el resto sí", () => {
        assert.deepEqual(op.parameters, [{name: "x-clave", in: "header", required: true, schema: {type: "string"}}]);
        assert.equal(avisos.filter(a => /ignora como parámetro/.test(a.mensaje)).length, 2);
        assert.ok(avisos.every(a => /^main\.ts:\d+$/.test(a.ubicacion ?? "")));
    });

    it("también con la cabecera del literal, sin contrato", () => {
        const literal = generar(`[{expresiones: [{metodos: ["GET"], exact: "/a", resumen: "/a", headers: {Authorization: {type: "string", required: true, description: "Token"}, "x-k": {type: "string", required: true, description: "k"}}}]}]`);
        const operacion = literal.doc.paths!["/a"].get!;
        assert.deepEqual(operacion.security, [{IdToken: []}]);
        assert.deepEqual(operacion.parameters!.map(p => p.name), ["x-k"]);
        assert.equal(literal.doc.components!.securitySchemes!["IdToken"].description, "Token");
    });
});
