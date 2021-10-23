import { Feature } from './geojson';
import { FeatureCollection } from './geojson';

import { crs } from './geojson';

import { readFileSync } from 'fs';
import { writeFileSync } from 'fs';

import booleanIntersects from '@turf/boolean-intersects';

const powerlines = JSON.parse(
  readFileSync(
    '/home/mflo/Downloads/Electric_Power_Transmission_Lines.geojson'
  ).toString()
);

const state = 'NEW HAMPSHIRE';

const boundary = JSON.parse(
  readFileSync(`./dist/${state}/boundary.geojson`).toString()
);

const geojson: FeatureCollection = {
  crs: crs,
  features: [],
  name: `${state} Powerlines`,
  type: 'FeatureCollection'
};

powerlines.features
  .filter((feature: Feature) => booleanIntersects(feature, boundary))
  .forEach((feature: Feature) => geojson.features.push(feature));

writeFileSync(
  `assets/New_Hampshire_Electric_Power_Transmission_Lines.geojson`,
  JSON.stringify(geojson, null, 2)
);
