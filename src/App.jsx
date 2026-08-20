import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Wallet, Plus, Trash2, Settings as SettingsIcon, Target, PiggyBank,
  X, Check, ArrowUpRight, ArrowDownRight, Home, PieChart as PieIcon,
  AlertTriangle, TrendingUp, TrendingDown, Pencil, LogOut,
  History as HistoryIcon, ChevronDown, ChevronRight, Calculator
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import AuthScreen from './AuthScreen.jsx';
import { getSession, logout, dataKeyFor } from './auth.js';

/* ------------------------------------------------------------------ *
 *  Données de référence
 * ------------------------------------------------------------------ */
const EXPENSE_CATS = [
  { key: 'alimentation', label: 'Alimentation', emoji: '🍽️', color: '#059669' },
  { key: 'transport',    label: 'Transport',    emoji: '🚗', color: '#0ea5e9' },
  { key: 'logement',     label: 'Logement',     emoji: '🏠', color: '#7c3aed' },
  { key: 'factures',     label: 'Factures',     emoji: '🧾', color: '#e11d48' },
  { key: 'sante',        label: 'Santé',        emoji: '⚕️', color: '#f59e0b' },
  { key: 'loisirs',      label: 'Loisirs',      emoji: '🎮', color: '#14b8a6' },
  { key: 'vetements',    label: 'Vêtements',    emoji: '👕', color: '#6366f1' },
  { key: 'education',    label: 'Éducation',    emoji: '📚', color: '#ec4899' },
  { key: 'autre_dep',    label: 'Autre',        emoji: '📦', color: '#64748b' },
];
const INCOME_CATS = [
  { key: 'salaire',   label: 'Salaire',   emoji: '💰' },
  { key: 'freelance', label: 'Freelance', emoji: '💻' },
  { key: 'bourse',    label: 'Bourse',    emoji: '🎓' },
  { key: 'cadeau',    label: 'Cadeau',    emoji: '🎁' },
  { key: 'vente',     label: 'Vente',     emoji: '🛒' },
  { key: 'autre_rev', label: 'Autre',     emoji: '➕' },
];
const ALL_CATS = [...EXPENSE_CATS, ...INCOME_CATS];
const catOf = (key) => ALL_CATS.find(c => c.key === key) || { label: 'Autre', emoji: '📦', color: '#64748b' };

const GOAL_EMOJIS = ['🎯', '🏦', '✈️', '💻', '🏠', '🚗', '🎓', '📱', '🎁', '🛡️'];

const CURRENCY_PRESETS = [
  { symbol: 'FCFA', decimals: 0, position: 'after' },
  { symbol: '€',    decimals: 2, position: 'after' },
  { symbol: '$',    decimals: 2, position: 'before' },
];

// Nombre maximum de mois d'historique conservés, pour ne pas saturer le stockage local.
const HISTORY_MONTHS = 24;

const DEFAULT_DATA = {
  initialBalance: 0,
  transactions: [],
  goals: [],
  budgets: {},
  settings: { currency: { symbol: 'FCFA', decimals: 0, position: 'after' } },
};

/* ------------------------------------------------------------------ *
 *  Helpers
 * ------------------------------------------------------------------ */
