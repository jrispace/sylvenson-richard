/* ============================================================
   Sylvenson Richard — Portfolio interactions
   Author: JRiSpace | Sylvenson Richard
   ============================================================ */

/* ---------- Language switching ---------- */
const SUPPORTED_LANGUAGES = ['en', 'fr', 'ht', 'es'];
const DEFAULT_LANGUAGE = 'en';

function detectBrowserLanguage() {
  const candidates = [
    ...(navigator.languages || []),
    ...(navigator.language ? [navigator.language] : []),
  ];
  for (const candidate of candidates) {
    const base = candidate.split('-')[0].toLowerCase();
    if (SUPPORTED_LANGUAGES.includes(base)) return base;
  }
  return DEFAULT_LANGUAGE;
}

let currentLang = localStorage.getItem('lang');
if (!currentLang || !SUPPORTED_LANGUAGES.includes(currentLang)) {
  currentLang = detectBrowserLanguage();
}

function applyLang(lang) {
  const dict = I18N[lang];
  if (!dict) return;
  currentLang = lang;
  localStorage.setItem('lang', lang);
  document.documentElement.lang = lang;

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) el.textContent = dict[key];
  });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => {
    const key = el.getAttribute('data-i18n-ph');
    if (dict[key]) el.setAttribute('placeholder', dict[key]);
  });
  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
  restartTyping();
  document.dispatchEvent(new CustomEvent('langchange', { detail: lang }));
}

document.querySelectorAll('.lang-btn').forEach((btn) => {
  btn.addEventListener('click', () => applyLang(btn.dataset.lang));
});

/* ---------- Typing effect ---------- */
let typingTimer = null;
function restartTyping() {
  if (typingTimer) clearTimeout(typingTimer);
  const words = I18N[currentLang].typing;
  const el = document.getElementById('typed');
  let wordIdx = 0, charIdx = 0, deleting = false;

  function tick() {
    const word = words[wordIdx];
    el.textContent = word.slice(0, charIdx);
    if (!deleting) {
      if (charIdx < word.length) { charIdx++; typingTimer = setTimeout(tick, 70); }
      else { deleting = true; typingTimer = setTimeout(tick, 1900); }
    } else {
      if (charIdx > 0) { charIdx--; typingTimer = setTimeout(tick, 35); }
      else { deleting = false; wordIdx = (wordIdx + 1) % words.length; typingTimer = setTimeout(tick, 350); }
    }
  }
  tick();
}

/* ---------- Navbar & mobile drawer ---------- */
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 40);
});

const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');
const navOverlay = document.getElementById('navOverlay');

function setDrawer(open) {
  navLinks.classList.toggle('open', open);
  navToggle.classList.toggle('open', open);
  navOverlay.classList.toggle('show', open);
  document.body.classList.toggle('nav-locked', open);
}
navToggle.addEventListener('click', () => setDrawer(!navLinks.classList.contains('open')));
navOverlay.addEventListener('click', () => setDrawer(false));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setDrawer(false); });
navLinks.querySelectorAll('a').forEach((a) =>
  a.addEventListener('click', () => setDrawer(false))
);

/* ---------- Bottom nav scroll-spy ---------- */
const bottomItems = document.querySelectorAll('.bottom-nav-item');
const spySections = ['hero', 'about', 'services', 'work', 'contact']
  .map((id) => document.getElementById(id))
  .filter(Boolean);

function updateSpy() {
  const pos = window.scrollY + window.innerHeight * 0.35;
  let current = spySections[0];
  for (const s of spySections) {
    if (s.offsetTop <= pos) current = s;
  }
  bottomItems.forEach((it) => it.classList.toggle('active', it.dataset.section === current.id));
}
window.addEventListener('scroll', updateSpy, { passive: true });
window.addEventListener('resize', updateSpy);
updateSpy();

/* ---------- Reveal on scroll ---------- */
const revealTargets = document.querySelectorAll('.section-head, .about-grid, .exp-card, .srv-card, .process-step, .contact-grid, .pf-card');
revealTargets.forEach((el) => el.classList.add('reveal'));
const io = new IntersectionObserver(
  (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } }),
  { threshold: 0.12 }
);
revealTargets.forEach((el) => io.observe(el));

