import { R } from './runtimeStrings.ts';

type OcrWorker = {
  recognize(image: string): Promise<{ data: { text: string } }>;
  terminate(): Promise<unknown>;
};

// Keep worker lifetime bounded, including failed/late initialization.
export async function readWithOcrWorker(
  image: string,
  factory: () => Promise<OcrWorker>,
  timeoutMs = 120_000,
): Promise<string> {
  let worker: OcrWorker | undefined;
  let closed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const work = (async () => {
    const created = await factory();
    if (closed) { await created.terminate(); throw new Error(R.browserOcrFailed); }
    worker = created;
    return (await created.recognize(image)).data.text;
  })();
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(R.browserOcrTimeout)), timeoutMs);
      }),
    ]);
  } finally {
    closed = true;
    if (timer) clearTimeout(timer);
    if (worker) await worker.terminate().catch(() => undefined);
  }
}

export async function recognizeBrowserImage(uri: string, progress?: (value: number) => void) {
  if (!/^(blob:|data:image\/)/i.test(uri)) throw new Error(R.browserImageLocalOnly);
  let image: HTMLImageElement | undefined;
  try {
    // Decode locally and cap pixel count before passing to the OCR worker.
    image = new window.Image();
    const loaded = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(R.imageUnreadable)), 20_000);
      image!.onload = () => { clearTimeout(timer); resolve(); };
      image!.onerror = () => { clearTimeout(timer); reject(new Error(R.imageUnreadable)); };
    });
    image.src = uri;
    await loaded;
    const longestEdge = Math.max(image.naturalWidth, image.naturalHeight);
    // Small screenshots often contain tiny digits and plus signs. Enlarge before
    // segmentation instead of asking the engine to read them at thumbnail size.
    const scale = Math.min(longestEdge <= 1400 ? 3 : 1, 4096 / longestEdge);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error(R.browserOcrFailed);
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const localImage = canvas.toDataURL('image/png');
    canvas.width = canvas.height = 0;
    const { createWorker, PSM } = await import('tesseract.js');
    return await readWithOcrWorker(localImage, async () => {
      const worker = await createWorker('eng', 1, {
        logger: event => progress?.(event.status === 'recognizing text'
          ? 0.4 + event.progress * 0.6 : Math.min(0.4, event.progress * 0.4)),
      });
      try {
        // Independent contact cards/columns are not one continuous text block.
        await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, preserve_interword_spaces: '1' });
        return worker;
      } catch (error) { await worker.terminate(); throw error; }
    });
  } catch (error) {
    if (error instanceof Error && Object.values(R).includes(error.message)) throw error;
    throw new Error(R.browserOcrFailed);
  } finally {
    if (image) { image.onload = null; image.onerror = null; image.src = ''; }
  }
}
