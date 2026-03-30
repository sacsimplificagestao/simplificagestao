const supabase = window.supabase

export async function signUp(email, password, nome, empresa) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  })

  if (error) {
    alert(error.message)
    return
  }

  const user = data.user

  // cria profile
  await supabase.from('profiles').insert({
    id: user.id,
    nome,
    email
  })

  // cria empresa
  await supabase.from('businesses').insert({
    owner_user_id: user.id,
    nome: empresa
  })

  alert('Conta criada!')
}

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error) {
    alert(error.message)
    return
  }

  window.location.href = '/dashboard.html'
}

export async function signOut() {
  await supabase.auth.signOut()
  window.location.href = '/'
}
