#!/usr/bin/env node
/**
 * Brand asset generator.
 *
 *   npm run brand <path-to-logo>
 *
 * From one square logo (PNG or SVG) it writes:
 *   • src/assets/favicons/apple-touch-icon.png  (180×180)
 *   • src/assets/favicons/favicon.ico           (32×32, PNG-in-ICO)
 *   • src/assets/favicons/favicon.svg           (source SVG, or the logo wrapped in one)
 *   • src/assets/images/default.png             (1200×628 OG image: brand colour + business name)
 *
 * Brand colour is read from CustomStyles.astro and the name from business.ts,
 * so run `npm run setup` first. Uses sharp (already a dependency).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const p = (f) => join(root, f);

const src = process.argv[2];
if (!src) {
  console.log('\nUsage: npm run brand <path-to-logo.(png|svg)>\n');
  process.exit(1);
}
if (!existsSync(src)) {
  console.log(`\n✖ Logo not found: ${src}\n`);
  process.exit(1);
}

// Brand colour from CustomStyles.astro, business name from business.ts.
const styles = existsSync(p('src/components/CustomStyles.astro'))
  ? readFileSync(p('src/components/CustomStyles.astro'), 'utf8')
  : '';
const rgbMatch = styles.match(/--aw-color-primary:\s*rgb\((\d+)\s+(\d+)\s+(\d+)\)/);
const brand = rgbMatch ? `rgb(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]})` : 'rgb(1, 97, 239)';

const biz = existsSync(p('src/config/business.ts')) ? readFileSync(p('src/config/business.ts'), 'utf8') : '';
const nameMatch = biz.match(/export const business[\s\S]*?name:\s*'([^']*)'/);
const businessName = nameMatch ? nameMatch[1] : 'Your Business';

const xmlEscape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Wrap a PNG buffer as a single-image .ico (modern ICO can embed PNG data).
function pngToIco(png, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = icon
  header.writeUInt16LE(1, 4); // image count

  const entry = Buffer.alloc(16);
  entry.writeUInt8(size >= 256 ? 0 : size, 0); // width  (0 means 256)
  entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
  entry.writeUInt8(0, 2); // colour-palette count
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // colour planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8); // image data size
  entry.writeUInt32LE(22, 12); // offset (6 header + 16 entry)

  return Buffer.concat([header, entry, png]);
}

const isSvg = extname(src).toLowerCase() === '.svg';

async function run() {
  // apple-touch-icon.png (180)
  await sharp(src)
    .resize(180, 180, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(p('src/assets/favicons/apple-touch-icon.png'));

  // favicon.ico (32, PNG-in-ICO)
  const fav32 = await sharp(src)
    .resize(32, 32, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();
  writeFileSync(p('src/assets/favicons/favicon.ico'), pngToIco(fav32, 32));

  // favicon.svg — copy source SVG, or wrap the raster in an SVG
  if (isSvg) {
    writeFileSync(p('src/assets/favicons/favicon.svg'), readFileSync(src));
  } else {
    const b64 = (
      await sharp(src)
        .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
        .png()
        .toBuffer()
    ).toString('base64');
    writeFileSync(
      p('src/assets/favicons/favicon.svg'),
      `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><image width="512" height="512" href="data:image/png;base64,${b64}"/></svg>\n`
    );
  }

  // OG image (1200×628): brand background + business name
  const name = xmlEscape(businessName);
  const fontSize = name.length > 26 ? 64 : name.length > 18 ? 84 : 104;
  const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="628">
    <rect width="1200" height="628" fill="${brand}"/>
    <text x="600" y="330" fill="#ffffff" font-family="Helvetica, Arial, sans-serif" font-size="${fontSize}" font-weight="700" text-anchor="middle">${name}</text>
  </svg>`;
  await sharp(Buffer.from(og)).png().toFile(p('src/assets/images/default.png'));

  console.log(`
✓ Brand assets generated from ${src}
  • src/assets/favicons/apple-touch-icon.png
  • src/assets/favicons/favicon.ico
  • src/assets/favicons/favicon.svg
  • src/assets/images/default.png  (OG: "${businessName}" on ${brand})
`);
}

run().catch((err) => {
  console.error('\n✖ Brand generation failed:', err.message, '\n');
  process.exit(1);
});
