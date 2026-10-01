/**
 * Editor: Bixus
 * Fecha: Fri, 11 Sep 2026 09:36:01 GMT
 * Hash: 53929ff5fc9cbcfc5087b78c3734fa19
 * Versión: 2026.9.11+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Rango de un miembro dentro de un grupo. Son excluyentes: la columna `user_group_member.member_level`
 * guarda uno de estos tres valores.
 *
 * - `MEMBER` — pertenece al grupo y recibe lo que el grupo conceda a su rango. No administra nada.
 * - `ADMIN`  — además gestiona los miembros del grupo y puede renombrarlo.
 * - `OWNER`  — además puede borrarlo y nombrar a otros propietarios.
 *
 * **El valor numérico ES el orden, y de ahí cuelga todo lo demás**: lo que un miembro recibe se resuelve
 * comparando su rango con el `min_level` de cada permiso del grupo, así que los tres están anidados —lo
 * concedido a `MEMBER` lo reciben también los administradores y los propietarios—. Esa comparación es lo
 * que hace seguro el camino delegado: un administrador **siempre** tiene todo lo que el grupo concede a
 * un rango igual o inferior al suyo, así que al dar de alta o ascender a alguien por debajo de sí mismo
 * no puede estar repartiendo nada que él no tenga. La garantía sale de la estructura y no de una
 * comprobación que alguien tenga que acordarse de escribir.
 *
 * **Van espaciados de diez en diez a propósito.** No es decoración: el valor se persiste en
 * `user_group_permission.min_level`, así que meter un cuarto rango intermedio con numeración contigua
 * obligaría a renumerar las dos tablas a la vez —y una renumeración a medias reparte permisos de más—.
 * Con hueco es un valor nuevo y nada más.
 */
export enum EGroupLevel {
    MEMBER = 10,
    ADMIN  = 20,
    OWNER  = 30,
}

const GroupLevelNames: Map<EGroupLevel, string> = new Map<EGroupLevel, string>([
    [EGroupLevel.MEMBER, 'Usuario'],
    [EGroupLevel.ADMIN, 'Administrador'],
    [EGroupLevel.OWNER, 'Propietario'],
]);

export function getGroupLevelName(level: EGroupLevel): string {
    return GroupLevelNames.get(level) || '';
}

/**
 * Comprueba que un valor llegado de fuera (body de una petición, fila de base de datos) es uno de los
 * rangos conocidos, para no guardar un número cualquiera en `member_level` ni en `min_level`.
 *
 * Rechaza en particular los valores de los huecos (15, 25): están reservados para un rango futuro y hoy
 * no significan nada, así que guardarlos dejaría filas que el día que ese rango exista cambiarían de
 * sentido solas.
 */
export function isGroupLevel(level: unknown): level is EGroupLevel {
    return GroupLevelNames.has(level as EGroupLevel);
}

/**
 * Los tres rangos de menor a mayor, para poder ofrecerlos en un desplegable sin escribirlos a mano y sin
 * depender del orden de declaración del enum.
 */
export const GROUP_LEVELS: EGroupLevel[] = [EGroupLevel.MEMBER, EGroupLevel.ADMIN, EGroupLevel.OWNER];

/**
 * Si un miembro de rango `level` recibe un permiso que el grupo concede desde `minLevel`.
 *
 * Es la regla que resuelve los permisos efectivos, y su equivalente en SQL es el `ON` de la consulta de
 * `permissionFactory.selectByUserGroups()`: las dos tienen que decir lo mismo, así que si se cambia una
 * hay que cambiar la otra.
 */
export function recibeDelGrupo(minLevel: EGroupLevel, level: EGroupLevel): boolean {
    return level >= minLevel;
}

/**
 * Si quien administra el grupo con rango `actor` puede **asignar** el rango `nuevo`.
 *
 * Nadie reparte por encima de sí mismo: un administrador nombra usuarios y administradores, y a
 * propietario solo asciende un propietario. Sin esto, el anidamiento de los rangos dejaría de garantizar
 * que quien reparte tiene lo que reparte, que es la premisa de todo el camino delegado.
 */
