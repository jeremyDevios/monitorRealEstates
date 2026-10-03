import fs from "node:fs";
import path from "node:path";
import type { BrowserContext } from "playwright";
import { chromium } from "playwright";
import { browserProfileDir } from "@/lib/paths";

export const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export type FetchedPage = {
  html: string;
  finalUrl: string;
  status: number | null;
  /** Vrai si la page affiche le défi anti-bot DataDome (interstitiel ou captcha). */
  challenged: boolean;
};

// Deux profils persistants : headless pour le job périodique, avec fenêtre pour les
// actions déclenchées depuis le navigateur (l'utilisateur peut résoudre un captcha à
// la main s'il apparaît). Les cookies du défi y sont conservés entre deux requêtes,
// ce qui évite de repasser le défi à chaque fois.
let headlessCtx: Promise<BrowserContext> | null = null;
let headedCtx: Promise<BrowserContext> | null = null;

/** Retire les verrous laissés par un arrêt brutal du serveur (sinon Chromium refuse de démarrer). */
function cleanStaleLocks(profileDir: string): void {
  try {
    for (const f of fs.readdirSync(profileDir)) {
      if (f.startsWith("Singleton")) {
        fs.rmSync(path.join(profileDir, f), { force: true });
      }
    }
  } catch {
    // dossier absent ou illisible : rien à nettoyer
  }
}

function launchContext(headed: boolean): Promise<BrowserContext> {
  const profileDir = path.join(/*turbopackIgnore: true*/ browserProfileDir(), headed ? "headed" : "headless");
  fs.mkdirSync(profileDir, { recursive: true });
  cleanStaleLocks(profileDir);
  return chromium.launchPersistentContext(profileDir, {
    channel: "chromium", // Chromium complet en mode headless « new » (le headless shell est détecté)
    headless: !headed,
    viewport: { width: 1280, height: 900 },
    locale: "fr-FR",
    userAgent: USER_AGENT,
    args: ["--disable-blink-features=AutomationControlled"],
  });
}

/** Un affichage est-il disponible ? (Mac de dev : oui ; serveur headless : non, sauf DISPLAY). */
function displayAvailable(): boolean {
  if (process.platform === "darwin") return true;
  if (process.platform !== "linux") return false;
  return Boolean(process.env.DISPLAY);
}

let loggedHeadlessFallback = false;

/** Vrai si le contexte répond encore (sinon le navigateur a été fermé : fenêtre
 * fermée à la main, arrêt brutal, kill…). `pages()` lève l'erreur
 * « Target page, context or browser has been closed » sur un contexte mort. */
async function contextAlive(ctx: BrowserContext): Promise<boolean> {
  try {
    await ctx.pages();
    return true;
  } catch {
    return false;
  }
}

export function ensureBrowserContext(headed = false): Promise<BrowserContext> {
  // Sur un serveur sans affichage (Orange Pi, VPS…), le mode « avec fenêtre » retombe
  // en headless : sinon Chromium échouerait à ouvrir une fenêtre.
  const effective = headed && displayAvailable();
  if (headed && !effective && !loggedHeadlessFallback) {
    loggedHeadlessFallback = true;
    console.log("[lbc] aucun affichage détecté : la navigation se fera en headless.");
  }
  const slot = effective ? headedCtx : headlessCtx;
  if (slot) {
    // Le navigateur a pu être fermé entre deux requêtes : on relance un contexte
    // frais (même profil persistant, cookies conservés) au lieu de réutiliser un mort.
    return slot.then(async (ctx) => {
      if (await contextAlive(ctx)) return ctx;
      if (effective) headedCtx = null;
      else headlessCtx = null;
      return ensureBrowserContext(headed);
    });
  }
  const p = launchContext(effective).catch((err) => {
    if (effective) headedCtx = null;
    else headlessCtx = null;
    throw err;
  });
  if (effective) headedCtx = p;
  else headlessCtx = p;
  return p;
}

const CHALLENGE_RE = /enable JS and disable any ad blocker|var dd=/i;

/**
 * Charge la page d'une annonce dans un vrai navigateur et renvoie son HTML final.
 * Le défi DataDome interstitiel se résout tout seul en quelques secondes ; un captcha
 * ne se résout pas : on le signale via `challenged` et l'appelant conclut « non concluant ».
 */
export async function fetchListingHtml(
  url: string,
  { timeoutMs = 45_000, headed = false, settleMs = 15_000 }: { timeoutMs?: number; headed?: boolean; settleMs?: number } = {},
): Promise<FetchedPage> {
  const context = await ensureBrowserContext(headed);
  const page = await context.newPage();
  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    let html = await page.content();
    const deadline = Date.now() + settleMs;
    while (Date.now() < deadline && CHALLENGE_RE.test(html)) {
      await page.waitForTimeout(2000);
      html = await page.content();
    }
    return {
      html,
      finalUrl: page.url(),
      status: response?.status() ?? null,
      challenged: CHALLENGE_RE.test(html),
    };
  } finally {
    await page.close().catch(() => {});
  }
}
