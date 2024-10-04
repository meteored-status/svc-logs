import {type IRequestConfig, Peticion} from ".";

export class PeticionData<K> extends Peticion {
    /* INSTANCE */
    protected constructor(url: string, public readonly data: K, cfg: IRequestConfig) {
        super(url, cfg);
    }

    protected override init(): RequestInit {
        const init = super.init();
        init.cache = "no-cache";
        if (!this.headers.has("Content-Type")) {
            if (this.cfg.contentType!=undefined) {
                this.headers.set("Content-Type", this.cfg.contentType);
            } else {
                this.headers.set("Content-Type", "application/json");
            }
        }
        switch(this.headers.get("Content-Type")) {
            case "application/json":
                init.body = JSON.stringify(this.data);
                break;
            case "multipart/form-data":
                init.body = this.data as FormData;
                this.headers.delete("Content-Type");
                break;
            case "text/plain":
                init.body = String(this.data);
                break;
            // case "application/x-www-form-urlencoded":
            //     init.body = String(post);
            //     break;
        }

        return init;
    }
}