export function puedeAsignarNivel(actor: EGroupLevel, nuevo: EGroupLevel): boolean {
    return nuevo <= actor;
}

/**
 * Si quien administra el grupo con rango `actor` puede **tocar** a un miembro que hoy tiene `objetivo`
 * (cambiarle el rango o sacarlo del grupo).
 *
 * Solo se toca a quien está por debajo, con una excepción: un propietario puede tocar a otro propietario.
 * Sin la excepción, dos propietarios enfrentados no tendrían salida dentro del grupo —es el rango máximo,
 * así que nadie estaría por encima de ninguno—, y `quedanPropietarios()` ya impide que eso lo deje vacío.
 *
 * **De aquí sale gratis que nadie se ascienda a sí mismo**, que por eso no es una regla aparte: al
 * modificarte, el rango de partida del objetivo es el tuyo, y «estrictamente inferior» ya lo rechaza. La
 * contrapartida es que un administrador tampoco puede salirse del grupo por su cuenta; abandonar un grupo
 * no está en esta versión, y cuando esté será un caso propio y no una relajación de esta regla.
 */
export function puedeModificarMiembro(actor: EGroupLevel, objetivo: EGroupLevel): boolean {
    return actor === EGroupLevel.OWNER || objetivo < actor;
}

/**
 * Si la lista de rangos resultante deja al grupo con algún propietario.
 *
 * Se comprueba sobre el resultado y no sobre lo que se quita, porque el guardado manda la lista de
 * miembros **completa** y sustituye: lo único que dice si el grupo se queda huérfano es cómo queda.
 *
 * No lo puede expresar la base de datos sin un trigger, y un trigger que rechaza un `DELETE` es un fallo
 * sin mensaje para quien está usando el panel.
 */
export function quedanPropietarios(niveles: EGroupLevel[]): boolean {
    return niveles.includes(EGroupLevel.OWNER);
}

