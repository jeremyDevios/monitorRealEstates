export type CreditSettings = {
  monthlyBudget: number;
  downPayment: number;
  durationYears: number;
};

export const DEFAULT_CREDIT_SETTINGS: CreditSettings = {
  monthlyBudget: 0,
  downPayment: 0,
  durationYears: 20,
};

/** Frais de notaire estimés pour un achat dans l'ancien. */
export const NOTARY_FEES_PCT = 7.5;

export const MARKET_SOURCE = "market";

/** Facteur d'annuité : valeur actuelle d'une série de n mensualités de 1 € au taux annuel donné. */
export function annuityFactor(annualRatePct: number, years: number): number {
  const i = annualRatePct / 100 / 12;
  const n = Math.max(1, Math.round(years * 12));
  return i === 0 ? n : (1 - Math.pow(1 + i, -n)) / i;
}

/**
 * Montant empruntable avec un budget mensuel donné, en tenant compte d'une
 * assurance emprunteur exprimée en % du capital initial par an.
 */
export function capacityFor(monthlyBudget: number, annualRatePct: number, years: number, insurancePct = 0): number {
  if (monthlyBudget <= 0) return 0;
  const f = annuityFactor(annualRatePct, years);
  const a = insurancePct / 100 / 12;
  return Math.round((monthlyBudget * f) / (1 + f * a));
}

/** Mensualité (capital + intérêts + assurance) pour un montant emprunté donné. */
export function paymentFor(amount: number, annualRatePct: number, years: number, insurancePct = 0): number {
  const f = annuityFactor(annualRatePct, years);
  const a = insurancePct / 100 / 12;
  return Math.round(amount / f + amount * a);
}

/** Intérêts totaux payés sur la durée du prêt (hors assurance). */
export function totalInterest(amount: number, annualRatePct: number, years: number): number {
  const i = annualRatePct / 100 / 12;
  const n = Math.max(1, Math.round(years * 12));
  const payment = i === 0 ? amount / n : (amount * i) / (1 - Math.pow(1 + i, -n));
  return Math.max(0, Math.round(payment * n - amount));
}

export type CreditPlan = {
  monthlyBudget: number;
  capacity: number;
  interest: number;
  totalCost: number;
  /** Prêt + apport. */
  budget: number;
  /** Prix max du bien une fois les frais de notaire déduits du budget. */
  priceWithFees: number;
  fees: number;
};

export function computePlan(s: CreditSettings, annualRatePct: number, insurancePct = 0): CreditPlan {
  const capacity = capacityFor(s.monthlyBudget, annualRatePct, s.durationYears, insurancePct);
  const interest = totalInterest(capacity, annualRatePct, s.durationYears);
  const budget = capacity + s.downPayment;
  const priceWithFees = Math.round(budget / (1 + NOTARY_FEES_PCT / 100));
  return {
    monthlyBudget: s.monthlyBudget,
    capacity,
    interest,
    totalCost: capacity + interest,
    budget,
    priceWithFees,
    fees: budget - priceWithFees,
  };
}
