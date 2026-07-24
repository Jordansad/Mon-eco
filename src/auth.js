const ACCOUNTS_KEY = 'mon-budget-accounts-v1';
const SESSION_KEY = 'mon-budget-session-v1';
const LEGACY_DATA_KEY = 'mon-budget-v1';

function bufferToHex(buf) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomSaltHex() {
  const arr = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password, salt) {
  const enc = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', enc);
  return bufferToHex(digest);
}

function loadAccounts() {
  try {
    const raw = window.localStorage.getItem(ACCOUNTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Lecture des comptes impossible', e);
  }
  return [];
}

function saveAccounts(accounts) {
  try {
    window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch (e) {
    console.error('Sauvegarde des comptes impossible', e);
  }
}

function findAccount(accounts, pseudo) {
  const needle = pseudo.trim().toLowerCase();
  return accounts.find(a => a.pseudo.toLowerCase() === needle);
}

export function dataKeyFor(pseudo) {
  return `mon-budget-data-v1:${pseudo.trim().toLowerCase()}`;
}

export function getSession() {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw).pseudo || null;
  } catch (e) { /* pas de session */ }
  return null;
}

export function clearSession() {
  try { window.localStorage.removeItem(SESSION_KEY); } catch (e) { /* rien à faire */ }
}

function setSession(pseudo) {
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify({ pseudo }));
  } catch (e) {
    console.error('Impossible d\'ouvrir la session', e);
  }
}

export async function signup(pseudo, password) {
  const clean = pseudo.trim();
  if (clean.length < 3) return { ok: false, error: 'Le pseudo doit faire au moins 3 caractères.' };
  if (password.length < 4) return { ok: false, error: 'Le mot de passe doit faire au moins 4 caractères.' };

  const accounts = loadAccounts();
  if (findAccount(accounts, clean)) {
    return { ok: false, error: 'Ce pseudo est déjà pris sur cet appareil.' };
  }

  const salt = randomSaltHex();
  const hash = await hashPassword(password, salt);
  const isFirstAccountEver = accounts.length === 0;
  accounts.push({ pseudo: clean, salt, hash });
  saveAccounts(accounts);

  // Si c'est le tout premier compte créé sur cet appareil et qu'il existe déjà
  // des données de l'ancienne version mono-utilisateur, on les récupère.
  if (isFirstAccountEver) {
    try {
      const legacy = window.localStorage.getItem(LEGACY_DATA_KEY);
      if (legacy) {
        window.localStorage.setItem(dataKeyFor(clean), legacy);
        window.localStorage.removeItem(LEGACY_DATA_KEY);
      }
    } catch (e) { /* pas grave, on repart d'une app vide */ }
  }

  setSession(clean);
  return { ok: true, pseudo: clean };
}

export async function login(pseudo, password) {
  const clean = pseudo.trim();
  const accounts = loadAccounts();
  const account = findAccount(accounts, clean);
  if (!account) return { ok: false, error: 'Pseudo ou mot de passe incorrect.' };

  const hash = await hashPassword(password, account.salt);
  if (hash !== account.hash) return { ok: false, error: 'Pseudo ou mot de passe incorrect.' };

  setSession(account.pseudo);
  return { ok: true, pseudo: account.pseudo };
}

export function logout() {
  clearSession();
}
