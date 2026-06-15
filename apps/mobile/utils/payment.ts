/**
 * Couche d'abstraction paiement mobile money (Orange / Moov).
 *
 * ⚠️ MOCK pour cette itération : `confirm()` valide l'OTP `0000` (mode démo).
 * Pour brancher un provider réel (CinetPay / Fedapay / API opérateur), remplacer
 * l'implémentation de `paymentProvider` SANS toucher à l'UI (même interface).
 * Le vrai flux déclenchera idéalement un push USSD/STK + confirmation OTP.
 */

export type MobileMethod = 'orange_money' | 'moov_money';

export interface PaymentResult {
  transactionId: string;
  payerPhone?: string;
}

export interface PaymentProvider {
  /** Code USSD à composer (placeholder tant que l'API n'est pas branchée). */
  ussdCode(method: MobileMethod, amountXOF: number): string;
  /** Confirme le paiement à partir de l'OTP reçu. Rejette si invalide. */
  confirm(method: MobileMethod, otp: string, amountXOF: number): Promise<PaymentResult>;
}

const DEMO_OTP = '0000';

export const mockPaymentProvider: PaymentProvider = {
  ussdCode(method, amount) {
    return method === 'orange_money'
      ? `*144*4*6*${amount}#` // exemple Orange Money BF (à adapter au code marchand réel)
      : `*155*1*${amount}#`; // exemple Moov Money BF
  },
  async confirm(method, otp) {
    await new Promise((r) => setTimeout(r, 700));
    if (otp !== DEMO_OTP) {
      throw new Error('Code incorrect. En mode démo, saisis 0000.');
    }
    return {
      transactionId: `${method === 'orange_money' ? 'OM' : 'MV'}-${Date.now().toString(36).toUpperCase()}`,
    };
  },
};

/** Provider actif (swap ici pour le réel). */
export const paymentProvider: PaymentProvider = mockPaymentProvider;

export const DEMO_OTP_HINT = DEMO_OTP;
