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
  settlement_person_a_percent?: number | string | null
  settlement_person_b_percent?: number | string | null
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
  icon?: string | null
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
  is_shared?: boolean | null
  category_id: string | null
  split_mode: SplitMode
  note: string | null
  rate_source: Expense['rateSource']
  created_at: string
  expense_splits?: Array<{ member_key: Member['id']; hkd_amount: number | string }>
}

const categoryIconRules: Array<[string[], string]> = [
  [['food', '\u9910', '\u98f2', '\u98df', '\u98ef', 'm\u8a18', '\u9ea5\u7576\u52de'], 'food'],
  [['coffee', '\u5496\u5561'], 'coffee'],
  [['grocery', '\u8d85\u5e02'], 'grocery'],
  [['transport', '\u4ea4\u901a'], 'transport'],
  [['train', '\u9435', 'mtr'], 'train'],
  [['car', '\u6c7d\u8eca', '\u7684\u58eb', 'uber'], 'car'],
  [['fuel', '\u6cb9'], 'fuel'],
  [['travel', '\u65c5\u884c', '\u6a5f\u7968', '\u9152\u5e97'], 'travel'],
  [['rent', '\u79df'], 'rent'],
  [['home', '\u5bb6\u5c45', '\u5c4b\u4f01'], 'home'],
  [['bill', '\u5e33\u55ae', '\u6c34\u96fb', '\u96fb\u8cbb'], 'bill'],
  [['water', '\u6c34\u8cbb'], 'water'],
  [['electricity', '\u96fb\u8cbb'], 'electricity'],
  [['gas', '\u7164\u6c23'], 'gas'],
  [['credit-card', '\u4fe1\u7528\u5361'], 'credit-card'],
  [['internet', '\u4e0a\u7db2', 'wifi'], 'internet'],
  [['insurance', '\u4fdd\u96aa'], 'insurance'],
  [['pet', '\u5bf5\u7269'], 'pet'],
  [['shopping', '\u8cfc\u7269'], 'shopping'],
  [['clothes', '\u8863\u7269'], 'clothes'],
  [['gift', '\u79ae\u7269'], 'gift'],
  [['fun', '\u5a1b\u6a02'], 'fun'],
  [['movie', '\u96fb\u5f71'], 'movie'],
  [['beauty', '\u7f8e\u5bb9'], 'beauty'],
  [['medical', '\u91ab\u7642', '\u91ab'], 'medical'],
  [['fitness', '\u5065\u8eab'], 'fitness'],
  [['education', '\u5b78\u7fd2'], 'education'],
  [['tech', '\u79d1\u6280', '\u96fb\u8166'], 'tech'],
  [['phone', '\u96fb\u8a71', '\u624b\u6a5f'], 'phone'],
  [['bank', '\u9280\u884c'], 'bank'],
  [['saving', '\u5132\u84c4'], 'saving'],
  [['tax', '\u7a05'], 'tax'],
  [['reward', '\u734e\u52f5'], 'reward'],
  [['food', '餐', '飲', '飯', '早', '午', '晚', 'm記', '麥當勞'], 'food'],
  [['coffee', '咖啡'], 'coffee'],
  [['grocery', '超市'], 'grocery'],
  [['transport', '交通'], 'transport'],
  [['train', '鐵', 'mtr'], 'train'],
  [['car', '汽車', '的士', 'uber'], 'car'],
  [['fuel', '油'], 'fuel'],
  [['travel', '旅行', '機票', '酒店'], 'travel'],
  [['rent', '租'], 'rent'],
  [['home', '家居', '屋企'], 'home'],
  [['bill', '帳單', '水電', '電費'], 'bill'],
  [['pet', '寵物'], 'pet'],
  [['shopping', '購物'], 'shopping'],
  [['clothes', '衣物'], 'clothes'],
  [['gift', '禮物'], 'gift'],
  [['fun', '娛樂'], 'fun'],
  [['movie', '電影'], 'movie'],
  [['beauty', '美容'], 'beauty'],
  [['medical', '醫療', '醫'], 'medical'],
  [['fitness', '健身'], 'fitness'],
  [['education', '學習'], 'education'],
  [['tech', '科技', '電腦'], 'tech'],
  [['phone', '電話', '手機'], 'phone'],
  [['bank', '銀行'], 'bank'],
  [['saving', '儲蓄'], 'saving'],
  [['tax', '稅'], 'tax'],
  [['reward', '獎勵'], 'reward'],
]

const defaultIconByCategoryId: Record<string, string> = {
  food: 'food',
  transport: 'transport',
  rent: 'rent',
  home: 'home',
  pet: 'pet',
  fun: 'fun',
  shopping: 'shopping',
  medical: 'medical',
  other: 'other',
}

