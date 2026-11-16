/**
 * Editor: Juan C. Martínez
 * Fecha: Wed, 11 Nov 2026 10:36:06 GMT
 * Hash: c5b6a7dc8018fbc3c2cb142bc9662207
 * Versión: 2026.11.11+3-juancmartinez
 * Anterior: 2026.11.11+2-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-panel-usuarios.git
 */

import {describe, it} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";

import ts from "typescript";

import {GeneradorEsquemas} from "../../src/clases/auto-doc/esquema";
import {hashDocumento} from "../../src/clases/auto-doc/canonico";
import {campoDe, crearProgramaVirtual, esquemaDeTipo, RAIZ} from "./programa-virtual";

describe("esquema: primitivos y opcionales", () => {
    it("string, number y boolean", () => {
        assert.deepEqual(campoDe("string").campo, {type: "string"});
        assert.deepEqual(campoDe("number").campo, {type: "number"});
        assert.deepEqual(campoDe("boolean").campo, {type: "boolean"});
    });

    it("boolean y boolean|undefined no salen como enum", () => {
        assert.deepEqual(campoDe("boolean | undefined").campo, {type: "boolean"});
        assert.deepEqual(campoDe("boolean | null").campo, {type: ["boolean", "null"]});
    });

    it("distingue campo? de campo: T|undefined solo en que ambos son opcionales; un T normal es obligatorio", () => {
        const {raiz} = {raiz: esquemaDeTipo("interface T {a: string; b?: string; c: string | undefined; d?: number | undefined}").componentes["T"]};
        assert.deepEqual(raiz.required, ["a"]);
        assert.deepEqual(Object.keys(raiz.properties!), ["a", "b", "c", "d"]);
    });

    it("any y unknown explícitos son {} sin aviso; un import roto es un error", () => {
        const libre = campoDe("any");
        assert.deepEqual(libre.campo, {});
        assert.deepEqual(libre.avisos, []);
        assert.deepEqual(campoDe("unknown").campo, {});

        const roto = esquemaDeTipo(`import type {Nada} from "./no-existe";\ninterface T {campo: Nada}`);
        assert.equal(roto.avisos.length, 1);
        assert.equal(roto.avisos[0].severidad, "error");
        assert.match(roto.avisos[0].mensaje, /no se puede resolver el tipo en «campo»/);
    });
});

