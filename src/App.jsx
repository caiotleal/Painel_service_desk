import React, { useState, useEffect, useRef } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import DraggablePopup from 'react-draggable';
import { db, auth } from './firebase'; 
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  setDoc, 
  deleteDoc
} from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { Star, Moon, Sun, Bell, ChevronDown, ExternalLink, Settings, ShieldAlert, Clock } from 'lucide-react';
import Login from './Login';

const COLUNAS = [
  { id: 'Sustentação', tipo: 'backlog', largura: 'w-64' },
  { id: 'Suporte Admin', tipo: 'backlog', largura: 'w-64' },
  { id: 'Teste', tipo: 'action', largura: 'flex-1 min-w-[350px]' },
  { id: 'Retorno de Teste', tipo: 'action', largura: 'flex-1 min-w-[350px]' },
  { id: 'Aguardando PR', tipo: 'action', largura: 'flex-1 min-w-[350px]' }
];

const WEBHOOK_PRIORIDADE = "https://defaultf10d92df6fcc4b2d90005615ec44f5.4f.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/9b1d5d1c73c84b488531b7aba1e7e21c/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=H87nQJod8-EUpz0qJ5vLkJVow9WZ4yqQejr03aYD2h8";
const WEBHOOK_MOVIMENTACAO = "https://defaultf10d92df6fcc4b2d90005615ec44f5.4f.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/c037ac06b5964bc09b1fa678b9bcfecf/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=LgCsrcEvh_BD9gI-HnH_fo9GSRr4FqtL4EPWR7XMyBI";

