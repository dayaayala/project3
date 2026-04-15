const loadingCupOpen = "/branding/loading-cup-white.png";

/** Open cup asset with animated brown steam. */
export default function CupFillLoader() {
  return (
    <div className="cup-fill-loader" role="status" aria-live="polite">
      <span className="sr-only">Searching</span>
      <div className="cup-fill-loader__visual" aria-hidden="true">
        <div className="cup-fill-loader__art">
          <svg className="cup-fill-loader__steam-svg" viewBox="0 -20 120 90" aria-hidden>
            <path
              className="cup-fill-loader__steam-line cup-fill-loader__steam-line--1"
              d="M27 62C18 50 18 37 24 28C29 22 33 19 35 16C36 22 35 28 31 34C27 40 22 47 21 55C21 59 23 61 27 62Z"
            />
            <path
              className="cup-fill-loader__steam-line cup-fill-loader__steam-line--2"
              d="M56 66C41 47 42 27 54 10C63 -2 69 -7 73 -12C75 0 73 12 67 23C60 35 50 45 47 56C46 61 49 64 56 66Z"
            />
            <path
              className="cup-fill-loader__steam-line cup-fill-loader__steam-line--3"
              d="M90 62C77 46 78 28 89 14C97 4 102 0 105 -4C107 6 105 16 99 25C94 34 86 43 83 53C82 58 85 60 90 62Z"
            />
          </svg>
          <img className="cup-fill-loader__cup-image" src={loadingCupOpen} alt="" decoding="async" />
        </div>
      </div>
      <p className="cup-fill-loader__caption" aria-hidden="true">
        searching...
      </p>
    </div>
  );
}
