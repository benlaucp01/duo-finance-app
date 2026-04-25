import type { User } from '@supabase/supabase-js'
import type { AppData, Category, CurrencyCode, Expense, Household, Member, SplitMode } from '../types'
import { demoData } from './seed'
import { isSupabaseConfigured, supabase } from './supabase'

const storageKey = 'duo-finance-data'

type HouseholdRow = {
  id: string
  name: string
  base_currency: 'HKD'
  invite_code: string
}

type MemberRow = {
  household_id: string
  user_id: string | null
  member_key: Member['id']
  display_name: string
  profiles?: { email?: string | null } | null
}

type CategoryRow = {
  id: string
  name: string
  color: string
}

type ExpenseRow = {
  id: string
  household_id: string
  expense_date: string
  title: string
  original_amount: number | string
  original_currency: CurrencyCode
  exchange_rate_to_hkd: number | string
  hkd_amount: number | string
  payer_key: Member['id']
  category_id: string | null
  split_mode: SplitMode
  note: string | null
  rate_source: Expense['rateSource']
  created_at: string
  expense_splits?: Array<{ member_key: Member['id']; hkd_amount: number | string }>
}

function cloneDemoData(): AppData {
  return JSON.parse(JSON.stringify(demoData)) as AppData
}

function generateInviteCode() {
  return `HKD-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  return supabase
}

function toMoney(value: number | string | null | undefined) {
  return Number(value ?? 0)
}

function normalizeMembers(rows: MemberRow[]): [Member, Member] {
  const personA = rows.find((row) => row.member_key === 'personA')
  const personB = rows.find((row) => row.member_key === 'personB')

  return [
    {
      id: 'personA',
      name: personA?.display_name || 'Person A',
      email: personA?.profiles?.email ?? undefined,
      userId: personA?.user_id ?? undefined,
    },
    {
      id: 'personB',
      name: personB?.display_name || 'Person B',
      email: personB?.profiles?.email ?? undefined,
      userId: personB?.user_id ?? undefined,
    },
  ]
}

function mapExpense(row: ExpenseRow): Expense {
  const splits = row.expense_splits ?? []
  const personA = splits.find((split) => split.member_key === 'personA')
  const personB = splits.find((split) => split.member_key === 'personB')

  return {
    id: row.id,
    householdId: row.household_id,
    date: row.expense_date,
    title: row.title,
    originalAmount: toMoney(row.original_amount),
    originalCurrency: row.original_currency,
    exchangeRateToHkd: toMoney(row.exchange_rate_to_hkd),
    hkdAmount: toMoney(row.hkd_amount),
    payerId: row.payer_key,
    categoryId: row.category_id ?? 'other',
    splitMode: row.split_mode,
    split: {
      personA: toMoney(personA?.hkd_amount),
      personB: toMoney(personB?.hkd_amount),
    },
    note: row.note ?? '',
    rateSource: row.rate_source,
    createdAt: row.created_at,
  }
}

async function getUser() {
  const client = requireSupabase()
  const { data, error } = await client.auth.getUser()

  if (error) {
    throw error
  }

  return data.user
}

export async function loadAppData(): Promise<AppData> {
  if (!isSupabaseConfigured || !supabase) {
    const saved = localStorage.getItem(storageKey)
    return saved ? (JSON.parse(saved) as AppData) : cloneDemoData()
  }

  const user = await getUser()
  if (!user) {
    return cloneDemoData()
  }

  const cloudData = await loadCloudAppData(user)
  return cloudData ?? cloneDemoData()
}

export async function loadCloudAppData(user?: User): Promise<AppData | null> {
  const client = requireSupabase()
  const activeUser = user ?? (await getUser())

  if (!activeUser) {
    return null
  }

  await ensureProfile(activeUser)

  const { data: membership, error: membershipError } = await client
    .from('household_members')
    .select('household_id')
    .eq('user_id', activeUser.id)
    .limit(1)
    .maybeSingle()

  if (membershipError) {
    throw membershipError
  }

  if (!membership) {
    return null
  }

  return loadCloudHousehold(membership.household_id)
}

export async function loadCloudHousehold(householdId: string): Promise<AppData> {
  const client = requireSupabase()

  const [
    householdResult,
    membersResult,
    categoriesResult,
    expensesResult,
  ] = await Promise.all([
    client.from('households').select('id,name,base_currency,invite_code').eq('id', householdId).single(),
    client
      .from('household_members')
      .select('household_id,user_id,member_key,display_name,profiles(email)')
      .eq('household_id', householdId)
      .order('member_key'),
    client
      .from('categories')
      .select('id,name,color')
      .eq('household_id', householdId)
      .order('created_at'),
    client
      .from('expenses')
      .select('id,household_id,expense_date,title,original_amount,original_currency,exchange_rate_to_hkd,hkd_amount,payer_key,category_id,split_mode,note,rate_source,created_at,expense_splits(member_key,hkd_amount)')
      .eq('household_id', householdId)
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false }),
  ])

  if (householdResult.error) throw householdResult.error
  if (membersResult.error) throw membersResult.error
  if (categoriesResult.error) throw categoriesResult.error
  if (expensesResult.error) throw expensesResult.error

  const householdRow = householdResult.data as HouseholdRow
  const household: Household = {
    id: householdRow.id,
    name: householdRow.name,
    inviteCode: householdRow.invite_code,
    baseCurrency: householdRow.base_currency,
    members: normalizeMembers((membersResult.data ?? []) as MemberRow[]),
  }

  return {
    household,
    categories: (categoriesResult.data ?? []) as CategoryRow[],
    expenses: ((expensesResult.data ?? []) as ExpenseRow[]).map(mapExpense),
  }
}

export async function ensureProfile(user: User) {
  const client = requireSupabase()
  const email = user.email ?? ''
  const displayName =
    (user.user_metadata?.name as string | undefined) ??
    email.split('@')[0] ??
    'User'

  const { error } = await client.from('profiles').upsert({
    id: user.id,
    email,
    display_name: displayName,
  })

  if (error) {
    throw error
  }
}

export async function sendMagicLink(email: string) {
  const client = requireSupabase()
  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin,
    },
  })

  if (error) {
    throw error
  }
}

export async function signOut() {
  const client = requireSupabase()
  const { error } = await client.auth.signOut()

  if (error) {
    throw error
  }
}

export async function createCloudHousehold(
  personAName: string,
  personBName: string,
) {
  const client = requireSupabase()
  const user = await getUser()

  if (!user) {
    throw new Error('Please sign in first.')
  }

  await ensureProfile(user)

  const { data: householdId, error } = await client.rpc('create_household_with_defaults', {
    person_a_name_input: personAName || 'Ben',
    person_b_name_input: personBName || 'Jamie',
  })

  if (error) throw error

  return loadCloudHousehold(householdId as string)
}

export async function joinCloudHousehold(inviteCode: string, displayName: string) {
  const client = requireSupabase()
  const user = await getUser()

  if (!user) {
    throw new Error('Please sign in first.')
  }

  await ensureProfile(user)

  const { data, error } = await client.rpc('join_household_by_invite', {
    invite_code_input: inviteCode.trim().toUpperCase(),
    display_name_input: displayName || 'Partner',
  })

  if (error) throw error

  return loadCloudHousehold(data as string)
}

export async function insertCloudExpense(expense: Expense) {
  const client = requireSupabase()
  const user = await getUser()

  if (!user) {
    throw new Error('Please sign in first.')
  }

  const { error: expenseError } = await client.from('expenses').insert({
    id: expense.id,
    household_id: expense.householdId,
    expense_date: expense.date,
    title: expense.title,
    original_amount: expense.originalAmount,
    original_currency: expense.originalCurrency,
    exchange_rate_to_hkd: expense.exchangeRateToHkd,
    hkd_amount: expense.hkdAmount,
    payer_key: expense.payerId,
    category_id: expense.categoryId,
    split_mode: expense.splitMode,
    note: expense.note,
    rate_source: expense.rateSource,
    created_by: user.id,
  })

  if (expenseError) throw expenseError

  const { error: splitError } = await client.from('expense_splits').insert([
    {
      expense_id: expense.id,
      member_key: 'personA',
      hkd_amount: expense.split.personA,
    },
    {
      expense_id: expense.id,
      member_key: 'personB',
      hkd_amount: expense.split.personB,
    },
  ])

  if (splitError) throw splitError
}

export async function deleteCloudExpense(expenseId: string) {
  const client = requireSupabase()
  const { error } = await client.from('expenses').delete().eq('id', expenseId)

  if (error) {
    throw error
  }
}

export async function insertCloudCategory(householdId: string, name: string, color: string) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('categories')
    .insert({ household_id: householdId, name, color })
    .select('id,name,color')
    .single()

  if (error) throw error

  return data as Category
}

export function subscribeToHousehold(householdId: string, onChange: () => void) {
  if (!supabase) {
    return () => undefined
  }

  const channel = supabase
    .channel(`household-${householdId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `household_id=eq.${householdId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'categories', filter: `household_id=eq.${householdId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'household_members', filter: `household_id=eq.${householdId}` }, onChange)
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
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
    inviteCode: generateInviteCode(),
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
