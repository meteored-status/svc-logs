declare var window: any;

export interface IDataLayerEvent {
    event?:string;
    // ga4
    ga4_event_name?:string;
    ga4_action_name?:string;
    ga4_tag_name?:string;
}

export class DataLayer {
    public static push(data:IDataLayerEvent):void {
        window['dataLayer'].push(data);
    }


    public static getGA4Event():IDataLayerEvent {
        return {
            event: 'ga4_event'
        };
    }
}
