# StudySpace (Figma-based App)

StudySpace is a small mobile-style web app based on your Figma concept:
- user enters location in `City, ST` format
- app shows nearby coffee shops and libraries
- each place has a popularity ("busy") chart
- map screen shows all places near the user

## Run locally

```bash
npm install
npm run dev
```

Then open the local Vite URL.

## Build

```bash
npm run build
```

## Notes on data

- The app geocodes the typed city/state with OpenStreetMap (`nominatim`).
- Nearby results are currently based on a curated set of places (with distance re-ranked by the selected location), so you can demo the full UX without needing paid APIs.
- Popular-times style chart data is provided per place in local mock data and rendered in the detail screen.