export default function App() {
  const [user, setUser] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [analistas, setAnalistas] = useState([]);
  const [darkMode, setDarkMode] = useState(true);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [fixedCards, setFixedCards] = useState({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificacoesAtivas, setNotificacoesAtivas] = useState(true);
  
  const notifiedYellowRef = useRef(new Set());
  const nodeRefUrgente = useRef(null);
  const nodeRefAmarelo = useRef(null);
  const nodeRefVermelho = useRef(null);

  const enviarNotificacao = async (url, titulo, mensagem, ticket, cor = "Accent") => {
    if (!notificacoesAtivas) return;
    const payload = {
      "type": "message",
      "attachments": [{
        "contentType": "application/vnd.microsoft.card.adaptive",
        "content": {
          "type": "AdaptiveCard",
          "body": [
            { "type": "TextBlock", "text": titulo, "weight": "Bolder", "size": "Medium", "color": cor },
            { "type": "TextBlock", "text": mensagem, "isSubtle": true, "wrap": true },
            { "type": "FactSet", "facts": [
              { "title": "Ticket:", "value": `#${ticket.id}` },
              { "title": "Assunto:", "value": ticket.subject },
              { "title": "Operador:", "value": user.displayName || user.email }
            ]}
          ],
          "actions": [{ "type": "Action.OpenUrl", "title": "Ver no Freshdesk", "url": `https://engage-bz.freshdesk.com/a/tickets/${ticket.id}` }],
          "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
          "version": "1.4"
        }
      }]
    };
    try { await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); } catch (e) { console.error("Erro Teams:", e); }
  };

  const handleLogout = async () => {
    if (user) {
      try {
        await deleteDoc(doc(db, "presenca", user.uid));
        await signOut(auth);
      } catch (e) { await signOut(auth); }
    }
  };

  const checkSLA = (ticket) => {
    const dataRaw = ticket.due_by || ticket['Resolução Devida'] || ticket.fr_due_by || ticket.sla_data;
    if (!dataRaw) return 'sem-prazo';

    let prazo;
    if (dataRaw?.toDate) {
       prazo = dataRaw.toDate().getTime();
    } else {
       prazo = new Date(dataRaw).getTime();
    }

    if (isNaN(prazo)) return 'sem-prazo';
    const agora = new Date().getTime();
    const diferencaHoras = (prazo - agora) / (1000 * 60 * 60);

    if (diferencaHoras < 0) return 'vencido';     
    if (diferencaHoras <= 24) return 'alerta';    // Melhoria: Ajustado para 24h
    return 'em-dia';                              
  };

  const limparTicketsNaoAbertos = async (lista) => {
    lista.forEach(async (t) => {
      const status = String(t.status || t.Status || "").toLowerCase().trim();
      if (status !== "" && status !== "aberto" && status !== "open") {
        try {
          await deleteDoc(doc(db, "tickets", String(t.id)));
        } catch (e) { console.error("Erro CleanUp:", e); }
      }
    });
  };

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const pRef = doc(db, "presenca", u.uid);
        await setDoc(pRef, { nome: u.displayName || u.email.split('@')[0], email: u.email, online: true, uid: u.uid }, { merge: true });
        const limpar = () => deleteDoc(pRef);
        window.addEventListener('beforeunload', limpar);
        return () => window.removeEventListener('beforeunload', limpar);
      } else { setUser(null); }
    });
    return unsubAuth;
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubT = onSnapshot(collection(db, "tickets"), (snap) => {
      const data = snap.docs.map(d => ({ ...d.data(), id: String(d.data().id || d.id) }));
      const exibicao = data.filter(t => {
        const s = String(t.status || t.Status || "").toLowerCase().trim();
        return s === "aberto" || s === "open" || s === "";
      });
      setTickets(exibicao);
      if (exibicao.length < data.length) limparTicketsNaoAbertos(data);
    });

    const unsubP = onSnapshot(collection(db, "presenca"), (snap) => {
      setAnalistas(snap.docs.map(d => d.data()));
    });
    return () => { unsubT(); unsubP(); };
  }, [user]);

  useEffect(() => {
    if (!notificacoesAtivas || !user) return;
    tickets.forEach(ticket => {
      const slaStatus = checkSLA(ticket);
      if (slaStatus === 'alerta' && !notifiedYellowRef.current.has(ticket.id)) {
        enviarNotificacao(WEBHOOK_MOVIMENTACAO, "⚠️ Atenção: SLA em Risco", "Este ticket vence em menos de 24 horas.", ticket, "Warning");
        notifiedYellowRef.current.add(ticket.id);
      }
    });
  }, [tickets, notificacoesAtivas, user]);

  const toggleStar = async (id, currentVal) => {
    const novoStatus = !currentVal;
    await updateDoc(doc(db, "tickets", String(id)), { prioridade_painel: novoStatus });
    if (novoStatus) {
      const ticket = tickets.find(t => t.id === String(id));
      if (ticket) enviarNotificacao(WEBHOOK_PRIORIDADE, "⭐ Ticket Priorizado", `Marcado como PRIORIDADE no painel.`, ticket, "Good");
    }
  };

  const onDragEnd = async (res) => {
    if (!res.destination) return;
    const tId = String(res.draggableId.split('-')[0]);
    const colDest = COLUNAS.find(c => c.id === res.destination.droppableId);
    const colOrigem = COLUNAS.find(c => c.id === res.source.droppableId);
    if (colDest.tipo === 'action') {
      await updateDoc(doc(db, "tickets", tId), { fluxo_ativo: true, status_interno: colDest.id, updated_by: user.displayName || user.email.split('@')[0] });
      if (colDest.id !== colOrigem.id) {
        const ticket = tickets.find(t => t.id === tId);
        enviarNotificacao(WEBHOOK_MOVIMENTACAO, "🔄 Movimentação", `Ticket movido para: **${colDest.id}**`, ticket, "Accent");
      }
    } else {
      await updateDoc(doc(db, "tickets", tId), { fluxo_ativo: false, status_interno: null });
    }
  };

  if (!user) return <Login />;

  const urgentes = tickets.filter(t => t.prioridade_painel);
  const slaAmarelo = tickets.filter(t => checkSLA(t) === 'alerta');
  const slaVermelho = tickets.filter(t => checkSLA(t) === 'vencido');

  return (
    <div className={`${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} h-screen w-full flex flex-col overflow-hidden font-sans transition-colors duration-500`}>
      <header className={`${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} h-16 border-b px-6 flex justify-between items-center z-[150] shrink-0`}>
        <div className="flex items-center gap-8">
          <div className="flex items-baseline gap-2">
            <h1 className="font-black text-2xl italic tracking-tighter text-blue-600 font-mono">KS PRO</h1>
            <span className="text-[10px] font-bold text-slate-500">v2.4</span>
          </div>
          <div className="flex -space-x-2">
            {analistas.map((a, i) => (
              <div key={i} title={`${a.nome}`} className="w-8 h-8 rounded-full bg-blue-600 border-2 border-slate-900 flex items-center justify-center text-[10px] text-white font-black uppercase shadow-md cursor-help transition-transform hover:scale-110">
                {a.nome?.substring(0,2)}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-xl bg-slate-800/10 dark:bg-slate-800 transition-all hover:scale-110">
            {darkMode ? <Sun size={18}/> : <Moon size={18}/>}
          </button>
          <div className="relative">
            <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 rounded-xl bg-slate-800/10 dark:bg-slate-800 transition-all hover:scale-110"><Settings size={18} /></button>
            {menuOpen && (
              <div className="absolute right-0 top-12 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-2 z-[200] animate-in fade-in zoom-in-95">
                <button onClick={() => setNotificacoesAtivas(!notificacoesAtivas)} className={`w-full text-left px-3 py-2 rounded-lg text-[11px] font-bold flex items-center justify-between ${notificacoesAtivas ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                  <span>Notificações Teams</span>
                  <div className={`w-2 h-2 rounded-full ${notificacoesAtivas ? 'bg-green-500' : 'bg-red-500'}`}></div>
                </button>
              </div>
            )}
          </div>
          <button onClick={handleLogout} className="text-[10px] font-black uppercase text-slate-400 hover:text-red-500 transition-colors border border-slate-700/30 px-3 py-1.5 rounded-lg">Sair</button>
        </div>
      </header>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex-1 flex gap-4 p-4 overflow-x-auto items-start">
          {COLUNAS.map(col => {
            const list = tickets.filter(t => col.tipo === 'backlog' ? t.group === col.id : (t.fluxo_ativo && t.status_interno === col.id));
            return (
              <div key={col.id} className={`${col.largura} flex flex-col h-full`}>
                <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 px-2 flex justify-between">{col.id} <span className="text-blue-500">{list.length}</span></h2>
                <Droppable droppableId={col.id}>
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="flex-1 overflow-y-auto p-2 space-y-3 pb-24 scrollbar-hide">
                      {list.map((t, index) => {
                        const sla = checkSLA(t);
                        const isExpanded = (hoveredCard === t.id || fixedCards[t.id]);
                        return (
                          <Draggable key={`${t.id}-${col.id}`} draggableId={`${t.id}-${col.id}`} index={index}>
                            {(p) => (
                              <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps} 
                                className={`relative p-4 rounded-xl shadow-md border transition-all duration-300 ${darkMode ? 'bg-slate-800' : 'bg-white'} 
                                ${sla === 'vencido' ? 'border-l-4 border-l-red-600' : sla === 'alerta' ? 'border-l-4 border-l-yellow-500' : sla === 'em-dia' ? 'border-l-4 border-l-green-500' : 'border-l-4 border-slate-700'} 
                                ${isExpanded ? 'z-[100] ring-1 ring-blue-500' : 'z-10'}`}>
                                <div className="flex justify-between items-start">
                                  <div className="flex flex-col gap-0.5 overflow-hidden w-full">
                                    <div className="flex items-center gap-2">
                                      <a href={`https://engage-bz.freshdesk.com/a/tickets/${t.id}`} target="_blank" rel="noopener noreferrer" className="text-[9px] font-bold text-blue-500 font-mono hover:underline flex items-center gap-1">#{t.id} <ExternalLink size={8} /></a>
                                      {t.updated_by && <div className="text-[8px] font-black text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-full uppercase italic">{t.updated_by}</div>}
                                    </div>
                                    <h3 className={`text-[12px] font-bold leading-tight truncate ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>{t.subject}</h3>
                                  </div>
                                  <button onClick={() => toggleStar(t.id, t.prioridade_painel)} className="ml-2"><Star size={16} fill={t.prioridade_painel ? "#ef4444" : "none"} className={t.prioridade_painel ? "text-red-500 scale-110" : "text-slate-400"} /></button>
                                </div>
                                <div onClick={() => setFixedCards(prev => ({ ...prev, [t.id]: !prev[t.id] }))} 
                                     onMouseEnter={() => setHoveredCard(t.id)} 
                                     onMouseLeave={() => setHoveredCard(null)}
                                     className={`mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded cursor-pointer text-[8px] font-black uppercase transition-colors ${fixedCards[t.id] ? 'bg-blue-600 text-white' : 'bg-slate-700/30 text-slate-400'}`}>
                                     <ChevronDown size={12} className={isExpanded ? 'rotate-180' : ''} /> {fixedCards[t.id] ? 'Fixado' : 'Detalhes'}
                                </div>
                                {isExpanded && (
                                  <div className={`absolute left-0 top-[90%] w-full p-4 rounded-b-xl shadow-2xl border-x border-b z-[110] ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                                    <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto scrollbar-thin">
                                      {Object.entries(t).map(([k, v]) => {
                                        if (['id', 'subject', 'prioridade_painel', 'fluxo_ativo', 'status_interno', 'updated_by'].includes(k) || !v) return null;
                                        return ( <div key={k} className="flex flex-col border-b border-slate-700/30 pb-1"><span className="text-[7px] font-black text-blue-500 uppercase">{k.replace(/_/g, ' ')}</span><span className="text-[10px] break-words">{String(v)}</span></div> );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
	  
      <div className="fixed bottom-6 right-6 flex gap-4 pointer-events-none z-[160]">
        <div className="pointer-events-auto flex gap-4">
          {urgentes.length > 0 && <MiniPanel title="Prioridade" items={urgentes} color="bg-red-600" icon={<Star size={14}/>} />}
          {slaVermelho.length > 0 && <MiniPanel title="Estourado" items={slaVermelho} color="bg-red-950" icon={<ShieldAlert size={14}/>} />}
          {slaAmarelo.length > 0 && <MiniPanel title="Alerta 24h" items={slaAmarelo} color="bg-yellow-500" icon={<Clock size={14}/>} darkText={true} />}
        </div>
      </div>
    </div>
  );
}

function MiniPanel({ title, items, color, icon, darkText = false }) {
  const nodeRef = useRef(null);
  return (
    <DraggablePopup nodeRef={nodeRef} handle=".handle">
      <div ref={nodeRef} className="w-64 bg-slate-900 rounded-2xl shadow-2xl border-2 border-slate-800 overflow-hidden">
        <div className={`handle ${color} p-2 flex items-center justify-between cursor-grab active:cursor-grabbing ${darkText ? 'text-slate-900' : 'text-white'} font-black text-[10px] uppercase`}>
          <span>{title}</span> {icon}
        </div>
        <div className="p-2 max-h-32 overflow-y-auto space-y-1">
          {items.map(t => (
            <div key={t.id} className="text-[9px] font-bold border-b border-slate-800 pb-1 truncate last:border-0">
              #{t.id} - {t.subject}
            </div>
          ))}
        </div>
      </div>
    </DraggablePopup>
  );
}
