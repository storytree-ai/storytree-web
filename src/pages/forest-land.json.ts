// The public forest's 3D land, as a static file (ADR-0608 D4).
//
// ⚠ THE SAME DRAWING THE SVG IS. `publicForestDrawing` is the one fold both public maps serialise;
// this streams that drawing through the shared `landStreamFromDrawing` at BUILD time, so the
// browser downloads the land rather than the layout engine, and no second layout, sizer, camera or
// clock exists anywhere on the site. `forest-land-mount.tsx` fetches it once a forest mounts.
//
// ⚠ AN ENDPOINT, NOT AN IMPORT FROM A PAGE. This is the only place the site's BUILD reaches
// `forest-world-r3f`'s main entry; no page (and so nothing in the Act 1 static closure the parent's
// `check:web-experience-closure` walks) imports it.
//
// Published data stays on its allow-list (ADR-0299 / ADR-0453 / ADR-0494): the drawing is built
// from the snapshot this site already publishes and adds no field to it.
import type { APIRoute } from 'astro';
import snapshotJson from '../data/forest-snapshot.json';
import { assertSnapshot, publicForestDrawing } from '../scripts/forest-snapshot-map';
import { landStreamFromDrawing } from '../lib/forest-world-r3f/true-ground';

export const GET: APIRoute = () => {
  const descriptors = landStreamFromDrawing(publicForestDrawing(assertSnapshot(snapshotJson)));
  // Skips are audit records, not drawables — the canvas ignores them, so they are not shipped.
  const drawable = descriptors.filter((d) => d.kind !== 'skipped');
  return new Response(JSON.stringify(drawable), { headers: { 'Content-Type': 'application/json' } });
};
