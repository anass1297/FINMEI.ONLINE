/**
 * Payment provider abstraction — prepared for Stripe and PayPal.
 *
 * Contract: a payment is NEVER recorded as received based on a redirect,
 * client callback, or unverified request. Only two paths create COMPLETED
 * payments:
 *   1. The user manually records a payment they have received (provider "manual").
 *   2. A provider webhook whose signature has been verified server-side
 *      reports a succeeded/captured payment (see /api/webhooks/[provider]).
 */
export type CheckoutSession = { url: string; providerRef: string };

export type VerifiedPaymentEvent = {
  provider: "stripe" | "paypal";
  providerRef: string; // unique id of the charge/capture (idempotency key)
  invoicePublicToken: string;
  amount: number; // minor units
  currency: string;
  status: "COMPLETED" | "FAILED" | "REFUNDED";
  occurredAt: Date;
};

export interface PaymentProvider {
  id: "stripe" | "paypal";
  isConfigured(): boolean;
  /** Creates a hosted checkout for an invoice balance. */
  createCheckout(input: { invoiceId: string; publicToken: string; amount: number; currency: string; description: string; returnUrl: string }): Promise<CheckoutSession>;
  /** Verifies the webhook signature and returns a normalized event, or null if irrelevant. Must throw on invalid signature. */
  verifyWebhook(rawBody: string, headers: Headers): Promise<VerifiedPaymentEvent | null>;
}

class NotImplementedProvider implements PaymentProvider {
  constructor(public id: "stripe" | "paypal", private envKeys: string[]) {}
  isConfigured() {
    return this.envKeys.every((k) => Boolean(process.env[k]));
  }
  async createCheckout(): Promise<CheckoutSession> {
    throw new Error(`${this.id} checkout is not enabled yet`);
  }
  async verifyWebhook(): Promise<VerifiedPaymentEvent | null> {
    // Intentionally rejects everything until a real signature check is implemented
    // (stripe.webhooks.constructEvent / PayPal verify-webhook-signature API).
    throw new Error(`${this.id} webhook verification is not implemented`);
  }
}

export const providers: Record<string, PaymentProvider> = {
  stripe: new NotImplementedProvider("stripe", ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]),
  paypal: new NotImplementedProvider("paypal", ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYPAL_WEBHOOK_ID"]),
};

export const PAYMENT_METHODS = [
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "CARD", label: "Card" },
  { value: "CASH", label: "Cash" },
  { value: "CHECK", label: "Check" },
  { value: "PAYPAL", label: "PayPal" },
  { value: "STRIPE", label: "Stripe" },
  { value: "MOBILE_MONEY", label: "Mobile money" },
  { value: "OTHER", label: "Other" },
] as const;

export function methodLabel(v: string) {
  return PAYMENT_METHODS.find((m) => m.value === v)?.label ?? v;
}
