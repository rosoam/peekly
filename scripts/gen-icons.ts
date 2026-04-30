/**
 * Generate PNG icons (16, 32, 48, 128) from public/icon.svg.
 * Run with: bun run gen:icons
 */
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const SOURCE = resolve(import.meta.dir, '..', 'public', 'icon.svg');
const OUT_DIR = resolve(import.meta.dir, '..', 'public', 'icons');
const SIZES = [16, 32, 48, 128];

mkdirSync(OUT_DIR, { recursive: true });
const svg = readFileSync(SOURCE);

for (const size of SIZES) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    background: 'rgba(0, 0, 0, 0)',
  });
  const png = resvg.render().asPng();
  const out = resolve(OUT_DIR, `${size}.png`);
  writeFileSync(out, png);
  // eslint-disable-next-line no-console
  console.log(`✓ ${out}  (${png.byteLength} bytes)`);
}
