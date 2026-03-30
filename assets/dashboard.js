import { renderMenu } from './menu.js'
import { generateFixedExpensesIfNeeded } from './fixed-expenses-sync.js'

let supabase = null
let currentUser = null
let currentBusiness = null

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })
}

function formatDateBR(date) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(date)
}

function getTodayISO() {
  return new Date().toISOString().split('T')[0]
}

function setText(id, value) {
  const el = document.getElementById(id)
  if (el) el.textContent = value
}

function showTopMessage(message, type = 'success') {
  const box = document.getElementById('top-message')
  if (!box) return

  box.textContent = message
  box.className = 'mb-6 rounded-2xl px-4 py-4 text-sm border'

  if (type === 'success') {
    box.classList.add('bg-green-50', 'text-green-700', 'border-green-200')
  } else {
    box.classList.add('bg-red-50', 'text-red-700', 'border-red-200')
  }

  box.classList.remove('hidden')

  clearTimeout(box._hideTimer)
  box._hideTimer = setTimeout(() => {
    box.classList.add('hidden')
  }, 3500)
}

async function waitForSupabase() {
  for (let i = 0; i < 50; i++) {
    if (window.supabase) {
      supabase = window.supabase
      return true
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  return false
}

async function requireUser() {
  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user) {
    window.location.href = 'index.html'
    return null
  }

  return data.user
}

async function getBusiness(userId) {
  const { data } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_user_id', userId)
    .maybeSingle()

  return data
}

async function loadDashboard() {
  const today = getTodayISO()

  const [
    { data: expenses },
    { data: cashEntries }
  ] = await Promise.all([
    supabase
      .from('expenses')
      .select('*')
      .eq('business_id', currentBusiness.id)
      .eq('data_referencia', today),

    supabase
      .from('cash_entries')
      .select('*')
      .eq('business_id', currentBusiness.id)
      .eq('data_referencia', today)
  ])

  const safeExpenses = expenses || []
  const safeCash = cashEntries || []

  const totalExpenses = safeExpenses.reduce((s, i) => s + Number(i.valor || 0), 0)
  const totalCash = safeCash.reduce((s, i) => s + Number(i.valor || 0), 0)
  const profit = totalCash - totalExpenses
  const margin = totalCash > 0 ? ((profit / totalCash) * 100).toFixed(0) : 0

  setText('total-cash', formatCurrency(totalCash))
  setText('total-expenses', formatCurrency(totalExpenses))
  setText('total-profit', formatCurrency(profit))
  setText('profit-margin', `${margin}%`)
  setText('expenses-count', String(safeExpenses.length))

  setText('quick-total-cash', formatCurrency(totalCash))
  setText('quick-total-expenses', formatCurrency(totalExpenses))
  setText('quick-total-profit', formatCurrency(profit))
  setText('quick-profit-margin', `${margin}%`)
}

document.addEventListener('DOMContentLoaded', async () => {
  const loaded = await waitForSupabase()

  if (!loaded) {
    alert('Erro ao carregar Supabase.')
    return
  }

  currentUser = await requireUser()
  if (!currentUser) return

  currentBusiness = await getBusiness(currentUser.id)
  if (!currentBusiness) {
    showTopMessage('Empresa não encontrada.', 'error')
    return
  }

  await renderMenu('Dashboard')

  // 🔥 AQUI ESTÁ O MAIS IMPORTANTE
  await generateFixedExpensesIfNeeded()

  await loadDashboard()

  setText('today-date', formatDateBR(new Date()))
})
