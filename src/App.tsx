import {
  CalendarDays,
  Check,
  CircleDollarSign,
  Cloud,
  Coins,
  Copy,
  HandCoins,
  Plus,
  Trash2,
  Users,
  WalletCards,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import { getExchangeRateToHkd } from './lib/exchangeRates'
import { currencies, currentMonthInputValue, formatMoney, roundMoney, todayInputValue } from './lib/money'
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

const categoryColors = ['#f97316', '#0ea5e9', '#8b5cf6', '#10b981', '#ec4899', '#f59e0b']

type ExpenseFormState = {
  title: string
  date: string
  amount: string
  currency: CurrencyCode
  payerId: Member['id']
  categoryId: string
  splitMode: SplitMode
  customPersonA: string
  note: string
  manualRate: string
  useManualRate: boolean
}

const initialForm: ExpenseFormState = {
  title: '',
  date: todayInputValue(),
  amount: '',
  currency: 'HKD',
  payerId: 'personA',
  categoryId: 'food',
  splitMode: 'equal',
  customPersonA: '',
  note: '',
  manualRate: '',
  useManualRate: false,
}

function App() {
  const [data, setData] = useState<AppData | null>(null)
  const [month, setMonth] = useState(currentMonthInputValue())
  const [form, setForm] = useState<ExpenseFormState>(initialForm)
  const [isSaving, setIsSaving] = useState(false)
  const [rateMessage, setRateMessage] = useState('')
  const [personAName, setPersonAName] = useState('')
  const [personBName, setPersonBName] = useState('')
  const [newCategory, setNewCategory] = useState('')

  useEffect(() => {
    loadAppData().then((loaded) => {
      setData(loaded)
      setForm((current) => ({
        ...current,
        payerId: loaded.household.members[0].id,
        categoryId: loaded.categories[0]?.id ?? 'food',
      }))
    })
  }, [])

  useEffect(() => {
    if (data) {
      saveLocalAppData(data)
    }
  }, [data])

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
      <main className="app-shell loading-screen">
        <WalletCards size={36} />
        <p>正在準備你的帳本...</p>
      </main>
    )
  }

  const appData = data
  const [personA, personB] = data.household.members

  function updateData(next: AppData) {
    setData(next)
  }

  function memberName(id: Member['id']) {
    return data?.household.members.find((member) => member.id === id)?.name ?? id
  }

  async function handleCreateHousehold(event: FormEvent) {
    event.preventDefault()
    const household = buildHousehold(personAName.trim(), personBName.trim())
    updateData({ household, categories: defaultCategories, expenses: [] })
    setForm((current) => ({
      ...current,
      payerId: household.members[0].id,
      categoryId: defaultCategories[0].id,
    }))
  }

  async function handleAddExpense(event: FormEvent) {
    event.preventDefault()
    const amount = Number(form.amount)
    if (!amount || amount <= 0 || !form.title.trim()) {
      return
    }

    setIsSaving(true)
    setRateMessage('')

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
      payerId: form.payerId,
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
      payerId: form.payerId,
      categoryId: form.categoryId,
    })
    setRateMessage(
      rateResult.source === 'fallback'
        ? '暫時未能取得即時匯率，已使用備用匯率；你可用手動匯率覆蓋。'
        : `已保存，匯率為 1 ${form.currency} = ${rateResult.rate.toFixed(4)} HKD。`,
    )
    setIsSaving(false)
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

  const transferText = settlement.transfer.amount
    ? `${memberName(settlement.transfer.from!)} 需要轉 ${formatMoney(
        settlement.transfer.amount,
      )} 給 ${memberName(settlement.transfer.to!)}`
    : '今個月已經平衡，暫時不用互相補錢'

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">雙人月結理財</p>
          <h1>{data.household.name}</h1>
        </div>
        <span className={`sync-pill ${isSupabaseConfigured ? 'live' : ''}`}>
          <Cloud size={16} />
          {isSupabaseConfigured ? '雲端可接入' : '示範模式'}
        </span>
      </header>

      <section className="setup-band">
        <div>
          <p className="section-label">帳本成員</p>
          <div className="member-row">
            {data.household.members.map((member) => (
              <span key={member.id} className="member-chip">
                <Users size={15} />
                {member.name}
              </span>
            ))}
          </div>
        </div>
        <button
          type="button"
          className="invite-button"
          onClick={() => navigator.clipboard?.writeText(data.household.inviteCode)}
          title="複製邀請碼"
        >
          <Copy size={16} />
          {data.household.inviteCode}
        </button>
      </section>

      <section className="summary-grid">
        <article className="metric primary">
          <span>本月總支出</span>
          <strong>{formatMoney(settlement.totalHkd)}</strong>
        </article>
        <article className="metric">
          <span>{personA.name} 已付</span>
          <strong>{formatMoney(settlement.paid.personA)}</strong>
        </article>
        <article className="metric">
          <span>{personB.name} 已付</span>
          <strong>{formatMoney(settlement.paid.personB)}</strong>
        </article>
      </section>

      <section className="settlement-panel">
        <div>
          <p className="section-label">月尾結算</p>
          <h2>{transferText}</h2>
        </div>
        <input
          aria-label="選擇月份"
          type="month"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
        />
      </section>

      <section className="two-column">
        <form className="entry-form" onSubmit={handleAddExpense}>
          <div className="panel-heading">
            <Plus size={20} />
            <h2>新增支出</h2>
          </div>

          <label>
            項目
            <input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="例如：晚餐、酒店、車票"
            />
          </label>

          <div className="field-grid">
            <label>
              日期
              <input
                type="date"
                value={form.date}
                onChange={(event) => setForm({ ...form, date: event.target.value })}
              />
            </label>
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
          </div>

          <div className="field-grid">
            <label>
              貨幣
              <select
                value={form.currency}
                onChange={(event) =>
                  setForm({
                    ...form,
                    currency: event.target.value as CurrencyCode,
                    useManualRate: event.target.value === 'HKD' ? false : form.useManualRate,
                  })
                }
              >
                {currencies.map((currency) => (
                  <option key={currency}>{currency}</option>
                ))}
              </select>
            </label>
            <label>
              付款人
              <select
                value={form.payerId}
                onChange={(event) =>
                  setForm({ ...form, payerId: event.target.value as Member['id'] })
                }
              >
                {data.household.members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {form.currency !== 'HKD' && (
            <label className="checkbox-row">
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

          <div className="field-grid">
            <label>
              分類
              <select
                value={form.categoryId}
                onChange={(event) =>
                  setForm({ ...form, categoryId: event.target.value })
                }
              >
                {data.categories.map((category) => (
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
                <option value="custom">自訂 {personA.name} 應付</option>
              </select>
            </label>
          </div>

          {form.splitMode === 'custom' && (
            <label>
              {personA.name} 應付 HKD 金額
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
              placeholder="信用卡匯率、旅行城市、收據備註..."
            />
          </label>

          <button className="primary-button" type="submit" disabled={isSaving}>
            <Check size={18} />
            {isSaving ? '保存中...' : '保存支出'}
          </button>
          {rateMessage && <p className="rate-message">{rateMessage}</p>}
        </form>

        <aside className="insights">
          <div className="panel-heading">
            <CalendarDays size={20} />
            <h2>本月概覽</h2>
          </div>

          <div className="owed-grid">
            <div>
              <span>{personA.name} 應負擔</span>
              <strong>{formatMoney(settlement.owed.personA)}</strong>
            </div>
            <div>
              <span>{personB.name} 應負擔</span>
              <strong>{formatMoney(settlement.owed.personB)}</strong>
            </div>
          </div>

          <div className="mini-list">
            <h3>
              <CircleDollarSign size={17} />
              按貨幣
            </h3>
            {settlement.byCurrency.map((item) => (
              <div key={item.currency} className="mini-row">
                <span>{item.currency}</span>
                <strong>
                  {formatMoney(item.originalAmount, item.currency)} /{' '}
                  {formatMoney(item.hkdAmount)}
                </strong>
              </div>
            ))}
          </div>

          <div className="mini-list">
            <h3>
              <Coins size={17} />
              按分類
            </h3>
            {settlement.byCategory.map((item) => {
              const category = data.categories.find(
                (candidate) => candidate.id === item.categoryId,
              )
              return (
                <div key={item.categoryId} className="mini-row">
                  <span>
                    <i style={{ background: category?.color }} />
                    {category?.name ?? '未分類'}
                  </span>
                  <strong>{formatMoney(item.amount)}</strong>
                </div>
              )
            })}
          </div>

          <form className="category-form" onSubmit={handleAddCategory}>
            <input
              value={newCategory}
              onChange={(event) => setNewCategory(event.target.value)}
              placeholder="新增自訂分類"
            />
            <button type="submit" title="新增分類">
              <Plus size={18} />
            </button>
          </form>
        </aside>
      </section>

      <section className="expense-list">
        <div className="panel-heading">
          <HandCoins size={20} />
          <h2>{month} 支出明細</h2>
        </div>
        {monthExpenses.length === 0 ? (
          <p className="empty-state">這個月份還未有支出。</p>
        ) : (
          monthExpenses.map((expense) => {
            const category = data.categories.find(
              (item) => item.id === expense.categoryId,
            )
            return (
              <article key={expense.id} className="expense-item">
                <div>
                  <div className="expense-title">
                    <i style={{ background: category?.color }} />
                    <strong>{expense.title}</strong>
                  </div>
                  <p>
                    {expense.date} · {memberName(expense.payerId)} 付款 ·{' '}
                    {category?.name}
                  </p>
                  {expense.note && <p>{expense.note}</p>}
                </div>
                <div className="expense-amount">
                  <strong>{formatMoney(expense.hkdAmount)}</strong>
                  <span>
                    {formatMoney(expense.originalAmount, expense.originalCurrency)}
                  </span>
                  <span>匯率 {expense.exchangeRateToHkd.toFixed(4)}</span>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => handleDeleteExpense(expense.id)}
                  title="刪除支出"
                >
                  <Trash2 size={18} />
                </button>
              </article>
            )
          })
        )}
      </section>

      <section className="setup-form-wrap">
        <form className="setup-form" onSubmit={handleCreateHousehold}>
          <h2>重新建立雙人帳本</h2>
          <div className="field-grid">
            <input
              value={personAName}
              onChange={(event) => setPersonAName(event.target.value)}
              placeholder="第一個人姓名"
            />
            <input
              value={personBName}
              onChange={(event) => setPersonBName(event.target.value)}
              placeholder="第二個人姓名"
            />
          </div>
          <button type="submit">建立新帳本</button>
        </form>
      </section>
    </main>
  )
}

export default App
