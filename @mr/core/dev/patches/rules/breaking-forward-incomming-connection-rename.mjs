import {createLineRegexRule} from "../rule-factory.mjs";

const TYPO_CALL_RE = /\.forwardIncommingConnection(\s*)\(/g;

export const breakingForwardIncommingConnectionRenameRule = createLineRegexRule({
    id: "R014-breaking-forward-incomming-connection-rename",
    summary: "forwardIncommingConnection -> forwardIncomingConnection",
    detect: ".forwardIncommingConnection",
    regex: TYPO_CALL_RE,
    replacement: ".forwardIncomingConnection$1(",
    skipFilePathIncludes: ["/@mr/core/dev/patches/"],
});




