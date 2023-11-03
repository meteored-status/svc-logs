export interface IUsuarioResponse {
    id?: number;
    uid: string;
    name: string;
    email: string;
    enabled: boolean;
    registered: string;
    last_access?: string;
    lang?: string;
    timezone?: string;
    avatar?: string;
}

export interface IUsuario {
    id?: number;
    uid: string;
    name: string;
    email: string;
    enabled: boolean;
    registered: Date;
    last_access?: Date;
    lang?: string;
    timezone?: string;
    avatar?: string;
}

export class Usuario implements IUsuario {
    /* STATIC */
    /**
     * Convierte un registro de Usuario de la Base de Datos a un objeto.
     * @param user Registro de base de datos.
     * @private
     */
    public static build(user: IUsuarioResponse): Usuario {
        return new this({
            id: user.id,
            uid: user.uid,
            name: user.name,
            email: user.email,
            enabled: user.enabled,
            registered: new Date(user.registered),
            last_access: user.last_access ? new Date(user.last_access) : undefined,
            avatar: user.avatar,
        });
    }

    /* INSTANCE */
    public constructor(protected readonly data: IUsuario) {
    }

    public get id(): number|undefined {
        return this.data.id;
    }

    public get uid(): string {
        return this.data.uid;
    }

    public get name(): string {
        return this.data.name;
    }

    public get email(): string {
        return this.data.email;
    }

    public get enabled(): boolean {
        return this.data.enabled;
    }

    public get registered(): Date {
        return this.data.registered;
    }

    public get last_access(): Date|undefined {
        return this.data.last_access;
    }

    public get lang(): string|undefined {
        return this.data.lang;
    }

    public get timezone(): string|undefined {
        return this.data.timezone;
    }

    public get avatar(): string|undefined {
        return this.data.avatar;
    }

    public toJSON(): IUsuario {
        return this.data;
    }
}
