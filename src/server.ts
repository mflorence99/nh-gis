import { Compressor } from 'serverx-ts';
import { CORS } from 'serverx-ts';
import { FILE_SERVER_OPTS } from 'serverx-ts';
import { FileServer } from 'serverx-ts';
import { HttpApp } from 'serverx-ts';
import { REQUEST_LOGGER_OPTS } from 'serverx-ts';
import { RequestLogger } from 'serverx-ts';
import { Route } from 'serverx-ts';

import { createServer } from 'http';

import chalk from 'chalk';

const routes: Route[] = [
  {
    path: '/',
    methods: ['GET'],
    handler: FileServer,
    middlewares: [Compressor, CORS, RequestLogger],
    services: [
      { provide: REQUEST_LOGGER_OPTS, useValue: { format: 'tiny' } },
      { provide: FILE_SERVER_OPTS, useValue: { root: __dirname } }
    ]
  },
  {
    path: '/',
    methods: ['OPTIONS'],
    middlewares: [CORS, RequestLogger],
    services: [{ provide: REQUEST_LOGGER_OPTS, useValue: { format: 'tiny' } }]
  }
];

const app = new HttpApp(routes);

const listener = app.listen();
const server = createServer(listener).on('listening', () => {
  console.log(
    chalk.cyanBright(
      `NH GIS listening on port 4201 deploying from ${__dirname}`
    )
  );
});

server.listen(4201);
