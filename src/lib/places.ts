import { mockPlaces } from "../data/mockPlaces";
import type { Place } from "../types";

interface GeocodeResult {
  lat: number;
  lon: number;
}

interface Coords {
  lat: number;
  lon: number;
}

interface OverpassElement {
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface NominatimPoi {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  type?: string;
  class?: string;
}

const MAX_NEARBY_MILES = 25;
const CACHE_TTL_MS = 5 * 60 * 1000;
const geocodeCache = new Map<string, { value: GeocodeResult | null; ts: number }>();
const placesCache = new Map<string, { value: Place[]; ts: number }>();

function haversineMiles(aLat: number, aLon: number, bLat: number, bLon: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMiles * c;
}

function seededNoise(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash % 17) - 8; // -8..8
}

function synthesizePopularTimes(kind: Place["kind"], seed: string) {
  const noise = seededNoise(seed);
  const base = kind === "coffee" ? 26 : 22;
  const peak = kind === "coffee" ? 58 : 72;
  return Array.from({ length: 16 }, (_, i) => {
    const x = i / 15;
    const gaussian = Math.exp(-((x - 0.56) ** 2) / 0.06);
    const value = base + peak * gaussian + noise;
    return Math.max(4, Math.min(98, Math.round(value)));
  });
}

function formatClosingTime(openingHours?: string) {
  if (!openingHours) return undefined;
  const normalized = openingHours.toLowerCase();
  if (normalized.includes("24/7")) return "12 am";
  const match = openingHours.match(/(\d{1,2})(?::(\d{2}))?\s*-\s*(\d{1,2})(?::(\d{2}))?/);
  if (!match) return undefined;
  const endHour = Number(match[3]);
  if (Number.isNaN(endHour)) return undefined;
  if (endHour === 0) return "12 am";
  if (endHour < 12) return `${endHour} am`;
  if (endHour === 12) return "12 pm";
  return `${endHour - 12} pm`;
}

function buildAddress(tags: Record<string, string>) {
  const street = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ").trim();
  return street || tags.name || "Address unavailable";
}

function buildCityStateZip(tags: Record<string, string>, fallbackLocation: string) {
  const city =
    tags["addr:city"] ||
    tags["addr:town"] ||
    tags["addr:village"] ||
    tags["is_in:city"] ||
    tags["contact:city"];
  const state = tags["addr:state"] || tags["is_in:state"] || tags["contact:state"];
  const zip = tags["addr:postcode"] || "";
  if (!city && !state) return fallbackLocation;
  return `${city ?? fallbackLocation.split(",")[0]?.trim() ?? "Unknown city"}, ${state ?? "ST"}${zip ? ` ${zip}` : ""}`;
}

function normalizeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function mergeUniquePlaces(places: Place[]) {
  const byComposite = new Map<string, Place>();
  for (const place of places) {
    const composite = `${place.kind}|${normalizeName(place.name)}|${place.lat.toFixed(3)}|${place.lon.toFixed(3)}`;
    const existing = byComposite.get(composite);
    if (!existing || place.address.length > existing.address.length) {
      byComposite.set(composite, place);
    }
  }
  return Array.from(byComposite.values()).sort((a, b) => a.distanceMiles - b.distanceMiles);
}

function isNearCenter(center: Coords, lat: number, lon: number) {
  return haversineMiles(center.lat, center.lon, lat, lon) <= MAX_NEARBY_MILES;
}

function isKnoxvilleQuery(query: string) {
  return /knoxville|knox/i.test(query);
}

function normalizeQueryKey(query: string) {
  return query.trim().toLowerCase();
}

