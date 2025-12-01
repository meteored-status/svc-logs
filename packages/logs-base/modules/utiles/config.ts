import {IGoogle} from "services-comun/modules/utiles/config";

const GOOGLE: IGoogle = {
    id: "meteored-status",
    storage: {
        credenciales: "files/credenciales/storage.json",
        buckets: {},
    },
};

export {GOOGLE};
