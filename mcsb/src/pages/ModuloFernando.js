import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const TABS = [
  { id: 'diario', label: 'Diário' },
  { id: 'semanal', label: 'Semanal' },
  { id: 'anuncios', label: 'Anúncios' },
  { id: 'entregas', label: 'Entregas' },
  { id: 'bonus', label: 'Bônus' },
  { id: 'ponto', label: 'Ponto' },
]

export default function ModuloFernando({ usuario, onLogout }) {
  const [tab, setTab] = useState('diario')
  const [tarefas, setTarefas] = useState([])
  const [registros, setRegistros] = useState({})
  const [avulsas, setAvulsas] = useState([])
  const [avisos, setAvisos] = useState([])
  const [anuncios, setAnuncios] = useState([])
  const [entregas, setEntregas] = useState([])
  const [pontoHoje, setPontoHoje] = useState(null)
  const [marcandoPonto, setMarcandoPonto] = useState(false)
  const [lembretes, setLembretes] = useState([])
  const [novoLembrete, setNovoLembrete] = useState({ texto: '', recorrencia: 'unico' })
  const [novoAnuncio, setNovoAnuncio] = useState({ produto: '', categoria: '', canal: '', data_postagem: '' })
  const [novaEntrega, setNovaEntrega] = useState({ data: '', entregador: 'Mailton', quantidade: 1, valor_unitario: 10, tipo: '', horario_coleta: '' })

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
      carregarAnuncios(),
      carregarEntregas(),
      carregarPonto(),
      carregarLembretes(),
    ])
  }

  const carregarTarefas = async () => {
    const { data: tf } = await supabase.from('tarefas_fixas').select('*').eq('modulo', 'fernando').eq('ativo', true).order('frequencia').order('ordem')
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

  const carregarAnuncios = async () => {
    const { data } = await supabase.from('anuncios').select('*').eq('ativo', true).order('data_postagem', { ascending: false })
    if (data) setAnuncios(data)
  }

  const carregarEntregas = async () => {
    const { data } = await supabase.from('entregas').select('*').order('data', { ascending: false }).limit(30)
    if (data) setEntregas(data)
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
      await supabase.from('checklist_registros').insert({ usuario_id: usuario.id, tarefa_id: tarefa.id, data: hoje, status: novoStatus })
    }
    carregarTarefas()
  }

  const confirmarAvulsa = async (id, obs) => {
    await supabase.from('tarefas_avulsas').update({ status: 'concluido', obs_funcionario: obs, concluido_em: new Date().toISOString() }).eq('id', id)
    carregarAvulsas()
  }

  const marcarPonto = async () => {
    setMarcandoPonto(true)
    const agora = new Date()
    const horaStr = `${String(agora.getHours()).padStart(2,'0')}:${String(agora.getMinutes()).padStart(2,'0')}`
    if (!pontoHoje) {
      const { data } = await supabase.from('ponto').insert({ usuario_id: usuario.id, data: hoje, entrada: horaStr }).select().single()
      if (data) setPontoHoje(data)
    } else {
      const updates = {}
      if (!pontoHoje.saida_almoco) updates.saida_almoco = horaStr
      else if (!pontoHoje.retorno_almoco) updates.retorno_almoco = horaStr
      else if (!pontoHoje.saida) {
        updates.saida = horaStr
        const entrada = pontoHoje.entrada?.split(':').map(Number) || [0,0]
        const saida = horaStr.split(':').map(Number)
        const totalMin = (saida[0]*60+saida[1]) - (entrada[0]*60+entrada[1])
        const almocoMin = pontoHoje.saida_almoco && pontoHoje.retorno_almoco
          ? (() => { const s = pontoHoje.saida_almoco.split(':').map(Number); const r = pontoHoje.retorno_almoco.split(':').map(Number); return (r[0]*60+r[1]) - (s[0]*60+s[1]) })()
          : 0
        updates.total_trabalhado = `${Math.floor((totalMin-almocoMin)/60)}h${String((totalMin-almocoMin)%60).padStart(2,'0')}`
      }
      const { data } = await supabase.from('ponto').update(updates).eq('id', pontoHoje.id).select().single()
      if (data) setPontoHoje(data)
    }
    setMarcandoPonto(false)
  }

  const adicionarAnuncio = async () => {
    if (!novoAnuncio.produto) return
    await supabase.from('anuncios').insert({ usuario_id: usuario.id, ...novoAnuncio, data_postagem: novoAnuncio.data_postagem || hoje })
    setNovoAnuncio({ produto: '', categoria: '', canal: '', data_postagem: '' })
    carregarAnuncios()
  }

  const toggleResultado = async (id, atual) => {
    await supabase.from('anuncios').update({ resultado_7dias: !atual }).eq('id', id)
    carregarAnuncios()
  }

  const adicionarEntrega = async () => {
    const { data: d, entregador, quantidade, valor_unitario, tipo, horario_coleta } = novaEntrega
    await supabase.from('entregas').insert({
      data: d || hoje,
      entregador,
      quantidade: parseInt(quantidade),
      valor_unitario: parseFloat(valor_unitario),
      total: parseInt(quantidade) * parseFloat(valor_unitario),
      tipo,
      horario_coleta: horario_coleta || null,
      status_pagamento: 'a_pagar'
    })
    setNovaEntrega({ data: '', entregador: 'Mailton', quantidade: 1, valor_unitario: 10, tipo: '', horario_coleta: '' })
    carregarEntregas()
  }

  const marcarPago = async (id) => {
    await supabase.from('entregas').update({ status_pagamento: 'pago' }).eq('id', id)
    carregarEntregas()
  }

  const marcarAvisoLido = async (id) => {
    await supabase.from('avisos').update({ lido: true, lido_em: new Date().toISOString() }).eq('id', id)
    carregarAvisos()
  }

  const tarefasDiarias = tarefas.filter(t => t.frequencia === 'diario')
  const feitosDiarios = tarefasDiarias.filter(t => registros[t.id]?.status === 'feito').length
  const pctDiario = tarefasDiarias.length > 0 ? Math.round(feitosDiarios / tarefasDiarias.length * 100) : 0

  const proximaBatida = !pontoHoje ? 'Entrada' : !pontoHoje.saida_almoco ? 'Saída almoço' : !pontoHoje.retorno_almoco ? 'Retorno almoço' : !pontoHoje.saida ? 'Saída' : 'Dia encerrado'
  const btnPontoDisabled = proximaBatida === 'Dia encerrado'

  const totalMailton = entregas.filter(e => e.entregador === 'Mailton' && e.status_pagamento === 'a_pagar').reduce((s, e) => s + (e.total || 0), 0)

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">MCSB</div>
        <div className="sidebar-user">
          <div className="sidebar-user-name">{usuario.nome}</div>
          <div className="sidebar-user-role">Vendas & Marketplace · {dataFmt}</div>
        </div>
        <nav className="sidebar-nav">
          {TABS.map(t => (
            <button key={t.id} className={`sidebar-item ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
              {t.id === 'diario' && avulsas.filter(a => a.status === 'pendente').length > 0 && <span className="badge-count">{avulsas.filter(a => a.status === 'pendente').length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="logout-btn" onClick={onLogout}>Sair</button>
        </div>
      </aside>

      <main className="main">
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

        {avulsas.filter(a => a.status === 'pendente').length > 0 && tab === 'diario' && (
          <>
            <div className="sec-label">Tarefas do gestor</div>
            <div className="card" style={{ marginBottom: '1rem' }}>
              {avulsas.filter(a => a.status === 'pendente').map(a => (
                <TarefaRow key={a.id} tarefa={a} onConfirmar={confirmarAvulsa} />
              ))}
            </div>
          </>
        )}

        {tab === 'diario' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div className="page-title" style={{ marginBottom: 0 }}>Checklist de hoje</div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 20, fontWeight: 600, color: pctDiario === 100 ? 'var(--verde)' : 'var(--text)' }}>{feitosDiarios}/{tarefasDiarias.length}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{pctDiario}%</div>
              </div>
            </div>
            <div className="prog-wrap" style={{ marginBottom: '1.5rem' }}>
              <div className="prog-bar" style={{ width: pctDiario + '%' }} />
            </div>
            {['Comercial', 'Meta Ads', 'Pedidos'].map(grupo => {
              const tg = tarefasDiarias.filter(t => t.grupo === grupo)
              if (!tg.length) return null
              return (
                <div key={grupo} className="card" style={{ marginBottom: 10 }}>
                  <div className="card-header">{grupo}</div>
                  {tg.map(t => {
                    const reg = registros[t.id]
                    const status = reg?.status || null
                    return (
                      <div key={t.id} className="task-row">
                        <div className={`task-check ${status || ''}`} onClick={() => toggleTarefa(t)}>
                          {status === 'feito' && '✓'}{status === 'nao_feito' && '✗'}
                        </div>
                        <div className={`task-label ${status === 'feito' ? 'feito' : ''}`}>{t.descricao}</div>
                      </div>
                    )
                  })}
                </div>
              )
            })}

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
              <button className="btn btn-secondary" onClick={async () => { if (!novoLembrete.texto.trim()) return; await supabase.from('lembretes').insert({ usuario_id: usuario.id, texto: novoLembrete.texto.trim(), recorrencia: novoLembrete.recorrencia }); setNovoLembrete({ texto: '', recorrencia: 'unico' }); carregarLembretes() }}>+</button>
            </div>
          </>
        )}

        {tab === 'semanal' && (
          <>
            <div className="page-title">Checklist semanal</div>
            {['Controle de Estoque', 'Recebimento & Logística Reversa', 'Pedidos & Qualidade', 'Organização Geral'].map(grupo => {
              const tg = tarefas.filter(t => t.frequencia === 'semanal' && t.grupo === grupo)
              if (!tg.length) return null
              return (
                <div key={grupo} className="card" style={{ marginBottom: 10 }}>
                  <div className="card-header">{grupo}</div>
                  {tg.map(t => {
                    const reg = registros[t.id]
                    const status = reg?.status || null
                    return (
                      <div key={t.id} className="task-row">
                        <div className={`task-check ${status || ''}`} onClick={() => toggleTarefa(t)}>
                          {status === 'feito' && '✓'}{status === 'nao_feito' && '✗'}
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

        {tab === 'anuncios' && (
          <>
            <div className="page-title">Controle de anúncios</div>
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div className="card-header">Registrar anúncio</div>
              <div className="card-body">
                <div className="form-row" style={{ marginBottom: 10 }}>
                  <input className="form-input" placeholder="Produto" value={novoAnuncio.produto} onChange={e => setNovoAnuncio({ ...novoAnuncio, produto: e.target.value })} />
                  <select className="form-select" value={novoAnuncio.categoria} onChange={e => setNovoAnuncio({ ...novoAnuncio, categoria: e.target.value })}>
                    <option value="">Categoria</option>
                    <option>Climatizadores</option>
                    <option>Ferramentas</option>
                    <option>Locação</option>
                    <option>Doméstico</option>
                    <option>Outro</option>
                  </select>
                </div>
                <div className="form-row">
                  <select className="form-select" value={novoAnuncio.canal} onChange={e => setNovoAnuncio({ ...novoAnuncio, canal: e.target.value })}>
                    <option value="">Canal</option>
                    <option>Facebook</option>
                    <option>Instagram</option>
                    <option>WhatsApp</option>
                    <option>Google Ads</option>
                  </select>
                  <input className="form-input" type="date" value={novoAnuncio.data_postagem} onChange={e => setNovoAnuncio({ ...novoAnuncio, data_postagem: e.target.value })} />
                </div>
                <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={adicionarAnuncio}>Adicionar</button>
              </div>
            </div>
            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Produto</th><th>Categoria</th><th>Canal</th><th>Postado em</th><th>Resultado 7 dias</th></tr></thead>
                  <tbody>
                    {anuncios.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text3)', padding: '1.5rem' }}>Nenhum anúncio registrado</td></tr>}
                    {anuncios.map(a => {
                      const diasDesde = a.data_postagem ? Math.floor((new Date() - new Date(a.data_postagem)) / 86400000) : 0
                      const vencido = diasDesde > 30
                      return (
                        <tr key={a.id} className={vencido ? 'warn-row' : ''}>
                          <td style={{ fontWeight: 500 }}>{a.produto}</td>
                          <td><span className="badge badge-gray">{a.categoria || '—'}</span></td>
                          <td>{a.canal || '—'}</td>
                          <td>
                            {a.data_postagem ? new Date(a.data_postagem + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                            {vencido && <span className="badge badge-vermelho" style={{ marginLeft: 6 }}>+30 dias</span>}
                          </td>
                          <td>
                            <button className={`btn btn-sm ${a.resultado_7dias === true ? 'btn-primary' : a.resultado_7dias === false ? 'btn-danger' : 'btn-secondary'}`}
                              onClick={() => toggleResultado(a.id, a.resultado_7dias)}>
                              {a.resultado_7dias === true ? '✓ Sim' : a.resultado_7dias === false ? '✗ Não' : '—'}
                            </button>
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

        {tab === 'entregas' && (
          <>
            <div className="page-title">Controle de entregas</div>
            <div className="grid-2" style={{ marginBottom: '1rem' }}>
              <div className="kpi-card kpi-vermelho">
                <div className="kpi-label">Mailton a pagar</div>
                <div className="kpi-val">R$ {totalMailton.toFixed(2).replace('.', ',')}</div>
                <div className="kpi-sub">pendente</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Entregas este mês</div>
                <div className="kpi-val">{entregas.length}</div>
                <div className="kpi-sub">registradas</div>
              </div>
            </div>
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div className="card-header">Registrar entrega</div>
              <div className="card-body">
                <div className="form-row" style={{ marginBottom: 10 }}>
                  <input className="form-input" type="date" value={novaEntrega.data} onChange={e => setNovaEntrega({ ...novaEntrega, data: e.target.value })} />
                  <select className="form-select" value={novaEntrega.entregador} onChange={e => setNovaEntrega({ ...novaEntrega, entregador: e.target.value })}>
                    <option>Mailton</option>
                    <option>Fernando</option>
                    <option>Correios</option>
                    <option>Transportadora</option>
                  </select>
                </div>
                <div className="form-row">
                  <input className="form-input" type="number" placeholder="Qtd." value={novaEntrega.quantidade} onChange={e => setNovaEntrega({ ...novaEntrega, quantidade: e.target.value })} />
                  <input className="form-input" type="number" placeholder="Valor unit." value={novaEntrega.valor_unitario} onChange={e => setNovaEntrega({ ...novaEntrega, valor_unitario: e.target.value })} />
                  <input className="form-input" placeholder="Tipo (ex: Flex)" value={novaEntrega.tipo} onChange={e => setNovaEntrega({ ...novaEntrega, tipo: e.target.value })} />
                </div>
                <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={adicionarEntrega}>Registrar</button>
              </div>
            </div>
            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Data</th><th>Entregador</th><th>Qtd.</th><th>Total</th><th>Tipo</th><th>Status</th><th>Ação</th></tr></thead>
                  <tbody>
                    {entregas.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text3)', padding: '1.5rem' }}>Nenhuma entrega registrada</td></tr>}
                    {entregas.map(e => (
                      <tr key={e.id}>
                        <td>{e.data ? new Date(e.data + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                        <td>{e.entregador}</td>
                        <td>{e.quantidade}</td>
                        <td>R$ {(e.total || 0).toFixed(2).replace('.', ',')}</td>
                        <td>{e.tipo || '—'}</td>
                        <td><span className={`badge ${e.status_pagamento === 'pago' ? 'badge-verde' : 'badge-amarelo'}`}>{e.status_pagamento === 'pago' ? 'Pago' : 'A pagar'}</span></td>
                        <td>{e.status_pagamento === 'a_pagar' && <button className="btn btn-secondary btn-sm" onClick={() => marcarPago(e.id)}>Marcar pago</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {tab === 'bonus' && (
          <>
            <div className="page-title">Meu bônus e comissões</div>
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
              <div className="kpi-card kpi-azul">
                <div className="kpi-label">Comissão base</div>
                <div className="kpi-val">2% / 5%</div>
                <div className="kpi-sub">Comércio / Locações</div>
              </div>
            </div>
            <div className="card card-body" style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.8 }}>
              <p><strong style={{ color: 'var(--text)' }}>Metas e prêmios (substituem o anterior):</strong></p>
              <p>META 1 — R$ 6.000 faturado → prêmio R$ 100</p>
              <p>META 2 — R$ 12.000 → prêmio R$ 200</p>
              <p>META 3 — R$ 18.000 → prêmio R$ 300</p>
              <p>META 4 — R$ 24.000 → prêmio R$ 400</p>
              <p>META 5 — R$ 30.000 → prêmio R$ 550</p>
              <p style={{ marginTop: 8 }}>Os valores são atualizados pelo gestor mensalmente.</p>
            </div>
          </>
        )}

        {tab === 'ponto' && (
          <>
            <div className="page-title">Ponto eletrônico</div>
            <div className="card card-body" style={{ marginBottom: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 6 }}>Próxima batida</div>
              <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 16, color: btnPontoDisabled ? 'var(--text3)' : 'var(--verde)' }}>{proximaBatida}</div>
              <button className="btn btn-primary btn-full" onClick={marcarPonto} disabled={marcandoPonto || btnPontoDisabled}>
                {marcandoPonto ? 'Registrando...' : btnPontoDisabled ? 'Dia encerrado' : `Registrar ${proximaBatida}`}
              </button>
            </div>
            {pontoHoje && (
              <div className="card">
                <div className="card-header">Marcações de hoje</div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Entrada</th><th>Saída almoço</th><th>Retorno</th><th>Saída</th><th>Total</th></tr></thead>
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

function TarefaRow({ tarefa, onConfirmar }) {
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
        {tarefa.requer_confirmacao
          ? <button className="btn btn-primary btn-sm" onClick={() => setAberto(!aberto)}>{aberto ? 'Fechar' : 'Concluir'}</button>
          : <button className="btn btn-secondary btn-sm" onClick={() => onConfirmar(tarefa.id, '')}>Marcar feito</button>}
      </div>
      {aberto && (
        <div className="task-obs-field">
          <textarea placeholder="Observação (opcional)..." value={obs} onChange={e => setObs(e.target.value)} />
          <button className="btn btn-primary btn-sm" style={{ marginTop: 6 }} onClick={() => { onConfirmar(tarefa.id, obs); setAberto(false) }}>Confirmar conclusão</button>
        </div>
      )}
    </div>
  )
}
