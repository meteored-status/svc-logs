process.env.CLIENTE ??= "";
process.env.ENTORNO ??= "desarrollo";
process.env.ZONA ??= "desarrollo";

Symbol.dispose ??= Symbol("Symbol.dispose");
Symbol.asyncDispose ??= Symbol("Symbol.asyncDispose");

require("./init");
require("source-map-support").install();
require("./output/app");
