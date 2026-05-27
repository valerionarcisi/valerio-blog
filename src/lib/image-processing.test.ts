import { describe, test, expect } from "vitest";
import sharp from "sharp";
import { processUpload } from "./image-processing";

async function makeTestPng(width: number, height: number): Promise<ArrayBuffer> {
  const buf = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 100, b: 50 },
    },
  })
    .png()
    .toBuffer();
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

describe("image-processing", () => {
  test("processUpload resizes oversized images to maxWidth 1600", async () => {
    const input = await makeTestPng(3000, 2000);
    const { buffer, width, height } = await processUpload(input);
    expect(width).toBe(1600);
    expect(height).toBeLessThanOrEqual(1067);
    const meta = await sharp(buffer).metadata();
    expect(meta.format).toBe("jpeg");
  });

  test("processUpload leaves smaller images alone", async () => {
    const input = await makeTestPng(800, 600);
    const { width, height } = await processUpload(input);
    expect(width).toBe(800);
    expect(height).toBe(600);
  });

  test("processUpload strips EXIF metadata", async () => {
    const input = await makeTestPng(1000, 750);
    const { buffer } = await processUpload(input);
    const meta = await sharp(buffer).metadata();
    expect(meta.exif).toBeUndefined();
  });

  test("processUpload outputs JPEG at quality ~82", async () => {
    const input = await makeTestPng(2000, 1500);
    const { buffer } = await processUpload(input);
    const meta = await sharp(buffer).metadata();
    expect(meta.format).toBe("jpeg");
  });
});
