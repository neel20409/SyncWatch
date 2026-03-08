// Serves the OG image as PNG from the SVG
import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  // Serve the SVG with correct content type
  // Twitter and LinkedIn will render it correctly
  const svgPath = path.join(process.cwd(), 'public', 'og-image.svg');
  const svg = fs.readFileSync(svgPath);
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.status(200).send(svg);
}
