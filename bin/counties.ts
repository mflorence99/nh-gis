import { Feature } from './geojson';
import { FeatureCollection } from './geojson';

import { bboxByAspectRatio } from './bbox';
import { crs } from './geojson';

import { mkdirSync } from 'fs';
import { readFileSync } from 'fs';
import { writeFileSync } from 'fs';

import chalk from 'chalk';

const counties = JSON.parse(
  readFileSync('./assets/New_Hampshire_County_Boundaries.geojson').toString()
);

const state = 'NEW HAMPSHIRE';
const wholeState: Feature[] = [];

counties.features.forEach((feature: Feature) => {
  const county = (feature.properties.NAME as string).toUpperCase();

  console.log(chalk.green(`... writing ${state}/${county}/boundary.geojson`));

  // 👉 we don't need the properties, but we do need the bbox
  //    for printing, we want the aspect ratio to be 4:3 (or 3:4)
  //    with mesurements rounded up to the nearest mile
  feature.bbox = bboxByAspectRatio(feature, 4, 3, 'miles');
  feature.id = county;
  delete feature.properties;

  feature.properties = {
    name: county
  };

  // 👉 ouch! the source data uses MultiPolygon, we need Polygon
  if (feature.geometry.type === 'MultiPolygon') {
    feature.geometry.type = 'Polygon';
    feature.geometry.coordinates = feature.geometry.coordinates.flat(1);
  }

  // 👉 gather all the counties in one file
  wholeState.push(feature);

  const geojson: FeatureCollection = {
    crs: crs,
    features: [feature],
    name: `${county} Boundary`,
    type: 'FeatureCollection'
  };

  // 👉 one file per county
  mkdirSync(`dist/${state}/${county}`, { recursive: true });
  writeFileSync(
    `dist/${state}/${county}/boundary.geojson`,
    JSON.stringify(geojson, null, 2)
  );
});

// 👉 one file for all towns
console.log(chalk.green(`... writing ${state}/counties.geojson`));
const geojson: FeatureCollection = {
  crs: crs,
  features: wholeState,
  name: 'New Hampshire County Boundaries',
  type: 'FeatureCollection'
};
writeFileSync(
  `dist/${state}/counties.geojson`,
  JSON.stringify(geojson, null, 2)
);
