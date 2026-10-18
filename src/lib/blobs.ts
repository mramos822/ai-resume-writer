// The soft organic shapes of the "pastel" look, shared by the PDF and the live preview so they are drawn the same.
// Each shape is a few points on the page (595 x 842, like the PDF); a smooth closed curve is drawn through them, like cut paper.
import { shade, tint } from "@/lib/accents";

export type Pt = [number, number];

/** A smooth closed curve through the points (Catmull-Rom turned into cubic Béziers), as an SVG path. */
export function smoothPath(pts: Pt[], tension = 1): string {
  const n = pts.length;
  const f = (v: number) => Math.round(v * 10) / 10;
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1: Pt = [p1[0] + ((p2[0] - p0[0]) / 6) * tension, p1[1] + ((p2[1] - p0[1]) / 6) * tension];
    const c2: Pt = [p2[0] - ((p3[0] - p1[0]) / 6) * tension, p2[1] - ((p3[1] - p1[1]) / 6) * tension];
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return `${d}Z`;
}

export type BlobKey = "mint" | "photo" | "ink" | "right" | "left" | "center" | "pink" | "pinkSoft";

/**
 * A rounded shape with lobes, like a paint splash or a leaf: an ellipse whose radius swells and shrinks `n` times around it.
 * `amp` is how much (0.1 is a soft wave, 0.25 a splash with clear lobes) and `phase` turns the lobes.
 */
function lobed(cx: number, cy: number, rx: number, ry: number, n: number, amp: number, phase = 0, count = 28): Pt[] {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    const swell = 1 + amp * Math.sin(n * a + phase) + amp * 0.35 * Math.sin((n + 2) * a + phase * 1.7);
    return [cx + Math.cos(a) * rx * swell, cy + Math.sin(a) * ry * swell] as Pt;
  });
}

/**
 * A paint splash: a round body with a few thin tongues thrown out of it. Each spike is [angle in degrees, how far it reaches as a
 * multiple of the body (1.8 = almost twice), how thin it is in degrees].
 */
function splat(cx: number, cy: number, r: number, spikes: [number, number, number][], wobble = 0.08, count = 72): Pt[] {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    let swell = 1 + wobble * Math.sin(5 * a + 0.7) + wobble * 0.6 * Math.sin(8 * a + 2.1);
    for (const [deg, reach, width] of spikes) {
      let d = a - (deg * Math.PI) / 180;
      d = Math.atan2(Math.sin(d), Math.cos(d)); // the shortest way round
      const w = (width * Math.PI) / 180;
      swell += (reach - 1) * Math.exp(-(d * d) / (2 * w * w));
    }
    return [cx + Math.cos(a) * r * swell, cy + Math.sin(a) * r * swell] as Pt;
  });
}

/** The drops that fly off a splash: [x, y, radius]. */
export const DROPS: Partial<Record<BlobKey, [number, number, number][]>> = {
  ink: [[500, 214, 5.5], [514, 238, 3.6], [592, 240, 4.2], [468, 196, 3]],
  right: [[562, 430, 4.2], [568, 502, 4.8], [584, 542, 3.2], [558, 468, 3]],
  left: [[92, 786, 5], [106, 826, 3.6], [74, 764, 3.2]],
  pink: [[520, 756, 5.2], [534, 826, 4], [506, 790, 3]],
};

/** Where each shape is on the page, and which part of the page it belongs to. */
export const BLOBS: Record<BlobKey, { pts: Pt[]; zone: "top" | "middle" | "bottom" }> = {
  // the pale shape behind the photo, and the outline the photo itself is cut to
  mint: { zone: "top", pts: lobed(488, 52, 126, 112, 3, 0.1, 0.6) },
  photo: { zone: "top", pts: lobed(512, 78, 96, 90, 3, 0.07, 1.4) },
  // the dark splash under the photo
  ink: { zone: "top", pts: splat(556, 190, 27, [[200, 1.9, 8], [255, 1.7, 8], [335, 2, 8], [20, 1.5, 10], [300, 1.5, 9]], 0.1) },
  // the lavender splash on the right edge, half way down
  right: { zone: "middle", pts: splat(608, 462, 30, [[180, 1.7, 8], [215, 1.5, 9], [145, 1.6, 8], [250, 1.4, 10], [100, 1.3, 10]], 0.1) },
  // the shapes along the bottom
  left: { zone: "bottom", pts: splat(20, 820, 44, [[8, 1.9, 8], [335, 1.8, 8], [290, 1.6, 9], [45, 1.5, 10]], 0.1) },
  center: {
    zone: "bottom",
    pts: [[195, 866], [196, 840], [206, 815], [223, 797], [239, 800], [247, 811], [257, 795], [273, 784], [291, 789], [300, 807], [308, 822], [318, 807], [334, 795], [352, 803], [360, 822], [365, 866]],
  },
  pink: { zone: "bottom", pts: splat(602, 782, 50, [[172, 1.8, 8], [205, 1.9, 8], [235, 1.5, 10], [140, 1.5, 10]], 0.1) },
  pinkSoft: { zone: "bottom", pts: lobed(78, 836, 34, 28, 3, 0.14, 1.2) },
};

/** The colors of the look: every one of them is made from the color the person chose, from dark to very pale. */
export function pastelPalette(base: string) {
  return {
    ink: shade(base, 0.25),
    lavender: tint(base, 0.42),
    lavenderSoft: tint(base, 0.66),
    // the dates: darker than the splashes, so they can be read over them
    date: shade(tint(base, 0.3), 0.15),
    mint: tint(base, 0.86),
    pink: tint(base, 0.78),
    paper: tint(base, 0.965),
  };
}
