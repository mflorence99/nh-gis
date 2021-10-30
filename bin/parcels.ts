/* eslint-disable @typescript-eslint/naming-convention */
import { Feature } from './geojson';
import { FeatureCollection } from './geojson';

import { crs } from './geojson';

import * as turf from '@turf/turf';

import { mkdirSync } from 'fs';
import { stat } from 'fs';
import { unlinkSync } from 'fs';
import { writeFileSync } from 'fs';

import chalk from 'chalk';
import hash from 'object-hash';
import polylabel from 'polylabel';
import shp from 'shpjs';

const urlByCounty = {
  BELKNAP:
    'https://ftp.granit.sr.unh.edu/ParcelMosaic/20210301_NHParcelMosaic_CountyShapefiles/Belknap_ParcelsCAMA.zip',
  CARROLL:
    'https://ftp.granit.sr.unh.edu/ParcelMosaic/20210301_NHParcelMosaic_CountyShapefiles/Carroll_ParcelsCAMA.zip',
  CHESHIRE:
    'https://ftp.granit.sr.unh.edu/ParcelMosaic/20210301_NHParcelMosaic_CountyShapefiles/Cheshire_ParcelsCAMA.zip',
  COOS: 'https://ftp.granit.sr.unh.edu/ParcelMosaic/20210301_NHParcelMosaic_CountyShapefiles/Coos_ParcelsCAMA.zip',
  GRAFTON:
    'https://ftp.granit.sr.unh.edu/ParcelMosaic/20210301_NHParcelMosaic_CountyShapefiles/Grafton_ParcelsCAMA.zip',
  HILLSBOROUGH:
    'https://ftp.granit.sr.unh.edu/ParcelMosaic/20210301_NHParcelMosaic_CountyShapefiles/Hillsborough_ParcelsCAMA.zip',
  MERRIMACK:
    'https://ftp.granit.sr.unh.edu/ParcelMosaic/20210301_NHParcelMosaic_CountyShapefiles/Merrimack_ParcelsCAMA.zip',
  ROCKINGHAM:
    'https://ftp.granit.sr.unh.edu/ParcelMosaic/20210301_NHParcelMosaic_CountyShapefiles/Rockingham_ParcelsCAMA.zip',
  STRAFFORD:
    'https://ftp.granit.sr.unh.edu/ParcelMosaic/20210301_NHParcelMosaic_CountyShapefiles/Strafford_ParcelsCAMA.zip',
  SULLIVAN:
    'https://ftp.granit.sr.unh.edu/ParcelMosaic/20210301_NHParcelMosaic_CountyShapefiles/Sullivan_ParcelsCAMA.zip'
};

const usageByClass = {
  'Apt Bldg 5+ Units': '120',
  'Commercial Condo': '260',
  'Commercial L&B': '260',
  'Commercial Land': '260',
  'Condominiumized Land Site': '130',
  'Garage/Storage Unit': '130',
  'Industrial Condo': '260',
  'Industrial L&B': '260',
  'Industrial Land': '260',
  'Mfg Housing With Land': '130',
  'Mfg Housing Without Land': '130',
  'Mixed Use Cmcl/Ind L&B': '260',
  'Mixed Use Cmcl/Ind Land': '260',
  'Mixed Use Res/Cmcl L&B': '260',
  'Mixed Use Res/Cmcl Land': '260',
  'Multi Family 2-4 Units': '120',
  'Non Res Bldg Only': '260',
  'Res Bldg Only': '130',
  'Res Condo 2-4 Unit Bldg': '120',
  'Residential Land': '190',
  'Single Family Home': '110',
  'Single Res Condo Unit': '130',
  'Unclass/Unk Imp Res': '190',
  'Unclass/Unk Land': '190',
  'Unclass/Unk Non-Res L&B': '190',
  'Unclass/Unk Other': '190'
};

const state = 'NEW HAMPSHIRE';

// 👇 no town can have more than this number of parcels
const tooManyParcels = 5000;

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

function calculateArea(feature: Feature): number {
  return turf.area(feature);
}

