import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from "react-leaflet";
import CupFillLoader from "./components/CupFillLoader";
import BottomNav from "./components/BottomNav";
import PopularTimesChart from "./components/PopularTimesChart";
import { placeStreetCityState } from "./lib/formatPlace";
import { getNearbyPlaces } from "./lib/places";
import type { Place } from "./types";

const splashMugMark = "/branding/splash-mug.png";
const splashArrowMark = "/branding/splash-arrow.png";
const backArrowMark = "/branding/back-arrow.png";
const locationQuestionMark = "/branding/location-question.png";
const filterPlusMark = "/branding/filter-plus.png";
const filterXMark = "/branding/filter-x.png";
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

function deviceMapsHref(place: Pick<Place, "name" | "lat" | "lon">) {
  const q = encodeURIComponent(place.name);
  return `https://maps.apple.com/?q=${q}&ll=${place.lat},${place.lon}`;
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

function ZoomResponsiveHeartMarkers({ places }: { places: Place[] }) {
  const [zoom, setZoom] = useState(13);
  useMapEvents({
    zoomend(event) {
      setZoom(event.target.getZoom());
    },
  });

  const size = Math.max(12, Math.min(24, Math.round(zoom * 1.1)));
  const icons = useMemo(() => {
    const mk = (status: "green" | "yellow" | "red") =>
      L.divIcon({
        html: `<span class="heart-pin heart-pin--${status}" style="width:${size}px;height:${size}px" aria-hidden="true"></span>`,
        className: "heart-pin-wrap",
        iconSize: [size + 4, size + 4],
        iconAnchor: [Math.round((size + 4) / 2), Math.round(size * 0.7)],
        popupAnchor: [0, -Math.round(size * 0.4)],
      });
    return {
      green: mk("green"),
      yellow: mk("yellow"),
      red: mk("red"),
    } as const;
  }, [size]);

  return (
    <>
      {places.map((place) => {
        const status = statusClass(place.busynessNow).replace("status-", "") as "green" | "yellow" | "red";
        return (
          <Marker key={place.id} position={[place.lat, place.lon]} icon={icons[status]}>
            <Popup>
              <strong>{place.name}</strong>
              <br />
              <a
                className="map-popup-address-link"
                href={deviceMapsHref(place)}
                target="_blank"
                rel="noreferrer"
              >
                {placeStreetCityState(place)}
              </a>
              <br />
              {busynessWord(place.busynessNow)}
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

function SplashPage() {
  return (
    <main className="phone splash-screen">
      <div className="splash-center">
        <h1 className="sr-only">The Quiet Cup</h1>
        <div className="splash-brand-lockup" aria-hidden="true">
          <img className="splash-mug-mark" src={splashMugMark} alt="" decoding="async" />
          <p className="splash-word-stack">
            The
            <br />
            Quiet
            <br />
            Cup
          </p>
        </div>
        <Link className="splash-arrow-btn" to="/location" aria-label="Start">
          <img className="splash-arrow-mark" src={splashArrowMark} alt="" decoding="async" />
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
    <main className={`phone location-screen${loading ? " location-screen--loading" : ""}`}>
      {loading ? (
        <CupFillLoader />
      ) : (
        <>
          <p className="sr-only">Where are you?</p>
          <div className="location-title-wrap" aria-hidden="true">
            <p className="location-title">Where are you</p>
            <img className="location-title-question" src={locationQuestionMark} alt="" decoding="async" />
          </div>
          <div className="location-search">
            <input
              placeholder="search (ex. Knoxville, TN)"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
            <button className="location-search-icon" type="button" onClick={submit} disabled={loading} aria-label="Search locations">
              <svg className="location-search-glyph" viewBox="0 0 24 24" width="20" height="20" aria-hidden>
                <circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" strokeWidth="1.75" />
                <path
                  d="M14.2 14.2L19 19"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </>
      )}
    </main>
  );
}

function ResultsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filterParam = searchParams.get("filter");
  const activeFilter: "all" | "coffee" | "library" =
    filterParam === "library" || filterParam === "coffee" ? filterParam : "all";

  const setActiveFilter = (next: "all" | "coffee" | "library") => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (next === "all") p.delete("filter");
        else p.set("filter", next);
        return p;
      },
      { replace: true },
    );
  };

  const circleParam = searchParams.get("circle");
  const circleFilter: "all" | "green" | "yellow" | "red" =
    circleParam === "green" || circleParam === "yellow" || circleParam === "red" ? circleParam : "all";

  const toggleCircleFilter = (c: "green" | "yellow" | "red") => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        const current = p.get("circle");
        if (current === c) p.delete("circle");
        else p.set("circle", c);
        return p;
      },
      { replace: true },
    );
  };

  const clearCircleFilter = () => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.delete("circle");
        return p;
      },
      { replace: true },
    );
  };

  const [busyColorMenuOpen, setBusyColorMenuOpen] = useState(false);
  const busyColorMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!busyColorMenuOpen) return;
    const close = () => setBusyColorMenuOpen(false);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);

    let removeClick: (() => void) | undefined;
    const attachId = window.setTimeout(() => {
      const onDocClick = (e: MouseEvent) => {
        const el = busyColorMenuRef.current;
        const t = e.target;
        if (el && t instanceof Node && !el.contains(t)) close();
      };
      document.addEventListener("click", onDocClick);
      removeClick = () => document.removeEventListener("click", onDocClick);
    }, 0);

    return () => {
      clearTimeout(attachId);
      removeClick?.();
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [busyColorMenuOpen]);

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
    const requestPreciseCoords = () =>
      new Promise<{ lat: number; lon: number } | null>((resolve) => {
        if (!("geolocation" in navigator)) {
          resolve(null);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (position) =>
            resolve({
              lat: position.coords.latitude,
              lon: position.coords.longitude,
            }),
          () => resolve(null),
          {
            enableHighAccuracy: true,
            timeout: 7000,
            maximumAge: 120000,
          },
        );
      });

    Promise.all([getNearbyPlaces(location), requestPreciseCoords()])
      .then(async ([baseResults, precise]) => {
        if (cancelled) return;
        if (!precise) {
          setPlaces(baseResults);
          return;
        }
        const preciseResults = await getNearbyPlaces(location, precise);
        if (!cancelled) setPlaces(preciseResults);
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
    let list = activeFilter === "all" ? places : places.filter((place) => place.kind === activeFilter);
    if (circleFilter !== "all") {
      const want = `status-${circleFilter}`;
      list = list.filter((place) => statusClass(place.busynessNow) === want);
    }
    return list;
  }, [places, activeFilter, circleFilter]);

  return (
    <main className={`phone results-screen${loadingResults ? " results-screen--loading" : ""}`}>
      {loadingResults ? (
        <CupFillLoader />
      ) : (
        <>
          <h2 className="results-title headline-signature">Near you</h2>
          <div className="results-filters-section">
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
              <div className="busy-color-dropdown" ref={busyColorMenuRef}>
                <button
                  type="button"
                  className="busy-color-dropdown__trigger"
                  aria-expanded={busyColorMenuOpen}
                  aria-haspopup="listbox"
                  aria-label="Busy level filter"
                  onClick={() => setBusyColorMenuOpen((o) => !o)}
                >
                  <img
                    className="busy-color-dropdown__trigger-icon"
                    src={busyColorMenuOpen ? filterXMark : filterPlusMark}
                    alt=""
                    aria-hidden
                    decoding="async"
                  />
                </button>
                {busyColorMenuOpen ? (
                  <div
                    className={`busy-color-dropdown__menu${circleFilter !== "all" ? " busy-color-dropdown__menu--filtered" : ""}`}
                    role="listbox"
                    aria-label="Filter by busy level"
                  >
                    <button
                      type="button"
                      role="option"
                      aria-selected={circleFilter === "all"}
                      className="busy-color-clear"
                      onClick={() => {
                        clearCircleFilter();
                        setBusyColorMenuOpen(false);
                      }}
                    >
                      any
                    </button>
                    <button
                      type="button"
                      role="option"
                      aria-selected={circleFilter === "green"}
                      className={`busy-pill busy-pill--green${circleFilter === "green" ? " busy-pill--active" : ""}`}
                      onClick={() => {
                        toggleCircleFilter("green");
                        setBusyColorMenuOpen(false);
                      }}
                    >
                      <span className="sr-only">Not busy</span>
                    </button>
                    <button
                      type="button"
                      role="option"
                      aria-selected={circleFilter === "yellow"}
                      className={`busy-pill busy-pill--yellow${circleFilter === "yellow" ? " busy-pill--active" : ""}`}
                      onClick={() => {
                        toggleCircleFilter("yellow");
                        setBusyColorMenuOpen(false);
                      }}
                    >
                      <span className="sr-only">Busy</span>
                    </button>
                    <button
                      type="button"
                      role="option"
                      aria-selected={circleFilter === "red"}
                      className={`busy-pill busy-pill--red${circleFilter === "red" ? " busy-pill--active" : ""}`}
                      onClick={() => {
                        toggleCircleFilter("red");
                        setBusyColorMenuOpen(false);
                      }}
                    >
                      <span className="sr-only">Very busy</span>
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          <div className="card-list results-scroll">
            {filteredPlaces.length === 0 ? (
              <p className="empty-results">
                {places.length === 0
                  ? "No nearby places found for this location yet."
                  : "No places match these filters."}
              </p>
            ) : (
              filteredPlaces.map((place) => (
                <Link
                  key={place.id}
                  className={`place-card ${statusClass(place.busynessNow)}`}
                  to={`/place/${place.id}?location=${encodeURIComponent(location)}`}
                >
                  <div>
                    <strong>{place.name.toLowerCase()}</strong>
                    <p>
                      {placeStreetCityState(place)}
                      <br />
                      {place.distanceMiles.toFixed(1)} mi
                    </p>
                  </div>
                  <span className={`dot ${statusClass(place.busynessNow)}`} />
                </Link>
              ))
            )}
          </div>
        </>
      )}
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
  if (!place) {
    const fallback =
      location && location !== "your city"
        ? `/results?location=${encodeURIComponent(location)}`
        : "/location";
    return <Navigate to={fallback} replace />;
  }
  const closingTime = place.closingTime ?? getClosingTime(place.id);

  return (
    <main className="phone detail-screen">
      <Link className="detail-back" to={`/results?location=${encodeURIComponent(location)}`}>
        <img className="detail-back-arrow" src={backArrowMark} alt="Back" decoding="async" />
      </Link>
      <article className="detail-card">
        <header>
          <h3>{place.name.toLowerCase()}</h3>
          <span className={`dot ${statusClass(place.busynessNow)}`} />
        </header>
        <p>{placeStreetCityState(place)}</p>
        <PopularTimesChart values={place.popularTimes} />
        <p className="status">
          {place.name} is currently {busynessWord(place.busynessNow)}. It closes at {closingTime}.
        </p>
      </article>
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
        <h2 className="headline-signature">Map view</h2>
      </div>
      <MapContainer className="map-canvas" center={center} zoom={13} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors &copy; CARTO'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        <ZoomResponsiveHeartMarkers places={places} />
      </MapContainer>
    </main>
  );
}

function LegendPage() {
  return (
    <main className="phone legend-screen">
      <article className="legend-card">
        <h2 className="headline-signature">Key</h2>
        <div className="legend-list" role="list" aria-label="Place busyness color legend">
          <p className="legend-item" role="listitem">
            <span className="dot status-green legend-dot" />
            <span>green = quiet</span>
          </p>
          <p className="legend-item" role="listitem">
            <span className="dot status-yellow legend-dot" />
            <span>yellow = moderate</span>
          </p>
          <p className="legend-item" role="listitem">
            <span className="dot status-red legend-dot" />
            <span>red = busy</span>
          </p>
        </div>
      </article>
    </main>
  );
}

function AppShell() {
  const { pathname } = useLocation();
  const showBottomNav = pathname !== "/location";
  return (
    <div className="phone-with-nav">
      <Outlet />
      {showBottomNav ? <BottomNav /> : null}
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<SplashPage />} />
      <Route element={<AppShell />}>
        <Route path="/location" element={<LocationPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/place/:id" element={<PlacePage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/legend" element={<LegendPage />} />
      </Route>
    </Routes>
  );
}
