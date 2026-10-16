// Turns a click-to-load placeholder (built by embedConsentBlock in src/lib/embed-consent.ts) into the real iframe.
// Nothing from the third party is requested before the click, and the choice is not stored anywhere.
import { privacyFriendlySrc } from "~/lib/embed-consent";

export function activateEmbed(box: HTMLElement): HTMLIFrameElement | null {
  const src = box.dataset.embedSrc;
  if (!src) return null;
  let attrs: Record<string, string> = {};
  try {
    attrs = JSON.parse(box.dataset.embedAttrs ?? "{}");
  } catch {
    /* defaults below */
  }

  const iframe = document.createElement("iframe");
  iframe.src = privacyFriendlySrc(src);
  iframe.loading = "lazy";
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") iframe.className = v;
    else if (k === "allowfullscreen") iframe.allowFullscreen = true;
    else iframe.setAttribute(k, v);
  }
  iframe.title ||= box.dataset.embedProvider ?? "";
  box.replaceWith(iframe);
  iframe.focus();
  return iframe;
}

document.addEventListener("click", (event) => {
  const button = (event.target as Element | null)?.closest<HTMLElement>(".embed-consent__btn");
  const box = button?.closest<HTMLElement>(".embed-consent");
  if (box) activateEmbed(box);
});
