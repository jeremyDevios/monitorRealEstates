import * as cheerio from "cheerio";

export type ParsedListing = {
  title: string;
  description: string;
  priceCents: number | null;
  habitableM2: number | null;
  gardenM2: number | null;
  rooms: number | null;
  city: string;
  postalCode: string;
  imageUrls: string[];
};

/**
 * Parseur de page d'annonce Leboncoin.
 *
 * Le HTML de Leboncoin change régulièrement : on essaie plusieurs sources
 * (état préchargé __PRELOADED_STATE__, JSON-LD, balises meta) et on fusionne
 * ce qui a été trouvé, de la plus riche à la moins riche. L'appelant décide
 * quoi faire quand des champs manquent (saisie manuelle).
 */

function toCents(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    // Leboncoin stocke parfois les centimes en entier : au-delà de 100 000, on suppose des centimes.
    return Math.round(value >= 100_000 ? value : value * 100);
  }
  const str = String(value)
    .replace(/[\s  ]/g, "")
    .replace(",", ".")
    .replace(/[€]/g, "");
  const m = str.match(/^([\d.]+)(euros?)?$/i);
  if (!m) return null;
  const n = Number.parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  return Math.round(n >= 100_000 ? n : n * 100);
}

function toArea(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value !== "string") return null;
  const m = value.replace(/[\s  ]/g, " ").match(/([\d.]+)\s*(?:m²|m2)/i);
  if (!m) return null;
  const n = Number.parseFloat(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function toRooms(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
  if (typeof value !== "string") return null;
  const m = value.replace(/[\s  ]/g, " ").match(/(\d+)\s*pièces?/i);
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  return n > 0 ? n : null;
}

function extractImageUrls(images: unknown[]): string[] {
  const urls: string[] = [];
  for (const img of images) {
    if (typeof img === "string") {
      urls.push(img);
    } else if (img && typeof img === "object") {
      const o = img as Record<string, unknown>;
      const direct = o.url ?? o.urls_large ?? o.urls_medium ?? o.href;
      if (typeof direct === "string") urls.push(direct);
      if (Array.isArray(o.urls)) urls.push(...o.urls.filter((u): u is string => typeof u === "string"));
    }
  }
  return urls;
}

function fromAdObject(o: Record<string, unknown>): Partial<ParsedListing> {
  const out: Partial<ParsedListing> = {};
  if (typeof o.subject === "string") out.title = o.subject;
  if (typeof o.body === "string") out.description = o.body;
  // price_cents (état __NEXT_DATA__) est déjà en centimes ; sinon price (tableau ou scalaire).
  if (typeof o.price_cents === "number" && Number.isFinite(o.price_cents)) {
    out.priceCents = Math.round(o.price_cents);
  } else {
    out.priceCents = toCents(Array.isArray(o.price) ? o.price[0] : o.price);
  }
  // Attributs étendus (__NEXT_DATA__) : valeurs brutes, sans unité (« 205 », « 6 »…).
  const attrValue = (key: string): string | null => {
    if (!Array.isArray(o.attributes)) return null;
    for (const a of o.attributes) {
      if (a && typeof a === "object" && (a as Record<string, unknown>).key === key) {
        const v = (a as Record<string, unknown>).value;
        return typeof v === "string" ? v : null;
      }
    }
    return null;
  };
  const attrNumber = (key: string): number | null => {
    const v = attrValue(key);
    if (v == null) return null;
    const n = Number.parseFloat(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  out.habitableM2 = toArea(o.square ?? o.square_habitable ?? o.surface) ?? attrNumber("square");
  out.gardenM2 =
    toArea(o.square_garden ?? o.garden_surface ?? o.land_surface ?? o.square_land) ??
    attrNumber("land_plot_surface");
  out.rooms = toRooms(o.rooms ?? o.room_count ?? o.number_rooms) ?? attrNumber("rooms");
  const loc = o.location as Record<string, unknown> | undefined;
  if (typeof o.city === "string") out.city = o.city;
  else if (typeof loc?.city === "string") out.city = loc.city;
  if (typeof o.zipcode === "string") out.postalCode = o.zipcode;
  else if (typeof loc?.zipcode === "string") out.postalCode = loc.zipcode;
  // Images : tableau (ancien format) ou objet { urls: [...] } (__NEXT_DATA__).
  if (Array.isArray(o.images) || Array.isArray(o.pictures)) {
    const images = (Array.isArray(o.images) ? o.images : o.pictures) as unknown[];
    out.imageUrls = extractImageUrls(images);
  } else if (o.images && typeof o.images === "object" && Array.isArray((o.images as Record<string, unknown>).urls)) {
    out.imageUrls = ((o.images as Record<string, unknown>).urls as unknown[]).filter(
      (u): u is string => typeof u === "string",
    );
  }
  return out;
}

/** Parcourt le JSON préchargé à la recherche de l'objet annonce (sujet + prix ou photos). */
function findAdObject(node: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 40) return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = findAdObject(n, depth + 1);
      if (r) return r;
    }
    return null;
  }
  if (node && typeof node === "object") {
    const o = node as Record<string, unknown>;
    const looksLikeAd =
      typeof o.subject === "string" &&
      (o.price !== undefined ||
        Array.isArray(o.images) ||
        Array.isArray(o.pictures) ||
        (o.images != null && typeof o.images === "object" && Array.isArray((o.images as Record<string, unknown>).urls)));
    if (looksLikeAd) return o;
    for (const v of Object.values(o)) {
      const r = findAdObject(v, depth + 1);
      if (r) return r;
    }
  }
  return null;
}

