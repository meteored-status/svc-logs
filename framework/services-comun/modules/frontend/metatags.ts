export enum ETiposOg {
    article = "article"
}

export enum ETiposTwitterCard {
    summary = "summary",
    summary_large_image = "summary_large_image",

}

export interface IMetatags {
    lang: string;
    title: string;
    description: string;
    keywords?: string;
    robots: string;
    canonical?: string;
    relNext?: string;
    relPrev?: string;
    real_author?: string;
    rrss?: IMetatagsRrss;
}

export interface IMetatagsRrss extends IOgMetatags, ITwitterCard{
    title?: string,          // Titulo
    url?: string,            // Url
    description?: string,    // Descripción de la página
    image?: IOgImagen,  // Imagenes del artículo
}

export interface IOgImagen{
    url: string,            // Imagen
    width?: number,          // Ancho de la imagen
    height?: number,         // Alto de la imagen
}

export interface IOgMetatags{
    type: ETiposOg,          // Tipo de página
    site_name: string,      // Nombre del Sitio
    publicacion?: IOgPublicacion,
}

export interface IOgPublicacion {
    publisher: string,      // Url del facebook del sitio
    author?: string,         // Url de facebook del autor
    tag: string,            // Tags de la página
    section?: string,        // Sección de la página
    published_time: string,   // Fecha de publicación
    modified_time: string,    // Fecha de modificación
}

export interface ITwitterCard {
    card: ETiposTwitterCard,       // Tipo de la carta de compartido
    twitter: string,              // Nombre de la cuenta de twitter
}
