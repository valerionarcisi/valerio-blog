import { describe, test, expect, vi, beforeEach } from "vitest";
import { createClient, type Client } from "@libsql/client";

let db: Client;

vi.mock("~/lib/turso", () => ({
  default: () => db,
}));

import {
  ensureTable,
  createMedia,
  listMedia,
  tagMedia,
  deleteMedia,
  getMedia,
  __resetEnsured,
} from "./media-library";

beforeEach(async () => {
  db = createClient({ url: ":memory:" });
  __resetEnsured();
});

describe("media-library", () => {
  test("createMedia stores filename + path + source", async () => {
    await ensureTable();
    const id = await createMedia({
      filename: "2026-05-27-001.jpg",
      path: "public/img/uploads/2026-05-27/001.jpg",
      caption: "set di Falerone",
      source: "telegram",
    });
    expect(id).toBeGreaterThan(0);
    const m = await getMedia(id);
    expect(m?.filename).toBe("2026-05-27-001.jpg");
    expect(m?.caption).toBe("set di Falerone");
    expect(m?.tags).toBeNull();
  });

  test("listMedia returns latest first", async () => {
    await ensureTable();
    await createMedia({ filename: "a.jpg", path: "x/a.jpg", source: "telegram" });
    await createMedia({ filename: "b.jpg", path: "x/b.jpg", source: "telegram" });
    const list = await listMedia(10);
    expect(list[0].filename).toBe("b.jpg");
  });

  test("tagMedia appends tags", async () => {
    await ensureTable();
    const id = await createMedia({ filename: "a.jpg", path: "x/a.jpg", source: "telegram" });
    await tagMedia(id, ["set", "falerone"]);
    const m = await getMedia(id);
    expect(m?.tags).toBe("set,falerone");
  });

  test("deleteMedia removes the row", async () => {
    await ensureTable();
    const id = await createMedia({ filename: "a.jpg", path: "x/a.jpg", source: "telegram" });
    await deleteMedia(id);
    expect(await getMedia(id)).toBeNull();
  });

  test("createMedia rejects duplicate filename", async () => {
    await ensureTable();
    await createMedia({ filename: "a.jpg", path: "x/a.jpg", source: "telegram" });
    await expect(
      createMedia({ filename: "a.jpg", path: "y/a.jpg", source: "telegram" }),
    ).rejects.toThrow();
  });
});
