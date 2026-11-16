/**
 * Editor: David Martínez Moya
 * Fecha: Thu, 05 Nov 2026 10:20:32 GMT
 * Hash: b12d1dee017979e1e3c0b75ea8ebfbc3
 * Versión: 2026.11.5+2-davidmartinezmoya
 * Anterior: 2026.9.23+3-bixus
 * Proyecto: git@github.com:alpred/meteored-svc-translation.git
 */

interface BuilderConfig {
    header: string;
    pretty: boolean;
    indent: string;
}

const DEFAULT_BUILDER_CONFIG: BuilderConfig = {
    header: '<?xml version="1.0" encoding="UTF-8"?>',
    pretty: false,
    indent: '    ',
}

export class XMLBuilder {
    /* INSTANCE */
    private readonly config: BuilderConfig;
    public constructor(config?: Partial<BuilderConfig>) {
        this.config = {
            ...DEFAULT_BUILDER_CONFIG,
            ...config,
        }
    }

    public build(node: XMLNode): string {
        const joiner = this.config.pretty ? '\n' : '';
        return [this.config.header, node.build(this.config)].join(joiner);
    }
}

export class XMLNode {
    /* INSTANCE */
    private readonly name: string;
    private readonly children: XMLNode[];
    private readonly attributes: Record<string, string>;
    private readonly text?: string;
    public constructor(name: string, text?: string) {
        this.name = name;
        this.children = [];
        this.attributes = {};
        this.text = text;
    }

    public addChildren(children: XMLNode): void {
        this.children.push(children);
    }

    public addAttribute(name: string, value: string): void {
        this.attributes[name] = value;
    }

    public getAttribute(name: string): string|undefined {
        return this.attributes[name];
    }

    public build(config: BuilderConfig, indent: string = ''): string {
        const separator = config.pretty ? '\n' : '';

        const attributes = Object.entries(this.attributes).map(([name, value]) => `${name}="${value}"`).join(' ');

        if (this.children.length) {
            const parts: string[] = [];

            parts.push(`${indent}<${this.name}${attributes ? ' ' + attributes : ''}>`);
            for (const child of this.children) {
                parts.push(`${child.build(config, config.pretty ? indent + config.indent : '')}`);
            }
            parts.push(`${indent}</${this.name}>`);

            return parts.join(separator);
        } else {
            const attrString = attributes ? ` ${attributes}` : '';
            const textString = this.text !== undefined ? this.text : '';

            if (textString === '') {
                return `${indent}<${this.name}${attrString}/>`;
            }

            if (config.pretty && textString.includes('\n')) {
                // Dividimos, limpiamos líneas vacías e indentamos el texto interno
                const formattedText = textString
                    .split('\n')
                    .filter(line => line.trim() !== '')
                    .map(line => `${indent}${config.indent}${line}`)
                    .join('\n');

                // Devolvemos el nodo con el texto y la etiqueta de cierre bien alineada
                return `${indent}<${this.name}${attrString}>\n${formattedText}\n${indent}</${this.name}>`;
            }

            return `${indent}<${this.name}${attrString}>${textString}</${this.name}>`;
        }
    }

}

export class XLIFFNode extends XMLNode {
    public constructor(version: string = '1.2') {
        // Llamamos al constructor padre forzando el nombre del nodo a 'xliff'
        super('xliff');

        // Añadimos automáticamente los atributos obligatorios del estándar
        this.addAttribute('version', version);
        this.addAttribute('xmlns', 'urn:oasis:names:tc:xliff:document:1.2');
    }

    // Opcional pero muy útil: Un helper para crear el nodo <file> obligatorio
    public addFileNode(original: string, sourceLang: string, targetLang: string): XMLNode {
        const fileNode = new XMLNode('file');
        fileNode.addAttribute('original', original);
        fileNode.addAttribute('source-language', sourceLang);
        fileNode.addAttribute('target-language', targetLang);
        fileNode.addAttribute('datatype', 'plaintext');

        this.addChildren(fileNode);
        return fileNode; // Devolvemos el nodo file por si quieres seguir anidando cosas (header, body...)
    }
}