/**
 * Permisos que un grupo **no puede repartir nunca**, tenga quien lo reparte lo que tenga.
 *
 * Un grupo concede **roles**, no permisos sueltos (`ddl-alter-0044.sql`), así que esta lista no se
 * compara contra lo que pide el grupo sino contra los permisos **efectivos del rol** que se quiere
 * conceder, herencia incluida — es lo que hace `rolDelegable()`. Y ahí importa más que antes: un rol
 * esconde su contenido detrás de un nombre, así que «conceder el rol Coordinación» puede estar
 * repartiendo `status.admin` sin que se vea en la pantalla del grupo.
 *
 * Son los que reparten autoridad, y concederlos desde un grupo convertiría la pertenencia en
 * administración del panel: `status.admin` abre lo que se exija con él, `status.group.role.edit`
 * permite ampliar lo que reparte el propio grupo, la suplantación deja operar como otra cuenta, y los dos de usuarios y
 * roles gobiernan quién puede qué.
 *
 * **Cuidado con el motivo de que los dos últimos sigan aquí, porque ya no es el que era.** Desde el
 * 2026-09-11 los roles comprueban subconjunto por los tres caminos que reparten autoridad, y las reglas
 * están todas en `rol/rules.ts` pero repartidas por **cuatro** puntos de llamada, que es lo que hay que
 * mirar si algún día se audita esto:
 *
 * - editar los permisos de un rol — `SaveRolFlow`, `comprobarPermisosConcedibles()`;
 * - colgarlo de un padre, que le concede todo lo del padre de golpe — `SaveRolFlow`,
 *   `comprobarHerenciaConcedible()`;
 * - asignarlo a alguien, y esto tiene **dos puertas**: la ficha del usuario (`SaveUserFlow`,
 *   `comprobarRolesAsignables()`) y la lista `users` del propio diálogo del rol (`SaveRolFlow`,
 *   `comprobarRolRepartible()`). Quien dé por buena solo la primera se deja la mitad, que es exactamente
 *   el fallo que tuvo este repo la mañana en que se escribió todo esto.
 *
 * O sea que la escalada directa —concederte permisos que no tienes— ya está cerrada ahí, y no es lo que
 * justifica el veto. Lo que lo justifica es lo que **no** cubren esas comprobaciones:
 *
 * - **Quitar no se comprueba.** `status.rol.edit` sigue pudiendo vaciar de permisos cualquier rol y
 *   borrarlo, y eso no es escalada sino sabotaje: se puede cerrar el panel a todo el mundo. Está
 *   deliberadamente sin restringir —contra eso lo que hay es la auditoría—, y precisamente por eso un
 *   grupo, al que se entra por pertenencia y que reparte a todos sus miembros de golpe, es un mal
 *   vehículo para entregarlo.
 * - **La llave maestra.** Esas comprobaciones las salta quien tenga `status.admin`, así que viven al
 *   mismo nivel que el permiso que protegen; el veto de aquí es estructural y no depende de ellas.
 * - **`status.user.edit` abre además el panel**: activa una cuenta pendiente y levanta un veto, que es
 *   dar acceso sin tocar ningún permiso.
 *
 * **`status.user.edit` es además lo que cierra el salto de un grupo a otro, y conviene saberlo antes de
 * tocarlo.** Cambiar los miembros de un grupo cualquiera por la vía global exige `status.group.edit` **y**
 * `status.user.edit` (ver `handlers/group.ts`); si un grupo pudiera conceder el segundo, bastaría con
 * pertenecer a un grupo para meterse en otro y llevarse lo que ese otro conceda. Al no ser delegable, esa
 * combinación solo se consigue desde un rol, que es donde se reparte a mano. La vía delegada no hace falta
 * cerrarla así: está acotada al grupo que uno administra y al anidamiento de los rangos.
 *
 * **Es una lista negra, con lo que eso implica**: un permiso nuevo que reparta autoridad no está vetado
 * hasta que alguien lo añada aquí. No hay forma de deducirlo del propio permiso —nada en la fila de
 * `permission` dice «este concede autoridad»—, así que la alternativa era una lista blanca de lo
 * delegable, que se queda corta al revés: cada permiso nuevo dejaría de poder concederse por un grupo
 * hasta que alguien se acordara, y eso se descubre como «el grupo no funciona» en vez de como un aviso.
 * Entre las dos, la que falla del lado de no repartir demasiado es esta, y la prueba de
 * `spec/manager/grupo-niveles.spec.ts` la fija para que sacar uno de la lista no pase desapercibido.
 *
 * Vive en el framework y no en el backend porque la usan los dos lados: el diálogo del panel no ofrece lo
 * que el backend va a rechazar, y así no hay dos versiones de la lista.
 */
export const PERMISOS_NO_DELEGABLES: string[] = [
    "status.admin",
    "status.rol.edit",
    "status.user.edit",
    "status.group.role.edit",
    "status.impersonate.view",
    "status.impersonate.full",
];

/**
 * Si un permiso se puede conceder desde un grupo.
 */
export function esDelegable(permission: string): boolean {
    return !PERMISOS_NO_DELEGABLES.includes(permission);
}

/**
 * Una arista de anidamiento: un grupo que es miembro de otro.
 *
 * @property group  - El grupo que recibe al otro como miembro.
 * @property member - El grupo que entra como miembro.
 * @property level  - Rango con el que entra. Lo reciben **todos** los miembros de `member`, sea cual sea
 *                    su rango dentro de él: la arista sustituye el rango propio, no lo limita.
 */
export interface IGroupEdge {
    group: number;
    member: number;
    level: EGroupLevel;
}

/**
 * Pertenencia **directa** de una persona a un grupo, tal como está en `user_group_member`.
 *
 * @property group - Grupo al que pertenece.
 * @property level - Rango con el que figura en él.
 */
