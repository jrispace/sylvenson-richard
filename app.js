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
const revealTargets = document.querySelectorAll('.section-head, .about-grid, .exp-card, .srv-card, .process-step, .contact-grid');
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
