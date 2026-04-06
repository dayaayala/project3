import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import PopularTimesChart from "./components/PopularTimesChart";
import { mockPlaces } from "./data/mockPlaces";
import { getNearbyPlaces } from "./lib/places";
import type { Place } from "./types";

const figmaBookLogo = "https://www.figma.com/api/mcp/asset/21382d45-7052-42e6-9e61-ba8954f441f6";
const RESULTS_STORAGE_KEY = "studyspace:results";

interface StoredResults {
  location: string;
  places: Place[];
}

function busynessWord(value: number) {
  if (value > 80) return "very busy";
  if (value > 55) return "busy";
  if (value > 30) return "moderate";
  return "not busy";
}

function statusClass(value: number) {
  if (value > 80) return "status-red";
  if (value > 55) return "status-yellow";
  return "status-green";
}

function getClosingTime(placeId: string) {
  const closingTimes: Record<string, string> = {
    "hodges-library": "12 am",
    "capybara-coffee": "8 pm",
    "honeybee-coffee": "7 pm",
    "just-love-coffee": "6 pm",
  };
  return closingTimes[placeId] ?? "9 pm";
}

function MapGlyph() {
  return (
    <svg className="map-glyph" viewBox="0 0 64 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M6 8L20 4L32 8L44 4L58 8V40L44 44L32 40L20 44L6 40V8Z" stroke="currentColor" strokeWidth="2.6" />
      <path d="M20 4V44" stroke="currentColor" strokeWidth="2.6" />
      <path d="M32 8V40" stroke="currentColor" strokeWidth="2.6" />
      <path d="M44 4V44" stroke="currentColor" strokeWidth="2.6" />
    </svg>
  );
}

function normalizeLocationKey(location: string) {
  return location.trim().toLowerCase();
}

