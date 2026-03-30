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

function openModal(modal) {
  modal.classList.remove('hidden')
  modal.classList.add('flex')
  document.body.classList.add('overflow-hidden')
}

function closeModal(modal) {
  modal.classList.add('hidden')
  modal.classList.remove('flex')
  document.body.classList.remove('overflow-hidden')
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

async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) return null
  return data
}

async function getBusiness(userId) {
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_user_id', userId)
    .maybeSingle()

  if (error) return null
  return data
}

function buildSummary(totalCash, totalExpenses, profit, margin, topCategory) {
  if (totalCash === 0 && totalExpenses === 0) {
    return 'Hoje ainda não há movimentações registradas. Comece adicionando um faturamento ou um gasto.'
  }

  if (totalCash > 0 && totalExpenses === 0) {
    return `Hoje seu negócio faturou ${formatCurrency(totalCash)} e ainda não possui gastos lançados. Seu lucro parcial está em ${formatCurrency(profit)}.`
  }

  if (totalCash === 0 && totalExpenses > 0) {
    return `Hoje você já lançou ${formatCurrency(totalExpenses)} em gastos, mas ainda não registrou faturamento.`
  }

  let text = `Hoje seu negócio faturou ${formatCurrency(totalCash)}, teve ${formatCurrency(totalExpenses)} em custos registrados e está com lucro estimado de ${formatCurrency(profit)}.`

  if (topCategory) {
    text += ` Seu maior gasto até agora foi em ${topCategory}.`
  }

  text += ` A margem atual é de ${margin}%.`

  return text
}

function buildAttention(totalCash, totalExpenses, margin, topCategory, topCategoryValue) {
  if (totalCash === 0 && totalExpenses === 0) {
    return 'Ainda não há dados suficientes para sugerir melhorias.'
  }

  if (totalCash === 0 && totalExpenses > 0) {
    return 'Você registrou custos, mas ainda não lançou entradas. Registre o faturamento para visualizar o lucro real.'
  }

  if (Number(margin) < 20) {
    return 'Sua margem está baixa hoje. Vale revisar preços, desperdícios e fornecedores.'
  }

  if (topCategory) {
    return `${topCategory} foi a categoria que mais pesou hoje, com ${formatCurrency(topCategoryValue)} em custos. Vale revisar esse grupo.`
  }

  return 'Seu dia está com boa margem até agora. Continue acompanhando os lançamentos.'
}

function renderExpenses(expenses) {
  const container = document.getElementById('expenses-list')
  if (!container) return

  if (!expenses.length) {
    container.innerHTML = `
      <div class="border border-dashed border-gray-300 rounded-2xl p-6 text-center text-gray-500">
        Nenhum gasto lançado ainda hoje.
      </div>
    `
    return
  }

  container.innerHTML = expenses.map(expense => {
    const horario = new Date(expense.created_at).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    })

    return `
      <div class="border border-gray-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h4 class="font-semibold text-lg">${expense.descricao || 'Gasto sem descrição'}</h4>
          <p class="text-gray-500 text-sm">Categoria: ${expense.categoria} • ${horario}</p>
        </div>
        <div class="text-left md:text-right">
          <p class="font-bold text-lg">${formatCurrency(expense.valor)}</p>
          <span class="inline-block mt-1 text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-full">Lançado</span>
        </div>
      </div>
    `
  }).join('')
}

function renderCategories(expenses) {
  const container = document.getElementById('categories-list')
  if (!container) return

  if (!expenses.length) {
    container.innerHTML = `<div class="text-gray-500">Sem categorias registradas ainda.</div>`
    return
  }

  const grouped = {}

  expenses.forEach(expense => {
    const category = expense.categoria || 'Sem categoria'
    grouped[category] = (grouped[category] || 0) + Number(expense.valor || 0)
  })

  const sorted = Object.entries(grouped).sort((a, b) => b[1] - a[1])
  const maxValue = sorted[0][1] || 1

  container.innerHTML = sorted.map(([category, total]) => {
    const width = Math.max(8, Math.round((total / maxValue) * 100))

    return `
      <div>
        <div class="flex justify-between mb-1 text-sm">
          <span>${category}</span>
          <span>${formatCurrency(total)}</span>
        </div>
        <div class="w-full bg-gray-100 rounded-full h-3">
          <div class="bg-green-600 h-3 rounded-full" style="width: ${width}%;"></div>
        </div>
      </div>
    `
  }).join('')
}

