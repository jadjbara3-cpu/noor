// Render the brand SVGs into every raster size the ecosystem asks for.
//
//   node scripts/build-brand.mjs
//
// Outputs into brand/:
//   logo-{32,64,128,200,256,512}.png     transparent background  (token lists, wallets)
//   logo-200-solid.png                   200x200 on the navy coin  (CoinMarketCap)
//   logo-mark-{200,512}.png              star mark only, transparent
//   wordmark.png                         horizontal lockup
//
// CoinMarketCap expects a 200x200 PNG; token lists and wallets want a square
// logo with transparency.

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { ROOT } from "./lib/build.mjs";

const BRAND = path.join(ROOT, "brand");

async function renderSvg(svgPath, outPath, size, { background } = {}) {
  const svg = fs.readFileSync(svgPath);
  let img = sharp(svg, { density: 384 }).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } });
  if (background) img = img.flatten({ background });
  await img.png({ compressionLevel: 9 }).toFile(outPath);
  const { size: bytes } = fs.statSync(outPath);
  return bytes;
}

async function renderWordmark(svgPath, outPath, width) {
  const svg = fs.readFileSync(svgPath);
  await sharp(svg, { density: 384 }).resize({ width }).png({ compressionLevel: 9 }).toFile(outPath);
  return fs.statSync(outPath).size;
}

async function main() {
  console.log(`\nrendering brand assets into ${path.relative(ROOT, BRAND)}/\n`);
  const logo = path.join(BRAND, "logo.svg");
  const mark = path.join(BRAND, "logo-mark.svg");
  const word = path.join(BRAND, "wordmark.svg");

  for (const s of [32, 64, 128, 200, 256, 512]) {
    const out = path.join(BRAND, `logo-${s}.png`);
    const bytes = await renderSvg(logo, out, s);
    console.log(`  logo-${String(s).padEnd(3)}.png        ${String(bytes).padStart(7)} B`);
  }

  const solid = path.join(BRAND, "logo-200-solid.png");
  const solidBytes = await renderSvg(logo, solid, 200, { background: { r: 10, g: 27, b: 51, alpha: 1 } });
  console.log(`  logo-200-solid.png   ${String(solidBytes).padStart(7)} B   (CoinMarketCap: 200x200)`);

  for (const s of [200, 512]) {
    const out = path.join(BRAND, `logo-mark-${s}.png`);
    const bytes = await renderSvg(mark, out, s);
    console.log(`  logo-mark-${s}.png     ${String(bytes).padStart(7)} B`);
  }

  const wOut = path.join(BRAND, "wordmark.png");
  const wBytes = await renderWordmark(word, wOut, 1400);
  console.log(`  wordmark.png         ${String(wBytes).padStart(7)} B`);

  // favicon bundle
  const ico = path.join(BRAND, "favicon.png");
  await renderSvg(logo, ico, 48);
  console.log(`  favicon.png          ${String(fs.statSync(ico).size).padStart(7)} B`);

  console.log("\ndone — the SVG sources are the master files; PNGs are generated.\n");
}

main().catch((e) => {
  console.error("BRAND BUILD FAILED:", e.message);
  process.exitCode = 1;
});