function readStoredPlaces(location?: string): Place[] {
  try {
    const raw = sessionStorage.getItem(RESULTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredResults;
    if (!parsed || !Array.isArray(parsed.places)) return [];
    if (location && normalizeLocationKey(parsed.location) !== normalizeLocationKey(location)) return [];
    return parsed.places;
  } catch {
    return [];
  }
}

function writeStoredPlaces(location: string, places: Place[]) {
  try {
    const payload: StoredResults = { location, places };
    sessionStorage.setItem(RESULTS_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage can fail in private contexts; app still works via URL fallback.
  }
}

const heartMarkerIcon = L.divIcon({
  html: '<span class="heart-pin" aria-hidden="true">♥</span>',
  className: "heart-pin-wrap",
  iconSize: [16, 16],
  iconAnchor: [8, 10],
  popupAnchor: [0, -8],
});

function SplashPage() {
  return (
    <main className="phone splash-screen">
      <div className="splash-center">
        <div className="book-logo-frame" aria-hidden="true">
          <img className="book-logo-sprite" src={figmaBookLogo} alt="" />
        </div>
        <h1 className="title splash-title">studyspace</h1>
        <Link className="start-btn" to="/location">
          start
        </Link>
      </div>
    </main>
  );
}

function LocationPage() {
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async () => {
    if (!location.trim()) return;
    setLoading(true);
    // Navigate immediately; results page will fetch data.
    navigate(`/results?location=${encodeURIComponent(location.trim())}&t=${Date.now()}`);
    setLoading(false);
  };

  return (
    <main className="phone location-screen">
      <p className="location-title">where are you?</p>
      <div className="location-search">
        <input
          placeholder="search (ex. Knoxville, TN)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
        <button className="location-search-icon" onClick={submit} disabled={loading} aria-label="Search locations">
          <span />
        </button>
      </div>
      {loading ? <p className="searching-text">searching...</p> : null}
    </main>
  );
}

function ResultsPage() {
  const [activeFilter, setActiveFilter] = useState<"all" | "coffee" | "library">("all");
  const [searchParams] = useSearchParams();
  const queryKey = searchParams.toString();
  const location = searchParams.get("location") ?? "your city";
  const placesRaw = searchParams.get("data");
  const parsedPlaces: Place[] = useMemo(() => {
    const stored = readStoredPlaces(location);
    if (stored.length) return stored;
    if (!placesRaw) return [];
    try {
      return JSON.parse(decodeURIComponent(placesRaw)) as Place[];
    } catch {
      return [];
    }
  }, [placesRaw, queryKey]);
  const [places, setPlaces] = useState<Place[]>(parsedPlaces);
  const [loadingResults, setLoadingResults] = useState(false);

  useEffect(() => {
    setPlaces(parsedPlaces);
  }, [parsedPlaces]);

  useEffect(() => {
    writeStoredPlaces(location, places);
  }, [location, places]);

  useEffect(() => {
    let cancelled = false;
    setLoadingResults(true);
    getNearbyPlaces(location)
      .then((latest) => {
        if (!cancelled) setPlaces(latest);
      })
      .catch(() => {
        if (!cancelled) setPlaces([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingResults(false);
      });

    return () => {
      cancelled = true;
    };
  }, [location]);

  const filteredPlaces = useMemo(() => {
    if (activeFilter === "all") return places;
    return places.filter((place) => place.kind === activeFilter);
  }, [places, activeFilter]);

  return (
    <main className="phone results-screen">
      <Link className="results-top-logo" to="/location" aria-label="Back to location">
        <div className="book-logo-frame results-logo-frame" aria-hidden="true">
          <img className="book-logo-sprite" src={figmaBookLogo} alt="" />
        </div>
      </Link>
      <h2 className="results-title">near you</h2>
      <div className="results-filters" role="tablist" aria-label="Place type filters">
        <button
          className={`filter-chip ${activeFilter === "all" ? "active" : ""}`}
          onClick={() => setActiveFilter("all")}
          type="button"
        >
          all
        </button>
        <button
          className={`filter-chip ${activeFilter === "coffee" ? "active" : ""}`}
          onClick={() => setActiveFilter("coffee")}
          type="button"
        >
          coffee
        </button>
        <button
          className={`filter-chip ${activeFilter === "library" ? "active" : ""}`}
          onClick={() => setActiveFilter("library")}
          type="button"
        >
          libraries
        </button>
      </div>
      <div className="card-list results-scroll">
        {loadingResults ? <p className="empty-results">searching...</p> : null}
        {!loadingResults && filteredPlaces.length === 0 ? (
          <p className="empty-results">No nearby places found for this location yet.</p>
        ) : (
          filteredPlaces.map((place) => (
            <Link
              key={place.id}
              className="place-card"
            to={`/place/${place.id}?location=${encodeURIComponent(location)}`}
            >
              <div>
                <strong>{place.name.toLowerCase()}</strong>
                <p>
                  {place.address}
                  <br />
                  {place.cityStateZip}
                  <br />
                  {place.distanceMiles.toFixed(1)} mi
                </p>
              </div>
              <span className={`dot ${statusClass(place.busynessNow)}`} />
            </Link>
          ))
        )}
      </div>
      <Link
        className="results-map-icon"
        to={`/map?location=${encodeURIComponent(location)}`}
        aria-label="Open map view"
      >
        <MapGlyph />
      </Link>
    </main>
  );
}

function PlacePage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const queryKey = searchParams.toString();
  const location = searchParams.get("location") ?? "your city";
  const placesRaw = searchParams.get("data");
  const places: Place[] = useMemo(() => {
    const stored = readStoredPlaces(location);
    if (stored.length) return stored;
    if (!placesRaw) return [];
    try {
      return JSON.parse(decodeURIComponent(placesRaw)) as Place[];
    } catch {
      return [];
    }
  }, [placesRaw, queryKey]);
  const place = places.find((p) => p.id === id);
  if (!place) return <Navigate to="/results" replace />;
  const closingTime = place.closingTime ?? getClosingTime(place.id);

  return (
    <main className="phone detail-screen">
      <Link className="detail-back" to={`/results?location=${encodeURIComponent(location)}`}>
        back
      </Link>
      <article className="detail-card">
        <header>
          <h3>{place.name.toLowerCase()}</h3>
          <span className={`dot ${statusClass(place.busynessNow)}`} />
        </header>
        <p>
          {place.address}
          <br />
          {place.cityStateZip}
        </p>
        <PopularTimesChart values={place.popularTimes} />
        <p className="status">
          {place.name} is currently {busynessWord(place.busynessNow)}. It closes at {closingTime}.
        </p>
      </article>
      <Link
        className="results-map-icon detail-map-icon"
        to={`/map?location=${encodeURIComponent(location)}`}
        aria-label="Open map view"
      >
        <MapGlyph />
      </Link>
    </main>
  );
}

function MapPage() {
  const [searchParams] = useSearchParams();
  const queryKey = searchParams.toString();
  const location = searchParams.get("location") ?? "your city";
  const placesRaw = searchParams.get("data");
  const places: Place[] = useMemo(() => {
    const stored = readStoredPlaces(location);
    if (stored.length) return stored;
    if (!placesRaw) return [];
    try {
      return JSON.parse(decodeURIComponent(placesRaw)) as Place[];
    } catch {
      return [];
    }
  }, [placesRaw, queryKey, location]);
  const center = places.length ? ([places[0].lat, places[0].lon] as [number, number]) : ([35.96, -83.92] as [number, number]);

  return (
    <main className="phone wide">
      <div className="map-header">
        <h2>map view</h2>
        <Link to={`/results?${searchParams.toString()}`}>back to list</Link>
      </div>
      <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors &copy; CARTO'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        {places.map((place) => (
          <Marker key={place.id} position={[place.lat, place.lon]} icon={heartMarkerIcon}>
            <Popup>
              <strong>{place.name}</strong>
              <br />
              {place.address}
              <br />
              {busynessWord(place.busynessNow)}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<SplashPage />} />
      <Route path="/location" element={<LocationPage />} />
      <Route path="/results" element={<ResultsPage />} />
      <Route path="/place/:id" element={<PlacePage />} />
      <Route path="/map" element={<MapPage />} />
    </Routes>
  );
}
