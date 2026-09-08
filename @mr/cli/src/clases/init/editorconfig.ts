/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: 94887b7cd9c87cf7dac558f83bdd9b32
 * Versión: 2026.9.7+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

export default `
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
insert_final_newline = true
trim_trailing_whitespace = true

[*.{json,pug,sh,sql,yml}]
indent_size = 2

[*.json]
insert_final_newline = false

[mrpack.json]
indent_size = 4

[*.pug]
trim_trailing_whitespace = false

[*.{php,ts,js}]
indent_size = 4
`.trimStart();
