import type { Place } from "../types";

/** Strip trailing US ZIP (5 or 9 digits) from a "City, ST 12345" style string. */
export function stripZipFromCityState(cityStateZip: string): string {
  return cityStateZip.replace(/\s*,?\s*\b\d{5}(?:-\d{4})?\s*$/u, "").trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Collapse to comparable tokens (lowercase, alnum only as word boundaries). */
function normalizeComparable(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Remove leading venue/POI name from OSM/Nominatim-style address strings so we don't
 * repeat the title (e.g. "Remedy Coffee, 800" → "800").
 */
export function stripDuplicateVenueFromAddress(address: string, venueName: string): string {
  const raw = address.trim();
  const name = venueName.trim();
  if (!raw || !name) return raw;

  let t = raw;
  const esc = escapeRegExp(name);
  t = t.replace(new RegExp(`^${esc}\\s*,\\s*`, "i"), "").trim();
  t = t.replace(new RegExp(`^${esc}\\s*[-–]\\s*`, "i"), "").trim();

  const nameNorm = normalizeComparable(name);
  const parts = t.split(",").map((p) => p.trim()).filter(Boolean);

  const isVenueDuplicate = (segment: string): boolean => {
    const segNorm = normalizeComparable(segment);
    if (!segNorm) return false;
    if (segNorm === nameNorm) return true;
    if (segNorm.startsWith(`${nameNorm} `)) return true;
    if (segNorm.startsWith(`${nameNorm}-`)) return true;
    return false;
  };

  while (parts.length > 0 && isVenueDuplicate(parts[0])) {
    parts.shift();
  }

  const out = parts.join(", ").trim();
  return out || raw;
}

/** One line: street address, city, state — no ZIP, no repeated venue name. */
export function placeStreetCityState(place: Pick<Place, "name" | "address" | "cityStateZip">): string {
  const cityState = stripZipFromCityState(place.cityStateZip);
  const street = stripDuplicateVenueFromAddress(place.address, place.name);
  return cityState ? `${street}, ${cityState}` : street;
}
