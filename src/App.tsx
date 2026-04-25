import {
  CalendarDays,
  Check,
  CircleDollarSign,
  Cloud,
  Coins,
  Copy,
  HomeIcon,
  Home,
  List,
  PawPrint,
  Plus,
  ShoppingBag,
  Utensils,
  Settings,
  Trash2,
  UserRound,
  WalletCards,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
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
  deleteExpense,
  loadAppData,
  saveLocalAppData,
  upsertExpense,
} from './lib/store'
import { isSupabaseConfigured } from './lib/supabase'
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
  '#f97316',
  '#0ea5e9',
  '#8b5cf6',
  '#10b981',
  '#ec4899',
  '#f59e0b',
]

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [theme, setTheme] = useState<ThemeName>(
    () => (localStorage.getItem(themeStorageKey) as ThemeName | null) ?? 'neon',
  )
  const [data, setData] = useState<AppData | null>(null)
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
    loadAppData().then((loaded) => {
      setData(loaded)
      setForm((current) => ({
        ...current,
        categoryId: loaded.categories[0]?.id ?? 'food',
      }))
      setQuickCategoryId(loaded.categories[0]?.id ?? 'food')
      const savedProfile = localStorage.getItem(profileStorageKey) as Member['id'] | null
      const profileExists = loaded.household.members.some(
        (member) => member.id === savedProfile,
      )
      if (!savedProfile || !profileExists) {
        setCurrentProfileId(null)
      }
    })
  }, [])

  useEffect(() => {
    if (data) {
      saveLocalAppData(data)
    }
  }, [data])

  useEffect(() => {
    if (currentProfileId) {
      localStorage.setItem(profileStorageKey, currentProfileId)
    }
  }, [currentProfileId])

  useEffect(() => {
    localStorage.setItem(themeStorageKey, theme)
  }, [theme])

  const monthExpenses = useMemo(
    () => (data ? expensesForMonth(data.expenses, month) : []),
    [data, month],
  )

  const settlement = useMemo(
    () => calculateSettlement(monthExpenses),
    [monthExpenses],
  )

  if (!data) {
    return (
      <main className={`phone-shell theme-${theme} loading-screen`}>
        <WalletCards size={40} />
        <p>正在準備你的帳本...</p>
      </main>
    )
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
    return appData.categories.find((category) => category.id === categoryId)?.name ?? '未分類'
  }

  function categoryColor(categoryId: string) {
    return appData.categories.find((category) => category.id === categoryId)?.color ?? '#94a3b8'
  }

  function personalSettlementText() {
    if (!currentProfile || !settlement.transfer.amount) {
      return '暫時不用互相補錢'
    }

    if (settlement.transfer.from === currentProfile.id) {
      return `你要補 ${formatMoney(settlement.transfer.amount)} 給 ${otherName}`
    }

    if (settlement.transfer.to === currentProfile.id) {
      return `${otherName} 要補 ${formatMoney(settlement.transfer.amount)} 給你`
    }

    return '暫時不用互相補錢'
  }

  async function handleCreateHousehold(event: FormEvent) {
    event.preventDefault()
    const household = buildHousehold(personAName.trim() || 'Ben', personBName.trim() || 'Jamie')
    updateData({ household, categories: defaultCategories, expenses: [] })
    setCurrentProfileId(null)
    localStorage.removeItem(profileStorageKey)
    setForm((current) => ({
      ...current,
      categoryId: defaultCategories[0].id,
    }))
    setStatusMessage('已建立新的雙人帳本，請重新選擇你的身份。')
  }

  async function handleAddExpense(event: FormEvent) {
    event.preventDefault()

    if (!currentProfile) {
      setStatusMessage('請先選擇你是誰。')
      return
    }

    const amount = Number(form.amount)

    if (!amount || amount <= 0 || !form.title.trim()) {
      setStatusMessage('請填寫項目和有效金額。')
      return
    }

    if (form.currency !== 'HKD' && form.useManualRate && Number(form.manualRate) <= 0) {
      setStatusMessage('請輸入有效的手動匯率。')
      return
    }

    setIsSaving(true)
    setStatusMessage('')

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

    updateData(upsertExpense(appData, expense))
    setForm({
      ...initialForm,
      date: form.date,
      categoryId: form.categoryId,
    })
    setStatusMessage(
      rateResult.source === 'fallback'
        ? '已保存。暫時未能取得即時匯率，已使用備用匯率。'
        : `已保存。匯率：1 ${form.currency} = ${rateResult.rate.toFixed(4)} HKD。`,
    )
    setActiveTab('overview')
    setIsSaving(false)
  }

  async function handleQuickAdd(event: FormEvent) {
    event.preventDefault()

    if (!currentProfile) {
      setStatusMessage('請先選擇你是誰。')
      return
    }

    const amount = Number(quickAmount)
    if (!amount || amount <= 0) {
      setStatusMessage('請輸入有效金額。')
      return
    }

    setIsQuickSaving(true)
    setStatusMessage('')

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

    updateData(upsertExpense(appData, expense))
    setQuickAmount('')
    setStatusMessage(`已新增 ${category?.name ?? '支出'} ${formatMoney(hkdAmount)}。`)
    setIsQuickSaving(false)
  }

  function handleDeleteExpense(expenseId: string) {
    updateData(deleteExpense(appData, expenseId))
  }

  function handleAddCategory(event: FormEvent) {
    event.preventDefault()
    const name = newCategory.trim()

    if (!name) {
      return
    }

    updateData(
      addCategory(appData, {
        id: crypto.randomUUID(),
        name,
        color: categoryColors[appData.categories.length % categoryColors.length],
      }),
    )
    setNewCategory('')
  }

  if (!currentProfile) {
    return (
      <main className={`phone-shell theme-${theme}`}>
        <section className="profile-gate">
          <p className="muted-label">開始使用</p>
          <h1>你是邊位？</h1>
          <p>選擇身份後，App 會只顯示你的支出明細，新增支出亦會自動記在你名下。</p>
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
        <span className={`cloud-pill ${isSupabaseConfigured ? 'is-live' : ''}`}>
          <Cloud size={15} />
          {isSupabaseConfigured ? '雲端可接入' : '本機示範'}
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
            <div className="quick-categories" aria-label="快捷分類">
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
                aria-label="快速輸入支出金額"
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
              <h2>新增你的支出</h2>
            </div>

            <div className="payer-lock">
              <UserRound size={17} />
              付款人：{currentProfile.name}
            </div>

            <label>
              項目
              <input
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="例如：晚餐、酒店、車票"
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
                分帳
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
                {personA.name} 應付多少 HKD
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.customPersonA}
                  onChange={(event) =>
                    setForm({ ...form, customPersonA: event.target.value })
                  }
                  placeholder="剩餘部分由另一人負擔"
                />
              </label>
            )}

            <label>
              備註
              <textarea
                value={form.note}
                onChange={(event) => setForm({ ...form, note: event.target.value })}
                placeholder="例如：信用卡實際匯率、旅行城市、收據資料"
              />
            </label>

            <button className="primary-action" type="submit" disabled={isSaving}>
              <Check size={18} />
              {isSaving ? '保存中...' : '保存支出'}
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
                      onClick={() => handleDeleteExpense(expense.id)}
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
        </section>
      )}

      <nav className="bottom-nav" aria-label="主要功能">
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
