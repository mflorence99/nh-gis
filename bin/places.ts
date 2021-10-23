/* eslint-disable @typescript-eslint/naming-convention */
import { Feature } from './geojson';
import { FeatureCollection } from './geojson';

import { crs } from './geojson';

import * as turf from '@turf/turf';

import { mkdirSync } from 'fs';
import { readFileSync } from 'fs';
import { writeFileSync } from 'fs';

import chalk from 'chalk';
import shp from 'shpjs';

const url =
  'https://ftp.granit.sr.unh.edu/GRANIT_Data/Vector_Data/Cultural_Society_and_Demographic/d-gnis/GNIS_2008';

const state = 'NEW HAMPSHIRE';

const allTowns = JSON.parse(
  readFileSync(`./dist/${state}/towns.geojson`).toString()
);

const placesByCountyByTown = {};

async function main(): Promise<void> {
  console.log(chalk.blue(`Loading ${url}...`));
  const lakes = (await shp(url)) as FeatureCollection;

  lakes.features.forEach((feature: Feature) => {
    const county = feature.properties.COUNTY.toUpperCase();
    if (county && county !== 'UNDETERMINED') {
      // 👇 the data doesn't have the town, so lets see if turf can
      //    find it from the dataset of all towns
      const town = allTowns.features.find((townFeature) =>
        turf.booleanPointInPolygon(feature, townFeature)
      )?.id;

      if (town) {
        // 👉 some features have bbox on the geometry, we created our own
        delete feature.geometry.bbox;

        feature.bbox = turf.bbox(feature);
        feature.properties = {
          county: county,
          type: feature.properties.FEATYPE,
          name: feature.properties.FEATURE,
          town: town
        };

        placesByCountyByTown[county] ??= {};
        const geojson: FeatureCollection = {
          crs: crs,
          features: [],
          name: `${town} Places of Interest`,
          type: 'FeatureCollection'
        };
        placesByCountyByTown[county][town] ??= geojson;
        placesByCountyByTown[county][town].features.push(feature);
      }
    }
  });

  // 👉 one file per town
  Object.keys(placesByCountyByTown).forEach((county) => {
    Object.keys(placesByCountyByTown[county]).forEach((town) => {
      console.log(
        chalk.green(`... writing ${state}/${county}/${town}/places.geojson`)
      );
      mkdirSync(`dist/${state}/${county}/${town}`, { recursive: true });
      writeFileSync(
        `dist/${state}/${county}/${town}/places.geojson`,
        JSON.stringify(placesByCountyByTown[county][town], null, 2)
      );
    });
  });
}

main();

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const sample = {
  FEATURE: '865 Second Street Shopping Center',
  FEATYPE: 'locale',
  COUNTY: 'Hillsborough',
  STCODE: 33,
  COCODE: 11,
  QUAD: 'Manchester South',
  FeatID: 1915859
};
