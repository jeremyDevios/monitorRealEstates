import { runCheckPass } from "../lib/status/checker";

runCheckPass()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[check-listings]", err);
    process.exit(1);
  });