describe("esquema: literales, enums y uniones", () => {
    it("el orden de enum y anyOf no depende de qué tipos se resolvieron antes (id interno de TypeScript)", () => {
        const generar = (previo: string): string => {
            const programa = crearProgramaVirtual({[`${RAIZ}/main.ts`]: `type Previo = ${previo};\ninterface Raiz {campo: "zeta" | "alfa"; mixto: "zeta" | "alfa" | 2 | 1 | boolean | Date}\n`});
            const typeChecker = programa.getTypeChecker();
            const [anterior, raiz] = programa.getSourceFile(`${RAIZ}/main.ts`)!.statements as unknown as (ts.TypeAliasDeclaration | ts.InterfaceDeclaration)[];
            typeChecker.getTypeAtLocation(anterior.name);
            const generador = new GeneradorEsquemas(typeChecker, RAIZ, []);
            generador.esquemaDe(typeChecker.getDeclaredTypeOfSymbol(typeChecker.getSymbolAtLocation(raiz.name)!), raiz);

            return hashDocumento(generador.componentes);
        };

        assert.equal(generar("string"), generar('"alfa"'));
        assert.equal(generar('"alfa"'), generar('"zeta" | 1'));
    });

    it("literal único es const; unión de literales del mismo tipo es enum", () => {
        assert.deepEqual(campoDe(`"a"`).campo, {type: "string", const: "a"});
        assert.deepEqual(campoDe(`"a" | "b"`).campo, {type: "string", enum: ["a", "b"]});
        assert.deepEqual(campoDe(`1 | 2 | 3`).campo, {type: "number", enum: [1, 2, 3]});
        assert.deepEqual(campoDe(`true`).campo, {type: "boolean", const: true});
    });

    it("literales de tipos distintos y otros tipos son anyOf", () => {
        assert.deepEqual(campoDe(`"a" | 1`).campo, {anyOf: [{type: "string", const: "a"}, {type: "number", const: 1}]});
        assert.deepEqual(campoDe(`"a" | "b" | number`).campo, {anyOf: [{type: "string", enum: ["a", "b"]}, {type: "number"}]});
    });

    it("enum y const enum son componentes con $ref", () => {
        const r = campoDe("Color", `enum Color {Rojo = "rojo", Azul = "azul"}`);
        assert.deepEqual(r.campo, {$ref: "#/components/schemas/Color"});
        assert.deepEqual(r.componentes["Color"], {type: "string", enum: ["azul", "rojo"]});

        const c = campoDe("Nivel", `const enum Nivel {Bajo = 1, Alto = 2}`);
        assert.deepEqual(c.componentes["Nivel"], {type: "number", enum: [1, 2]});
    });

    it("un miembro suelto de un enum es const", () => {
        const r = campoDe("Color.Rojo", `enum Color {Rojo = "rojo", Azul = "azul"}`);
        assert.deepEqual(r.campo, {type: "string", const: "rojo"});
    });

    it("T|null añade null al type; con $ref o varias alternativas, un anyOf", () => {
        assert.deepEqual(campoDe("string | null").campo, {type: ["string", "null"]});
        assert.deepEqual(campoDe(`"a" | "b" | null`).campo, {type: ["string", "null"], enum: ["a", "b", null]});
        assert.deepEqual(campoDe(`"a" | null`).campo, {type: ["string", "null"], enum: ["a", null]});
        assert.deepEqual(campoDe("IFoo | null", "interface IFoo {x: number}").campo, {anyOf: [{$ref: "#/components/schemas/IFoo"}, {type: "null"}]});
        assert.deepEqual(campoDe("string | number | null").campo, {anyOf: [{type: "number"}, {type: "string"}, {type: "null"}]});
        assert.deepEqual(campoDe("null").campo, {type: "null"});
    });
});

