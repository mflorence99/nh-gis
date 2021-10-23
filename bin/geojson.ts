// 👉 much simplified version of ambient GeoJSON

export type BBox =
  | [minX: number, minY: number, maxX: number, maxY: number]
  | [
      minX: number,
      minY: number,
      minZ: number,
      maxX: number,
      maxY: number,
      maxZ: number
    ];

export interface CRS {
  properties: {
    name: string;
  };
  type: string;
}
export interface Feature {
  bbox?: BBox;
  geometry: any;
  id: string;
  properties: {
    [key: string]: any;
  };
  type: 'Feature';
}

export interface FeatureCollection {
  crs: CRS;
  features: Feature[];
  name: string;
  type: 'FeatureCollection';
}

export const crs = {
  properties: {
    name: 'EPSG:4326'
  },
  type: 'name'
};
