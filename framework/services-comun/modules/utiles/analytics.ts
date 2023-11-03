import {exists, readJSON} from "./fs";
const {BetaAnalyticsDataClient} = require('@google-analytics/data');



class GAnalytics4 {

    private static async loadGAnalytics4Id() {
        const file = "files/credenciales/analytics.json";
        if (!await exists(file)) {
            return Promise.reject("Firebase disabled");
        }
        return await readJSON<any>(file);
    }

    public static async getAnalyticsReport(propiedad: number, config: any): Promise<any> {

        return await GAnalytics4.loadGAnalytics4Id()
            .then(async paquete => {

                const analyticsDataClient = new BetaAnalyticsDataClient({
                    credentials: paquete
                });

                return await analyticsDataClient.runReport({
                    property: `properties/${propiedad}`,
                    ...config
                })
                    .then((resp: any) => {
                        return resp[0].rows.map((row: any) => {
                            return {
                                key: row.dimensionValues[0].value,
                                value: row.metricValues[0].value,
                            }
                        });
                    })
                    .catch((err: any) => {
                        return Promise.reject(err)
                    });
            })
            .catch(err => {
                return Promise.reject(err)
            });

    }
}

export {GAnalytics4}