describe("esquema: estructuras", () => {
    it("arrays y tuplas", () => {
        assert.deepEqual(campoDe("string[]").campo, {type: "array", items: {type: "string"}});
        assert.deepEqual(campoDe("readonly number[]").campo, {type: "array", items: {type: "number"}});
        assert.deepEqual(campoDe("[string, number]").campo, {type: "array", prefixItems: [{type: "string"}, {type: "number"}]});
    });

    it("objetos anónimos anidados, con sus obligatorios", () => {
        assert.deepEqual(campoDe("{id?: string; user: {name: string; edad?: number}}").campo, {
            type: "object",
            properties: {id: {type: "string"}, user: {type: "object", properties: {name: {type: "string"}, edad: {type: "number"}}, required: ["name"]}},
            required: ["user"],
        });
    });

    it("Record<string, T> e índices son additionalProperties; Record sobre literales son propiedades", () => {
        assert.deepEqual(campoDe("Record<string, number>").campo, {type: "object", additionalProperties: {type: "number"}});
        assert.deepEqual(campoDe("{[k: string]: boolean}").campo, {type: "object", additionalProperties: {type: "boolean"}});
        assert.deepEqual(campoDe(`Record<"a" | "b", string>`).campo, {type: "object", properties: {a: {type: "string"}, b: {type: "string"}}, required: ["a", "b"]});
        assert.deepEqual(campoDe("Record<number, string>").campo, {type: "object", additionalProperties: {type: "string"}});
    });

    it("Partial, Pick y los genéricos instanciados van en línea (sin componente propio)", () => {
        const base = "interface IFoo {a: string; b: number}\ninterface ICaja<T> {valor: T}";
        const parcial = campoDe("Partial<IFoo>", base);
        assert.deepEqual(parcial.campo, {type: "object", properties: {a: {type: "string"}, b: {type: "number"}}});
        assert.deepEqual(campoDe("Pick<IFoo, 'a'>", base).campo, {type: "object", properties: {a: {type: "string"}}, required: ["a"]});
        const caja = campoDe("ICaja<string>", base);
        assert.deepEqual(caja.campo, {type: "object", properties: {valor: {type: "string"}}, required: ["valor"]});
        assert.deepEqual(Object.keys(caja.componentes), ["Raiz"]);
    });

    it("una intersección de objetos se aplana; un primitivo con marca es el primitivo", () => {
        const base = "interface IA {a: string}\ninterface IB {b: number}";
        assert.deepEqual(campoDe("IA & IB", base).campo, {type: "object", properties: {a: {type: "string"}, b: {type: "number"}}, required: ["a", "b"]});
        assert.deepEqual(campoDe("string & {readonly __marca: true}").campo, {type: "string"});
    });

    it("Date es date-time y un toJSON(): R se documenta como R", () => {
        assert.deepEqual(campoDe("Date").campo, {type: "string", format: "date-time"});
        assert.deepEqual(campoDe("IMoneda", "interface IMoneda {toJSON(): string; cantidad: number}").campo, {type: "string"});
        assert.deepEqual(campoDe("Date | undefined").campo, {type: "string", format: "date-time"});
    });

    it("una interfaz recursiva termina por $ref", () => {
        const r = esquemaDeTipo("interface T {nombre: string; hijos: T[]; padre?: T}");
        assert.deepEqual(r.esquema, {$ref: "#/components/schemas/T"});
        assert.deepEqual(r.componentes["T"], {
            type: "object",
            properties: {nombre: {type: "string"}, hijos: {type: "array", items: {$ref: "#/components/schemas/T"}}, padre: {$ref: "#/components/schemas/T"}},
            required: ["nombre", "hijos"],
        });
        assert.deepEqual(r.avisos, []);
    });

    it("un alias de objeto recursivo también", () => {
        const r = esquemaDeTipo("type T = {hijos: T[]}");
        assert.deepEqual(r.componentes["T"], {type: "object", properties: {hijos: {type: "array", items: {$ref: "#/components/schemas/T"}}}, required: ["hijos"]});
    });

    it("reentrar en un componente con nombre a través de un array no es una recursión sin nombre", () => {
        const r = esquemaDeTipo("interface IMenu {sub?: IMenu[]}\ninterface T {menu: IMenu[]}");
        assert.deepEqual(r.componentes["IMenu"], {type: "object", properties: {sub: {type: "array", items: {$ref: "#/components/schemas/IMenu"}}}});
        assert.deepEqual(r.componentes["T"], {type: "object", properties: {menu: {type: "array", items: {$ref: "#/components/schemas/IMenu"}}}, required: ["menu"]});
        assert.deepEqual(r.avisos, []);
    });

    it("las funciones y métodos no son propiedades", () => {
        const r = campoDe("{a: string; f: () => void; m(): number; g?: (x: string) => string}");
        assert.deepEqual(r.campo, {type: "object", properties: {a: {type: "string"}}, required: ["a"]});
        assert.deepEqual(r.avisos, []);
    });
});

describe("esquema: nombres de componente", () => {
    it("dos tipos con el mismo nombre en ficheros distintos se desambiguan por la ruta, de forma estable", () => {
        const extra = {
            "/v/uno/config.ts": "export interface IConfig {a: string}",
            "/v/dos/config.ts": "export interface IConfig {b: number}",
        };
        const codigo = `import type {IConfig as A} from "./uno/config";\nimport type {IConfig as B} from "./dos/config";\ninterface T {a: A; b: B}`;
        const r = esquemaDeTipo(codigo, extra);
        assert.deepEqual(Object.keys(r.componentes), ["IConfig", "IConfig_dos_config", "T"]);
        assert.deepEqual(r.componentes["T"].properties, {a: {$ref: "#/components/schemas/IConfig"}, b: {$ref: "#/components/schemas/IConfig_dos_config"}});
        assert.deepEqual(r.componentes["IConfig"].properties, {a: {type: "string"}});
        assert.deepEqual(r.componentes["IConfig_dos_config"].properties, {b: {type: "number"}});
        assert.deepEqual(esquemaDeTipo(codigo, extra).componentes, r.componentes);
    });

    it("las claves de components salen ordenadas", () => {
        const r = esquemaDeTipo("interface Z {x: string}\ninterface A {y: string}\ninterface T {z: Z; a: A}");
        assert.deepEqual(Object.keys(r.componentes), ["A", "T", "Z"]);
    });
});

