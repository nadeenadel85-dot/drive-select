// DriveSelect front end. Own original code for coursework.
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const VIEWS = ['signin', 'dashboard', 'new', 'records'];
const PAGE = 8;
let records = [], sort = { k: 'date', dir: 'descending' }, page = 1;

function say(msg, kind) { const s = $('#status'); s.className = 'status ' + (kind || ''); s.textContent = ''; setTimeout(() => s.textContent = msg, 50); }
const signedIn = () => !!sessionStorage.getItem('gb-user');

/* ---------- routing: shows one view, updates title, moves focus to h1 ---------- */
function route() {
  let v = location.hash.slice(1);
  if (!VIEWS.includes(v)) v = 'dashboard';
  if (!signedIn()) v = 'signin';
  VIEWS.forEach(n => $('#v-' + n).hidden = n !== v);
  document.body.classList.toggle('login', v === 'signin');
  $('#nav').hidden = !signedIn();
  $$('#nav a').forEach(a => a.dataset.v === v ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  document.title = $('#v-' + v).dataset.title + ' – DriveSelect';
  $('#status').textContent = '';
  $('#v-' + v + ' h1').focus();
  if (v === 'dashboard') loadDashboard();
  if (v === 'records') loadRecords();
}
window.addEventListener('hashchange', route);

/* ---------- sign in (simulated) ---------- */
$('#signin').addEventListener('submit', e => {
  e.preventDefault();
  const u = $('#user').value.trim(), p = $('#pass').value;
  const errs = [];
  setErr('user', u ? '' : 'Enter your username.'); if (!u) errs.push(['user', 'Enter your username.']);
  setErr('pass', p ? '' : 'Enter your password.'); if (!p) errs.push(['pass', 'Enter your password.']);
  if (errs.length) return summary('#si-summary', errs);
  summary('#si-summary', []);
  const b = $('#si-btn'); b.disabled = true; b.textContent = 'Signing in…'; say('Signing in…');
  setTimeout(() => {
    b.disabled = false; b.textContent = 'Sign in';
    if (u !== 'admin' || p !== 'nadeen') {
      setErr('pass', 'The username or password is incorrect. Check them and try again.');
      summary('#si-summary', [['user', 'The username or password is incorrect. Check them and try again.']]);
      return say('Sign in failed.', 'bad');
    }
    setErr('pass', ''); sessionStorage.setItem('gb-user', u);
    $('#signin').reset(); location.hash = '#dashboard'; route(); say('Signed in as ' + u + '.', 'ok');
  }, 900);
});
$('#signout').addEventListener('click', () => { sessionStorage.removeItem('gb-user'); location.hash = '#signin'; route(); say('You have signed out.', 'ok'); });

/* ---------- shared error helpers ---------- */
function setErr(id, msg) {
  $('#' + id + '-err').textContent = msg;
  const el = document.getElementById(id);
  if (el) msg ? el.setAttribute('aria-invalid', 'true') : el.removeAttribute('aria-invalid');
}
function summary(sel, errs) {
  const box = $(sel);
  if (!errs.length) { box.hidden = true; box.innerHTML = ''; return; }
  box.hidden = false;
  box.innerHTML = '<h2>There ' + (errs.length > 1 ? 'are ' + errs.length + ' problems' : 'is 1 problem') + ' with your entry</h2><ul></ul>';
  errs.forEach(([id, msg]) => {
    const li = document.createElement('li'), a = document.createElement('a');
    a.href = '#'; a.textContent = msg;
    a.addEventListener('click', ev => { ev.preventDefault(); const t = document.getElementById(id) || document.querySelector('[name=' + id + ']'); t && t.focus(); });
    li.appendChild(a); box.querySelector('ul').appendChild(li);
  });
  const first = document.getElementById(errs[0][0]) || document.querySelector('[name=' + errs[0][0] + ']');
  first && first.focus();
}

/* ---------- dashboard ---------- */
async function loadDashboard() {
  $('#stats').innerHTML = '<li>Loading overview…</li>';
  try {
    const r = await (await fetch('/api/records')).json();
    const m = new Date().toISOString().slice(0, 7);
    const c = (f) => r.filter(f).length;
    $('#stats').innerHTML = '<li><strong>' + r.length + '</strong>Total records</li><li><strong>' + c(x => x.date.startsWith(m)) + '</strong>This month</li><li><strong>' + c(x => x.type === 'Repair') + '</strong>Repairs</li>';
  } catch { $('#stats').innerHTML = '<li>Could not load the overview. Check your connection and refresh.</li>'; }
}

/* ---------- new record form ---------- */
$$('input[name=type]').forEach(r => r.addEventListener('change', toggleFault));
function toggleFault() { $('#fault-wrap').hidden = document.querySelector('input[name=type]:checked').value !== 'Repair'; }
$('#rec').addEventListener('reset', () => { setTimeout(() => { toggleFault(); summary('#f-summary', []); ['customer','reg','make','mileage','date','fault'].forEach(i => setErr(i, '')); $('#customer').focus(); say('Form cleared.'); }, 0); });
$('#date').max = new Date().toISOString().slice(0, 10);

function validate() {
  const f = new FormData($('#rec')), errs = [];
  const chk = (id, bad, msg) => { setErr(id, bad ? msg : ''); if (bad) errs.push([id, msg]); };
  chk('customer', !f.get('customer').trim(), 'Enter the customer name.');
  chk('reg', !/^[A-Za-z0-9 ]{2,8}$/.test(f.get('reg').trim()), 'Enter a registration plate of 2 to 8 letters or numbers, for example AB12 CDE.');
  chk('make', !f.get('make'), 'Choose the car make.');
  const mi = f.get('mileage').trim();
  chk('mileage', !/^\d{1,6}$/.test(mi), 'Enter the mileage as a whole number between 0 and 999999.');
  const d = f.get('date');
  chk('date', !d || d > new Date().toISOString().slice(0, 10), d ? 'The date of work cannot be in the future.' : 'Choose the date of work.');
  chk('fault', f.get('type') === 'Repair' && !f.get('fault').trim(), 'Describe the fault for this repair.');
  return errs;
}
$('#rec').addEventListener('submit', async e => {
  e.preventDefault();
  const errs = validate(); summary('#f-summary', errs);
  if (errs.length) return say('The form has ' + errs.length + ' problem' + (errs.length > 1 ? 's' : '') + '. Please correct them.', 'bad');
  const f = new FormData($('#rec'));
  const body = Object.fromEntries(f.entries()); body.work = f.getAll('work');
  const b = $('#save-btn'); b.disabled = true; b.textContent = 'Saving…'; b.setAttribute('aria-busy', 'true'); say('Saving record…');
  try {
    const r = await fetch('/api/records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error();
    const rec = await r.json();
    $('#rec').reset(); say('Saved: ' + rec.reg + ' for ' + rec.customer + '. You can enter the next record.', 'ok');
    $('#customer').focus();
  } catch { say('The record could not be saved. Check your connection and try again. Your entries are still in the form.', 'bad'); }
  b.disabled = false; b.textContent = 'Save record'; b.removeAttribute('aria-busy');
});

/* ---------- records table: search, filter, sort, paginate ---------- */
async function loadRecords() {
  $('#loading').hidden = false; $('#tbl').hidden = true; $('#pager').hidden = true; $('#empty').hidden = true; $('#count').textContent = '';
  try { records = await (await fetch('/api/records')).json(); }
  catch { $('#loading').hidden = true; return say('Records could not be loaded. Refresh to try again.', 'bad'); }
  $('#loading').hidden = true; render(false);
}
function render(announce) {
  const q = $('#q').value.trim().toLowerCase(), t = $('#ft').value;
  let list = records.filter(r => (!t || r.type === t) && (!q || [r.customer, r.reg, r.make].join(' ').toLowerCase().includes(q)));
  list.sort((a, b) => { const x = a[sort.k], y = b[sort.k]; const c = typeof x === 'number' ? x - y : String(x).localeCompare(String(y)); return sort.dir === 'ascending' ? c : -c; });
  const pages = Math.max(1, Math.ceil(list.length / PAGE)); page = Math.min(page, pages);
  const slice = list.slice((page - 1) * PAGE, page * PAGE);
  const msg = 'Showing ' + slice.length + ' of ' + list.length + ' matching records (' + records.length + ' in total).';
  $('#count').textContent = msg; if (announce) say(msg);
  $('#empty').hidden = list.length > 0; $('#tbl').hidden = !list.length; $('#pager').hidden = !list.length;
  $('#rows').innerHTML = '';
  slice.forEach(r => {
    const tr = document.createElement('tr');
    [['Date', r.date], ['Customer', r.customer], ['Plate', r.reg], ['Make', r.make], ['Mileage', r.mileage.toLocaleString()], ['Type', r.type]].forEach(([l, v]) => {
      const td = document.createElement('td'); td.dataset.label = l; td.textContent = v; tr.appendChild(td);
    });
    const td = document.createElement('td'); td.dataset.label = 'Actions';
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-del'; b.textContent = 'Delete';
    b.setAttribute('aria-label', 'Delete record for ' + r.reg);
    b.addEventListener('click', () => del(r));
    td.appendChild(b); tr.appendChild(td); $('#rows').appendChild(tr);
  });
  $('#pginfo').textContent = 'Page ' + page + ' of ' + pages;
  $('#prev').disabled = page <= 1; $('#next').disabled = page >= pages;
  $$('#tbl th[data-k]').forEach(th => th.setAttribute('aria-sort', th.dataset.k === sort.k ? sort.dir : 'none'));
}
async function del(r) {
  if (!confirm('Delete the record for ' + r.reg + ' (' + r.customer + ')? This cannot be undone.')) return;
  await fetch('/api/records/' + r.id, { method: 'DELETE' });
  records = records.filter(x => x.id !== r.id); render(false); say('Record for ' + r.reg + ' deleted.', 'ok'); $('#q').focus();
}
$('#q').addEventListener('input', () => { page = 1; render(true); });
$('#ft').addEventListener('change', () => { page = 1; render(true); });
$('#filters').addEventListener('submit', e => e.preventDefault());
$('#clear-f').addEventListener('click', () => { $('#q').value = ''; $('#ft').value = ''; page = 1; render(true); $('#q').focus(); });
$('#prev').addEventListener('click', () => { page--; render(false); });
$('#next').addEventListener('click', () => { page++; render(false); });
$$('#tbl th[data-k] button').forEach(btn => btn.addEventListener('click', () => {
  const k = btn.parentElement.dataset.k;
  sort = { k, dir: sort.k === k && sort.dir === 'ascending' ? 'descending' : 'ascending' };
  render(false); say('Sorted by ' + btn.textContent + ', ' + sort.dir + '.');
}));

route();

/* Optional real photos: shown only if the files exist in public/img */
(function () {
  const probe = (src, ok) => { const i = new Image(); i.onload = ok; i.src = src; };
  probe('img/dash.jpg', () => document.body.classList.add('dash-photo'));
  probe('img/car.jpg', () => document.body.classList.add('hero-photo'));
})();
