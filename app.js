const STORAGE_KEY = 'henrique-anotacoes';

const form = document.getElementById('form');
const nameInput = document.getElementById('name');
const list = document.getElementById('list');
const empty = document.getElementById('empty');
const search = document.getElementById('search');
const chips = document.querySelectorAll('.chip');

let clients = load();
let filter = 'todos';

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

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
    date.textContent = formatDate(c.date);

    info.append(name, date);

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

    li.append(info, badge, del);
    list.appendChild(li);
  });

  empty.hidden = visible.length > 0;
  empty.textContent = clients.length
    ? 'Nenhum resultado encontrado.'
    : 'Nenhum cliente por aqui ainda.';

  document.getElementById('stat-total').textContent = clients.length;
  document.getElementById('stat-paid').textContent = clients.filter((c) => c.status === 'pago').length;
  document.getElementById('stat-pending').textContent = clients.filter((c) => c.status === 'pendente').length;
}

function add(name, status) {
  clients.unshift({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name,
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
  if (!name) return;
  add(name, form.status.value);
  form.reset();
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

render();
