/* eslint-disable @typescript-eslint/naming-convention */
import { Feature } from './geojson';
import { FeatureCollection } from './geojson';

import { crs } from './geojson';

import * as turf from '@turf/turf';

import { mkdirSync } from 'fs';
import { readFileSync } from 'fs';
import { writeFileSync } from 'fs';

import booleanIntersects from '@turf/boolean-intersects';
import chalk from 'chalk';
import copy from 'fast-copy';

// 👇 sucks we have to read the data from this downloaded file
//    but NH doesn't have anything useful and we downloaded this
//    from the URL below -- perhaps the PUC has something?
//    we can't commit thus file because it is too large

// 👉 https://hifld-geoplatform.opendata.arcgis.com/datasets/electric-power-transmission-lines/explore

const state = 'NEW HAMPSHIRE';

const powerlines = JSON.parse(
  readFileSync(
    './assets/New_Hampshire_Electric_Power_Transmission_Lines.geojson'
  ).toString()
);

const allTowns = JSON.parse(
  readFileSync(`./dist/${state}/towns.geojson`).toString()
);

const index = JSON.parse(readFileSync('./dist/index.json').toString());

const linesByCountyByTown = {};

function lookupCounty(town: string): string {
  const counties = Object.keys(index[state]);
  const county = counties.filter((county) => index[state][county][town]);
  return county?.[0];
}

powerlines.features.forEach((feature: Feature) => {
  // 👇 the data doesn't have the town, so lets see if turf can
  //    find it from the dataset of all towns
  const towns = allTowns.features.filter((townFeature) =>
    // 👉 https://github.com/Turfjs/turf/pull/2157
    /* turf. */ booleanIntersects(feature, townFeature)
  );

  towns
    .map((town) => town.id)
    .forEach((town) => {
      const county = lookupCounty(town);
      if (county) {
        const powerline = copy(feature);

        // 👉 some features have bbox on the geometry, we created our own
        delete powerline.geometry.bbox;

        powerline.bbox = turf.bbox(powerline);
        powerline.properties = {
          county: county,
          town: town
        };

        linesByCountyByTown[county] ??= {};
        const geojson: FeatureCollection = {
          crs: crs,
          features: [],
          name: `${town} Powerlines`,
          type: 'FeatureCollection'
        };
        linesByCountyByTown[county][town] ??= geojson;
        linesByCountyByTown[county][town].features.push(powerline);
      }
    });
});

// 👉 one file per town
Object.keys(linesByCountyByTown).forEach((county) => {
  Object.keys(linesByCountyByTown[county]).forEach((town) => {
    console.log(
      chalk.green(`... writing ${state}/${county}/${town}/powerlines.geojson`)
    );
    mkdirSync(`dist/${state}/${county}/${town}`, { recursive: true });
    writeFileSync(
      `dist/${state}/${county}/${town}/powerlines.geojson`,
      JSON.stringify(linesByCountyByTown[county][town], null, 2)
    );
  });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const sample = {
  OBJECTID: 1,
  ID: '212144',
  TYPE: 'AC; OVERHEAD',
  STATUS: 'IN SERVICE',
  NAICS_CODE: '221121',
  NAICS_DESC: 'ELECTRIC BULK POWER TRANSMISSION AND CONTROL',
  SOURCE: 'IMAGERY',
  SOURCEDATE: '2020-03-04T00:00:00Z',
  VAL_METHOD: 'IMAGERY',
  VAL_DATE: '2020-03-04T00:00:00Z',
  OWNER: 'BONNEVILLE POWER ADMINISTRATION',
  VOLTAGE: 69,
  VOLT_CLASS: 'UNDER 100',
  INFERRED: 'Y',
  SUB_1: 'EAST ARLINGTON',
  SUB_2: 'TAP209798',
  SHAPE_Length: 0.09014889071718463
};
