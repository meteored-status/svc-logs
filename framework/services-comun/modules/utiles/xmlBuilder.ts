export interface IXMLConfig {
    codificacion: string;
}

export class XMLBuilder {
    private encoding: string;
    public constructor(private readonly base: XMLNode, private readonly cfg: Partial<IXMLConfig>={}) {
        const config = {
            codificacion: 'UTF-8',
            ...cfg,
        };

        this.encoding = config.codificacion;
    }


    public toString(): string {
        return `<?xml version="1.0" encoding="${this.encoding}" ?>${this.base.toString()}`;
    }
}


interface IXMLNodeCFG {
    comprimible: boolean;
    begin: string;
    end: string;
    close: string;
}

export class XMLNode {
    private readonly atributos: Record<string, string>;
    private hijos: XMLNode[];
    private texto: string;
    private cdata: boolean;
    private readonly begin_smb: string;
    private readonly end_smb: string;
    private readonly close_smb: string;
    private readonly comprimible: boolean;
    private compactable: boolean;
    private compactado: boolean;

    public constructor(public readonly nombre: string, cfg: Partial<IXMLNodeCFG>={}) {
        const config = {
            comprimible: true,
            begin: '<',
            end: '>',
            close: '/',
            ...cfg,
        }
        this.atributos = {};
        this.hijos = [];
        this.texto = "";
        this.cdata = false;
        this.begin_smb = config.begin;
        this.end_smb = config.end;
        this.close_smb = config.close;
        this.comprimible = config.comprimible;
        this.compactable = true;
        this.compactado = false;
    }

    public anadirHijo(hijo: XMLNode): XMLNode {
        if (this.compactado) {
            throw new Error('No se puede añadir hijos a un nodo compactado');
        }

        this.hijos.push(hijo);

        return this;
    }

    public anadirHijos(hijos: XMLNode[]): XMLNode {
        if (this.compactado) {
            throw new Error('No se puede añadir hijos a un nodo compactado');
        }

        this.hijos.push(...hijos);

        return this;
    }

    public anadirAtributo(nombre: string, valor: string): XMLNode {
        this.atributos[nombre] = valor;

        return this;
    }

    private getTexto(): string {
        if (this.hijos.length > 0) {
            return '';
        }
        if (!this.cdata) {
            return this.texto;
        }
        return '<![CDATA[' + this.texto + ']]>';
    }

    public setTexto(texto: string): XMLNode {
        if (this.compactado) {
            throw new Error('No se puede establecer el texto de un nodo compactado');
        }
        this.texto = texto;
        if (texto !== '') {
            this.compactable = false;
        }

        return this;
    }

    public enableCData(): XMLNode {
        if (this.compactado) {
            throw new Error('No se puede habilitar CDATA en un nodo compactado');
        }
        this.cdata = true;
        this.compactable = false;

        return this;
    }

    public disableCData(): XMLNode {
        this.cdata = false;

        return this;
    }

    public compactar(): XMLNode {
        if (this.compactado) {
            throw new Error('No se puede compactar 2 veces el mismo nodo');
        }
        if (!this.compactable) {
            throw new Error('El nodo no es compactable');
        }
        this.setTexto(this.hijos.map(actual=>actual.toString()).join(''));
        this.hijos = [];
        this.compactado = true;

        return this;
    }

    public toString(): string
    {
        const salida: string[] = [];
        salida.push(this.begin_smb);
        salida.push(this.nombre);
        for (const [atributo, valor] of Object.entries(this.atributos)) {
            salida.push(` ${atributo}="${valor}"`);
        }
        if (this.hijos.length==0 && this.texto.length==0 && this.comprimible) {
            salida.push(this.close_smb);
            salida.push(this.end_smb);
        } else {
            salida.push(this.end_smb);
            for (const hijo of this.hijos) {
                salida.push(hijo.toString());
            }
            salida.push(this.getTexto());
            salida.push(this.begin_smb);
            salida.push(this.close_smb);
            salida.push(this.nombre);
            salida.push(this.end_smb);
        }

        return salida.join('');
    }
}
