export interface IGeoJSON<P extends IProperties=any> {
    type: "Feature"|"FeatureCollection";
    properties: P;
    geometry: IGeometry;
    features?: IGeoJSON[];
}

export interface IProperties {

}

export interface IGeometry {
    type: "Point"|"LineString"|"Polygon"|"MultiPoint"|"MultiLineString"|"MultiPolygon";
    coordinates: any[];
}
