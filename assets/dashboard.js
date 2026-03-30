const supabase = window.supabase

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

  if (error) {
    console.error('Erro ao buscar profile:', error.message)
    return null
  }

  return data
}

async function getBusiness(userId) {
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('Erro ao buscar empresa:', error.message)
    return null
  }

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

  if (margin < 20) {
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
  const user = await requireUser()
  if (!user) return

  setText('today-date', formatDateBR(new Date()))

  const profile = await getProfile(user.id)
  const business = await getBusiness(user.id)

  setText('user-name', profile?.nome || user.email || 'Usuário')

  if (!business) {
    alert('Empresa não encontrada para este usuário.')
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
    console.error('Erro ao buscar gastos:', expensesError.message)
  }

  if (cashError) {
    console.error('Erro ao buscar faturamentos:', cashError.message)
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

function bindEvents() {
  const logoutBtn = document.getElementById('logout-btn')
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout)
  }

  const addExpenseBtn = document.getElementById('add-expense-btn')
  if (addExpenseBtn) {
    addExpenseBtn.addEventListener('click', () => {
      alert('Próximo passo: abrir popup de gasto.')
    })
  }

  const addCashBtn = document.getElementById('add-cash-btn')
  if (addCashBtn) {
    addCashBtn.addEventListener('click', () => {
      alert('Próximo passo: abrir popup de faturamento.')
    })
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents()
  await loadDashboard()
})
