import React, { useState } from 'react';
import { Wallet, LogIn, UserPlus, AlertTriangle } from 'lucide-react';
import { login, signup } from './auth.js';

export default function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [pseudo, setPseudo] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const switchMode = (m) => {
    setMode(m);
    setError('');
    setConfirm('');
  };

  const submit = async () => {
    setError('');
    if (!pseudo.trim() || !password) {
      setError('Renseigne un pseudo et un mot de passe.');
      return;
    }
    if (mode === 'signup' && password !== confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setBusy(true);
    const result = mode === 'login' ? await login(pseudo, password) : await signup(pseudo, password);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onAuthenticated(result.pseudo);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <span className="grid place-items-center w-14 h-14 rounded-2xl bg-slate-900 ring-1 ring-slate-900/10 mb-3">
            <Wallet className="w-7 h-7 text-emerald-300" />
          </span>
          <h1 className="text-xl font-semibold text-slate-800">Mon Budget</h1>
          <p className="text-sm text-slate-400 mt-1 text-center">
            Chaque pseudo a ses propres données, enregistrées uniquement sur cet appareil.
          </p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 mb-4">
            <button
              onClick={() => switchMode('login')}
              className={'py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition-colors motion-reduce:transition-none ' +
                (mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}>
              <LogIn className="w-4 h-4" /> Se connecter
            </button>
            <button
              onClick={() => switchMode('signup')}
              className={'py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition-colors motion-reduce:transition-none ' +
                (mode === 'signup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}>
              <UserPlus className="w-4 h-4" /> Créer un compte
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Pseudo</label>
              <input
                type="text" autoFocus placeholder="ex : Jordansad" value={pseudo}
                onChange={e => setPseudo(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && mode === 'login') submit(); }}
                className="w-full text-sm px-3 py-2 rounded-xl bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-slate-900 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Mot de passe</label>
              <input
                type="password" placeholder="••••••••" value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && mode === 'login') submit(); }}
                className="w-full text-sm px-3 py-2 rounded-xl bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-slate-900 outline-none"
              />
            </div>
            {mode === 'signup' && (
              <div>
                <label className="block text-xs text-slate-500 mb-1">Confirmer le mot de passe</label>
                <input
                  type="password" placeholder="••••••••" value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') submit(); }}
                  className="w-full text-sm px-3 py-2 rounded-xl bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-slate-900 outline-none"
                />
              </div>
            )}

            {error && (
              <p className="text-xs text-rose-500 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}
              </p>
            )}

            <button
              onClick={submit}
              disabled={busy}
              className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-medium flex items-center justify-center gap-1.5 hover:bg-slate-800 active:scale-[.99] transition motion-reduce:transition-none disabled:opacity-60">
              {mode === 'login' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              {busy ? 'Un instant…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
