/* =========================================================
   NOTFLİX — Landing Site · JS
   ========================================================= */
(function () {
  'use strict';

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------- splash ekranı (otomatik kapanır) ---------- */
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
      setTimeout(function () {
        if (splash.parentNode) splash.parentNode.removeChild(splash);
      }, 900);
    };
    // otomatik: 4.2 saniye sonra kendiliğinden kaybolur
    setTimeout(closeSplash, 4200);
    var splashSkip = $('#splashSkip');
    if (splashSkip) splashSkip.addEventListener('click', closeSplash);
    splash.addEventListener('click', function () {
      if (Date.now() - splashStart > 900) closeSplash();
    });
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        closeSplash();
        document.removeEventListener('keydown', onKey);
      }
    });
  }

  /* ---------- nav: sticky görünüm ---------- */
  var nav = $('#nav');
  var onScrollNav = function () {
    if (!nav) return;
    nav.classList.toggle('is-stuck', window.scrollY > 12);
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
  var sections = ['anasayfa', 'ozellikler', 'indir', 'sss']
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
    }, { rootMargin: '-45% 0px -50% 0px' });
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
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealables.forEach(function (el) { revealObs.observe(el); });
  } else {
    revealables.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---------- özellik slider ---------- */
  var track = $('#sliderTrack');
  var prevBtn = $('#sliderPrev');
  var nextBtn = $('#sliderNext');
  var dotsWrap = $('#sliderDots');

  if (track) {
    var cards = $$('.fcard', track);
    var dots = [];

    var scrollToCard = function (index) {
      var card = cards[index];
      if (!card) return;
      track.scrollTo({ left: card.offsetLeft - track.offsetLeft - 8, behavior: 'smooth' });
    };

    if (dotsWrap && cards.length) {
      cards.forEach(function (_, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('aria-label', 'Özellik ' + (i + 1));
        b.addEventListener('click', function () { scrollToCard(i); });
        dotsWrap.appendChild(b);
        dots.push(b);
      });
    }

    var activeIndex = function () {
      var min = Infinity, idx = 0;
      cards.forEach(function (c, i) {
        var d = Math.abs(c.offsetLeft - track.offsetLeft - track.scrollLeft);
        if (d < min) { min = d; idx = i; }
      });
      return idx;
    };

    var syncDots = function () {
      var i = activeIndex();
      dots.forEach(function (d, k) { d.classList.toggle('is-on', k === i); });
    };

    if (prevBtn) prevBtn.addEventListener('click', function () {
      scrollToCard(Math.max(0, activeIndex() - 1));
    });
    if (nextBtn) nextBtn.addEventListener('click', function () {
      scrollToCard(Math.min(cards.length - 1, activeIndex() + 1));
    });

    var scrollTimer;
    track.addEventListener('scroll', function () {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(syncDots, 90);
    });

    /* otomatik kaydırma (fare üzerindeyken durur) */
    var auto = null;
    var startAuto = function () {
      if (auto) return;
      auto = setInterval(function () {
        var next = activeIndex() + 1;
        if (next >= cards.length) next = 0;
        scrollToCard(next);
      }, 5200);
    };
    var stopAuto = function () { clearInterval(auto); auto = null; };

    var sliderWrap = track.closest('.slider');
    if (sliderWrap) {
      sliderWrap.addEventListener('mouseenter', stopAuto);
      sliderWrap.addEventListener('mouseleave', startAuto);
      sliderWrap.addEventListener('focusin', stopAuto);
    }
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stopAuto(); else startAuto();
    });
    startAuto();
    syncDots();
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

  /* ---------- yıl ---------- */
  $$('[data-year]').forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });
})();
