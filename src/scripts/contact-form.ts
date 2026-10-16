// Contact form behaviour. No cookies, no storage, no third-party service.
// The only protection the visitor "pays" is a small proof of work solved in the background (src/lib/contact.ts).

interface Challenge {
  challenge: string;
  nonce: string;
}
interface Messages {
  name: string;
  email: string;
  message: string;
  spam: string;
  rate: string;
  fail: string;
  mailto: string;
  preparing: string;
  mailSubject: string;
  sending: string;
  submit: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX = 5000;
const OWNER = "valerio.narcisi@gmail.com";

function leadingZeroBits(bytes: Uint8Array): number {
  let bits = 0;
  for (const b of bytes) {
    if (b === 0) {
      bits += 8;
      continue;
    }
    return bits + Math.clz32(b) - 24;
  }
  return bits;
}

/** Same search as solveChallenge() on the server side of the contract: sha256(`${challenge}:${nonce}`). */
async function solve(challenge: string, bits: number): Promise<string> {
  const enc = new TextEncoder();
  for (let i = 0; ; i++) {
    const nonce = i.toString(36);
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(`${challenge}:${nonce}`)));
    if (leadingZeroBits(digest) >= bits) return nonce;
    if (i % 1500 === 1499) await new Promise((r) => setTimeout(r)); // let the page breathe
  }
}

async function fetchChallenge(): Promise<Challenge | null> {
  try {
    const res = await fetch("/api/contact/challenge", { cache: "no-store" });
    if (!res.ok) return null;
    const { challenge, bits } = (await res.json()) as { challenge: string; bits: number };
    return { challenge, nonce: await solve(challenge, bits) };
  } catch {
    return null;
  }
}

function init(form: HTMLFormElement): void {
  const msgs = JSON.parse(form.dataset.i18n ?? "{}") as Messages;
  const lang = form.dataset.lang === "en" ? "en" : "it";
  const status = form.querySelector<HTMLElement>(".cf-status")!;
  const submit = form.querySelector<HTMLButtonElement>(".cf-submit")!;
  const textarea = form.querySelector<HTMLTextAreaElement>("textarea[name=message]")!;
  const count = form.querySelector<HTMLElement>(".cf-count")!;
  const wrap = form.closest<HTMLElement>(".cf-wrap")!;
  const done = wrap.querySelector<HTMLElement>(".cf-done")!;
  const again = wrap.querySelector<HTMLButtonElement>(".cf-again")!;

  // The challenge is requested when the visitor first touches the form, never on page load.
  let pending: Promise<Challenge | null> | null = null;
  const prepare = () => (pending ??= fetchChallenge());
  form.addEventListener("focusin", prepare, { once: true });
  form.addEventListener("input", prepare, { once: true });

  const say = (text: string, error = false, kind = "") => {
    status.textContent = text;
    status.classList.toggle("cf-status--error", error);
    status.dataset.kind = kind;
  };
  const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement;
  const mark = (el: HTMLElement, invalid: boolean) => el.setAttribute("aria-invalid", String(invalid));

  const update = () => {
    const n = textarea.value.length;
    count.textContent = `${n} / ${MAX}`;
    count.classList.toggle("is-near", n > MAX - 300);
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight + 2, 352)}px`;
  };
  textarea.addEventListener("input", update);
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      form.requestSubmit();
    }
  });
  form.addEventListener("input", (e) => {
    const t = e.target as HTMLElement;
    if (t.getAttribute("aria-invalid") === "true") mark(t, false);
    // the validation message goes away as soon as nothing is invalid anymore
    if (status.dataset.kind === "validation" && !form.querySelector('[aria-invalid="true"]')) say("");
  });

  function validate(): string | null {
    const name = field("name"), email = field("email");
    let first: HTMLElement | null = null;
    let problem: string | null = null;
    const check = (el: HTMLElement, bad: boolean, text: string) => {
      mark(el, bad);
      if (bad && !first) {
        first = el;
        problem = text;
      }
    };
    check(name, name.value.trim().length === 0, msgs.name);
    check(email, !EMAIL_RE.test(email.value.trim()), msgs.email);
    check(textarea, textarea.value.trim().length < 10, msgs.message);
    (first as HTMLElement | null)?.focus();
    return problem;
  }

  function fallback(): void {
    const name = field("name").value.trim();
    const body = `${textarea.value.trim().slice(0, 1500)}\n\n— ${name}`;
    const href = `mailto:${OWNER}?subject=${encodeURIComponent(msgs.mailSubject)}&body=${encodeURIComponent(body)}`;
    status.textContent = `${msgs.fail} `;
    status.classList.add("cf-status--error");
    const a = document.createElement("a");
    a.href = href;
    a.textContent = msgs.mailto;
    status.append(a);
  }

  async function send(attempt = 1): Promise<void> {
    const proof = await (pending ?? prepare());
    if (!proof) return fallback();
    const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, lang, challenge: proof.challenge, nonce: proof.nonce }),
    });
    if (res.ok) {
      (window as unknown as { va?: { track?: (n: string) => void } }).va?.track?.("contact_submit");
      form.hidden = true;
      done.hidden = false;
      done.focus();
      return;
    }
    const code = ((await res.json().catch(() => ({}))) as { error?: string }).error;
    // A used or expired challenge is replaced transparently, once.
    if ((code === "expired" || code === "challenge") && attempt === 1) {
      pending = null;
      prepare();
      return send(2);
    }
    if (code === "spam") return say(msgs.spam, true);
    if (res.status === 429) return say(msgs.rate, true);
    pending = null; // do not reuse a challenge that may have been consumed
    fallback();
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    say("");
    const problem = validate();
    if (problem) return say(problem, true, "validation");

    submit.disabled = true;
    submit.textContent = msgs.sending;
    if (!pending) say(msgs.preparing);
    try {
      await send();
    } catch {
      fallback();
    } finally {
      submit.disabled = false;
      submit.textContent = msgs.submit;
      if (!status.classList.contains("cf-status--error")) say("");
    }
  });

  again.addEventListener("click", () => {
    form.reset();
    update();
    say("");
    pending = null;
    form.addEventListener("focusin", prepare, { once: true });
    form.hidden = false;
    done.hidden = true;
    field("name").focus();
  });
}

for (const form of document.querySelectorAll<HTMLFormElement>("form.cf")) init(form);
