export async function register() {
  // Pas de planification pendant le build ni en développement.
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production") return;

  const { default: cron } = await import("node-cron");
  const { runCheckPass } = await import("./lib/status/checker");
  const { refreshMarketRates } = await import("./lib/rates/refresh");

  const checkExpr = process.env.CHECK_CRON ?? "17 */6 * * *";
  cron.schedule(checkExpr, () => {
    runCheckPass().catch((err) => console.error("[check-listings]", err));
  });
  console.log(`[monitor] vérification périodique des annonces planifiée : ${checkExpr}`);

  const ratesExpr = process.env.RATES_CRON ?? "13 7 * * *";
  cron.schedule(ratesExpr, () => {
    refreshMarketRates()
      .then((r) =>
        console.log(
          "[rates]",
          r.fetched ? `taux du marché actualisé : ${String(r.rate).replace(".", ",")} % (${r.date})` : r.reason,
        ),
      )
      .catch((err) => console.error("[rates]", err));
  });
  console.log(`[monitor] actualisation quotidienne des taux planifiée : ${ratesExpr}`);
}
