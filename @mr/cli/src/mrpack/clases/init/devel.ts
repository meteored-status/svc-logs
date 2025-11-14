export default `
process.env.TZ ??= 'UTC';
require("./app");
`.trimStart();
