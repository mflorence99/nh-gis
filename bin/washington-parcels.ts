import { Feature } from './geojson';
import { FeatureCollection } from './geojson';
import { PARCELS } from '../assets/washington-parcels';

import { crs } from './geojson';

import * as turf from '@turf/turf';

import { mkdirSync } from 'fs';
import { writeFileSync } from 'fs';

import chalk from 'chalk';

// 👉 Washington is special as we have already curated the lots

const state = 'NEW HAMPSHIRE';
const county = 'SULLIVAN';
const town = 'WASHINGTON';

const allLots: Feature[] = [];

const fromLatLon = (l): [number, number] => (l ? [l.lon, l.lat] : null);

const classByUsage = {
  '110': 'Single family residence',
  '120': 'Multi family residence',
  '190': 'Current use',
  '260': 'Commercial / Industrial',
  '300': 'Town property',
  '400': 'State property',
  '500': 'State park',
  '501': 'Towm forest',
  '502': 'Conservation land'
};

PARCELS.lots.forEach((lot) => {
  console.log(chalk.blue(`Processing lot ${lot.id}...`));
  // 👉 break up multi-polygon lots into separate features
  const isMulti = lot.boundaries.length > 1;
  for (let ix = 0; ix < lot.boundaries.length; ix++) {
    const feature: Feature = {
      geometry: {
        coordinates: [lot.boundaries[ix].map(fromLatLon)],
        type: 'Polygon'
      },
      id: isMulti ? `${lot.id}:${ix}` : lot.id,
      properties: {
        abutters: lot.abutters,
        address: lot.address,
        area: lot.area,
        areaComputed: lot.areas[ix],
        building$: lot.building$,
        callout: fromLatLon(lot.callouts[ix]),
        center: fromLatLon(lot.centers[ix]),
        class: classByUsage[lot.usage],
        cu$: lot.cu$,
        elevation: lot.elevations[ix],
        id: lot.id,
        label: lot.labels[ix],
        land$: lot.land$,
        lengths: lot.lengths[ix],
        minWidth: lot.minWidths[ix],
        neighborhood: lot.neighborhood,
        numSplits: lot.boundaries.length,
        orientation: lot.orientations[ix],
        owner: lot.owner,
        perimeter: lot.perimeters[ix],
        sqarcity: lot.sqarcities[ix],
        taxed$: lot.taxed$,
        usage: lot.usage,
        use: lot.use,
        zone: lot.zone
      },
      type: 'Feature'
    };
    // 👉 we can get turf to do this once we've built the feature
    feature.bbox = turf.bbox(feature);
    allLots.push(feature);
  }
});

// 👉 one file for Washington
console.log(
  chalk.green(`... writing ${state}/${county}/${town}/parcels.geojson`)
);
const geojson: FeatureCollection = {
  crs: crs,
  features: allLots,
  name: `${town} Parcels`,
  type: 'FeatureCollection'
};
mkdirSync(`dist/${state}/${county}/${town}`, { recursive: true });
writeFileSync(
  `dist/${state}/${county}/${town}/parcels.geojson`,
  JSON.stringify(geojson, null, 2)
);

// 👉 the idea behind searchables is to provide just enough data for
//    parcels to be searched -- we do this because we MUST have ALL
//    the data available

console.log(
  chalk.green(`... writing ${state}/${county}/${town}/searchables.geojson`)
);
mkdirSync(`dist/${state}/${county}/${town}`, { recursive: true });
// 👉 now do this again, converting the real parcels into searchables
geojson.features = allLots.map((feature: any): any => ({
  bbox: feature.bbox,
  id: feature.id,
  properties: {
    address: feature.properties.address,
    id: feature.properties.id,
    owner: feature.properties.owner
  },
  type: 'Feature'
}));
writeFileSync(
  `dist/${state}/${county}/${town}/searchables.geojson`,
  JSON.stringify(geojson, null, 2)
);
