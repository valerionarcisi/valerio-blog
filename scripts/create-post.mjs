#!/usr/bin/env node
/* eslint-disable no-undef */

/**
 * CLI Script to create blog posts in Hygraph
 *
 * Usage:
 *   node scripts/create-post.mjs --interactive
 *   node scripts/create-post.mjs --title "Post Title" --content "Content..." --date "2025-01-15" --lang "en" --tags "tag1,tag2"
 */

import { createInterface } from 'readline';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Load environment variables
config({ path: join(rootDir, '.env') });

const API_ENDPOINT = process.env.HYGRAPH_API_ENDPOINT;
const TOKEN = process.env.HYGRAPH_TOKEN;

if (!API_ENDPOINT || !TOKEN) {
  console.error('❌ Error: HYGRAPH_API_ENDPOINT and HYGRAPH_TOKEN must be set in .env file');
  process.exit(1);
}

// Parse CLI arguments
const args = process.argv.slice(2);
const isInteractive = args.includes('--interactive');

function parseArgs() {
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const value = args[i + 1];
      parsed[key] = value;
      i++;
    }
  }
  return parsed;
}

async function createPost(postData) {
  const CREATE_POST_MUTATION = `
    mutation CreatePost($data: PostCreateInput!) {
      createPost(data: $data) {
        id
        slug
        title
        date
        tags
      }
    }
  `;

  const variables = {
    data: postData
  };

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({
        query: CREATE_POST_MUTATION,
        variables,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const json = await response.json();

    if (json.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(json.errors, null, 2)}`);
    }

    return json.data.createPost;
  } catch (error) {
    console.error('❌ Error creating post:', error.message);
    throw error;
  }
}

async function getAssets() {
  const GET_ASSETS_QUERY = `
    query GetAssets {
      assets(first: 20, orderBy: createdAt_DESC) {
        id
        fileName
        url
        width
        height
      }
    }
  `;

  const response = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ query: GET_ASSETS_QUERY }),
  });

  const json = await response.json();
  return json.data.assets;
}

function question(rl, query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function interactiveMode() {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('📝 Creating a new blog post\n');

  const title = await question(rl, '📌 Title: ');
  const slug = await question(rl, '🔗 Slug (leave empty for auto-generate): ');
  const date = await question(rl, '📅 Date (YYYY-MM-DD, default today): ') || new Date().toISOString().split('T')[0];
  const extract = await question(rl, '📄 Extract/Description: ');
  const lang = await question(rl, '🌍 Language (default: it): ') || 'it';
  const tagsInput = await question(rl, '🏷️  Tags (comma-separated): ');
  const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);

  console.log('\n📸 Cover Image Options:');
  console.log('1. Use existing asset from Hygraph');
  console.log('2. Upload from URL');
  console.log('3. Skip (you can add it later in Hygraph UI)\n');

  const coverOption = await question(rl, 'Choose option (1-3): ');

  let coverImage = null;

  if (coverOption === '1') {
    console.log('\n🖼️  Fetching recent assets...\n');
    const assets = await getAssets();
    assets.forEach((asset, idx) => {
      console.log(`${idx + 1}. ${asset.fileName} (${asset.width}x${asset.height})`);
      console.log(`   ${asset.url}\n`);
    });

    const assetIdx = parseInt(await question(rl, 'Select asset number: ')) - 1;
    if (assets[assetIdx]) {
      coverImage = { connect: { id: assets[assetIdx].id } };

      const addCredits = await question(rl, 'Add photo credits? (y/n): ');
      if (addCredits.toLowerCase() === 'y') {
        const coverAuthorName = await question(rl, 'Author name: ');
        const coverAuthorLink = await question(rl, 'Author link (optional): ');
        const coverDescription = await question(rl, 'Description (optional): ');

        // These will be added to the post data
        postData.coverAuthorName = coverAuthorName || null;
        postData.coverAuthorLink = coverAuthorLink || null;
        postData.coverDescription = coverDescription || null;
      }
    }
  } else if (coverOption === '2') {
    const imageUrl = await question(rl, 'Image URL: ');
    coverImage = { create: { upload: imageUrl } };
  }

  console.log('\n📝 Content (markdown supported)');
  console.log('   Enter your content. Type END on a new line when finished:\n');

  let content = '';
  let line;
  while ((line = await question(rl, '')) !== 'END') {
    content += line + '\n';
  }

  rl.close();

  const postData = {
    title,
    date,
    extract: extract || undefined,
    content: content.trim(),
    tags,
    lang,
    coverAuthorName: null,
    coverAuthorLink: null,
    coverDescription: null,
  };

  if (slug) postData.slug = slug;
  if (coverImage) postData.coverImage = coverImage;

  console.log('\n🚀 Creating post...\n');

  try {
    const result = await createPost(postData);
    console.log('✅ Post created successfully!');
    console.log(`   ID: ${result.id}`);
    console.log(`   Title: ${result.title}`);
    console.log(`   Slug: ${result.slug}`);
    console.log(`   Date: ${result.date}`);
    console.log(`   Tags: ${result.tags.join(', ')}`);
    console.log('\n📝 Don\'t forget to publish it in Hygraph!');
  } catch {
    console.error('❌ Failed to create post');
    process.exit(1);
  }
}

async function cliMode() {
  const parsed = parseArgs();

  if (!parsed.title || !parsed.content || !parsed.date || !parsed.lang || !parsed.tags) {
    console.error('❌ Missing required arguments: --title, --content, --date, --lang, --tags');
    console.log('\nUsage:');
    console.log('  node scripts/create-post.mjs --title "Title" --content "Content" --date "2025-01-15" --lang "en" --tags "tag1,tag2"');
    console.log('\nOptional arguments:');
    console.log('  --slug "custom-slug"');
    console.log('  --extract "Short description"');
    console.log('  --coverImageId "asset-id"');
    process.exit(1);
  }

  const postData = {
    title: parsed.title,
    date: parsed.date,
    content: parsed.content,
    tags: parsed.tags.split(',').map(t => t.trim()),
    lang: parsed.lang,
  };

  if (parsed.slug) postData.slug = parsed.slug;
  if (parsed.extract) postData.extract = parsed.extract;
  if (parsed.coverImageId) {
    postData.coverImage = { connect: { id: parsed.coverImageId } };
  }

  console.log('🚀 Creating post...\n');

  try {
    const result = await createPost(postData);
    console.log('✅ Post created successfully!');
    console.log(`   ID: ${result.id}`);
    console.log(`   Title: ${result.title}`);
    console.log(`   Slug: ${result.slug}`);
  } catch {
    console.error('❌ Failed to create post');
    process.exit(1);
  }
}

// Main
if (isInteractive) {
  interactiveMode();
} else if (args.length === 0) {
  console.log('📝 Blog Post Creator\n');
  console.log('Usage:');
  console.log('  Interactive mode: node scripts/create-post.mjs --interactive');
  console.log('  CLI mode:         node scripts/create-post.mjs --title "Title" --content "Content" --date "2025-01-15" --lang "en" --tags "tag1,tag2"');
} else {
  cliMode();
}