function calculateCenter(feature: Feature): number[] {
  // 👉 we only want the polygon's outer ring
  const points = feature.geometry.coordinates[0];
  return polylabel([points]);
}

function calculateLengths(feature: Feature): number[] {
  const lengths = [];
  // 👉 we only want the polygon's outer ring
  const points = feature.geometry.coordinates[0];
  for (let ix = 1; ix < points.length; ix++) {
    const lineString: GeoJSON.Feature = {
      geometry: {
        coordinates: [points[ix - 1], points[ix]],
        type: 'LineString'
      },
      properties: {},
      type: 'Feature'
    };
    lengths.push(turf.length(lineString) * 1000); /* 👈 meters */
  }
  return lengths;
}

function calculateMinWidth(feature: Feature, orientation: number): number {
  const rotated = turf.transformRotate(feature, -orientation);
  const [minX, minY, , maxY] = turf.bbox(rotated);
  const from = turf.point([minX, minY]);
  const to = turf.point([minX, maxY]);
  return turf.distance(from, to) * 1000; /* 👈 meters */
}

function calculateOrientation(feature: Feature): number {
  let angle = 0;
  let longest = 0;
  // 👉 we only want the polygon's outer ring
  const points = feature.geometry.coordinates[0];
  points.forEach((point, ix) => {
    if (ix > 0) {
      const p = turf.point(point);
      const q = turf.point(points[ix - 1]);
      const length = turf.distance(p, q);
      if (length > longest) {
        angle =
          p.geometry.coordinates[0] < q.geometry.coordinates[0]
            ? turf.bearing(p, q)
            : turf.bearing(q, p);
        longest = length;
      }
    }
  });
  // convert bearing to rotation
  return angle - 90;
}

function calculatePerimeter(feature: Feature): number {
  const lineString: GeoJSON.Feature = {
    geometry: {
      // 👉 we only want the polygon's outer ring
      coordinates: feature.geometry.coordinates[0],
      type: 'LineString'
    },
    properties: {},
    type: 'Feature'
  };
  return turf.length(lineString) * 1000; /* 👈 meters */
}

function makeAddress(feature: Feature): string {
  let address;
  // 👉 sometimes number, street are conveniently separated
  if (feature.properties.StreetNumb && feature.properties.StreetName) {
    address =
      `${feature.properties.StreetNumb} ${feature.properties.StreetName}`.trim();
  }
  // 👉 sometimes address is street, number
  else if (feature.properties.StreetAddr) {
    const parts = feature.properties.StreetAddr.split(',');
    address =
      parts.length > 1
        ? `${parts[1].trim()} ${parts[0]}`
        : feature.properties.StreetAddr;
  }
  // 👉 otherwise stret name is the best we have
  else address = feature.properties.StreetName;
  return address;
}

function makeID(feature: Feature): string {
  const strip0 = (str: string): string => {
    let stripped = str;
    while (stripped.length && stripped[0] === '0') stripped = stripped.slice(1);
    return stripped;
  };
  const parts = feature.properties.DisplayId.split('-')
    .map((part) => strip0(part))
    .filter((part) => part);
  return parts.join('-');
}

function normalizeAddress(address: string): string {
  let normalized = address.trim();
  normalized = normalized.replace(/\bCIR\b/, ' CIRCLE ');
  normalized = normalized.replace(/\bDR\b/, ' DRIVE ');
  normalized = normalized.replace(/\bE\b/, ' EAST ');
  normalized = normalized.replace(/\bHGTS\b/, ' HEIGHTS ');
  normalized = normalized.replace(/\bLN\b/, ' LANE ');
  normalized = normalized.replace(/\bMT\b/, ' MOUNTAIN ');
  normalized = normalized.replace(/\bN\b/, ' NORTH ');
  normalized = normalized.replace(/\bNO\b/, ' NORTH ');
  normalized = normalized.replace(/\bPD\b/, ' POND ');
  normalized = normalized.replace(/\bRD\b/, ' ROAD ');
  normalized = normalized.replace(/\bS\b/, ' SOUTH ');
  normalized = normalized.replace(/\bSO\b/, ' SOUTH ');
  normalized = normalized.replace(/\bST\b/, ' STREET ');
  normalized = normalized.replace(/\bTER\b/, ' TERRACE ');
  normalized = normalized.replace(/\bTERR\b/, ' TERRACE ');
  normalized = normalized.replace(/\bW\b/, ' WEST ');
  return normalized.replace(/  +/g, ' ').trim();
}

