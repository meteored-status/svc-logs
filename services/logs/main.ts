import {Main} from "services-comun/cluster";

import {Configuracion} from "./modules/utiles/config";
import {Engine} from "./modules/engine";

Main.ejecutar(Engine, Configuracion);
