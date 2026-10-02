import { stdin as input, stdout as output } from "node:process";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, users } from "../lib/db";

// Création d'un compte — seule voie d'inscription, à exécuter sur le serveur.
// Usage : npm run create-user -- <identifiant> [--admin]

function usage(): never {
  console.error("Usage : npm run create-user -- <identifiant> [--admin]");
  process.exit(1);
}

/** Saisie de mot de passe sans écho dans le terminal. */
function promptHidden(question: string): Promise<string> {
  output.write(question);
  return new Promise((resolve) => {
    const wasRaw = input.isRaw;
    input.setRawMode(true);
    input.resume();
    input.setEncoding("utf8");
    let buf = "";
    const cleanup = () => {
      input.setRawMode(wasRaw);
      input.off("data", onData);
      input.pause();
    };
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\u0003") {
          cleanup();
          process.exit(130);
        } else if (ch === "\r" || ch === "\n") {
          output.write("\n");
          cleanup();
          resolve(buf);
          return;
        } else if (ch === "\u007f" || ch === "\b") {
          buf = buf.slice(0, -1);
        } else {
          buf += ch;
        }
      }
    };
    input.on("data", onData);
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const flags = args.filter((a) => a.startsWith("--"));
  const rest = args.filter((a) => !a.startsWith("--"));
  if (rest.length < 1 || rest.length > 2) usage();
  if (flags.some((f) => f !== "--admin")) usage();
  const [username, passwordArg] = rest;

  if (!/^[a-z0-9._-]{2,32}$/i.test(username)) {
    console.error("Identifiant invalide : 2 à 32 caractères parmi lettres, chiffres, point, tiret, underscore.");
    process.exit(1);
  }
  const existing = await db.select().from(users).where(eq(users.username, username));
  if (existing.length) {
    console.error(`Le compte « ${username} » existe déjà.`);
    process.exit(1);
  }

  const password = passwordArg ?? (await promptHidden("Mot de passe : "));
  if (password.length < 8) {
    console.error("Mot de passe trop court (8 caractères minimum).");
    process.exit(1);
  }
  if (!passwordArg) {
    const confirm = await promptHidden("Confirmer le mot de passe : ");
    if (confirm !== password) {
      console.error("Les mots de passe ne correspondent pas.");
      process.exit(1);
    }
  }

  await db
    .insert(users)
    .values({ username, passwordHash: bcrypt.hashSync(password, 10), isAdmin: flags.includes("--admin") });
  console.log(`Compte « ${username} » créé${flags.includes("--admin") ? " (admin)" : ""}.`);
  process.exit(0);
}

main();
