const $ = (selector) => document.querySelector(selector);
let currentLabId = null;

// ADR-001: el token vive SOLO en memoria (no en localStorage): un XSS ya no puede leerlo del almacenamiento
// y, al recargar la página, el usuario vuelve a iniciar sesión. El access token dura 15 minutos.
let token = null;
let user = null;

// Todo texto que viene de la API es no confiable: se escapa antes de armar HTML (anti XSS almacenado).
const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

async function api(path, options = {}) {
  const response = await fetch('/api' + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: 'Bearer ' + token }),
    },
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && token) logout(); // token vencido o inválido
  if (!response.ok) throw new Error(data.error ?? 'Error inesperado');
  return data;
}

function logout() {
  token = null;
  user = null;
  renderSession();
}

function renderSession() {
  $('#login-section').hidden = Boolean(user);
  $('#reservations-section').hidden = !user;
  $('#session').innerHTML = user ? `${esc(user.name)} (${esc(user.role)}) · <a id="logout">Salir</a>` : '';
  if (user) {
    $('#logout').onclick = logout;
    loadReservations().catch(() => {});
  }
}

async function loadLabs(search = '') {
  const labs = await api('/labs?search=' + encodeURIComponent(search));
  $('#labs').innerHTML = labs
    .map((lab) => `<li><a data-id="${esc(lab.id)}">${esc(lab.name)}</a> <span class="muted">${esc(lab.building)} · ${esc(lab.capacity)} personas</span></li>`)
    .join('');
  document.querySelectorAll('#labs a').forEach((a) => (a.onclick = () => openLab(a.dataset.id)));
}

async function openLab(id) {
  const lab = await api('/labs/' + encodeURIComponent(id));
  currentLabId = lab.id;
  $('#lab-section').hidden = false;
  $('#lab-name').textContent = lab.name;
  $('#lab-description').textContent = lab.description ?? '';
  $('#comments').innerHTML =
    lab.comments.map((c) => `<li><strong>${esc(c.author)}:</strong> ${esc(c.body)}</li>`).join('') ||
    '<li class="muted">Sin comentarios</li>';
}

async function loadReservations() {
  const reservations = await api('/reservations');
  $('#reservations').innerHTML =
    reservations
      .map((r) => `<li>${esc(r.lab)} · ${esc(r.date)} de ${esc(r.start_hour)}:00 a ${esc(r.end_hour)}:00 <span class="muted">${esc(r.purpose)}</span></li>`)
      .join('') || '<li class="muted">No tiene reservas</li>';
}

$('#login-form').onsubmit = async (event) => {
  event.preventDefault();
  const form = new FormData(event.target);
  try {
    const result = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(form)),
    });
    token = result.token;
    user = result.user;
    event.target.reset();
    $('#login-error').textContent = '';
    renderSession();
  } catch (error) {
    $('#login-error').textContent = error.message;
  }
};

$('#search-form').onsubmit = (event) => {
  event.preventDefault();
  loadLabs(new FormData(event.target).get('search')).catch((e) => ($('#login-error').textContent = e.message));
};

$('#comment-form').onsubmit = async (event) => {
  event.preventDefault();
  const body = new FormData(event.target).get('body');
  try {
    await api(`/labs/${currentLabId}/comments`, { method: 'POST', body: JSON.stringify({ body }) });
    event.target.reset();
    openLab(currentLabId);
  } catch (error) {
    alert(error.message === 'Token requerido' ? 'Inicie sesión para comentar' : error.message);
  }
};

renderSession();
loadLabs();
