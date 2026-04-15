import { Link, useLocation, useSearchParams } from "react-router-dom";

const RESULTS_STORAGE_KEY = "studyspace:results";

interface StoredResults {
  location: string;
  places: unknown[];
}

function readStoredLocation(): string | null {
  try {
    const raw = sessionStorage.getItem(RESULTS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredResults;
    return typeof parsed.location === "string" && parsed.location.trim() ? parsed.location : null;
  } catch {
    return null;
  }
}

function useNavLocation(): string | null {
  const [searchParams] = useSearchParams();
  const fromUrl = searchParams.get("location");
  if (fromUrl) return fromUrl;
  return readStoredLocation();
}

const iconProps = {
  className: "bottom-nav-icon",
  viewBox: "0 0 24 24",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
  "aria-hidden": true as const,
};

function IconHome() {
  return (
    <svg {...iconProps}>
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBook() {
  return (
    <svg {...iconProps}>
      {/* Open book: flat rectangle + spine (no angled / “bent” top or bottom) */}
      <path
        d="M4 5h16v13H4zM12 5v13"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="miter"
        strokeMiterlimit={2}
        strokeLinecap="butt"
      />
    </svg>
  );
}

function IconMapPin() {
  return (
    <svg {...iconProps}>
      <path
        d="M12 21s6.5-4.2 6.5-9.5a6.5 6.5 0 1 0-13 0C5.5 16.8 12 21 12 21Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="11.5" r="2" fill="none" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg {...iconProps}>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export default function BottomNav() {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const navLocation = useNavLocation();
  const filter = searchParams.get("filter");

  const resultsBase = navLocation
    ? `/results?location=${encodeURIComponent(navLocation)}`
    : "/location";
  const mapHref = navLocation ? `/map?location=${encodeURIComponent(navLocation)}` : "/location";

  const cupActive = pathname === "/";
  const homeActive = pathname === "/location";
  const bookActive =
    (pathname === "/results" && filter !== "library") || pathname.startsWith("/place/");
  const mapActive = pathname === "/map";
  const legendActive = pathname === "/legend";

  const linkClass = (active: boolean) => `bottom-nav-link${active ? " is-active" : ""}`;

  return (
    <nav className="bottom-nav" aria-label="Main">
      <div className="bottom-nav-right">
        <Link className={linkClass(homeActive)} to="/location" aria-label="Search location">
          <IconHome />
        </Link>
        <Link className={`${linkClass(bookActive)} bottom-nav-book`} to={resultsBase} aria-label="Near you list">
          <IconBook />
        </Link>
        <Link className={linkClass(mapActive)} to={mapHref} aria-label="Map">
          <IconMapPin />
        </Link>
        <Link className={linkClass(legendActive)} to="/legend" aria-label="Color meaning legend">
          <IconPlus />
        </Link>
      </div>
    </nav>
  );
}
