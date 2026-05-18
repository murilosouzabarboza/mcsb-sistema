import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const TABS = [
  { id: 'diario', label: 'Diário' },
  { id: 'semanal', label: 'Semanal' },
  { id: 'bonus', label: 'Bônus' },
  { id: 'estoque', label: 'Contagem' },
  { id: 'ponto', label: 'Ponto' },
]

export default function ModuloRafael({ usuario, onLogout }) {
  const [tab, setTab] = useState('diario')
  const [tarefas, setTarefas] = useState([])
  const [registros, setRegistros] = useState({})
  const [avulsas, setAvulsas] = useState([])
  const [avisos, setAvisos] = useState([])
  const [contagens, setContagens] = useState([])
  const [novaContagem, setNovaContagem] = useState({ sku: '', qtd_sistema: '', qtd_fisica: '' })
  const [pontoHoje, setPontoHoje] = useState(null)
  const [marcandoPonto, setMarcandoPonto] = useState(false)
  const [lembretes, setLembretes] = useState([])
  const [novoLembrete, setNovoLembrete] = useState({ texto: '', recorrencia: 'unico' })

  const hoje = new Date().toISOString().split('T')[0]
  const diasDaSemana = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
  const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
  const agora = new Date()
  const dataFmt = `${diasDaSemana[agora.getDay()]}, ${agora.getDate()} ${meses[agora.getMonth()]}`

  useEffect(() => {
    carregarTudo()
  }, [])

  const carregarTudo = async () => {
    await Promise.all([
      carregarTarefas(),
      carregarAvulsas(),
      carregarAvisos(),
      carregarContagens(),
      carregarPonto(),
      carregarLembretes(),
    ])
  }

  const carregarTarefas = async () => {
    const { data: tf } = await supabase.from('tarefas_fixas').select('*').eq('modulo', 'rafael').eq('ativo', true).order('frequencia').order('ordem')
    if (tf) setTarefas(tf)

    const { data: reg } = await supabase.from('checklist_registros').select('*').eq('usuario_id', usuario.id).eq('data', hoje)
    if (reg) {
      const mapa = {}
      reg.forEach(r => { mapa[r.tarefa_id] = r })
      setRegistros(mapa)
    }
  }

  const carregarAvulsas = async () => {
    const { data } = await supabase.from('tarefas_avulsas').select('*').eq('destinatario_id', usuario.id).in('status', ['pendente', 'concluido']).order('criado_em', { ascending: false }).limit(20)
    if (data) setAvulsas(data)
  }

  const carregarAvisos = async () => {
    const { data } = await supabase.from('avisos').select('*').or(`destinatario_id.eq.${usuario.id},destinatario_id.is.null`).eq('lido', false).order('criado_em', { ascending: false })
    if (data) setAvisos(data)
  }

  const carregarContagens = async () => {
    const { data } = await supabase.from('contagem_estoque').select('*').eq('usuario_id', usuario.id).order('criado_em', { ascending: false }).limit(30)
    if (data) setContagens(data)
  }

  const carregarPonto = async () => {
    const { data } = await supabase.from('ponto').select('*').eq('usuario_id', usuario.id).eq('data', hoje).single()
    if (data) setPontoHoje(data)
  }

  const carregarLembretes = async () => {
    const { data } = await supabase.from('lembretes').select('*').eq('usuario_id', usuario.id).eq('ativo', true)
    if (data) setLembretes(data)
  }

  const toggleTarefa = async (tarefa) => {
    const reg = registros[tarefa.id]
    const novoStatus = !reg ? 'feito' : reg.status === 'feito' ? 'nao_feito' : 'feito'

    if (reg) {
      await supabase.from('checklist_registros').update({ status: novoStatus }).eq('id', reg.id)
    } else {
      await supabase.from('checklist_registros').insert({
        usuario_id: usuario.id,
        tarefa_id: tarefa.id,
        data: hoje,
        status: novoStatus
      })
    }
    carregarTarefas()
  }

  const confirmarAvulsa = async (id, obs) => {
    await supabase.from('tarefas_avulsas').update({
      status: 'concluido',
      obs_funcionario: obs,
      concluido_em: new Date().toISOString()
    }).eq('id', id)
    carregarAvulsas()
  }

  const marcarPonto = async (tipo) => {
    setMarcandoPonto(true)
    const agora = new Date()
    const horaStr = `${String(agora.getHours()).padStart(2,'0')}:${String(agora.getMinutes()).padStart(2,'0')}`

    if (!pontoHoje) {
      // Primeira batida = entrada
      const { data } = await supabase.from('ponto').insert({
        usuario_id: usuario.id,
        data: hoje,
        entrada: horaStr
      }).select().single()
      if (data) setPontoHoje(data)
    } else {
      const updates = {}
      if (!pontoHoje.saida_almoco) updates.saida_almoco = horaStr
      else if (!pontoHoje.retorno_almoco) updates.retorno_almoco = horaStr
      else if (!pontoHoje.saida) {
        updates.saida = horaStr
        // Calcula total trabalhado
        const entrada = pontoHoje.entrada?.split(':').map(Number) || [0,0]
        const saida = horaStr.split(':').map(Number)
        const totalMin = (saida[0]*60+saida[1]) - (entrada[0]*60+entrada[1])
        const almocoMin = pontoHoje.saida_almoco && pontoHoje.retorno_almoco
          ? (() => {
              const s = pontoHoje.saida_almoco.split(':').map(Number)
              const r = pontoHoje.retorno_almoco.split(':').map(Number)
              return (r[0]*60+r[1]) - (s[0]*60+s[1])
            })()
          : 0
        const liquido = totalMin - almocoMin
        updates.total_trabalhado = `${Math.floor(liquido/60)}h${String(liquido%60).padStart(2,'0')}`
      }
      const { data } = await supabase.from('ponto').update(updates).eq('id', pontoHoje.id).select().single()
      if (data) setPontoHoje(data)
    }
    setMarcandoPonto(false)
  }

  const registrarContagem = async () => {
    const { sku, qtd_sistema, qtd_fisica } = novaContagem
    if (!sku || qtd_sistema === '' || qtd_fisica === '') return
    await supabase.from('contagem_estoque').insert({
      usuario_id: usuario.id,
      data: hoje,
      sku: sku.toUpperCase().trim(),
      qtd_sistema: parseInt(qtd_sistema),
      qtd_fisica: parseInt(qtd_fisica)
    })
    setNovaContagem({ sku: '', qtd_sistema: '', qtd_fisica: '' })
    carregarContagens()
  }

  const marcarAvisoLido = async (id) => {
    await supabase.from('avisos').update({ lido: true, lido_em: new Date().toISOString() }).eq('id', id)
    carregarAvisos()
  }

  const adicionarLembrete = async () => {
    if (!novoLembrete.texto.trim()) return
    await supabase.from('lembretes').insert({
      usuario_id: usuario.id,
      texto: novoLembrete.texto.trim(),
      recorrencia: novoLembrete.recorrencia
    })
    setNovoLembrete({ texto: '', recorrencia: 'unico' })
    carregarLembretes()
  }

  // Calcula progresso diário
  const tarefasDiarias = tarefas.filter(t => t.frequencia === 'diario')
  const feitosDiarios = tarefasDiarias.filter(t => registros[t.id]?.status === 'feito').length
  const pctDiario = tarefasDiarias.length > 0 ? Math.round(feitosDiarios / tarefasDiarias.length * 100) : 0

  // Próxima batida de ponto
  const proximaBatida = !pontoHoje ? 'Entrada' :
    !pontoHoje.saida_almoco ? 'Saída almoço' :
    !pontoHoje.retorno_almoco ? 'Retorno almoço' :
    !pontoHoje.saida ? 'Saída' : 'Dia encerrado'

  const btnPontoDisabled = proximaBatida === 'Dia encerrado'

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">MCSB</div>
        <div className="sidebar-user">
          <div className="sidebar-user-name">{usuario.nome}</div>
          <div className="sidebar-user-role">Expedição & Estoque · {dataFmt}</div>
        </div>
        <nav className="sidebar-nav">
          {TABS.map(t => (
            <button key={t.id} className={`sidebar-item ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
              {t.id === 'diario' && avulsas.filter(a => a.status === 'pendente').length > 0 &&
                <span className="badge-count">{avulsas.filter(a => a.status === 'pendente').length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="logout-btn" onClick={onLogout}>Sair</button>
        </div>
      </aside>

      <main className="main">
        {/* Avisos do gestor */}
        {avisos.map(a => (
          <div key={a.id} className="aviso-bar">
            <span className="aviso-icon">🔔</span>
            <div style={{ flex: 1 }}>
              <div className="aviso-texto">{a.texto}</div>
              <div className="aviso-meta">{new Date(a.criado_em).toLocaleDateString('pt-BR')}</div>
            </div>
            <button className="aviso-lido-btn" onClick={() => marcarAvisoLido(a.id)}>Marcar como lido</button>
          </div>
        ))}

        {/* Tarefas avulsas pendentes */}
        {avulsas.filter(a => a.status === 'pendente').length > 0 && tab === 'diario' && (
          <>
            <div className="sec-label">Tarefas do gestor</div>
            <div className="card" style={{ marginBottom: '1rem' }}>
              {avulsas.filter(a => a.status === 'pendente').map(a => (
                <TarefaAvulsaRow key={a.id} tarefa={a} onConfirmar={confirmarAvulsa} />
              ))}
            </div>
          </>
        )}

        {/* ── DIÁRIO ── */}
        {tab === 'diario' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div className="page-title" style={{ marginBottom: 0 }}>Checklist de hoje</div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 20, fontWeight: 600, color: pctDiario === 100 ? 'var(--verde)' : 'var(--text)' }}>{feitosDiarios}/{tarefasDiarias.length}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{pctDiario}% concluído</div>
              </div>
            </div>

            <div className="prog-wrap" style={{ marginBottom: '1.5rem' }}>
              <div className="prog-bar" style={{ width: pctDiario + '%' }} />
            </div>

            {['Pedidos & Embalagem', 'Estoque', 'Qualidade & Rotina'].map(grupo => {
              const tarefasGrupo = tarefasDiarias.filter(t => t.grupo === grupo)
              if (!tarefasGrupo.length) return null
              return (
                <div key={grupo} className="card" style={{ marginBottom: 10 }}>
                  <div className="card-header">{grupo}</div>
                  {tarefasGrupo.map(t => {
                    const reg = registros[t.id]
                    const status = reg?.status || null
                    return (
                      <div key={t.id} className="task-row">
                        <div className={`task-check ${status || ''}`} onClick={() => toggleTarefa(t)}>
                          {status === 'feito' && '✓'}
                          {status === 'nao_feito' && '✗'}
                        </div>
                        <div className={`task-label ${status === 'feito' ? 'feito' : ''}`}>{t.descricao}</div>
                      </div>
                    )
                  })}
                </div>
              )
            })}

            {/* Lembretes */}
            <div className="sec-label" style={{ marginTop: '1.5rem' }}>Meus lembretes</div>
            {lembretes.map(l => (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <span style={{ color: 'var(--amarelo)' }}>🔖</span>
                <span style={{ flex: 1 }}>{l.texto}</span>
                <span className="badge badge-gray">{l.recorrencia}</span>
                <button className="btn btn-secondary btn-sm" onClick={async () => { await supabase.from('lembretes').update({ ativo: false }).eq('id', l.id); carregarLembretes() }}>×</button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input className="form-input" placeholder="Novo lembrete..." value={novoLembrete.texto} onChange={e => setNovoLembrete({ ...novoLembrete, texto: e.target.value })} style={{ flex: 1 }} />
              <select className="form-select" value={novoLembrete.recorrencia} onChange={e => setNovoLembrete({ ...novoLembrete, recorrencia: e.target.value })} style={{ width: 130 }}>
                <option value="unico">Único</option>
                <option value="diario">Diário</option>
                <option value="semanal">Semanal</option>
                <option value="mensal">Mensal</option>
              </select>
              <button className="btn btn-secondary" onClick={adicionarLembrete}>+</button>
            </div>
          </>
        )}

        {/* ── SEMANAL ── */}
        {tab === 'semanal' && (
          <>
            <div className="page-title">Checklist semanal</div>
            {['Controle de Estoque', 'Recebimento & Logística Reversa', 'Pedidos & Qualidade', 'Organização Geral'].map(grupo => {
              const tarefasGrupo = tarefas.filter(t => t.frequencia === 'semanal' && t.grupo === grupo)
              if (!tarefasGrupo.length) return null
              return (
                <div key={grupo} className="card" style={{ marginBottom: 10 }}>
                  <div className="card-header">{grupo}</div>
                  {tarefasGrupo.map(t => {
                    const reg = registros[t.id]
                    const status = reg?.status || null
                    return (
                      <div key={t.id} className="task-row">
                        <div className={`task-check ${status || ''}`} onClick={() => toggleTarefa(t)}>
                          {status === 'feito' && '✓'}
                          {status === 'nao_feito' && '✗'}
                        </div>
                        <div className={`task-label ${status === 'feito' ? 'feito' : ''}`}>{t.descricao}</div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </>
        )}

        {/* ── BÔNUS ── */}
        {tab === 'bonus' && (
          <>
            <div className="page-title">Meu bônus</div>
            <div className="grid-3">
              <div className="kpi-card kpi-verde">
                <div className="kpi-label">Diário hoje</div>
                <div className="kpi-val">{pctDiario}%</div>
                <div className="kpi-sub">{feitosDiarios}/{tarefasDiarias.length} tarefas</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Bônus máximo</div>
                <div className="kpi-val">R$ 100</div>
                <div className="kpi-sub">por mês</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Status</div>
                <div className="kpi-val" style={{ fontSize: 14, color: 'var(--text3)' }}>Em apuração</div>
                <div className="kpi-sub">aguarda fechamento</div>
              </div>
            </div>
            <div className="card card-body" style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.7 }}>
              <p><strong style={{ color: 'var(--text)' }}>Como funciona:</strong></p>
              <p>• Diário: até R$ 60/mês — proporcional ao % de tarefas concluídas</p>
              <p>• Semanal: até R$ 20/mês — proporcional ao % de semanas completas</p>
              <p>• Quinzenal: até R$ 20/mês — proporcional ao % das quinzenas</p>
              <p style={{ marginTop: 8 }}>O bônus é aprovado pelo gestor ao final do mês.</p>
            </div>
          </>
        )}

        {/* ── CONTAGEM ── */}
        {tab === 'estoque' && (
          <>
            <div className="page-title">Contagem de estoque</div>
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div className="card-header">Registrar contagem</div>
              <div className="card-body">
                <div className="form-row" style={{ marginBottom: 10 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">SKU do produto</label>
                    <input className="form-input" placeholder="Ex: MCSB APOIO PRETO" value={novaContagem.sku} onChange={e => setNovaContagem({ ...novaContagem, sku: e.target.value })} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Qtd. no sistema</label>
                    <input className="form-input" type="number" placeholder="0" value={novaContagem.qtd_sistema} onChange={e => setNovaContagem({ ...novaContagem, qtd_sistema: e.target.value })} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Qtd. contada</label>
                    <input className="form-input" type="number" placeholder="0" value={novaContagem.qtd_fisica} onChange={e => setNovaContagem({ ...novaContagem, qtd_fisica: e.target.value })} />
                  </div>
                </div>
                <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={registrarContagem}>Registrar</button>
              </div>
            </div>

            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Data</th><th>SKU</th><th>Sistema</th><th>Físico</th><th>Diferença</th></tr>
                  </thead>
                  <tbody>
                    {contagens.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text3)', padding: '1.5rem' }}>Nenhuma contagem registrada</td></tr>}
                    {contagens.map(c => (
                      <tr key={c.id}>
                        <td>{new Date(c.data + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                        <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 12 }}>{c.sku}</td>
                        <td>{c.qtd_sistema}</td>
                        <td>{c.qtd_fisica}</td>
                        <td className={c.diferenca > 0 ? 'td-verde' : c.diferenca < 0 ? 'td-verm' : 'td-muted'}>
                          {c.diferenca > 0 ? '+' : ''}{c.diferenca}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ── PONTO ── */}
        {tab === 'ponto' && (
          <>
            <div className="page-title">Ponto eletrônico</div>
            <div className="card card-body" style={{ marginBottom: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 6 }}>Próxima batida</div>
              <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 16, color: btnPontoDisabled ? 'var(--text3)' : 'var(--verde)' }}>
                {proximaBatida}
              </div>
              <button className="btn btn-primary btn-full" onClick={() => marcarPonto()} disabled={marcandoPonto || btnPontoDisabled}>
                {marcandoPonto ? 'Registrando...' : btnPontoDisabled ? 'Dia encerrado' : `Registrar ${proximaBatida}`}
              </button>
            </div>

            {pontoHoje && (
              <div className="card">
                <div className="card-header">Marcações de hoje</div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Entrada</th><th>Saída almoço</th><th>Retorno</th><th>Saída</th><th>Total</th></tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="td-verde">{pontoHoje.entrada || '—'}</td>
                        <td>{pontoHoje.saida_almoco || '—'}</td>
                        <td>{pontoHoje.retorno_almoco || '—'}</td>
                        <td>{pontoHoje.saida || '—'}</td>
                        <td className={pontoHoje.total_trabalhado ? 'td-verde' : 'td-muted'}>{pontoHoje.total_trabalhado || '—'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

function TarefaAvulsaRow({ tarefa, onConfirmar }) {
  const [obs, setObs] = useState('')
  const [aberto, setAberto] = useState(false)

  return (
    <div>
      <div className="task-row">
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, marginBottom: 4 }}>{tarefa.texto}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {tarefa.categoria && <span className="badge badge-azul">{tarefa.categoria}</span>}
            {tarefa.requer_confirmacao && <span className="badge badge-amarelo">requer confirmação</span>}
          </div>
        </div>
        {tarefa.requer_confirmacao && (
          <button className="btn btn-primary btn-sm" onClick={() => setAberto(!aberto)}>
            {aberto ? 'Fechar' : 'Concluir'}
          </button>
        )}
        {!tarefa.requer_confirmacao && (
          <button className="btn btn-secondary btn-sm" onClick={() => onConfirmar(tarefa.id, '')}>Marcar feito</button>
        )}
      </div>
      {aberto && (
        <div className="task-obs-field">
          <textarea placeholder="Observação (opcional)..." value={obs} onChange={e => setObs(e.target.value)} />
          <button className="btn btn-primary btn-sm" style={{ marginTop: 6 }} onClick={() => { onConfirmar(tarefa.id, obs); setAberto(false) }}>
            Confirmar conclusão
          </button>
        </div>
      )}
    </div>
  )
}
