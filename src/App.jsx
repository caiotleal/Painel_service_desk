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
  deleteDoc,
  addDoc 
} from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { Star, Moon, Sun, Bell, ChevronDown, ExternalLink, Settings, ShieldAlert, Clock, PlayCircle } from 'lucide-react';
import Login from './Login';

const COLUNAS = [
  { id: 'Sustentação', tipo: 'backlog', largura: 'w-64' },
  { id: 'Suporte Admin', tipo: 'backlog', largura: 'w-64' },
  { id: 'Teste', tipo: 'action', largura: 'flex-1 min-w-[350px]' },
  { id: 'Retorno de Teste', tipo: 'action', largura: 'flex-1 min-w-[350px]' },
  { id: 'Aguardando PR', tipo: 'action', largura: 'flex-1 min-w-[350px]' }
];

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

  // --- FUNÇÃO PARA CRIAR TICKETS DE TESTE ---
  const gerarTicketsTeste = async () => {
    const agora = new Date();
    const mockTickets = [
      { id: "101", subject: "SLA Vencido (Vermelho)", due_by: new Date(agora.getTime() - 3600000).toISOString(), group: "Sustentação", status: "aberto" },
      { id: "102", subject: "SLA em Alerta (Amarelo)", due_by: new Date(agora.getTime() + 2 * 3600000).toISOString(), group: "Sustentação", status: "aberto" },
      { id: "103", subject: "SLA em Dia (Verde)", due_by: new Date(agora.getTime() + 48 * 3600000).toISOString(), group: "Suporte Admin", status: "aberto" }
    ];

    for (const t of mockTickets) {
      await setDoc(doc(db, "tickets", t.id), t);
    }
    alert("Tickets de teste criados no Firestore!");
  };

  const handleLogout = async () => {
    if (user) {
      try {
        await deleteDoc(doc(db, "presenca", user.uid));
        await signOut(auth);
      } catch (e) { await signOut(auth); }
    }
  };

  // --- LÓGICA DE SLA AJUSTADA ---
  const checkSLA = (ticket) => {
    const dataRaw = ticket.due_by || ticket['Resolução Devida'] || ticket.fr_due_by;
    if (!dataRaw) return 'sem-prazo';

    let prazo;
    if (dataRaw?.toDate) prazo = dataRaw.toDate().getTime();
    else prazo = new Date(dataRaw).getTime();

    if (isNaN(prazo)) return 'sem-prazo';

    const agora = new Date().getTime();
    const diferencaHoras = (prazo - agora) / (1000 * 60 * 60);

    if (diferencaHoras < 0) return 'vencido';     // Vermelho
    if (diferencaHoras <= 24) return 'alerta';    // Amarelo (Até 24h)
    return 'em-dia';                              // Verde
  };

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const pRef = doc(db, "presenca", u.uid);
        await setDoc(pRef, { nome: u.displayName || u.email.split('@')[0], email: u.email, online: true, uid: u.uid }, { merge: true });
      } else { setUser(null); }
    });
    return unsubAuth;
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubT = onSnapshot(collection(db, "tickets"), (snap) => {
      const data = snap.docs.map(d => ({ ...d.data(), id: String(d.data().id || d.id) }));
      // Filtramos apenas abertos para o painel não ficar poluído
      setTickets(data.filter(t => ["aberto", "open", ""].includes(String(t.status || "").toLowerCase())));
    });

    onSnapshot(collection(db, "presenca"), (snap) => {
      setAnalistas(snap.docs.map(d => d.data()));
    });
    return () => unsubT();
  }, [user]);

  const onDragEnd = async (res) => {
    if (!res.destination) return;
    const tId = String(res.draggableId.split('-')[0]);
    const colDest = COLUNAS.find(c => c.id === res.destination.droppableId);
    
    if (colDest.tipo === 'action') {
      await updateDoc(doc(db, "tickets", tId), { 
        fluxo_ativo: true, 
        status_interno: colDest.id, 
        updated_by: user.displayName || user.email.split('@')[0] 
      });
    } else {
      await updateDoc(doc(db, "tickets", tId), { fluxo_ativo: false, status_interno: null });
    }
  };

  if (!user) return <Login />;

  const urgentes = tickets.filter(t => t.prioridade_painel);
  const slaAmarelo = tickets.filter(t => checkSLA(t) === 'alerta');
  const slaVermelho = tickets.filter(t => checkSLA(t) === 'vencido');

  return (
    <div className={`${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} h-screen w-full flex flex-col overflow-hidden font-sans`}>
      <header className={`${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} h-16 border-b px-6 flex justify-between items-center z-[100] shrink-0`}>
        <div className="flex items-center gap-8">
          <div className="flex items-baseline gap-2">
            <h1 className="font-black text-2xl italic tracking-tighter text-blue-600 font-mono">KS PRO</h1>
            <span className="text-[10px] font-bold text-slate-500">v2.3 - TEST MODE</span>
          </div>
          <button onClick={gerarTicketsTeste} className="flex items-center gap-2 bg-blue-600/10 text-blue-500 px-3 py-1 rounded-full text-[10px] font-black hover:bg-blue-600 hover:text-white transition-all">
            <PlayCircle size={14}/> GERAR TICKETS DE TESTE
          </button>
        </div>
        
        <div className="flex items-center gap-4">
          <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-xl bg-slate-800/10 dark:bg-slate-800 transition-all hover:scale-110">
            {darkMode ? <Sun size={18}/> : <Moon size={18}/>}
          </button>
          <div className="relative">
            <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 rounded-xl bg-slate-800/10 dark:bg-slate-800 transition-all hover:scale-110"><Settings size={18} /></button>
            {menuOpen && (
              <div className="absolute right-0 top-12 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-2 z-[210] animate-in fade-in zoom-in-95">
                <button onClick={() => setNotificacoesAtivas(!notificacoesAtivas)} className={`w-full text-left px-3 py-2 rounded-lg text-[11px] font-bold flex items-center justify-between ${notificacoesAtivas ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                  <span>Notificações Teams</span>
                  <div className={`w-2 h-2 rounded-full ${notificacoesAtivas ? 'bg-green-500' : 'bg-red-500'}`}></div>
                </button>
              </div>
            )}
          </div>
          <button onClick={handleLogout} className="text-[10px] font-black uppercase text-slate-400 hover:text-red-500 border border-slate-700/30 px-3 py-1.5 rounded-lg transition-all">Sair</button>
        </div>
      </header>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex-1 flex gap-4 p-4 overflow-x-auto items-start bg-transparent">
          {COLUNAS.map(col => {
            const list = tickets.filter(t => col.id === (col.tipo === 'backlog' ? t.group : t.status_interno));
            return (
              <div key={col.id} className={`${col.largura} flex flex-col h-full`}>
                <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 px-2 flex justify-between">
                  {col.id} <span className="text-blue-500 bg-blue-500/10 px-2 rounded-full">{list.length}</span>
                </h2>
                <Droppable droppableId={col.id}>
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="flex-1 overflow-y-auto p-2 space-y-3 scrollbar-hide pb-24 min-h-[150px] bg-slate-500/5 rounded-2xl">
                      {list.map((t, index) => {
                        const sla = checkSLA(t);
                        const isExpanded = (hoveredCard === t.id || fixedCards[t.id]);
                        return (
                          <Draggable key={`${t.id}-${col.id}`} draggableId={`${t.id}-${col.id}`} index={index}>
                            {(p) => (
                              <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps} 
                                className={`relative p-4 rounded-xl shadow-md border transition-all duration-300 ${darkMode ? 'bg-slate-800' : 'bg-white'} 
                                ${sla === 'vencido' ? 'border-l-4 border-l-red-600' : sla === 'alerta' ? 'border-l-4 border-l-yellow-500' : sla === 'em-dia' ? 'border-l-4 border-l-green-500' : 'border-l-4 border-slate-700'} 
                                ${isExpanded ? 'z-[105] ring-2 ring-blue-500' : 'z-10'}`}>
                                
                                <div className="flex justify-between items-start">
                                  <div className="flex flex-col gap-1 overflow-hidden">
                                    <span className="text-[9px] font-bold text-blue-500 font-mono">#{t.id}</span>
                                    <h3 className={`text-[12px] font-bold leading-tight ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>{t.subject}</h3>
                                  </div>
                                  <div className="flex flex-col items-end gap-2">
                                    <Star size={16} fill={t.prioridade_painel ? "#ef4444" : "none"} className={t.prioridade_painel ? "text-red-500" : "text-slate-600"} />
                                    {t.updated_by && <span className="text-[7px] bg-blue-500/20 text-blue-400 px-1 rounded uppercase font-black">{t.updated_by}</span>}
                                  </div>
                                </div>

                                <div className="mt-3 flex gap-2">
                                   <div onClick={() => setFixedCards(prev => ({ ...prev, [t.id]: !prev[t.id] }))} className="cursor-pointer text-[8px] font-black uppercase bg-slate-700/50 px-2 py-1 rounded hover:bg-blue-600 transition-colors">
                                      {fixedCards[t.id] ? 'Fixado' : 'Detalhes'}
                                   </div>
                                   <a href={`https://engage-bz.freshdesk.com/a/tickets/${t.id}`} target="_blank" className="text-[8px] font-black uppercase bg-blue-600/20 text-blue-400 px-2 py-1 rounded">Abrir</a>
                                </div>

                                {isExpanded && (
                                  <div className={`absolute left-0 top-[95%] w-full p-4 rounded-b-xl shadow-2xl border border-t-0 z-[110] ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                                    <div className="space-y-2 text-[10px]">
                                       <div className="flex flex-col"><span className="text-blue-500 font-black text-[7px] uppercase">Prazo</span><span>{t.due_by ? new Date(t.due_by).toLocaleString() : 'Sem prazo'}</span></div>
                                       <div className="flex flex-col"><span className="text-blue-500 font-black text-[7px] uppercase">Grupo</span><span>{t.group || 'N/A'}</span></div>
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

      {/* QUADROS FLUTUANTES (Z-INDEX SUPERIOR) */}
      <div className="pointer-events-none fixed inset-0 z-[200]">
        <div className="pointer-events-auto flex gap-4 absolute bottom-6 right-6">
          {urgentes.length > 0 && <Panel title="Prioridade" items={urgentes} color="bg-red-600" icon={<Star size={14}/>} />}
          {slaVermelho.length > 0 && <Panel title="Estourado" items={slaVermelho} color="bg-red-900" icon={<ShieldAlert size={14}/>} />}
          {slaAmarelo.length > 0 && <Panel title="Atenção" items={slaAmarelo} color="bg-yellow-500" icon={<Clock size={14}/>} textColor="text-slate-900" />}
        </div>
      </div>
    </div>
  );
}

// Componente auxiliar para os mini-painéis
function Panel({ title, items, color, icon, textColor = "text-white" }) {
  const nodeRef = useRef(null);
  return (
    <DraggablePopup nodeRef={nodeRef} handle=".handle">
      <div ref={nodeRef} className={`w-64 rounded-2xl shadow-2xl border-2 border-slate-800 overflow-hidden bg-slate-900`}>
        <div className={`handle ${color} ${textColor} p-2 flex items-center justify-between cursor-grab active:cursor-grabbing font-black text-[10px] uppercase`}>
          <span>{title}</span> {icon}
        </div>
        <div className="p-2 max-h-32 overflow-y-auto">
          {items.map(t => (
            <div key={t.id} className="text-[9px] py-1 border-b border-slate-800 last:border-0 truncate font-bold">
              #{t.id} - {t.subject}
            </div>
          ))}
        </div>
      </div>
    </DraggablePopup>
  );
}
