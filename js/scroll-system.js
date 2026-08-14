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
     The three brand objects and the background planes. Scrubbed, slow, and
     kept inside an animation zone that does not intrude on the reading column.

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

    try { localStorage.setItem('preferred-lang', lang); } catch (e) {}

    ScrollTrigger.refresh();
  };

  var stored = null;
  try { stored = localStorage.getItem('preferred-lang'); } catch (e) {}
  window.setLanguage(stored || 'en');

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

  function revealHero(cfg) {
    // The hero is above the fold, so its copy reveals on load rather than on
    // a scroll position it would never reach.
    var els = qa('.hero-eyebrow, .hero-title, .hero-subtitle, .hero-buttons, .hero-scroll-hint');
    if (!els.length) return;
    gsap.from(els, {
      y: cfg.text.rise + 5,
      opacity: 0,
      duration: 1,
      stagger: 0.09,
      ease: 'power3.out',
      delay: 0.15,
      clearProps: 'transform'
    });
  }

  /* ─────────────────────────────────────────────────────────────────────
     VISUAL LAYER
     ───────────────────────────────────────────────────────────────────── */

  function buildVisuals(cfg) {
    var mark = q('[data-obj="mark"]');
    var ring = q('[data-obj="ring"]');
    var shards = qa('[data-obj="shard"]');
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

    if (!mark || !ring) return;

    gsap.set([mark, ring].concat(shards), { xPercent: -50, yPercent: -50 });

    /* ---- idle life ----------------------------------------------------
       On the inner image only, so it can never contend with the scrubbed
       transform on the wrapper. */
    var idle = function (el, vars) {
      return gsap.to(el.querySelector('img'), Object.assign({
        repeat: -1, yoyo: true, ease: 'sine.inOut'
      }, vars));
    };

    idle(mark, { y: cfg.idle.float, duration: 5.2 });
    idle(ring, { scale: 1.02, duration: 8 });

    // The ring is the only object whose geometry supports a full turn, and it
    // turns very slowly. Everything else oscillates within a few degrees.
    var ringSpin = gsap.to(ring.querySelector('img'), {
      rotation: 360, duration: cfg.idle.ringTurn, ease: 'none', repeat: -1, paused: true
    });

    var spins = [ringSpin];
    shards.forEach(function (el, i) {
      var dir = i % 2 ? 1 : -1;
      spins.push(gsap.to(el.querySelector('img'), {
        rotation: dir * cfg.idle.shardTilt,
        duration: 9 + i * 2.5,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
        paused: true
      }));
      idle(el, { y: (5 + i * 1.5) * dir, duration: 5 + i * 0.8 });
    });

    // Continuous motion only runs where the objects are actually on screen.
    var from = q('[data-scene="hero"]'), to = q('[data-scene="contact"]');
    if (from && to) {
      ScrollTrigger.create({
        trigger: from, start: 'top bottom', endTrigger: to, end: 'bottom bottom',
        onToggle: function (self) {
          spins.forEach(function (t) { self.isActive ? t.play() : t.pause(); });
        }
      });
    } else {
      spins.forEach(function (t) { t.play(); });
    }

    /* ---- the animation zone -------------------------------------------
       Every home position is expressed as a fraction of the viewport and
       biased away from the reading column, so an object can drift without
       ever landing on top of copy. */
    var zone = cfg.zone;
    var home = {
      mark:  { x: zone.markX,  y: -0.04 },
      ring:  { x: zone.ringX,  y:  0.03 },
      shard: [
        { x: zone.near,  y: -0.26 },
        { x: zone.far,   y: -0.06 },
        { x: zone.near,  y:  0.22 },
        { x: zone.far,   y:  0.30 },
        { x: zone.mid,   y: -0.34 }
      ]
    };

    var X = function (f) { return function () { return vw(100) * f; }; };
    var Y = function (f) { return function () { return vh(100) * f; }; };

    // Depth bands, in the ranges a premium site actually uses.
    var drift = function (el) {
      var d = el.dataset.depth;
      return d === 'fg' ? cfg.drift.fg : d === 'mid' ? cfg.drift.mid : cfg.drift.bg;
    };

    /* Absolute vertical position for a shard in a given act. Accumulated
       drift is computed from the act index rather than from the element's
       current transform, so scrolling up reproduces the way down exactly. */
    var shardY = function (el, i, act) {
      return function () {
        return vh(100) * home.shard[i].y - drift(el) * act;
      };
    };
    var markY = function (act, extra) {
      return function () { return vh(100) * (extra == null ? home.mark.y : extra) - cfg.drift.fg * act; };
    };

    /* Act windows tile edge to edge rather than overlapping. Two timelines
       animating one object at the same time resolve in whichever order they
       last rendered, which makes the frame depend on the direction you
       arrived from — the scroll stops being reversible. */
    var scene = function (name, vars) {
      var section = q('[data-scene="' + name + '"]');
      if (!section) return null;
      return gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: Object.assign({
          trigger: section,
          start: 'top center',
          end: 'bottom center',
          scrub: cfg.scrub,
          invalidateOnRefresh: true
        }, vars)
      });
    };

    var hero = q('[data-scene="hero"]');

    /* ── SAFE ZONE ──────────────────────────────────────────────────────
       The reading area is measured from the copy itself rather than assumed,
       because the headline's width changes with viewport, language and font
       loading. Objects are then placed in whatever space is genuinely left:
       beside the copy when there is room, below it when there is not. */
    function placeClear(el, prefer) {
      var copy = qa('.hero-title, .hero-subtitle, .hero-buttons, .hero-eyebrow', hero);
      if (!copy.length) return { x: X(prefer.x)(), y: Y(prefer.y)(), opacity: 1 };

      var right = 0, bottom = 0;
      copy.forEach(function (c) {
        var range = document.createRange();
        range.selectNodeContents(c);
        Array.prototype.forEach.call(range.getClientRects(), function (r) {
          if (r.width < 4) return;
          right = Math.max(right, r.right);
          bottom = Math.max(bottom, r.bottom);
        });
      });

      var w = el.offsetWidth, h = el.offsetHeight;
      var gutter = 28;
      var free = window.innerWidth - right - gutter;

      if (free >= w * 0.82) {
        // Enough room beside the copy: centre the object in what is left.
        var cx = right + gutter + Math.min(w, free) / 2;
        return { x: cx - window.innerWidth / 2, y: Y(prefer.y)(), opacity: 1 };
      }

      // No horizontal room — drop the object below the copy and dim it, so a
      // narrow screen never has an object competing with the headline.
      return {
        x: X(prefer.x * 0.5)(),
        y: Math.max(bottom + gutter + h / 2, window.innerHeight * 0.62) - window.innerHeight / 2,
        opacity: 0.55
      };
    }

    /* ── HERO — the only strong sequence on the page ───────────────────── */
    if (hero) {
      var markSpot = placeClear(mark, home.mark);
      var ringSpot = placeClear(ring, home.ring);

      gsap.set(mark, { x: markSpot.x, y: markSpot.y, scale: cfg.mark.hero * (markSpot.opacity < 1 ? 0.8 : 1), opacity: markSpot.opacity });
      gsap.set(ring, { x: ringSpot.x, y: ringSpot.y, scale: 0.82, opacity: cfg.ring.hero });
      shards.forEach(function (el, i) {
        var spot = placeClear(el, home.shard[i]);
        gsap.set(el, {
          x: spot.x, y: spot.y,
          scale: cfg.shard.scale,
          // Only fragments that found clear space are shown at all.
          opacity: (i < cfg.shard.visible && spot.opacity === 1) ? cfg.shard.opacity : 0
        });
      });

      var t = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: hero,
          start: 'top top',
          end: '+=' + cfg.hero.pin + '%',
          pin: true,
          pinSpacing: true,
          scrub: cfg.scrub,
          invalidateOnRefresh: true
        }
      });

      // The composition breathes and settles; nothing lunges at the camera.
      t.to(mark, { scale: cfg.mark.hero * 1.08, rotation: cfg.rot.mark, y: markSpot.y - cfg.drift.fg }, 0)
        .to(ring, { scale: 0.92, rotation: cfg.rot.ring, opacity: cfg.ring.mid, y: ringSpot.y + cfg.drift.bg }, 0);

      shards.forEach(function (el, i) {
        t.to(el, { y: shardY(el, i, 1), rotation: (i % 2 ? 1 : -1) * cfg.rot.shard }, 0);
      });

      // Hero copy leaves on opacity alone — no transform, so it stays sharp
      // right up to the moment it goes.
      t.to(qa('.hero-eyebrow, .hero-title, .hero-subtitle, .hero-buttons, .hero-scroll-hint'), {
        opacity: 0, stagger: 0.04
      }, 0.72);
    }

    /* ── SITUATION — quiet: objects drift, nothing else ────────────────── */
    var s2 = scene('situation');
    if (s2) {
      s2.to(mark, { x: X(zone.markX + 0.06), scale: cfg.mark.small, rotation: -cfg.rot.mark }, 0)
        .to(ring, { opacity: cfg.ring.low, scale: 0.86, rotation: -cfg.rot.ring }, 0);
      shards.forEach(function (el, i) {
        s2.to(el, { y: shardY(el, i, 2.2), x: X(home.shard[i].x + 0.03) }, i * 0.03);
      });
    }

    /* ── WHO — the ring starts becoming the subject ────────────────────── */
    var s3 = scene('who');
    if (s3) {
      s3.to(ring, { opacity: cfg.ring.mid, scale: 1, x: X(zone.ringX - 0.04), rotation: cfg.rot.ring }, 0)
        .to(mark, { x: X(zone.edge), scale: cfg.mark.small * 0.96, opacity: cfg.mark.quiet, y: Y(-0.14) }, 0);
      shards.forEach(function (el, i) {
        s3.to(el, { y: shardY(el, i, 3.2), rotation: (i % 2 ? -1 : 1) * cfg.rot.shard }, i * 0.03);
      });
    }

    /* ── SYSTEM — the one medium sequence: the ring as the metaphor ────── */
    var system = q('[data-scene="system"]');
    if (system) {
      var t2 = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: system,
          start: 'top top',
          end: '+=' + cfg.system.pin + '%',
          pin: true,
          pinSpacing: true,
          scrub: cfg.scrub,
          invalidateOnRefresh: true
        }
      });

      // It moves toward centre but stays dim, and a scrim sits between it and
      // the copy, so the orbital lines never fight the text.
      t2.to(ring, { x: X(zone.ringCentre), scale: cfg.ring.systemScale, opacity: cfg.ring.system, rotation: cfg.rot.ring * 1.5 }, 0)
        .to(mark, { scale: cfg.mark.small * 0.92, opacity: cfg.mark.quiet, x: X(zone.edge) }, 0);
      shards.forEach(function (el, i) {
        t2.to(el, { opacity: cfg.shard.opacity * 0.5, y: shardY(el, i, 4) }, i * 0.03);
      });
    }

    /* ── WORK — cases stay calm; only depth drift ──────────────────────── */
    var s5 = scene('work');
    if (s5) {
      s5.to(ring, { x: X(zone.ringX), opacity: cfg.ring.low, scale: 0.9, rotation: -cfg.rot.ring }, 0)
        .to(mark, { x: X(zone.edge), scale: cfg.mark.small, opacity: cfg.mark.quiet, y: Y(0.1) }, 0);
      shards.forEach(function (el, i) {
        s5.to(el, { y: shardY(el, i, 4.9) }, i * 0.03);
      });
    }

    /* ── APPROACH — almost nothing ─────────────────────────────────────── */
    var s6 = scene('approach');
    if (s6) {
      s6.to(ring, { x: X(-zone.edge), opacity: cfg.ring.low * 0.7, rotation: cfg.rot.ring * 0.6 }, 0)
        .to(mark, { x: X(zone.edge), scale: cfg.mark.hero * 0.95, opacity: cfg.mark.quiet, y: Y(-0.06) }, 0);
      shards.forEach(function (el, i) {
        s6.to(el, { opacity: cfg.shard.opacity * 0.35, y: shardY(el, i, 5.5) }, i * 0.03);
      });
    }

    /* ── CONTACT — the conversion point: the calmest frame on the page ─── */
    var s7 = scene('contact');
    if (s7) {
      // Objects retreat to the edges and dim; nothing sits behind the CTA.
      s7.to(mark, { x: X(zone.edge), y: Y(-0.02), scale: cfg.mark.hero * 0.9, opacity: cfg.mark.quiet }, 0)
        .to(ring, { x: X(-zone.edge), opacity: cfg.ring.low * 0.6, scale: 0.85 }, 0)
        .to(shards, { opacity: 0, stagger: 0.03 }, 0);
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
        scrub: 1.1,
        text: { rise: 20, duration: 0.85, stagger: 0.07 },
        depth: { bg: 40, mid: 70 },
        drift: { bg: 30, mid: 60, fg: 105 },
        rot: { mark: 6, ring: 10, shard: 5 },
        idle: { float: -12, ringTurn: 240, shardTilt: 4 },
        hero: { pin: 90 },
        system: { pin: 80 },
        mark: { hero: 1, small: 0.9, quiet: 0.55 },
        ring: { hero: 0.16, low: 0.2, mid: 0.3, system: 0.34, systemScale: 1.12 },
        shard: { scale: 0.9, opacity: 0.55, visible: 5 },
        // Objects live right of the reading column.
        zone: { markX: 0.30, ringX: 0.26, ringCentre: 0.16, near: 0.22, mid: 0.30, far: 0.38, edge: 0.40 }
      };
      revealHero(cfg); revealText(cfg); buildVisuals(cfg);
    });

    // Mobile — roughly half the movement, no wide travel, fewer shards.
    mm.add('(max-width: 900px) and (prefers-reduced-motion: no-preference)', function () {
      var cfg = {
        scrub: 1.2,
        text: { rise: 14, duration: 0.8, stagger: 0.06 },
        depth: { bg: 18, mid: 30 },
        drift: { bg: 14, mid: 26, fg: 44 },
        rot: { mark: 4, ring: 8, shard: 3 },
        idle: { float: -6, ringTurn: 300, shardTilt: 3 },
        hero: { pin: 45 },
        system: { pin: 40 },
        mark: { hero: 0.85, small: 0.78, quiet: 0.26 },
        ring: { hero: 0.12, low: 0.16, mid: 0.22, system: 0.24, systemScale: 1 },
        // Only three fragments on a phone; the rest never fade in.
        shard: { scale: 0.72, opacity: 0.28, visible: 3 },
        zone: { markX: 0.26, ringX: 0.22, ringCentre: 0.12, near: 0.24, mid: 0.30, far: 0.34, edge: 0.34 }
      };
      revealHero(cfg); revealText(cfg); buildVisuals(cfg);
    });

    // Reduced motion — no parallax, no pins, no continuous movement.
    mm.add('(prefers-reduced-motion: reduce)', function () {
      gsap.set('.obj', { opacity: 0.18 });
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
    if (!reduced) initScenes();

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
