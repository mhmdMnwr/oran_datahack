/**
 * Shared hive data — used by both 3D farm and map views.
 * Coordinates are near Oran, Algeria.
 */
const HIVE_DATA = [
  { id: 1,  name: 'Alpha',   fill: 0.92, temp: 35, lat: 35.7020, lng: -0.6300 },
  { id: 2,  name: 'Bravo',   fill: 0.78, temp: 33, lat: 35.7035, lng: -0.6280 },
  { id: 3,  name: 'Charlie', fill: 0.65, temp: 36, lat: 35.7010, lng: -0.6260 },
  { id: 4,  name: 'Delta',   fill: 0.41, temp: 31, lat: 35.7045, lng: -0.6320 },
  { id: 5,  name: 'Echo',    fill: 0.87, temp: 34, lat: 35.7000, lng: -0.6340 },
  { id: 6,  name: 'Foxtrot', fill: 0.53, temp: 38, lat: 35.7055, lng: -0.6295 },
  { id: 7,  name: 'Golf',    fill: 0.19, temp: 29, lat: 35.6990, lng: -0.6310 },
  { id: 8,  name: 'Hotel',   fill: 0.72, temp: 35, lat: 35.7030, lng: -0.6350 },
  { id: 9,  name: 'India',   fill: 0.34, temp: 32, lat: 35.7060, lng: -0.6270 },
  { id: 10, name: 'Juliet',  fill: 0.96, temp: 37, lat: 35.6985, lng: -0.6285 },
];

const isProblematic = (fill) => fill < 0.5;

export { HIVE_DATA, isProblematic };