function inferCategoryIcon(category: Pick<Category, 'id' | 'name' | 'icon'>) {
  const value = `${category.id} ${category.name}`.toLowerCase()
  const matched = categoryIconRules.find(([keywords]) => keywords.some((keyword) => value.includes(keyword.toLowerCase())))
  const inferred = matched?.[1] ?? defaultIconByCategoryId[category.id]

  if (inferred && inferred !== 'other') return inferred
  if (category.icon && category.icon !== category.id && category.icon !== 'other') return category.icon
  return inferred ?? 'other'
}

function normalizeCategories(categories: Category[]): Category[] {
  return categories.map((category) => ({
    ...category,
    icon: inferCategoryIcon(category),
  }))
}

function cloneDemoData(): AppData {
  const cloned = JSON.parse(JSON.stringify(demoData)) as AppData
  return { ...cloned, categories: normalizeCategories(cloned.categories) }
}

export function loadCachedAppData(): AppData | null {
  try {
    const saved = localStorage.getItem(storageKey)
    const parsed = saved ? (JSON.parse(saved) as AppData) : null
    return parsed ? { ...parsed, categories: normalizeCategories(parsed.categories) } : null
  } catch {
    return null
  }
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
    isShared: row.is_shared ?? true,
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
    return loadCachedAppData() ?? cloneDemoData()
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
    client
      .from('households')
      .select('id,name,base_currency,invite_code,settlement_person_a_percent,settlement_person_b_percent')
      .eq('id', householdId)
      .single(),
    client
      .from('household_members')
      .select('household_id,user_id,member_key,display_name,profiles(email)')
      .eq('household_id', householdId)
      .order('member_key'),
    client
      .from('categories')
      .select('id,name,color,icon')
      .eq('household_id', householdId)
      .order('created_at'),
    client
      .from('expenses')
      .select('id,household_id,expense_date,title,original_amount,original_currency,exchange_rate_to_hkd,hkd_amount,payer_key,is_shared,category_id,split_mode,note,rate_source,created_at,expense_splits(member_key,hkd_amount)')
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
    settlementRatio: {
      personA: toMoney(householdRow.settlement_person_a_percent ?? 50),
      personB: toMoney(householdRow.settlement_person_b_percent ?? 50),
    },
    members: normalizeMembers((membersResult.data ?? []) as MemberRow[]),
  }

  return {
    household,
    categories: normalizeCategories((categoriesResult.data ?? []) as CategoryRow[]),
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
    is_shared: expense.isShared ?? true,
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

export async function updateCloudExpense(expense: Expense) {
  const client = requireSupabase()
  const { error: expenseError } = await client
    .from('expenses')
    .update({
      expense_date: expense.date,
      title: expense.title,
      original_amount: expense.originalAmount,
      original_currency: expense.originalCurrency,
      exchange_rate_to_hkd: expense.exchangeRateToHkd,
      hkd_amount: expense.hkdAmount,
      payer_key: expense.payerId,
      is_shared: expense.isShared ?? true,
      category_id: expense.categoryId,
      split_mode: expense.splitMode,
      note: expense.note,
      rate_source: expense.rateSource,
    })
    .eq('id', expense.id)

  if (expenseError) throw expenseError

  const { error: splitError } = await client.from('expense_splits').upsert([
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

export async function insertCloudCategory(
  householdId: string,
  name: string,
  color: string,
  icon: string,
) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('categories')
    .insert({ household_id: householdId, name, color, icon })
    .select('id,name,color,icon')
    .single()

  if (error) throw error

  return data as Category
}

export async function deleteCloudCategory(categoryId: string) {
  const client = requireSupabase()
  const { error } = await client.from('categories').delete().eq('id', categoryId)

  if (error) {
    throw error
  }
}

export async function updateCloudCategoryIcon(categoryId: string, icon: string) {
  const client = requireSupabase()
  const { error } = await client.from('categories').update({ icon }).eq('id', categoryId)

  if (error) {
    throw error
  }
}

export async function updateCloudSettlementRatio(
  householdId: string,
  personA: number,
  personB: number,
) {
  const client = requireSupabase()
  const { error } = await client
    .from('households')
    .update({
      settlement_person_a_percent: personA,
      settlement_person_b_percent: personB,
    })
    .eq('id', householdId)

  if (error) {
    throw error
  }
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
  localStorage.setItem(storageKey, JSON.stringify({ ...data, categories: normalizeCategories(data.categories) }))
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
    settlementRatio: { personA: 50, personB: 50 },
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

export function updateCategoryIcon(data: AppData, categoryId: string, icon: string): AppData {
  return {
    ...data,
    categories: data.categories.map((category) => (
      category.id === categoryId ? { ...category, icon } : category
    )),
  }
}

export function deleteCategory(data: AppData, categoryId: string): AppData {
  return {
    ...data,
    categories: data.categories.filter((category) => category.id !== categoryId),
  }
}

export function updateSettlementRatio(
  data: AppData,
  personA: number,
  personB: number,
): AppData {
  return {
    ...data,
    household: {
      ...data.household,
      settlementRatio: { personA, personB },
    },
  }
}