async function loadDashboard() {
  const profile = await getProfile(currentUser.id)
  const business = await getBusiness(currentUser.id)

  currentBusiness = business

  setText('user-name', profile?.nome || currentUser.email || 'Usuário')
  setText('business-name', business?.nome || 'Seu negócio')
  setText('today-date', formatDateBR(new Date()))

  if (!business) {
    showTopMessage('Empresa não encontrada para este usuário.', 'error')
    return
  }

  const today = getTodayISO()

  const [{ data: expenses, error: expensesError }, { data: cashEntries, error: cashError }] = await Promise.all([
    supabase
      .from('expenses')
      .select('*')
      .eq('business_id', business.id)
      .eq('data_referencia', today)
      .order('created_at', { ascending: false }),

    supabase
      .from('cash_entries')
      .select('*')
      .eq('business_id', business.id)
      .eq('data_referencia', today)
      .order('created_at', { ascending: false })
  ])

  if (expensesError) {
    showTopMessage('Erro ao buscar gastos.', 'error')
    return
  }

  if (cashError) {
    showTopMessage('Erro ao buscar faturamento.', 'error')
    return
  }

  const safeExpenses = expenses || []
  const safeCashEntries = cashEntries || []

  const totalExpenses = safeExpenses.reduce((sum, item) => sum + Number(item.valor || 0), 0)
  const totalCash = safeCashEntries.reduce((sum, item) => sum + Number(item.valor || 0), 0)
  const profit = totalCash - totalExpenses
  const margin = totalCash > 0 ? ((profit / totalCash) * 100).toFixed(0) : 0

  const grouped = {}
  safeExpenses.forEach(expense => {
    const category = expense.categoria || 'Sem categoria'
    grouped[category] = (grouped[category] || 0) + Number(expense.valor || 0)
  })

  const sortedCategories = Object.entries(grouped).sort((a, b) => b[1] - a[1])
  const topCategory = sortedCategories[0]?.[0] || null
  const topCategoryValue = sortedCategories[0]?.[1] || 0

  setText('total-cash', formatCurrency(totalCash))
  setText('total-expenses', formatCurrency(totalExpenses))
  setText('total-profit', formatCurrency(profit))
  setText('profit-margin', `${margin}%`)
  setText('expenses-count', String(safeExpenses.length))

  setText('quick-total-cash', formatCurrency(totalCash))
  setText('quick-total-expenses', formatCurrency(totalExpenses))
  setText('quick-total-profit', formatCurrency(profit))
  setText('quick-profit-margin', `${margin}%`)

  setText('daily-summary', buildSummary(totalCash, totalExpenses, profit, margin, topCategory))
  setText('attention-text', buildAttention(totalCash, totalExpenses, margin, topCategory, topCategoryValue))

  const marginAlert = document.getElementById('margin-alert')
  if (marginAlert) {
    if (totalCash === 0 && totalExpenses === 0) {
      marginAlert.textContent = 'Adicione movimentações para calcular'
    } else if (Number(margin) < 20) {
      marginAlert.textContent = 'Margem baixa hoje'
    } else {
      marginAlert.textContent = 'Situação saudável até o momento'
    }
  }

  renderExpenses(safeExpenses)
  renderCategories(safeExpenses)
}

async function handleLogout() {
  await supabase.auth.signOut()
  window.location.href = 'index.html'
}

