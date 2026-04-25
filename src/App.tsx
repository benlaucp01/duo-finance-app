import {
  CalendarDays,
  Check,
  CircleDollarSign,
  Cloud,
  Coins,
  Copy,
  Home,
  HomeIcon,
  List,
  LogOut,
  Mail,
  PawPrint,
  Plus,
  Settings,
  ShoppingBag,
  Trash2,
  UserRound,
  Utensils,
  WalletCards,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import './App.css'
import { getExchangeRateToHkd } from './lib/exchangeRates'
import {
  currencies,
  currentMonthInputValue,
  formatMoney,
  roundMoney,
  todayInputValue,
} from './lib/money'
import { buildSplit, calculateSettlement, expensesForMonth } from './lib/settlement'
import { defaultCategories } from './lib/seed'
import {
  addCategory,
  buildHousehold,
  createCloudHousehold,
  deleteCloudExpense,
  deleteExpense,
  insertCloudCategory,
  insertCloudExpense,
  joinCloudHousehold,
  loadAppData,
  loadCloudAppData,
  saveLocalAppData,
  sendMagicLink,
  signOut,
  subscribeToHousehold,
  upsertExpense,
} from './lib/store'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import type { AppData, CurrencyCode, Expense, Member, SplitMode } from './types'

type Tab = 'overview' | 'add' | 'records' | 'settings'
type ThemeName = 'neon' | 'dream'

type ExpenseFormState = {
  title: string
  date: string
  amount: string
  currency: CurrencyCode
  categoryId: string
  splitMode: SplitMode
  customPersonA: string
  note: string
  manualRate: string
  useManualRate: boolean
}

const profileStorageKey = 'duo-finance-current-profile'
const themeStorageKey = 'duo-finance-theme'

const initialForm: ExpenseFormState = {
  title: '',
  date: todayInputValue(),
  amount: '',
  currency: 'HKD',
  categoryId: 'food',
  splitMode: 'equal',
  customPersonA: '',
  note: '',
  manualRate: '',
  useManualRate: false,
}

const categoryColors = [
  '#b7ff16',
  '#7fdc12',
  '#8fb8ff',
  '#64d6b5',
  '#ffd6ff',
  '#bfa7ff',
]

function App() {
  const cloudMode = isSupabaseConfigured && Boolean(supabase)
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [theme, setTheme] = useState<ThemeName>(
    () => (localStorage.getItem(themeStorageKey) as ThemeName | null) ?? 'neon',
  )
  const [user, setUser] = useState<User | null>(null)
  const [authEmail, setAuthEmail] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [joinName, setJoinName] = useState('')
  const [data, setData] = useState<AppData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentProfileId, setCurrentProfileId] = useState<Member['id'] | null>(
    () => (localStorage.getItem(profileStorageKey) as Member['id'] | null) ?? null,
  )
  const [month, setMonth] = useState(currentMonthInputValue())
  const [form, setForm] = useState<ExpenseFormState>(initialForm)
  const [quickAmount, setQuickAmount] = useState('')
  const [quickCategoryId, setQuickCategoryId] = useState('food')
  const [isQuickSaving, setIsQuickSaving] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [personAName, setPersonAName] = useState('')
  const [personBName, setPersonBName] = useState('')
  const [newCategory, setNewCategory] = useState('')

  useEffect(() => {
    localStorage.setItem(themeStorageKey, theme)
  }, [theme])

  useEffect(() => {
    let isMounted = true

    async function boot() {
      setIsLoading(true)

      if (cloudMode && supabase) {
        const { data: sessionData } = await supabase.auth.getSession()
        const activeUser = sessionData.session?.user ?? null
        if (!isMounted) return

        setUser(activeUser)
        applyLoadedData(activeUser ? await loadCloudAppData(activeUser) : null, activeUser)
      } else {
        const loaded = await loadAppData()
        if (!isMounted) return
        applyLoadedData(loaded, null)
      }

      setIsLoading(false)
    }

    void boot()

    if (!cloudMode || !supabase) {
      return () => {
        isMounted = false
      }
    }

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const activeUser = session?.user ?? null
      setUser(activeUser)
      setIsLoading(true)
      loadCloudAppData(activeUser ?? undefined)
        .then((loaded) => applyLoadedData(loaded, activeUser))
        .finally(() => setIsLoading(false))
    })

    return () => {
      isMounted = false
      listener.subscription.unsubscribe()
    }
  }, [cloudMode])

  useEffect(() => {
    if (!data || cloudMode) {
      return
    }

    void saveLocalAppData(data)
  }, [cloudMode, data])

  useEffect(() => {
    if (!cloudMode || !data) {
      return
    }

    return subscribeToHousehold(data.household.id, async () => {
      const refreshed = await loadCloudAppData(user ?? undefined)
      applyLoadedData(refreshed, user)
    })
  }, [cloudMode, data?.household.id, user])

  const monthExpenses = useMemo(
    () => (data ? expensesForMonth(data.expenses, month) : []),
    [data, month],
  )

  const settlement = useMemo(
    () => calculateSettlement(monthExpenses),
    [monthExpenses],
  )

  async function refreshCloudData() {
    if (!cloudMode) {
      return
    }

    const refreshed = await loadCloudAppData(user ?? undefined)
    applyLoadedData(refreshed, user)
  }

  function applyLoadedData(loaded: AppData | null, activeUser: User | null = user) {
    setData(loaded)
    const firstCategoryId = loaded?.categories[0]?.id

    if (firstCategoryId) {
      setForm((current) => ({
        ...current,
        categoryId: firstCategoryId,
      }))
      setQuickCategoryId(firstCategoryId)
    }

    if (!loaded) {
      setCurrentProfileId(null)
      localStorage.removeItem(profileStorageKey)
      return
    }

    const savedProfile = localStorage.getItem(profileStorageKey) as Member['id'] | null
    const profileExists = loaded.household.members.some((member) => member.id === savedProfile)
    const ownMember = activeUser
      ? loaded.household.members.find((member) => member.userId === activeUser.id)
      : null
    const nextProfile = ownMember?.id ?? (profileExists ? savedProfile : null)

    setCurrentProfileId(nextProfile)
    if (nextProfile) {
      localStorage.setItem(profileStorageKey, nextProfile)
    } else {
      localStorage.removeItem(profileStorageKey)
    }
  }

  if (isLoading) {
    return (
      <main className={`phone-shell theme-${theme} loading-screen`}>
        <WalletCards size={40} />
        <p>正在打開帳本...</p>
      </main>
    )
  }

  if (cloudMode && !user) {
    return (
      <main className={`phone-shell theme-${theme}`}>
        <section className="profile-gate">
          <p className="muted-label">Cloud Sync</p>
          <h1>登入你的帳本</h1>
          <p>輸入 email 後，Supabase 會寄出登入連結。兩個人各自登入後，就可以同步同一個帳本。</p>
          <form onSubmit={handleSendMagicLink}>
            <label>
              Email
              <input
                type="email"
                value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <button className="primary-action" type="submit">
              <Mail size={18} />
              寄出登入連結
            </button>
          </form>
          {statusMessage && <p className="status-message">{statusMessage}</p>}
        </section>
      </main>
    )
  }

  if (cloudMode && user && !data) {
    return (
      <main className={`phone-shell theme-${theme}`}>
        <section className="profile-gate">
          <p className="muted-label">First Setup</p>
          <h1>建立或加入帳本</h1>
          <p>第一個人建立帳本，第二個人用邀請碼加入。之後雙方資料會寫入 Supabase。</p>

          <form onSubmit={handleCreateHousehold}>
            <label>
              你的顯示名稱
              <input
                value={personAName}
                onChange={(event) => setPersonAName(event.target.value)}
                placeholder="例如：Ben"
              />
            </label>
            <label>
              對方顯示名稱
              <input
                value={personBName}
                onChange={(event) => setPersonBName(event.target.value)}
                placeholder="例如：Jamie"
              />
            </label>
            <button className="primary-action" type="submit">
              <Plus size={18} />
              建立新帳本
            </button>
          </form>

          <form onSubmit={handleJoinHousehold}>
            <label>
              邀請碼
              <input
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value)}
                placeholder="例如：HKD-2486"
              />
            </label>
            <label>
              你的顯示名稱
              <input
                value={joinName}
                onChange={(event) => setJoinName(event.target.value)}
                placeholder="例如：Jamie"
              />
            </label>
            <button className="secondary-action" type="submit">
              <Copy size={18} />
              加入現有帳本
            </button>
          </form>
          {statusMessage && <p className="status-message">{statusMessage}</p>}
        </section>
      </main>
    )
  }

  if (!data) {
    return null
  }

  const appData = data
  const [personA, personB] = appData.household.members
  const currentProfile =
    appData.household.members.find((member) => member.id === currentProfileId) ?? null
  const otherProfile =
    currentProfile &&
    appData.household.members.find((member) => member.id !== currentProfile.id)
  const myExpenses = currentProfile
    ? monthExpenses.filter((expense) => expense.payerId === currentProfile.id)
    : []
  const myPaid = currentProfile ? settlement.paid[currentProfile.id] : 0
  const myOwed = currentProfile ? settlement.owed[currentProfile.id] : 0
  const otherName = otherProfile?.name ?? '對方'
  const personAPaid = settlement.paid.personA
  const personBPaid = settlement.paid.personB
  const paidTotal = personAPaid + personBPaid
  const personAPercentage = paidTotal > 0 ? Math.round((personAPaid / paidTotal) * 100) : 50
  const personBPercentage = paidTotal > 0 ? 100 - personAPercentage : 50

  function updateData(next: AppData) {
    setData(next)
  }

  function selectProfile(id: Member['id']) {
    setCurrentProfileId(id)
    localStorage.setItem(profileStorageKey, id)
    setActiveTab('overview')
    setStatusMessage('')
  }

  function categoryName(categoryId: string) {
    return appData.categories.find((category) => category.id === categoryId)?.name ?? '其他'
  }

  function categoryColor(categoryId: string) {
    return appData.categories.find((category) => category.id === categoryId)?.color ?? '#94a3b8'
  }

  function personalSettlementText() {
    if (!currentProfile || !settlement.transfer.amount) {
      return '暫時不用互相補錢'
    }

    if (settlement.transfer.from === currentProfile.id) {
      return `你需要轉 ${formatMoney(settlement.transfer.amount)} 給 ${otherName}`
    }

    if (settlement.transfer.to === currentProfile.id) {
      return `${otherName} 需要轉 ${formatMoney(settlement.transfer.amount)} 給你`
    }

    return '暫時不用互相補錢'
  }

  async function handleSendMagicLink(event: FormEvent) {
    event.preventDefault()
    if (!authEmail.trim()) {
      setStatusMessage('請先輸入 email。')
      return
    }

    try {
      await sendMagicLink(authEmail.trim())
      setStatusMessage('登入連結已寄出，請打開 email 按連結。')
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '登入連結寄出失敗。')
    }
  }

  async function handleCreateHousehold(event: FormEvent) {
    event.preventDefault()
    setStatusMessage('')

    try {
      if (cloudMode) {
        const created = await createCloudHousehold(
          personAName.trim() || 'Ben',
          personBName.trim() || 'Jamie',
        )
        applyLoadedData(created, user)
        setStatusMessage('已建立雲端帳本，可以把邀請碼交給對方。')
      } else {
        const household = buildHousehold(personAName.trim() || 'Ben', personBName.trim() || 'Jamie')
        updateData({ household, categories: defaultCategories, expenses: [] })
        setCurrentProfileId(null)
        localStorage.removeItem(profileStorageKey)
        setStatusMessage('已建立新帳本。')
      }
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '建立帳本失敗。')
    }
  }

  async function handleJoinHousehold(event: FormEvent) {
    event.preventDefault()
    if (!joinCode.trim()) {
      setStatusMessage('請輸入邀請碼。')
      return
    }

    try {
      const joined = await joinCloudHousehold(joinCode, joinName.trim())
      applyLoadedData(joined, user)
      setStatusMessage('已加入帳本。')
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '加入帳本失敗。')
    }
  }

  async function handleAddExpense(event: FormEvent) {
    event.preventDefault()

    if (!currentProfile) {
      setStatusMessage('請先選擇你的身份。')
      return
    }

    const amount = Number(form.amount)

    if (!amount || amount <= 0 || !form.title.trim()) {
      setStatusMessage('請輸入項目和有效金額。')
      return
    }

    if (form.currency !== 'HKD' && form.useManualRate && Number(form.manualRate) <= 0) {
      setStatusMessage('請輸入有效的手動匯率。')
      return
    }

    setIsSaving(true)
    setStatusMessage('')

    try {
      const rateResult =
        form.useManualRate && Number(form.manualRate) > 0
          ? { rate: Number(form.manualRate), source: 'manual' as const }
          : await getExchangeRateToHkd(form.currency, form.date)

      const hkdAmount = roundMoney(amount * rateResult.rate)
      const split = buildSplit(
        form.splitMode,
        hkdAmount,
        Number(form.customPersonA) || 0,
      )

      const expense: Expense = {
        id: crypto.randomUUID(),
        householdId: appData.household.id,
        date: form.date,
        title: form.title.trim(),
        originalAmount: amount,
        originalCurrency: form.currency,
        exchangeRateToHkd: rateResult.rate,
        hkdAmount,
        payerId: currentProfile.id,
        categoryId: form.categoryId,
        splitMode: form.splitMode,
        split,
        note: form.note.trim(),
        rateSource: rateResult.source,
        createdAt: new Date().toISOString(),
      }

      if (cloudMode) {
        await insertCloudExpense(expense)
        await refreshCloudData()
      } else {
        updateData(upsertExpense(appData, expense))
      }

      setForm({
        ...initialForm,
        date: form.date,
        categoryId: form.categoryId,
      })
      setStatusMessage(
        rateResult.source === 'fallback'
          ? '已儲存。匯率服務暫時失敗，已使用備用匯率。'
          : `已儲存，匯率為 1 ${form.currency} = ${rateResult.rate.toFixed(4)} HKD。`,
      )
      setActiveTab('overview')
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '儲存支出失敗。')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleQuickAdd(event: FormEvent) {
    event.preventDefault()

    if (!currentProfile) {
      setStatusMessage('請先選擇你的身份。')
      return
    }

    const amount = Number(quickAmount)
    if (!amount || amount <= 0) {
      setStatusMessage('請輸入有效金額。')
      return
    }

    setIsQuickSaving(true)
    setStatusMessage('')

    try {
      const category = appData.categories.find((item) => item.id === quickCategoryId)
      const hkdAmount = roundMoney(amount)
      const split = buildSplit('equal', hkdAmount, 0)

      const expense: Expense = {
        id: crypto.randomUUID(),
        householdId: appData.household.id,
        date: todayInputValue(),
        title: category?.name ?? '快速支出',
        originalAmount: amount,
        originalCurrency: 'HKD',
        exchangeRateToHkd: 1,
        hkdAmount,
        payerId: currentProfile.id,
        categoryId: quickCategoryId,
        splitMode: 'equal',
        split,
        note: '快速新增',
        rateSource: 'hkd',
        createdAt: new Date().toISOString(),
      }

      if (cloudMode) {
        await insertCloudExpense(expense)
        await refreshCloudData()
      } else {
        updateData(upsertExpense(appData, expense))
      }

      setQuickAmount('')
      setStatusMessage(`已新增 ${category?.name ?? '支出'} ${formatMoney(hkdAmount)}。`)
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '快速新增失敗。')
    } finally {
      setIsQuickSaving(false)
    }
  }

  async function handleDeleteExpense(expenseId: string) {
    try {
      if (cloudMode) {
        await deleteCloudExpense(expenseId)
        await refreshCloudData()
      } else {
        updateData(deleteExpense(appData, expenseId))
      }
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '刪除失敗。')
    }
  }

  async function handleAddCategory(event: FormEvent) {
    event.preventDefault()
    const name = newCategory.trim()

    if (!name) {
      return
    }

    try {
      const color = categoryColors[appData.categories.length % categoryColors.length]
      if (cloudMode) {
        const created = await insertCloudCategory(appData.household.id, name, color)
        updateData(addCategory(appData, created))
      } else {
        updateData(addCategory(appData, { id: crypto.randomUUID(), name, color }))
      }
      setNewCategory('')
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '新增分類失敗。')
    }
  }

  if (!currentProfile) {
    return (
      <main className={`phone-shell theme-${theme}`}>
        <section className="profile-gate">
          <p className="muted-label">選擇身份</p>
          <h1>你是邊位？</h1>
          <p>選好之後，首頁和明細會以你的角度顯示。月結仍會計算雙方。</p>
          <div className="profile-options">
            {appData.household.members.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => selectProfile(member.id)}
              >
                <UserRound size={22} />
                <span>我是 {member.name}</span>
              </button>
            ))}
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className={`phone-shell theme-${theme}`}>
      <header className="app-header">
        <div>
          <p className="muted-label">Hi, {currentProfile.name}</p>
          <h1>{appData.household.name}</h1>
        </div>
        <span className={`cloud-pill ${cloudMode ? 'is-live' : ''}`}>
          <Cloud size={15} />
          {cloudMode ? '雲端同步' : '本機示範'}
        </span>
      </header>

      <section className="month-bar">
        <label>
          <CalendarDays size={16} />
          <input
            aria-label="選擇月份"
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
        </label>
        <button type="button" onClick={() => setActiveTab('add')} className="quick-add">
          <Plus size={18} />
          新增
        </button>
      </section>

      {activeTab === 'overview' && (
        <section className="screen-stack">
          <form className="quick-entry panel" onSubmit={handleQuickAdd}>
            <div className="quick-categories" aria-label="快速分類">
              {appData.categories.slice(0, 8).map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={quickCategoryId === category.id ? 'selected' : ''}
                  onClick={() => setQuickCategoryId(category.id)}
                >
                  <span className="category-icon">
                    <CategoryIcon categoryId={category.id} />
                  </span>
                  <span>{category.name}</span>
                </button>
              ))}
            </div>
            <div className="quick-input-row">
              <span>HK$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={quickAmount}
                onChange={(event) => setQuickAmount(event.target.value)}
                placeholder="輸入金額"
                aria-label="快速輸入金額"
              />
              <button type="submit" disabled={isQuickSaving}>
                <Plus size={18} />
              </button>
            </div>
          </form>

          <section className="contribution-card panel">
            <div className="panel-title">
              <CircleDollarSign size={18} />
              <h2>雙方暫時支出比例</h2>
            </div>
            <div className="ratio-bar" aria-label="雙方支出比例">
              <div className="ratio-a" style={{ width: `${personAPercentage}%` }}>
                {personAPercentage}%
              </div>
              <div className="ratio-b" style={{ width: `${personBPercentage}%` }}>
                {personBPercentage}%
              </div>
            </div>
            <div className="ratio-details">
              <div>
                <span>{personA.name} 總支出</span>
                <strong>{formatMoney(personAPaid)}</strong>
              </div>
              <div>
                <span>{personB.name} 總支出</span>
                <strong>{formatMoney(personBPaid)}</strong>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-title">
              <Coins size={18} />
              <h2>你的分類支出</h2>
            </div>
            {myExpenses.length === 0 ? (
              <p className="empty-text">你這個月份還未有支出。</p>
            ) : (
              Object.values(
                myExpenses.reduce<Record<string, { categoryId: string; amount: number }>>(
                  (groups, expense) => {
                    const current = groups[expense.categoryId] ?? {
                      categoryId: expense.categoryId,
                      amount: 0,
                    }
                    current.amount = roundMoney(current.amount + expense.hkdAmount)
                    groups[expense.categoryId] = current
                    return groups
                  },
                  {},
                ),
              ).map((item) => (
                <div key={item.categoryId} className="stat-row">
                  <span>
                    <i style={{ background: categoryColor(item.categoryId) }} />
                    {categoryName(item.categoryId)}
                  </span>
                  <b>{formatMoney(item.amount)}</b>
                </div>
              ))
            )}
          </section>

          <section className="panel">
            <div className="panel-title">
              <CircleDollarSign size={18} />
              <h2>全月共同總額</h2>
            </div>
            <div className="stat-row">
              <span>雙方總支出</span>
              <b>{formatMoney(settlement.totalHkd)}</b>
            </div>
            <div className="stat-row">
              <span>月結方向</span>
              <b>{personalSettlementText()}</b>
            </div>
          </section>

          <article className="hero-card">
            <p>今個月結算</p>
            <strong>{personalSettlementText()}</strong>
            <div className="hero-divider" />
            <div className="transfer-line">
              <span>你已付</span>
              <b>{formatMoney(myPaid)}</b>
              <span>你應負擔 {formatMoney(myOwed)}</span>
            </div>
          </article>
        </section>
      )}

      {activeTab === 'add' && (
        <section className="screen-stack">
          <form className="panel entry-panel" onSubmit={handleAddExpense}>
            <div className="panel-title">
              <Plus size={18} />
              <h2>新增支出</h2>
            </div>

            <div className="payer-lock">
              <UserRound size={17} />
              付款人固定為 {currentProfile.name}
            </div>

            <label>
              項目
              <input
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="例如：晚餐、車費、超市"
              />
            </label>

            <div className="input-pair">
              <label>
                金額
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(event) => setForm({ ...form, amount: event.target.value })}
                  placeholder="0.00"
                />
              </label>
              <label>
                貨幣
                <select
                  value={form.currency}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      currency: event.target.value as CurrencyCode,
                      useManualRate:
                        event.target.value === 'HKD' ? false : form.useManualRate,
                    })
                  }
                >
                  {currencies.map((currency) => (
                    <option key={currency}>{currency}</option>
                  ))}
                </select>
              </label>
            </div>

            <label>
              日期
              <input
                type="date"
                value={form.date}
                onChange={(event) => setForm({ ...form, date: event.target.value })}
              />
            </label>

            {form.currency !== 'HKD' && (
              <label className="toggle-line">
                <input
                  type="checkbox"
                  checked={form.useManualRate}
                  onChange={(event) =>
                    setForm({ ...form, useManualRate: event.target.checked })
                  }
                />
                使用手動匯率
              </label>
            )}

            {form.currency !== 'HKD' && form.useManualRate && (
              <label>
                1 {form.currency} 等於多少 HKD
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={form.manualRate}
                  onChange={(event) =>
                    setForm({ ...form, manualRate: event.target.value })
                  }
                  placeholder="例如：0.052"
                />
              </label>
            )}

            <div className="input-pair">
              <label>
                分類
                <select
                  value={form.categoryId}
                  onChange={(event) =>
                    setForm({ ...form, categoryId: event.target.value })
                  }
                >
                  {appData.categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                分攤方式
                <select
                  value={form.splitMode}
                  onChange={(event) =>
                    setForm({ ...form, splitMode: event.target.value as SplitMode })
                  }
                >
                  <option value="equal">平均分</option>
                  <option value="personA">{personA.name} 全負擔</option>
                  <option value="personB">{personB.name} 全負擔</option>
                  <option value="custom">自訂金額</option>
                </select>
              </label>
            </div>

            {form.splitMode === 'custom' && (
              <label>
                {personA.name} 負擔多少 HKD
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.customPersonA}
                  onChange={(event) =>
                    setForm({ ...form, customPersonA: event.target.value })
                  }
                  placeholder="餘額會自動分給另一方"
                />
              </label>
            )}

            <label>
              備註
              <textarea
                value={form.note}
                onChange={(event) => setForm({ ...form, note: event.target.value })}
                placeholder="例如：信用卡實際匯率、旅行地點等"
              />
            </label>

            <button className="primary-action" type="submit" disabled={isSaving}>
              <Check size={18} />
              {isSaving ? '儲存中...' : '儲存支出'}
            </button>
            {statusMessage && <p className="status-message">{statusMessage}</p>}
          </form>
        </section>
      )}

      {activeTab === 'records' && (
        <section className="screen-stack">
          <section className="panel">
            <div className="panel-title">
              <List size={18} />
              <h2>你的支出明細</h2>
            </div>
            {myExpenses.length === 0 ? (
              <p className="empty-text">你這個月份還未有支出。</p>
            ) : (
              myExpenses.map((expense) => (
                <article key={expense.id} className="record-item">
                  <div
                    className="record-dot"
                    style={{ background: categoryColor(expense.categoryId) }}
                  />
                  <div className="record-main">
                    <strong>{expense.title}</strong>
                    <span>
                      {expense.date} · {categoryName(expense.categoryId)}
                    </span>
                    <small>
                      {formatMoney(expense.originalAmount, expense.originalCurrency)}
                      {expense.originalCurrency !== 'HKD'
                        ? ` · 匯率 ${expense.exchangeRateToHkd.toFixed(4)}`
                        : ''}
                    </small>
                  </div>
                  <div className="record-side">
                    <b>{formatMoney(expense.hkdAmount)}</b>
                    <button
                      type="button"
                      className="ghost-icon"
                      onClick={() => void handleDeleteExpense(expense.id)}
                      title="刪除支出"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </article>
              ))
            )}
          </section>
        </section>
      )}

      {activeTab === 'settings' && (
        <section className="screen-stack">
          <section className="panel">
            <div className="panel-title">
              <UserRound size={18} />
              <h2>你的身份</h2>
            </div>
            <div className="profile-options compact">
              {appData.household.members.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  className={member.id === currentProfile.id ? 'selected' : ''}
                  onClick={() => selectProfile(member.id)}
                >
                  <UserRound size={19} />
                  <span>我是 {member.name}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="copy-code"
              onClick={() => navigator.clipboard?.writeText(appData.household.inviteCode)}
            >
              <Copy size={16} />
              邀請碼 {appData.household.inviteCode}
            </button>
          </section>

          <section className="panel">
            <div className="panel-title">
              <Settings size={18} />
              <h2>顏色主題</h2>
            </div>
            <div className="theme-options">
              <button
                type="button"
                className={theme === 'neon' ? 'selected' : ''}
                onClick={() => setTheme('neon')}
              >
                <span className="theme-swatch neon-swatch" />
                <strong>Neon Dark</strong>
                <small>深色金融風格</small>
              </button>
              <button
                type="button"
                className={theme === 'dream' ? 'selected' : ''}
                onClick={() => setTheme('dream')}
              >
                <span className="theme-swatch dream-swatch" />
                <strong>Dream Glow</strong>
                <small>夢幻柔光色彩</small>
              </button>
            </div>
          </section>

          <form className="panel compact-form" onSubmit={handleAddCategory}>
            <div className="panel-title">
              <Coins size={18} />
              <h2>新增分類</h2>
            </div>
            <div className="inline-form">
              <input
                value={newCategory}
                onChange={(event) => setNewCategory(event.target.value)}
                placeholder="例如：手信、行程、保險"
              />
              <button type="submit">
                <Plus size={18} />
              </button>
            </div>
          </form>

          <form className="panel compact-form" onSubmit={handleCreateHousehold}>
            <div className="panel-title">
              <Settings size={18} />
              <h2>重新建立帳本</h2>
            </div>
            <label>
              第一個人
              <input
                value={personAName}
                onChange={(event) => setPersonAName(event.target.value)}
                placeholder="例如：Ben"
              />
            </label>
            <label>
              第二個人
              <input
                value={personBName}
                onChange={(event) => setPersonBName(event.target.value)}
                placeholder="例如：Jamie"
              />
            </label>
            <button className="secondary-action" type="submit">
              建立新帳本
            </button>
          </form>

          {cloudMode && (
            <section className="panel">
              <div className="panel-title">
                <Cloud size={18} />
                <h2>雲端帳戶</h2>
              </div>
              <p className="empty-text">{user?.email}</p>
              <button
                className="secondary-action"
                type="button"
                onClick={() => void signOut()}
              >
                <LogOut size={18} />
                登出
              </button>
            </section>
          )}
        </section>
      )}

      <nav className="bottom-nav" aria-label="底部導覽">
        <button
          type="button"
          className={activeTab === 'overview' ? 'is-active' : ''}
          onClick={() => setActiveTab('overview')}
        >
          <Home size={19} />
          總覽
        </button>
        <button
          type="button"
          className={activeTab === 'add' ? 'is-active' : ''}
          onClick={() => setActiveTab('add')}
        >
          <Plus size={19} />
          新增
        </button>
        <button
          type="button"
          className={activeTab === 'records' ? 'is-active' : ''}
          onClick={() => setActiveTab('records')}
        >
          <List size={19} />
          明細
        </button>
        <button
          type="button"
          className={activeTab === 'settings' ? 'is-active' : ''}
          onClick={() => setActiveTab('settings')}
        >
          <Settings size={19} />
          設定
        </button>
      </nav>
    </main>
  )
}

function CategoryIcon({ categoryId }: { categoryId: string }) {
  if (categoryId === 'food') {
    return <Utensils size={18} />
  }

  if (categoryId === 'shopping') {
    return <ShoppingBag size={18} />
  }

  if (categoryId === 'home') {
    return <HomeIcon size={18} />
  }

  if (categoryId === 'pet') {
    return <PawPrint size={18} />
  }

  return <Coins size={18} />
}

export default App
