import { Injectable } from 'injection-js';
import { Message } from 'serverx-ts';
import { Middleware } from 'serverx-ts';
import { Observable } from 'rxjs';

import { mapTo } from 'rxjs/operators';
import { mergeMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { tap } from 'rxjs/operators';

import bboxPolygon from '@turf/bbox-polygon';
import booleanIntersects from '@turf/boolean-intersects';
import chalk from 'chalk';

// 👇 filter over GeoJSON responses by bounding box

@Injectable()
export class GeoJSONFilter extends Middleware {
  posthandle(message$: Observable<Message>): Observable<Message> {
    return message$.pipe(
      mergeMap((message: Message): Observable<Message> => {
        const { request, response } = message;
        return of(message).pipe(
          tap(() => {
            const minX = Number(request.query.get('minX') ?? 0);
            const minY = Number(request.query.get('minY') ?? 0);
            const maxX = Number(request.query.get('maxX') ?? 0);
            const maxY = Number(request.query.get('maxY') ?? 0);
            if (
              request.path.endsWith('.geojson') &&
              response.body &&
              minX &&
              minY &&
              maxX &&
              maxY
            ) {
              const bbox = bboxPolygon([minX, minY, maxX, maxY]);
              const geojson = JSON.parse(response.body.toString());
              const before = geojson.features.length;
              const timeIn = Date.now();
              geojson.features = geojson.features.filter((feature) =>
                booleanIntersects(feature, bbox)
              );
              const after = geojson.features.length;
              console.log(
                'filter',
                `${chalk.yellow(request.path)} trimmed from ${chalk.blue(
                  before
                )} features to ${chalk.blue(after)} in ${chalk.yellow(
                  Date.now() - timeIn
                )}ms`
              );
              response.body = Buffer.from(JSON.stringify(geojson));
            }
          }),
          mapTo(message)
        );
      })
    );
  }
}
