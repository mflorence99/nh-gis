/* eslint-disable @typescript-eslint/naming-convention */
import { Feature } from './geojson';
import { FeatureCollection } from './geojson';

import { crs } from './geojson';

import * as turf from '@turf/turf';

import { mkdirSync } from 'fs';
import { readFileSync } from 'fs';
import { writeFileSync } from 'fs';

import chalk from 'chalk';
import copy from 'fast-copy';
import request from 'request';
import unzipper from 'unzipper';

// 👉 https://github.com/microsoft/USBuildingFootprints

const state = 'NEW HAMPSHIRE';

// 👇 we won't even bother to look at these towns as we know they're
//    too big and analyzing them can cause out-of-memory conditions
//    NOTE: we exclude WASHINGTON because we already have its legacy data
// 👉 https://www.newhampshire-demographics.com/cities_by_population
const exclusions = [
  'CONCORD',
  'DERRY',
  'DOVER',
  'HUDSON',
  'LONDONDERRY',
  'MANCHESTER',
  'MERRIMACK',
  'NASHUA',
  'ROCHESTER',
  'SALEM',
  'WASHINGTON'
];

// 👉 we SHOULD be reading from this URL
const url =
  'https://usbuildingdata.blob.core.windows.net/usbuildings-v2/NewHampshire.geojson.zip';
const fileName = 'NewHampshire.geojson';

const allTowns = JSON.parse(
  readFileSync(`./dist/${state}/towns.geojson`).toString()
);

const allTownFeatures = allTowns.features.filter(
  (feature) => !exclusions.includes(feature.id)
);

const index = JSON.parse(readFileSync('./dist/index.json').toString());

const buildingsByCountyByTown = {};

function lookupCounty(town: string): string {
  const counties = Object.keys(index[state]);
  const county = counties.filter((county) => index[state][county][town]);
  return county?.[0];
}

// 👇 keep track of progress
const gulp = 1000;
let lastIndex = 0;
let lastTime = Date.now();

async function main(): Promise<void> {
  console.log(chalk.blue(`Loading and unzipping ${url} ...`));
  const directory = await unzipper.Open.url(request, url);
  const file = directory.files.find((d) => d.path === fileName);
  const content = await file.buffer();
  const buildings = JSON.parse(content.toString());

  // 👇 let's get started
  const numBuildings = buildings.features.length;
  console.log(chalk.blue(`Processing ${numBuildings} buildings ...`));

  // 👇 iterate over buildings one at a time
  buildings.features.forEach((feature: Feature, ix: number) => {
    // 👇 this takes forever, so let's try to log progress
    const index = Math.trunc(ix / gulp) * gulp;
    if (index !== lastIndex) {
      const timeNow = Date.now();
      const duration = timeNow - lastTime;
      console.log(
        chalk.yellow(
          `... ${ix} of ${numBuildings} in ${duration / 1000} secs`,
          chalk.cyan(
            `ETA ${
              (((numBuildings - ix) / gulp) * duration) / (1000 * 60 * 60)
            } hours`
          )
        )
      );
      lastIndex = index;
      lastTime = timeNow;
    }

    // 👇 the data doesn't have the town, so lets see if turf can
    //    find it from the dataset of all towns
    const towns = allTownFeatures.filter((townFeature) =>
      // 👉 https://github.com/Turfjs/turf/pull/2157
      turf.booleanContains(townFeature, feature)
    );

    // 👉 we already have legacy Washington data
    towns
      .map((town) => town.id)
      .filter((town) => town !== 'WASHINGTON')
      .forEach((town) => {
        const county = lookupCounty(town);
        if (county) {
          const building = copy(feature);
          delete building.geometry.bbox;
          delete building.properties;

          buildingsByCountyByTown[county] ??= {};
          const geojson: FeatureCollection = {
            crs: crs,
            features: [],
            name: `${town} Buildings`,
            type: 'FeatureCollection'
          };
          buildingsByCountyByTown[county][town] ??= geojson;
          buildingsByCountyByTown[county][town].features.push(building);
        }
      });
  });

  // 👉 one file per town
  Object.keys(buildingsByCountyByTown).forEach((county) => {
    Object.keys(buildingsByCountyByTown[county]).forEach((town) => {
      console.log(
        chalk.green(`... writing ${state}/${county}/${town}/buildings.geojson`)
      );
      mkdirSync(`dist/${state}/${county}/${town}`, { recursive: true });
      writeFileSync(
        `dist/${state}/${county}/${town}/buildings.geojson`,
        JSON.stringify(buildingsByCountyByTown[county][town], null, 2)
      );
    });
  });
}

main();

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const sample = {
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [-70.875614, 43.197566],
        [-70.875541, 43.197566],
        [-70.875541, 43.197603],
        [-70.875614, 43.197603],
        [-70.875614, 43.197566]
      ]
    ]
  },
  properties: {
    release: 1,
    capture_dates_range: ''
  }
};
