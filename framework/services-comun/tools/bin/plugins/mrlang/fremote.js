"use strict";exports.id=851,exports.ids=[851],exports.modules={21:(a,e,s)=>{s.d(e,{FixRemote:()=>c});var i=s(386),r=s(203),o=s(174),t=s(189);class c{static async run(a,e){if(!await(0,i.fo)(`${a}/i18n/.credenciales/mysql.json`))return Promise.reject("No hay credenciales en /i18n/.credenciales/ para corregir las traducciones remotas");const{config:s}=await(0,i.TQ)(`${a}/i18n/package.json`),c=await r.K.fromMySQL();null==e&&(e=await o.P.getIDS());const n=await Promise.all(e.map((a=>o.P.load(a,s,c))));await Promise.all(n.map((a=>a.refreshHash()))),await Promise.all(n.map((a=>a.fixVersion()))),await t.A.close()}}}};
//# sourceMappingURL=fremote.js.map