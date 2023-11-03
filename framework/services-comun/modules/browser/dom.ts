export function appendContentChildren(padre: HTMLElement, contenedor: HTMLElement): void {
    const children = contenedor.children;
    for (let i=0, len=children.length; i<len; i++) {
        const candidato = children.item(i);
        if (candidato!=null) {
            padre.appendChild(candidato);
        }
    }
}