async function main(): Promise<void> {
  const counties = Object.keys(urlByCounty);
  for (const county of counties) {
    const url = urlByCounty[county];
    console.log(chalk.blue(`Loading ${url}...`));
    const parcels = (await shp(url)) as FeatureCollection;

    const countByTown: Record<string, number> = {};
    const dupesByTown: Record<string, Set<string>> = {};
    const parcelsByTown: Record<string, FeatureCollection> = {};

    parcels.features
      .filter((feature) => feature.properties.DisplayId)
      .forEach((feature: Feature) => {
        // 👉 SHP files have names truncated to 10 characters
        const town = (feature.properties.TownName as string)?.toUpperCase();

        // 👉 we already have Washington via legacy data
        if (town && !exclusions.includes(town)) {
          // 👉 initialize all "by town" data structures
          countByTown[town] ??= 0;
          dupesByTown[town] ??= new Set<string>();
          parcelsByTown[town] ??= {
            crs: crs,
            features: [],
            name: `${town} Parcels`,
            type: 'FeatureCollection'
          };

          // 👉 occasionally, the data is dirty in that the same feature
          //    appears more than once, but not necessarily with the same ID,
          //    so we dedupe by a hash of its geometry
          const signature = hash.MD5(feature.geometry);
          if (dupesByTown[town].has(signature)) return;
          dupesByTown[town].add(signature);

          // 👉 make all geometries look like MultiPolygons
          const coordinates =
            feature.geometry.type === 'Polygon'
              ? [feature.geometry.coordinates]
              : feature.geometry.coordinates;

          // 👉 we'll split real MultiPolygons into multiple separate
          //    parcels -- eg: one on either side of the road
          const isMulti = feature.geometry.type === 'MultiPolygon';
          for (let ix = 0; ix < coordinates.length; ix++) {
            const id = makeID(feature);

            // 👉 construct a parcel to represent this feature
            const parcel: Feature = {
              geometry: {
                coordinates: coordinates[ix],
                type: 'Polygon'
              },
              id: isMulti ? `${id}:${ix}` : id,
              properties: {
                address: normalizeAddress(makeAddress(feature)),
                area:
                  (feature.properties.Shape_Area ?? 0) /
                  43560 /* 👈 sq feet to acres */,
                building$: feature.properties.TaxBldg,
                class: feature.properties.SLUC_desc,
                county: county,
                cu$: feature.properties.TaxFeature,
                id: id,
                land$: feature.properties.TaxLand,
                numSplits: coordinates.length,
                taxed$: feature.properties.TaxTotal,
                town: town,
                usage: usageByClass[feature.properties.SLUC_desc] ?? '190'
              },
              type: 'Feature'
            };

            // 👉 we can get turf to do this once we've built the feature
            parcel.bbox = turf.bbox(parcel);
            const area = calculateArea(parcel);
            const center = calculateCenter(parcel);
            const lengths = calculateLengths(parcel);
            const orientation = calculateOrientation(parcel);
            const minWidth = calculateMinWidth(parcel, orientation);
            const perimeter = calculatePerimeter(parcel);
            const sqarcity = (area / Math.pow(perimeter, 2)) * 4 * Math.PI;

            // 👉 update parcel with calculations
            parcel.properties.areaComputed =
              area * 0.000247105; /* 👈 to acres */
            parcel.properties.center = center;
            parcel.properties.lengths = lengths.map(
              (length) => length * 3.28084
            ); /* 👈 to feet */
            parcel.properties.minWidth = minWidth * 3.28084; /* 👈 to feet */
            parcel.properties.orientation = orientation;
            parcel.properties.perimeter = perimeter * 3.28084; /* 👈 to feet */
            parcel.properties.sqarcity = sqarcity;

            // 👉 gather town's parcels together for later
            countByTown[town] += 1;
            parcelsByTown[town].features.push(parcel);
          }
        }
      });

    // 👉 one file per town with <= "tooManyLots"
    Object.keys(parcelsByTown).forEach((town) => {
      const fn = `dist/${state}/${county}/${town}/parcels.geojson`;
      if (countByTown[town] > tooManyParcels) {
        console.log(
          chalk.red(
            `... ${state}/${county}/${town}/parcels.geojson has more than ${tooManyParcels} parcels`
          )
        );
        stat(fn, (err, _stats) => {
          if (!err) unlinkSync(fn);
        });
      } else {
        console.log(
          chalk.green(`... writing ${state}/${county}/${town}/parcels.geojson`)
        );
        mkdirSync(`dist/${state}/${county}/${town}`, { recursive: true });
        writeFileSync(fn, JSON.stringify(parcelsByTown[town], null, 2));
      }
    });

    // 👉 the idea behind searchables is to provide just enough data for
    //    parcels to be searched -- we do this because we MUST have ALL
    //    the data available

    Object.keys(parcelsByTown).forEach((town) => {
      const fn = `dist/${state}/${county}/${town}/searchables.geojson`;
      if (countByTown[town] > tooManyParcels) {
        console.log(
          chalk.red(
            `... ${state}/${county}/${town}/searchables.geojson has more than ${tooManyParcels} parcels`
          )
        );
        stat(fn, (err, _stats) => {
          if (!err) unlinkSync(fn);
        });
      } else {
        console.log(
          chalk.green(
            `... writing ${state}/${county}/${town}/searchables.geojson`
          )
        );
        mkdirSync(`dist/${state}/${county}/${town}`, { recursive: true });
        // 👉 now do this again, converting the real parcels into searchables
        parcelsByTown[town].features = parcelsByTown[town].features.map(
          (feature: any): any => ({
            bbox: feature.bbox,
            properties: {
              address: feature.properties.address,
              id: feature.properties.id,
              owner: feature.properties.owner
            },
            type: 'Feature'
          })
        );
        writeFileSync(fn, JSON.stringify(parcelsByTown[town], null, 2));
      }
    });
  }
}

