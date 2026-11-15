/* =========================================================
   NOTFLİX — Landing Site · JS (v1.0.19)
   ========================================================= */
(function () {
  'use strict';

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var ready = function () { document.body.classList.add('is-ready'); };

  /* ---------- splash / intro ---------- */
  var splash = $('#splash');
  if (splash) {
    document.body.classList.add('is-splash');
    var splashStart = Date.now();
    var splashDone = false;
    var closeSplash = function () {
      if (splashDone) return;
      splashDone = true;
      splash.classList.add('is-done');
      document.body.classList.remove('is-splash');
      ready();
      setTimeout(function () {
        if (splash.parentNode) splash.parentNode.removeChild(splash);
      }, 900);
    };
    // otomatik: 3.4 saniye sonra kendiliğinden kaybolur
    setTimeout(closeSplash, 3400);
    var splashSkip = $('#splashSkip');
    if (splashSkip) splashSkip.addEventListener('click', closeSplash);
    splash.addEventListener('click', function () {
      if (Date.now() - splashStart > 700) closeSplash();
    });
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        closeSplash();
        document.removeEventListener('keydown', onKey);
      }
    });
  } else {
    ready();
  }

  /* ---------- nav: sticky görünüm ---------- */
  var head = $('#siteHead');
  var onScrollNav = function () {
    if (!head) return;
    head.classList.toggle('is-stuck', window.scrollY > 12);
  };
  window.addEventListener('scroll', onScrollNav, { passive: true });
  onScrollNav();

  /* ---------- mobil menü ---------- */
  var navToggle = $('#navToggle');
  var navLinks = $('#navLinks');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function () {
      var open = navLinks.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      navToggle.setAttribute('aria-label', open ? 'Menüyü kapat' : 'Menüyü aç');
    });
    $$('#navLinks a').forEach(function (a) {
      a.addEventListener('click', function () {
        navLinks.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && navLinks.classList.contains('is-open')) {
        navLinks.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.focus();
      }
    });
  }

  /* ---------- scroll spy ---------- */
  var sections = ['anasayfa', 'ozellikler', 'altyazi', 'cihazlar', 'kurulum', 'indir', 'sss']
    .map(function (id) { return document.getElementById(id); })
    .filter(Boolean);
  var navAnchors = $$('.nav__link');
  if (sections.length && 'IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navAnchors.forEach(function (a) {
          a.classList.toggle('is-active', a.getAttribute('href') === '#' + entry.target.id);
        });
      });
    }, { rootMargin: '-42% 0px -52% 0px' });
    sections.forEach(function (s) { spy.observe(s); });
  }

  /* ---------- reveal animasyonları ---------- */
  var revealables = $$('.reveal');
  if ('IntersectionObserver' in window) {
    var revealObs = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });
    revealables.forEach(function (el) { revealObs.observe(el); });
  } else {
    revealables.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---------- SSS akordiyon (aynı anda tek soru açık) ---------- */
  var accItems = $$('#faq .acc__item');
  accItems.forEach(function (item) {
    item.addEventListener('click', function (e) {
      if (!e.target.closest('summary')) return;
      if (item.open) return;
      accItems.forEach(function (other) {
        if (other !== item) other.open = false;
      });
    });
  });

  /* ---------- yukarı çık ---------- */
  var toTop = $('#toTop');
  if (toTop) {
    window.addEventListener('scroll', function () {
      toTop.classList.toggle('is-on', window.scrollY > 600);
    }, { passive: true });
    toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ---------- sağ tık / kopyalama / geliştirici araçları engellendi ---------- */
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  document.addEventListener('dragstart', function (e) { e.preventDefault(); });
  document.addEventListener('copy', function (e) { e.preventDefault(); });
  document.addEventListener('cut', function (e) { e.preventDefault(); });
  document.addEventListener('selectstart', function (e) { e.preventDefault(); });
  document.addEventListener('keydown', function (e) {
    var k = (e.key || '').toUpperCase();
    var dev = k === 'F12' ||
      (e.ctrlKey && e.shiftKey && (k === 'I' || k === 'J' || k === 'C')) ||
      (e.ctrlKey && k === 'U');
    if (dev) { e.preventDefault(); return false; }
    if (e.ctrlKey && (k === 'C' || k === 'X' || k === 'A')) { e.preventDefault(); return false; }
  });

  /* ---------- canlı saat (Türkiye) ---------- */
  var liveClock = $('#liveClock');
  if (liveClock) {
    var clockFmt;
    try {
      clockFmt = new Intl.DateTimeFormat('tr-TR', {
        timeZone: 'Europe/Istanbul',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hourCycle: 'h23'
      });
    } catch (e) {
      clockFmt = new Intl.DateTimeFormat('tr-TR', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hourCycle: 'h23'
      });
    }
    var tickClock = function () {
      liveClock.textContent = clockFmt.format(new Date());
    };
    tickClock();
    setInterval(tickClock, 1000);
  }
})();
