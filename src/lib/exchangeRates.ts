import type { CurrencyCode } from '../types'

const fallbackRatesToHkd: Record<CurrencyCode, number> = {
  HKD: 1,
  JPY: 0.052,
  TWD: 0.242,
  USD: 7.8,
  EUR: 8.4,
  GBP: 9.75,
  CNY: 1.08,
  KRW: 0.0057,
  THB: 0.215,
  SGD: 5.82,
}

export type ExchangeRateResult = {
  rate: number
  source: 'hkd' | 'auto' | 'fallback'
}

export async function getExchangeRateToHkd(
  currency: CurrencyCode,
  date: string,
): Promise<ExchangeRateResult> {
  if (currency === 'HKD') {
    return { rate: 1, source: 'hkd' }
  }

  try {
    const response = await fetch(
      `https://api.frankfurter.app/${date}?from=${currency}&to=HKD`,
    )

    if (!response.ok) {
      throw new Error('Exchange rate service unavailable')
    }

    const data = (await response.json()) as { rates?: { HKD?: number } }
    const rate = data.rates?.HKD

    if (!rate || Number.isNaN(rate)) {
      throw new Error('Exchange rate missing')
    }

    return { rate, source: 'auto' }
  } catch {
    return { rate: fallbackRatesToHkd[currency], source: 'fallback' }
  }
}
