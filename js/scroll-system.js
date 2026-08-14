/* ===========================================================================
   WAT? Agency — scroll-driven scene system
   ---------------------------------------------------------------------------
   Scroll is the transport for one continuous timeline. Every scene is scrubbed,
   so stopping at any scroll position leaves a valid frame — nothing here plays
   on a timer.

   Layout model:
     .stage           fixed planes (bg / mid / brand mark / fg) that never stop
                      moving, which is what carries continuity across the seams
                      between sections.
     .scene           a section that owns a timeline.

   Incoming scenes use a "pre-roll" start (>100% of the viewport) so they begin
   entering while the previous scene is still leaving. That overlap is what
   removes the visible boundary between sections.
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

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------------
     1. LANGUAGE + MENU
     Kept here so the page has a single script owner. setLanguage stays on
     window because the toggle buttons call it from inline handlers.
     --------------------------------------------------------------------- */

  var lenis = null;

  window.setLanguage = function setLanguage(lang) {
    var root = document.documentElement;
    root.setAttribute('data-lang', lang);
    root.setAttribute('lang', lang);

    Array.prototype.forEach.call(document.querySelectorAll('.lang-btn'), function (btn) {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    try {
      localStorage.setItem('preferred-lang', lang);
    } catch (e) {
      /* private mode — the toggle still works for this session */
    }

    // Swapping languages changes text metrics, so every measurement is stale.
    ScrollTrigger.refresh();
  };

  var storedLang = null;
  try {
    storedLang = localStorage.getItem('preferred-lang');
  } catch (e) {
    storedLang = null;
  }
  window.setLanguage(storedLang || 'en');

  function initMenu() {
    var burger = document.getElementById('nav-burger');
    var navLinks = document.getElementById('nav-links');
    if (!burger || !navLinks) return;

    function setMenu(open) {
      document.body.classList.toggle('menu-open', open);
      burger.setAttribute('aria-expanded', String(open));
      // Lenis owns scrolling, so pausing it is the correct scroll lock.
      if (lenis) {
        open ? lenis.stop() : lenis.start();
      } else {
        document.body.style.overflow = open ? 'hidden' : '';
      }
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
        onUpdate: function (self) {
          nav.classList.toggle('scrolled', self.scroll() > 50);
        }
      });
    }
  }

  /* ---------------------------------------------------------------------
     2. SMOOTH SCROLL
     One Lenis instance, driven by the GSAP ticker so both clocks agree.
     --------------------------------------------------------------------- */

  function initSmoothScroll() {
    if (prefersReducedMotion || !window.Lenis) return;

    lenis = new window.Lenis({
      smoothWheel: true,
      lerp: 0.1,
      wheelMultiplier: 1,
      touchMultiplier: 1.7,
      // Native momentum on touch beats an emulated curve for usability.
      syncTouch: false
    });

    lenis.on('scroll', ScrollTrigger.update);

    gsap.ticker.add(function (time) {
      lenis.raf(time * 1000);
    });

    gsap.ticker.lagSmoothing(0);

    // Read-only handle so automated checks can jump to an exact offset
    // (lenis.scrollTo(y, {immediate:true})) instead of fighting the easing.
    window.__watScroll = lenis;
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

      if (lenis) {
        lenis.scrollTo(target, { offset: 0, duration: 1.1 });
      } else {
        target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
      }

      // preventDefault stops the browser writing the hash, so do it here —
      // deep links, sharing and the back button all depend on it.
      if (window.history && history.pushState) {
        history.pushState(null, '', id);
      }
    });

    // Back/forward between in-page anchors.
    window.addEventListener('popstate', function () {
      var target = location.hash && document.querySelector(location.hash);
      if (!target) return;
      if (lenis) lenis.scrollTo(target, { offset: 0, duration: 0.8 });
      else target.scrollIntoView();
    });

    // A hash in the URL on first load must survive Lenis taking over.
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

  /* ---------------------------------------------------------------------
     3. HELPERS
     --------------------------------------------------------------------- */

  var vh = function (n) { return window.innerHeight * (n / 100); };
  var vw = function (n) { return window.innerWidth * (n / 100); };

  // Marks a scene as compositing-heavy only while it is actually on screen.
  function layerHint(trigger, elements) {
    return {
      onToggle: function (self) {
        elements.forEach(function (el) {
          if (el) el.classList.toggle('is-animating', self.isActive);
        });
      }
    };
  }

  function scrub(config) {
    return Object.assign({ scrub: 0.6, invalidateOnRefresh: true }, config);
  }

  /* ---------------------------------------------------------------------
     4. SCENES
     --------------------------------------------------------------------- */

  function buildScenes(cfg) {
    var q = function (sel, ctx) { return (ctx || document).querySelector(sel); };
    var qa = function (sel, ctx) {
      return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
    };

    /* ---- STAGE: the camera. One timeline for the whole document. ------- */
    var planes = {
      bg: q('[data-plane="bg"]'),
      mid: q('[data-plane="mid"]'),
      fg: q('[data-plane="fg"]')
    };

    if (planes.bg) {
      // Depth ratios: background drifts least, foreground most.
      gsap.to(planes.bg, scrub({
        y: function () { return -vh(cfg.depth.bg); },
        ease: 'none',
        scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 0.8 }
      }));

      gsap.to(planes.mid, scrub({
        y: function () { return -vh(cfg.depth.mid); },
        x: function () { return -vh(cfg.depth.mid) * 0.12; },
        ease: 'none',
        scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 0.5 }
      }));
    }

    /* ═══════════════════════════════════════════════════════════════════
       THE OBJECT FILM

       Three brand objects are choreographed across the whole page as one
       continuous sequence in five acts. Each act is anchored to the section
       whose scroll window it belongs to, and the windows tile edge to edge
       (`top center` → `bottom center`), so consecutive acts hand over without
       gaps and without two timelines ever owning the same transform.

       Every act uses .to() from whatever state the previous act left behind,
       which is what makes any scroll position a valid frame in both
       directions.
       ═══════════════════════════════════════════════════════════════════ */
    function buildObjectFilm() {
      var mark = q('[data-obj="mark"]');
      var ring = q('[data-obj="ring"]');
      var shards = qa('[data-obj="shard"]');
      if (!mark || !ring || !shards.length) return;

      var all = [mark, ring].concat(shards);

      // Centre every object on the viewport; from here the choreography is
      // written in viewport units so it stays composed at any screen size.
      gsap.set(all, { xPercent: -50, yPercent: -50 });

      var o = cfg.obj;

      /* ---- idle life ---------------------------------------------------
         Runs on the inner image, independent of scroll, so the objects are
         alive before the first wheel event and never freeze mid-scene. */
      var idle = function (el, vars) {
        return gsap.to(el.querySelector('img'), Object.assign({
          repeat: -1, yoyo: true, ease: 'sine.inOut'
        }, vars));
      };

      idle(mark, { y: o.float, duration: 4.6 });
      idle(mark, { rotation: 2.2, duration: 7.4 });

      // The artwork carries three concentric orbits, so one slowly turning
      // element already reads as a layered orbital system.
      var spins = [];

      spins.push(gsap.to(ring.querySelector('img'), {
        rotation: 360, duration: 150, ease: 'none', repeat: -1, paused: true
      }));
      idle(ring, { scale: 1.03, duration: 6.2 });

      shards.forEach(function (el, i) {
        var dir = i % 2 ? 1 : -1;
        spins.push(gsap.to(el.querySelector('img'), {
          rotation: dir * 360,
          duration: 74 + i * 21,          // every shard turns at its own rate
          ease: 'none',
          repeat: -1,
          paused: true
        }));
        idle(el, { y: (6 + i * 2) * dir, duration: 4.2 + i * 0.7 });
      });

      /* Rotating a large alpha texture costs a composite every frame, so the
         spins only run across the stretch of the page where these objects are
         actually on screen. */
      var spinFrom = q('[data-scene="situation"]');
      var spinTo = q('[data-scene="contact"]');
      if (spinFrom && spinTo) {
        ScrollTrigger.create({
          trigger: spinFrom,
          start: 'top bottom',
          endTrigger: spinTo,
          end: 'bottom bottom',
          onToggle: function (self) {
            spins.forEach(function (t) { self.isActive ? t.play() : t.pause(); });
          }
        });
      } else {
        spins.forEach(function (t) { t.play(); });
      }

      /* ---- act helper --------------------------------------------------
         One timeline per section, tiled so they never overlap. */
      var act = function (sceneName, isFirst) {
        var section = q('[data-scene="' + sceneName + '"]');
        if (!section) return null;
        return gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: section,
            start: isFirst ? 'top top' : 'top center',
            end: 'bottom center',
            scrub: o.scrub,
            invalidateOnRefresh: true
          }
        });
      };

      // Shard destinations, expressed as fractions of the viewport so the
      // composition holds together on any screen.
      var field = [
        { x: -0.30, y: -0.18, s: 1.00, rx: -12, ry: 22 },
        { x:  0.30, y: -0.24, s: 0.92, rx:  16, ry: -18 },
        { x:  0.34, y:  0.22, s: 0.86, rx: -10, ry: 26 },
        { x: -0.34, y:  0.24, s: 0.80, rx:  14, ry: -22 },
        { x:  0.05, y: -0.34, s: 0.74, rx: -18, ry: 14 }
      ];
      var at = function (i, key, mul) {
        return function () {
          var f = field[i % field.length];
          return (key === 'x' ? vw(100) : vh(100)) * f[key] * (mul == null ? 1 : mul);
        };
      };

      /* ── ACT 1 · HERO — the question mark is the main character ───────── */
      var a1 = act('hero', true);
      if (a1) {
        a1.fromTo(mark,
          { scale: o.markIn, z: 0, rotationX: 0, rotationY: 0, rotation: 0, opacity: 1 },
          { scale: o.markHero, z: o.push, rotationY: 14, rotationX: -8, rotation: -5 }, 0)
          // Camera drifts as the mark grows, then the mark clears the frame
          // for what comes next.
          .to(mark, { y: function () { return -vh(o.markExit); }, scale: o.markHero * 0.88, rotationY: 26 }, 0.62)
          // The ring is already waking up behind it — the scenes overlap.
          .fromTo(ring, { scale: 0.35, opacity: 0 }, { scale: 0.5, opacity: 0.14 }, 0.7);
      }

      /* ── ACT 2 · SITUATION — the mark breaks into a field of shards ───── */
      var a2 = act('situation');
      if (a2) {
        a2.to(mark, {
          x: function () { return -vw(o.markAside); },
          y: function () { return -vh(4); },
          scale: o.markSmall,
          rotationY: 38,
          rotation: -14,
          opacity: 0.5
        }, 0);

        shards.forEach(function (el, i) {
          var depth = el.dataset.depth;
          // Depth decides both how far and how fast a piece travels.
          var speed = depth === 'fg' ? 1 : depth === 'mid' ? 0.72 : 0.48;
          a2.fromTo(el,
            {
              x: function () { return at(i, 'x', 2.1)() * speed; },
              y: function () { return at(i, 'y', 2.1)() * speed; },
              scale: 0.5,
              rotationX: 0, rotationY: 0,
              opacity: 0
            },
            {
              x: at(i, 'x'),
              y: at(i, 'y'),
              scale: function () { return field[i].s * (depth === 'fg' ? 1.1 : depth === 'mid' ? 0.9 : 0.7); },
              rotationX: field[i].rx,
              rotationY: field[i].ry,
              opacity: depth === 'bg' ? 0.55 : depth === 'mid' ? 0.8 : 1
            },
            // Staggered entry, foreground first — reads as depth, not noise.
            0.04 + i * 0.07);
        });
      }

      /* ── ACT 3 · WHO + SYSTEM — the orbital system arrives ────────────── */
      var a3 = act('who');
      if (a3) {
        a3.to(ring, { scale: 0.86, opacity: 0.55, rotation: 8 }, 0)
          .to(mark, {
            x: function () { return vw(o.markAside * 0.5); },
            scale: o.markSmall * 0.8,
            rotationY: -18,
            opacity: 0.32
          }, 0);

        // Shards keep crossing the frame at their own speeds.
        shards.forEach(function (el, i) {
          var speed = el.dataset.depth === 'fg' ? 1 : el.dataset.depth === 'mid' ? 0.65 : 0.4;
          a3.to(el, {
            x: function () { return at(i, 'x', -0.55)() * speed; },
            y: function () { return at(i, 'y', 1.5)() * speed; },
            rotationY: field[i].ry * -1.4,
            rotationX: field[i].rx * -1.2
          }, i * 0.05);
        });
      }

      var a4 = act('system');
      if (a4) {
        // Camera pushes toward the ring: it becomes the whole frame.
        a4.to(ring, { scale: o.ringFull, opacity: 0.75, rotation: 18, z: o.push * 0.6 }, 0)
          .to(mark, { scale: o.markSmall * 0.62, opacity: 0.2, y: function () { return vh(6); } }, 0);

        shards.forEach(function (el, i) {
          a4.to(el, {
            x: at(i, 'x', 1.25),
            y: at(i, 'y', 1.3),
            opacity: el.dataset.depth === 'bg' ? 0.28 : 0.55,
            scale: function () { return field[i].s * 0.72; }
          }, i * 0.04);
        });
      }

      /* ── ACT 4 · WORK — everything belongs to one composition ─────────── */
      var a5 = act('work');
      if (a5) {
        a5.to(ring, { scale: o.ringFrame, opacity: 0.4, rotation: 26, z: 0 }, 0)
          // The mark comes back to the centre, forward of the ring.
          .to(mark, {
            x: 0, y: 0,
            scale: o.markCombined,
            rotationY: 10, rotationX: -6, rotation: 3,
            opacity: 0.85,
            z: o.push * 0.5
          }, 0);

        shards.forEach(function (el, i) {
          var speed = el.dataset.depth === 'fg' ? 1.15 : el.dataset.depth === 'mid' ? 0.8 : 0.5;
          a5.to(el, {
            x: function () { return at(i, 'x', 0.95)() * speed; },
            y: function () { return at(i, 'y', 0.95)() * speed; },
            scale: function () { return field[i].s * 0.9 * speed; },
            rotationY: field[i].ry * 0.6,
            opacity: el.dataset.depth === 'bg' ? 0.35 : 0.7
          }, i * 0.05);
        });
      }

      /* ── ACT 5 · APPROACH + CONTACT — the system resolves ─────────────── */
      var a6 = act('approach');
      if (a6) {
        // Shards drift outward and release the frame.
        shards.forEach(function (el, i) {
          a6.to(el, {
            x: at(i, 'x', 1.9),
            y: at(i, 'y', 1.9),
            scale: function () { return field[i].s * 0.55; },
            opacity: 0.12
          }, i * 0.05);
        });
        a6.to(ring, { scale: o.ringFrame * 0.94, opacity: 0.3, rotation: 32 }, 0)
          .to(mark, { scale: o.markCombined * 1.05, opacity: 0.9, rotationY: 4 }, 0);
      }

      var a7 = act('contact');
      if (a7) {
        // The payoff: the mark is the focal centre, framed by the ring.
        a7.to(mark, {
          x: 0, y: 0, z: 0,
          scale: o.markFinal,
          rotationX: 0, rotationY: 0, rotation: 0,
          opacity: 1
        }, 0)
          .to(ring, { scale: o.ringFinal, opacity: 0.5, rotation: 38 }, 0)
          .to(shards, { opacity: 0.06, scale: 0.4, stagger: 0.04 }, 0);
      }
    }

    buildObjectFilm();

    /* ---- HERO — Transition A --------------------------------------------
       Composition scales toward the camera and leaves through the top while
       the next scene pre-rolls in behind it. */
    var hero = q('[data-scene="hero"]');
    if (hero) {
      var heroTitle = q('[data-hero="title"]', hero);
      var heroWords = qa('.hero-title .en .word, .hero-title .nl .word', hero);
      var heroEyebrow = q('[data-hero="eyebrow"]', hero);
      var heroSub = q('[data-hero="subtitle"]', hero);
      var heroBtns = q('[data-hero="buttons"]', hero);
      var heroHint = q('[data-hero="hint"]', hero);

      var heroTl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: Object.assign({
          trigger: hero,
          start: 'top top',
          end: '+=' + cfg.hero.pin + '%',
          pin: true,
          pinSpacing: true,
          scrub: 0.6,
          invalidateOnRefresh: true
        }, layerHint(hero, [heroTitle, heroSub, heroBtns]))
      });

      // 0–30% — secondary elements peel outward at their own speeds.
      heroTl
        .to(heroHint, { opacity: 0, y: 20 }, 0)
        .to(heroEyebrow, { y: function () { return -vh(12); }, opacity: 0 }, 0)
        .to(heroSub, {
          y: function () { return vh(cfg.hero.subOut); },
          x: function () { return -cfg.hero.spread * 2; },
          opacity: 0
        }, 0.05)
        .to(heroBtns, {
          y: function () { return vh(cfg.hero.subOut * 1.4); },
          x: function () { return cfg.hero.spread * 2; },
          opacity: 0
        }, 0.02);

      // 0–100% — headline grows toward the viewer and its words separate.
      heroTl
        .to(heroTitle, {
          scale: cfg.hero.titleScale,
          y: function () { return -vh(cfg.hero.titleRise); }
        }, 0)
        .to(heroWords, {
          x: function (i, el) {
            var words = Array.prototype.slice.call(el.parentNode.children);
            var mid = (words.length - 1) / 2;
            return (words.indexOf(el) - mid) * cfg.hero.spread;
          }
        }, 0);

      // 55–100% — lines clip away inside their own boxes, top line first.
      heroTl.to(qa('.hero-title .en .line, .hero-title .nl .line', hero), {
        yPercent: -140,
        opacity: 0,
        stagger: 0.08
      }, 0.55);
    }

    /* ---- SITUATION — Transition E ---------------------------------------
       Background shifts while a depth field of cards resolves in front. */
    var situation = q('[data-scene="situation"]');
    if (situation) {
      var sitHead = qa('.section-label, h2, .lead', situation);
      var painItems = qa('.pain-item', situation);
      var verdict = q('.pain-verdict', situation);

      gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: Object.assign({
          trigger: situation,
          start: 'top ' + cfg.preroll + '%',   // pre-roll: begins while hero exits
          end: 'center center',
          scrub: 0.7,
          invalidateOnRefresh: true
        }, layerHint(situation, painItems))
      })
        .fromTo(sitHead,
          { y: function () { return vh(cfg.enter.head); }, opacity: 0 },
          { y: 0, opacity: 1, stagger: 0.06 }, 0)
        .fromTo(painItems,
          {
            y: function () { return vh(cfg.enter.card); },
            scale: cfg.enter.cardScale,
            opacity: 0
          },
          { y: 0, scale: 1, opacity: 1, stagger: 0.05 }, 0.1)
        .fromTo(verdict,
          { y: function () { return vh(cfg.enter.head); }, opacity: 0 },
          { y: 0, opacity: 1 }, 0.45);

      // Exit drift so the section is already leaving as the next pre-rolls.
      gsap.to(qa('.pain-list, .pain-verdict', situation), scrub({
        y: function () { return -vh(cfg.exit.drift); },
        opacity: 0.15,
        ease: 'none',
        scrollTrigger: {
          trigger: situation,
          start: 'center center',
          end: 'bottom top',
          scrub: 0.7
        }
      }));
    }

    /* ---- WHO — Transition C ---------------------------------------------
       The section heading crosses the screen while the cards assemble behind. */
    var who = q('[data-scene="who"]');
    if (who) {
      var whoHead = q('h2', who);
      var whoLabel = q('.section-label', who);
      var whoLead = q('.lead', who);
      var whoCards = qa('.who-card', who);

      gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: Object.assign({
          trigger: who,
          start: 'top ' + cfg.preroll + '%',
          end: 'bottom center',
          scrub: 0.7,
          invalidateOnRefresh: true
        }, layerHint(who, whoCards))
      })
        .fromTo(whoLabel, { opacity: 0, x: -30 }, { opacity: 1, x: 0 }, 0)
        // Heading sweeps across rather than fading in place.
        .fromTo(whoHead,
          { x: function () { return cfg.who.sweep; }, opacity: 0 },
          { x: 0, opacity: 1 }, 0)
        .fromTo(whoLead, { opacity: 0, y: 30 }, { opacity: 1, y: 0 }, 0.12)
        .fromTo(whoCards,
          {
            y: function () { return vh(cfg.enter.card); },
            scale: cfg.enter.cardScale,
            opacity: 0
          },
          { y: 0, scale: 1, opacity: 1, stagger: 0.045 }, 0.15)
        // Heading keeps travelling as the section hands over.
        .to(whoHead, { x: function () { return -cfg.who.sweep * 0.5; }, opacity: 0.15 }, 0.7);
    }

    /* ---- SYSTEM — Transition D (pinned) ---------------------------------
       Nine parts converge from a scattered field into the grid. */
    var system = q('[data-scene="system"]');
    if (system) {
      var sysNodes = qa('.system-node', system);
      var sysHead = qa('.section-label, h2, .lead', system);

      var sysTl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: Object.assign({
          trigger: system,
          start: 'top top',
          end: '+=' + cfg.system.pin + '%',
          pin: true,
          pinSpacing: true,
          scrub: 0.6,
          invalidateOnRefresh: true
        }, layerHint(system, sysNodes))
      });

      sysTl
        .fromTo(sysHead,
          { y: function () { return vh(10); }, opacity: 0 },
          { y: 0, opacity: 1, stagger: 0.05 }, 0)
        .fromTo(sysNodes,
          {
            // Deterministic scatter — index-derived, so it is identical on
            // every refresh and every reverse pass.
            x: function (i) { return (i % 3 - 1) * cfg.system.scatter; },
            y: function (i) { return (Math.floor(i / 3) - 1) * cfg.system.scatter * 0.8 + vh(12); },
            rotate: function (i) { return (i % 2 ? 1 : -1) * 5; },
            scale: 0.72,
            opacity: 0
          },
          {
            x: 0, y: 0, rotate: 0, scale: 1, opacity: 1,
            stagger: { each: 0.05, from: 'center' }
          }, 0.12)
        // Settled composition drifts back slightly — the camera pulling out.
        .to(qa('.system-grid', system), { scale: 0.94, y: function () { return -vh(6); } }, 0.72);
    }

    /* ---- WORK — camera pan across the projects (pinned) ------------------
       Instead of a slider: the viewport travels across the existing grid,
       making each project dominant in turn. */
    var work = q('[data-scene="work"]');
    if (work) {
      var workGrid = q('.work-grid', work);
      var workCards = qa('.work-card', work);
      var workHead = qa('.section-label, h2, .lead', work);

      if (workGrid && workCards.length) {
        var workTl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: Object.assign({
            trigger: work,
            start: 'top top',
            end: '+=' + cfg.work.pin + '%',
            pin: true,
            pinSpacing: true,
            scrub: 0.6,
            invalidateOnRefresh: true
          }, layerHint(work, workCards))
        });

        // Distance between the two cards, measured at refresh time so it
        // survives resizes, font loads and language switches.
        var panDistance = function () {
          if (workCards.length < 2) return 0;
          var a = workCards[0].getBoundingClientRect();
          var b = workCards[1].getBoundingClientRect();
          return cfg.work.vertical ? (b.top - a.top) : (b.left - a.left);
        };

        workTl
          .fromTo(workHead,
            { y: function () { return vh(8); }, opacity: 0 },
            { y: 0, opacity: 1, stagger: 0.05 }, 0)
          .fromTo(workCards[0],
            { scale: 0.88, opacity: 0.2 },
            { scale: 1, opacity: 1 }, 0.05)
          .fromTo(workCards[1],
            { scale: 0.7, opacity: 0.12 },
            { scale: 0.78, opacity: 0.3 }, 0.05)
          // Card 1 grows past the camera and leaves.
          .to(workCards[0], { scale: cfg.work.grow, opacity: 0 }, 0.45)
          // Camera pans to card 2, which rises to dominance.
          .to(workGrid, {
            x: function () { return cfg.work.vertical ? 0 : -panDistance(); },
            y: function () { return cfg.work.vertical ? -panDistance() : 0; }
          }, 0.45)
          .to(workCards[1], { scale: 1, opacity: 1 }, 0.5)
          .to(workCards[1], { scale: 1.04, y: function () { return -vh(4); } }, 0.85);
      }
    }

    /* ---- APPROACH — Transition B ----------------------------------------
       Rows part from alternating sides, revealing the content between them. */
    var approach = q('[data-scene="approach"]');
    if (approach) {
      var items = qa('.approach-item', approach);
      var apHead = qa('.section-label, h2', approach);

      gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: Object.assign({
          trigger: approach,
          start: 'top ' + cfg.preroll + '%',
          end: 'bottom center',
          scrub: 0.7,
          invalidateOnRefresh: true
        }, layerHint(approach, items))
      })
        .fromTo(apHead,
          { y: function () { return vh(8); }, opacity: 0 },
          { y: 0, opacity: 1, stagger: 0.06 }, 0)
        .fromTo(items,
          {
            x: function (i) { return (i % 2 ? 1 : -1) * cfg.approach.split; },
            opacity: 0
          },
          { x: 0, opacity: 1, stagger: 0.08 }, 0.1);
    }

    /* ---- CONTACT — the closing shot -------------------------------------
       Everything else has drifted away; the CTA scales up to own the frame. */
    var contact = q('[data-scene="contact"]');
    if (contact) {
      var ctaBlock = q('.cta-content', contact);
      var ctaHead = q('h2', contact);
      var ctaBtn = q('.btn', contact);
      var ctaLead = q('.lead', contact);
      var ctaTrust = q('.trust-copy', contact);

      gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: Object.assign({
          trigger: contact,
          start: 'top ' + cfg.preroll + '%',
          end: 'center center',
          scrub: 0.7,
          invalidateOnRefresh: true
        }, layerHint(contact, [ctaBlock]))
      })
        .fromTo(ctaBlock,
          { scale: cfg.contact.from, y: function () { return vh(14); }, opacity: 0 },
          { scale: 1, y: 0, opacity: 1 }, 0)
        .fromTo(ctaHead, { scale: 0.88, y: 24 }, { scale: 1, y: 0 }, 0)
        .fromTo(ctaLead, { opacity: 0, y: 24 }, { opacity: 1, y: 0 }, 0.35)
        .fromTo(ctaBtn, { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1 }, 0.5)
        .fromTo(ctaTrust, { opacity: 0 }, { opacity: 1 }, 0.7);
    }
  }

  /* ---------------------------------------------------------------------
     5. RESPONSIVE TIERS
     matchMedia reverts every tween and ScrollTrigger it created when the
     query stops matching — the vanilla equivalent of gsap.context cleanup.
     --------------------------------------------------------------------- */

  function initScenes() {
    var mm = gsap.matchMedia();

    // Desktop — long pins, wide travel, full depth.
    mm.add('(min-width: 901px) and (prefers-reduced-motion: no-preference)', function () {
      buildScenes({
        preroll: 128,
        depth: { bg: 22, mid: 58 },
        hero: { pin: 150, titleScale: 1.55, titleRise: 16, spread: 26, subOut: 26 },
        who: { sweep: 220 },
        system: { pin: 150, scatter: 190 },
        work: { pin: 170, grow: 1.6, vertical: false },
        approach: { split: 90 },
        contact: { from: 0.82 },
        enter: { head: 12, card: 18, cardScale: 0.86 },
        exit: { drift: 14 },
        obj: {
          scrub: 0.8,
          float: -16,          // idle hover distance, px
          push: 180,           // camera approach in Z, px
          markIn: 0.92, markHero: 1.32, markExit: 34,
          markAside: 26, markSmall: 0.5,
          markCombined: 0.72, markFinal: 1.15,
          ringFull: 1.35, ringFrame: 1.05, ringFinal: 1.25
        }
      });
    });

    // Mobile — shorter pins, smaller distances, gentler scaling.
    mm.add('(max-width: 900px) and (prefers-reduced-motion: no-preference)', function () {
      buildScenes({
        preroll: 112,
        depth: { bg: 12, mid: 28 },
        hero: { pin: 80, titleScale: 1.18, titleRise: 8, spread: 8, subOut: 14 },
        who: { sweep: 70 },
        system: { pin: 70, scatter: 60 },
        work: { pin: 90, grow: 1.2, vertical: true },
        approach: { split: 32 },
        contact: { from: 0.93 },
        enter: { head: 7, card: 9, cardScale: 0.95 },
        exit: { drift: 5 },
        obj: {
          scrub: 0.7,
          float: -8,
          push: 70,
          markIn: 0.9, markHero: 1.1, markExit: 22,
          markAside: 16, markSmall: 0.56,
          markCombined: 0.66, markFinal: 0.95,
          ringFull: 1.1, ringFrame: 0.92, ringFinal: 1.02
        }
      });
    });

    // Reduced motion — no pinning, no transforms, everything already visible.
    mm.add('(prefers-reduced-motion: reduce)', function () {
      return function () {};
    });
  }

  /* ---------------------------------------------------------------------
     6. BOOT
     --------------------------------------------------------------------- */

  function boot() {
    initSmoothScroll();
    initMenu();
    initAnchors();

    if (!prefersReducedMotion) {
      initScenes();
    }

    // Late-loading webfonts change every measurement the pins depend on.
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
