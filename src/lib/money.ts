import type { CurrencyCode } from '../types'

export const currencies: CurrencyCode[] = [
  'HKD',
  'JPY',
  'TWD',
  'USD',
  'EUR',
  'GBP',
  'CNY',
  'KRW',
  'THB',
  'SGD',
]

const symbols: Record<CurrencyCode, string> = {
  HKD: 'HK$',
  JPY: 'JP¥',
  TWD: 'NT$',
  USD: 'US$',
  EUR: '€',
  GBP: '£',
  CNY: 'CN¥',
  KRW: '₩',
  THB: '฿',
  SGD: 'S$',
}

export function formatMoney(amount: number, currency: CurrencyCode = 'HKD') {
  const digits = currency === 'JPY' || currency === 'KRW' ? 0 : 2

  return `${symbols[currency]}${amount.toLocaleString('en-HK', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function todayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

export function currentMonthInputValue() {
  return new Date().toISOString().slice(0, 7)
}
