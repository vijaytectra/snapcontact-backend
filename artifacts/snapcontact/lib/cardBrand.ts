export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'rupay' | 'unknown';

export function detectCardBrand(num: string): CardBrand {
  const n = num.replace(/\s+/g, '');
  if (/^4/.test(n)) return 'visa';
  if (/^5[1-5]/.test(n) || /^2(22[1-9]|2[3-9]|[3-6]|7[0-1]|720)/.test(n)) return 'mastercard';
  if (/^3[47]/.test(n)) return 'amex';
  if (/^6(0|5|8)/.test(n) || /^8[1-9]/.test(n) || /^9[0-9]/.test(n)) return 'rupay';
  return 'unknown';
}

export function cardBrandLabel(b: CardBrand): string {
  switch (b) {
    case 'visa': return 'Visa';
    case 'mastercard': return 'Mastercard';
    case 'amex': return 'American Express';
    case 'rupay': return 'RuPay';
    default: return 'Card';
  }
}
