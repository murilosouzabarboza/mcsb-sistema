import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setErro('')
    setCarregando(true)

    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('email', email.toLowerCase().trim())
        .eq('ativo', true)
        .single()

      if (error || !data) {
        setErro('Email não encontrado.')
        setCarregando(false)
        return
      }

      // Senha simples por enquanto: primeiros 4 caracteres do nome + "2024"
      // Ex: Rafael → rafa2024 | Murilo → muri2024
      const senhaEsperada = data.nome.toLowerCase().slice(0, 4) + '2024'
      if (senha !== senhaEsperada) {
        setErro('Senha incorreta.')
        setCarregando(false)
        return
      }

      onLogin(data)
    } catch (err) {
      setErro('Erro ao conectar. Tente novamente.')
    }

    setCarregando(false)
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">MCSB</div>
        <div className="login-sub">sistema interno</div>

        {erro && <div className="login-erro">{erro}</div>}

        <form onSubmit={handleLogin}>
          <label className="login-label">Email</label>
          <input
            className="login-input"
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <label className="login-label">Senha</label>
          <input
            className="login-input"
            type="password"
            placeholder="••••••••"
            value={senha}
            onChange={e => setSenha(e.target.value)}
            required
          />

          <button className="login-btn" type="submit" disabled={carregando}>
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', fontSize: 11, color: 'var(--text3)', textAlign: 'center' }}>
          MCSB Comércio e Serviços · Sistema Interno
        </div>
      </div>
    </div>
  )
}
