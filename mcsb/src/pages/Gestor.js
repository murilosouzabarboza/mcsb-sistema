import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const TABS = [
  { id: 'equipe', label: '👥 Equipe' },
  { id: 'tarefas', label: '📋 Tarefas avulsas' },
  { id: 'ponto', label: '🕐 Ponto' },
  { id: 'bonus', label: '💰 Bônus' },
]

export default function Gestor({ usuario, onLogout }) {
  const [tab, setTab] = useState('equipe')
  const [equipe, setEquipe] = useState([])
  const [ponto, setPonto] = useState([])
  const [tarefasAvulsas, setTarefasAvulsas] = useState([])
  const [avisos, setAvisos] = useState([])
  const [novaTarefa, setNovaTarefa] = useState({ destinatario_id: '', texto: '', categoria: '', requer_confirmacao: true })
  const [novoAviso, setNovoAviso] = useState({ destinatario_id: '', texto: '' })
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState('')

  const hoje = new Date().toISOString().split('T')[0]
  const diasDaSemana = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
  const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
  const agora = new Date()
  const dataFmt = `${diasDaSemana[agora.getDay()]}, ${agora.getDate()} ${meses[agora.getMonth()]} ${agora.getFullYear()}`

  useEffect(() => {
    carregarEquipe()
    carregarPonto()
    carregarTarefasAvulsas()
  }, [])

  const carregarEquipe = async () => {
    const { data } = await supabase.from('usuarios').select('*').eq('ativo', true).order('nome')
    if (data) setEquipe(data)
  }

  const carregarPonto = async () => {
    // Busca últimos 7 dias
    const inicio = new Date()
    inicio.setDate(inicio.getDate() - 7)
    const { data } = await supabase
      .from('ponto')
      .select('*, usuarios(nome, modulo)')
      .gte('data', inicio.toISOString().split('T')[0])
      .order('data', { ascending: false })
      .order('usuario_id')
    if (data) setPonto(data)
  }

  const carregarTarefasAvulsas = async () => {
    const { data } = await supabase
      .from('tarefas_avulsas')
      .select('*, usuarios!tarefas_avulsas_destinatario_id_fkey(nome)')
      .order('criado_em', { ascending: false })
      .limit(30)
    if (data) setTarefasAvulsas(data)
  }

  const lancarTarefa = async () => {
    if (!novaTarefa.destinatario_id || !novaTarefa.texto.trim()) return
    setEnviando(true)
    const { error } = await supabase.from('tarefas_avulsas').insert({
      gestor_id: usuario.id,
      destinatario_id: novaTarefa.destinatario_id,
      texto: novaTarefa.texto.trim(),
      categoria: novaTarefa.categoria || null,
      requer_confirmacao: novaTarefa.requer_confirmacao,
      status: 'pendente'
    })
    if (!error) {
      setNovaTarefa({ destinatario_id: '', texto: '', categoria: '', requer_confirmacao: true })
      carregarTarefasAvulsas()
      setMsg('Tarefa enviada!')
      setTimeout(() => setMsg(''), 2000)
    }
    setEnviando(false)
  }

  const contestarTarefa = async (id) => {
    await supabase.from('tarefas_avulsas').update({ status: 'contestado' }).eq('id', id)
    carregarTarefasAvulsas()
  }

  const cancelarTarefa = async (id) => {
    await supabase.from('tarefas_avulsas').update({ status: 'cancelado' }).eq('id', id)
    carregarTarefasAvulsas()
  }

  const aprovarHoras = async (id) => {
    await supabase.from('ponto').update({ horas_aprovadas: true, nao_marcou: false }).eq('id', id)
    carregarPonto()
  }

  const salvarObsPonto = async (id, obs) => {
    await supabase.from('ponto').update({ obs_gestor: obs }).eq('id', id)
  }

  const funcionarios = equipe.filter(u => u.perfil === 'funcionario')

  const totalPendentes = tarefasAvulsas.filter(t => t.status === 'pendente').length

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">MCSB</div>
        <div className="sidebar-user">
          <div className="sidebar-user-name">{usuario.nome}</div>
          <div className="sidebar-user-role">Gestor · {dataFmt}</div>
        </div>
        <nav className="sidebar-nav">
          {TABS.map(t => (
            <button key={t.id} className={`sidebar-item ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
              {t.id === 'tarefas' && totalPendentes > 0 && <span className="badge-count">{totalPendentes}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="logout-btn" onClick={onLogout}>Sair</button>
        </div>
      </aside>

      <main className="main">
        {msg && <div className="aviso-bar"><span className="aviso-icon">✅</span><span className="aviso-texto">{msg}</span></div>}

        {/* ── EQUIPE ── */}
        {tab === 'equipe' && (
          <>
            <div className="page-title">Visão geral da equipe</div>
            <div className="grid-3">
              {funcionarios.map(f => (
                <div key={f.id} className="kpi-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg3)', border: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 14, color: 'var(--verde)' }}>
                      {f.nome[0]}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{f.nome}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{f.modulo}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>
                    <span>Tarefas pendentes</span>
                    <span style={{ color: 'var(--text)' }}>
                      {tarefasAvulsas.filter(t => t.destinatario_id === f.id && t.status === 'pendente').length}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text3)' }}>
                    <span>Ponto hoje</span>
                    <span style={{ color: 'var(--verde)' }}>
                      {ponto.find(p => p.usuario_id === f.id && p.data === hoje) ? '✓ marcado' : '— não marcou'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Lançar aviso rápido */}
            <div className="sec-label">Lançar aviso</div>
            <div className="card card-body">
              <div className="form-row" style={{ marginBottom: 10 }}>
                <select className="form-select" value={novoAviso.destinatario_id} onChange={e => setNovoAviso({ ...novoAviso, destinatario_id: e.target.value })}>
                  <option value="">Para quem?</option>
                  {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  <option value="todos">Todos</option>
                </select>
              </div>
              <textarea className="form-textarea" placeholder="Escreve o aviso..." value={novoAviso.texto} onChange={e => setNovoAviso({ ...novoAviso, texto: e.target.value })} />
              <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={async () => {
                if (!novoAviso.texto.trim()) return
                const dest = novoAviso.destinatario_id === 'todos' ? null : novoAviso.destinatario_id
                await supabase.from('avisos').insert({ gestor_id: usuario.id, destinatario_id: dest, texto: novoAviso.texto.trim() })
                setNovoAviso({ destinatario_id: '', texto: '' })
                setMsg('Aviso enviado!')
                setTimeout(() => setMsg(''), 2000)
              }}>Enviar aviso</button>
            </div>
          </>
        )}

        {/* ── TAREFAS AVULSAS ── */}
        {tab === 'tarefas' && (
          <>
            <div className="page-title">Tarefas avulsas</div>

            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div className="card-header">Nova tarefa</div>
              <div className="card-body">
                <div className="form-row" style={{ marginBottom: 10 }}>
                  <select className="form-select" value={novaTarefa.destinatario_id} onChange={e => setNovaTarefa({ ...novaTarefa, destinatario_id: e.target.value })}>
                    <option value="">Para quem?</option>
                    {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                  <select className="form-select" value={novaTarefa.categoria} onChange={e => setNovaTarefa({ ...novaTarefa, categoria: e.target.value })}>
                    <option value="">Categoria</option>
                    <option>Devolução</option>
                    <option>Estoque</option>
                    <option>Embalagem</option>
                    <option>Limpeza</option>
                    <option>Marketplace</option>
                    <option>Entrega</option>
                    <option>Outro</option>
                  </select>
                </div>
                <textarea className="form-textarea" placeholder="Descreve a tarefa..." value={novaTarefa.texto} onChange={e => setNovaTarefa({ ...novaTarefa, texto: e.target.value })} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={novaTarefa.requer_confirmacao} onChange={e => setNovaTarefa({ ...novaTarefa, requer_confirmacao: e.target.checked })} />
                    Requer confirmação
                  </label>
                  <button className="btn btn-primary" onClick={lancarTarefa} disabled={enviando}>
                    {enviando ? 'Enviando...' : 'Enviar tarefa'}
                  </button>
                </div>
              </div>
            </div>

            <div className="sec-label">Em aberto ({tarefasAvulsas.filter(t => t.status === 'pendente').length})</div>
            <div className="card">
              {tarefasAvulsas.filter(t => t.status === 'pendente').length === 0 && (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Nenhuma tarefa pendente</div>
              )}
              {tarefasAvulsas.filter(t => t.status === 'pendente').map(t => (
                <div key={t.id} className="task-row">
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, marginBottom: 4 }}>{t.texto}</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className="badge badge-gray">{t.usuarios?.nome}</span>
                      {t.categoria && <span className="badge badge-azul">{t.categoria}</span>}
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>{new Date(t.criado_em).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => cancelarTarefa(t.id)}>Cancelar</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="sec-label" style={{ marginTop: '1.5rem' }}>Concluídas</div>
            <div className="card">
              {tarefasAvulsas.filter(t => t.status === 'concluido').length === 0 && (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Nenhuma tarefa concluída ainda</div>
              )}
              {tarefasAvulsas.filter(t => t.status === 'concluido').map(t => (
                <div key={t.id} className="task-row">
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 4 }}>{t.texto}</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className="badge badge-gray">{t.usuarios?.nome}</span>
                      <span className="badge badge-verde">feito</span>
                      {t.obs_funcionario && <span style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>{t.obs_funcionario}</span>}
                    </div>
                  </div>
                  <button className="btn btn-danger btn-sm" onClick={() => contestarTarefa(t.id)}>Contestar</button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── PONTO ── */}
        {tab === 'ponto' && (
          <>
            <div className="page-title">Controle de ponto</div>
            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Funcionário</th>
                      <th>Data</th>
                      <th>Entrada</th>
                      <th>Saída almoço</th>
                      <th>Retorno</th>
                      <th>Saída</th>
                      <th>Total</th>
                      <th>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ponto.length === 0 && (
                      <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text3)', padding: '2rem' }}>Nenhum registro de ponto ainda</td></tr>
                    )}
                    {ponto.map(p => {
                      const naoMarcou = p.nao_marcou && !p.horas_aprovadas
                      return (
                        <tr key={p.id} className={naoMarcou ? 'err-row' : ''}>
                          <td style={{ fontWeight: 500 }}>{p.usuarios?.nome}</td>
                          <td>{new Date(p.data + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                          <td className={naoMarcou ? 'td-verm' : ''}>{naoMarcou ? 'NÃO MARCOU' : (p.entrada || '—')}</td>
                          <td className="td-muted">{p.saida_almoco || '—'}</td>
                          <td className="td-muted">{p.retorno_almoco || '—'}</td>
                          <td className="td-muted">{p.saida || '—'}</td>
                          <td className={p.total_trabalhado ? 'td-verde' : 'td-muted'}>{p.total_trabalhado || (p.horas_aprovadas ? '8h00 ✓' : '—')}</td>
                          <td>
                            {naoMarcou && (
                              <button className="btn btn-secondary btn-sm" onClick={() => aprovarHoras(p.id)}>Aprovar 8h</button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ── BÔNUS ── */}
        {tab === 'bonus' && (
          <>
            <div className="page-title">Aprovação de bônus</div>
            <div style={{ color: 'var(--text3)', fontSize: 13, padding: '2rem', textAlign: 'center' }}>
              Os bônus aparecerão aqui para aprovação ao final de cada mês, conforme os funcionários preencherem os checklists.
            </div>
          </>
        )}
      </main>
    </div>
  )
}
