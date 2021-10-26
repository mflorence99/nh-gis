import { copyFileSync } from 'fs';

import chalk from 'chalk';

const state = 'NEW HAMPSHIRE';

console.log(chalk.green(`... writing ${state}/boundary.geojson`));

copyFileSync(
  'assets/New_Hampshite_State_Boundary.geojson',
  `dist/${state}/boundary.geojson`
);
