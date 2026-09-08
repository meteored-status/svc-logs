/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: 5786261d0513d3df34035202bf383a3d
 * Versión: 2026.9.7+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

// export type IPackageJsonDependencyTypes = 'dependencies' | 'devDependencies' | 'peerDependencies' | 'optionalDependencies';

export interface IPackageJsonAddress {
    email?: string;
    url?: string;
}

export interface IPackageJsonPerson extends IPackageJsonAddress {
    name: string;
}

export interface IPackageJson {
    name: string;
    version?: string;
    description?: string;
    keywords?: string;
    homepage?: string;
    bugs?: IPackageJsonAddress;
    license?: string;
    author?: string | IPackageJsonPerson;
    contributors?: string[] | IPackageJsonPerson[];
    files?: string[];
    main?: string;
    browser?: string;
    bin?: Record<string, string>;
    man?: string;
    directories?: {
        lib?: string;
        bin?: string;
        man?: string;
        doc?: string;
        example?: string;
        test?: string;
    };
    repository?: {
        type?: 'git';
        url?: string;
        directory?: string;
    };
    scripts?: Record<string, string>;
    // config?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
    bundledDependencies?: string[];
    engines?: Record<string, string>;
    os?: string[];
    cpu?: string[];
    resolutions?: Record<string, string>;
    workspaces?: string[];
    hash?: string;
}

export interface IPackageJsonLegacy extends IPackageJson {
    servicio?: string | string[];
}