function fromPreloadedState($: cheerio.CheerioAPI): Partial<ParsedListing> {
  // Ancienne époque Leboncoin : état préchargé dans #__PRELOADED_STATE__.
  const el = $("#__PRELOADED_STATE__").first();
  if (el.length) {
    try {
      let data: unknown = JSON.parse(el.text());
      // Parfois double-encodé : le contenu est une chaîne JSON échappée.
      if (typeof data === "string") data = JSON.parse(data);
      const ad = findAdObject(data);
      return ad ? fromAdObject(ad) : {};
    } catch {
      // état illisible : on tente __NEXT_DATA__ plus bas
    }
  }
  // Page actuelle : état Next.js sérialisé dans #__NEXT_DATA__, annonce dans
  // props.pageProps.ad. Retour au parcours heuristique si ce chemin change.
  const next = $("#__NEXT_DATA__").first();
  if (next.length) {
    try {
      const data = JSON.parse(next.text()) as Record<string, unknown>;
      const props = data.props as Record<string, unknown> | undefined;
      const pageProps = props?.pageProps as Record<string, unknown> | undefined;
      const direct = pageProps?.ad as Record<string, unknown> | undefined;
      const found = direct && typeof direct.subject === "string" ? direct : findAdObject(data);
      return found ? fromAdObject(found) : {};
    } catch {
      return {};
    }
  }
  return {};
}

function fromJsonLd($: cheerio.CheerioAPI): Partial<ParsedListing> {
  const out: Partial<ParsedListing> = {};
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).text()) as unknown;
      const walk = (node: unknown): Record<string, unknown> | null => {
        if (Array.isArray(node)) {
          for (const n of node) {
            const r = walk(n);
            if (r) return r;
          }
          return null;
        }
        if (node && typeof node === "object") {
          const o = node as Record<string, unknown>;
          const type = Array.isArray(o["@type"]) ? o["@type"] : [o["@type"]];
          if (type.includes("Product") && (o.name || o.offers)) return o;
          for (const v of Object.values(o)) {
            const r = walk(v);
            if (r) return r;
          }
        }
        return null;
      };
      const product = walk(data);
      if (!product) return;
      if (!out.title && typeof product.name === "string") out.title = product.name;
      if (!out.description && typeof product.description === "string") out.description = product.description;
      const offers = (Array.isArray(product.offers) ? product.offers[0] : product.offers) as
        | Record<string, unknown>
        | undefined;
      if (out.priceCents == null && offers?.price != null) out.priceCents = toCents(offers.price);
      if (!out.imageUrls?.length) {
        if (typeof product.image === "string") out.imageUrls = [product.image];
        else if (Array.isArray(product.image)) out.imageUrls = product.image.filter((u): u is string => typeof u === "string");
      }
      const availableAt = offers?.availableAtOrFrom as { address?: unknown } | undefined;
      const addr = (product.address ?? availableAt?.address) as Record<string, unknown> | undefined;
      if (addr) {
        if (!out.city && typeof addr.addressLocality === "string") out.city = addr.addressLocality;
        if (!out.postalCode && typeof addr.postalCode === "string") out.postalCode = addr.postalCode;
      }
    } catch {
      // bloc JSON-LD invalide : on passe au suivant
    }
  });
  return out;
}

function fromMeta($: cheerio.CheerioAPI): Partial<ParsedListing> {
  const meta = (prop: string): string | undefined =>
    $(`meta[property="${prop}"]`).attr("content") ?? $(`meta[name="${prop}"]`).attr("content") ?? undefined;
  const ogImage = meta("og:image");
  return {
    title: meta("og:title"),
    description: meta("og:description"),
    priceCents: toCents(meta("product:price:amount")),
    imageUrls: ogImage ? [ogImage] : [],
  };
}

function cleanImageUrl(u: string): string | null {
  try {
    const url = new URL(u.startsWith("//") ? `https:${u}` : u);
    if (url.protocol !== "https:") return null;
    if (!/leboncoin|lbcdn/i.test(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function parseListingHtml(html: string): ParsedListing {
  const $ = cheerio.load(html);
  const fromState = fromPreloadedState($);
  const fromLd = fromJsonLd($);
  const fromMt = fromMeta($);

  const title = fromState.title || fromLd.title || fromMt.title || $("h1").first().text().trim() || $("title").text().trim();
  const imageUrls = [
    ...(fromState.imageUrls ?? []),
    ...(fromLd.imageUrls ?? []),
    ...(fromMt.imageUrls ?? []),
  ]
    .map(cleanImageUrl)
    .filter((u): u is string => u !== null)
    .filter((u, i, arr) => arr.indexOf(u) === i);

  return {
    title,
    description: fromState.description || fromLd.description || fromMt.description || "",
    priceCents: fromState.priceCents ?? fromLd.priceCents ?? fromMt.priceCents ?? null,
    habitableM2: fromState.habitableM2 ?? null,
    gardenM2: fromState.gardenM2 ?? null,
    rooms: fromState.rooms ?? null,
    city: fromState.city || fromLd.city || "",
    postalCode: fromState.postalCode || fromLd.postalCode || "",
    imageUrls,
  };
}
