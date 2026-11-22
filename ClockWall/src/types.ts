export type Location = {
  name: string;
  latitude: string;
  longitude: string;
  latitudeValue: number;
  longitudeValue: number;
  sunrise: string;
  sunset: string;
  solarNoon: string;
  daylight: string;
  timeZone: string;
  daylightChange?: number;
};

export type TemperaturePoint = { date: string; temperature: number };
export type TemperatureSeries = { year: number; points: TemperaturePoint[] };
