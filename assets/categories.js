import { supabase } from './supabase.js'
import { renderMenu } from './menu.js'

let currentUser = null
let currentBusiness = null
let categories = []

const loading = document.getElementById('loading')
const tableWrapper = document.getElementById('table-wrapper')
const tbody = document.getElementById('categories-tbody')
const emptyState = document.getElementById('empty-state')

const createModal = document.getElementById('create-modal')
const editModal = document.getElementById('edit-modal')

const createForm = document.getElementById('create-form')
const editForm = document.getElementById('edit-form')

function setText(id, value) {
  const el = document.getElementById(id)
  if (el) el.textContent = value
}

function showTopMessage(message, type = 'success') {
  const box = document.getElementById('top-message')
  if (!box) return

  box.textContent = message
  box.className = 'hidden mb-6 rounded-2xl px-4 py-4 text-sm border'

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

function normalizeName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

function formatDate(dateStr) {
  if (!dateStr) return '--'
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
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

function updateSummary(items) {
  setText('total-categories-count', String(items.length))
  setText('latest-category-name', items[0]?.nome || '--')
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
      <td class="px-5 py-4 font-medium text-gray-900">${item.nome || '-'}</td>
      <td class="px-5 py-4 text-gray-600">${formatDate(item.created_at)}</td>
      <td class="px-5 py-4">
        <div class="flex flex-wrap gap-2">
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

  const filtered = categories.filter(item => {
    return !search || (item.nome || '').toLowerCase().includes(search)
  })

  updateSummary(filtered)
  renderTable(filtered)
}

async function loadCategories() {
  loading.classList.remove('hidden')
  tableWrapper.classList.add('hidden')
  emptyState.classList.add('hidden')

  const { data, error } = await supabase
    .from('expense_categories')
    .select('*')
    .eq('business_id', currentBusiness.id)
    .order('created_at', { ascending: false })

  loading.classList.add('hidden')

  if (error) {
    emptyState.textContent = 'Erro ao carregar categorias.'
    emptyState.classList.remove('hidden')
    return
  }

  categories = data || []
  updateSummary(categories)
  renderTable(categories)
}

function openEditModal(item) {
  document.getElementById('edit-id').value = item.id
  document.getElementById('edit-name').value = item.nome || ''
  openModal(editModal)
}

async function categoryNameExists(name, ignoreId = null) {
  const normalized = normalizeName(name).toLowerCase()

  return categories.some(item => {
    const sameName = normalizeName(item.nome).toLowerCase() === normalized
    const differentId = ignoreId ? String(item.id) !== String(ignoreId) : true
    return sameName && differentId
  })
}

function bindRowActions() {
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = categories.find(entry => String(entry.id) === String(btn.dataset.id))
      if (item) openEditModal(item)
    })
  })

  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const item = categories.find(entry => String(entry.id) === String(btn.dataset.id))
      if (!item) return

      const confirmed = confirm(
        `Deseja realmente excluir a categoria "${item.nome}"?`
      )
      if (!confirmed) return

      const { error } = await supabase
        .from('expense_categories')
        .delete()
        .eq('id', item.id)
        .eq('business_id', currentBusiness.id)

      if (error) {
        showTopMessage('Erro ao excluir categoria.', 'error')
        return
      }

      await loadCategories()
      applyLocalFilters()
      showTopMessage('Categoria excluída com sucesso.')
    })
  })
}

createForm.addEventListener('submit', async (e) => {
  e.preventDefault()

  const saveBtn = document.getElementById('save-create-btn')
  const nome = normalizeName(document.getElementById('create-name').value)

  if (!nome) {
    showTopMessage('Preencha o nome da categoria.', 'error')
    return
  }

  if (await categoryNameExists(nome)) {
    showTopMessage('Essa categoria já existe.', 'error')
    return
  }

  saveBtn.disabled = true
  saveBtn.textContent = 'Salvando...'

  const { error } = await supabase
    .from('expense_categories')
    .insert({
      business_id: currentBusiness.id,
      nome
    })

  saveBtn.disabled = false
  saveBtn.textContent = 'Salvar categoria'

  if (error) {
    showTopMessage('Erro ao salvar categoria: ' + error.message, 'error')
    return
  }

  createForm.reset()
  closeModal(createModal)
  await loadCategories()
  applyLocalFilters()
  showTopMessage('Categoria criada com sucesso.')
})

editForm.addEventListener('submit', async (e) => {
  e.preventDefault()

  const saveBtn = document.getElementById('save-edit-btn')
  const id = document.getElementById('edit-id').value
  const nome = normalizeName(document.getElementById('edit-name').value)

  if (!nome) {
    showTopMessage('Preencha o nome da categoria.', 'error')
    return
  }

  if (await categoryNameExists(nome, id)) {
    showTopMessage('Já existe outra categoria com esse nome.', 'error')
    return
  }

  saveBtn.disabled = true
  saveBtn.textContent = 'Salvando...'

  const { error } = await supabase
    .from('expense_categories')
    .update({ nome })
    .eq('id', id)
    .eq('business_id', currentBusiness.id)

  saveBtn.disabled = false
  saveBtn.textContent = 'Salvar alterações'

  if (error) {
    showTopMessage('Erro ao atualizar categoria: ' + error.message, 'error')
    return
  }

  closeModal(editModal)
  await loadCategories()
  applyLocalFilters()
  showTopMessage('Categoria atualizada com sucesso.')
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

document.getElementById('filter-search').addEventListener('input', applyLocalFilters)

async function initPage() {
  await renderMenu('Categorias')

  currentUser = await requireUser()
  if (!currentUser) return

  currentBusiness = await getBusiness(currentUser.id)
  if (!currentBusiness) {
    showTopMessage('Empresa não encontrada.', 'error')
    return
  }

  await loadCategories()
}

initPage()
