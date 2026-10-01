/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: 7efbc249d1d4216b01c43e4e89759448
 * Versión: 2026.9.23+3-bixus
 * Anterior: 2026.9.16+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

declare var window: any;

export interface IDataLayerEvent {
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
    promotions?:string;
}

export class DataLayer {
    /* STATIC */

    public static initial_url: string = window.location.href;
    public static push(data:IDataLayerEvent):void {
        window['dataLayer'].push(data);
    }

    public static getGA4Event(eventName:string, promotionName:string = ''):IDataLayerEvent {
        return {
            event: eventName,
            event_type: 'ga4_event',
            eventCategory:'',
            eventAction:'',
            eventLabel:'',
            page_location:this.initial_url,
            promotions: promotionName,
            content_group: window.content_group,
            name_view: window.name_view,
        };
    }
    public static resetPromotions(): IDataLayerEvent{
        return {
            promotions : 'none',
            page_location:this.initial_url,
        }
    }
}
