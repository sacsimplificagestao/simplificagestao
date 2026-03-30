import { supabase } from './supabase.js'

function getTodayLocalParts() {
  const now = new Date()
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate()
  }
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function getMesReferencia(year, month) {
  return `${year}-${pad2(month)}`
}

function getDataReferencia(year, month, dayVencimento) {
  const lastDay = new Date(year, month, 0).getDate()
  const realDay = Math.min(dayVencimento, lastDay)
  return `${year}-${pad2(month)}-${pad2(realDay)}`
}

async function getCurrentUserAndBusiness() {
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user

  if (!user) return null

  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_user_id', user.id)
    .maybeSingle()

  if (!business) return null

  return { user, business }
}

export async function generateFixedExpensesIfNeeded() {
  const context = await getCurrentUserAndBusiness()
  if (!context) return

  const { business } = context
  const { year, month, day } = getTodayLocalParts()
  const mesReferencia = getMesReferencia(year, month)

  const { data: fixedExpenses, error: fixedError } = await supabase
    .from('fixed_expenses')
    .select('*')
    .eq('business_id', business.id)
    .eq('ativo', true)

  if (fixedError || !fixedExpenses?.length) return

  for (const item of fixedExpenses) {
    if (day < Number(item.dia_vencimento)) {
      continue
    }

    const dataReferencia = getDataReferencia(year, month, Number(item.dia_vencimento))

    const { data: existingExpense } = await supabase
      .from('expenses')
      .select('id')
      .eq('business_id', business.id)
      .eq('fixed_expense_id', item.id)
      .eq('mes_referencia', mesReferencia)
      .maybeSingle()

    if (existingExpense) {
      continue
    }

    await supabase
      .from('expenses')
      .insert({
        business_id: business.id,
        descricao: item.descricao,
        categoria: item.categoria,
        valor: Number(item.valor || 0),
        data_referencia: dataReferencia,
        fixed_expense_id: item.id,
        mes_referencia: mesReferencia,
        gerado_automaticamente: true
      })
  }
}
