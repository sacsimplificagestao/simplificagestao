const supabase = window.supabase

async function signUp(email, password, nome, empresa) {
  try {
    if (!email || !password || !nome || !empresa) {
      alert('Preencha todos os campos.')
      return
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password
    })

    if (error) {
      alert(error.message)
      return
    }

    const user = data.user

    if (!user) {
      alert('Conta criada, mas não foi possível obter o usuário.')
      return
    }

    const { error: profileError } = await supabase.from('profiles').insert({
      id: user.id,
      nome,
      email
    })

    if (profileError) {
      alert('Erro ao criar perfil: ' + profileError.message)
      return
    }

    const { error: businessError } = await supabase.from('businesses').insert({
      owner_user_id: user.id,
      nome: empresa
    })

    if (businessError) {
      alert('Erro ao criar empresa: ' + businessError.message)
      return
    }

    alert('Conta criada com sucesso! Agora faça login.')
    window.location.reload()
  } catch (err) {
    console.error(err)
    alert('Erro inesperado ao criar conta.')
  }
}

async function signIn(email, password) {
  try {
    if (!email || !password) {
      alert('Preencha email e senha.')
      return
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      alert(error.message)
      return
    }

    window.location.href = 'dashboard.html'
  } catch (err) {
    console.error(err)
    alert('Erro inesperado ao entrar.')
  }
}

async function signOut() {
  try {
    await supabase.auth.signOut()
    window.location.href = 'index.html'
  } catch (err) {
    console.error(err)
    alert('Erro ao sair.')
  }
}

window.signUp = signUp
window.signIn = signIn
window.signOut = signOut
