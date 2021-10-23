import { FeatureCollection } from './geojson';

import chalk from 'chalk';
import jsome from 'jsome';
import shp from 'shpjs';

const url =
  'https://ftp.granit.sr.unh.edu/GRANIT_Data/Vector_Data/Utilities_and_Communication/d-pipelines/pipe';

async function main(): Promise<void> {
  console.log(chalk.blue(`Loading ${url}...`));
  const collection = (await shp(url)) as FeatureCollection;

  console.log({ size: collection.features.length });

  jsome(collection.features[0]);
  jsome(collection.features[50]);
}

main();
