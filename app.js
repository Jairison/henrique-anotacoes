const STORAGE_KEY = 'henrique-anotacoes';
const SERVICES_KEY = 'henrique-anotacoes-servicos';

// Tabela inicial de preços — pode ser alterada na seção "Serviços e valores"
const DEFAULT_SERVICES = [
  { id: 's1', name: 'Corte', price: 35 },
  { id: 's2', name: 'Barba', price: 25 },
  { id: 's3', name: 'Corte + Barba', price: 55 },
  { id: 's4', name: 'Sobrancelha', price: 15 },
  { id: 's5', name: 'Pigmentação', price: 40 },
  { id: 's6', name: 'Hidratação', price: 30 },
];

const form = document.getElementById('form');
const nameInput = document.getElementById('name');
const serviceSelect = document.getElementById('service');
const valueInput = document.getElementById('value');
const list = document.getElementById('list');
const empty = document.getElementById('empty');
const search = document.getElementById('search');
const chips = document.querySelectorAll('.chip');
const serviceForm = document.getElementById('service-form');
const serviceName = document.getElementById('service-name');
const servicePrice = document.getElementById('service-price');
const servicesList = document.getElementById('services-list');

const dateInput = document.getElementById('date');
const calTitle = document.getElementById('cal-title');
const calGrid = document.getElementById('cal-grid');
const calInfo = document.getElementById('cal-info');

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
// para incluir outra forma (ex.: Pix), basta acrescentar aqui: pix: 'Pix'
const PAYMENT_METHODS = { dinheiro: 'Dinheiro', cartao: 'Cartão' };
const STATUS_LABELS = { aberto: 'Em aberto', pago: 'Pago', pendente: 'Pendente' };
const CAL_HINT ='Clique em um dia para ver só os atendimentos dele.';

let currentUser = null; // definido pelo login (auth.js)
let clients = [];
let services = [];
let filter = 'todos';
let selectedDay = null; // 'AAAA-MM-DD' ou null (todos os dias)
let viewMonth = startOfMonth(new Date());

function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

// cada administrador tem seus próprios clientes e serviços
function keyFor(userId, name) {
  return `${STORAGE_KEY}:${userId}:${name}`;
}

function save() {
  localStorage.setItem(keyFor(currentUser.id, 'clientes'), JSON.stringify(clients));
}

function saveServices() {
  localStorage.setItem(keyFor(currentUser.id, 'servicos'), JSON.stringify(services));
}

// chamado pelo auth.js depois do login
function startApp(user) {
  currentUser = user;
  clients = load(keyFor(user.id, 'clientes'), []);
  services = load(keyFor(user.id, 'servicos'), DEFAULT_SERVICES.map((s) => ({ ...s })));

  filter = 'todos';
  selectedDay = null;
  viewMonth = startOfMonth(new Date());
  search.value = '';
  chips.forEach((c) => c.classList.toggle('active', c.dataset.filter === 'todos'));
  form.reset();
  syncMethodField();
  serviceForm.reset();

  document.getElementById('user-name').textContent = user.name;
  setToday();
  renderServices();
  render();
}

