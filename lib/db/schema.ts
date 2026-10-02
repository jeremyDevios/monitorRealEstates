import { relations, sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
});

export const labels = sqliteTable("labels", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  color: text("color").notNull(),
});

// Statuts : "online" | "offline" | "unknown" (unknown tant qu'aucun contrôle n'a été concluant).
export const listings = sqliteTable(
  "listings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    url: text("url").unique(),
    source: text("source").notNull().default("url"), // "url" | "manual"
    title: text("title").notNull().default(""),
    description: text("description").notNull().default(""),
    priceCents: integer("price_cents"),
    habitableM2: real("habitable_m2"),
    gardenM2: real("garden_m2"),
    rooms: integer("rooms"),
    city: text("city").notNull().default(""),
    postalCode: text("postal_code").notNull().default(""),
    pricePerM2Min: real("price_per_m2_min"),
    pricePerM2Max: real("price_per_m2_max"),
    status: text("status").notNull().default("unknown"),
    labelId: integer("label_id").references(() => labels.id, { onDelete: "set null" }),
    createdById: integer("created_by_id")
      .notNull()
      .references(() => users.id),
    createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
    lastCheckedAt: integer("last_checked_at"),
  },
  (t) => [
    index("idx_listings_status").on(t.status),
    index("idx_listings_city").on(t.city),
  ],
);

// Un point de contrôle = une requête vers l'URL de l'annonce.
// `conclusive` distingue un verdict (en ligne ou hors ligne) d'un échec (403, erreur réseau…)
// qui ne doit pas modifier le statut de l'annonce.
export const listingChecks = sqliteTable(
  "listing_checks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    listingId: integer("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    checkedAt: integer("checked_at").notNull().default(sql`(unixepoch())`),
    online: integer("online", { mode: "boolean" }).notNull(),
    conclusive: integer("conclusive", { mode: "boolean" }).notNull().default(true),
    priceCents: integer("price_cents"),
    note: text("note"),
  },
  (t) => [index("idx_checks_listing").on(t.listingId)],
);

export const photos = sqliteTable(
  "photos",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    listingId: integer("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("idx_photos_listing").on(t.listingId)],
);

export const comments = sqliteTable(
  "comments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    listingId: integer("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
  },
  (t) => [index("idx_comments_listing").on(t.listingId)],
);

export const rates = sqliteTable("rates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bank: text("bank").notNull(),
  rate: real("rate").notNull(),
  // null = toutes durées (taux du marché, Banque de France)
  durationYears: integer("duration_years"),
  // "manual" = banque saisie à la main ; "market" = taux officiel Banque de France ;
  // "web" = baromètre relevé sur le web (MoneyVox)
  source: text("source").notNull().default("manual"),
  sourceUrl: text("source_url"),
  updatedAt: integer("updated_at").notNull().default(sql`(unixepoch())`),
});

// Vote d'un utilisateur sur une annonce, de 1 à 5 étoiles. Un vote par utilisateur et par annonce.
export const ratings = sqliteTable(
  "ratings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    listingId: integer("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    stars: integer("stars").notNull(),
    updatedAt: integer("updated_at").notNull().default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex("idx_ratings_unique").on(t.listingId, t.userId),
    index("idx_ratings_listing").on(t.listingId),
  ],
);

// Paramètres d'emprunt communs à tous les utilisateurs : une seule ligne (id = 1).
export const appSettings = sqliteTable("app_settings", {
  id: integer("id").primaryKey(),
  monthlyBudget: integer("monthly_budget").notNull().default(0),
  downPayment: integer("down_payment").notNull().default(0),
  durationYears: integer("duration_years").notNull().default(20),
  ratesFetchedAt: integer("rates_fetched_at"),
  // Fin de la restriction d'accès Leboncoin (protection anti-bot) — aucune requête avant.
  lbcRestrictedUntil: integer("lbc_restricted_until"),
  updatedAt: integer("updated_at").notNull().default(sql`(unixepoch())`),
});

// Historique quotidien des taux (un instantané par jour pour le graphique d'évolution).
export const rateHistory = sqliteTable(
  "rate_history",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bank: text("bank").notNull(),
    rate: real("rate").notNull(),
    durationYears: integer("duration_years"),
    source: text("source").notNull(),
    recordedAt: integer("recorded_at").notNull().default(sql`(unixepoch())`),
  },
  (t) => [
    index("idx_rate_history_bank").on(t.bank),
    index("idx_rate_history_recorded").on(t.recordedAt),
  ],
);

export const listingsRelations = relations(listings, ({ one, many }) => ({
  label: one(labels, { fields: [listings.labelId], references: [labels.id] }),
  createdBy: one(users, { fields: [listings.createdById], references: [users.id] }),
  checks: many(listingChecks),
  photos: many(photos),
  comments: many(comments),
  ratings: many(ratings),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  listing: one(listings, { fields: [comments.listingId], references: [listings.id] }),
  user: one(users, { fields: [comments.userId], references: [users.id] }),
}));

// Les relations inverses sont requises par drizzle pour inférer les relations `many`.
export const photosRelations = relations(photos, ({ one }) => ({
  listing: one(listings, { fields: [photos.listingId], references: [listings.id] }),
}));

export const listingChecksRelations = relations(listingChecks, ({ one }) => ({
  listing: one(listings, { fields: [listingChecks.listingId], references: [listings.id] }),
}));

export const ratingsRelations = relations(ratings, ({ one }) => ({
  listing: one(listings, { fields: [ratings.listingId], references: [listings.id] }),
  user: one(users, { fields: [ratings.userId], references: [users.id] }),
}));

export type Listing = typeof listings.$inferSelect;
