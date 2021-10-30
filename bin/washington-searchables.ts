import { Feature } from './geojson';
import { FeatureCollection } from './geojson';
import { PARCELS } from '../assets/washington-parcels';

import { crs } from './geojson';

import * as turf from '@turf/turf';

import { mkdirSync } from 'fs';
import { writeFileSync } from 'fs';

import chalk from 'chalk';

// 👉 Washington is special as we have already curated the lots

// 👉 the idea behind searchables is to provide just enough data for
//    parcels to be searched -- we do this because we MUST have ALL
//    the data available

const state = 'NEW HAMPSHIRE';
const county = 'SULLIVAN';
const town = 'WASHINGTON';

const allSearchables: Feature[] = [];

const fromLatLon = (l): [number, number] => (l ? [l.lon, l.lat] : null);

PARCELS.lots.forEach((lot) => {
  console.log(chalk.blue(`Processing lot ${lot.id}...`));
  // 👉 break up multi-polygon lots into separate features
  for (let ix = 0; ix < lot.boundaries.length; ix++) {
    const feature: any = {
      geometry: {
        coordinates: [lot.boundaries[ix].map(fromLatLon)],
        type: 'Polygon'
      },
      properties: {
        address: lot.address,
        id: lot.id,
        owner: lot.owner
      },
      type: 'Feature'
    };
    // 👉 we can get turf to do this once we've built the feature
    feature.bbox = turf.bbox(feature);
    // 👉 now we no longer need the geometry
    delete feature.geometry;
    allSearchables.push(feature);
  }
});

// 👉 one file for Washington
console.log(
  chalk.green(`... writing ${state}/${county}/${town}/searchables.geojson`)
);
const geojson: FeatureCollection = {
  crs: crs,
  features: allSearchables,
  name: `${town} Searchables`,
  type: 'FeatureCollection'
};
mkdirSync(`dist/${state}/${county}/${town}`, { recursive: true });
writeFileSync(
  `dist/${state}/${county}/${town}/searchables.geojson`,
  JSON.stringify(geojson, null, 2)
);
