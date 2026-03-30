import { supabase } from './supabase.js'
import { renderMenu } from './menu.js'

let currentUser = null
let currentBusiness = null
let fixedExpenses = []
let expenseCategories = []

const loading = document.getElementById('loading')
const tableWrapper = document.getElementById('table-wrapper')
const tbody = document.getElementById('fixed-expenses-tbody')
const emptyState = document.getElementById('empty-state')

const createModal = document.getElementById('create-modal')
const editModal = document.getElementById('edit-modal')

const createForm = document.getElementById('create-form')
const editForm = document.getElementById('edit-form')

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })
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
  if (!modal) return
  modal.classList.remove('hidden')
  modal.classList.add('flex')
  document.body.classList.add('overflow-hidden')
}

function closeModal(modal) {
  if (!modal) return
  modal.classList.add('hidden')
  modal.classList.remove('flex')
  document.body.classList.remove('overflow-hidden')
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
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_user_id', userId)
    .maybeSingle()

  if (error) return null
  return data
}

async function loadExpenseCategories() {
  if (!currentBusiness) return

  const { data, error } = await supabase
    .from('expense_categories')
    .select('*')
    .eq('business_id', currentBusiness.id)
    .order('nome', { ascending: true })

  if (error) {
    expenseCategories = []
    populateCategorySelects()
    return
  }

  expenseCategories = data || []
  populateCategorySelects()
}

function populateCategorySelects() {
  const createSelect = document.getElementById('create-category')
  const editSelect = document.getElementById('edit-category')

  const options = expenseCategories.length
    ? `
        <option value="">Selecione</option>
        ${expenseCategories.map(category => `
          <option value="${category.nome}">${category.nome}</option>
        `).join('')}
      `
    : `<option value="">Nenhuma categoria cadastrada</option>`

  if (createSelect) createSelect.innerHTML = options
  if (editSelect) editSelect.innerHTML = options
}

function updateSummary(items) {
  const total = items.length
  const active = items.filter(item => item.ativo).length
  const inactive = items.filter(item => !item.ativo).length
  const monthlyTotal = items
    .filter(item => item.ativo)
    .reduce((sum, item) => sum + Number(item.valor || 0), 0)

  setText('total-fixed-count', String(total))
  setText('active-fixed-count', String(active))
  setText('inactive-fixed-count', String(inactive))
  setText('monthly-total-value', formatCurrency(monthlyTotal))
}

function renderTable(items) {
  tbody.innerHTML = ''

  if (!items.length) {
    tableWrapper.classList.add('hidden')
    emptyState.classList.remove('hidden')
    return
  }

  emptyState.classList.add('hidden')
  tableWrapper.classList.remove('hidden')

  items.forEach(item => {
    const tr = document.createElement('tr')
    tr.className = 'border-t border-gray-100'

    tr.innerHTML = `
      <td class="px-5 py-4 font-medium text-gray-900">${item.descricao || '-'}</td>
      <td class="px-5 py-4 text-gray-600">${item.categoria || '-'}</td>
      <td class="px-5 py-4 font-semibold">${formatCurrency(item.valor)}</td>
      <td class="px-5 py-4">${item.dia_vencimento}</td>
      <td class="px-5 py-4">
        <span class="inline-flex px-3 py-1 rounded-full text-xs font-semibold ${item.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}">
          ${item.ativo ? 'Ativo' : 'Inativo'}
        </span>
      </td>
      <td class="px-5 py-4">
        <div class="flex flex-wrap gap-2">
          <button data-id="${item.id}" class="toggle-btn bg-amber-50 hover:bg-amber-100 text-amber-700 px-4 py-2 rounded-xl font-medium transition">
            ${item.ativo ? 'Desativar' : 'Ativar'}
          </button>
          <button data-id="${item.id}" class="edit-btn bg-blue-50 hover:bg-blue-100 text-blue-600 px-4 py-2 rounded-xl font-medium transition">
            Editar
          </button>
          <button data-id="${item.id}" class="delete-btn bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-xl font-medium transition">
            Excluir
          </button>
        </div>
      </td>
    `

    tbody.appendChild(tr)
  })

  bindRowActions()
}

