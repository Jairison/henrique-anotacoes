const USERS_KEY = `${STORAGE_KEY}:users`;
const SESSION_KEY = `${STORAGE_KEY}:session`;
const PBKDF2_ITERATIONS = 150000;

const authView = document.getElementById('auth');
const appView = document.getElementById('app');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginError = document.getElementById('login-error');
const registerError = document.getElementById('register-error');
const tabs = document.querySelectorAll('.tab');

/* ---------- Usuários e senhas ---------- */

function loadUsers() {
  return load(USERS_KEY, []);
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

const toHex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex) => new Uint8Array(hex.match(/../g).map((h) => parseInt(h, 16)));

// a senha nunca é guardada: só o resultado do PBKDF2 (hash) e o "sal" aleatório
async function hashPassword(password, saltHex) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations: PBKDF2_ITERATIONS },
    key,
    256
  );
  return toHex(new Uint8Array(bits));
}

function cryptoAvailable() {
  return Boolean(window.crypto && window.crypto.subtle);
}

// se já existiam anotações da versão sem login, o primeiro admin herda esses dados
function adoptLegacyData(userId) {
  const legacyClients = localStorage.getItem(STORAGE_KEY);
  const legacyServices = localStorage.getItem(SERVICES_KEY);
  if (legacyClients) localStorage.setItem(keyFor(userId, 'clientes'), legacyClients);
  if (legacyServices) localStorage.setItem(keyFor(userId, 'servicos'), legacyServices);
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SERVICES_KEY);
}

async function registerUser(name, email, password) {
  const users = loadUsers();
  if (users.some((u) => u.email === email)) {
    throw new Error('Já existe uma conta com esse e-mail.');
  }

  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  const user = {
    id: newId(),
    name,
    email,
    salt,
    hash: await hashPassword(password, salt),
  };

  if (users.length === 0) adoptLegacyData(user.id);
  users.push(user);
  saveUsers(users);
  return user;
}

async function checkLogin(email, password) {
  const user = loadUsers().find((u) => u.email === email);
  // mesma mensagem para e-mail ou senha errados
  if (!user || (await hashPassword(password, user.salt)) !== user.hash) {
    throw new Error('E-mail ou senha incorretos.');
  }
  return user;
}

/* ---------- Sessão ---------- */

function getSessionUserId() {
  return sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
}

function setSession(userId, remember) {
  clearSession();
  (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, userId);
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
}

/* ---------- Telas ---------- */

function showAuth() {
  appView.hidden = true;
  authView.hidden = false;
  showTab('login');
}

function showApp(user) {
  authView.hidden = true;
  appView.hidden = false;
  startApp(user);
}

function showTab(name) {
  tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  loginForm.hidden = name !== 'login';
  registerForm.hidden = name !== 'register';
  showError(loginError, '');
  showError(registerError, '');
}

function showError(el, message) {
  el.textContent = message;
  el.hidden = !message;
}

tabs.forEach((tab) => tab.addEventListener('click', () => showTab(tab.dataset.tab)));

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  showError(loginError, '');
  if (!cryptoAvailable()) return showError(loginError, CRYPTO_MESSAGE);

  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const password = document.getElementById('login-password').value;
  try {
    const user = await checkLogin(email, password);
    setSession(user.id, document.getElementById('login-remember').checked);
    loginForm.reset();
    showApp(user);
  } catch (err) {
    showError(loginError, err.message);
  }
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  showError(registerError, '');
  if (!cryptoAvailable()) return showError(registerError, CRYPTO_MESSAGE);

  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim().toLowerCase();
  const password = document.getElementById('reg-password').value;
  const confirmation = document.getElementById('reg-confirm').value;

  if (!name) return showError(registerError, 'Informe seu nome.');
  if (password.length < 6) return showError(registerError, 'A senha precisa ter pelo menos 6 caracteres.');
  if (password !== confirmation) return showError(registerError, 'As senhas não conferem.');

  try {
    const user = await registerUser(name, email, password);
    setSession(user.id, true);
    registerForm.reset();
    showApp(user);
  } catch (err) {
    showError(registerError, err.message);
  }
});

document.getElementById('logout').addEventListener('click', () => {
  clearSession();
  stopApp();
  showAuth();
});

const CRYPTO_MESSAGE =
  'Este navegador não permite proteger a senha. Abra o sistema pelo Chrome, Edge ou Firefox atualizados.';

/* ---------- Início ---------- */

const sessionUser = loadUsers().find((u) => u.id === getSessionUserId());
if (sessionUser) {
  showApp(sessionUser);
} else {
  clearSession();
  showAuth();
}

// sem contas ainda: já abre na aba de cadastro
if (loadUsers().length === 0) showTab('register');