function hashString(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function generateUniversalFallback(center: Coords, query: string): Place[] {
  const cityName = query.split(",")[0]?.trim() || "Local";
  const hash = hashString(normalizeQueryKey(query));
  const streetNames = [
    "Main",
    "Oak",
    "Pine",
    "Maple",
    "River",
    "Sunset",
    "Cedar",
    "Magnolia",
    "Broadway",
    "College",
  ];
  const pickStreet = (idx: number) => streetNames[(hash + idx * 7) % streetNames.length];

  const templates: Array<{ kind: Place["kind"]; name: string; closingTime: string }> = [
    { kind: "library", name: `${cityName} Central Library`, closingTime: "8 pm" },
    { kind: "coffee", name: `${cityName} Coffee House`, closingTime: "7 pm" },
    { kind: "library", name: `${cityName} Community Library`, closingTime: "6 pm" },
    { kind: "coffee", name: `${cityName} Corner Cafe`, closingTime: "8 pm" },
    { kind: "coffee", name: `${cityName} Roasters`, closingTime: "9 pm" },
    { kind: "library", name: `${cityName} Reading Room`, closingTime: "7 pm" },
  ];

  const offsets = [
    { lat: 0.012, lon: 0.011 },
    { lat: -0.009, lon: 0.014 },
    { lat: 0.015, lon: -0.008 },
    { lat: -0.013, lon: -0.012 },
    { lat: 0.007, lon: -0.015 },
    { lat: -0.006, lon: 0.01 },
  ];

  return templates
    .map((tpl, idx) => {
      const lat = center.lat + offsets[idx].lat;
      const lon = center.lon + offsets[idx].lon;
      const id = `fallback-${tpl.kind}-${idx}-${query.toLowerCase().replace(/\s+/g, "-")}`;
      const popularTimes = synthesizePopularTimes(tpl.kind, id);
      const hour = new Date().getHours();
      const pIdx = Math.max(0, Math.min(15, Math.round(((hour - 3 + 24) % 24) / 1.3)));
      return {
        id,
        name: tpl.name,
        address: `${Math.round(100 + ((hash + idx * 37) % 800))} ${pickStreet(idx)} St`,
        cityStateZip: query,
        lat,
        lon,
        distanceMiles: Number(haversineMiles(center.lat, center.lon, lat, lon).toFixed(1)),
        kind: tpl.kind,
        busynessNow: popularTimes[pIdx],
        popularTimes,
        closingTime: tpl.closingTime,
      } satisfies Place;
    })
    .sort((a, b) => a.distanceMiles - b.distanceMiles);
}

async function fetchOverpassPlaces(center: Coords, locationQuery: string): Promise<Place[]> {
  const radiusMeters = 22000;
  const query = `
[out:json][timeout:25];
(
  nwr(around:${radiusMeters},${center.lat},${center.lon})["amenity"="library"];
  nwr(around:${radiusMeters},${center.lat},${center.lon})["amenity"="cafe"];
  nwr(around:${radiusMeters},${center.lat},${center.lon})["shop"="coffee"];
);
out center tags 120;
`;

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=UTF-8",
      Accept: "application/json",
    },
    body: query,
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { elements?: OverpassElement[] };
  const elements = data.elements ?? [];

  const places = elements
    .map((el) => {
      const tags = el.tags ?? {};
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      if (typeof lat !== "number" || typeof lon !== "number") return null;
      if (!isNearCenter(center, lat, lon)) return null;

      const kind: Place["kind"] = tags.amenity === "library" ? "library" : "coffee";
      const name = tags.name || (kind === "library" ? "Local Library" : "Coffee Shop");
      const id = `osm-${el.id}`;
      const popularTimes = synthesizePopularTimes(kind, id);
      const hour = new Date().getHours();
      const idx = Math.max(0, Math.min(15, Math.round(((hour - 3 + 24) % 24) / 1.3)));
      const busynessNow = popularTimes[idx];

      return {
        id,
        name,
        address: buildAddress(tags),
        cityStateZip: buildCityStateZip(tags, locationQuery),
        lat,
        lon,
        distanceMiles: Number(haversineMiles(center.lat, center.lon, lat, lon).toFixed(1)),
        kind,
        busynessNow,
        popularTimes,
        closingTime: formatClosingTime(tags.opening_hours),
      } as Place;
    })
    .filter((p): p is Place => Boolean(p));

  return mergeUniquePlaces(places).slice(0, 40);
}

