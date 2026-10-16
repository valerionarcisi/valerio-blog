import { embedConsentBlock, type EmbedLang } from "../src/lib/embed-consent";

// Prints the click-to-load block to paste in a post instead of a raw <iframe>.
//   npx -y tsx scripts/embed-consent-html.ts "https://www.youtube.com/embed/ID" it 315
const [src, lang = "it", height = "315"] = process.argv.slice(2);
if (!src) {
  console.error('Usage: embed-consent-html.ts "<embed url>" [it|en] [height]');
  process.exit(1);
}
console.log(embedConsentBlock({ src, lang: lang as EmbedLang, height: Number(height) }));
