/**
 * Editor: José Antonio Jiménez
 * Fecha: Fri, 15 May 2026 12:09:04 GMT
 * Hash: 94887b7cd9c87cf7dac558f83bdd9b32
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
