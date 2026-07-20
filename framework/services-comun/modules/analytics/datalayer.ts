/**
 * Editor: José Antonio Jiménez
 * Fecha: Mon, 29 Jun 2026 15:47:11 GMT
 * Hash: 9e81b551413197e5ea551014ee8c074a
 * Versión: 2026.6.29+3-josantoniojimnez
 * Proyecto: https://github.com/alpred/meteored-svc-ads.git
 */

declare var window: any;

interface IDataLayerEvent {
    event?:string;
    event_type?:string;
    eventCategory?:string;
    eventAction?:string;
    eventLabel?:string;
    page_location:string;
    type?:string;
    content_group?:string;
    name_view?:string;
    content_id?:string;
}

export class DataLayer {
    public static initial_url: string = window.location.href;
    public static push(data:IDataLayerEvent):void {
        window['dataLayer'].push(data);
    }

    public static getGA4Event(event_name:string):IDataLayerEvent {
        return {
            event: event_name,
            event_type: 'ga4_event',
            eventCategory:'',
            eventAction:'',
            eventLabel:'',
            page_location:this.initial_url,
        };
    }
}