function bindModalEvents() {
  const expenseModal = document.getElementById('expense-modal')
  const cashModal = document.getElementById('cash-modal')

  const addExpenseBtn = document.getElementById('add-expense-btn')
  const openExpenseSecondary = document.getElementById('open-expense-secondary')
  const closeExpenseModal = document.getElementById('close-expense-modal')
  const cancelExpenseBtn = document.getElementById('cancel-expense-btn')

  const addCashBtn = document.getElementById('add-cash-btn')
  const closeCashModal = document.getElementById('close-cash-modal')
  const cancelCashBtn = document.getElementById('cancel-cash-btn')

  const expenseDate = document.getElementById('expense-data')
  const cashDate = document.getElementById('cash-data')

  expenseDate.value = getTodayISO()
  cashDate.value = getTodayISO()

  addExpenseBtn?.addEventListener('click', () => openModal(expenseModal))
  openExpenseSecondary?.addEventListener('click', () => openModal(expenseModal))
  closeExpenseModal?.addEventListener('click', () => closeModal(expenseModal))
  cancelExpenseBtn?.addEventListener('click', () => closeModal(expenseModal))

  addCashBtn?.addEventListener('click', () => openModal(cashModal))
  closeCashModal?.addEventListener('click', () => closeModal(cashModal))
  cancelCashBtn?.addEventListener('click', () => closeModal(cashModal))

  expenseModal?.addEventListener('click', (e) => {
    if (e.target === expenseModal) closeModal(expenseModal)
  })

  cashModal?.addEventListener('click', (e) => {
    if (e.target === cashModal) closeModal(cashModal)
  })
}

function bindFormEvents() {
  const expenseForm = document.getElementById('expense-form')
  const cashForm = document.getElementById('cash-form')

  expenseForm?.addEventListener('submit', handleExpenseSubmit)
  cashForm?.addEventListener('submit', handleCashSubmit)
}

async function handleExpenseSubmit(e) {
  e.preventDefault()

  const descricao = document.getElementById('expense-descricao').value.trim()
  const categoria = document.getElementById('expense-categoria').value
  const valor = document.getElementById('expense-valor').value
  const dataReferencia = document.getElementById('expense-data').value
  const saveBtn = document.getElementById('save-expense-btn')
  const modal = document.getElementById('expense-modal')

  if (!descricao || !categoria || !valor || !dataReferencia) {
    showTopMessage('Preencha todos os campos do gasto.', 'error')
    return
  }

  saveBtn.disabled = true
  saveBtn.textContent = 'Salvando...'

  const { error } = await supabase.from('expenses').insert({
    business_id: currentBusiness.id,
    descricao,
    categoria,
    valor: Number(valor),
    data_referencia: dataReferencia
  })

  saveBtn.disabled = false
  saveBtn.textContent = 'Salvar gasto'

  if (error) {
    showTopMessage('Erro ao salvar gasto: ' + error.message, 'error')
    return
  }

  document.getElementById('expense-form').reset()
  document.getElementById('expense-data').value = getTodayISO()
  closeModal(modal)
  showTopMessage('Gasto salvo com sucesso.')
  await loadDashboard()
}

async function handleCashSubmit(e) {
  e.preventDefault()

  const valor = document.getElementById('cash-valor').value
  const observacao = document.getElementById('cash-observacao').value.trim()
  const dataReferencia = document.getElementById('cash-data').value
  const saveBtn = document.getElementById('save-cash-btn')
  const modal = document.getElementById('cash-modal')

  if (!valor || !dataReferencia) {
    showTopMessage('Preencha valor e data do faturamento.', 'error')
    return
  }

  saveBtn.disabled = true
  saveBtn.textContent = 'Salvando...'

  const { error } = await supabase.from('cash_entries').insert({
    business_id: currentBusiness.id,
    valor: Number(valor),
    observacao,
    data_referencia: dataReferencia
  })

  saveBtn.disabled = false
  saveBtn.textContent = 'Salvar faturamento'

  if (error) {
    showTopMessage('Erro ao salvar faturamento: ' + error.message, 'error')
    return
  }

  document.getElementById('cash-form').reset()
  document.getElementById('cash-data').value = getTodayISO()
  closeModal(modal)
  showTopMessage('Faturamento salvo com sucesso.')
  await loadDashboard()
}

function bindGeneralEvents() {
  document.getElementById('logout-btn')?.addEventListener('click', handleLogout)
}

document.addEventListener('DOMContentLoaded', async () => {
  const loaded = await waitForSupabase()

  if (!loaded) {
    alert('Erro ao carregar Supabase.')
    return
  }

  currentUser = await requireUser()
  if (!currentUser) return

  bindGeneralEvents()
  bindModalEvents()
  bindFormEvents()
  await loadDashboard()
})