/* ---------- Contact form (Web3Forms) ---------- */
const contactForm = document.getElementById('contactForm');
const formFeedback = document.getElementById('formFeedback');

if (contactForm) {
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = contactForm.querySelector('button[type="submit"]');
    const origText = submitBtn.textContent;
    submitBtn.textContent = '...';
    submitBtn.disabled = true;
    formFeedback.className = 'form-feedback';
    formFeedback.textContent = '';

    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        body: new FormData(contactForm)
      });
      const data = await res.json();

      if (res.ok && data.success !== false) {
        formFeedback.textContent = I18N[currentLang]['ct.success'] || 'Message sent!';
        formFeedback.className = 'form-feedback success';
        contactForm.reset();
      } else {
        formFeedback.textContent = (I18N[currentLang]['ct.error'] || 'Error: ') + (data.message || '');
        formFeedback.className = 'form-feedback error';
      }
    } catch {
      formFeedback.textContent = I18N[currentLang]['ct.error'] || 'Something went wrong. Please try again.';
      formFeedback.className = 'form-feedback error';
    }

    submitBtn.textContent = origText;
    submitBtn.disabled = false;
  });
}

/* ---------- Init ---------- */
applyLang(currentLang);

/* ------------------------------------------------------------
   Catalogue — books and songs are generated by scripts/fetch-*.py
   and rendered here at runtime. No data is hard-coded in the HTML.
   ------------------------------------------------------------ */
const catalogue = { books: null, songs: null };

function tr(key, vars) {
  const dict = (I18N[currentLang] || I18N.en) || {};
  let out = dict[key] || (I18N.en && I18N.en[key]) || key;
  if (vars) Object.keys(vars).forEach((k) => { out = out.replace('{' + k + '}', vars[k]); });
  return out;
}

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

function icon(pathD) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', pathD);
  p.setAttribute('fill', 'currentColor');
  svg.appendChild(p);
  return svg;
}

/* ---------- Books ---------- */
function renderBooks() {
  const grid = document.getElementById('booksGrid');
  if (!grid || !catalogue.books || !catalogue.books.length) return;

  grid.textContent = '';
  catalogue.books.forEach((b) => {
    const card = el('article', 'book-card');

    const coverLink = el('a', 'book-cover');
    coverLink.href = b.url;
    coverLink.target = '_blank';
    coverLink.rel = 'noopener noreferrer';
    coverLink.setAttribute('aria-label', b.title + ' — Amazon');
    if (b.cover) {
      const img = el('img');
      img.src = b.cover;
      img.alt = b.title;
      img.loading = 'lazy';
      img.width = 625;
      img.height = 1000;
      coverLink.appendChild(img);
    }
    card.appendChild(coverLink);

    const body = el('div', 'book-body');
    const badgeBits = [tr('bk.kindle')];
    if (b.language) badgeBits.push(b.language);
    body.appendChild(el('span', 'book-badge', badgeBits.filter(Boolean).join(' · ')));
    body.appendChild(el('h3', 'book-title', b.title.replace(/\s*\((French|English|Spanish) Edition\)\s*$/i, '')));
    if (b.description) body.appendChild(el('p', 'book-sub', b.description));

    const meta = el('ul', 'book-meta');
    if (b.pages) meta.appendChild(el('li', null, tr('bk.pages', { n: b.pages })));
    if (b.language) meta.appendChild(el('li', null, b.language));
    if (b.price) meta.appendChild(el('li', null, (b.currency || '') + b.price));
    if (meta.children.length) body.appendChild(meta);

    const buy = el('a', 'btn btn-primary book-buy');
    buy.href = b.url;
    buy.target = '_blank';
    buy.rel = 'noopener noreferrer';
    buy.appendChild(el('span', null, tr('bk.buy')));
    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    arrow.setAttribute('viewBox', '0 0 24 24');
    arrow.setAttribute('width', '16');
    arrow.setAttribute('height', '16');
    arrow.setAttribute('fill', 'none');
    arrow.setAttribute('stroke', 'currentColor');
    arrow.setAttribute('stroke-width', '2');
    [['M7 17 17 7'], ['M9 7h8v8']].forEach(([d]) => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      arrow.appendChild(path);
    });
    buy.appendChild(arrow);
    body.appendChild(buy);

    card.appendChild(body);
    grid.appendChild(card);
  });
  grid.dataset.synced = '1';
}

