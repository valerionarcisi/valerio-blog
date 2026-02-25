import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { glob } from "fs";
import { join, dirname } from "path";
import { promisify } from "util";
import { readdir, stat } from "fs/promises";

const CONTENT_DIR = "src/content/blog";
const PUBLIC_IMG_DIR = "public/img/blog";
const HYGRAPH_BASE =
  "https://us-east-1-shared-usea1-02.graphassets.com/A0ARUR3HcQ6eWQRsiVvbXz/";

async function getAllMdFiles(dir) {
  const results = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await getAllMdFiles(fullPath)));
    } else if (entry.name.endsWith(".md")) {
      results.push(fullPath);
    }
  }
  return results;
}

function getSlugFromPath(filePath) {
  const filename = filePath.split("/").pop().replace(".md", "");
  return filename;
}

async function downloadImage(url, destPath) {
  if (existsSync(destPath)) {
    console.log(`  ✓ Already exists: ${destPath}`);
    return true;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`  ✗ Failed to download ${url}: ${response.status}`);
      return false;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const dir = dirname(destPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(destPath, buffer);
    console.log(`  ✓ Downloaded: ${destPath}`);
    return true;
  } catch (error) {
    console.error(`  ✗ Error downloading ${url}: ${error.message}`);
    return false;
  }
}

function getExtFromContentType(contentType) {
  const map = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "image/avif": "avif",
  };
  return map[contentType] || "jpg";
}

async function getImageExt(url) {
  try {
    const response = await fetch(url, { method: "HEAD" });
    const contentType = response.headers.get("content-type");
    return getExtFromContentType(contentType);
  } catch {
    return "jpg";
  }
}

async function main() {
  console.log("🔍 Scanning markdown files for Hygraph images...\n");

  const mdFiles = await getAllMdFiles(CONTENT_DIR);
  console.log(`Found ${mdFiles.length} markdown files\n`);

  const hygraphUrlRegex =
    /https:\/\/us-east-1-shared-usea1-02\.graphassets\.com\/[^\s)"\]]+/g;

  const allReplacements = [];
  const urlToLocalPath = new Map();

  for (const filePath of mdFiles) {
    const content = readFileSync(filePath, "utf-8");
    const urls = [...new Set(content.match(hygraphUrlRegex) || [])];
    if (urls.length === 0) continue;

    const slug = getSlugFromPath(filePath);
    console.log(`📄 ${filePath} (${urls.length} images)`);

    for (const url of urls) {
      if (urlToLocalPath.has(url)) continue;

      const assetId = url.split("/").pop();
      const ext = await getImageExt(url);
      const localRelPath = `/img/blog/${slug}/${assetId}.${ext}`;
      const localAbsPath = join(PUBLIC_IMG_DIR, slug, `${assetId}.${ext}`);

      urlToLocalPath.set(url, { localRelPath, localAbsPath });

      const success = await downloadImage(url, localAbsPath);
      if (!success) {
        console.error(`  ⚠ Skipping replacement for ${url}`);
        urlToLocalPath.delete(url);
      }
    }
  }

  console.log(`\n📝 Replacing URLs in markdown files...\n`);

  let totalReplacements = 0;
  for (const filePath of mdFiles) {
    let content = readFileSync(filePath, "utf-8");
    let fileReplacements = 0;

    for (const [url, { localRelPath }] of urlToLocalPath) {
      const count = (content.match(new RegExp(escapeRegex(url), "g")) || [])
        .length;
      if (count > 0) {
        content = content.replaceAll(url, localRelPath);
        fileReplacements += count;
      }
    }

    if (fileReplacements > 0) {
      writeFileSync(filePath, content, "utf-8");
      console.log(`  ✓ ${filePath}: ${fileReplacements} replacements`);
      totalReplacements += fileReplacements;
    }
  }

  console.log(`\n✅ Done! ${urlToLocalPath.size} unique images downloaded, ${totalReplacements} URL replacements made.`);
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

main().catch(console.error);
