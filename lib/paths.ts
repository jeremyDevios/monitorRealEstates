import os from "node:os";
import path from "node:path";

// Chemins des données locales (base SQLite, profils navigateur, photos).
// Au build, Turbopack travaille dans un cwd virtuel et n'a pas besoin des données :
// on pointe alors vers un répertoire temporaire inoffensif (jamais lu ni écrit).
const IS_BUILD = process.env.NEXT_PHASE === "phase-production-build";

/**
 * Répertoire des données locales. Par défaut `data/` sous le répertoire de
 * lancement (lancer l'app depuis la racine du projet). Pour un service lancé
 * avec un autre répertoire de travail, définir DATA_DIR en chemin absolu —
 * c'est le moyen garanti de retrouver ses données après un redémarrage.
 */
export function dataDir(): string {
  if (IS_BUILD) return path.join(os.tmpdir(), "mre-build-data");
  if (process.env.DATA_DIR) return path.resolve(process.env.DATA_DIR);
  return path.join(process.cwd(), "data");
}

/** Répertoire des photos d'annonces (servies par Next depuis /photos). */
export function photosDir(): string {
  return path.join(IS_BUILD ? os.tmpdir() : process.cwd(), "public", "photos");
}

export function browserProfileDir(): string {
  return path.join(dataDir(), "browser-profile");
}
