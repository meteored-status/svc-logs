import sourceMapSupport from "source-map-support";
sourceMapSupport.install();

import {MRPack} from "./mrpack";

process.chdir(`../..`);

MRPack.run();
