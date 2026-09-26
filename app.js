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

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

let clients = load(STORAGE_KEY, []);
let services = load(SERVICES_KEY, DEFAULT_SERVICES);
let filter = 'todos';

function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
}

function saveServices() {
  localStorage.setItem(SERVICES_KEY, JSON.stringify(services));
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

  const visible = clients.filter(
    (c) =>
      (filter === 'todos' || c.status === filter) &&
      c.name.toLowerCase().includes(term)
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

    const date = document.createElement('div');
    date.className = 'item-date';
    date.textContent = [c.service, formatDate(c.date)].filter(Boolean).join(' · ');

    info.append(name, date);

    const amount = document.createElement('div');
    amount.className = 'item-value';
    amount.textContent = brl.format(c.value || 0);

    const badge = document.createElement('button');
    badge.className = `badge ${c.status}`;
    badge.textContent = c.status;
    badge.title = 'Clique para alternar pago/pendente';
    badge.addEventListener('click', () => toggle(c.id));

    const del = document.createElement('button');
    del.className = 'btn-del';
    del.innerHTML = '&times;';
    del.title = 'Remover cliente';
    del.setAttribute('aria-label', `Remover ${c.name}`);
    del.addEventListener('click', () => remove(c.id));

    li.append(info, amount, badge, del);
    list.appendChild(li);
  });

  empty.hidden = visible.length > 0;
  empty.textContent = clients.length
    ? 'Nenhum resultado encontrado.'
    : 'Nenhum cliente por aqui ainda.';

  const sum = (status) =>
    clients.filter((c) => c.status === status).reduce((t, c) => t + (c.value || 0), 0);

  document.getElementById('stat-total').textContent = clients.length;
  document.getElementById('stat-paid').textContent = clients.filter((c) => c.status === 'pago').length;
  document.getElementById('stat-pending').textContent = clients.filter((c) => c.status === 'pendente').length;
  document.getElementById('stat-received').textContent = brl.format(sum('pago'));
  document.getElementById('stat-owed').textContent = brl.format(sum('pendente'));
}

function add(name, service, value, status) {
  clients.unshift({
    id: newId(),
    name,
    service,
    value,
    status,
    date: new Date().toISOString(),
  });
  save();
  render();
}

function toggle(id) {
  const c = clients.find((c) => c.id === id);
  if (!c) return;
  c.status = c.status === 'pago' ? 'pendente' : 'pago';
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
  if (!name || !service || Number.isNaN(value) || value < 0) return;
  add(name, service.name, value, form.status.value);
  form.reset();
  serviceSelect.value = '';
  nameInput.focus();
});

search.addEventListener('input', render);

chips.forEach((chip) =>
  chip.addEventListener('click', () => {
    chips.forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    filter = chip.dataset.filter;
    render();
  })
);

renderServices();
render();
