/* ============================================================
   Sylvenson Richard — Portfolio interactions
   Author: JRiSpace | Sylvenson Richard
   ============================================================ */

/* ---------- Language switching ---------- */
let currentLang = localStorage.getItem('lang') || 'en';

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

/* ---------- Navbar ---------- */
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 40);
});

const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');
navToggle.addEventListener('click', () => navLinks.classList.toggle('open'));
navLinks.querySelectorAll('a').forEach((a) =>
  a.addEventListener('click', () => navLinks.classList.remove('open'))
);

/* ---------- Reveal on scroll ---------- */
const revealTargets = document.querySelectorAll('.section-head, .about-grid, .exp-card, .srv-card, .process-step, .contact-grid');
revealTargets.forEach((el) => el.classList.add('reveal'));
const io = new IntersectionObserver(
  (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } }),
  { threshold: 0.12 }
);
revealTargets.forEach((el) => io.observe(el));

/* ---------- Init ---------- */
applyLang(currentLang);
