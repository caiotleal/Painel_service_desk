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
import { Star, Moon, Sun, Bell, ChevronDown, ExternalLink } from 'lucide-react';
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
  const nodeRef = useRef(null);

  // 1. GESTÃO DE LOGOUT COM LIMPEZA OBRIGATÓRIA
  const handleLogout = async () => {
    if (user) {
      try {
        // Primeiro limpamos a posição na coleção 'presenca'
        const pRef = doc(db, "presenca", user.uid);
        await deleteDoc(pRef);
        
        // Somente após o retorno OK do banco, deslogamos
        await signOut(auth);
      } catch (err) {
        console.error("Erro ao limpar sessão:", err);
        // Em caso de erro crítico, desloga de qualquer forma para não travar o UI
        await signOut(auth);
      }
    }
  };

  // 2. MONITORAMENTO DE PRESENÇA E FECHAMENTO DE ABA
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const pRef = doc(db, "presenca", u.uid);
        
        // Registra presença ao entrar
        await setDoc(pRef, { 
          nome: u.displayName || u.email.split('@')[0], 
          online: true, 
          uid: u.uid 
        }, { merge: true });

        // Tenta limpar caso feche o navegador direto
        const handleUnload = () => {
          deleteDoc(pRef);
        };
        window.addEventListener('beforeunload', handleUnload);
        return () => window.removeEventListener('beforeunload', handleUnload);
      } else {
        setUser(null);
      }
    });
    return unsubAuth;
  }, []);

  // 3. SINCRONIZAÇÃO EM TEMPO REAL
  useEffect(() => {
    if (!user) return;
    const unsubT = onSnapshot(collection(db, "tickets"), (snap) => {
      setTickets(snap.docs.map(d => ({ ...d.data(), id: String(d.id) })));
    });
    const unsubP = onSnapshot(collection(db, "presenca"), (snap) => {
      setAnalistas(snap.docs.map(d => d.data()));
    });
    return () => { unsubT(); unsubP(); };
  }, [user]);

  // Lógica de Movimentação (Sistema de Clones)
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
      await updateDoc(doc(db, "tickets", tId), {
        fluxo_ativo: false,
        status_interno: null
      });
    }
  };

  if (!user) return <Login />;

  const urgentes = tickets.filter(t => t.prioridade_painel);

  return (
    <div className={`${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} h-screen w-full flex flex-col overflow-hidden font-sans transition-colors duration-300`}>
      
      <header className={`${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} h-16 border-b px-6 flex justify-between items-center z-50 shrink-0`}>
        <div className="flex items-center gap-8">
          <h1 className="font-black text-2xl italic tracking-tighter text-blue-600 font-mono">KS PRO 1.3</h1>
          
          <div className="flex -space-x-2">
            {analistas.map((a) => (
              <div key={a.uid} className="group relative">
                <div className="w-8 h-8 rounded-full bg-blue-600 border-2 border-slate-900 flex items-center justify-center text-[10px] text-white font-black uppercase cursor-help shadow-lg">
                  {a.nome?.substring(0,2)}
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-slate-900 rounded-full"></span>
                </div>
                <div className="absolute top-10 left-0 hidden group-hover:block bg-slate-800 border border-slate-700 p-2 rounded-lg shadow-2xl z-[200] w-40">
                  <span className="text-white font-bold text-[10px]">{a.nome}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-xl bg-slate-800/10 dark:bg-slate-800 transition-transform hover:scale-110">
            {darkMode ? <Sun size={18}/> : <Moon size={18}/>}
          </button>
          <div className="flex flex-col items-end mr-2">
             <span className="text-[10px] font-bold text-blue-500 uppercase leading-none">{user.displayName || user.email.split('@')[0]}</span>
             <button onClick={handleLogout} className="text-[9px] font-black text-slate-500 hover:text-red-500 uppercase transition-colors">Sair</button>
          </div>
        </div>
      </header>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex-1 flex gap-4 p-4 overflow-x-auto items-start">
          {COLUNAS.map(col => {
            const list = tickets.filter(t => 
              col.tipo === 'backlog' 
                ? t.group === col.id 
                : (t.fluxo_ativo && t.status_interno === col.id)
            );

            return (
              <div key={col.id} className={`${col.largura} flex flex-col h-full`}>
                <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 px-2 flex justify-between italic">
                  {col.id} <span className="text-blue-500 font-mono">{list.length}</span>
                </h2>
                <Droppable droppableId={col.id}>
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="flex-1 overflow-y-auto p-2 space-y-3 scrollbar-hide pb-24">
                      {list.map((t, index) => (
                        <Draggable key={`${t.id}-${col.id}`} draggableId={`${t.id}-${col.id}`} index={index}>
                          {(p) => (
                            <div 
                              ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps} 
                              className={`relative p-4 rounded-xl shadow-md border transition-all duration-300 ${darkMode ? 'bg-slate-800 border-slate-700/50' : 'bg-white border-slate-200'}`}>
                              <div className="flex justify-between items-start">
                                <div className="flex flex-col gap-0.5 overflow-hidden w-full">
                                  <a href={`https://engage-bz.freshdesk.com/a/tickets/${t.id}`} target="_blank" rel="noopener noreferrer" className="text-[9px] font-bold text-blue-500 font-mono hover:underline flex items-center gap-1">
                                    #{t.id} <ExternalLink size={8}/>
                                  </a>
                                  <h3 className="text-[12px] font-bold truncate leading-tight">{t.subject}</h3>
                                  {col.tipo === 'action' && t.updated_by && (
                                    <span className="text-[8px] font-black text-blue-400 uppercase mt-1">Por: {t.updated_by}</span>
                                  )}
                                </div>
                                <button onClick={() => updateDoc(doc(db, "tickets", t.id), { prioridade_painel: !t.prioridade_painel })}>
                                  <Star size={16} fill={t.prioridade_painel ? "#ef4444" : "none"} className={t.prioridade_painel ? "text-red-500" : "text-slate-500"} />
                                </button>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {urgentes.length > 0 && (
        <DraggablePopup nodeRef={nodeRef} handle=".handle">
          <div ref={nodeRef} className="fixed bottom-10 right-10 w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border-2 border-red-600 overflow-hidden z-[200]">
            <div className="handle bg-red-600 p-3 flex items-center justify-between cursor-grab text-white font-black text-[10px] uppercase">
              <span>Urgência Ativa</span>
              <Bell size={14} className="animate-bounce"/>
            </div>
            <div className="p-3 max-h-40 overflow-y-auto space-y-2 dark:bg-slate-800">
              {urgentes.map(t => (
                <div key={t.id} className="text-[9px] font-bold border-b border-slate-700/30 pb-1 last:border-0 truncate flex justify-between">
                   <a href={`https://engage-bz.freshdesk.com/a/tickets/${t.id}`} target="_blank" rel="noopener noreferrer" className="hover:underline">{t.subject}</a>
                </div>
              ))}
            </div>
          </div>
        </DraggablePopup>
      )}
    </div>
  );
}