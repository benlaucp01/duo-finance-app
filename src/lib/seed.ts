import type { AppData, Category } from '../types'

export const defaultCategories: Category[] = [
  { id: 'food', name: '餐飲', color: '#f97316' },
  { id: 'transport', name: '交通', color: '#0ea5e9' },
  { id: 'rent', name: '租金', color: '#8b5cf6' },
  { id: 'home', name: '家居', color: '#10b981' },
  { id: 'pet', name: '寵物', color: '#14b8a6' },
  { id: 'fun', name: '娛樂', color: '#ec4899' },
  { id: 'shopping', name: '購物', color: '#f59e0b' },
  { id: 'medical', name: '醫療', color: '#ef4444' },
  { id: 'other', name: '其他', color: '#64748b' },
]

export const demoData: AppData = {
  household: {
    id: 'demo-household',
    name: '我們的帳本',
    inviteCode: 'HKD-2486',
    baseCurrency: 'HKD',
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
      title: '東京晚餐',
      originalAmount: 6800,
      originalCurrency: 'JPY',
      exchangeRateToHkd: 0.052,
      hkdAmount: 353.6,
      payerId: 'personA',
      categoryId: 'food',
      splitMode: 'equal',
      split: { personA: 176.8, personB: 176.8 },
      note: '旅行支出示例',
      rateSource: 'fallback',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'expense-2',
      householdId: 'demo-household',
      date: new Date().toISOString().slice(0, 10),
      title: '機場快線',
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
