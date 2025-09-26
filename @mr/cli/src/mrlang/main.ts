import "services-comun/modules/types";
import sourceMapSupport from "source-map-support";
sourceMapSupport.install();

import {MRLang} from "./mrlang";

process.chdir(`../..`);

MRLang.run();