export interface IGroupPertenencia {
    group: number;
    level: EGroupLevel;
}

/**
 * Sube el rango de un grupo en el mapa si el nuevo es mayor, o lo mete si no estaba.
 *
 * @returns Si el mapa ha cambiado, que es lo que gobierna el punto fijo de `gruposEfectivos()`.
 */
function subir(niveles: Map<number, EGroupLevel>, group: number, level: EGroupLevel): boolean {
    const actual = niveles.get(group);
    if (actual !== undefined && actual >= level) {
        return false;
    }
    niveles.set(group, level);

    return true;
}

/**
 * Los grupos a los que pertenece alguien **de verdad**, con el rango que tiene en cada uno: los suyos
 * directos más los que le llegan por anidamiento, a cualquier profundidad.
 *
 * Dos reglas, y las dos importan:
 *
 * - **La arista manda.** Pertenecer al grupo que entra basta para recibir el rango de la arista en el que
 *   lo recibe, sin importar el rango que se tenga dentro del que entra. Un miembro raso de
 *   «Administradores» es administrador de «Contabilidad» si la arista dice administrador.
 * - **El rango efectivo es el máximo de todos los caminos.** Quien llega a un grupo directamente como
 *   usuario y además por otro grupo como administrador, es administrador. Es coherente con que los
 *   permisos se sumen: ningún camino quita.
 *
 * **Se resuelve a punto fijo y no recorriendo el grafo**, y es a propósito: cada pasada o mete un grupo o
 * **sube** un rango, y las dos cosas están acotadas —hay tantos grupos como filas y solo tres rangos—, así
 * que termina siempre. Incluso con un ciclo: los rangos convergen y el bucle se para. Eso importa porque
 * los ciclos se rechazan al escribir (`haceCiclo()`), pero nada impide que alguien meta uno con un `INSERT`
 * a mano, y en ese caso esta función tiene que devolver algo razonable en vez de colgarse — es la que corre
 * en **cada** petición autenticada del panel.
 *
 * @param directos Pertenencias directas de la persona.
 * @param aristas  Todas las aristas de anidamiento del panel. Se pasan enteras y no consultadas una a una:
 *                 es un grafo mantenido a mano, se lee de una vez y el coste en consultas se queda fijo.
 * @returns Rango efectivo por grupo. Vacío si no pertenece a ninguno.
 */
export function gruposEfectivos(directos: IGroupPertenencia[], aristas: IGroupEdge[]): Map<number, EGroupLevel> {
    const niveles = new Map<number, EGroupLevel>();
    for (const {group, level} of directos) {
        subir(niveles, group, level);
    }

    let cambio = niveles.size > 0;
    while (cambio) {
        cambio = false;
        for (const arista of aristas) {
            // Pertenecer al grupo que entra es la condición, **con cualquier rango**: la arista sustituye el
            // rango propio. Por eso se pregunta por `has()` y no se compara nivel alguno.
            if (niveles.has(arista.member) && subir(niveles, arista.group, arista.level)) {
                cambio = true;
            }
        }
    }

    return niveles;
}

/**
 * Si un grupo es miembro de otro, directamente o por una cadena de aristas.
 *
 * @param aristas     Todas las aristas de anidamiento.
 * @param candidato   El grupo que podría estar dentro.
 * @param contenedor  El grupo que podría contenerlo.
 */
export function esMiembroTransitivo(aristas: IGroupEdge[], candidato: number, contenedor: number): boolean {
    // Se camina de contenedor hacia dentro —de un grupo a los que son miembros suyos— y el `Set` hace de
    // control de ciclos además de evitar repetir trabajo, igual que en `ancestros()` de `rol/rules.ts`. Sin
    // él, un ciclo ya existente en la base de datos colgaría esta función.
    const vistos = new Set<number>([contenedor]);
    const pendientes: number[] = [contenedor];

    while (pendientes.length > 0) {
        const actual = pendientes.pop()!;
        for (const arista of aristas) {
            if (arista.group === actual && !vistos.has(arista.member)) {
                if (arista.member === candidato) {
                    return true;
                }
                vistos.add(arista.member);
                pendientes.push(arista.member);
            }
        }
    }

    return false;
}

