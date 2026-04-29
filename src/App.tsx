import {
  CalendarDays,
  Car,
  Camera,
  Check,
  ChevronDown,
  CircleDollarSign,
  Clapperboard,
  Cloud,
  Coins,
  Copy,
  CreditCard,
  Droplets,
  Dumbbell,
  Flame,
  Fuel,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  HomeIcon,
  Image as ImageIcon,
  Landmark,
  Laptop,
  List,
  LogOut,
  Mail,
  MoreVertical,
  Plane,
  PawPrint,
  Pencil,
  Plus,
  Receipt,
  Send,
  Shirt,
  Settings,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Train,
  Trash2,
  Trophy,
  UserRound,
  Utensils,
  WalletCards,
  Wifi,
  X,
  Zap,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, TouchEvent } from 'react'
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
  deleteCategory,
  deleteCloudCategory,
  deleteCloudExpense,
  deleteExpense,
  insertCloudCategory,
  insertCloudExpense,
  joinCloudHousehold,
  loadAppData,
  loadCachedAppData,
  loadCloudAppData,
  saveLocalAppData,
  sendMagicLink,
  signOut,
  subscribeToHousehold,
  updateCategoryIcon,
  updateCloudCategoryIcon,
  updateCloudExpense,
  updateCloudSettlementRatio,
  updateSettlementRatio,
  upsertExpense,
} from './lib/store'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import type { AppData, Category, CurrencyCode, Expense, Member, SplitMode } from './types'

type Tab = 'overview' | 'add' | 'records' | 'categories' | 'settings'
type ThemeName = 'neon' | 'dream' | 'white' | 'wise'
type RecordFilter = Member['id'] | 'all'
type RecordAccountFilter = 'all' | 'personal' | 'shared'
type CalculatorTarget = 'quick' | 'expense' | 'repeat' | 'fixed' | 'story'
type FixedExpenseTemplate = {
  id: string
  title: string
  amount: number
  categoryId: string
  payerId: Member['id']
  splitMode: SplitMode
}

type ExpenseFormState = {
  title: string
  date: string
  amount: string
  currency: CurrencyCode
  payerId: Member['id'] | ''
  isShared: boolean
  categoryId: string
  splitMode: SplitMode
  customPersonA: string
  note: string
  photoDataUrl: string
  photoCaption: string
  notifyOther: boolean
  manualRate: string
  useManualRate: boolean
}

const profileStorageKey = 'duo-finance-current-profile'
const themeStorageKey = 'duo-finance-theme'
const fixedExpensesStorageKey = 'duo-finance-fixed-expenses'
const fixedExpenseAppliedStorageKey = 'duo-finance-fixed-expense-applied'
const quickCategoriesStorageKey = 'duo-finance-quick-categories'

const initialForm: ExpenseFormState = {
  title: '',
  date: todayInputValue(),
  amount: '',
  currency: 'HKD',
  payerId: '',
  isShared: false,
  categoryId: 'food',
  splitMode: 'equal',
  customPersonA: '',
  note: '',
  photoDataUrl: '',
  photoCaption: '',
  notifyOther: false,
  manualRate: '',
  useManualRate: false,
}

const categoryColors = ['#b7ff16', '#7fdc12', '#8fb8ff', '#64d6b5', '#ffd6ff', '#bfa7ff', '#ffd166', '#ff8fab']

const iconOptions = [
  { id: 'food', label: '餐飲' },
  { id: 'coffee', label: '咖啡' },
  { id: 'grocery', label: '超市' },
  { id: 'transport', label: '交通' },
  { id: 'train', label: '鐵路' },
  { id: 'car', label: '汽車' },
  { id: 'fuel', label: '油費' },
  { id: 'travel', label: '旅行' },
  { id: 'home', label: '家居' },
  { id: 'rent', label: '租金' },
  { id: 'bill', label: '帳單' },
  { id: 'pet', label: '寵物' },
  { id: 'shopping', label: '購物' },
  { id: 'clothes', label: '衣物' },
  { id: 'gift', label: '禮物' },
  { id: 'fun', label: '娛樂' },
  { id: 'beauty', label: '美容' },
  { id: 'medical', label: '醫療' },
  { id: 'fitness', label: '健身' },
  { id: 'education', label: '學習' },
  { id: 'tech', label: '科技' },
  { id: 'phone', label: '電話' },
  { id: 'bank', label: '銀行' },
  { id: 'saving', label: '儲蓄' },
  { id: 'tax', label: '稅項' },
  { id: 'reward', label: '獎勵' },
  { id: 'other', label: '其他' },
]

const extraIconOptions = [
  { id: 'water', label: '水費' },
  { id: 'electricity', label: '電費' },
  { id: 'gas', label: '煤氣' },
  { id: 'credit-card', label: '信用卡' },
  { id: 'internet', label: '上網' },
  { id: 'insurance', label: '保險' },
]

const allIconOptions = [...iconOptions, ...extraIconOptions]

const categoryNameOptions = [
  '餐飲',
  '咖啡',
  '早餐',
  '午餐',
  '晚餐',
  '超市',
  '交通',
  '鐵路',
  '的士',
  '油費',
  '停車',
  '旅行',
  '酒店',
  '機票',
  '租金',
  '家居',
  '水電煤',
  '電話費',
  '保險',
  '醫療',
  '寵物',
  '購物',
  '衣物',
  '美容',
  '娛樂',
  '健身',
  '學習',
  '科技',
  '銀行',
  '儲蓄',
  '稅項',
  '禮物',
  '其他',
]