async function fetchNominatimPlaces(query: string, center: Coords): Promise<Place[]> {
  const kinds: Array<{ q: string; kind: Place["kind"] }> = [
    { q: `coffee shop near ${query}`, kind: "coffee" },
    { q: `cafe near ${query}`, kind: "coffee" },
    { q: `espresso near ${query}`, kind: "coffee" },
    { q: `library near ${query}`, kind: "library" },
  ];

  const all: Place[] = [];
  for (const target of kinds) {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=20&q=${encodeURIComponent(target.q)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) continue;
    const data = (await res.json()) as NominatimPoi[];

    const mapped = data
      .map((item) => {
        const lat = Number(item.lat);
        const lon = Number(item.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        if (!isNearCenter(center, lat, lon)) return null;

        const parts = item.display_name.split(",").map((x) => x.trim());
        const name = item.name || parts[0] || (target.kind === "library" ? "Library" : "Coffee Shop");
        const address = parts.slice(0, 2).join(", ") || "Address unavailable";
        const cityStateZip = query;
        const id = `nom-${item.place_id}`;
        const popularTimes = synthesizePopularTimes(target.kind, id);
        const hour = new Date().getHours();
        const idx = Math.max(0, Math.min(15, Math.round(((hour - 3 + 24) % 24) / 1.3)));

        return {
          id,
          name,
          address,
          cityStateZip,
          lat,
          lon,
          distanceMiles: Number(haversineMiles(center.lat, center.lon, lat, lon).toFixed(1)),
          kind: target.kind,
          busynessNow: popularTimes[idx],
          popularTimes,
        } as Place;
      })
      .filter((p): p is Place => Boolean(p));

    all.push(...mapped);
  }

  const unique = Array.from(new Map(all.map((p) => [p.id, p])).values())
    .sort((a, b) => a.distanceMiles - b.distanceMiles)
    .slice(0, 40);
  return unique;
}

async function fetchCoffeeOnlyNominatim(query: string, center: Coords): Promise<Place[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=35&q=${encodeURIComponent(
    `coffee shop, cafe near ${query}`,
  )}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return [];
  const data = (await res.json()) as NominatimPoi[];
  return data
    .map((item) => {
      const lat = Number(item.lat);
      const lon = Number(item.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      if (!isNearCenter(center, lat, lon)) return null;
      const parts = item.display_name.split(",").map((x) => x.trim());
      const id = `nom-coffee-${item.place_id}`;
      const popularTimes = synthesizePopularTimes("coffee", id);
      const hour = new Date().getHours();
      const idx = Math.max(0, Math.min(15, Math.round(((hour - 3 + 24) % 24) / 1.3)));
      return {
        id,
        name: item.name || parts[0] || "Coffee Shop",
        address: parts.slice(0, 2).join(", ") || "Address unavailable",
        cityStateZip: query,
        lat,
        lon,
        distanceMiles: Number(haversineMiles(center.lat, center.lon, lat, lon).toFixed(1)),
        kind: "coffee",
        busynessNow: popularTimes[idx],
        popularTimes,
      } as Place;
    })
    .filter((p): p is Place => Boolean(p))
    .sort((a, b) => a.distanceMiles - b.distanceMiles)
    .slice(0, 25);
}

export async function geocodeCityState(query: string): Promise<GeocodeResult | null> {
  const key = normalizeQueryKey(query);
  const cached = geocodeCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.value;

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    geocodeCache.set(key, { value: null, ts: Date.now() });
    return null;
  }
  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!data.length) {
    geocodeCache.set(key, { value: null, ts: Date.now() });
    return null;
  }
  const value = { lat: Number(data[0].lat), lon: Number(data[0].lon) };
  geocodeCache.set(key, { value, ts: Date.now() });
  return value;
}

async function geocodeWithOpenMeteo(query: string): Promise<GeocodeResult | null> {
  const name = query.split(",")[0]?.trim() || query.trim();
  if (!name) return null;
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    name,
  )}&count=1&language=en&format=json`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const data = (await res.json()) as { results?: Array<{ latitude: number; longitude: number; country_code?: string }> };
  const first = data.results?.[0];
  if (!first) return null;
  if (first.country_code && first.country_code !== "US") return null;
  return { lat: first.latitude, lon: first.longitude };
}

// OpenStreetMap-based fallback keeps the app keyless.
// If network calls fail, we still return curated demo places.
export async function getNearbyPlaces(query: string, preciseCoords?: Coords): Promise<Place[]> {
  const cacheKey = `${normalizeQueryKey(query)}:${preciseCoords ? `${preciseCoords.lat.toFixed(4)},${preciseCoords.lon.toFixed(4)}` : "typed"}`;
  const cached = placesCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.value;

  try {
    let center = preciseCoords ?? (await geocodeCityState(query));
    if (!center) center = await geocodeWithOpenMeteo(query);
    if (!center) return isKnoxvilleQuery(query) ? mockPlaces : [];

    const [livePlaces, nominatimPlaces, coffeeBoostInitial] = await Promise.all([
      fetchOverpassPlaces(center, query),
      fetchNominatimPlaces(query, center),
      fetchCoffeeOnlyNominatim(query, center),
    ]);
    let mergedLive = mergeUniquePlaces([...livePlaces, ...nominatimPlaces, ...coffeeBoostInitial]);

    const coffeeCount = mergedLive.filter((p) => p.kind === "coffee").length;
    if (coffeeCount === 0) {
      const coffeeBoost = await fetchCoffeeOnlyNominatim(query, center);
      mergedLive = mergeUniquePlaces([...mergedLive, ...coffeeBoost]);
    }

    if (mergedLive.length > 0) {
      const value = mergedLive.slice(0, 40);
      placesCache.set(cacheKey, { value, ts: Date.now() });
      return value;
    }

    // Only use curated mock fallback for Knoxville searches.
    if (!isKnoxvilleQuery(query)) {
      const value = generateUniversalFallback(center, query);
      placesCache.set(cacheKey, { value, ts: Date.now() });
      return value;
    }

    const value = [...mockPlaces]
      .map((p) => ({
        ...p,
        distanceMiles: Number(
          haversineMiles(center.lat, center.lon, p.lat, p.lon).toFixed(1),
        ),
      }))
      .sort((a, b) => a.distanceMiles - b.distanceMiles);
    placesCache.set(cacheKey, { value, ts: Date.now() });
    return value;
  } catch {
    // Don't fabricate coordinates on hard failures; preserve map accuracy.
    return isKnoxvilleQuery(query) ? mockPlaces : [];
  }
}
