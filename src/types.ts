export type PlaceKind = "library" | "coffee";

export interface Place {
  id: string;
  name: string;
  address: string;
  cityStateZip: string;
  lat: number;
  lon: number;
  distanceMiles: number;
  kind: PlaceKind;
  busynessNow: number;
  popularTimes: number[];
  closingTime?: string;
}