describe("esquema: JSDoc", () => {
    it("el comentario del tipo es la description del componente y @property la de cada propiedad", () => {
        const r = esquemaDeTipo(`
/**
 * Datos del usuario.
 *
 * @property nombre - Nombre completo.
 * @property edad   - Edad en años,
 *   contada desde el nacimiento.
 */
interface T {
    nombre: string;
    edad?: number;
    /** Comentario propio. */
    otro: string;
}`);
        assert.equal(r.componentes["T"].description, "Datos del usuario.");
        assert.equal(r.componentes["T"].properties!["nombre"].description, "Nombre completo.");
        assert.equal(r.componentes["T"].properties!["edad"].description, "Edad en años, contada desde el nacimiento.");
        assert.equal(r.componentes["T"].properties!["otro"].description, "Comentario propio.");
    });

    it("la cabecera de autoría del fichero no es la description de su primera declaración", () => {
        const cabecera = "/**\n * Editor: Juan C. Martínez\n * Fecha: Wed, 11 Nov 2026 10:30:11 GMT\n * Hash: 2becf4e5bf18927da2b74c7203493a80\n * Versión: 2026.11.11+1-juancmartinez\n * Proyecto: git@github.com:alpred/meteored-svc-panel-usuarios.git\n */\n\n";
        const sinJSDoc = esquemaDeTipo(`${cabecera}enum TPrecio {A = 1, B = 2}\ninterface T {precio: TPrecio}`);
        assert.equal(sinJSDoc.componentes["TPrecio"].description, undefined);

        const conJSDoc = esquemaDeTipo(`${cabecera}/** Tipo de precio. */\nenum TPrecio {A = 1, B = 2}\ninterface T {precio: TPrecio}`);
        assert.equal(conJSDoc.componentes["TPrecio"].description, "Tipo de precio.");
    });

    it("@property en un alias de literal de tipo, y junto a un $ref", () => {
        const r = esquemaDeTipo(`
interface IFoo {x: number}
/**
 * Alias.
 *
 * @property foo - El foo.
 * @property dentro - Anidado.
 */
type T = {foo: IFoo; dentro: {a: string}}`);
        assert.deepEqual(r.componentes["T"].properties!["foo"], {$ref: "#/components/schemas/IFoo", description: "El foo."});
        assert.equal(r.componentes["T"].properties!["dentro"].description, "Anidado.");
        assert.equal(r.componentes["IFoo"].description, undefined);
    });

    it("@deprecated del tipo y de la propiedad", () => {
        const r = esquemaDeTipo(`
/** @deprecated */
interface T {
    /** @deprecated Usa otro. */
    viejo: string;
    nuevo: string;
}`);
        assert.equal(r.componentes["T"].deprecated, true);
        assert.equal(r.componentes["T"].properties!["viejo"].deprecated, true);
        assert.equal(r.componentes["T"].properties!["nuevo"].deprecated, undefined);
    });

    it("las propiedades heredadas conservan la descripción de su interfaz", () => {
        const r = esquemaDeTipo(`
/** @property base - De la base. */
interface IBase {base: string}
/** @property propia - Propia. */
interface T extends IBase {propia: string}`);
        assert.equal(r.componentes["T"].properties!["base"].description, "De la base.");
        assert.equal(r.componentes["T"].properties!["propia"].description, "Propia.");
    });
});

describe("esquema: no representables", () => {
    it("bigint, Buffer, Uint8Array, Promise y clases con getters se documentan como {} con aviso", () => {
        const base = "declare class Buffer {length: number}\nclass ConGetter {get x(): number {return 1;}}";
        for (const tipo of ["bigint", "Buffer", "Uint8Array", "Promise<string>", "ConGetter"]) {
            const r = campoDe(tipo, base);
            assert.deepEqual(r.campo, {}, tipo);
            assert.equal(r.avisos.length, 1, tipo);
            assert.equal(r.avisos[0].severidad, "aviso", tipo);
            assert.match(r.avisos[0].mensaje, /en «campo»/, tipo);
        }
    });

    it("un parámetro de tipo sin instanciar se documenta como {} con aviso", () => {
        const r = esquemaDeTipo("interface T<U> {valor: U; otro: string}");
        assert.deepEqual(r.esquema, {type: "object", properties: {valor: {}, otro: {type: "string"}}, required: ["valor", "otro"]});
        assert.equal(r.avisos.length, 1);
        assert.match(r.avisos[0].mensaje, /sin instanciar en «valor»/);
    });

    it("más de 32 niveles de anidamiento se cortan con aviso", () => {
        let tipo = "string";
        for (let i = 0; i < 40; i++) {
            tipo = `{n: ${tipo}}`;
        }
        const r = campoDe(tipo);
        assert.ok(r.avisos.some(a => /demasiado anidado/.test(a.mensaje)));
    });
});

