import React, { useState } from 'react';
import { auth } from './firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  signInWithPopup, 
  GoogleAuthProvider 
} from 'firebase/auth';
import { Lock, Chrome, Info } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');

  const handleAuth = async () => {
    try {
      // Tenta logar
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      // Se não existir, cadastra automaticamente
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        try {
          await createUserWithEmailAndPassword(auth, email, password);
        } catch (err) { setMsg("Erro ao criar conta: " + err.message); }
      } else { setMsg("Erro: " + error.message); }
    }
  };

  const handleReset = () => {
    if (!email) return setMsg("Digite o e-mail primeiro!");
    sendPasswordResetEmail(auth, email).then(() => setMsg("E-mail de recuperação enviado!"));
  };

  const loginGoogle = () => signInWithPopup(auth, new GoogleAuthProvider());

  return (
    <div className="h-screen w-full flex items-center justify-center bg-slate-900 px-4">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-2xl">
        <div className="text-center mb-6 italic font-black text-blue-600 text-3xl tracking-tighter">KS PRO</div>
        
        <div className="space-y-4">
          <input type="email" placeholder="E-mail" className="w-full p-4 bg-slate-100 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500" onChange={(e) => setEmail(e.target.value)} />
          <input type="password" placeholder="Senha" className="w-full p-4 bg-slate-100 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500" onChange={(e) => setPassword(e.target.value)} />
          
          <button onClick={handleAuth} className="w-full bg-blue-600 text-white p-4 rounded-xl font-black uppercase shadow-lg hover:bg-blue-700 transition-all">Entrar ou Cadastrar</button>
          
          <div className="flex justify-between px-2">
            <button onClick={handleReset} className="text-[10px] font-bold text-slate-400 hover:text-blue-500 uppercase">Esqueci a Senha</button>
            <button onClick={loginGoogle} className="text-[10px] font-bold text-slate-400 hover:text-blue-500 uppercase flex items-center gap-1"><Chrome size={10}/> Google Login</button>
          </div>
          
          {msg && <div className="mt-4 p-3 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-lg flex items-center gap-2"><Info size={14}/> {msg}</div>}
        </div>
      </div>
    </div>
  );
}