main();

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const sample = {
  OBJECTID: 549240,
  ParcelOID: 591063,
  Name: 'ParcelID: 62-6',
  TownID: '042',
  CountyID: '10',
  TOWN: 'CLAREMONT',
  PID: '62-6',
  OID_1: '',
  NH_GIS_ID: '10042-62-6',
  SLU: '57',
  SLUC: '57',
  SLUM: '',
  Shape_Leng: 8564.18355814,
  Shape_Area: 3768708.97914,
  IS_CIRCLE: 2,
  OBJECTID_1: 106188,
  CamaOID: 106188,
  Name_1: 'CamaID: 62-6',
  LocalNBC: '200',
  NBC: 7,
  TaxLand: 101900,
  TaxBldg: 0,
  TaxFeature: 0,
  TaxTotal: 101900,
  PrevTaxLan: 101900,
  PrevTaxBld: 0,
  PrevTaxFea: 0,
  PrevTaxTot: 101900,
  CamaYear: 2020,
  CamaVendor: 8,
  U_ID: '042-438',
  NHGIS_ID: '10042-62-6',
  RawId: '62-6',
  AltId: '10042-62-6',
  DisplayId: '62-6',
  TownId_1: '042',
  CountyId_1: '10',
  SLU_1: '57',
  SLUC_1: '57',
  SLUM_1: '',
  LocalCamaI: '438',
  Map: '62',
  MapCut: '',
  Block: '',
  BlockCut: '',
  Lot: '6',
  LotCut: '',
  Unit: '',
  UnitCut: '',
  Sub: '',
  CardCount: 0,
  StreetNumb: '',
  StreetName: 'CAT HOLE RD',
  StreetAddr: 'CAT HOLE RD',
  TownName: 'Claremont',
  CountyName: 'Sullivan',
  SLUC_desc: 'Unclass/Unk Other'
};
