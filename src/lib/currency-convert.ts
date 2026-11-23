const USD_TO_MAD = Number(process.env.USD_TO_MAD || "10");

function toUsd(amount: number, currency: string) {
  if (currency === "MAD") return Math.round(amount / USD_TO_MAD);
  return amount;
}

export function convertCurrency(amount: number, from: string, to: string) {
  if (from === to) return amount;
  if (to === "MAD") {
    const usd = toUsd(amount, from);
    return Math.round(usd * (Number.isFinite(USD_TO_MAD) && USD_TO_MAD > 0 ? USD_TO_MAD : 10));
  }
  return toUsd(amount, from);
}