function applyLocalFilters() {
  const search = document.getElementById('filter-search').value.trim().toLowerCase()
  const category = document.getElementById('filter-category').value.trim().toLowerCase()
  const status = document.getElementById('filter-status').value

  const filtered = fixedExpenses.filter(item => {
    const matchesSearch =
      !search || (item.descricao || '').toLowerCase().includes(search)

    const matchesCategory =
      !category || (item.categoria || '').toLowerCase().includes(category)

    const matchesStatus =
      !status ||
      (status === 'ativo' && item.ativo) ||
      (status === 'inativo' && !item.ativo)

    return matchesSearch && matchesCategory && matchesStatus
  })

  updateSummary(filtered)
  renderTable(filtered)
}

async function loadFixedExpenses() {
  loading.classList.remove('hidden')
  tableWrapper.classList.add('hidden')
  emptyState.classList.add('hidden')

  const { data, error } = await supabase
    .from('fixed_expenses')
    .select('*')
    .eq('business_id', currentBusiness.id)
    .order('created_at', { ascending: false })

  loading.classList.add('hidden')

  if (error) {
    emptyState.textContent = 'Erro ao carregar gastos fixos.'
    emptyState.classList.remove('hidden')
    return
  }

  fixedExpenses = data || []
  updateSummary(fixedExpenses)
  renderTable(fixedExpenses)
}

function openEditModal(item) {
  document.getElementById('edit-id').value = item.id
  document.getElementById('edit-description').value = item.descricao || ''
  document.getElementById('edit-amount').value = item.valor || ''
  document.getElementById('edit-day').value = item.dia_vencimento || ''
  document.getElementById('edit-active').checked = !!item.ativo
  document.getElementById('edit-category').value = item.categoria || ''

  openModal(editModal)
}

async function deleteFixedExpenseAndGeneratedEntries(item) {
  const { error: deleteGeneratedError } = await supabase
    .from('expenses')
    .delete()
    .eq('business_id', currentBusiness.id)
    .eq('fixed_expense_id', item.id)

  if (deleteGeneratedError) {
    showTopMessage('Erro ao excluir os gastos automáticos vinculados.', 'error')
    return false
  }

  const { error: deleteFixedError } = await supabase
    .from('fixed_expenses')
    .delete()
    .eq('id', item.id)
    .eq('business_id', currentBusiness.id)

  if (deleteFixedError) {
    showTopMessage('Erro ao excluir gasto fixo.', 'error')
    return false
  }

  return true
}

function bindRowActions() {
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = fixedExpenses.find(entry => String(entry.id) === String(btn.dataset.id))
      if (item) openEditModal(item)
    })
  })

  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const item = fixedExpenses.find(entry => String(entry.id) === String(btn.dataset.id))
      if (!item) return

      const { error } = await supabase
        .from('fixed_expenses')
        .update({ ativo: !item.ativo })
        .eq('id', item.id)
        .eq('business_id', currentBusiness.id)

      if (error) {
        showTopMessage('Erro ao alterar status.', 'error')
        return
      }

      await loadFixedExpenses()
      applyLocalFilters()
      showTopMessage(`Gasto fixo ${item.ativo ? 'desativado' : 'ativado'} com sucesso.`)
    })
  })

  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const item = fixedExpenses.find(entry => String(entry.id) === String(btn.dataset.id))
      if (!item) return

      const confirmed = confirm(
        'Ao excluir este gasto fixo, todos os gastos automáticos já lançados por ele também serão apagados. Deseja continuar?'
      )
      if (!confirmed) return

      const deleted = await deleteFixedExpenseAndGeneratedEntries(item)
      if (!deleted) return

      await loadFixedExpenses()
      applyLocalFilters()
      showTopMessage('Gasto fixo e lançamentos automáticos excluídos com sucesso.')
    })
  })
}