const todayISO = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};
const monthKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}`; };
const nowMonthKey = () => monthKey(new Date());
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// Nombre de mois calendaires entre deux dates (b - a).
const monthsBetween = (a, b) => {
  const da = new Date(a), db = new Date(b);
  return (db.getFullYear() - da.getFullYear()) * 12 + (db.getMonth() - da.getMonth());
};
// Ne garde que les opérations des HISTORY_MONTHS derniers mois (glissant).
const pruneOldTransactions = (transactions) => {
  const now = new Date();
  return transactions.filter(t => monthsBetween(t.date, now) < HISTORY_MONTHS);
};

const fmtDate = (d) =>
  new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(new Date(d));

function makeFormatter(currency) {
  return (value) => {
    const n = Number(value) || 0;
    const s = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: currency.decimals,
      maximumFractionDigits: currency.decimals,
    }).format(Math.abs(n));
    const sign = n < 0 ? '-' : '';
    return currency.position === 'before'
      ? `${sign}${currency.symbol}${s}`
      : `${sign}${s} ${currency.symbol}`;
  };
}

/* ------------------------------------------------------------------ *
 *  Persistance — localStorage (fonctionne hors ligne, entre sessions)
 *  Une clé distincte par pseudo : chaque compte a ses propres données.
 * ------------------------------------------------------------------ */
function loadData(storageKey) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Lecture des données impossible', e);
  }
  return null;
}
function saveData(storageKey, data) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(data));
  } catch (e) {
    console.error('Sauvegarde impossible', e);
  }
}

/* ------------------------------------------------------------------ *
 *  Racine : gère l'authentification puis affiche l'app du compte connecté
 * ------------------------------------------------------------------ */
export default function App() {
  const [pseudo, setPseudo] = useState(() => getSession());

  if (!pseudo) {
    return <AuthScreen onAuthenticated={setPseudo} />;
  }

  return (
    <Budget
      key={pseudo}
      pseudo={pseudo}
      onLogout={() => { logout(); setPseudo(null); }}
    />
  );
}

/* ------------------------------------------------------------------ *
 *  Composant principal (budget d'un compte connecté)
 * ------------------------------------------------------------------ */
function Budget({ pseudo, onLogout }) {
  const storageKey = dataKeyFor(pseudo);
  const [data, setData] = useState(DEFAULT_DATA);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('accueil');
  const [modal, setModal] = useState(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    const loaded = loadData(storageKey);
    if (loaded) {
      setData({
        ...DEFAULT_DATA,
        ...loaded,
        transactions: pruneOldTransactions(loaded.transactions || []),
        settings: { ...DEFAULT_DATA.settings, ...(loaded.settings || {}) },
      });
    }
    loadedRef.current = true;
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!loadedRef.current) return;
    saveData(storageKey, data);
  }, [data, storageKey]);

  const currency = data.settings.currency;
  const money = useMemo(() => makeFormatter(currency), [currency]);

  // Tri unique (plus récent en premier) réutilisé par l'accueil et l'historique.
  const sortedTransactions = useMemo(
    () => [...data.transactions].sort((a, b) => new Date(b.date) - new Date(a.date)),
    [data.transactions]
  );

  /* ---------- calculs automatiques ---------- */
  const totals = useMemo(() => {
    let income = 0, expense = 0, mIncome = 0, mExpense = 0;
    const mk = nowMonthKey();
    const byCat = {};
    for (const t of data.transactions) {
      const amt = Number(t.amount) || 0;
      if (t.type === 'income') { income += amt; if (monthKey(t.date) === mk) mIncome += amt; }
      else {
        expense += amt;
        if (monthKey(t.date) === mk) { mExpense += amt; byCat[t.cat] = (byCat[t.cat] || 0) + amt; }
      }
    }
    const saved = data.goals.reduce((s, g) => s + (Number(g.current) || 0), 0);
    const initialBalance = Number(data.initialBalance) || 0;
    const patrimoine = initialBalance + income - expense;   // valeur nette totale
    const solde = patrimoine - saved;       // disponible à dépenser
    return { income, expense, mIncome, mExpense, saved, patrimoine, solde, byCat, initialBalance };
  }, [data]);

  /* ---------- actions ---------- */
  const addTransaction = (t) =>
    setData(d => ({
      ...d,
      transactions: pruneOldTransactions([{ id: uid(), ...t }, ...d.transactions]),
    }));

  const removeTransaction = (id) =>
    setData(d => ({ ...d, transactions: d.transactions.filter(x => x.id !== id) }));

  const updateTransaction = (id, updates) =>
    setData(d => ({
      ...d,
      transactions: d.transactions.map(t => t.id === id ? { ...t, ...updates } : t),
    }));

  const setBudget = (cat, amount) =>
    setData(d => ({ ...d, budgets: { ...d.budgets, [cat]: amount } }));

  const addGoal = (g) =>
    setData(d => ({ ...d, goals: [...d.goals, { id: uid(), current: 0, history: [], ...g }] }));

  const removeGoal = (id) =>
    setData(d => ({ ...d, goals: d.goals.filter(x => x.id !== id) }));

  const adjustGoal = (id, delta) =>
    setData(d => ({
      ...d,
      goals: d.goals.map(g => {
        if (g.id !== id) return g;
        const current = Math.max(0, (Number(g.current) || 0) + delta);
        const op = { id: uid(), type: delta >= 0 ? 'add' : 'withdraw', amount: Math.abs(delta), date: todayISO() };
        return { ...g, current, history: [op, ...(g.history || [])] };
      }),
    }));

  const setCurrency = (c) =>
    setData(d => ({ ...d, settings: { ...d.settings, currency: c } }));

  const setInitialBalance = (amount) =>
    setData(d => ({ ...d, initialBalance: amount }));

  const resetAll = () => { setData(DEFAULT_DATA); setModal(null); setTab('accueil'); };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-slate-400 text-sm animate-pulse">Chargement de tes finances…</div>
      </div>
    );
  }

  const tabs = [
    { key: 'accueil', label: 'Accueil', icon: Home },
    { key: 'analyse', label: 'Analyse', icon: PieIcon },
    { key: 'epargne', label: 'Épargne', icon: PiggyBank },
    { key: 'historique', label: 'Historique', icon: HistoryIcon },
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans">
      <style>{`
        .no-scrollbar::-webkit-scrollbar{display:none}
        .no-scrollbar{-ms-overflow-style:none;scrollbar-width:none}
      `}</style>

      {/* ---------- En-tête ---------- */}
      <header className="sticky top-0 z-20 bg-slate-900 text-white pt-[env(safe-area-inset-top)]">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid place-items-center w-8 h-8 rounded-xl bg-emerald-500/20 ring-1 ring-emerald-400/30">
              <Wallet className="w-4 h-4 text-emerald-300" />
            </span>
            <div className="leading-tight">
              <div className="font-semibold tracking-tight">Mon Budget</div>
              <div className="text-[11px] text-slate-400">{pseudo} · {money(totals.patrimoine)}</div>
            </div>
          </div>
          <button
            onClick={() => setModal({ type: 'settings' })}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors motion-reduce:transition-none"
            aria-label="Réglages">
            <SettingsIcon className="w-5 h-5 text-slate-300" />
          </button>
        </div>

        {/* ---------- Onglets ---------- */}
        <div className="max-w-xl mx-auto px-4">
          <div className="grid grid-cols-4 gap-1 pb-2">
            {tabs.map(({ key, label, icon: Icon }) => {
              const active = tab === key;
              return (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={
                    'flex items-center justify-center gap-1 py-2 rounded-lg text-[11px] xs:text-xs sm:text-sm font-medium transition-colors motion-reduce:transition-none ' +
                    (active ? 'bg-white text-slate-900' : 'text-slate-300 hover:bg-white/10')
                  }>
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 pt-4 pb-[calc(6rem+env(safe-area-inset-bottom))]">
        {tab === 'accueil' && (
          <Accueil
            totals={totals} money={money}
            transactions={sortedTransactions}
            onAdd={addTransaction} onRemove={removeTransaction}
            onEdit={(t) => setModal({ type: 'editTx', tx: t })}
            onEditBalance={() => setModal({ type: 'initBalance' })}
          />
        )}
        {tab === 'analyse' && (
          <Analyse
            totals={totals} money={money}
            budgets={data.budgets} onSetBudget={setBudget}
          />
        )}
        {tab === 'epargne' && (
          <Epargne
            goals={data.goals} money={money} solde={totals.solde} saved={totals.saved}
            onOp={(goal, mode) => setModal({ type: 'goalOp', goal, mode, amount: '' })}
            onAdd={() => setModal({ type: 'addGoal' })}
            onRemove={removeGoal}
          />
        )}
        {tab === 'historique' && (
          <Historique
            transactions={sortedTransactions} money={money} onRemove={removeTransaction}
            onEdit={(t) => setModal({ type: 'editTx', tx: t })}
          />
        )}
      </main>

      {/* ---------- Modales ---------- */}
      {modal?.type === 'settings' && (
        <SettingsModal
          currency={currency} onCurrency={setCurrency}
          onReset={resetAll} onClose={() => setModal(null)}
          pseudo={pseudo} onLogout={onLogout}
        />
      )}
      {modal?.type === 'initBalance' && (
        <InitBalanceModal
          initialBalance={totals.initialBalance} money={money}
          onClose={() => setModal(null)}
          onConfirm={(amt) => { setInitialBalance(amt); setModal(null); }}
        />
      )}
      {modal?.type === 'addGoal' && (
        <AddGoalModal onClose={() => setModal(null)} onCreate={(g) => { addGoal(g); setModal(null); }} />
      )}
      {modal?.type === 'goalOp' && (
        <GoalOpModal
          goal={modal.goal} mode={modal.mode} money={money} solde={totals.solde}
          onClose={() => setModal(null)}
          onConfirm={(amt) => {
            adjustGoal(modal.goal.id, modal.mode === 'add' ? amt : -amt);
            setModal(null);
          }}
        />
      )}
      {modal?.type === 'editTx' && (
        <EditTransactionModal
          tx={modal.tx} money={money}
          onClose={() => setModal(null)}
          onSave={(updates) => { updateTransaction(modal.tx.id, updates); setModal(null); }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Onglet Accueil
 * ------------------------------------------------------------------ */
function Accueil({ totals, money, transactions, onAdd, onRemove, onEdit, onEditBalance }) {
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [cat, setCat] = useState('alimentation');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayISO());

  const cats = type === 'expense' ? EXPENSE_CATS : INCOME_CATS;
  const negative = totals.solde < 0;

  const submit = () => {
    const amt = Math.abs(parseFloat(amount));
    if (!amt || isNaN(amt)) return;
    onAdd({ type, amount: amt, cat, note: note.trim(), date });
    setAmount(''); setNote('');
  };

  const switchType = (t) => {
    setType(t);
    setCat(t === 'expense' ? 'alimentation' : 'salaire');
  };

  const recent = transactions.slice(0, 8);

  return (
    <div className="space-y-4">
      {/* Carte solde */}
      <section className="rounded-3xl p-5 bg-gradient-to-br from-slate-900 to-indigo-950 text-white shadow-lg ring-1 ring-white/10">
        <div className="flex items-center justify-between">
          <span className="text-slate-300 text-sm">Solde disponible</span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-slate-300">
            à dépenser
          </span>
        </div>
        <div className={'mt-1 font-mono font-semibold tabular-nums tracking-tight break-words ' +
          (negative ? 'text-rose-300' : 'text-white') + ' text-3xl sm:text-4xl'}>
          {money(totals.solde)}
        </div>
        {negative && (
          <div className="mt-1 flex items-center gap-1 text-rose-300 text-xs">
            <AlertTriangle className="w-3.5 h-3.5" /> Tu dépenses plus que ce que tu as.
          </div>
        )}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={onEditBalance}
            className="text-left rounded-2xl bg-white/5 ring-1 ring-white/10 p-3 hover:bg-white/10 transition-colors motion-reduce:transition-none">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Patrimoine total</span>
              <Pencil className="w-3 h-3" />
            </div>
            <div className="font-mono tabular-nums text-emerald-300 mt-0.5">{money(totals.patrimoine)}</div>
          </button>
          <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-3">
            <div className="text-[11px] text-slate-400">Mis de côté</div>
            <div className="font-mono tabular-nums text-violet-300 mt-0.5">{money(totals.saved)}</div>
          </div>
        </div>
        <button
          onClick={onEditBalance}
          className="mt-2 text-xs text-slate-300 hover:text-white underline decoration-slate-500 underline-offset-2 transition-colors motion-reduce:transition-none">
          Renseigner l'argent que j'ai déjà
        </button>
      </section>

      {/* Ajout rapide */}
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 mb-3">
          <button
            onClick={() => switchType('expense')}
            className={'py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition-colors motion-reduce:transition-none ' +
              (type === 'expense' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500')}>
            <ArrowDownRight className="w-4 h-4" /> Dépense
          </button>
          <button
            onClick={() => switchType('income')}
            className={'py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition-colors motion-reduce:transition-none ' +
              (type === 'income' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500')}>
            <ArrowUpRight className="w-4 h-4" /> Revenu
          </button>
        </div>

        <label className="block text-xs text-slate-500 mb-1">Montant</label>
        <input
          type="number" inputMode="decimal" placeholder="0"
          value={amount} onChange={e => setAmount(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          className="w-full text-2xl font-mono tabular-nums font-semibold px-3 py-2 rounded-xl bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-slate-900 outline-none"
        />

        <label className="block text-xs text-slate-500 mt-3 mb-1.5">Catégorie</label>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {cats.map(c => {
            const active = cat === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setCat(c.key)}
                className={'shrink-0 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors motion-reduce:transition-none ring-1 ' +
                  (active ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-600 ring-slate-200')}>
                <span className="mr-1">{c.emoji}</span>{c.label}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-2 mt-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Note (facultatif)</label>
            <input
              type="text" placeholder="ex : courses"
              value={note} onChange={e => setNote(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded-xl bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-slate-900 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Date</label>
            <input
              type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded-xl bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-slate-900 outline-none"
            />
          </div>
        </div>

        <button
          onClick={submit}
          className="mt-3 w-full py-2.5 rounded-xl bg-slate-900 text-white font-medium flex items-center justify-center gap-1.5 hover:bg-slate-800 active:scale-[.99] transition motion-reduce:transition-none">
          <Plus className="w-4 h-4" /> Ajouter
        </button>
      </section>

      {/* Résumé du mois */}
      <section className="grid grid-cols-2 gap-3">
        <StatCard label="Revenus du mois" value={money(totals.mIncome)}
          icon={TrendingUp} tone="emerald" />
        <StatCard label="Dépenses du mois" value={money(totals.mExpense)}
          icon={TrendingDown} tone="rose" />
      </section>

      {/* Transactions récentes */}
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-slate-800">Dernières opérations</h2>
          <span className="text-xs text-slate-400">{transactions.length} au total</span>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">
            Aucune opération pour l'instant.<br />Ajoute ta première dépense ou ton premier revenu ci-dessus.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recent.map(t => {
              const c = catOf(t.cat);
              const inc = t.type === 'income';
              return (
                <li key={t.id} className="flex items-center gap-3 py-2.5">
                  <span className="grid place-items-center w-9 h-9 rounded-full bg-slate-100 text-base shrink-0">
                    {c.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-800 truncate">
                      {c.label}{t.note ? <span className="text-slate-400 font-normal"> · {t.note}</span> : null}
                    </div>
                    <div className="text-xs text-slate-400">{fmtDate(t.date)}</div>
                  </div>
                  <div className={'font-mono tabular-nums text-sm font-semibold ' + (inc ? 'text-emerald-600' : 'text-rose-600')}>
                    {inc ? '+' : '−'}{money(t.amount).replace('-', '')}
                  </div>
                  <button
                    onClick={() => onEdit(t)}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors motion-reduce:transition-none"
                    aria-label="Modifier">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onRemove(t.id)}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors motion-reduce:transition-none"
                    aria-label="Supprimer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }) {
  const tones = {
    emerald: 'text-emerald-600 bg-emerald-50',
    rose: 'text-rose-600 bg-rose-50',
  };
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center gap-2">
        <span className={'grid place-items-center w-7 h-7 rounded-lg ' + tones[tone]}>
          <Icon className="w-4 h-4" />
        </span>
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <div className="mt-2 font-mono tabular-nums font-semibold text-slate-800">{value}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Onglet Analyse
 * ------------------------------------------------------------------ */
function Analyse({ totals, money, budgets, onSetBudget }) {
  const entries = Object.entries(totals.byCat)
    .map(([key, val]) => ({ key, val, ...catOf(key) }))
    .sort((a, b) => b.val - a.val);
  const pieData = entries.map(e => ({ name: e.label, value: e.val, color: e.color }));
  const total = entries.reduce((s, e) => s + e.val, 0);

  return (
    <div className="space-y-4">
      {/* Répartition */}
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 className="font-semibold text-slate-800">Répartition des dépenses</h2>
        <p className="text-xs text-slate-400 mb-2">Ce mois-ci · {money(total)}</p>

        {entries.length === 0 ? (
          <p className="text-sm text-slate-400 py-8 text-center">
            Aucune dépense ce mois-ci.<br />Tes catégories apparaîtront ici.
          </p>
        ) : (
          <>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" innerRadius={52} outerRadius={80} paddingAngle={2} strokeWidth={0}>
                    {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-2 space-y-1.5">
              {entries.map(e => {
                const pct = total > 0 ? Math.round((e.val / total) * 100) : 0;
                return (
                  <li key={e.key} className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: e.color }} />
                    <span className="text-sm text-slate-700 flex-1 truncate">{e.emoji} {e.label}</span>
                    <span className="text-xs text-slate-400 tabular-nums">{pct}%</span>
                    <span className="font-mono tabular-nums text-sm text-slate-800 w-24 text-right">{money(e.val)}</span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      {/* Budgets */}
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 className="font-semibold text-slate-800">Budgets mensuels</h2>
        <p className="text-xs text-slate-400 mb-3">
          Fixe une limite par catégorie. Laisse à 0 pour ne pas suivre.
        </p>
        <ul className="space-y-3">
          {EXPENSE_CATS.map(c => {
            const spent = totals.byCat[c.key] || 0;
            const budget = Number(budgets[c.key]) || 0;
            const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
            const over = budget > 0 && spent > budget;
            return (
              <li key={c.key}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm text-slate-700 flex-1">{c.emoji} {c.label}</span>
                  <span className="font-mono tabular-nums text-xs text-slate-500">
                    {money(spent)}{budget > 0 ? ` / ${money(budget)}` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                    {budget > 0 && (
                      <div
                        className={'h-full rounded-full transition-all motion-reduce:transition-none ' +
                          (over ? 'bg-rose-500' : 'bg-emerald-500')}
                        style={{ width: `${pct}%` }}
                      />
                    )}
                  </div>
                  <input
                    type="number" inputMode="decimal" placeholder="budget"
                    value={budgets[c.key] ?? ''} onChange={e => onSetBudget(c.key, e.target.value)}
                    className="w-20 text-xs font-mono tabular-nums px-2 py-1 rounded-lg bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-slate-900 outline-none text-right"
                  />
                </div>
                {over && (
                  <div className="mt-1 text-[11px] text-rose-500 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Dépassé de {money(spent - budget)}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Onglet Épargne
 * ------------------------------------------------------------------ */
function Epargne({ goals, money, solde, saved, onOp, onAdd, onRemove }) {
  const [openGoal, setOpenGoal] = useState(null);

  return (
    <div className="space-y-4">
      <section className="rounded-3xl p-5 bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-lg">
        <div className="flex items-center gap-2 text-violet-100 text-sm">
          <PiggyBank className="w-4 h-4" /> Total mis de côté
        </div>
        <div className="mt-1 font-mono font-semibold tabular-nums text-3xl">{money(saved)}</div>
        <div className="mt-1 text-xs text-violet-200">
          Encore {money(solde)} disponibles à répartir.
        </div>
      </section>

      <button
        onClick={onAdd}
        className="w-full py-2.5 rounded-xl bg-white text-slate-900 font-medium flex items-center justify-center gap-1.5 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 transition-colors motion-reduce:transition-none">
        <Plus className="w-4 h-4" /> Nouvel objectif
      </button>

      {goals.length === 0 ? (
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
          <Target className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">
            Crée un objectif — un ordinateur, un voyage, un fonds d'urgence — et mets de l'argent de côté petit à petit.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {goals.map(g => {
            const cur = Number(g.current) || 0;
            const tgt = Number(g.target) || 0;
            const pct = tgt > 0 ? Math.min(100, Math.round((cur / tgt) * 100)) : 0;
            const done = tgt > 0 && cur >= tgt;
            const history = (g.history || []).slice().sort((a, b) => new Date(b.date) - new Date(a.date));
            const goalOpen = openGoal === g.id;
            return (
              <li key={g.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center gap-3">
                  <span className="grid place-items-center w-10 h-10 rounded-xl bg-violet-50 text-xl shrink-0">
                    {g.emoji || '🎯'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-800 truncate">{g.name}</div>
                    <div className="font-mono tabular-nums text-xs text-slate-500">
                      {money(cur)} / {money(tgt)}
                    </div>
                  </div>
                  <button
                    onClick={() => onRemove(g.id)}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors motion-reduce:transition-none"
                    aria-label="Supprimer l'objectif">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="mt-3 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={'h-full rounded-full transition-all motion-reduce:transition-none ' +
                      (done ? 'bg-emerald-500' : 'bg-violet-500')}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className={'text-xs font-medium ' + (done ? 'text-emerald-600' : 'text-violet-600')}>
                    {done ? '🎉 Objectif atteint !' : `${pct}%`}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onOp(g, 'add')}
                    className="py-2 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-colors motion-reduce:transition-none">
                    Mettre de côté
                  </button>
                  <button
                    onClick={() => onOp(g, 'withdraw')}
                    className="py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition-colors motion-reduce:transition-none">
                    Retirer
                  </button>
                </div>

                <button
                  onClick={() => setOpenGoal(goalOpen ? null : g.id)}
                  className="mt-3 w-full flex items-center justify-between text-xs text-slate-500 hover:text-slate-700 transition-colors motion-reduce:transition-none">
                  <span>{history.length} opération{history.length > 1 ? 's' : ''}</span>
                  {goalOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>
                {goalOpen && (
                  history.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-400">Aucune opération pour l'instant.</p>
                  ) : (
                    <ul className="mt-1 divide-y divide-slate-100 border-t border-slate-100">
                      {history.map(op => (
                        <li key={op.id} className="flex items-center justify-between py-2 text-sm">
                          <span className="text-slate-500">
                            {op.type === 'add' ? 'Mise de côté' : 'Retrait'} · {fmtDate(op.date)}
                          </span>
                          <span className={'font-mono tabular-nums font-medium ' +
                            (op.type === 'add' ? 'text-emerald-600' : 'text-rose-600')}>
                            {op.type === 'add' ? '+' : '−'}{money(op.amount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )
                )}
              </li>
            );
          })}
        </ul>
      )}

      <SavingsSimulator money={money} />
    </div>
  );
}

function SavingsSimulator({ money }) {
  const [target, setTarget] = useState('');
  const [current, setCurrent] = useState('');
  const [months, setMonths] = useState('');

  const tgt = parseFloat(target) || 0;
  const cur = parseFloat(current) || 0;
  const dur = parseInt(months, 10) || 0;
  const remaining = Math.max(0, tgt - cur);
  const monthly = remaining / dur;
  const canCompute = tgt > 0 && dur > 0;

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center gap-2">
        <Calculator className="w-4 h-4 text-slate-400" />
        <h2 className="font-semibold text-slate-800">Simulateur d'épargne</h2>
      </div>
      <p className="text-xs text-slate-400 mt-1 mb-3">
        Indique ton objectif et le temps dont tu disposes : on calcule combien mettre de côté chaque mois.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Montant à atteindre</label>
          <input
            type="number" inputMode="decimal" placeholder="0" value={target}
            onChange={e => setTarget(e.target.value)}
            className="w-full text-sm px-3 py-2 rounded-xl bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-slate-900 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Durée (mois)</label>
          <input
            type="number" inputMode="numeric" min="1" placeholder="ex : 6" value={months}
            onChange={e => setMonths(e.target.value)}
            className="w-full text-sm px-3 py-2 rounded-xl bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-slate-900 outline-none"
          />
        </div>
      </div>
      <div className="mt-2">
        <label className="block text-xs text-slate-500 mb-1">Déjà épargné (facultatif)</label>
        <input
          type="number" inputMode="decimal" placeholder="0" value={current}
          onChange={e => setCurrent(e.target.value)}
          className="w-full text-sm px-3 py-2 rounded-xl bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-slate-900 outline-none"
        />
      </div>

      {canCompute && (
        <div className="mt-4 rounded-xl bg-violet-50 ring-1 ring-violet-100 p-3">
          <div className="text-[11px] text-violet-500">À mettre de côté chaque mois</div>
          <div className="font-mono tabular-nums text-xl font-semibold text-violet-700 mt-0.5">
            {money(monthly)}
          </div>
          <div className="text-[11px] text-violet-500 mt-1">
            pendant {dur} mois pour atteindre {money(tgt)}{cur > 0 ? ` (${money(remaining)} restants)` : ''}
          </div>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 *  Onglet Historique
 * ------------------------------------------------------------------ */
const monthLabelFmt = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });

function Historique({ transactions, money, onRemove, onEdit }) {
  const [openMonth, setOpenMonth] = useState(null);

  const months = useMemo(() => {
    const map = new Map();
    for (const t of transactions) {
      const mk = monthKey(t.date);
      if (!map.has(mk)) {
        const [y, m] = mk.split('-').map(Number);
        map.set(mk, { key: mk, y, m, income: 0, expense: 0, items: [] });
      }
      const g = map.get(mk);
      const amt = Number(t.amount) || 0;
      if (t.type === 'income') g.income += amt; else g.expense += amt;
      g.items.push(t);
    }
    return [...map.values()]
      .sort((a, b) => (b.y - a.y) || (b.m - a.m))
      .map(g => ({ ...g, items: g.items.slice().sort((a, b) => new Date(b.date) - new Date(a.date)) }));
  }, [transactions]);

  const oldest = months[months.length - 1];

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center gap-2">
          <HistoryIcon className="w-4 h-4 text-slate-400" />
          <h2 className="font-semibold text-slate-800">Historique des opérations</h2>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Consulte tes dépenses et revenus passés, jusqu'à {HISTORY_MONTHS} mois en arrière
          (au-delà, les opérations sont automatiquement archivées pour ne pas saturer la mémoire de l'appareil).
          {oldest ? ` Mois le plus ancien disponible : ${monthLabelFmt.format(new Date(oldest.y, oldest.m, 1))}.` : ''}
        </p>
      </section>

      {months.length === 0 ? (
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
          <HistoryIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Aucune opération enregistrée pour l'instant.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {months.map(g => {
            const label = monthLabelFmt.format(new Date(g.y, g.m, 1));
            const net = g.income - g.expense;
            const open = openMonth === g.key;
            return (
              <li key={g.key} className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
                <button
                  onClick={() => setOpenMonth(open ? null : g.key)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors motion-reduce:transition-none">
                  <span className="grid place-items-center w-9 h-9 rounded-full bg-slate-100 shrink-0">
                    {open ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                  </span>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-sm font-medium text-slate-800 capitalize">{label}</div>
                    <div className="text-xs text-slate-400">{g.items.length} opération{g.items.length > 1 ? 's' : ''}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={'font-mono tabular-nums text-sm font-semibold ' + (net >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                      {net >= 0 ? '+' : '−'}{money(Math.abs(net))}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      +{money(g.income)} · −{money(g.expense)}
                    </div>
                  </div>
                </button>

                {open && (
                  <ul className="divide-y divide-slate-100 border-t border-slate-100 px-4">
                    {g.items.map(t => {
                      const c = catOf(t.cat);
                      const inc = t.type === 'income';
                      return (
                        <li key={t.id} className="flex items-center gap-3 py-2.5">
                          <span className="grid place-items-center w-9 h-9 rounded-full bg-slate-100 text-base shrink-0">
                            {c.emoji}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-slate-800 truncate">
                              {c.label}{t.note ? <span className="text-slate-400 font-normal"> · {t.note}</span> : null}
                            </div>
                            <div className="text-xs text-slate-400">{fmtDate(t.date)}</div>
                          </div>
                          <div className={'font-mono tabular-nums text-sm font-semibold shrink-0 ' + (inc ? 'text-emerald-600' : 'text-rose-600')}>
                            {inc ? '+' : '−'}{money(t.amount)}
                          </div>
                          <button
                            onClick={() => onEdit(t)}
                            className="p-1.5 rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors motion-reduce:transition-none shrink-0"
                            aria-label="Modifier">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onRemove(t.id)}
                            className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors motion-reduce:transition-none shrink-0"
                            aria-label="Supprimer">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Modales
 * ------------------------------------------------------------------ */
function ModalShell({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white rounded-t-3xl sm:rounded-3xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors motion-reduce:transition-none" aria-label="Fermer">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SettingsModal({ currency, onCurrency, onReset, onClose, pseudo, onLogout }) {
  const [confirming, setConfirming] = useState(false);
  const [customSym, setCustomSym] = useState(currency.symbol);

  return (
    <ModalShell title="Réglages" onClose={onClose}>
      <div className="space-y-5">
        <div className="flex items-center justify-between rounded-xl bg-slate-50 ring-1 ring-slate-200 p-3">
          <div>
            <div className="text-[11px] text-slate-400">Connecté en tant que</div>
            <div className="text-sm font-medium text-slate-800">{pseudo}</div>
          </div>
          <button
            onClick={onLogout}
            className="px-3 py-1.5 rounded-lg bg-white ring-1 ring-slate-200 text-xs font-medium text-slate-600 flex items-center gap-1.5 hover:bg-slate-100 transition-colors motion-reduce:transition-none">
            <LogOut className="w-3.5 h-3.5" /> Déconnexion
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Devise</label>
          <div className="grid grid-cols-3 gap-2">
            {CURRENCY_PRESETS.map(p => {
              const active = currency.symbol === p.symbol;
              return (
                <button
                  key={p.symbol}
                  onClick={() => onCurrency(p)}
                  className={'py-2 rounded-xl text-sm font-medium ring-1 transition-colors motion-reduce:transition-none ' +
                    (active ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-600 ring-slate-200')}>
                  {p.symbol}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="text" value={customSym} maxLength={5}
              onChange={e => setCustomSym(e.target.value)}
              placeholder="Symbole perso"
              className="flex-1 text-sm px-3 py-2 rounded-xl bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-slate-900 outline-none"
            />
            <button
              onClick={() => customSym.trim() && onCurrency({ symbol: customSym.trim(), decimals: currency.decimals, position: currency.position })}
              className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition-colors motion-reduce:transition-none">
              Appliquer
            </button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              onClick={() => onCurrency({ ...currency, decimals: currency.decimals === 0 ? 2 : 0 })}
              className="py-2 rounded-xl bg-slate-50 ring-1 ring-slate-200 text-sm text-slate-600 hover:bg-slate-100 transition-colors motion-reduce:transition-none">
              Décimales : {currency.decimals}
            </button>
            <button
              onClick={() => onCurrency({ ...currency, position: currency.position === 'after' ? 'before' : 'after' })}
              className="py-2 rounded-xl bg-slate-50 ring-1 ring-slate-200 text-sm text-slate-600 hover:bg-slate-100 transition-colors motion-reduce:transition-none">
              Symbole : {currency.position === 'after' ? 'après' : 'avant'}
            </button>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100">
          <p className="text-xs text-slate-400 mb-2">
            Tes données sont enregistrées automatiquement sur cet appareil, sous ton pseudo.
            « Tout réinitialiser » n'efface que les données de ton compte ({pseudo}).
          </p>
          {!confirming ? (
            <button
              onClick={() => setConfirming(true)}
              className="w-full py-2.5 rounded-xl bg-rose-50 text-rose-600 text-sm font-medium hover:bg-rose-100 transition-colors motion-reduce:transition-none">
              Tout réinitialiser
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={onReset}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 transition-colors motion-reduce:transition-none">
                Oui, tout effacer
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition-colors motion-reduce:transition-none">
                Annuler
              </button>
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

function InitBalanceModal({ initialBalance, money, onClose, onConfirm }) {
  const [amount, setAmount] = useState(String(initialBalance || ''));

  const confirm = () => {
    const amt = parseFloat(amount);
    if (isNaN(amt)) return;
    onConfirm(amt);
  };

  return (
    <ModalShell title="Argent que j'ai déjà" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-slate-500">
          Renseigne ici le montant que tu possèdes déjà (en dehors de tes entrées et sorties
          suivies ci-dessous). C'est ton point de départ — tu peux le corriger à tout moment.
        </p>
        <p className="text-xs text-slate-400">
          Actuellement : {money(initialBalance)}
        </p>
        <input
          type="number" inputMode="decimal" placeholder="0" value={amount} autoFocus
          onChange={e => setAmount(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') confirm(); }}
          className="w-full text-2xl font-mono tabular-nums font-semibold px-3 py-2 rounded-xl bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-slate-900 outline-none"
        />
        <button
          onClick={confirm}
          disabled={amount === '' || isNaN(parseFloat(amount))}
          className={'w-full py-2.5 rounded-xl text-white font-medium flex items-center justify-center gap-1.5 transition-colors motion-reduce:transition-none ' +
            (amount === '' || isNaN(parseFloat(amount))
              ? 'bg-slate-300 cursor-not-allowed'
              : 'bg-slate-900 hover:bg-slate-800')}>
          <Check className="w-4 h-4" /> Enregistrer
        </button>
      </div>
    </ModalShell>
  );
}

function AddGoalModal({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [emoji, setEmoji] = useState('🎯');

  const create = () => {
    const tgt = Math.abs(parseFloat(target));
    if (!name.trim() || !tgt || isNaN(tgt)) return;
    onCreate({ name: name.trim(), target: tgt, emoji });
  };

  return (
    <ModalShell title="Nouvel objectif d'épargne" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-xs text-slate-500 mb-1.5">Icône</label>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {GOAL_EMOJIS.map(e => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                className={'shrink-0 w-10 h-10 rounded-xl text-xl grid place-items-center ring-1 transition-colors motion-reduce:transition-none ' +
                  (emoji === e ? 'bg-violet-50 ring-violet-400' : 'bg-white ring-slate-200')}>
                {e}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Nom de l'objectif</label>
          <input
            type="text" placeholder="ex : Nouvel ordinateur" value={name}
            onChange={e => setName(e.target.value)}
            className="w-full text-sm px-3 py-2 rounded-xl bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-slate-900 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Montant à atteindre</label>
          <input
            type="number" inputMode="decimal" placeholder="0" value={target}
            onChange={e => setTarget(e.target.value)}
            className="w-full text-lg font-mono tabular-nums px-3 py-2 rounded-xl bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-slate-900 outline-none"
          />
        </div>
        <button
          onClick={create}
          className="w-full py-2.5 rounded-xl bg-violet-600 text-white font-medium flex items-center justify-center gap-1.5 hover:bg-violet-700 transition-colors motion-reduce:transition-none">
          <Check className="w-4 h-4" /> Créer l'objectif
        </button>
      </div>
    </ModalShell>
  );
}

function EditTransactionModal({ tx, money, onClose, onSave }) {
  const cats = tx.type === 'expense' ? EXPENSE_CATS : INCOME_CATS;
  const [cat, setCat] = useState(tx.cat);
  const [note, setNote] = useState(tx.note || '');

  const save = () => onSave({ cat, note: note.trim() });

  return (
    <ModalShell title={`Modifier · ${money(tx.amount)}`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-xs text-slate-500 mb-1.5">Catégorie</label>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {cats.map(c => {
              const active = cat === c.key;
              return (
                <button
                  key={c.key}
                  onClick={() => setCat(c.key)}
                  className={'shrink-0 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors motion-reduce:transition-none ring-1 ' +
                    (active ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-600 ring-slate-200')}>
                  <span className="mr-1">{c.emoji}</span>{c.label}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Note</label>
          <input
            type="text" placeholder="ex : courses" value={note}
            onChange={e => setNote(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); }}
            className="w-full text-sm px-3 py-2 rounded-xl bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-slate-900 outline-none"
          />
        </div>
        <button
          onClick={save}
          className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-medium flex items-center justify-center gap-1.5 hover:bg-slate-800 transition-colors motion-reduce:transition-none">
          <Check className="w-4 h-4" /> Enregistrer
        </button>
      </div>
    </ModalShell>
  );
}

function GoalOpModal({ goal, mode, money, solde, onClose, onConfirm }) {
  const [amount, setAmount] = useState('');
  const isAdd = mode === 'add';
  const cur = Number(goal.current) || 0;
  const max = isAdd ? solde : cur;

  const amt = Math.abs(parseFloat(amount)) || 0;
  const tooMuch = amt > max;

  const confirm = () => {
    if (!amt || isNaN(amt) || tooMuch) return;
    onConfirm(amt);
  };

  return (
    <ModalShell title={isAdd ? `Mettre de côté · ${goal.name}` : `Retirer · ${goal.name}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-slate-500">
          {isAdd
            ? `Disponible à répartir : ${money(solde)}`
            : `Épargné sur cet objectif : ${money(cur)}`}
        </p>
        <input
          type="number" inputMode="decimal" placeholder="0" value={amount} autoFocus
          onChange={e => setAmount(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') confirm(); }}
          className="w-full text-2xl font-mono tabular-nums font-semibold px-3 py-2 rounded-xl bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-slate-900 outline-none"
        />
        {tooMuch && (
          <p className="text-xs text-rose-500 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {isAdd ? "Tu n'as pas assez de solde disponible." : "Montant supérieur à ce qui est épargné."}
          </p>
        )}
        <button
          onClick={confirm}
          disabled={!amt || tooMuch}
          className={'w-full py-2.5 rounded-xl text-white font-medium transition-colors motion-reduce:transition-none ' +
            (!amt || tooMuch ? 'bg-slate-300 cursor-not-allowed'
              : isAdd ? 'bg-violet-600 hover:bg-violet-700' : 'bg-slate-800 hover:bg-slate-900')}>
          {isAdd ? 'Confirmer le dépôt' : 'Confirmer le retrait'}
        </button>
      </div>
    </ModalShell>
  );
}
