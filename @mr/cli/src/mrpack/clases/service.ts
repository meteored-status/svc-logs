import type {IPackageJson as IPackageJsonBase} from "./packagejson";
import type {IConfigService} from "./workspace/service";

export interface IPackageJsonAddress {
    email?: string;
    url?: string;
}

export interface IPackageJsonPerson extends IPackageJsonAddress {
    name: string;
}

export interface IPackageJson extends IPackageJsonBase {
    config: IConfigService;
}