createForm.addEventListener('submit', async (e) => {
  e.preventDefault()

  const saveBtn = document.getElementById('save-create-btn')
  const descricao = document.getElementById('create-description').value.trim()
  const categoria = document.getElementById('create-category').value
  const valor = Number(document.getElementById('create-amount').value || 0)
  const dia_vencimento = Number(document.getElementById('create-day').value || 0)
  const ativo = document.getElementById('create-active').checked

  if (!descricao || !categoria || !valor || !dia_vencimento) {
    showTopMessage('Preencha descrição, categoria, valor e dia do vencimento.', 'error')
    return
  }

  if (dia_vencimento < 1 || dia_vencimento > 31) {
    showTopMessage('O dia do vencimento deve estar entre 1 e 31.', 'error')
    return
  }

  saveBtn.disabled = true
  saveBtn.textContent = 'Salvando...'

  const { error } = await supabase
    .from('fixed_expenses')
    .insert({
      business_id: currentBusiness.id,
      descricao,
      categoria,
      valor,
      dia_vencimento,
      ativo
    })

  saveBtn.disabled = false
  saveBtn.textContent = 'Salvar gasto fixo'

  if (error) {
    showTopMessage('Erro ao salvar gasto fixo: ' + error.message, 'error')
    return
  }

  createForm.reset()
  document.getElementById('create-active').checked = true
  populateCategorySelects()
  closeModal(createModal)
  await loadFixedExpenses()
  applyLocalFilters()
  showTopMessage('Gasto fixo criado com sucesso.')
})

editForm.addEventListener('submit', async (e) => {
  e.preventDefault()

  const saveBtn = document.getElementById('save-edit-btn')
  const id = document.getElementById('edit-id').value
  const descricao = document.getElementById('edit-description').value.trim()
  const categoria = document.getElementById('edit-category').value
  const valor = Number(document.getElementById('edit-amount').value || 0)
  const dia_vencimento = Number(document.getElementById('edit-day').value || 0)
  const ativo = document.getElementById('edit-active').checked

  if (!descricao || !categoria || !valor || !dia_vencimento) {
    showTopMessage('Preencha descrição, categoria, valor e dia do vencimento.', 'error')
    return
  }

  if (dia_vencimento < 1 || dia_vencimento > 31) {
    showTopMessage('O dia do vencimento deve estar entre 1 e 31.', 'error')
    return
  }

  saveBtn.disabled = true
  saveBtn.textContent = 'Salvando...'

  const { error } = await supabase
    .from('fixed_expenses')
    .update({
      descricao,
      categoria,
      valor,
      dia_vencimento,
      ativo
    })
    .eq('id', id)
    .eq('business_id', currentBusiness.id)

  saveBtn.disabled = false
  saveBtn.textContent = 'Salvar alterações'

  if (error) {
    showTopMessage('Erro ao atualizar gasto fixo: ' + error.message, 'error')
    return
  }

  closeModal(editModal)
  await loadFixedExpenses()
  applyLocalFilters()
  showTopMessage('Gasto fixo atualizado com sucesso.')
})

document.getElementById('open-create-modal').addEventListener('click', () => openModal(createModal))
document.getElementById('close-create-modal').addEventListener('click', () => closeModal(createModal))
document.getElementById('cancel-create').addEventListener('click', () => closeModal(createModal))

document.getElementById('close-edit-modal').addEventListener('click', () => closeModal(editModal))
document.getElementById('cancel-edit').addEventListener('click', () => closeModal(editModal))

createModal.addEventListener('click', (e) => {
  if (e.target === createModal) closeModal(createModal)
})

editModal.addEventListener('click', (e) => {
  if (e.target === editModal) closeModal(editModal)
})

document.getElementById('apply-filters').addEventListener('click', applyLocalFilters)
document.getElementById('clear-filters').addEventListener('click', () => {
  document.getElementById('filter-search').value = ''
  document.getElementById('filter-category').value = ''
  document.getElementById('filter-status').value = ''
  updateSummary(fixedExpenses)
  renderTable(fixedExpenses)
})

async function initPage() {
  await renderMenu('Gastos fixos')

  currentUser = await requireUser()
  if (!currentUser) return

  currentBusiness = await getBusiness(currentUser.id)
  if (!currentBusiness) {
    showTopMessage('Empresa não encontrada.', 'error')
    return
  }

  await loadExpenseCategories()
  await loadFixedExpenses()
}

initPage()
