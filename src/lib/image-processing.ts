import sharp from "sharp";

const MAX_WIDTH = 1600;
const JPEG_QUALITY = 82;

export interface ProcessedImage {
  buffer: Buffer;
  width: number;
  height: number;
  format: "jpeg";
}

export async function processUpload(input: ArrayBuffer | Buffer | Uint8Array): Promise<ProcessedImage> {
  const inputBuffer = Buffer.isBuffer(input) ? input : Buffer.from(input as ArrayBuffer);
  const pipeline = sharp(inputBuffer).resize({
    width: MAX_WIDTH,
    withoutEnlargement: true,
  });

  const output = await pipeline
    .rotate()
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: output.data,
    width: output.info.width,
    height: output.info.height,
    format: "jpeg",
  };
}

export function buildUploadPath(now: Date = new Date()): { dir: string; filename: string; webPath: string } {
  const date = now.toISOString().slice(0, 10);
  const id = `${Date.now().toString(36)}-${Math.floor(Math.random() * 1296).toString(36).padStart(2, "0")}`;
  const filename = `${id}.jpg`;
  const dir = `public/img/uploads/${date}`;
  const webPath = `/img/uploads/${date}/${filename}`;
  return { dir, filename, webPath };
}
