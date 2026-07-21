import { getCurrentWindow } from '@tauri-apps/api/window';
import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile, exists, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs';
import { openUrl } from '@tauri-apps/plugin-opener';
import { parseVCard } from './vcard.js';

const win = getCurrentWindow();
document.getElementById('btnClose').addEventListener('click', () => win.close());
document.getElementById('btnMin').addEventListener('click', () => win.minimize());
document.getElementById('btnZoom').addEventListener('click', () => win.toggleMaximize());

const CACHE_FILE = 'contacts.json';
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

let contacts = [];
let filtered = [];
let idx = 0;
let animating = false;
let currentCard = null;

const stage = document.getElementById('stage');
const indexEl = document.getElementById('index');
const footer = document.getElementById('footer');
const emptyOverlay = document.getElementById('emptyOverlay');
const searchInput = document.getElementById('search');

function sortKey(c) { return (c.family || c.name || '').trim().toUpperCase(); }
function firstLetter(c) { const ch = sortKey(c).charAt(0); return /[A-Z]/.test(ch) ? ch : '#'; }
function initials(name) {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

async function ensureAppDataDir() {
  const dirExists = await exists('', { baseDir: BaseDirectory.AppData }).catch(() => false);
  if (!dirExists) await mkdir('', { baseDir: BaseDirectory.AppData, recursive: true });
}

async function loadCache() {
  try {
    const has = await exists(CACHE_FILE, { baseDir: BaseDirectory.AppData });
    if (!has) return null;
    const text = await readTextFile(CACHE_FILE, { baseDir: BaseDirectory.AppData });
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function saveCache(data) {
  await ensureAppDataDir();
  await writeTextFile(CACHE_FILE, JSON.stringify(data), { baseDir: BaseDirectory.AppData });
}

async function importVCard() {
  const path = await open({
    multiple: false,
    filters: [{ name: 'vCard', extensions: ['vcf'] }]
  });
  if (!path) return;
  const raw = await readTextFile(path);
  const parsed = parseVCard(raw);
  contacts = parsed;
  await saveCache(parsed);
  filtered = contacts.slice();
  idx = 0;
  renderInitial();
}

document.getElementById('btnImport').addEventListener('click', importVCard);
document.getElementById('btnImportEmpty').addEventListener('click', importVCard);

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function normalizeUrl(v) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`;
}

function linkField(key, display, openUrl) {
  return `<div class="field"><span class="k">${esc(key)}</span><span class="v"><a href="${esc(openUrl)}" data-open="${esc(openUrl)}">${esc(display)}</a></span></div>`;
}

function cardHTML(c) {
  const letter = firstLetter(c);
  const org = c.org ? `<p class="company">${esc(c.org)}</p>` : '';
  const role = c.title ? `<p class="role">${esc(c.title)}</p>` : '';
  const avatarInner = c.photo ? `<img src="${c.photo}" alt="">` : esc(initials(c.name));
  let fieldsHTML = '';
  if (c.tel?.length) {
    fieldsHTML += `<div class="group-label">Phone</div>`;
    c.tel.forEach(t => fieldsHTML += linkField(t.label, t.value, `tel:${t.value.replace(/[^\d+*#,;]/g, '')}`));
  }
  if (c.email?.length) {
    fieldsHTML += `<div class="group-label">Email</div>`;
    c.email.forEach(e => fieldsHTML += linkField('email', e, `mailto:${e}`));
  }
  if (c.url?.length) {
    fieldsHTML += `<div class="group-label">Website</div>`;
    c.url.forEach(u => fieldsHTML += linkField(u.label, u.value, normalizeUrl(u.value)));
  }
  if (c.note) {
    fieldsHTML += `<div class="group-label">Notes</div>`;
    fieldsHTML += `<div class="field note"><span class="v note-text">${esc(c.note)}</span></div>`;
  }
  if (c.adr?.length) {
    fieldsHTML += `<div class="group-label">Address</div>`;
    c.adr.forEach(a => fieldsHTML += `<div class="field"><span class="k">${esc(a.label)}</span><span class="v">${esc(a.value)}</span></div>`);
  }
  if (!fieldsHTML) fieldsHTML = `<div class="field"><span class="v" style="color:rgba(60,60,67,0.4)">No additional details</span></div>`;
  return `
    <div class="letter-tag">${letter}</div>
    <div class="avatar">${avatarInner}</div>
    <p class="name">${esc(c.name)}</p>
    ${org}${role}
    <div class="divider"></div>
    <div class="fields">${fieldsHTML}</div>`;
}

function renderInitial() {
  emptyOverlay.classList.toggle('visible', contacts.length === 0);
  stage.innerHTML = '';
  if (!filtered.length) { footer.textContent = contacts.length ? 'No matches' : ''; renderIndexLetters(); return; }
  currentCard = document.createElement('div');
  currentCard.className = 'card';
  currentCard.innerHTML = cardHTML(filtered[idx]);
  stage.appendChild(currentCard);
  updateFooterAndIndex();
}

function goTo(newIdx) {
  if (!filtered.length || newIdx === idx || animating) { idx = newIdx; return; }
  const dir = newIdx > idx ? 1 : -1;
  idx = Math.max(0, Math.min(filtered.length - 1, newIdx));
  animating = true;
  const outCard = currentCard;
  outCard.classList.add(dir === 1 ? 'slide-out-up' : 'slide-out-down');
  const inCard = document.createElement('div');
  inCard.className = 'card ' + (dir === 1 ? 'slide-in-from-bottom-start' : 'slide-in-from-top-start');
  inCard.innerHTML = cardHTML(filtered[idx]);
  stage.appendChild(inCard);
  void inCard.offsetWidth;
  requestAnimationFrame(() => {
    inCard.classList.remove('slide-in-from-bottom-start', 'slide-in-from-top-start');
    inCard.classList.add('slide-settled');
  });
  inCard.addEventListener('transitionend', function done() {
    inCard.removeEventListener('transitionend', done);
    outCard.remove();
    animating = false;
  }, { once: true });
  currentCard = inCard;
  updateFooterAndIndex();
}

function updateFooterAndIndex() {
  footer.textContent = `${idx + 1} of ${filtered.length} contacts`;
  renderIndexLetters();
}

function renderIndexLetters() {
  const presentLetters = new Set(contacts.map(firstLetter));
  const activeLetter = filtered.length ? firstLetter(filtered[idx]) : null;
  indexEl.innerHTML = ALPHABET.map(l => {
    const present = presentLetters.has(l);
    const isCurrent = l === activeLetter;
    const cls = isCurrent ? 'idx-letter current' : (present ? 'idx-letter' : 'idx-letter dim');
    return `<div class="${cls}" data-l="${l}">${l}</div>`;
  }).join('');
}

function jumpToLetter(letter) {
  const i = filtered.findIndex(c => firstLetter(c) === letter);
  if (i >= 0) goTo(i);
}

searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim().toLowerCase();
  filtered = q ? contacts.filter(c => c.name.toLowerCase().includes(q) || (c.org && c.org.toLowerCase().includes(q))) : contacts.slice();
  idx = 0;
  renderInitial();
});

let scrubbing = false;
indexEl.addEventListener('pointerdown', e => { scrubbing = true; handleScrub(e); });
window.addEventListener('pointermove', e => { if (scrubbing) handleScrub(e); });
window.addEventListener('pointerup', () => scrubbing = false);
function handleScrub(e) {
  const target = document.elementFromPoint(e.clientX, e.clientY);
  if (target?.classList.contains('idx-letter')) jumpToLetter(target.dataset.l);
}
indexEl.addEventListener('pointerover', e => {
  const t = e.target.closest('.idx-letter');
  if (t && !t.classList.contains('dim')) jumpToLetter(t.dataset.l);
});
stage.addEventListener('click', e => {
  const link = e.target.closest('a[data-open]');
  if (!link) return;
  e.preventDefault();
  openUrl(link.dataset.open).catch(err => console.error('Failed to open', link.dataset.open, err));
});
stage.addEventListener('wheel', e => {
  e.preventDefault();
  if (animating || !filtered.length) return;
  if (e.deltaY > 0) goTo(Math.min(idx + 1, filtered.length - 1));
  else goTo(Math.max(idx - 1, 0));
}, { passive: false });

const datetimeEl = document.getElementById('datetime');
function updateDateTime() {
  const now = new Date();
  const date = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const time = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  datetimeEl.textContent = `${date} · ${time}`;
}
updateDateTime();
setInterval(updateDateTime, 1000);

(async function init() {
  const cached = await loadCache();
  contacts = cached || [];
  filtered = contacts.slice();
  renderInitial();
})();
