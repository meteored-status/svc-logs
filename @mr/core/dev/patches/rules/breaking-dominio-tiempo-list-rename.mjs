import {createSpecifierRenameRule} from "../rule-factory.mjs";

export const breakingDominioTiempoListRenameRule = createSpecifierRenameRule({
    id: "R033-breaking-dominio-tiempo-list-rename",
    summary: "DominioTiempoList -> DominioList as DominioTiempoList en imports de @mr/user-tiempo-domain/loader",
    module: "@mr/user-tiempo-domain/loader",
    detect: "DominioTiempoList",
    regex: /(?<! as )\bDominioTiempoList\b/g,
    replacement: "DominioList as DominioTiempoList",
});
