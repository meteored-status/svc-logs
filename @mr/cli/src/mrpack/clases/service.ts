export interface IPackageJsonAddress {
    email?: string;
    url?: string;
}

export interface IPackageJsonPerson extends IPackageJsonAddress {
    name: string;
}