/* ---------- Songs ---------- */
const previewAudio = new Audio();
previewAudio.preload = 'none';
let playingId = null;

function setPlaying(id) {
  playingId = id;
  document.querySelectorAll('.song-card').forEach((card) => {
    const on = card.dataset.songId === id;
    card.classList.toggle('is-playing', on);
    const btn = card.querySelector('.song-play');
    if (btn) btn.setAttribute('aria-label', on ? tr('sg.pause') : tr('sg.listen'));
  });
}

previewAudio.addEventListener('ended', () => setPlaying(null));
previewAudio.addEventListener('pause', () => { if (previewAudio.ended === false && playingId) { /* keep state until explicit stop */ } });

function togglePreview(song, card) {
  if (!song.preview) return;
  if (playingId === song.id && !previewAudio.paused) {
    previewAudio.pause();
    setPlaying(null);
    return;
  }
  previewAudio.pause();
  previewAudio.src = song.preview;
  previewAudio.play().then(() => setPlaying(song.id)).catch(() => setPlaying(null));
}

function renderSongs() {
  const grid = document.getElementById('songsGrid');
  if (!grid || !catalogue.songs || !catalogue.songs.length) return;

  grid.textContent = '';
  catalogue.songs.forEach((s) => {
    const card = el('article', 'song-card');
    card.dataset.songId = s.id;

    const art = el('div', 'song-art');
    if (s.art) {
      const img = el('img');
      img.src = s.art;
      img.alt = s.title + ' — ' + s.artist;
      img.loading = 'lazy';
      img.width = 600;
      img.height = 600;
      art.appendChild(img);
    }
    if (s.preview) {
      const btn = el('button', 'song-play');
      btn.type = 'button';
      btn.setAttribute('aria-label', tr('sg.listen'));
      const play = icon('M8 5v14l11-7z');
      play.classList.add('ico-play');
      const pause = icon('M6 5h4v14H6zM14 5h4v14h-4z');
      pause.classList.add('ico-pause');
      btn.appendChild(play);
      btn.appendChild(pause);
      btn.addEventListener('click', () => togglePreview(s, card));
      art.appendChild(btn);
    }
    card.appendChild(art);

    card.appendChild(el('h3', 'song-title', s.title));
    card.appendChild(el('p', 'song-artist', s.artist));

    const foot = el('div', 'song-foot');
    foot.appendChild(el('span', 'song-year', (s.released || '').slice(0, 4) || (s.genre || '')));
    if (s.url) {
      const link = el('a', 'song-link', tr('sg.open'));
      link.href = s.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      arrow.setAttribute('viewBox', '0 0 24 24');
      arrow.setAttribute('fill', 'none');
      arrow.setAttribute('stroke', 'currentColor');
      arrow.setAttribute('stroke-width', '2');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M7 17 17 7');
      arrow.appendChild(path);
      link.appendChild(arrow);
      foot.appendChild(link);
    }
    card.appendChild(foot);
    grid.appendChild(card);
  });
  grid.dataset.synced = '1';
  if (playingId) setPlaying(playingId);
}

async function loadCatalogue() {
  try {
    const res = await fetch('books.json', { cache: 'no-store' });
    if (res.ok) { const d = await res.json(); catalogue.books = d.books || []; renderBooks(); }
  } catch { /* keep the static fallback card */ }

  try {
    const res = await fetch('songs.json', { cache: 'no-store' });
    if (res.ok) { const d = await res.json(); catalogue.songs = d.songs || []; renderSongs(); }
  } catch { /* section stays empty */ }
}

document.addEventListener('langchange', () => {
  if (catalogue.books && catalogue.books.length) renderBooks();
  if (catalogue.songs && catalogue.songs.length) renderSongs();
});

loadCatalogue();