/**
 * Si meter `member` como miembro de `group` cerraría un ciclo.
 *
 * Un ciclo no rompe la resolución de permisos —`gruposEfectivos()` converge—, pero deja un grafo de
 * autoridad que no se puede explicar: cada grupo del ciclo concede lo de todos los demás, y «por qué esta
 * persona puede esto» deja de tener una respuesta corta. Así que se rechaza al escribir.
 *
 * El caso de longitud uno (un grupo dentro de sí mismo) se comprueba aquí **y** en el esquema, con el único
 * `CHECK` de las tablas de grupos: es el más fácil de colar con un `INSERT` a mano y el que menos se nota,
 * porque el grupo se concede a sí mismo lo que ya tenía.
 *
 * @param aristas Todas las aristas de anidamiento, **sin** la que se quiere meter.
 * @param group   Grupo que recibiría al otro.
 * @param member  Grupo que entraría.
 */
export function haceCiclo(aristas: IGroupEdge[], group: number, member: number): boolean {
    if (group === member) {
        return true;
    }

    // Si `group` ya está dentro de `member`, meter `member` dentro de `group` cierra el círculo.
    return esMiembroTransitivo(aristas, group, member);
}

/**
 * Si un grupo puede conceder un rol, mirando lo que ese rol concede de verdad.
 *
 * Se le pasan los permisos **efectivos** del rol —los suyos más los que le llegan por la cadena de padres,
 * que es lo que devuelve `Role.permissions()`— y no los propios: colgar un rol de un padre le concede todo
 * lo del padre sin que ninguno de esos permisos figure como suyo, así que mirar solo los propios dejaría
 * abierta exactamente la misma puerta que `comprobarHerenciaConcedible()` cierra en los roles.
 *
 * **La llave maestra la salta, igual que en los roles.** Quien tiene `status.admin` puede hacer que un grupo
 * conceda cualquier rol; quien solo tiene `status.group.role.edit`, no. Se hizo primero absoluta —ni con la
 * llave— con el argumento de que en un grupo el rol llega a todo el que pertenezca, y a quien pertenezca
 * mañana por un grupo anidado, sin que nadie lo decida uno a uno. El caso que la tumbó es el evidente: un
 * grupo «Administradores» que conceda el rol Administrador, que es justo para lo que sirve esto.
 *
 * **Y lo que hay que saber al usar la llave**: meter un rol de grado administrador en un grupo significa que
 * quien administre ese grupo puede fabricar administradores. No es una escalada —para administrar el grupo
 * hay que recibir sus roles, así que ya lo eres—, pero sí es poder dar acceso de administrador a gente nueva
 * **sin tener `status.user.edit`**, que es el permiso que lo gobierna por el camino normal.
 *
 * La llave entra como parámetro y no la resuelve esta función a propósito: así el framework no necesita
 * conocer el id del permiso maestro, que en el backend ya vive en `PERMISO_MAESTRO` (`flow/rol/concesion.ts`).
 * Dos constantes con el mismo valor en dos capas es lo que se separa con el tiempo.
 *
 * @param permisos Permisos efectivos del rol.
 * @param config   `maestro` a `true` si quien concede tiene la llave.
 */
export function rolDelegable(permisos: string[], {maestro = false}: IRolDelegableConfig = {}): boolean {
    return maestro || permisos.every(esDelegable);
}

/**
 * Lo opcional de `rolDelegable()`.
 *
 * @property maestro - Si quien concede tiene `status.admin`, que salta el veto.
 */
interface IRolDelegableConfig {
    maestro?: boolean;
}
