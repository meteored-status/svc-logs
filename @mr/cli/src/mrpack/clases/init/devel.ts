export default `
// require("source-map-support").install();
process.env.TZ ??= 'UTC';
require("./app");
`.trimStart();