function App() {
  const cloudMode = isSupabaseConfigured && Boolean(supabase)
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [theme, setTheme] = useState<ThemeName>(() => (localStorage.getItem(themeStorageKey) as ThemeName | null) ?? 'neon')
  const [user, setUser] = useState<User | null>(null)
  const [authEmail, setAuthEmail] = useState('')
  const [setupMode, setSetupMode] = useState<'create' | 'join'>('create')
  const [joinCode, setJoinCode] = useState('')
  const [joinName, setJoinName] = useState('')
  const [data, setData] = useState<AppData | null>(() => loadCachedAppData())
  const [isLoading, setIsLoading] = useState(() => !loadCachedAppData())
  const [currentProfileId, setCurrentProfileId] = useState<Member['id'] | null>(() => (localStorage.getItem(profileStorageKey) as Member['id'] | null) ?? null)
  const [month, setMonth] = useState(currentMonthInputValue())
  const [form, setForm] = useState<ExpenseFormState>(initialForm)
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)
  const [quickTitle, setQuickTitle] = useState('')
  const [quickAmount, setQuickAmount] = useState('')
  const [quickCategoryId, setQuickCategoryId] = useState('food')
  const [quickIsShared, setQuickIsShared] = useState(false)
  const [quickCategoryIds, setQuickCategoryIds] = useState<string[]>(() => loadQuickCategoryIds())
  const [isStoryCameraOpen, setIsStoryCameraOpen] = useState(false)
  const [storyPhotoDataUrl, setStoryPhotoDataUrl] = useState('')
  const [storyTitle, setStoryTitle] = useState('')
  const [storyCaption, setStoryCaption] = useState('')
  const [storyAmount, setStoryAmount] = useState('')
  const [storyCategoryId, setStoryCategoryId] = useState('food')
  const [storyIsShared, setStoryIsShared] = useState(false)
  const [storyNotifyOther, setStoryNotifyOther] = useState(true)
  const [isStorySaving, setIsStorySaving] = useState(false)
  const [isCameraModeOpen, setIsCameraModeOpen] = useState(false)
  const [cameraStatus, setCameraStatus] = useState<'idle' | 'starting' | 'ready' | 'error'>('idle')
  const [isExpensePhotoOpen, setIsExpensePhotoOpen] = useState(false)
  const [cameraDrag, setCameraDrag] = useState({ visible: false, x: 0, settling: false })
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpenseTemplate[]>(() => loadFixedExpenses())
  const [fixedTitle, setFixedTitle] = useState('')
  const [fixedAmount, setFixedAmount] = useState('')
  const [fixedCategoryId, setFixedCategoryId] = useState('rent')
  const [isFixedExpenseOpen, setIsFixedExpenseOpen] = useState(false)
  const [repeatDraft, setRepeatDraft] = useState<{ expense: Expense; amount: string } | null>(null)
  const [recordFilter, setRecordFilter] = useState<RecordFilter>('all')
  const [recordAccountFilter, setRecordAccountFilter] = useState<RecordAccountFilter>('all')
  const [isRecordManaging, setIsRecordManaging] = useState(false)
  const [isQuickSaving, setIsQuickSaving] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [personAName, setPersonAName] = useState('')
  const [personBName, setPersonBName] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [newCategoryIcon, setNewCategoryIcon] = useState('other')
  const [ratioPersonA, setRatioPersonA] = useState('50')
  const [calculator, setCalculator] = useState<{ target: CalculatorTarget; expression: string } | null>(null)
  const [isCategoryFormOpen, setIsCategoryFormOpen] = useState(false)
  const [isQuickCategoryPickerOpen, setIsQuickCategoryPickerOpen] = useState(false)
  const [isExpenseCategoryFormOpen, setIsExpenseCategoryFormOpen] = useState(false)
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false)
  const [editingCategoryIconId, setEditingCategoryIconId] = useState<string | null>(null)
  const [isRemovingCategories, setIsRemovingCategories] = useState(false)
  const fixedAutoRunKey = useRef('')
  const longPressTimer = useRef<number | null>(null)
  const swipeCameraInputRef = useRef<HTMLInputElement | null>(null)
  const galleryInputRef = useRef<HTMLInputElement | null>(null)
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const swipeStart = useRef<{ x: number; y: number } | null>(null)
  const cameraSwipeStart = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    localStorage.setItem(themeStorageKey, theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem(fixedExpensesStorageKey, JSON.stringify(fixedExpenses))
  }, [fixedExpenses])

  useEffect(() => {
    localStorage.setItem(quickCategoriesStorageKey, JSON.stringify(quickCategoryIds))
  }, [quickCategoryIds])

  useEffect(() => {
    closeTemporaryPanels()
  }, [activeTab])

  useEffect(() => {
    let cancelled = false

    async function startCameraPreview() {
      if (!isCameraModeOpen) {
        setCameraStatus('idle')
        return
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraStatus('error')
        return
      }

      setCameraStatus('starting')
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        cameraStreamRef.current?.getTracks().forEach((track) => track.stop())
        cameraStreamRef.current = stream
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream
          await cameraVideoRef.current.play().catch(() => undefined)
        }
        setCameraStatus('ready')
      } catch {
        if (!cancelled) setCameraStatus('error')
      }
    }

    void startCameraPreview()

    return () => {
      cancelled = true
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop())
      cameraStreamRef.current = null
    }
  }, [isCameraModeOpen])

  useEffect(() => {
    let isMounted = true

    async function boot() {
      const cached = loadCachedAppData()
      if (cached) {
        applyLoadedData(cached, user)
        setIsLoading(false)
      } else {
        setIsLoading(true)
      }

      if (cloudMode && supabase) {
        const { data: sessionData } = await supabase.auth.getSession()
        const activeUser = sessionData.session?.user ?? null
        if (!isMounted) return
        setUser(activeUser)
        if (!activeUser) {
          applyLoadedData(null, null)
          setIsLoading(false)
          return
        }

        const fresh = await loadCloudAppData(activeUser)
        if (!isMounted) return
        applyLoadedData(fresh, activeUser)
        if (fresh) await saveLocalAppData(fresh)
      } else {
        const loaded = await loadAppData()
        if (!isMounted) return
        applyLoadedData(loaded, null)
        await saveLocalAppData(loaded)
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
      setIsLoading(!loadCachedAppData())
      loadCloudAppData(activeUser ?? undefined)
        .then((loaded) => {
          applyLoadedData(loaded, activeUser)
          if (loaded) void saveLocalAppData(loaded)
        })
        .finally(() => setIsLoading(false))
    })

    return () => {
      isMounted = false
      listener.subscription.unsubscribe()
    }
  }, [cloudMode])

  useEffect(() => {
    if (!data || cloudMode) return
    void saveLocalAppData(data)
  }, [cloudMode, data])

  useEffect(() => {
    if (!cloudMode || !data) return
    return subscribeToHousehold(data.household.id, async () => {
      const refreshed = await loadCloudAppData(user ?? undefined)
      applyLoadedData(refreshed, user)
      if (refreshed) await saveLocalAppData(refreshed)
    })
  }, [cloudMode, data?.household.id, user])

  useEffect(() => {
    if (!data || fixedExpenses.length === 0) return
    const runKey = `${data.household.id}-${currentMonthInputValue()}-${fixedExpenses.map((item) => item.id).join(',')}`
    if (fixedAutoRunKey.current === runKey) return
    fixedAutoRunKey.current = runKey
    void autoApplyFixedExpenses(data, fixedExpenses)
  }, [data, fixedExpenses])

  const monthExpenses = useMemo(() => (data ? expensesForMonth(data.expenses, month) : []), [data, month])
  const sharedMonthExpenses = useMemo(
    () => monthExpenses.filter((expense) => expense.isShared !== false),
    [monthExpenses],
  )
  const settlement = useMemo(
    () => calculateSettlement(sharedMonthExpenses, data?.household.settlementRatio),
    [data?.household.settlementRatio, sharedMonthExpenses],
  )

  async function refreshCloudData() {
    if (!cloudMode) return
    const refreshed = await loadCloudAppData(user ?? undefined)
    applyLoadedData(refreshed, user)
    if (refreshed) await saveLocalAppData(refreshed)
  }

  function applyLoadedData(loaded: AppData | null, activeUser: User | null = user) {
    setData(loaded)
    const firstCategoryId = loaded?.categories[0]?.id
    if (firstCategoryId) {
      setForm((current) => ({ ...current, categoryId: firstCategoryId }))
      setQuickCategoryId(firstCategoryId)
    }
    if (loaded?.household.settlementRatio) {
      setRatioPersonA(String(loaded.household.settlementRatio.personA))
    }

    if (!loaded) {
      setCurrentProfileId(null)
      localStorage.removeItem(profileStorageKey)
      return
    }

    const savedProfile = localStorage.getItem(profileStorageKey) as Member['id'] | null
    const profileExists = loaded.household.members.some((member) => member.id === savedProfile)
    const ownMember = activeUser ? loaded.household.members.find((member) => member.userId === activeUser.id) : null
    const nextProfile = ownMember?.id ?? (profileExists ? savedProfile : null)
    setCurrentProfileId(nextProfile)

    if (nextProfile) localStorage.setItem(profileStorageKey, nextProfile)
    else localStorage.removeItem(profileStorageKey)
  }

  if (isLoading) {
    return (
      <main className={`phone-shell theme-${theme} loading-screen`}>
        <WalletCards size={40} />
        <p>正在打開帳本...</p>
      </main>
    )
  }

  if (cloudMode && !user && !data) {
    return (
      <main className={`phone-shell theme-${theme}`}>
        <section className="profile-gate">
          <p className="muted-label">Cloud Sync</p>
          <h1>登入你的帳本</h1>
          <p>輸入 email 後，Supabase 會寄出登入連結。兩個人各自登入後，就可以同步同一個帳本。</p>
          <form onSubmit={handleSendMagicLink}>
            <label>
              Email
              <input type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="you@example.com" />
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
          <h1>{setupMode === 'create' ? '建立新帳本' : '加入現有帳本'}</h1>
          <p>{setupMode === 'create' ? '第一個人先建立帳本，完成後把邀請碼交給對方。' : '如果對方已經建立帳本，請輸入對方給你的邀請碼。'}</p>
          <div className="setup-switch">
            <button type="button" className={setupMode === 'create' ? 'selected' : ''} onClick={() => setSetupMode('create')}>建立</button>
            <button type="button" className={setupMode === 'join' ? 'selected' : ''} onClick={() => setSetupMode('join')}>加入</button>
          </div>
          {setupMode === 'create' ? (
            <form onSubmit={handleCreateHousehold}>
              <label>你的顯示名稱<input value={personAName} onChange={(event) => setPersonAName(event.target.value)} placeholder="例如：Ben" /></label>
              <label>對方顯示名稱<input value={personBName} onChange={(event) => setPersonBName(event.target.value)} placeholder="例如：Emily" /></label>
              <button className="primary-action" type="submit"><Plus size={18} />建立新帳本</button>
            </form>
          ) : (
            <form onSubmit={handleJoinHousehold}>
              <label>邀請碼<input value={joinCode} onChange={(event) => setJoinCode(event.target.value)} placeholder="例如：HKD-2486" /></label>
              <label>你的顯示名稱<input value={joinName} onChange={(event) => setJoinName(event.target.value)} placeholder="例如：Emily" /></label>
              <button className="secondary-action" type="submit"><Copy size={18} />加入現有帳本</button>
            </form>
          )}
          {statusMessage && <p className="status-message">{statusMessage}</p>}
        </section>
      </main>
    )
  }

  if (!data) return null

  const appData = data
  const [personA, personB] = appData.household.members
  const currentProfile = appData.household.members.find((member) => member.id === currentProfileId) ?? null
  const otherProfile = currentProfile && appData.household.members.find((member) => member.id !== currentProfile.id)
  const otherName = otherProfile?.name ?? '對方'
  const myExpenses = currentProfile ? monthExpenses.filter((expense) => expense.payerId === currentProfile.id) : []
  const personalOnlyTotals = monthExpenses.reduce(
    (totals, expense) => {
      if (expense.isShared === false) {
        totals[expense.payerId] = roundMoney(totals[expense.payerId] + expense.hkdAmount)
      }
      return totals
    },
    { personA: 0, personB: 0 },
  )
  const personalMonthlyTotals = {
    personA: roundMoney(personalOnlyTotals.personA + settlement.owed.personA),
    personB: roundMoney(personalOnlyTotals.personB + settlement.owed.personB),
  }
  const myPaid = currentProfile ? personalMonthlyTotals[currentProfile.id] : 0
  const myOwed = currentProfile ? settlement.owed[currentProfile.id] : 0
  const sharedPaidTotal = settlement.paid.personA + settlement.paid.personB
  const personAPercentage = sharedPaidTotal > 0 ? Math.round((settlement.paid.personA / sharedPaidTotal) * 100) : 50
  const personBPercentage = sharedPaidTotal > 0 ? 100 - personAPercentage : 50
  const myCategoryTotals = Object.values(
    myExpenses.reduce<Record<string, { categoryId: string; amount: number }>>((groups, expense) => {
      const current = groups[expense.categoryId] ?? { categoryId: expense.categoryId, amount: 0 }
      current.amount = roundMoney(current.amount + expense.hkdAmount)
      groups[expense.categoryId] = current
      return groups
    }, {}),
  ).sort((a, b) => b.amount - a.amount)
  const recentTemplates = [...appData.expenses].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6)
  const recordExpenses = monthExpenses.filter((expense) => {
    const matchesPerson = recordFilter === 'all' || expense.payerId === recordFilter
    const matchesAccount =
      recordAccountFilter === 'all'
      || (recordAccountFilter === 'personal' && expense.isShared === false)
      || (recordAccountFilter === 'shared' && expense.isShared !== false)
    return matchesPerson && matchesAccount
  })
  const recordTotal = roundMoney(recordExpenses.reduce((total, expense) => total + expense.hkdAmount, 0))
  const quickCategories = buildQuickCategories(appData.categories, appData.expenses, quickCategoryIds)

  function updateData(next: AppData) {
    setData(next)
  }

  function closeTemporaryPanels() {
    setIsCategoryFormOpen(false)
    setIsQuickCategoryPickerOpen(false)
    setIsExpenseCategoryFormOpen(false)
    setIsCategoryMenuOpen(false)
    setEditingCategoryIconId(null)
    setCalculator(null)
  }

  function switchTab(tab: Tab) {
    closeTemporaryPanels()
    setActiveTab(tab)
  }

  function rememberQuickCategory(categoryId: string) {
    setQuickCategoryId(categoryId)
    setQuickCategoryIds((current) => [categoryId, ...current.filter((id) => id !== categoryId)].slice(0, 7))
  }

  function categoryName(categoryId: string) {
    return appData.categories.find((category) => category.id === categoryId)?.name ?? '其他'
  }

  function categoryMeta(categoryId: string) {
    return appData.categories.find((category) => category.id === categoryId)
  }

  function personalSettlementText() {
    if (!currentProfile || !settlement.transfer.amount) return '暫時不用互相補錢'
    if (settlement.transfer.from === currentProfile.id) return `你需要轉 ${formatMoney(settlement.transfer.amount)} 給 ${otherName}`
    if (settlement.transfer.to === currentProfile.id) return `${otherName} 需要轉 ${formatMoney(settlement.transfer.amount)} 給你`
    return '暫時不用互相補錢'
  }

  function selectProfile(id: Member['id']) {
    setCurrentProfileId(id)
    localStorage.setItem(profileStorageKey, id)
    switchTab('overview')
    setStatusMessage('')
  }

  async function saveExpense(expense: Expense) {
    if (cloudMode) {
      const existsInCloudData = appData.expenses.some((item) => item.id === expense.id)
      if (existsInCloudData) await updateCloudExpense(expense)
      else await insertCloudExpense(expense)
      await refreshCloudData()
    } else {
      updateData(upsertExpense(appData, expense))
    }
  }

  async function buildExpenseFromForm(existing?: Expense) {
    if (!currentProfile) throw new Error('請先選擇你的身份。')
    const amount = Number(form.amount)
    if (!amount || amount <= 0) throw new Error('請輸入有效金額。')
    if (form.currency !== 'HKD' && form.useManualRate && Number(form.manualRate) <= 0) throw new Error('請輸入有效的手動匯率。')

    const rateResult = form.useManualRate && Number(form.manualRate) > 0
      ? { rate: Number(form.manualRate), source: 'manual' as const }
      : await getExchangeRateToHkd(form.currency, form.date)
    const hkdAmount = roundMoney(amount * rateResult.rate)
    const expenseTitle = form.title.trim() || categoryName(form.categoryId)
    const selectedPayer = appData.household.members.find((member) => member.id === form.payerId)
    const selectedPayerId: Member['id'] = selectedPayer?.id ?? currentProfile.id
    const splitMode: SplitMode = form.isShared ? 'equal' : selectedPayerId

    return {
      id: existing?.id ?? crypto.randomUUID(),
      householdId: appData.household.id,
      date: form.date,
      title: expenseTitle,
      originalAmount: amount,
      originalCurrency: form.currency,
      exchangeRateToHkd: rateResult.rate,
      hkdAmount,
      payerId: selectedPayerId,
      isShared: form.isShared,
      categoryId: form.categoryId,
      splitMode,
      split: buildSplit(splitMode, hkdAmount, Number(form.customPersonA) || 0),
      note: form.note.trim(),
      photoDataUrl: form.photoDataUrl,
      photoCaption: form.photoCaption.trim(),
      notifyOther: form.notifyOther,
      rateSource: rateResult.source,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    } satisfies Expense
  }

  async function handleSendMagicLink(event: FormEvent) {
    event.preventDefault()
    if (!authEmail.trim()) return setStatusMessage('請先輸入 email。')
    try {
      await sendMagicLink(authEmail.trim())
      setStatusMessage('登入連結已寄出，請打開 email 按連結。')
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '登入連結寄出失敗。')
    }
  }

  async function handleCreateHousehold(event: FormEvent) {
    event.preventDefault()
    try {
      if (cloudMode) applyLoadedData(await createCloudHousehold(personAName.trim() || 'Ben', personBName.trim() || 'Emily'), user)
      else updateData({ household: buildHousehold(personAName.trim() || 'Ben', personBName.trim() || 'Emily'), categories: defaultCategories, expenses: [] })
      setStatusMessage('已建立帳本。')
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '建立帳本失敗。')
    }
  }

  async function handleJoinHousehold(event: FormEvent) {
    event.preventDefault()
    if (!joinCode.trim()) return setStatusMessage('請輸入邀請碼。')
    try {
      applyLoadedData(await joinCloudHousehold(joinCode, joinName.trim()), user)
      setStatusMessage('已加入帳本。')
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '加入帳本失敗。')
    }
  }

  async function handleAddExpense(event: FormEvent) {
    event.preventDefault()
    setIsSaving(true)
    try {
      const existing = editingExpenseId ? appData.expenses.find((expense) => expense.id === editingExpenseId) : undefined
      const expense = await buildExpenseFromForm(existing)
      await saveExpense(expense)
      rememberQuickCategory(expense.categoryId)
      setForm({ ...initialForm, date: form.date, categoryId: form.categoryId, payerId: form.payerId })
      setIsExpensePhotoOpen(false)
      setEditingExpenseId(null)
      setStatusMessage(editingExpenseId ? '支出已更新。' : '支出已儲存。')
      switchTab('overview')
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '儲存支出失敗。')
    } finally {
      setIsSaving(false)
    }
  }

  async function addQuickExpense(title: string, amount: number, categoryId: string, source?: Expense, overrides?: Partial<Pick<Expense, 'date' | 'payerId' | 'isShared'>>) {
    if (!currentProfile) throw new Error('請先選擇你的身份。')
    const hkdAmount = roundMoney(amount)
    const isShared = overrides?.isShared ?? (source ? source.isShared !== false : false)
    const splitMode = isShared ? (source?.splitMode ?? 'equal') : (overrides?.payerId ?? currentProfile.id)
    const split = buildSplit(splitMode, hkdAmount, source?.split.personA ?? 0)
    const expense: Expense = {
      id: crypto.randomUUID(),
      householdId: appData.household.id,
      date: overrides?.date ?? todayInputValue(),
      title: title || categoryName(categoryId),
      originalAmount: amount,
      originalCurrency: 'HKD',
      exchangeRateToHkd: 1,
      hkdAmount,
      payerId: overrides?.payerId ?? currentProfile.id,
      isShared,
      categoryId,
      splitMode,
      split,
      note: source ? '重複加入' : '快速新增',
      rateSource: 'hkd',
      createdAt: new Date().toISOString(),
    }
    if (cloudMode) {
      await insertCloudExpense(expense)
      await refreshCloudData()
    } else {
      updateData(upsertExpense(appData, expense))
    }
  }

  function handleAddFixedExpense(event: FormEvent) {
    event.preventDefault()
    const amount = Number(fixedAmount)
    if (!fixedTitle.trim() || !amount || amount <= 0 || !currentProfile) return
    setFixedExpenses((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        title: fixedTitle.trim(),
        amount,
        categoryId: fixedCategoryId,
        payerId: currentProfile.id,
        splitMode: 'equal',
      },
    ])
    setFixedTitle('')
    setFixedAmount('')
    setStatusMessage('固定支出已新增。')
  }

  async function applyFixedExpense(template: FixedExpenseTemplate) {
    setIsQuickSaving(true)
    try {
      await addQuickExpense(template.title, template.amount, template.categoryId, undefined, {
        date: firstDayOfMonth(month),
        payerId: template.payerId,
      })
      setStatusMessage(`已加入本月固定支出「${template.title}」。`)
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '加入固定支出失敗。')
    } finally {
      setIsQuickSaving(false)
    }
  }

  function deleteFixedExpense(templateId: string) {
    setFixedExpenses((current) => current.filter((template) => template.id !== templateId))
  }

  async function autoApplyFixedExpenses(currentData: AppData, templates: FixedExpenseTemplate[]) {
    if (!currentProfile || templates.length === 0) return
    const currentMonth = currentMonthInputValue()
    const applied = loadFixedExpenseApplied()
    const dueTemplates = templates.filter((template) => !applied.includes(fixedExpenseApplyKey(currentData.household.id, template.id, currentMonth)))
    if (dueTemplates.length === 0) return

    const firstDay = firstDayOfMonth(currentMonth)
    const createdExpenses = dueTemplates.map((template) => {
      const hkdAmount = roundMoney(template.amount)
      return {
        id: crypto.randomUUID(),
        householdId: currentData.household.id,
        date: firstDay,
        title: template.title,
        originalAmount: template.amount,
        originalCurrency: 'HKD',
        exchangeRateToHkd: 1,
        hkdAmount,
        payerId: currentData.household.members.some((member) => member.id === template.payerId) ? template.payerId : 'personA',
        isShared: false,
        categoryId: template.categoryId,
        splitMode: template.splitMode,
        split: buildSplit(template.splitMode, hkdAmount, 0),
        note: '固定支出',
        rateSource: 'hkd',
        createdAt: new Date().toISOString(),
      } satisfies Expense
    })

    try {
      if (cloudMode) {
        for (const expense of createdExpenses) {
          await insertCloudExpense(expense)
        }
        await refreshCloudData()
      } else {
        updateData(createdExpenses.reduce((nextData, expense) => upsertExpense(nextData, expense), currentData))
      }
      saveFixedExpenseApplied([
        ...applied,
        ...dueTemplates.map((template) => fixedExpenseApplyKey(currentData.household.id, template.id, currentMonth)),
      ])
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '自動加入固定支出失敗。')
    }
  }

  async function handleQuickAdd(event: FormEvent) {
    event.preventDefault()
    await submitQuickAdd()
  }

  async function submitQuickAdd(amountText = quickAmount) {
    const amount = Number(amountText)
    if (!amount || amount <= 0) return setStatusMessage('請輸入有效金額。')
    setIsQuickSaving(true)
    try {
      await addQuickExpense(quickTitle.trim(), amount, quickCategoryId, undefined, { isShared: quickIsShared })
      rememberQuickCategory(quickCategoryId)
      setQuickTitle('')
      setQuickAmount('')
      setStatusMessage('已快速新增支出。')
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '快速新增失敗。')
    } finally {
      setIsQuickSaving(false)
    }
  }

  async function handleConfirmRepeat() {
    if (!repeatDraft) return
    const amount = Number(repeatDraft.amount)
    if (!amount || amount <= 0) return setStatusMessage('請輸入有效金額。')
    setIsQuickSaving(true)
    try {
      await addQuickExpense(repeatDraft.expense.title, amount, repeatDraft.expense.categoryId, repeatDraft.expense)
      rememberQuickCategory(repeatDraft.expense.categoryId)
      setRepeatDraft(null)
      setStatusMessage('已重複加入支出。')
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '重複加入失敗。')
    } finally {
      setIsQuickSaving(false)
    }
  }

  function openCalculator(target: CalculatorTarget, value: string) {
    setCalculator({ target, expression: value || '' })
  }

  function setCalculatorAmount(target: CalculatorTarget, value: string) {
    if (target === 'quick') setQuickAmount(value)
    if (target === 'expense') setForm((current) => ({ ...current, amount: value }))
    if (target === 'repeat') setRepeatDraft((current) => (current ? { ...current, amount: value } : current))
    if (target === 'fixed') setFixedAmount(value)
    if (target === 'story') setStoryAmount(value)
  }

  async function handleExpensePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    if (!file) return

    try {
      const photoDataUrl = await compressExpensePhoto(file)
      setForm((current) => ({
        ...current,
        photoDataUrl,
        photoCaption: current.photoCaption || current.note,
      }))
      setStatusMessage('相片已加入支出記錄。')
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '相片加入失敗。')
    } finally {
      event.currentTarget.value = ''
    }
  }

  function openStoryCamera() {
    setStatusMessage('')
    if (swipeCameraInputRef.current) swipeCameraInputRef.current.value = ''
    swipeCameraInputRef.current?.click()
  }

  function openStoryGallery() {
    setStatusMessage('')
    if (galleryInputRef.current) galleryInputRef.current.value = ''
    galleryInputRef.current?.click()
  }

  function closeCameraMode() {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop())
    cameraStreamRef.current = null
    setCameraStatus('idle')
    setIsCameraModeOpen(false)
    setCameraDrag({ visible: false, x: 0, settling: false })
  }

  function captureCameraPhoto() {
    const video = cameraVideoRef.current
    if (!video || cameraStatus !== 'ready' || !video.videoWidth || !video.videoHeight) {
      setStatusMessage('相機未準備好，請再試一次。')
      return
    }

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) {
      setStatusMessage('未能擷取相片，請再試一次。')
      return
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    setStoryPhotoDataUrl(canvas.toDataURL('image/jpeg', 0.82))
    closeCameraMode()
    setIsStoryCameraOpen(true)
    setStatusMessage('')
  }

  function handleCameraModeTouchStart(event: TouchEvent<HTMLDivElement>) {
    const touch = event.touches[0]
    if (!touch) return
    cameraSwipeStart.current = { x: touch.clientX, y: touch.clientY }
  }

  function handleCameraModeTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const start = cameraSwipeStart.current
    const touch = event.changedTouches[0]
    cameraSwipeStart.current = null
    if (!start || !touch) return

    const deltaX = touch.clientX - start.x
    const deltaY = Math.abs(touch.clientY - start.y)
    if (deltaX < -72 && deltaY < 90) {
      closeCameraMode()
    }
  }

  function closeStoryCamera() {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop())
    cameraStreamRef.current = null
    setCameraStatus('idle')
    setIsStoryCameraOpen(false)
    setIsCameraModeOpen(false)
    setCalculator((current) => (current?.target === 'story' ? null : current))
  }

  function resetStoryCamera() {
    setStoryPhotoDataUrl('')
    setStoryTitle('')
    setStoryCaption('')
    setStoryAmount('')
    setStoryCategoryId(quickCategoryId || 'food')
    setStoryIsShared(false)
    setStoryNotifyOther(true)
  }

  async function handleStoryPhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    if (!file) return

    try {
      const photoDataUrl = await compressExpensePhoto(file)
      setStoryPhotoDataUrl(photoDataUrl)
      setCameraDrag({ visible: false, x: 0, settling: false })
      setIsCameraModeOpen(false)
      setIsStoryCameraOpen(true)
      setStatusMessage('相片已準備好，可以加入支出資料。')
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '相片加入失敗。')
    } finally {
      event.currentTarget.value = ''
    }
  }

  function handleShellTouchStart(event: TouchEvent<HTMLElement>) {
    const touch = event.touches[0]
    if (!touch || touch.clientX > 28 || isStoryCameraOpen || isCameraModeOpen) {
      swipeStart.current = null
      return
    }
    swipeStart.current = { x: touch.clientX, y: touch.clientY }
    setCameraDrag({ visible: true, x: 0, settling: false })
  }

  function handleShellTouchMove(event: TouchEvent<HTMLElement>) {
    const start = swipeStart.current
    const touch = event.touches[0]
    if (!start || !touch) return

    const deltaX = Math.max(0, touch.clientX - start.x)
    const deltaY = Math.abs(touch.clientY - start.y)
    if (deltaY > 72 && deltaY > deltaX) {
      swipeStart.current = null
      setCameraDrag({ visible: false, x: 0, settling: false })
      return
    }

    if (deltaX > 8) {
      const width = window.innerWidth || 390
      setCameraDrag({ visible: true, x: Math.min(deltaX, width), settling: false })
    }
  }

  function handleShellTouchEnd(event: TouchEvent<HTMLElement>) {
    const start = swipeStart.current
    const touch = event.changedTouches[0]
    swipeStart.current = null
    if (!start || !touch) return

    const deltaX = touch.clientX - start.x
    const deltaY = Math.abs(touch.clientY - start.y)
    const width = window.innerWidth || 390
    if (deltaX > width * 0.5 && deltaY < 90) {
      setCameraDrag({ visible: true, x: width, settling: true })
      setStatusMessage('')
      window.setTimeout(() => {
        setCameraDrag({ visible: false, x: 0, settling: false })
        setIsCameraModeOpen(true)
      }, 220)
      return
    }

    setCameraDrag({ visible: true, x: 0, settling: true })
    window.setTimeout(() => {
      setCameraDrag({ visible: false, x: 0, settling: false })
    }, 220)
  }

  async function handleStorySubmit(event: FormEvent) {
    event.preventDefault()
    if (!currentProfile) return
    const amount = Number(storyAmount)
    if (!storyPhotoDataUrl) return setStatusMessage('請先拍照或選擇相片。')
    if (!amount || amount <= 0) return setStatusMessage('請輸入有效金額。')

    setIsStorySaving(true)
    try {
      const hkdAmount = roundMoney(amount)
      const splitMode: SplitMode = storyIsShared ? 'equal' : currentProfile.id
      const expense: Expense = {
        id: crypto.randomUUID(),
        householdId: appData.household.id,
        date: todayInputValue(),
        title: storyTitle.trim() || storyCaption.trim() || categoryName(storyCategoryId),
        originalAmount: amount,
        originalCurrency: 'HKD',
        exchangeRateToHkd: 1,
        hkdAmount,
        payerId: currentProfile.id,
        isShared: storyIsShared,
        categoryId: storyCategoryId,
        splitMode,
        split: buildSplit(splitMode, hkdAmount, 0),
        note: storyCaption.trim(),
        photoDataUrl: storyPhotoDataUrl,
        photoCaption: storyCaption.trim(),
        notifyOther: storyNotifyOther,
        rateSource: 'hkd',
        createdAt: new Date().toISOString(),
      }

      await saveExpense(expense)
      rememberQuickCategory(expense.categoryId)
      resetStoryCamera()
      closeStoryCamera()
      setStatusMessage(storyNotifyOther ? '已用照片記錄支出，並標記通知對方。' : '已用照片記錄支出。')
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '照片支出儲存失敗。')
    } finally {
      setIsStorySaving(false)
    }
  }

  async function handleCalculatorPress(key: string) {
    if (!calculator) return

    if (key === 'OK') {
      const result = calculateExpression(calculator.expression)
      if (result !== null) {
        const value = formatCalculatorValue(result)
        setCalculatorAmount(calculator.target, value)
        if (calculator.target === 'quick') {
          setCalculator(null)
          await submitQuickAdd(value)
          return
        }
      }
      setCalculator(null)
      return
    }

    if (key === '=') {
      const result = calculateExpression(calculator.expression)
      if (result !== null) {
        const value = formatCalculatorValue(result)
        setCalculator({ ...calculator, expression: value })
        setCalculatorAmount(calculator.target, value)
      }
      return
    }

    if (key === 'C') {
      setCalculator({ ...calculator, expression: '' })
      setCalculatorAmount(calculator.target, '')
      return
    }

    if (key === '⌫') {
      const value = calculator.expression.slice(0, -1)
      setCalculator({ ...calculator, expression: value })
      setCalculatorAmount(calculator.target, value)
      return
    }

    if (key === 'backspace') {
      const value = calculator.expression.slice(0, -1)
      setCalculator({ ...calculator, expression: value })
      setCalculatorAmount(calculator.target, value)
      return
    }

    const value = `${calculator.expression}${key}`
    setCalculator({ ...calculator, expression: value })
    if (isPlainNumber(value)) setCalculatorAmount(calculator.target, value)
  }

  function startEditExpense(expense: Expense) {
    setEditingExpenseId(expense.id)
    setForm({
      title: expense.title,
      date: expense.date,
      amount: String(expense.originalAmount),
      currency: expense.originalCurrency,
      payerId: expense.payerId,
      isShared: expense.isShared !== false,
      categoryId: expense.categoryId,
      splitMode: expense.splitMode,
      customPersonA: String(expense.split.personA),
      note: expense.note,
      photoDataUrl: expense.photoDataUrl ?? '',
      photoCaption: expense.photoCaption ?? '',
      notifyOther: expense.notifyOther ?? false,
      manualRate: String(expense.exchangeRateToHkd),
      useManualRate: expense.rateSource === 'manual',
    })
    setIsExpensePhotoOpen(Boolean(expense.photoDataUrl || expense.photoCaption || expense.notifyOther))
    switchTab('add')
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
    if (!name) return
    try {
      const color = categoryColors[appData.categories.length % categoryColors.length]
      const category = cloudMode
        ? await insertCloudCategory(appData.household.id, name, color, newCategoryIcon)
        : { id: crypto.randomUUID(), name, color, icon: newCategoryIcon }
      updateData(addCategory(appData, category))
      setNewCategory('')
      setNewCategoryIcon('other')
      setIsCategoryFormOpen(false)
      setIsExpenseCategoryFormOpen(false)
      setStatusMessage(`已新增分類「${name}」。`)
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '新增分類失敗。')
    }
  }

  async function handleAddExpenseCategory() {
    const name = newCategory.trim()
    if (!name) return
    try {
      const color = categoryColors[appData.categories.length % categoryColors.length]
      const category = cloudMode
        ? await insertCloudCategory(appData.household.id, name, color, newCategoryIcon)
        : { id: crypto.randomUUID(), name, color, icon: newCategoryIcon }
      updateData(addCategory(appData, category))
      setForm((current) => ({ ...current, categoryId: category.id }))
      setQuickCategoryId(category.id)
      setNewCategory('')
      setNewCategoryIcon('other')
      setIsExpenseCategoryFormOpen(false)
      setStatusMessage(`已新增並選用「${name}」。`)
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '新增分類失敗。')
    }
  }

  function beginCategoryLongPress(category: Category) {
    cancelCategoryLongPress()
    longPressTimer.current = window.setTimeout(() => {
      void requestDeleteCategory(category)
    }, 3000)
  }

  function cancelCategoryLongPress() {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  async function requestDeleteCategory(category: Category) {
    cancelCategoryLongPress()

    if (appData.categories.length <= 1) {
      setStatusMessage('最少需要保留一個分類。')
      return
    }

    const usedCount = appData.expenses.filter((expense) => expense.categoryId === category.id).length
    const message = usedCount
      ? `確定移除「${category.name}」？已有 ${usedCount} 筆支出使用這個分類，移除後明細會顯示為其他。`
      : `確定移除「${category.name}」？`

    if (!window.confirm(message)) {
      return
    }

    try {
      if (cloudMode) {
        await deleteCloudCategory(category.id)
        await refreshCloudData()
      } else {
        updateData(deleteCategory(appData, category.id))
      }
      if (quickCategoryId === category.id) {
        setQuickCategoryId(appData.categories.find((item) => item.id !== category.id)?.id ?? 'other')
      }
      setIsRemovingCategories(false)
      setIsCategoryMenuOpen(false)
      setStatusMessage(`已移除分類「${category.name}」。`)
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '移除分類失敗。')
    }
  }

  async function handleUpdateCategoryIcon(category: Category, icon: string) {
    try {
      if (cloudMode) {
        await updateCloudCategoryIcon(category.id, icon)
        await refreshCloudData()
      } else {
        updateData(updateCategoryIcon(appData, category.id, icon))
      }
      setEditingCategoryIconId(null)
      setStatusMessage(`已更新「${category.name}」圖示。`)
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '更新分類圖示失敗。')
    }
  }

  async function handleSaveSettlementRatio(event: FormEvent) {
    event.preventDefault()
    const personAValue = Math.min(Math.max(Number(ratioPersonA), 0), 100)
    const personBValue = roundMoney(100 - personAValue)

    try {
      if (cloudMode) {
        await updateCloudSettlementRatio(appData.household.id, personAValue, personBValue)
        await refreshCloudData()
      } else {
        updateData(updateSettlementRatio(appData, personAValue, personBValue))
      }
      setRatioPersonA(String(personAValue))
      setStatusMessage(`月結比例已更新：${personA.name} ${personAValue}% / ${personB.name} ${personBValue}%。`)
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '更新月結比例失敗。')
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
              <button key={member.id} type="button" onClick={() => selectProfile(member.id)}>
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
    <main className={`phone-shell theme-${theme}`} onTouchStart={handleShellTouchStart} onTouchMove={handleShellTouchMove} onTouchEnd={handleShellTouchEnd} onTouchCancel={handleShellTouchEnd}>
      <input ref={swipeCameraInputRef} className="sr-only-camera-input" type="file" accept="image/*" capture="environment" onChange={handleStoryPhotoChange} />
      <input ref={galleryInputRef} className="sr-only-camera-input" type="file" accept="image/*" onChange={handleStoryPhotoChange} />
      {cameraDrag.visible && (
        <div
          className={`camera-drag-preview ${cameraDrag.settling ? 'is-settling' : ''}`}
          style={{ transform: `translateX(calc(-100% + ${Math.max(0, cameraDrag.x)}px))` }}
          aria-hidden="true"
        >
          <div className="camera-drag-lens">
            <Camera size={34} />
          </div>
          <strong>相機</strong>
          <span>{cameraDrag.x > ((typeof window !== 'undefined' ? window.innerWidth : 390) * 0.5) ? '放手開啟相機' : '向右拉過一半'}</span>
        </div>
      )}
      {isCameraModeOpen && (
        <div
          className="camera-mode-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="相機模式"
          onTouchStart={handleCameraModeTouchStart}
          onTouchEnd={handleCameraModeTouchEnd}
        >
          <div className="camera-mode-top">
            <button type="button" onClick={closeCameraMode} aria-label="關閉相機"><X size={22} /></button>
            <span>{cameraStatus === 'ready' ? '相機已啟動' : cameraStatus === 'error' ? '未能開啟相機' : '啟動相機中'}</span>
            <span />
          </div>
          <div className="camera-viewfinder">
            <video ref={cameraVideoRef} autoPlay muted playsInline />
            {cameraStatus !== 'ready' && (
              <div className="camera-status-overlay">
                <Camera size={30} />
                <span>{cameraStatus === 'error' ? '請允許相機權限，或用左下角選相。' : '正在開啟鏡頭...'}</span>
              </div>
            )}
          </div>
          <div className="camera-mode-actions">
            <button type="button" className="gallery-button" onClick={openStoryGallery} aria-label="選擇相片">
              <ImageIcon size={24} />
            </button>
            <button type="button" className="camera-shutter" onClick={captureCameraPhoto} aria-label="拍照" disabled={cameraStatus !== 'ready'}>
              <span />
            </button>
            <span className="camera-action-spacer" />
          </div>
        </div>
      )}
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
          <input aria-label="選擇月份" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </label>
        <button type="button" onClick={() => switchTab('add')} className="quick-add"><Plus size={18} />新增</button>
      </section>

      {activeTab === 'overview' && (
        <section className="screen-stack">
          <form className="quick-entry panel" onSubmit={handleQuickAdd}>
            <div className="quick-entry-title"><Plus size={17} /><h2>快速加入支出</h2></div>
            <div className="quick-category-strip">
              <div className="quick-categories" aria-label="快速分類">
              {quickCategories.map((category) => (
                <button key={category.id} type="button" className={quickCategoryId === category.id ? 'selected' : ''} onClick={() => rememberQuickCategory(category.id)}>
                  <span className="category-icon"><CategoryIcon category={category} /></span>
                  <span>{category.name}</span>
                </button>
              ))}
              </div>
              <button
                type="button"
                className="quick-category-add"
                onClick={() => {
                  setIsQuickCategoryPickerOpen(true)
                }}
              >
                <span className="category-icon"><Plus size={20} /></span>
                <span>新增</span>
              </button>
            </div>
            <div className="quick-fields">
              <input value={quickTitle} onChange={(event) => setQuickTitle(event.target.value)} placeholder="項目，例如：麥當勞晚餐" aria-label="快速輸入項目" />
              <button
                type="button"
                className={`shared-book-toggle quick-shared-toggle ${quickIsShared ? 'selected' : ''}`}
                onClick={() => setQuickIsShared((current) => !current)}
              >
                <Copy size={16} />
                {quickIsShared ? '已加入共同帳簿' : '加入共同帳簿'}
              </button>
              <div className="quick-input-row">
                <span>HK$</span>
                <input readOnly inputMode="none" value={quickAmount} onFocus={() => openCalculator('quick', quickAmount)} onClick={() => openCalculator('quick', quickAmount)} placeholder="金額" aria-label="快速輸入金額" />
                <button type="submit" disabled={isQuickSaving}><Plus size={18} /></button>
              </div>
              {calculator?.target === 'quick' && <CalculatorPadV2 expression={calculator.expression} onPress={handleCalculatorPress} />}
            </div>
          </form>

          {isCategoryFormOpen && (
            <div className="category-modal-backdrop" role="dialog" aria-modal="true" aria-label="新增快速分類" onClick={() => setIsCategoryFormOpen(false)}>
              <form className="panel compact-form category-modal" onSubmit={handleAddCategory} onClick={(event) => event.stopPropagation()}>
                <div className="panel-title"><Plus size={18} /><h2>新增分類</h2></div>
                <label>分類名稱<input id="quick-new-category-name" value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="例如：咖啡、早餐、保險" autoFocus /></label>
                <div className="name-picker" aria-label="分類名稱建議">
                  {categoryNameOptions.map((name) => (
                    <button
                      key={name}
                      type="button"
                      className={newCategory === name ? 'selected' : ''}
                      onClick={() => setNewCategory(name)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <p className="picker-label">選擇圖示</p>
                <div className="icon-picker">
                  {allIconOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={newCategoryIcon === option.id ? 'selected' : ''}
                      onClick={() => setNewCategoryIcon(option.id)}
                      aria-label={option.label}
                      title={option.label}
                    >
                      <CategoryIcon category={{ id: option.id, name: option.label, color: '', icon: option.id }} />
                    </button>
                  ))}
                </div>
                <div className="confirm-actions">
                  <button type="button" onClick={() => setIsCategoryFormOpen(false)}>取消</button>
                  <button type="submit"><Plus size={18} />新增分類</button>
                </div>
              </form>
            </div>
          )}

          {isQuickCategoryPickerOpen && (
            <div className="category-modal-backdrop" role="dialog" aria-modal="true" aria-label="選擇快捷分類" onClick={() => setIsQuickCategoryPickerOpen(false)}>
              <section className="panel compact-form category-modal" onClick={(event) => event.stopPropagation()}>
                <div className="panel-title"><Coins size={18} /><h2>選擇快捷分類</h2></div>
                <div className="category-grid quick-picker-grid">
                  {appData.categories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      className="category-tile"
                      onClick={() => {
                        rememberQuickCategory(category.id)
                        setIsQuickCategoryPickerOpen(false)
                      }}
                    >
                      <span className="category-icon" style={{ background: category.color }}><CategoryIcon category={category} /></span>
                      <strong>{category.name}</strong>
                    </button>
                  ))}
                </div>
                <button className="secondary-action" type="button" onClick={() => setIsQuickCategoryPickerOpen(false)}>取消</button>
              </section>
            </div>
          )}

          {recentTemplates.length > 0 && (
            <section className="panel quick-repeat-panel">
              <div className="panel-title"><Coins size={18} /><h2>最近支出</h2></div>
              <div className="repeat-list">
                {recentTemplates.map((expense) => (
                  <button key={expense.id} type="button" onClick={() => setRepeatDraft({ expense, amount: String(expense.originalAmount) })}>
                    <span>{expense.title}</span>
                    <b>{formatMoney(expense.originalAmount, expense.originalCurrency)}</b>
                  </button>
                ))}
              </div>
              {repeatDraft && (
                <div className="repeat-confirm">
                  <strong>重複加入：{repeatDraft.expense.title}</strong>
                  <input readOnly inputMode="none" value={repeatDraft.amount} onFocus={() => openCalculator('repeat', repeatDraft.amount)} onClick={() => openCalculator('repeat', repeatDraft.amount)} />
                  {calculator?.target === 'repeat' && <CalculatorPadV2 expression={calculator.expression} onPress={handleCalculatorPress} />}
                  <div className="confirm-actions">
                    <button type="button" onClick={() => setRepeatDraft(null)}>取消</button>
                    <button type="button" onClick={() => void handleConfirmRepeat()}>確認加入</button>
                  </div>
                </div>
              )}
            </section>
          )}

          <section className="contribution-card panel">
            <div className="panel-title"><CircleDollarSign size={18} /><h2>雙方暫時支出比例</h2></div>
            <div className="ratio-bar" aria-label="雙方支出比例">
              <div className="ratio-a" style={{ width: `${personAPercentage}%` }}>{personAPercentage}%</div>
              <div className="ratio-b" style={{ width: `${personBPercentage}%` }}>{personBPercentage}%</div>
            </div>
            <div className="ratio-details">
              <div><span>{personA.name} 共同帳簿已付</span><strong>{formatMoney(settlement.paid.personA)}</strong></div>
              <div><span>{personB.name} 共同帳簿已付</span><strong>{formatMoney(settlement.paid.personB)}</strong></div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-title"><Coins size={18} /><h2>你的分類支出</h2></div>
            {myExpenses.length === 0 ? <p className="empty-text">你這個月份還未有支出。</p> : myCategoryTotals.map((item) => (
              <div key={item.categoryId} className="stat-row">
                <span><i style={{ background: categoryMeta(item.categoryId)?.color ?? '#94a3b8' }} />{categoryName(item.categoryId)}</span>
                <b>{formatMoney(item.amount)}</b>
              </div>
            ))}
          </section>

          <section className="panel">
            <div className="panel-title"><CircleDollarSign size={18} /><h2>全月共同帳簿</h2></div>
            <div className="stat-row"><span>共同帳簿總支出</span><b>{formatMoney(settlement.totalHkd)}</b></div>
            <div className="stat-row"><span>月結方向</span><b>{personalSettlementText()}</b></div>
          </section>

          <article className="hero-card">
            <p>今個月結算</p>
            <strong>{personalSettlementText()}</strong>
            <div className="hero-divider" />
            <div className="transfer-line"><span>你的月結後個人支出</span><b>{formatMoney(myPaid)}</b><span>共同帳簿應負擔 {formatMoney(myOwed)}</span></div>
          </article>
        </section>
      )}

      {activeTab === 'add' && (
        <section className="screen-stack">
          <form className="panel entry-panel" onSubmit={handleAddExpense}>
            <div className="panel-title"><Plus size={18} /><h2>{editingExpenseId ? '修改支出' : '新增支出'}</h2></div>
            <div className="payer-selector">
              <span><UserRound size={17} />入帳帳戶</span>
              <div>
                {appData.household.members.map((member) => {
                  const selectedPayerId = form.payerId || currentProfile.id
                  return (
                    <button
                      key={member.id}
                      type="button"
                      className={selectedPayerId === member.id ? 'selected' : ''}
                      onClick={() => setForm({ ...form, payerId: member.id })}
                    >
                      {member.name}
                    </button>
                  )
                })}
              </div>
            </div>
            <button
              type="button"
              className={`shared-book-toggle ${form.isShared ? 'selected' : ''}`}
              onClick={() => setForm({ ...form, isShared: !form.isShared })}
            >
              <Copy size={17} />
              {form.isShared ? '已加入共同帳簿' : '加入共同帳簿'}
            </button>
            <label className="hero-input">項目<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="例如：麥當勞晚餐、車費、超市" /></label>
            <div className="amount-currency-row">
              <label>金額<input readOnly inputMode="none" value={form.amount} onFocus={() => openCalculator('expense', form.amount)} onClick={() => openCalculator('expense', form.amount)} placeholder="0.00" /></label>
              <label>貨幣<select value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value as CurrencyCode, useManualRate: event.target.value === 'HKD' ? false : form.useManualRate })}>{currencies.map((currency) => <option key={currency}>{currency}</option>)}</select></label>
            </div>
            {calculator?.target === 'expense' && <CalculatorPadV2 expression={calculator.expression} onPress={handleCalculatorPress} />}
            <label>日期<input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
            {form.currency !== 'HKD' && <label className="toggle-line"><input type="checkbox" checked={form.useManualRate} onChange={(event) => setForm({ ...form, useManualRate: event.target.checked })} />使用手動匯率</label>}
            {form.currency !== 'HKD' && form.useManualRate && <label>1 {form.currency} 等於多少 HKD<input type="number" min="0" step="0.0001" value={form.manualRate} onChange={(event) => setForm({ ...form, manualRate: event.target.value })} placeholder="例如：0.052" /></label>}
            <div className="expense-category-block">
              <div className="field-heading">
                <span>分類</span>
                <button type="button" onClick={() => setIsExpenseCategoryFormOpen((current) => !current)}><Plus size={15} />新增分類</button>
              </div>
              <div className="expense-category-grid">
                {appData.categories.map((category) => (
                  <button key={category.id} type="button" className={form.categoryId === category.id ? 'selected' : ''} onClick={() => setForm({ ...form, categoryId: category.id })}>
                    <span className="category-icon" style={{ background: category.color }}><CategoryIcon category={category} /></span>
                    <strong>{category.name}</strong>
                  </button>
                ))}
              </div>
            </div>
            {isExpenseCategoryFormOpen && (
              <div className="inline-category-maker">
                <label>新分類名稱<input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="例如：保險、手信、泊車" /></label>
                <div className="name-picker" aria-label="分類名稱快捷選項">
                  {categoryNameOptions.map((name) => <button key={name} type="button" className={newCategory === name ? 'selected' : ''} onClick={() => setNewCategory(name)}>{name}</button>)}
                </div>
                <div className="icon-picker compact-icons">
                  {allIconOptions.map((option) => (
                    <button key={option.id} type="button" className={newCategoryIcon === option.id ? 'selected' : ''} onClick={() => setNewCategoryIcon(option.id)} aria-label={option.label} title={option.label}>
                      <CategoryIcon category={{ id: option.id, name: option.label, color: '', icon: option.id }} />
                    </button>
                  ))}
                </div>
                <div className="confirm-actions">
                  <button type="button" onClick={() => setIsExpenseCategoryFormOpen(false)}>取消</button>
                  <button type="button" onClick={() => void handleAddExpenseCategory()}><Plus size={16} />新增並選用</button>
                </div>
              </div>
            )}
            <label>備註<textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="例如：信用卡實際匯率、旅行地點等" /></label>
            <section className={`expense-photo-panel ${isExpensePhotoOpen ? 'is-open' : ''}`}>
              <button
                type="button"
                className="optional-toggle"
                onClick={() => setIsExpensePhotoOpen((current) => !current)}
                aria-expanded={isExpensePhotoOpen}
              >
                <span><Camera size={17} />支出照片及留言</span>
                <small>Optional</small>
                <ChevronDown size={18} />
              </button>
              {isExpensePhotoOpen && (
                <div className="expense-photo-body">
                  <div className="field-heading">
                    <span>為這筆支出加入相片</span>
                    <label className="photo-capture-button">
                      <ImageIcon size={16} />
                      拍照 / 選相
                      <input type="file" accept="image/*" capture="environment" onChange={handleExpensePhotoChange} />
                    </label>
                  </div>
                  {form.photoDataUrl ? (
                    <article className="photo-preview-card">
                      <img src={form.photoDataUrl} alt="支出照片預覽" />
                      <button type="button" className="photo-remove-button" onClick={() => setForm({ ...form, photoDataUrl: '', photoCaption: '', notifyOther: false })} aria-label="移除相片">
                        <X size={16} />
                      </button>
                    </article>
                  ) : (
                    <div className="photo-empty-state">
                      <Camera size={22} />
                      <span>可以像限時動態一樣，為這筆支出加一張相和一句留言。</span>
                    </div>
                  )}
                  <label>相片留言<input value={form.photoCaption} onChange={(event) => setForm({ ...form, photoCaption: event.target.value })} placeholder="例如：今晚食得好滿足、記得下次你請" /></label>
                  <label className="toggle-line notify-toggle"><input type="checkbox" checked={form.notifyOther} onChange={(event) => setForm({ ...form, notifyOther: event.target.checked })} /><span><Mail size={16} />通知另一位用戶</span></label>
                </div>
              )}
            </section>
            <div className="form-action-stack">
              <button className="primary-action" type="submit" disabled={isSaving}><Check size={18} />{isSaving ? '儲存中...' : editingExpenseId ? '更新支出' : '儲存支出'}</button>
              {editingExpenseId && <button className="secondary-action" type="button" onClick={() => { setEditingExpenseId(null); setForm(initialForm); setIsExpensePhotoOpen(false) }}>取消修改</button>}
            </div>
            {statusMessage && <p className="status-message">{statusMessage}</p>}
          </form>
        </section>
      )}

      {activeTab === 'records' && (
        <section className="screen-stack">
          <section className="panel fixed-expense-panel">
            <button
              type="button"
              className="fixed-expense-toggle"
              onClick={() => setIsFixedExpenseOpen((current) => !current)}
              aria-expanded={isFixedExpenseOpen}
            >
              <span><Receipt size={18} /><strong>固定支出</strong></span>
              <small>{fixedExpenses.length > 0 ? `${fixedExpenses.length} 項，每月 1 號自動加入` : '未有固定支出'}</small>
              <ChevronDown size={20} className={isFixedExpenseOpen ? 'is-open' : ''} />
            </button>
            {isFixedExpenseOpen && (
              <div className="fixed-expense-body">
                <form className="fixed-expense-form" onSubmit={handleAddFixedExpense}>
                  <input value={fixedTitle} onChange={(event) => setFixedTitle(event.target.value)} placeholder="例如：租金、上網費" />
                  <div className="amount-currency-row">
                    <input readOnly inputMode="none" value={fixedAmount} onFocus={() => openCalculator('fixed', fixedAmount)} onClick={() => openCalculator('fixed', fixedAmount)} placeholder="HK$ 金額" />
                    <select value={fixedCategoryId} onChange={(event) => setFixedCategoryId(event.target.value)}>
                      {appData.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                    </select>
                  </div>
                  {calculator?.target === 'fixed' && <CalculatorPadV2 expression={calculator.expression} onPress={handleCalculatorPress} />}
                  <button className="primary-action" type="submit"><Plus size={16} />新增固定支出</button>
                </form>
                <div className="fixed-expense-list">
                  {fixedExpenses.length === 0 ? <p className="empty-text">未有固定支出。</p> : fixedExpenses.map((template) => (
                    <article key={template.id} className="fixed-expense-item">
                      <span>{template.title}<small>{categoryName(template.categoryId)}</small></span>
                      <b>{formatMoney(template.amount)}</b>
                      <button type="button" onClick={() => void applyFixedExpense(template)}>加入本月</button>
                      <button type="button" className="ghost-icon" onClick={() => deleteFixedExpense(template.id)}><Trash2 size={16} /></button>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </section>
          <section className="panel">
            <div className="panel-title record-panel-title">
              <span><List size={18} /><h2>雙方支出明細</h2></span>
              <button
                type="button"
                className={`panel-menu-button ${isRecordManaging ? 'selected' : ''}`}
                onClick={() => setIsRecordManaging((current) => !current)}
                aria-label="管理支出記錄"
              >
                <Settings size={18} />
              </button>
            </div>
            <div className="record-filter account-filter" aria-label="帳簿類型">
              <button type="button" className={recordAccountFilter === 'all' ? 'selected' : ''} onClick={() => setRecordAccountFilter('all')}>全部帳戶</button>
              <button type="button" className={recordAccountFilter === 'personal' ? 'selected' : ''} onClick={() => setRecordAccountFilter('personal')}>個人帳戶</button>
              <button type="button" className={recordAccountFilter === 'shared' ? 'selected' : ''} onClick={() => setRecordAccountFilter('shared')}>共同帳簿</button>
            </div>
            <div className="record-filter person-filter" aria-label="付款人">
              <button type="button" className={recordFilter === 'all' ? 'selected' : ''} onClick={() => setRecordFilter('all')}>全部</button>
              {appData.household.members.map((member) => <button key={member.id} type="button" className={recordFilter === member.id ? 'selected' : ''} onClick={() => setRecordFilter(member.id)}>{member.name}</button>)}
            </div>
            <div className="record-total">
              <span>目前篩選總支出</span>
              <strong>{formatMoney(recordTotal)}</strong>
            </div>
            {recordExpenses.length === 0 ? <p className="empty-text">這個月份還未有支出。</p> : recordExpenses.map((expense) => (
              <article key={expense.id} className="record-item">
                <div className="record-dot" style={{ background: categoryMeta(expense.categoryId)?.color ?? '#94a3b8' }} />
                <div className="record-main">
                  <strong>{expense.title}</strong>
                  <span>{expense.date} · {categoryName(expense.categoryId)} · {appData.household.members.find((member) => member.id === expense.payerId)?.name} · {expense.isShared === false ? '個人' : '共同帳簿'}</span>
                  <small>{formatMoney(expense.originalAmount, expense.originalCurrency)}{expense.originalCurrency !== 'HKD' ? ` · 匯率 ${expense.exchangeRateToHkd.toFixed(4)}` : ''}</small>
                  {(expense.photoDataUrl || expense.photoCaption || expense.notifyOther) && (
                    <div className="record-photo-story">
                      {expense.photoDataUrl && <img src={expense.photoDataUrl} alt={`${expense.title} 支出照片`} />}
                      <div>
                        {expense.photoCaption && <p>{expense.photoCaption}</p>}
                        {expense.notifyOther && <small><Mail size={13} />已標記通知對方</small>}
                      </div>
                    </div>
                  )}
                </div>
                <div className="record-side">
                  <b>{formatMoney(expense.hkdAmount)}</b>
                  {isRecordManaging && (
                    <div className="record-actions">
                      <button type="button" className="ghost-icon" onClick={() => startEditExpense(expense)} title="修改支出"><Pencil size={17} /></button>
                      <button type="button" className="ghost-icon" onClick={() => void handleDeleteExpense(expense.id)} title="刪除支出"><Trash2 size={17} /></button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </section>
        </section>
      )}

      {activeTab === 'categories' && (
        <section className="screen-stack">
          <section className="panel">
            <div className="panel-title category-panel-title">
              <span><Coins size={18} /><h2>分類</h2></span>
              <button type="button" className="panel-menu-button" onClick={() => setIsCategoryMenuOpen((current) => !current)} aria-label="分類選單">
                <MoreVertical size={18} />
              </button>
              {isCategoryMenuOpen && (
                <div className="panel-menu">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRemovingCategories((current) => !current)
                      setIsCategoryMenuOpen(false)
                    }}
                  >
                    {isRemovingCategories ? '完成移除' : '移除分類'}
                  </button>
                </div>
              )}
            </div>
            {isRemovingCategories && <p className="category-hint">點選要移除的分類，或長按分類 3 秒移除。</p>}
            <div className="category-grid">
              {appData.categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={`category-tile ${isRemovingCategories ? 'is-removing' : ''}`}
                  onClick={() => {
                    if (isRemovingCategories) void requestDeleteCategory(category)
                    else setEditingCategoryIconId(category.id)
                  }}
                  onMouseDown={() => beginCategoryLongPress(category)}
                  onMouseUp={cancelCategoryLongPress}
                  onMouseLeave={cancelCategoryLongPress}
                  onTouchStart={() => beginCategoryLongPress(category)}
                  onTouchEnd={cancelCategoryLongPress}
                  onTouchCancel={cancelCategoryLongPress}
                >
                  <span className="category-icon" style={{ background: category.color }}><CategoryIcon category={category} /></span>
                  <strong>{category.name}</strong>
                </button>
              ))}
              <button type="button" className="category-tile add-tile" onClick={() => setIsCategoryFormOpen(true)}><span className="category-icon"><Plus size={18} /></span><strong>新增</strong></button>
            </div>
          </section>
          {editingCategoryIconId && (
            <section className="panel compact-form">
              <div className="panel-title"><Pencil size={18} /><h2>更改分類圖示</h2></div>
              <p className="picker-label">{categoryName(editingCategoryIconId)}</p>
              <div className="icon-picker">
                {allIconOptions.map((option) => {
                  const category = appData.categories.find((item) => item.id === editingCategoryIconId)
                  if (!category) return null
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={category.icon === option.id ? 'selected' : ''}
                      onClick={() => void handleUpdateCategoryIcon(category, option.id)}
                      aria-label={option.label}
                      title={option.label}
                    >
                      <CategoryIcon category={{ id: option.id, name: option.label, color: '', icon: option.id }} />
                    </button>
                  )
                })}
              </div>
              <button className="secondary-action" type="button" onClick={() => setEditingCategoryIconId(null)}>取消</button>
            </section>
          )}
          {isCategoryFormOpen && (
            <form className="panel compact-form" onSubmit={handleAddCategory}>
              <div className="panel-title"><Plus size={18} /><h2>新增分類</h2></div>
              <label>分類名稱<input id="new-category-name" value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="例如：手信、行程、保險" autoFocus /></label>
              <div className="name-picker" aria-label="分類名稱快捷選項">
                {categoryNameOptions.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className={newCategory === name ? 'selected' : ''}
                    onClick={() => setNewCategory(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <p className="picker-label">選擇圖示</p>
              <div className="icon-picker">
                {allIconOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={newCategoryIcon === option.id ? 'selected' : ''}
                    onClick={() => setNewCategoryIcon(option.id)}
                    aria-label={option.label}
                    title={option.label}
                  >
                    <CategoryIcon category={{ id: option.id, name: option.label, color: '', icon: option.id }} />
                  </button>
                ))}
              </div>
              <div className="confirm-actions">
                <button type="button" onClick={() => setIsCategoryFormOpen(false)}>取消</button>
                <button type="submit"><Plus size={18} />新增分類</button>
              </div>
              {statusMessage && <p className="status-message">{statusMessage}</p>}
            </form>
          )}
        </section>
      )}

      {activeTab === 'settings' && (
        <section className="screen-stack">
          <section className="panel">
            <div className="panel-title"><UserRound size={18} /><h2>你的身份</h2></div>
            <div className="profile-options compact">{appData.household.members.map((member) => <button key={member.id} type="button" className={member.id === currentProfile.id ? 'selected' : ''} onClick={() => selectProfile(member.id)}><UserRound size={19} /><span>我是 {member.name}</span></button>)}</div>
            <button type="button" className="copy-code" onClick={() => navigator.clipboard?.writeText(appData.household.inviteCode)}><Copy size={16} />邀請碼 {appData.household.inviteCode}</button>
          </section>
          <form className="panel compact-form" onSubmit={handleSaveSettlementRatio}>
            <div className="panel-title"><CircleDollarSign size={18} /><h2>月結比例</h2></div>
            <div className="ratio-setting-summary">
              <span>{personA.name}</span>
              <strong>{Number(ratioPersonA) || 0}%</strong>
              <span>{personB.name}</span>
              <strong>{roundMoney(100 - (Number(ratioPersonA) || 0))}%</strong>
            </div>
            <label>
              {personA.name} 每月負擔比例
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={ratioPersonA}
                onChange={(event) => setRatioPersonA(event.target.value)}
              />
            </label>
            <div className="amount-currency-row">
              <label>
                {personA.name}
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={ratioPersonA}
                  onChange={(event) => setRatioPersonA(event.target.value)}
                />
              </label>
              <label>
                {personB.name}
                <input readOnly value={roundMoney(100 - (Number(ratioPersonA) || 0))} />
              </label>
            </div>
            <button className="primary-action" type="submit"><Check size={18} />儲存月結比例</button>
            <p className="empty-text">月結會按此比例計算雙方應負擔，再扣除各自已支付金額。</p>
          </form>
          <section className="panel">
            <div className="panel-title"><Settings size={18} /><h2>顏色主題</h2></div>
            <div className="theme-options">
              <button type="button" className={theme === 'neon' ? 'selected' : ''} onClick={() => setTheme('neon')}><span className="theme-swatch neon-swatch" /><strong>Neon Dark</strong><small>深色金融風格</small></button>
              <button type="button" className={theme === 'dream' ? 'selected' : ''} onClick={() => setTheme('dream')}><span className="theme-swatch dream-swatch" /><strong>Dream Glow</strong><small>夢幻柔光色彩</small></button>
              <button type="button" className={theme === 'white' ? 'selected' : ''} onClick={() => setTheme('white')}><span className="theme-swatch white-swatch" /><strong>Clean White</strong><small>純白清晰風格</small></button>
              <button type="button" className={theme === 'wise' ? 'selected' : ''} onClick={() => setTheme('wise')}><span className="theme-swatch wise-swatch" /><strong>Wise Green</strong><small>青檸綠大圓角風格</small></button>
            </div>
          </section>
          {cloudMode && <section className="panel"><div className="panel-title"><Cloud size={18} /><h2>雲端帳戶</h2></div><p className="empty-text">{user?.email}</p><button className="secondary-action" type="button" onClick={() => void signOut()}><LogOut size={18} />登出</button></section>}
        </section>
      )}

      {isStoryCameraOpen && (
        <div className="story-camera-backdrop" role="dialog" aria-modal="true" aria-label="拍照加入支出" onClick={closeStoryCamera}>
          <form className="story-camera-sheet" onSubmit={handleStorySubmit} onClick={(event) => event.stopPropagation()}>
            {storyPhotoDataUrl ? (
              <article className="story-photo-frame has-photo">
                <img src={storyPhotoDataUrl} alt="準備發送的支出照片" />
                <div className="story-top-bar">
                  <button type="button" onClick={closeStoryCamera} aria-label="關閉拍照模式"><X size={20} /></button>
                  <span>拍照支出</span>
                  <button type="button" onClick={openStoryCamera} aria-label="重新拍照"><Camera size={19} /></button>
                </div>
              </article>
            ) : (
              <button type="button" className="story-camera-empty" onClick={openStoryCamera}>
                <Camera size={30} />
                <strong>從左邊滑入進入相機</strong>
                <span>拍完後會直接套用到這個限時動態支出畫面。</span>
              </button>
            )}
            <div className="story-bottom-composer">
              <div className="story-meta-row">
                <input value={storyTitle} onChange={(event) => setStoryTitle(event.target.value)} placeholder={categoryName(storyCategoryId)} aria-label="項目名稱" />
                <button type="button" className={`story-chip ${storyIsShared ? 'selected' : ''}`} onClick={() => setStoryIsShared((current) => !current)}>
                  <Copy size={14} />
                  {storyIsShared ? '共同' : '個人'}
                </button>
                <button type="button" className={`story-chip ${storyNotifyOther ? 'selected' : ''}`} onClick={() => setStoryNotifyOther((current) => !current)}>
                  <Mail size={14} />
                  通知
                </button>
              </div>
              <div className="quick-input-row story-amount-row">
                <span>HK$</span>
                <input readOnly inputMode="none" value={storyAmount} onFocus={() => openCalculator('story', storyAmount)} onClick={() => openCalculator('story', storyAmount)} placeholder="金額" />
              </div>
              {calculator?.target === 'story' && <CalculatorPadV2 expression={calculator.expression} onPress={handleCalculatorPress} />}
              <div className="story-category-row" aria-label="拍照支出分類">
                {appData.categories.map((category) => (
                  <button key={category.id} type="button" className={storyCategoryId === category.id ? 'selected' : ''} onClick={() => setStoryCategoryId(category.id)}>
                    <span className="category-icon" style={{ background: category.color }}><CategoryIcon category={category} /></span>
                    <span>{category.name}</span>
                  </button>
                ))}
              </div>
              <div className="story-message-row">
                <input value={storyCaption} onChange={(event) => setStoryCaption(event.target.value)} placeholder="傳送訊息" />
                <button className="story-send-button" type="submit" disabled={isStorySaving} aria-label="發送給對方">
                  <Send size={19} />
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      <nav className="bottom-nav" aria-label="底部導覽">
        <button type="button" className={activeTab === 'overview' ? 'is-active' : ''} onClick={() => switchTab('overview')}><Home size={19} />總覽</button>
        <button type="button" className={activeTab === 'add' ? 'is-active' : ''} onClick={() => switchTab('add')}><Plus size={19} />新增</button>
        <button type="button" className={activeTab === 'records' ? 'is-active' : ''} onClick={() => switchTab('records')}><List size={19} />明細</button>
        <button type="button" className={activeTab === 'categories' ? 'is-active' : ''} onClick={() => switchTab('categories')}><Coins size={19} />分類</button>
        <button type="button" className={activeTab === 'settings' ? 'is-active' : ''} onClick={() => switchTab('settings')}><Settings size={19} />設定</button>
      </nav>
    </main>
  )
}

async function compressExpensePhoto(file: File) {
  if (!file.type.startsWith('image/')) {
    throw new Error('請選擇相片檔案。')
  }

  const imageUrl = URL.createObjectURL(file)
  const image = new Image()
  image.src = imageUrl

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('相片讀取失敗。'))
  })

  const maxSide = 1200
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))
  const context = canvas.getContext('2d')

  if (!context) {
    URL.revokeObjectURL(imageUrl)
    throw new Error('相片處理失敗。')
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  URL.revokeObjectURL(imageUrl)
  return canvas.toDataURL('image/jpeg', 0.76)
}

function CategoryIcon({ category }: { category: Pick<Category, 'id' | 'icon' | 'name' | 'color'> }) {
  const icon = category.icon ?? category.id
  if (icon === 'food') return <Utensils size={18} />
  if (icon === 'coffee') return <Coins size={18} />
  if (icon === 'grocery') return <ShoppingBag size={18} />
  if (icon === 'shopping') return <ShoppingBag size={18} />
  if (icon === 'clothes') return <Shirt size={18} />
  if (icon === 'gift') return <Gift size={18} />
  if (icon === 'home' || icon === 'rent') return <HomeIcon size={18} />
  if (icon === 'pet') return <PawPrint size={18} />
  if (icon === 'transport') return <CircleDollarSign size={18} />
  if (icon === 'train') return <Train size={18} />
  if (icon === 'car') return <Car size={18} />
  if (icon === 'fuel') return <Fuel size={18} />
  if (icon === 'travel') return <Plane size={18} />
  if (icon === 'fun') return <WalletCards size={18} />
  if (icon === 'beauty') return <Sparkles size={18} />
  if (icon === 'medical') return <HeartPulse size={18} />
  if (icon === 'fitness') return <Dumbbell size={18} />
  if (icon === 'education') return <GraduationCap size={18} />
  if (icon === 'tech') return <Laptop size={18} />
  if (icon === 'phone') return <Smartphone size={18} />
  if (icon === 'bank') return <Landmark size={18} />
  if (icon === 'saving') return <Coins size={18} />
  if (icon === 'water') return <Droplets size={18} />
  if (icon === 'electricity') return <Zap size={18} />
  if (icon === 'gas') return <Flame size={18} />
  if (icon === 'credit-card') return <CreditCard size={18} />
  if (icon === 'internet') return <Wifi size={18} />
  if (icon === 'insurance') return <Receipt size={18} />
  if (icon === 'tax' || icon === 'bill') return <Receipt size={18} />
  if (icon === 'reward') return <Trophy size={18} />
  if (icon === 'movie') return <Clapperboard size={18} />
  return <Coins size={18} />
}

function CalculatorPad({ expression, onPress }: { expression: string; onPress: (key: string) => void }) {
  const keys = ['7', '8', '9', '+', '4', '5', '6', '-', '1', '2', '3', '*', '0', '.', '⌫', '/', 'C', '=', 'OK']

  return (
    <div className="calculator-pad" aria-label="金額計算機">
      <div className="calculator-display">{expression || '0'}</div>
      <div className="calculator-grid">
        {keys.map((key) => (
          <button key={key} type="button" className={key === 'OK' ? 'is-done' : isCalculatorOperator(key) ? 'is-operator' : ''} onClick={() => onPress(key)}>
            {key === '*' ? '×' : key === '/' ? '÷' : key}
          </button>
        ))}
      </div>
    </div>
  )
}

function isCalculatorOperator(key: string) {
  return ['+', '-', '*', '/', '=', 'C', '⌫'].includes(key)
}

void CalculatorPad

function CalculatorPadV2({
  expression,
  onPress,
}: {
  expression: string
  onPress: (key: string) => void | Promise<void>
}) {
  const keys = ['1', '2', '3', '/', '4', '5', '6', '*', '7', '8', '9', '-', '.', '0', 'backspace', '+', 'OK']

  return (
    <div className="calculator-pad" aria-label="金額計算機">
      <div className="calculator-display">{expression || '0'}</div>
      <div className="calculator-grid">
        {keys.map((key) => (
          <button
            key={key}
            type="button"
            className={key === 'OK' ? 'is-done' : isCalculatorOperatorV2(key) ? 'is-operator' : ''}
            onClick={() => void onPress(key)}
          >
            {key === '*' ? '×' : key === '/' ? '÷' : key === 'backspace' ? '⌫' : key === 'OK' ? '下一步' : key}
          </button>
        ))}
      </div>
    </div>
  )
}

function isCalculatorOperatorV2(key: string) {
  return ['+', '-', '*', '/', '=', 'C', 'backspace'].includes(key)
}

function isPlainNumber(value: string) {
  return /^\d*\.?\d*$/.test(value)
}

function formatCalculatorValue(value: number) {
  return String(Math.round(value * 100) / 100)
}

function calculateExpression(expression: string): number | null {
  const clean = expression.replace(/\s/g, '')
  if (!/^\d*\.?\d+(?:[+\-*/]\d*\.?\d+)*$/.test(clean)) return null

  const numbers: number[] = clean.split(/[+\-*/]/).map(Number)
  const operators: string[] = clean.match(/[+\-*/]/g) ?? []

  for (let index = 0; index < operators.length; index += 1) {
    const operator = operators[index]
    if (operator !== '*' && operator !== '/') continue

    const result = operator === '*'
      ? numbers[index] * numbers[index + 1]
      : numbers[index + 1] === 0
        ? NaN
        : numbers[index] / numbers[index + 1]

    numbers.splice(index, 2, result)
    operators.splice(index, 1)
    index -= 1
  }

  let result = numbers[0] ?? 0
  operators.forEach((operator, index) => {
    result = operator === '+' ? result + numbers[index + 1] : result - numbers[index + 1]
  })

  return Number.isFinite(result) ? result : null
}

function loadFixedExpenses(): FixedExpenseTemplate[] {
  try {
    const saved = localStorage.getItem(fixedExpensesStorageKey)
    return saved ? (JSON.parse(saved) as FixedExpenseTemplate[]) : []
  } catch {
    return []
  }
}

function loadQuickCategoryIds(): string[] {
  try {
    const saved = localStorage.getItem(quickCategoriesStorageKey)
    return saved ? (JSON.parse(saved) as string[]) : []
  } catch {
    return []
  }
}

function loadFixedExpenseApplied(): string[] {
  try {
    const saved = localStorage.getItem(fixedExpenseAppliedStorageKey)
    return saved ? (JSON.parse(saved) as string[]) : []
  } catch {
    return []
  }
}

function saveFixedExpenseApplied(keys: string[]) {
  localStorage.setItem(fixedExpenseAppliedStorageKey, JSON.stringify(Array.from(new Set(keys))))
}

function fixedExpenseApplyKey(householdId: string, templateId: string, targetMonth: string) {
  return `${householdId}:${templateId}:${targetMonth}`
}

function firstDayOfMonth(targetMonth: string) {
  return `${targetMonth}-01`
}

function buildQuickCategories(categories: Category[], expenses: Expense[], selectedIds: string[]) {
  const selected = selectedIds
    .map((id) => categories.find((category) => category.id === id))
    .filter((category): category is Category => Boolean(category))

  const recentIds = [...expenses]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((expense) => expense.categoryId)

  const mergedIds = [...selected.map((category) => category.id), ...recentIds, ...categories.map((category) => category.id)]
  const uniqueIds = Array.from(new Set(mergedIds)).slice(0, 7)

  return uniqueIds
    .map((id) => categories.find((category) => category.id === id))
    .filter((category): category is Category => Boolean(category))
}

export default App