describe("esquema: interfaces reales de restore", () => {
    const fuente = readFileSync(path.resolve(__dirname, "../../../../spec/auto-doc/fixtures/restore-interface.ts.txt"), "utf8");

    it("IRestoreRegisterIN y sus dependencias salen completas, sin avisos", () => {
        const r = esquemaDeTipo(`${fuente}\ntype T = IRestoreRegisterIN;`);
        assert.deepEqual(r.avisos, []);
        assert.deepEqual(r.esquema, {$ref: "#/components/schemas/IRestoreRegisterIN"});
        assert.deepEqual(Object.keys(r.componentes), ["IRestoreRegisterIN", "IRestoreRegistrationResponseJSON"]);
        assert.deepEqual(r.componentes["IRestoreRegisterIN"], {
            type: "object",
            properties: {credential: {$ref: "#/components/schemas/IRestoreRegistrationResponseJSON", description: "Respuesta de `createCredential`."}},
            required: ["credential"],
            description: "`POST /app/user/restore/register` (ID token de Firebase en `Authorization`).",
        });

        const registro = r.componentes["IRestoreRegistrationResponseJSON"];
        assert.equal(registro.description, "Respuesta de la creación de la credencial (`RegistrationResponseJSON`).");
        assert.deepEqual(registro.required, ["id", "rawId", "type", "response", "clientExtensionResults"]);
        assert.deepEqual(registro.properties!["type"], {type: "string", const: "public-key", description: "Siempre `public-key`."});
        assert.deepEqual(registro.properties!["authenticatorAttachment"], {type: "string", enum: ["cross-platform", "platform"], description: "Tipo de autenticador que la creó."});
        assert.deepEqual(registro.properties!["response"], {
            type: "object",
            properties: {
                clientDataJSON: {type: "string"},
                attestationObject: {type: "string"},
                authenticatorData: {type: "string"},
                transports: {type: "array", items: {type: "string"}},
                publicKeyAlgorithm: {type: "number"},
                publicKey: {type: "string"},
            },
            required: ["clientDataJSON", "attestationObject"],
            description: "Objeto de atestación y datos del cliente.",
        });
    });

    it("IRestoreOptionsOUT: uniones de literales opcionales y descriptores referenciados", () => {
        const r = esquemaDeTipo(`${fuente}\ntype T = IRestoreOptionsOUT;`);
        assert.deepEqual(r.avisos, []);
        const opciones = r.componentes["IRestoreCreationOptionsJSON"];
        assert.deepEqual(opciones.properties!["attestation"], {type: "string", enum: ["direct", "enterprise", "indirect", "none"], description: "Tipo de atestación pedida (siempre `none`)."});
        assert.deepEqual(opciones.properties!["excludeCredentials"], {type: "array", items: {$ref: "#/components/schemas/IRestoreCredentialDescriptorJSON"}, description: "Credenciales que no se deben volver a registrar."});
        assert.deepEqual(opciones.properties!["pubKeyCredParams"], {type: "array", items: {type: "object", properties: {type: {type: "string", const: "public-key"}, alg: {type: "number"}}, required: ["type", "alg"]}, description: "Algoritmos COSE aceptados."});
        assert.deepEqual(opciones.required, ["rp", "user", "challenge", "pubKeyCredParams"]);
    });

    it("el alias TRestoreBase64URL (= string) va en línea como string", () => {
        const r = esquemaDeTipo(`${fuente}\ntype T = IRestoreRegisterOUT;`);
        assert.deepEqual(r.componentes["IRestoreRegisterOUT"].properties, {id: {type: "string", description: "Id de la credencial guardada."}});
    });
});
