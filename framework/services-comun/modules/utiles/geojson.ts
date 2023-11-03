export interface IGeoJSON {
    type: "Feature"|"FeatureCollection";
    properties: IProperties;
    geometry: IGeometry;
}

export interface IProperties {

}

export interface IGeometry {
    type: "Point"|"LineString"|"Polygon"|"MultiPoint"|"MultiLineString"|"MultiPolygon";
    coordinates: any[];
}
