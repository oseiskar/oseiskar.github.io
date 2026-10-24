/** @type {import('next').NextConfig} */
const nextConfig = { output: 'export' };

// The static host (GitHub Pages) serves public/vibe-coded/x/index.html at
// /vibe-coded/x/, but the Next dev server does not, so emulate it in dev only
// (rewrites are not supported with output: 'export').
if (process.env.NODE_ENV === 'development') {
  nextConfig.rewrites = async () => [
    { source: '/vibe-coded/:tool', destination: '/vibe-coded/:tool/index.html' },
  ];
}

module.exports = nextConfig;
