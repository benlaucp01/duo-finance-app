export type CurrencyCode =
  | 'HKD'
  | 'JPY'
  | 'TWD'
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'CNY'
  | 'KRW'
  | 'THB'
  | 'SGD'

export type SplitMode = 'equal' | 'personA' | 'personB' | 'custom'

export type Category = {
  id: string
  name: string
  color: string
}

export type Member = {
  id: 'personA' | 'personB'
  name: string
  email?: string
}

export type Household = {
  id: string
  name: string
  inviteCode: string
  baseCurrency: 'HKD'
  members: [Member, Member]
}

export type ExpenseSplit = {
  personA: number
  personB: number
}

export type Expense = {
  id: string
  householdId: string
  date: string
  title: string
  originalAmount: number
  originalCurrency: CurrencyCode
  exchangeRateToHkd: number
  hkdAmount: number
  payerId: Member['id']
  categoryId: string
  splitMode: SplitMode
  split: ExpenseSplit
  note: string
  rateSource: 'hkd' | 'auto' | 'manual' | 'fallback'
  createdAt: string
}

export type AppData = {
  household: Household
  categories: Category[]
  expenses: Expense[]
}

export type Settlement = {
  totalHkd: number
  paid: ExpenseSplit
  owed: ExpenseSplit
  net: ExpenseSplit
  transfer: {
    from: Member['id'] | null
    to: Member['id'] | null
    amount: number
  }
  byCategory: Array<{
    categoryId: string
    amount: number
  }>
  byCurrency: Array<{
    currency: CurrencyCode
    originalAmount: number
    hkdAmount: number
  }>
}
