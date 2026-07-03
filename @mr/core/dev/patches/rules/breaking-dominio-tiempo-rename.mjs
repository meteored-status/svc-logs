import {createSpecifierRenameRule} from "../rule-factory.mjs";

export const breakingDominioTiempoRenameRule = createSpecifierRenameRule({
    id: "R031-breaking-dominio-tiempo-rename",
    summary: "DominioTiempo -> Dominio as DominioTiempo en imports de @mr/user-tiempo-domain",
    module: "@mr/user-tiempo-domain",
    detect: "DominioTiempo",
    regex: /(?<! as )\bDominioTiempo\b/g,
    replacement: "Dominio as DominioTiempo",
});
