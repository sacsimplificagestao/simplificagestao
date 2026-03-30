const supabase = window.supabase

async function getBusiness() {
  const user = (await supabase.auth.getUser()).data.user

  const { data } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_user_id', user.id)
    .single()

  return data
}

async function loadDashboard() {
  const business = await getBusiness()

  if (!business) return

  const today = new Date().toISOString().split('T')[0]

  // gastos
  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')
    .eq('business_id', business.id)
    .eq('data_referencia', today)

  // faturamento
  const { data: cash } = await supabase
    .from('cash_entries')
    .select('*')
    .eq('business_id', business.id)
    .eq('data_referencia', today)

  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.valor), 0)
  const totalCash = cash.reduce((sum, c) => sum + Number(c.valor), 0)

  const lucro = totalCash - totalExpenses
  const margem = totalCash > 0 ? ((lucro / totalCash) * 100).toFixed(0) : 0

  console.log({
    totalCash,
    totalExpenses,
    lucro,
    margem
  })
}

loadDashboard()