// chamado pelo auth.js ao sair
function stopApp() {
  currentUser = null;
  clients = [];
  services = [];
  list.innerHTML = '';
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function pad(n) {
  return String(n).padStart(2, '0');
}

// chave local do dia, ex.: '2026-09-26'
function dayKey(input) {
  const d = new Date(input);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

// preenche a data do formulário com o dia de hoje
function setToday() {
  dateInput.value = dayKey(new Date());
}

/* ---------- Calendário ---------- */

function renderCalendar() {
  const monthLabel = viewMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  calTitle.textContent = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  const counts = {};
  clients.forEach((c) => {
    const k = dayKey(c.date);
    counts[k] = (counts[k] || 0) + 1;
  });

  const todayKey = dayKey(new Date());
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const offset = new Date(year, month, 1).getDay(); // 0 = domingo
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  calGrid.innerHTML = '';
  for (let i = 0; i < offset; i++) {
    calGrid.appendChild(document.createElement('span'));
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${year}-${pad(month + 1)}-${pad(day)}`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cal-day';
    if (key === todayKey) btn.classList.add('today');
    if (key === selectedDay) btn.classList.add('selected');
    if (counts[key]) btn.classList.add('has');
    btn.textContent = day;
    btn.setAttribute('aria-pressed', key === selectedDay);
    btn.title = counts[key]
      ? `${counts[key]} atendimento${counts[key] > 1 ? 's' : ''}`
      : 'Sem atendimentos';

    if (counts[key]) {
      const badge = document.createElement('span');
      badge.className = 'cal-count';
      badge.textContent = counts[key];
      btn.append(badge);
    }

    btn.addEventListener('click', () => selectDay(key));
    calGrid.appendChild(btn);
  }

  if (selectedDay) {
    const [y, m, d] = selectedDay.split('-').map(Number);
    const label = new Date(y, m - 1, d).toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    const n = counts[selectedDay] || 0;
    calInfo.textContent = `${label} · ${n} atendimento${n === 1 ? '' : 's'} — clique de novo para ver todos`;
  } else {
    calInfo.textContent = CAL_HINT;
  }
}

function selectDay(key) {
  selectedDay = selectedDay === key ? null : key;
  if (selectedDay) dateInput.value = selectedDay; // novo atendimento já usa o dia escolhido
  render();
}

function shiftMonth(delta) {
  viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + delta, 1);
  renderCalendar();
}

document.getElementById('cal-prev').addEventListener('click', () => shiftMonth(-1));
document.getElementById('cal-next').addEventListener('click', () => shiftMonth(1));
document.getElementById('cal-today').addEventListener('click', () => {
  viewMonth = startOfMonth(new Date());
  selectedDay = dayKey(new Date());
  dateInput.value = selectedDay;
  render();
});

/* ---------- Serviços ---------- */

function renderServices() {
  // seletor do formulário (mantém a escolha atual)
  const current = serviceSelect.value;
  serviceSelect.innerHTML = '';
  const placeholder = new Option('Selecione…', '');
  placeholder.disabled = true;
  serviceSelect.add(placeholder);
  services.forEach((s) => serviceSelect.add(new Option(`${s.name} — ${brl.format(s.price)}`, s.id)));
  serviceSelect.value = services.some((s) => s.id === current) ? current : '';

  // tabela de preços editável
  servicesList.innerHTML = '';
  services.forEach((s) => {
    const li = document.createElement('li');
    li.className = 'service-row';

    const label = document.createElement('span');
    label.className = 'service-label';
    label.textContent = s.name;

    const price = document.createElement('input');
    price.type = 'number';
    price.min = '0';
    price.step = '0.01';
    price.value = s.price;
    price.setAttribute('aria-label', `Preço de ${s.name}`);
    price.addEventListener('change', () => {
      const v = parseFloat(price.value);
      if (Number.isNaN(v) || v < 0) {
        price.value = s.price;
        return;
      }
      s.price = v;
      saveServices();
      renderServices();
    });

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn-del';
    del.innerHTML = '&times;';
    del.title = 'Remover serviço';
    del.setAttribute('aria-label', `Remover ${s.name}`);
    del.addEventListener('click', () => {
      if (!confirm(`Remover o serviço "${s.name}"? Atendimentos já anotados não são afetados.`)) return;
      services = services.filter((x) => x.id !== s.id);
      saveServices();
      renderServices();
    });

    li.append(label, price, del);
    servicesList.appendChild(li);
  });
}

serviceSelect.addEventListener('change', () => {
  const s = services.find((s) => s.id === serviceSelect.value);
  if (s) valueInput.value = s.price;
});

serviceForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = serviceName.value.trim();
  const price = parseFloat(servicePrice.value);
  if (!name || Number.isNaN(price) || price < 0) return;
  services.push({ id: newId(), name, price });
  saveServices();
  renderServices();
  serviceForm.reset();
  serviceName.focus();
});

/* ---------- Clientes ---------- */

function render() {
  const term = search.value.trim().toLowerCase();

  // clientes em atendimento ficam no topo; depois, por data
  // (dia escolhido: do mais cedo ao mais tarde; senão: do mais recente ao mais antigo)
  const visible = clients
    .filter(
      (c) =>
        (filter === 'todos' || c.status === filter) &&
        (!selectedDay || dayKey(c.date) === selectedDay) &&
        c.name.toLowerCase().includes(term)
    )
    .sort(
      (a, b) =>
        (b.status === 'aberto') - (a.status === 'aberto') ||
        (selectedDay
          ? new Date(a.date) - new Date(b.date)
          : new Date(b.date) - new Date(a.date))
    );

  list.innerHTML = '';
  visible.forEach((c) => {
    const li = document.createElement('li');
    li.className = `item ${c.status}`;

    const info = document.createElement('div');
    info.className = 'item-info';

    const name = document.createElement('div');
    name.className = 'item-name';
    name.textContent = c.name;

    const tag = document.createElement('span');
    tag.className = `status-tag ${c.status}`;
    tag.textContent = STATUS_LABELS[c.status] || c.status;
    name.append(tag);

    const date = document.createElement('div');
    date.className = 'item-date';
    date.textContent = [
      c.service,
      formatDate(c.date),
      c.status === 'pago' && !c.method ? 'forma de pagamento não informada' : '',
    ]
      .filter(Boolean)
      .join(' · ');

    info.append(name, date);

    const amount = document.createElement('div');
    amount.className = 'item-value';
    amount.textContent = brl.format(c.value || 0);

    // Dinheiro / Cartão = pago naquela forma; Pendente = ainda não pagou.
    // Em atendimento (aberto) nenhum aparece marcado; depois de decidido, o escolhido fica em destaque.
    const action = document.createElement('div');
    action.className = c.status === 'aberto' ? 'finish' : 'finish decided';
    const options = [
      ...Object.entries(PAYMENT_METHODS).map(([method, label]) => ({
        label,
        status: 'pago',
        method,
        title: `Pago em ${label.toLowerCase()}`,
        active: c.status === 'pago' && c.method === method,
      })),
      { label: 'Pendente', status: 'pendente', title: 'Marcar como pendente', active: c.status === 'pendente' },
    ];
    options.forEach((o) => {
      const btn = document.createElement('button');
      btn.className = `badge ${o.status}${o.active ? ' active' : ''}`;
      btn.textContent = o.label;
      btn.title = o.title;
      btn.setAttribute('aria-pressed', o.active);
      btn.addEventListener('click', () => setStatus(c.id, o.status, o.method));
      action.append(btn);
    });

    const del = document.createElement('button');
    del.className = 'btn-del';
    del.innerHTML = '&times;';
    del.title = 'Remover cliente';
    del.setAttribute('aria-label', `Remover ${c.name}`);
    del.addEventListener('click', () => remove(c.id));

    li.append(info, amount, del, action);
    list.appendChild(li);
  });

  empty.hidden = visible.length > 0;
  empty.textContent = clients.length
    ? 'Nenhum resultado encontrado.'
    : 'Nenhum cliente por aqui ainda.';

  renderCalendar();

  const sum = (status, method) =>
    clients
      .filter((c) => c.status === status && (method === undefined || c.method === method))
      .reduce((t, c) => t + (c.value || 0), 0);

  // detalhe do recebido por forma de pagamento (inclui os antigos sem forma informada)
  const received = sum('pago');
  const detail = Object.entries(PAYMENT_METHODS).map(
    ([method, label]) => `${label} ${brl.format(sum('pago', method))}`
  );
  const unknown = received - Object.keys(PAYMENT_METHODS).reduce((t, m) => t + sum('pago', m), 0);
  if (unknown > 0.005) detail.push(`Sem forma informada ${brl.format(unknown)}`);
  document.getElementById('stat-received-detail').textContent = detail.join(' · ');

  document.getElementById('stat-total').textContent = clients.length;
  document.getElementById('stat-open').textContent = clients.filter((c) => c.status === 'aberto').length;
  document.getElementById('stat-paid').textContent = clients.filter((c) => c.status === 'pago').length;
  document.getElementById('stat-pending').textContent = clients.filter((c) => c.status === 'pendente').length;
  document.getElementById('stat-received').textContent = brl.format(received);
  document.getElementById('stat-owed').textContent = brl.format(sum('pendente'));
}

function add(name, service, value, status, method, date) {
  const client = { id: newId(), name, service, value, status, date };
  if (status === 'pago') client.method = method;
  clients.unshift(client);
  save();
  render();
}

// a forma de pagamento só existe quando o cliente está pago
function setStatus(id, status, method) {
  const c = clients.find((c) => c.id === id);
  if (!c) return;
  c.status = status;
  if (status === 'pago') c.method = method;
  else delete c.method;
  save();
  render();
}

function remove(id) {
  const c = clients.find((c) => c.id === id);
  if (!c || !confirm(`Remover "${c.name}"?`)) return;
  clients = clients.filter((c) => c.id !== id);
  save();
  render();
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  const service = services.find((s) => s.id === serviceSelect.value);
  const value = parseFloat(valueInput.value);
  const when = new Date(`${dateInput.value}T12:00`); // só o dia importa; meio-dia evita erro de fuso
  if (!name || !service || Number.isNaN(value) || value < 0 || Number.isNaN(when.getTime())) return;
  add(name, service.name, value, form.status.value, form.paymethod.value, when.toISOString());
  form.reset();
  syncMethodField();
  serviceSelect.value = '';
  setToday();
  // mostra no calendário o mês do atendimento recém-anotado
  viewMonth = startOfMonth(when);
  if (selectedDay) selectedDay = dayKey(when); // evita esconder o atendimento que acabou de entrar
  render();
  nameInput.focus();
});

// a forma de pagamento só é perguntada quando o status é "Pago"
function syncMethodField() {
  document.getElementById('method-field').hidden = form.status.value !== 'pago';
}

form.querySelectorAll('input[name="status"]').forEach((r) => r.addEventListener('change', syncMethodField));

search.addEventListener('input', render);

chips.forEach((chip) =>
  chip.addEventListener('click', () => {
    chips.forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    filter = chip.dataset.filter;
    render();
  })
);

