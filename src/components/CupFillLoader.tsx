const loadingCupOpen = "/branding/loading-cup-white.png";
const loadingSteamShape = "/branding/loading-steam-shape.png";

/** Open cup asset with animated brown steam. */
export default function CupFillLoader() {
  return (
    <div className="cup-fill-loader" role="status" aria-live="polite">
      <span className="sr-only">Searching</span>
      <div className="cup-fill-loader__visual" aria-hidden="true">
        <div className="cup-fill-loader__art">
          <span className="cup-fill-loader__steam-wisp cup-fill-loader__steam-wisp--1">
            <img className="cup-fill-loader__steam-shape" src={loadingSteamShape} alt="" decoding="async" />
          </span>
          <span className="cup-fill-loader__steam-wisp cup-fill-loader__steam-wisp--2">
            <img className="cup-fill-loader__steam-shape" src={loadingSteamShape} alt="" decoding="async" />
          </span>
          <span className="cup-fill-loader__steam-wisp cup-fill-loader__steam-wisp--3">
            <img className="cup-fill-loader__steam-shape" src={loadingSteamShape} alt="" decoding="async" />
          </span>
          <img className="cup-fill-loader__cup-image" src={loadingCupOpen} alt="" decoding="async" />
        </div>
      </div>
      <p className="cup-fill-loader__caption" aria-hidden="true">
        searching...
      </p>
    </div>
  );
}
