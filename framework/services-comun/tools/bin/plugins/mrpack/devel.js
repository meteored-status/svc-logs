"use strict";exports.id=778,exports.ids=[778],exports.modules={116:(e,i,a)=>{a.d(i,{Deploy:()=>l});var t=a(765),s=a(851),r=a(386),o=a(763);class n{basedir;name;packagejson;fecha;static async build(e,i,a){const t=`${e}/services/${i}`;return await(0,r.Q7)(t)&&await(0,r.fo)(`${t}/package.json`)?new this(e,i,await(0,r.TQ)(`${t}/package.json`),a):(console.error(i,"[ERROR]","Servicio no válido"),null)}static async md5Deps(e){const i=`${e}/.yarn/cache`;if(!await(0,r.Q7)(i))return;const a=`${i}/.md5`;await(0,r.fo)(a)&&await(0,r.y1)(a),await(0,r.TC)(a,`${await(0,r.Em)(i)}\n`,!0)}dependiente;config;dependencias;pendientes;dir;constructor(e,i,a,t){this.basedir=e,this.name=i,this.packagejson=a,this.fecha=t,this.config=a.config,this.dependencias=[],this.pendientes={},this.dir=`${e}/services/${i}`;for(const e of this.config.deps)this.pendientes[e]=null;this.dependiente=this.config.deps.length>0}async guardar(){await(0,r.TC)(`${this.dir}/package.json`,`${JSON.stringify(this.packagejson,null,2)}\n`,!0,!0)}checkDependencias(e){for(const i of e)i.config.deps.includes(this.name)&&this.dependencias.push(i)}async pack(e,i){if(null!=i){delete this.pendientes[i.name];const e=Object.keys(this.pendientes);if(e.length>0)return void console.log(this.name,"[     ]","Esperando dependencias:",e.join(", "))}if(!this.config.generar||!this.config.deploy)return 0==this.dependencias.length?void console.log(this.name,"[OK   ]","Servicio desactivado para despliegue"):(console.warn(this.name,"[WARN ]","Servicio desactivado para despliegue. Hay servicios dependientes que podrían no generarse correctamente:",this.dependencias.map((e=>e.name)).join(", ")),Promise.all(this.dependencias.map((i=>i.pack(e,this)))).then((()=>{})));switch(await this.prepararCredenciales(),this.config.framework){case s.U3.meteored:await this.packMeteored(e);break;case s.U3.nextjs:await this.packNextJS(e)}return console.log(this.name,"[OK   ]","Servicio compilado"),0!=this.dependencias.length?Promise.all(this.dependencias.map((i=>i.pack(e,this)))).then((()=>{})):void 0}async packMeteored(e){switch(this.config.runtime){case s.uK.browser:await this.webpack(e),await this.checkVersionBrowser();break;case s.uK.node:{const i=await(0,r.fo)(`${this.dir}/Dockerfile`);await this.webpack(e);const a=[`${this.basedir}/.yarnrc.yml`];switch(i&&a.push(`${this.dir}/Dockerfile`),this.config.framework){case s.U3.nextjs:a.push(`${this.dir}/.next/BUILD_ID`),i||a.push(`${this.basedir}/framework/services-comun/despliegue/Dockerfile-next`);break;case s.U3.meteored:default:a.push(`${this.dir}/output`),i||a.push(`${this.basedir}/framework/services-comun/despliegue/Dockerfile`)}a.push(`${this.dir}/app.js`,`${this.dir}/assets`),await this.checkVersionService(e,a)}break;case s.uK.php:await this.checkVersionService(e,[`${this.dir}/assets`,`${this.dir}/base/nginx/local.conf`,`${this.dir}/autoload.php`,`${this.dir}/composer.json`,`${this.dir}/composer.lock`,await(0,r.fo)(`${this.dir}/Dockerfile`)?`${this.dir}/Dockerfile`:`${this.basedir}/framework/services-comun/despliegue/Dockerfile-php`,`${this.dir}/Dockerfile`,`${this.dir}/index.php`,`${this.dir}/Meteored`,`${this.dir}/vendor`])}}async webpack(e){const{status:i,stdout:a,stderr:s}=await t.O.spawn("yarn",["workspace","services-comun","webpack","--env",`entorno=${e}`,"--env",`dir="${this.dir}"`,"--env",`fecha="${this.fecha.toISOString()}"`,"--config","webpack/webpack.config.ts"],{cwd:this.basedir,env:{TS_NODE_PROJECT:"webpack/tsconfig.json"},colores:!1});if(0!=i)return console.error(this.name,"[KO   ]","Error compilando:"),console.error(a),console.error(s),Promise.reject()}async packNextJS(e){const i="test"==e?"test":"production";await(0,r.fo)(`${this.dir}/.env.${i}.local`)?await(0,r.TC)(`${this.dir}/.env.local`,await(0,r.Cj)(`${this.dir}/.env.${i}.local`),!0,!0):await(0,r.fo)(`${this.dir}/.env.local`)||await(0,r.TC)(`${this.dir}/.env.local`,`ENV=${e}`,!0,!0);{const{status:e,stderr:a}=await t.O.spawn("yarn",["run",this.name,"run","next","build"],{cwd:this.basedir,env:{ZONA:i},colores:!1});if(0!=e)return console.error(this.name,"[KO   ]","Error compilando:"),console.error(a),Promise.reject()}await this.checkVersionService(e,[`${this.basedir}/.yarnrc.yml`,this.config.framework==s.U3.nextjs?`${this.dir}/.next/BUILD_ID`:`${this.dir}/output`,await(0,r.fo)(`${this.dir}/Dockerfile`)?`${this.dir}/Dockerfile`:`${this.basedir}/framework/services-comun/despliegue/Dockerfile-next`,`${this.basedir}/framework/services-comun/next.config.js`,`${this.basedir}/framework/services-comun/next.config.deps.js`,`${this.dir}/next.config.js`,`${this.dir}/public`])}async checkVersionService(e,i){const a=[];if(await(0,r.fo)(`${this.dir}/tags.json`)){let e=await(0,r.TQ)(`${this.dir}/tags.json`).catch((()=>{}));Array.isArray(e)&&(e=e[0]),null!=e?.tags&&Array.isArray(e.tags)&&a.push(...e.tags.filter((e=>!["latest","produccion","test"].includes(e))))}let t,s,n;for(const e of a){const i=/^(\d{4}\.\d{2}\.\d{2})-(\d{3,}).*$/.exec(e);null==i?n=e:(t=i[1],s=i[2])}for(const e of this.config.deps)i.push(`${this.basedir}/services/${e}/hash.txt`);const c=[JSON.stringify(this.packagejson.dependencies??{})];null!=this.config.imagen&&c.push(this.config.imagen);for(const e of i)c.push(await(0,r.Em)(e));const l=`${(0,o.F)(c.filter((e=>e.length>0)).map((e=>(0,o.F)(e))).join("")).substring(0,8)}-${e}`;if(null==t||null==s||n!=l){const e=new Date,i=[e.getUTCFullYear(),`0${e.getUTCMonth()+1}`.slice(-2),`0${e.getUTCDate()}`.slice(-2)].join(".");let a;a=t==i?`00${parseInt(s??"0")+1}`.slice(-3):"001",this.packagejson.version=`${i}-${a}`,await(0,r.TC)(`${this.dir}/nuevo.txt`,"1",!0,!0)}else this.packagejson.version=`${t}-${s}`;await(0,r.TC)(`${this.dir}/version.txt`,`${this.packagejson.version}-${e}`,!0,!0),await(0,r.TC)(`${this.dir}/hash.txt`,l,!0,!0),await this.guardar()}async checkVersionBrowser(){const e=await(0,r.Em)(`${this.dir}/output`);await(0,r.TC)(`${this.dir}/output/hash.txt`,e,!0,!0),await(0,r.TC)(`${this.dir}/hash.txt`,e,!0,!0)}async prepararCredenciales(){let e;await(0,r.Ck)(`${this.dir}/files/credenciales/`,!0),await(0,r.fo)(`${this.basedir}/mysql.txt`)&&(e=`/root/${await(0,r.Cj)(`${this.basedir}/mysql.txt`)}`);for(const{source:i,target:a}of this.config.credenciales)if(await(0,r.fo)(`${this.basedir}/kustomizar/tmp/credenciales/${i}`)){const t=await(0,r.Cj)(`${this.basedir}/kustomizar/tmp/credenciales/${i}`);if(await(0,r.TC)(`${this.dir}/files/credenciales/${a}`,t),null!=e&&"mysql.json"==a){const i=JSON.parse(t);if(null!=i.master)if(i.master.socketPath=e,null!=i.slaves&&Array.isArray(i.slaves))for(const a of i.slaves)a.socketPath=e;else i.slaves=[i.master];else if(null!=i.slaves&&Array.isArray(i.slaves))for(const a of i.slaves)a.socketPath=e;null!=i.socketPath&&(i.socketPath=e),await(0,r.TC)(`${this.dir}/files/credenciales/${a}`,JSON.stringify(i))}}}}var c=a(918);class l{static run(e,i){(0,c.aw)().then((async()=>{const a=await(0,r.Ci)(`${e}/services/`),s=await this.fechaCommit(e),o=await Promise.all(a.map((i=>n.build(e,i,s)))),c=o.filter((e=>null!=e));if(c.forEach((e=>{e.checkDependencias(c)})),await(0,r.Q7)(`${e}/i18n`)){const{status:e,stdout:i,stderr:a}=await t.O.spawn("yarn",["workspace","i18n","run","generate"]);if(0!=e)return console.error("i18n","[KO   ]","Error compilando:"),console.error(i),console.error(a),Promise.reject();console.log("i18n","[OK   ]","Traducciones generadas")}await Promise.all([n.md5Deps(e),...c.filter((e=>!e.dependiente)).map((e=>e.pack(i)))])})).catch((e=>{null!=e&&console.error(e),process.exit(1)}))}static async fechaCommit(e){if(await(0,r.fo)(`${e}/last_commit.txt`)){const i=await(0,r.Cj)(`${e}/last_commit.txt`);return new Date(i.trim())}return new Date(0)}}},228:(e,i,a)=>{a.d(i,{Devel:()=>b});var t=a(24),s=a(421),r=a(161),o=a.n(r),n=a(169),c=a.n(n),l=a(124),h=a(627),d=a(372);class p extends h.a{static TIMEOUT=3e5;compilar;label;compilador;timeout;constructor(e){super(e);const i=e.nombre.padEnd(e.pad),a=l.J.nextColor();this.compilar=e.global.i18n,this.label=l.J.colorize(a,i)}initWatcher(){this.watcher?.close(),"linux"!=o().platform()&&(this.watcher=(0,t.watch)(`${this.dir}/.json/`,{recursive:!0},((e,i)=>{i?.endsWith("~")||this.cambio()})))}cambio(){this.runCompilar().then((()=>{})).catch((e=>{d.t.error({type:d.t.label_base,label:this.label},"Error reiniciando el compilador",e)}));for(const e of this.hijos)e.cambio()}setTimeoutCompilador(){"linux"!=o().platform()&&(null!=this.timeout&&clearTimeout(this.timeout),this.timeout=setTimeout((()=>{this.stopCompilar().then((()=>{})).catch((e=>{d.t.error({type:d.t.label_base,label:this.label},"Error pausando el compilador",e)}))}),p.TIMEOUT))}updateGlobal(e){this.compilar=e.i18n,this.run().then((()=>{})).catch((e=>{d.t.error({type:d.t.label_base,label:this.label},"Error aplicando configuración global",e)}))}async run(){await super.run(),await Promise.all([this.runCompilar()])}async runCompilar(){await this.checkCompilar()?await this.initCompilar():await this.stopCompilar()}async checkCompilar(){return this.compilar}async initCompilar(){this.setTimeoutCompilador(),null==this.compilador&&(d.t.info({type:d.t.label_compilar,label:this.label},"Iniciando generación de idiomas"),this.compilador=(0,s.spawn)("yarn",["run","i18n","run","generate","--watch"],{cwd:this.root,env:{...process.env,FORCE_COLOR:"1"},stdio:"pipe",shell:!0}),this.compilador.stdout.on("data",(e=>{const i=e.toString().split("\n").filter((e=>e.length>0));for(const e of i)d.t.info({type:d.t.label_compilar,label:this.label},e)})),this.compilador.stderr.on("data",(e=>{const i=e.toString().split("\n").filter((e=>e.length>0));for(const e of i)d.t.error({type:d.t.label_compilar,label:this.label},e)})),this.compilador.on("error",(e=>{d.t.error({type:d.t.label_compilar,label:this.label},l.J.colorize([l.J.FgRed,l.J.Bright],"Error de generación de idiomas"),e)})))}async stopCompilar(){return new Promise(((e,i)=>{null!=this.compilador?(d.t.info({type:d.t.label_compilar,label:this.label},"Deteniendo generación de idiomas (",this.compilador.pid,")"),null!=this.compilador.pid?c()(this.compilador.pid,(a=>{a?(d.t.error({type:d.t.label_compilar,label:this.label},"Deteniendo generación de idiomas => KO",a),i(a)):(d.t.info({type:d.t.label_compilar,label:this.label},"Deteniendo generación de idiomas => OK"),this.compilador=void 0,e())})):e()):e()}))}}var m=a(851),u=a(582),f=a(918),w=a(386);class b{static run(e,i){(0,f.aw)().then((async()=>{if(i.compilar){const{Init:i}=await Promise.all([a.e(582),a.e(232),a.e(534)]).then(a.bind(a,793)),{Framework:t}=await Promise.all([a.e(582),a.e(128)]).then(a.bind(a,830));[await i.init(e),await t.update(e)].reduce(((e,i)=>e||i),!1)&&await u.R.install(e,{verbose:!1})}await this.ejecutar(i,e)})).catch((e=>{null!=e&&console.error(e)}))}static async ejecutar(e,i){const[a,t]=await Promise.all([this.ejecutarWorkspaces(i,"framework"),this.ejecutarWorkspaces(i,"packages")]);if(!await this.ejecutarServices(e,i,[...a,...t]))for(const e of[a,t].flat())e.parar()}static async ejecutarWorkspaces(e,i){if(!await(0,w.Q7)(`${e}/${i}`))return[];const a=await(0,w.Ci)(`${e}/${i}`);return Promise.all(a.map((a=>this.ejecutarWorkspace(e,i,a))))}static async ejecutarWorkspace(e,i,a){const t=new h.a({nombre:a,path:i,root:e});return t.init().then((()=>t))}static async ejecutarServices(e,i,a){const s=await(0,w.TQ)(`${i}/config.workspaces.json`).catch((()=>({devel:{available:[],disabled:[]},packd:{available:[],disabled:[]},i18n:!0,services:{}})));if(!await(0,w.Q7)(`${i}/services`))return!1;const r=await(0,w.Ci)(`${i}/services`),o=r.reduce(((e,i)=>Math.max(e,i.length)),0);if(e.compilar&&await(0,w.Q7)(`${i}/i18n`)){const t=new h.a({nombre:"i18n",root:i});await t.init(),a.push(t),await this.ejecutarI18N(e,i,o)}const n=[];for(const t of r){const r=new m.kl({nombre:t,path:"services",root:i,pad:o,compilar:e.compilar,ejecutar:e.ejecutar,forzar:e.forzar,global:s});n.push(r.init().then((()=>{for(const e of a)e.addHijo(r);return r})))}const c=await Promise.all(n);return(0,t.watch)(`${i}/config.workspaces.json`,(()=>{(0,w.TQ)(`${i}/config.workspaces.json`).catch((()=>({devel:{available:[],disabled:[]},packd:{available:[],disabled:[]},i18n:!0,services:{}}))).then((async e=>{for(const i of c)i.updateGlobal(e)}))})),!0}static async ejecutarI18N(e,i,a){const s=await(0,w.TQ)(`${i}/config.workspaces.json`).catch((()=>({devel:{available:[],disabled:[]},packd:{available:[],disabled:[]},i18n:!0,services:{}}))),r=new p({nombre:"i18n",root:i,pad:a,global:s});return await r.init(),(0,t.watch)(`${i}/config.workspaces.json`,(()=>{(0,w.TQ)(`${i}/config.workspaces.json`).catch((()=>({devel:{available:[],disabled:[]},packd:{available:[],disabled:[]},i18n:!0,services:{}}))).then((async e=>{r.updateGlobal(e)}))})),!0}}}};
//# sourceMappingURL=devel.js.map