// Scroll-Driven Narrative Animation with GSAP
// Language support: EN/NL with dynamic text updates on scroll

gsap.registerPlugin(ScrollTrigger);

const scrollNarrative = {
  // Language strings
  text: {
    en: {
      problem: "Businesses lose clients before the first call",
      solution: "One system that converts visitors to clients",
      services: "Complete online presence",
      process: "Simple, proven approach",
      forwho: "For service businesses",
      why: "Why WAT? Agency",
      cases: "Real work, real results",
      contact: "Ready to grow?"
    },
    nl: {
      problem: "Bedrijven verliezen klanten voordat het eerste gesprek plaatsvindt",
      solution: "Één systeem dat bezoekers in klanten omzet",
      services: "Volledige online aanwezigheid",
      process: "Eenvoudige, bewezen aanpak",
      forwho: "Voor servicebedrijven",
      why: "Waarom WAT? Agency",
      cases: "Echt werk, echte resultaten",
      contact: "Klaar om te groeien?"
    }
  },

  init() {
    // Get current language from data attribute or default to NL
    const currentLang = document.documentElement.getAttribute('data-lang') || 'nl';
    this.currentLang = currentLang;

    // Create timeline for scroll narrative
    this.createScrollAnimations();
    this.createSectionAnimations();

    // Progress bar animation
    this.animateProgressBar();
  },

  createScrollAnimations() {
    const sections = ['problem', 'solution', 'services', 'process', 'forwho', 'why', 'cases', 'contact'];

    sections.forEach((section, index) => {
      const el = document.getElementById(section);
      if (!el) return;

      // Stagger the animations
      gsap.to(el, {
        scrollTrigger: {
          trigger: el,
          start: 'top 80%',
          end: 'top 20%',
          onEnter: () => this.activateSection(section),
          onLeaveBack: () => this.deactivateSection(section),
          markers: false
        },
        duration: 0.6
      });

      // Animate section in
      gsap.from(el.querySelectorAll('.big-h, .sec-sub, .sec-tag'), {
        scrollTrigger: {
          trigger: el,
          start: 'top 90%',
          end: 'top 50%'
        },
        opacity: 0,
        y: 40,
        duration: 0.8,
        stagger: 0.15,
        ease: 'power2.out'
      });
    });
  },

  createSectionAnimations() {
    // Hero section - entrance animation
    const hero = document.getElementById('top');
    if (hero) {
      gsap.from(hero.querySelectorAll('.hero-eyebrow, .hero h1, .hero-sub, .hero-btns'), {
        opacity: 0,
        y: 30,
        duration: 0.8,
        stagger: 0.15,
        ease: 'power2.out'
      });
    }

    // Parallax effect for hero blob
    const heroBlob = document.querySelector('.hero-blob');
    if (heroBlob) {
      gsap.to(heroBlob, {
        scrollTrigger: {
          trigger: 'body',
          start: 'top top',
          end: 'bottom bottom',
          scrub: 1
        },
        y: 200,
        opacity: 0.5,
        duration: 1
      });
    }

    // Cards stagger animation
    gsap.utils.toArray('.proj-card, .service-card, .case-card, .info-card').forEach((card) => {
      gsap.from(card, {
        scrollTrigger: {
          trigger: card,
          start: 'top 85%',
          end: 'top 45%'
        },
        opacity: 0,
        y: 50,
        duration: 0.8,
        ease: 'power2.out'
      });
    });

    // Buttons hover shimmer
    gsap.utils.toArray('.btn-red, .btn-outline').forEach((btn) => {
      btn.addEventListener('mouseenter', () => {
        gsap.to(btn, { duration: 0.4, overwrite: 'auto' });
      });
    });
  },

  activateSection(section) {
    // Update active nav state
    this.updateNavHighlight(section);

    // Trigger any section-specific animations
    this.onSectionActive(section);
  },

  deactivateSection(section) {
    // Can add deactivation logic here if needed
  },

  onSectionActive(section) {
    // Can be extended for section-specific behaviors
    switch(section) {
      case 'problem':
        this.animateNumberCounter('#problem');
        break;
      case 'solution':
        this.animateSolutionCards();
        break;
      case 'cases':
        this.animateCaseCards();
        break;
      case 'contact':
        this.focusContactForm();
        break;
    }
  },

  updateNavHighlight(section) {
    // Update nav link highlight
    document.querySelectorAll('.nav-links a').forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === '#' + section) {
        link.classList.add('active');
      }
    });
  },

  animateNumberCounter(selector) {
    const counter = document.querySelector(selector + ' .big-h');
    if (counter && !counter.hasAttribute('data-animated')) {
      counter.setAttribute('data-animated', 'true');
      gsap.fromTo(counter,
        { textContent: 0 },
        {
          textContent: parseInt(counter.textContent),
          duration: 2,
          snap: { textContent: 1 },
          ease: 'power2.out'
        }
      );
    }
  },

  animateSolutionCards() {
    gsap.from('#solution .sec-tag', {
      duration: 0.6,
      opacity: 0,
      x: -20,
      ease: 'power2.out'
    });
  },

  animateCaseCards() {
    const cards = document.querySelectorAll('#cases .proj-card');
    gsap.from(cards, {
      duration: 0.8,
      opacity: 0,
      y: 40,
      stagger: 0.1,
      ease: 'back.out(1.3)'
    });
  },

  focusContactForm() {
    const form = document.getElementById('contact-form');
    if (form) {
      gsap.to(form, {
        scrollTrigger: {
          trigger: form,
          start: 'top 80%'
        },
        opacity: 1,
        duration: 0.8,
        ease: 'power2.out'
      });
    }
  },

  animateProgressBar() {
    // Progress bar based on scroll
    const prog = document.getElementById('prog');
    if (prog) {
      gsap.to(prog, {
        scrollTrigger: {
          trigger: 'body',
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.3,
          onUpdate: (self) => {
            gsap.to(prog, { scaleX: self.getVelocity() > 0 ? self.progress : self.progress, duration: 0.1 });
          }
        }
      });
    }
  },

  // Sync language with scroll narrative
  updateLanguage(lang) {
    this.currentLang = lang;
    // You can extend this to update text dynamically
  }
};

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => scrollNarrative.init());
} else {
  scrollNarrative.init();
}

// Expose for external access
window.scrollNarrative = scrollNarrative;
