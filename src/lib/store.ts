import type { AppData, Category, Expense, Household } from '../types'
import { demoData } from './seed'
import { isSupabaseConfigured, supabase } from './supabase'

const storageKey = 'duo-finance-data'

function cloneDemoData(): AppData {
  return JSON.parse(JSON.stringify(demoData)) as AppData
}

export async function loadAppData(): Promise<AppData> {
  if (!isSupabaseConfigured || !supabase) {
    const saved = localStorage.getItem(storageKey)
    return saved ? (JSON.parse(saved) as AppData) : cloneDemoData()
  }

  // The production schema is provided in supabase/schema.sql. Until a user signs
  // in and creates a household, keep the app usable with the local demo dataset.
  return cloneDemoData()
}

export async function saveLocalAppData(data: AppData) {
  localStorage.setItem(storageKey, JSON.stringify(data))
}

export function buildHousehold(
  personAName: string,
  personBName: string,
): Household {
  return {
    id: crypto.randomUUID(),
    name: '我們的帳本',
    inviteCode: `HKD-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    baseCurrency: 'HKD',
    members: [
      { id: 'personA', name: personAName || 'Person A' },
      { id: 'personB', name: personBName || 'Person B' },
    ],
  }
}

export function upsertExpense(data: AppData, expense: Expense): AppData {
  const exists = data.expenses.some((item) => item.id === expense.id)

  return {
    ...data,
    expenses: exists
      ? data.expenses.map((item) => (item.id === expense.id ? expense : item))
      : [expense, ...data.expenses],
  }
}

export function deleteExpense(data: AppData, expenseId: string): AppData {
  return {
    ...data,
    expenses: data.expenses.filter((expense) => expense.id !== expenseId),
  }
}

export function addCategory(data: AppData, category: Category): AppData {
  return {
    ...data,
    categories: [...data.categories, category],
  }
}
