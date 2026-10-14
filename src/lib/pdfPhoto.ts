// The photo of a resume: a PDF keeps its pictures as separate images, so the portrait can be taken out of it. Of all the images on the first
// pages the portrait is the one that is close to square or taller than wide (backgrounds and banners are wide, icons are tiny) and the
// biggest of those. It is cut to a square, a little biased to the top (the face), and returned as a small JPEG data URL like the ones the
// photo picker makes. Anything that goes wrong returns null: the resume is read without a photo.

const MIN_SIDE = 100; // smaller than this is an icon, not a portrait
const SIZE = 320;

type PdfImage = { width: number; height: number; kind?: number; data?: Uint8Array | Uint8ClampedArray; bitmap?: unknown };

export async function extractPdfPhoto(pdf: Buffer): Promise<string | null> {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const { createCanvas } = await import("@napi-rs/canvas");
    const doc = await pdfjs.getDocument({ data: new Uint8Array(pdf), isEvalSupported: false, useSystemFonts: false, verbosity: 0 }).promise;

    let best: PdfImage | null = null;
    for (let n = 1; n <= Math.min(doc.numPages, 2); n++) {
      const page = await doc.getPage(n);
      const ops = await page.getOperatorList();
      for (let i = 0; i < ops.fnArray.length; i++) {
        if (ops.fnArray[i] !== pdfjs.OPS.paintImageXObject) continue;
        const name = ops.argsArray[i][0] as string;
        const img = await new Promise<PdfImage | null>((resolve) => {
          const t = setTimeout(() => resolve(null), 3000);
          page.objs.get(name, (o: PdfImage) => {
            clearTimeout(t);
            resolve(o);
          });
        });
        if (!img || img.width < MIN_SIDE || img.height < MIN_SIDE) continue;
        const ratio = img.width / img.height;
        if (ratio < 0.6 || ratio > 1.15) continue; // wide ones are backgrounds and banners
        if (img.width * img.height > 6_000_000) continue; // a whole scanned page, not a portrait
        if (!best || img.width * img.height > best.width * best.height) best = img;
      }
    }
    await doc.destroy().catch(() => {});
    if (!best) return null;

    const full = createCanvas(best.width, best.height);
    const ctx = full.getContext("2d");
    if (best.bitmap) {
      ctx.drawImage(best.bitmap as never, 0, 0);
    } else if (best.data) {
      const px = best.width * best.height;
      const out = ctx.createImageData(best.width, best.height);
      const d = best.data;
      if (best.kind === 3) out.data.set(d.subarray(0, px * 4));
      else if (best.kind === 2)
        for (let i = 0; i < px; i++) {
          out.data[i * 4] = d[i * 3];
          out.data[i * 4 + 1] = d[i * 3 + 1];
          out.data[i * 4 + 2] = d[i * 3 + 2];
          out.data[i * 4 + 3] = 255;
        }
      else return null; // black and white pictures are not portraits
      ctx.putImageData(out, 0, 0);
    } else return null;

    const side = Math.min(best.width, best.height);
    const square = createCanvas(SIZE, SIZE);
    const sq = square.getContext("2d");
    sq.fillStyle = "#ffffff";
    sq.fillRect(0, 0, SIZE, SIZE);
    sq.drawImage(full, (best.width - side) / 2, (best.height - side) * 0.3, side, side, 0, 0, SIZE, SIZE);
    return `data:image/jpeg;base64,${square.toBuffer("image/jpeg", 86).toString("base64")}`;
  } catch (err) {
    console.error("The photo of the PDF could not be taken", err instanceof Error ? err.message : err);
    return null;
  }
}
