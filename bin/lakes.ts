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
import shp from 'shpjs';

const index = JSON.parse(readFileSync('./dist/index.json').toString());

const url =
  'https://ftp.granit.sr.unh.edu/GRANIT_Data/Vector_Data/Elevation_and_Derived_Products/d-bathymetry/Bathymetry_Lakes_polygons';

const state = 'NEW HAMPSHIRE';

const lakesByCountyByTown = {};

function lookupCounty(town: string): string {
  const counties = Object.keys(index[state]);
  const county = counties.filter((county) => index[state][county][town]);
  return county?.[0];
}

async function main(): Promise<void> {
  console.log(chalk.blue(`Loading ${url}...`));
  const lakes = (await shp(url)) as FeatureCollection;

  lakes.features.forEach((feature: Feature) => {
    // 👉 we will ignore the county, as there will be multiple towns
    const townList = (feature.properties.TOWN as string)?.toUpperCase();

    if (townList) {
      const towns = townList.split('/');
      towns.forEach((town) => {
        const county = lookupCounty(town);
        if (county) {
          const lake = copy(feature);

          // 👉 some features have bbox on the geometry, we created our own
          delete lake.geometry.bbox;

          lake.bbox = turf.bbox(lake);
          lake.properties = {
            county: county,
            name: lake.properties.LAKE,
            town: town
          };

          lakesByCountyByTown[county] ??= {};
          const geojson: FeatureCollection = {
            crs: crs,
            features: [],
            name: `${town} Lakes`,
            type: 'FeatureCollection'
          };
          lakesByCountyByTown[county][town] ??= geojson;
          lakesByCountyByTown[county][town].features.push(lake);
        }
      });
    }
  });

  // 👉 one file per town
  Object.keys(lakesByCountyByTown).forEach((county) => {
    Object.keys(lakesByCountyByTown[county]).forEach((town) => {
      console.log(
        chalk.green(`... writing ${state}/${county}/${town}/lakes.geojson`)
      );
      mkdirSync(`dist/${state}/${county}/${town}`, { recursive: true });
      writeFileSync(
        `dist/${state}/${county}/${town}/lakes.geojson`,
        JSON.stringify(lakesByCountyByTown[county][town], null, 2)
      );
    });
  });
}

main();

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const sample = {
  AU_ID: 'NHLAK700061102-02',
  TOWN: 'SALEM/WINDHAM',
  AREA: 23385.9046882,
  ACRES: 0.537,
  SQKM: 0.0022,
  SQMETERS: 2172.6303,
  PERIMETER: 699.61609,
  DEPTHMIN: 0,
  DEPTHMAX: 0,
  COUNTY: 'ROCKINGHAM',
  LAKE: 'CANOBIE LAKE',
  SOURCE: 'NHDES'
};
