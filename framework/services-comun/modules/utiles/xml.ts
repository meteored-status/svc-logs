/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: d6f6a196922f5ea9f98a7b82ff913efd
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
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
            return `${indent}<${this.name} ${attributes}>${this.text}</${this.name}>`;
        }
    }

}

