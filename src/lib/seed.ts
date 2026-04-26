import type { AppData, Category } from '../types'

export const defaultCategories: Category[] = [
  { id: 'food', name: '餐飲', color: '#b7ff16', icon: 'food' },
  { id: 'transport', name: '交通', color: '#7fdc12', icon: 'transport' },
  { id: 'rent', name: '租金', color: '#8fb8ff', icon: 'home' },
  { id: 'home', name: '家居', color: '#64d6b5', icon: 'home' },
  { id: 'pet', name: '寵物', color: '#ffd6ff', icon: 'pet' },
  { id: 'fun', name: '娛樂', color: '#bfa7ff', icon: 'fun' },
  { id: 'shopping', name: '購物', color: '#ffd166', icon: 'shopping' },
  { id: 'medical', name: '醫療', color: '#ff8fab', icon: 'medical' },
  { id: 'other', name: '其他', color: '#94a3b8', icon: 'other' },
]

export const demoData: AppData = {
  household: {
    id: 'demo-household',
    name: '我們的帳本',
    inviteCode: 'HKD-2486',
    baseCurrency: 'HKD',
    settlementRatio: { personA: 50, personB: 50 },
    members: [
      { id: 'personA', name: 'Ben', email: 'ben@example.com' },
      { id: 'personB', name: 'Jamie', email: 'jamie@example.com' },
    ],
  },
  categories: defaultCategories,
  expenses: [
    {
      id: 'expense-1',
      householdId: 'demo-household',
      date: new Date().toISOString().slice(0, 10),
      title: '日本午餐',
      originalAmount: 6800,
      originalCurrency: 'JPY',
      exchangeRateToHkd: 0.052,
      hkdAmount: 353.6,
      payerId: 'personA',
      categoryId: 'food',
      splitMode: 'equal',
      split: { personA: 176.8, personB: 176.8 },
      note: '示範外幣支出',
      rateSource: 'fallback',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'expense-2',
      householdId: 'demo-household',
      date: new Date().toISOString().slice(0, 10),
      title: '巴士及地鐵',
      originalAmount: 230,
      originalCurrency: 'HKD',
      exchangeRateToHkd: 1,
      hkdAmount: 230,
      payerId: 'personB',
      categoryId: 'transport',
      splitMode: 'equal',
      split: { personA: 115, personB: 115 },
      note: '',
      rateSource: 'hkd',
      createdAt: new Date().toISOString(),
    },
  ],
}
