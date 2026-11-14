This repo builds the page https://oseiskar.github.io

### Local development

 1. Run `npm ci`
 2. Run `npm run dev`
 3. Go to http://localhost:3000

### CDN assets

Third-party JS/CSS/fonts (Three.js, Leaflet, Tailwind, Inter, ...) are not committed here.
`npm run dev` and `npm run build` download them from CDNs into `vendor/` directories under
`public/` (gitignored) using `scripts/fetch-cdn-assets.sh`, which verifies the files against the
checksums in `scripts/cdn-assets.sha256`. The files end up in the `gh-pages` branch through the
build output. Include each package's license file too.

To add or upgrade an asset, edit `scripts/cdn-assets.txt` and run
`scripts/fetch-cdn-assets.sh --update-hashes`.
