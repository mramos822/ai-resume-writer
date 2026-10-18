// Loads the list of resume looks AND their preview images (fully decoded) once, as early as possible, so the
// "Pick a look" screen can show the sheets animating in with no placeholder. Safe to call from anywhere, any number of times.
export interface TemplateInfo {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
}

let cached: Promise<TemplateInfo[]> | null = null;

const preloadImage = (src: string) =>
  new Promise<void>((resolve) => {
    const img = new window.Image();
    img.onload = () => (img.decode ? img.decode().catch(() => {}).then(() => resolve()) : resolve());
    img.onerror = () => resolve();
    img.src = src;
  });

export function loadTemplates(): Promise<TemplateInfo[]> {
  if (typeof window === "undefined") return Promise.resolve([]);
  if (!cached) {
    cached = fetch("/api/templates")
      .then((res) => res.json() as Promise<TemplateInfo[]>)
      .then(async (list) => {
        // never wait forever for a slow image
        await Promise.race([Promise.all(list.map((t) => preloadImage(t.imageUrl))), new Promise((r) => setTimeout(r, 8000))]);
        return list;
      })
      .catch((err) => {
        cached = null; // try again next time
        throw err;
      });
  }
  return cached;
}
