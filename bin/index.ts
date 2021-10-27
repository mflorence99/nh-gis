export interface CountyIndex {
  [town: string]: TownIndex | Record<string, Layer>;
  layers: {
    boundary: Layer;
    selectables: Layer;
    towns: Layer;
  };
}

export interface Index {
  [state: string]: StateIndex;
}

export interface Layer {
  available: boolean;
  name: string;
  url: string;
}

export interface TownIndex {
  layers: {
    boundary: Layer;
    buildings: Layer;
    lakes: Layer;
    parcels: Layer;
    places: Layer;
    powerlines: Layer;
    rivers: Layer;
    roads: Layer;
    selectables: Layer;
    trails: Layer;
  };
}

export interface StateIndex {
  [county: string]: CountyIndex | Record<string, Layer>;
  layers: {
    boundary: Layer;
    counties: Layer;
    railroads: Layer;
    selectables: Layer;
    towns: Layer;
  };
}
