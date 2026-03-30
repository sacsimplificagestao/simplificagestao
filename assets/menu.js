import { supabase } from './supabase.js'

async function getUserAndBusiness() {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    window.location.href = 'index.html'
    return null
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_user_id', user.id)
    .maybeSingle()

  return { user, profile, business }
}

function getCurrentPage() {
  const path = window.location.pathname
  return path.split('/').pop()
}

function isActive(page) {
  return getCurrentPage() === page
}

function getMenuItemClass(page) {
  return isActive(page)
    ? 'bg-green-600 text-white shadow'
    : 'text-gray-700 hover:bg-green-50'
}

function isExpensesSectionOpen() {
  const current = getCurrentPage()
  return [
    'expenses.html',
    'fixed-expenses.html',
    'categories.html'
  ].includes(current)
}

function menuItem(label, page, icon) {
  return `
    <a href="${page}" class="flex items-center gap-3 px-4 py-3 rounded-xl transition ${getMenuItemClass(page)}">
      <span class="text-lg">${icon}</span>
      <span class="font-medium">${label}</span>
    </a>
  `
}

function subMenuItem(label, page) {
  return `
    <a href="${page}" class="block px-4 py-2 rounded-lg text-sm transition ${
      isActive(page)
        ? 'bg-green-100 text-green-700 font-semibold'
        : 'text-gray-600 hover:bg-green-50 hover:text-green-700'
    }">
      ${label}
    </a>
  `
}

function expensesGroup() {
  const open = isExpensesSectionOpen()

  return `
    <div class="space-y-2">
      <button
        id="expenses-toggle"
        type="button"
        class="w-full flex items-center justify-between px-4 py-3 rounded-xl transition ${open ? 'bg-green-50 text-green-700' : 'text-gray-700 hover:bg-green-50'}"
      >
        <div class="flex items-center gap-3">
          <span class="text-lg">💸</span>
          <span class="font-medium">Gastos</span>
        </div>
        <span
          id="expenses-arrow"
          class="text-sm transition-transform duration-300 ${open ? 'rotate-180' : ''}"
        >
          ▼
        </span>
      </button>

      <div
        id="expenses-submenu"
        class="ml-4 pl-4 border-l border-gray-200 space-y-2 overflow-hidden transition-all duration-300 ${open ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0'}"
      >
        ${subMenuItem('Gastos da empresa', 'expenses.html')}
        ${subMenuItem('Gastos fixos', 'fixed-expenses.html')}
        ${subMenuItem('Categorias', 'categories.html')}
      </div>
    </div>
  `
}

function createMenuHTML(userName = 'Usuário', businessName = 'Meu Negócio') {
  return `
    <aside id="sidebar" class="fixed top-0 left-0 h-screen w-72 bg-white border-r border-gray-200 z-40 transform -translate-x-full md:translate-x-0 transition-transform duration-300 shadow-sm">
      <div class="h-full flex flex-col">

        <div class="p-6 border-b border-gray-100">
          <div class="flex items-center gap-3">
            <div class="w-11 h-11 rounded-2xl bg-green-600 text-white flex items-center justify-center font-bold text-lg shadow">
              S
            </div>
            <div class="min-w-0">
              <h1 class="text-lg font-bold text-gray-900">Simplifica Gestão</h1>
              <p class="text-sm text-gray-500 truncate">${businessName}</p>
            </div>
          </div>
        </div>

        <nav class="flex-1 p-4 space-y-2 overflow-y-auto">
          ${menuItem('Dashboard', 'dashboard.html', '📊')}
          ${menuItem('Faturamento', 'cash.html', '💰')}
          ${expensesGroup()}
          ${menuItem('Relatórios', 'reports.html', '📈')}
          ${menuItem('Configurações', 'settings.html', '⚙️')}
        </nav>

        <div class="p-4 border-t border-gray-100">
          <div class="bg-gray-50 rounded-2xl p-4 mb-3">
            <p class="text-sm text-gray-500">Logado como</p>
            <p class="font-semibold text-gray-900 truncate">${userName}</p>
          </div>

          <button id="logout-btn" class="w-full bg-red-50 hover:bg-red-100 text-red-600 font-semibold py-3 rounded-xl transition">
            Sair
          </button>
        </div>
      </div>
    </aside>

    <div id="sidebar-overlay" class="fixed inset-0 bg-black/40 z-30 hidden md:hidden"></div>
  `
}

function createTopbarHTML(pageTitle = 'Painel') {
  return `
    <div class="md:hidden flex items-center justify-between mb-6">
      <button id="open-sidebar" class="text-2xl bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
        ☰
      </button>
      <h2 class="text-lg font-bold text-gray-900">${pageTitle}</h2>
      <div class="w-10"></div>
    </div>
  `
}

function bindExpensesSubmenu() {
  const toggleBtn = document.getElementById('expenses-toggle')
  const submenu = document.getElementById('expenses-submenu')
  const arrow = document.getElementById('expenses-arrow')

  if (!toggleBtn || !submenu || !arrow) return

  toggleBtn.addEventListener('click', () => {
    const isOpen = submenu.classList.contains('max-h-60')

    if (isOpen) {
      submenu.classList.remove('max-h-60', 'opacity-100')
      submenu.classList.add('max-h-0', 'opacity-0')
      arrow.classList.remove('rotate-180')
      toggleBtn.classList.remove('bg-green-50', 'text-green-700')
      toggleBtn.classList.add('text-gray-700')
    } else {
      submenu.classList.remove('max-h-0', 'opacity-0')
      submenu.classList.add('max-h-60', 'opacity-100')
      arrow.classList.add('rotate-180')
      toggleBtn.classList.add('bg-green-50', 'text-green-700')
      toggleBtn.classList.remove('text-gray-700')
    }
  })
}

function bindMenuEvents() {
  const sidebar = document.getElementById('sidebar')
  const overlay = document.getElementById('sidebar-overlay')
  const openBtn = document.getElementById('open-sidebar')
  const logoutBtn = document.getElementById('logout-btn')

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      sidebar.classList.remove('-translate-x-full')
      overlay.classList.remove('hidden')
    })
  }

  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar.classList.add('-translate-x-full')
      overlay.classList.add('hidden')
    })
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await supabase.auth.signOut()
      window.location.href = 'index.html'
    })
  }

  bindExpensesSubmenu()
}

export async function renderMenu(pageTitle = 'Painel') {
  const menuContainer = document.getElementById('menu-container')
  const mobileTopbarContainer = document.getElementById('mobile-topbar-container')

  if (!menuContainer) return

  const data = await getUserAndBusiness()
  if (!data) return

  menuContainer.innerHTML = createMenuHTML(
    data.profile?.nome || data.profile?.full_name || data.user?.email || 'Usuário',
    data.business?.nome || data.business?.name || 'Meu Negócio'
  )

  if (mobileTopbarContainer) {
    mobileTopbarContainer.innerHTML = createTopbarHTML(pageTitle)
  }

  bindMenuEvents()
}
