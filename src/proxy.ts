import { Handler } from 'serverx-ts';
import { Injectable } from 'injection-js';
import { Message } from 'serverx-ts';
import { Observable } from 'rxjs';

import { from } from 'rxjs';
import { mapTo } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { tap } from 'rxjs';

import fetch from 'node-fetch';

// 👇 a trivial proxy server so that we can use ArcGIS etc
//    in prodfuction -- ie w/o the Webpack proxy

@Injectable()
export class ProxyServer extends Handler {
  handle(message$: Observable<Message>): Observable<Message> {
    return message$.pipe(
      mergeMap((message: Message): Observable<Message> => {
        const { request, response } = message;
        let url = request.query.get('url');
        const x = request.query.get('x');
        const y = request.query.get('y');
        const z = request.query.get('z');
        if (x && y && z) {
          url = url.replace(/\{x\}/, x);
          url = url.replace(/\{y\}/, y);
          url = url.replace(/\{z\}/, z);
        }
        return of(message).pipe(
          mergeMap(() => from(fetch(url))),
          tap((resp) => {
            const headers = resp.headers.raw();
            ['cache-control', 'last-modified', 'etag'].forEach((key) => {
              if (headers[key]) response.headers[key] = headers[key];
            });
          }),
          tap((resp) => (response.statusCode = resp.status)),
          mergeMap((resp) => from(resp.buffer())),
          tap((buffer) => (response.body = buffer)),
          mapTo(message)
        );
      })
    );
  }
}
