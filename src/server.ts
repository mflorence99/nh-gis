import { Compressor } from 'serverx-ts';
import { CORS } from 'serverx-ts';
import { FILE_SERVER_OPTS } from 'serverx-ts';
import { FileServer } from 'serverx-ts';
import { Handler } from 'serverx-ts';
import { HttpApp } from 'serverx-ts';
import { Message } from 'serverx-ts';
import { Observable } from 'rxjs';
import { REQUEST_LOGGER_OPTS } from 'serverx-ts';
import { RequestLogger } from 'serverx-ts';
import { Route } from 'serverx-ts';

import { createServer } from 'http';
import { from } from 'rxjs';
import { mapTo } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { tap } from 'rxjs';

import chalk from 'chalk';
import fetch from 'node-fetch';

class ProxyServer extends Handler {
  handle(message$: Observable<Message>): Observable<Message> {
    return message$.pipe(
      mergeMap((message: Message): Observable<Message> => {
        const { request, response } = message;
        const url = request.query.get('url');
        return of(message).pipe(
          mergeMap(() => from(fetch(url))),
          mergeMap((resp: any) => from(resp.buffer())),
          tap((buffer) => {
            response.body = buffer;
            response.statusCode = 200;
          }),
          mapTo(message)
        );
      })
    );
  }
}

const fileServerOpts = {
  provide: FILE_SERVER_OPTS,
  useValue: { root: __dirname }
};

const loggerOpts = {
  provide: REQUEST_LOGGER_OPTS,
  useValue: { format: 'tiny' }
};

const routes: Route[] = [
  {
    path: '/proxy',
    methods: ['GET'],
    handler: ProxyServer,
    middlewares: [Compressor, CORS, RequestLogger],
    services: [loggerOpts]
  },
  {
    path: '/',
    methods: ['GET'],
    handler: FileServer,
    middlewares: [Compressor, CORS, RequestLogger],
    services: [loggerOpts, fileServerOpts]
  },
  {
    path: '/',
    methods: ['OPTIONS'],
    middlewares: [CORS, RequestLogger],
    services: [loggerOpts]
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
