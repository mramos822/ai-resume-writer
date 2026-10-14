/** Reads a response made of one JSON object per line (application/x-ndjson) and hands each object over as it arrives. */
export async function readNdjson<T = Record<string, unknown>>(res: Response, onMessage: (msg: T) => void): Promise<void> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffered = "";
  const handle = (line: string) => {
    const text = line.trim();
    if (!text) return;
    try {
      onMessage(JSON.parse(text) as T);
    } catch (err) {
      // a line that is not JSON is skipped; an error thrown by the caller (a failed review) goes on up
      if (!(err instanceof SyntaxError)) throw err;
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffered += decoder.decode(value, { stream: true });
    let at: number;
    while ((at = buffered.indexOf("\n")) >= 0) {
      handle(buffered.slice(0, at));
      buffered = buffered.slice(at + 1);
    }
  }
  handle(buffered + decoder.decode());
}
