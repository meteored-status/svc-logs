import emitter from "node:events";

import {Main} from "services-comun/main";

import {Configuracion} from "./modules/utiles/config";
import {Engine} from "./modules/engine";

emitter.setMaxListeners(1024);

Main.ejecutar(Engine, Configuracion);
