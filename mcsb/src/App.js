import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Gestor from './pages/Gestor'
import ModuloRafael from './pages/ModuloRafael'
import ModuloFernando from './pages/ModuloFernando'
import './App.css'

export default function App() {
  const [usuario, setUsuario] = useState(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    // Verifica sessão salva no localStorage
    const sessao = localStorage.getItem('mcsb_usuario')
    if (sessao) {
      setUsuario(JSON.parse(sessao))
    }
    setCarregando(false)
  }, [])

  const login = (user) => {
    setUsuario(user)
    localStorage.setItem('mcsb_usuario', JSON.stringify(user))
  }

  const logout = () => {
    setUsuario(null)
    localStorage.removeItem('mcsb_usuario')
  }

  if (carregando) return (
    <div className="loading-screen">
      <div className="loading-logo">MCSB</div>
    </div>
  )

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={
          usuario ? <Navigate to="/" /> : <Login onLogin={login} />
        } />
        <Route path="/" element={
          !usuario ? <Navigate to="/login" /> :
          usuario.perfil === 'gestor' ? <Gestor usuario={usuario} onLogout={logout} /> :
          usuario.modulo === 'rafael' ? <ModuloRafael usuario={usuario} onLogout={logout} /> :
          usuario.modulo === 'fernando' ? <ModuloFernando usuario={usuario} onLogout={logout} /> :
          <div className="sem-modulo">Módulo não configurado. Fale com o gestor.</div>
        } />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}
