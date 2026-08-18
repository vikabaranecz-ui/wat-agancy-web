/* ===========================================================================
   WAT? Agency — scroll motion system
   ---------------------------------------------------------------------------
   Two layers, deliberately governed by different rules.

   TEXT LAYER
     Reveals once, on a normal (non-scrubbed) tween, then clears its transform
     and never moves again. A scrubbed tween would tie the copy to the wheel,
     which is what made the previous build unreadable. Text is only ever
     translated a few pixels and faded; it is never scaled, rotated or blurred,
     and it always paints above the visual layer.

   VISUAL LAYER
     The hero video is scrubbed by scroll while the background planes retain
     a shallow parallax. Hero copy remains fixed and readable.

   Motion hierarchy: hero is the only place with a strong sequence, one system
   scene carries a medium one, and everything else is deliberately quiet.
   =========================================================================== */

(function () {
  'use strict';

  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;

  if (!gsap || !ScrollTrigger) {
    document.documentElement.classList.add('no-motion');
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var lenis = null;

  /* ─────────────────────────────────────────────────────────────────────
     LANGUAGE + MENU
     ───────────────────────────────────────────────────────────────────── */

  window.setLanguage = function setLanguage(lang) {
    var root = document.documentElement;
    root.setAttribute('data-lang', lang);
    root.setAttribute('lang', lang);

    Array.prototype.forEach.call(document.querySelectorAll('.lang-btn'), function (btn) {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    try { localStorage.setItem('preferred-lang-v2', lang); } catch (e) {}

    document.dispatchEvent(new CustomEvent('wat:language', { detail: { lang: lang } }));
    ScrollTrigger.refresh();
  };

  var stored = null;
  try { stored = localStorage.getItem('preferred-lang-v2'); } catch (e) {}
  window.setLanguage(stored || 'nl');

  function initMenu() {
    var burger = document.getElementById('nav-burger');
    var navLinks = document.getElementById('nav-links');
    if (!burger || !navLinks) return;

    function setMenu(open) {
      document.body.classList.toggle('menu-open', open);
      burger.setAttribute('aria-expanded', String(open));
      if (lenis) { open ? lenis.stop() : lenis.start(); }
    }

    burger.addEventListener('click', function () {
      setMenu(!document.body.classList.contains('menu-open'));
    });
    navLinks.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setMenu(false);
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 900) setMenu(false);
    });

    var nav = document.getElementById('nav');
    if (nav) {
      ScrollTrigger.create({
        start: 0,
        end: 'max',
        onUpdate: function (self) { nav.classList.toggle('scrolled', self.scroll() > 50); }
      });
    }
  }

  /* ─────────────────────────────────────────────────────────────────────
     SMOOTH SCROLL — a single Lenis instance on the GSAP ticker
     ───────────────────────────────────────────────────────────────────── */

  function initSmoothScroll() {
    if (reduced || !window.Lenis) return;

    lenis = new window.Lenis({
      duration: 1.1,
      smoothWheel: true,
      wheelMultiplier: 0.85,
      touchMultiplier: 1,
      // Native momentum on touch stays more usable than an emulated curve.
      syncTouch: false
    });

    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);

    window.__watScroll = lenis;   // handle for automated checks
  }

  function initAnchors() {
    document.addEventListener('click', function (e) {
      var link = e.target.closest('a[href^="#"]');
      if (!link) return;
      var id = link.getAttribute('href');
      if (!id || id === '#') return;
      var target = document.querySelector(id);
      if (!target) return;

      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.1 });
      else target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });

      if (window.history && history.pushState) history.pushState(null, '', id);
    });

    window.addEventListener('popstate', function () {
      var target = location.hash && document.querySelector(location.hash);
      if (!target) return;
      if (lenis) lenis.scrollTo(target, { offset: 0, duration: 0.8 });
      else target.scrollIntoView();
    });

    if (location.hash) {
      var initial = document.querySelector(location.hash);
      if (initial) {
        requestAnimationFrame(function () {
          if (lenis) lenis.scrollTo(initial, { immediate: true });
          else initial.scrollIntoView();
          ScrollTrigger.refresh();
        });
      }
    }
  }

  /* ─────────────────────────────────────────────────────────────────────
     HELPERS
     ───────────────────────────────────────────────────────────────────── */

  var q = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var qa = function (sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  };
  var vh = function (n) { return window.innerHeight * (n / 100); };
  var vw = function (n) { return window.innerWidth * (n / 100); };

  /* ─────────────────────────────────────────────────────────────────────
     TEXT LAYER
     One reveal per group, then the transform is cleared so the copy renders
     as ordinary static text for as long as it is on screen.
     ───────────────────────────────────────────────────────────────────── */

  function revealText(cfg) {
    qa('[data-scene]').forEach(function (section) {
      // Groups reveal in order, but each group's members share one short
      // stagger — no element is left drifting after its neighbours arrive.
      var groups = [
        qa('.section-label, h2', section),
        qa('.lead, .pain-verdict p', section),
        qa('.pain-item, .who-card, .system-node, .approach-item, .work-card', section),
        qa('.hero-buttons, .cta-content .btn, .trust-copy', section)
      ];

      groups.forEach(function (els, gi) {
        if (!els.length) return;
        gsap.from(els, {
          y: cfg.text.rise,
          opacity: 0,
          duration: cfg.text.duration,
          stagger: els.length > 3 ? cfg.text.stagger : cfg.text.stagger * 1.4,
          ease: 'power3.out',
          delay: gi * 0.06,
          // The whole point: once revealed, the element carries no transform,
          // so text rasterises normally instead of through the compositor.
          clearProps: 'transform',
          scrollTrigger: {
            trigger: section,
            start: 'top 72%',
            once: true
          }
        });
      });
    });
  }

  /* ─────────────────────────────────────────────────────────────────────
     VISUAL LAYER
     ───────────────────────────────────────────────────────────────────── */

  function buildVisuals(cfg) {
    var hero = q('[data-scene="hero"]');
    var videos = qa('[data-hero-video]');
    var planes = { bg: q('[data-plane="bg"]'), mid: q('[data-plane="mid"]') };

    /* ---- background planes: the shallowest parallax on the page -------- */
    if (planes.bg) {
      gsap.to(planes.bg, {
        y: function () { return -cfg.depth.bg; },
        ease: 'none',
        scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 1.2, invalidateOnRefresh: true }
      });
      gsap.to(planes.mid, {
        y: function () { return -cfg.depth.mid; },
        ease: 'none',
        scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 1.1, invalidateOnRefresh: true }
      });
    }

    if (hero && videos.length) {
      var activeVideo = function (lang) {
        var currentLang = lang || document.documentElement.getAttribute('data-lang') || 'nl';
        return videos.find(function (item) { return item.dataset.langVideo === currentLang; }) || videos[0];
      };

      var seekVideo = function (progress, lang) {
        var video = activeVideo(lang);
        if (!video || !isFinite(video.duration) || video.duration <= 0) return;
        if (!video.paused) video.pause();
        var targetTime = Math.min(video.duration - 0.01, progress * video.duration);
        if (Math.abs(video.currentTime - targetTime) > 0.04) video.currentTime = targetTime;
      };

      videos.forEach(function (video) {
        video.muted = true;
        video.load();
        video.pause();
        if (video.readyState >= 1) video.currentTime = 0.01;
      });

      var videoTrigger = ScrollTrigger.create({
        trigger: hero,
        start: 'top top',
        end: '+=' + cfg.hero.pin + '%',
        pin: true,
        pinSpacing: true,
        scrub: cfg.scrub,
        invalidateOnRefresh: true,
        onUpdate: function (self) { seekVideo(self.progress); }
      });

      var primeVideo = function (video, lang) {
        if (!video) return;
        video.muted = true;
        var finish = function () {
          video.pause();
          seekVideo(videoTrigger.progress, lang || video.dataset.langVideo);
        };
        var playback = null;
        try { playback = video.play(); } catch (e) { finish(); }
        if (playback && typeof playback.then === 'function') playback.then(finish).catch(finish);
        else finish();
        window.setTimeout(finish, 80);
      };

      videos.forEach(function (video) {
        video.addEventListener('play', function () {
          window.setTimeout(function () {
            video.pause();
            if (video === activeVideo()) seekVideo(videoTrigger.progress);
          }, 0);
        });
        video.addEventListener('loadedmetadata', function () {
          if (video === activeVideo()) seekVideo(videoTrigger.progress);
        }, { once: true });
        video.addEventListener('loadeddata', function () {
          if (video === activeVideo()) {
            video.pause();
            seekVideo(videoTrigger.progress);
          }
        }, { once: true });
      });

      var syncVideoLanguage = function (event) {
        var lang = event && event.detail ? event.detail.lang : document.documentElement.getAttribute('data-lang');
        var current = activeVideo(lang);
        videos.forEach(function (video) {
          video.pause();
          if (video !== current && video.readyState >= 1) video.currentTime = 0.01;
        });
        if (event) primeVideo(current, lang);
        seekVideo(videoTrigger.progress, lang);
        ScrollTrigger.refresh();
      };

      if (window.__watVideoLanguageHandler) {
        document.removeEventListener('wat:language', window.__watVideoLanguageHandler);
      }
      window.__watVideoLanguageHandler = syncVideoLanguage;
      document.addEventListener('wat:language', window.__watVideoLanguageHandler);
      syncVideoLanguage();

      var unlockVideo = function () {
        primeVideo(activeVideo());
      };
      document.addEventListener('touchstart', unlockVideo, { once: true, passive: true });
      document.addEventListener('pointerdown', unlockVideo, { once: true, passive: true });
    }

  }

  /* ─────────────────────────────────────────────────────────────────────
     RESPONSIVE TIERS
     ───────────────────────────────────────────────────────────────────── */

  function initScenes() {
    var mm = gsap.matchMedia();

    // Desktop — parallax within the 20–120px band, rotation within 5–12deg.
    mm.add('(min-width: 901px) and (prefers-reduced-motion: no-preference)', function () {
      var cfg = {
        scrub: 0.5,
        text: { rise: 20, duration: 0.85, stagger: 0.07 },
        depth: { bg: 40, mid: 70 },
        hero: { pin: 160 },
      };
      revealText(cfg); buildVisuals(cfg);
    });

    // Mobile — roughly half the movement, no wide travel.
    mm.add('(max-width: 900px) and (prefers-reduced-motion: no-preference)', function () {
      var cfg = {
        scrub: 0.35,
        text: { rise: 14, duration: 0.8, stagger: 0.06 },
        depth: { bg: 18, mid: 30 },
        hero: { pin: 110 },
      };
      revealText(cfg); buildVisuals(cfg);
    });

    // Reduced motion — no parallax, no pins, no continuous movement.
    mm.add('(prefers-reduced-motion: reduce)', function () {
      qa('[data-hero-video]').forEach(function (video) {
        video.pause();
        video.currentTime = 0;
      });
      return function () {};
    });
  }

  /* ─────────────────────────────────────────────────────────────────────
     BOOT
     ───────────────────────────────────────────────────────────────────── */

  function boot() {
    initSmoothScroll();
    initMenu();
    initAnchors();
    initScenes();

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
    }
    window.addEventListener('load', function () { ScrollTrigger.refresh(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
