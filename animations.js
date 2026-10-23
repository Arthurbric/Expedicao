/*
 * animations.js — animações com GSAP + ScrollTrigger: entrada do hero, revelação ao rolar,
 * catálogo, modais e micro-interações. Também expõe window.siteFx (shake e confetti) ao formulário.
 */
(() => {
  "use strict";

  // Quem pede menos movimento no sistema não recebe as animações; mouse fino habilita efeitos de ponteiro.
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;

  // Versões vazias: se o GSAP não carregar, o formulário ainda chama siteFx sem quebrar.
  window.siteFx = { shake() {}, confetti() {} };

  if (!window.gsap) return;

  const { gsap } = window;
  if (window.ScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);

  /* ---------- Efeitos pontuais (usados pelo formulário) ---------- */
  // Tremida elástica no elemento (usada quando o formulário tem erro).
  window.siteFx.shake = (el) => {
    if (reduceMotion || !el) return;
    gsap.fromTo(el, { x: -10 }, { x: 0, duration: 0.6, ease: "elastic.out(1, 0.25)", clearProps: "transform" });
  };

  // Confete: cria peças DOM a partir do elemento de origem, sobe, cai e some; a camada é removida no fim.
  window.siteFx.confetti = (origin) => {
    if (reduceMotion || !origin) return;
    const rect = origin.getBoundingClientRect();
    const colors = ["#22c55e", "#f59e0b", "#60a5fa", "#fb7185", "#a78bfa"];
    const layer = document.createElement("div");
    layer.className = "confetti-layer";
    document.body.appendChild(layer);

    for (let i = 0; i < 46; i += 1) {
      const piece = document.createElement("i");
      piece.className = "confetti-piece";
      piece.style.background = colors[i % colors.length];
      layer.appendChild(piece);

      gsap.set(piece, {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        rotation: Math.random() * 360,
      });

      gsap.to(piece, {
        x: `+=${gsap.utils.random(-260, 260)}`,
        y: `+=${gsap.utils.random(-260, -60)}`,
        rotation: `+=${gsap.utils.random(-540, 540)}`,
        duration: gsap.utils.random(0.5, 0.8),
        ease: "power2.out",
      });
      gsap.to(piece, {
        y: `+=${gsap.utils.random(380, 620)}`,
        opacity: 0,
        duration: gsap.utils.random(0.9, 1.4),
        delay: 0.55,
        ease: "power1.in",
      });
    }

    setTimeout(() => layer.remove(), 2600);
  };

  // A partir daqui ficam as animações "de verdade": desativadas com reduzir movimento.
  if (reduceMotion) return;

  /* ---------- Entrada do hero ---------- */
  // Linha do tempo de abertura: cabeçalho, destaque, texto do hero e ícones surgem em sequência.
  function heroIntro() {
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    tl.from(".header .logo, .header .menu li, .header-actions > *", {
      y: -18, opacity: 0, duration: 0.6, stagger: 0.05, clearProps: "all",
    })
      .from(".showcase-slider", { y: 30, opacity: 0, scale: 0.98, duration: 0.8, clearProps: "all" }, "-=0.3")
      .from(".hero-tag", { y: 20, opacity: 0, duration: 0.5, clearProps: "all" }, "-=0.3")
      .from(".hero h1", { y: 34, opacity: 0, duration: 0.8, clearProps: "all" }, "-=0.3")
      .from(".hero-sub", { y: 24, opacity: 0, duration: 0.6, clearProps: "all" }, "-=0.5")
      .from(".hero-actions .btn", { y: 20, opacity: 0, duration: 0.5, stagger: 0.1, clearProps: "all" }, "-=0.4")
      .from(".hero-visual", { scale: 0.9, opacity: 0, duration: 0.8, clearProps: "scale,opacity" }, "-=0.7")
      .from(".hero-visual span", {
        scale: 0, rotation: -90, opacity: 0, duration: 0.6, stagger: 0.08, ease: "back.out(2)",
      }, "-=0.5");
  }

  // Ícones do hero flutuam em loop (yPercent) e seguem o mouse com leve parallax (x/y), sem conflitar entre si.
  function heroFloat() {
    const icons = gsap.utils.toArray(".hero-visual span");
    icons.forEach((icon, i) => {
      gsap.to(icon, {
        yPercent: -14,
        duration: 2 + (i % 3) * 0.4,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
        delay: i * 0.15,
      });
    });

    const visual = document.querySelector(".hero-visual");
    if (!visual || !finePointer) return;

    const setters = icons.map((icon, i) => ({
      x: gsap.quickTo(icon, "x", { duration: 0.6, ease: "power3.out" }),
      y: gsap.quickTo(icon, "y", { duration: 0.6, ease: "power3.out" }),
      depth: 8 + i * 3,
    }));

    visual.addEventListener("pointermove", (event) => {
      const rect = visual.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width - 0.5;
      const py = (event.clientY - rect.top) / rect.height - 0.5;
      setters.forEach(({ x, y, depth }) => { x(px * depth * 2); y(py * depth * 2); });
    });

    visual.addEventListener("pointerleave", () => {
      setters.forEach(({ x, y }) => { x(0); y(0); });
    });
  }

  /* ---------- Destaques (slider existente) ---------- */
  // O slider (script.js) só troca a classe "active"; aqui observamos isso e animamos o conteúdo do slide novo.
  function showcaseTransitions() {
    const slider = document.getElementById("showcaseSlider");
    if (!slider) return;

    const animateSlide = (slide) => {
      gsap.fromTo(
        slide.children,
        { y: 22, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.55, stagger: 0.09, ease: "power3.out", clearProps: "all" },
      );
    };

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        const el = m.target;
        if (el.classList.contains("showcase-slide") && el.classList.contains("active")) animateSlide(el);
      });
    });

    slider.querySelectorAll(".showcase-slide").forEach((slide) => {
      observer.observe(slide, { attributes: true, attributeFilter: ["class"] });
    });
  }

  /* ---------- Revelação ao rolar ---------- */
  // Títulos, grupos de cards, filtros, passos e CTA aparecem uma única vez ao entrar na tela; hero tem parallax.
  function scrollReveals() {
    if (!window.ScrollTrigger) return;

    gsap.utils.toArray("section h2, .section-lead, .section-subtitle").forEach((el) => {
      gsap.from(el, {
        y: 28, opacity: 0, duration: 0.7, ease: "power3.out", clearProps: "all",
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
      });
    });

    const groups = [".grid-3 > *", ".timeline > *", ".package-grid > *", ".two-cols > *", ".contact-layout > *", ".footer-grid > *"];
    groups.forEach((selector) => {
      const items = gsap.utils.toArray(selector);
      if (!items.length) return;
      gsap.from(items, {
        y: 40, opacity: 0, duration: 0.7, stagger: 0.12, ease: "power3.out", clearProps: "all",
        scrollTrigger: { trigger: items[0].parentElement, start: "top 85%", once: true },
      });
    });

    gsap.from(".filters label", {
      y: 20, opacity: 0, duration: 0.5, stagger: 0.06, ease: "power2.out", clearProps: "all",
      scrollTrigger: { trigger: ".filters", start: "top 90%", once: true },
    });

    gsap.from(".cta-box", {
      y: 30, opacity: 0, duration: 0.7, ease: "power3.out", clearProps: "all",
      scrollTrigger: { trigger: ".cta-box", start: "top 92%", once: true },
    });

    gsap.utils.toArray(".step span").forEach((badge) => {
      gsap.from(badge, {
        scale: 0, rotation: -180, duration: 0.6, ease: "back.out(2.4)", clearProps: "all",
        scrollTrigger: { trigger: badge, start: "top 90%", once: true },
      });
    });

    gsap.to(".hero-visual", {
      yPercent: -8,
      ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top bottom", end: "bottom top", scrub: 0.6 },
    });

    window.addEventListener("load", () => window.ScrollTrigger.refresh());
  }

  /* ---------- Catálogo: cards entram em cascata a cada filtro ---------- */
  // Observa a grade: toda vez que script.js a redesenha (filtros), os cards entram em cascata (até 24); inclui tilt 3D no hover.
  function catalogCascade() {
    const grid = document.getElementById("catalogGrid");
    if (!grid) return;

    let queued = false;
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        const cards = grid.querySelectorAll(".game-card");
        if (!cards.length) return;
        gsap.fromTo(
          [...cards].slice(0, 24),
          { y: 26, opacity: 0, scale: 0.97 },
          { y: 0, opacity: 1, scale: 1, duration: 0.45, stagger: 0.03, ease: "power2.out", clearProps: "all", overwrite: "auto" },
        );
      });
    });

    observer.observe(grid, { childList: true });

    if (!finePointer) return;
    grid.addEventListener("pointermove", (event) => {
      const card = event.target.closest?.(".game-card");
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width - 0.5;
      const py = (event.clientY - rect.top) / rect.height - 0.5;
      gsap.to(card, { rotationY: px * 6, rotationX: -py * 6, transformPerspective: 800, duration: 0.3, ease: "power2.out" });
    });
    grid.addEventListener("pointerout", (event) => {
      const card = event.target.closest?.(".game-card");
      if (card && !card.contains(event.relatedTarget)) {
        gsap.to(card, { rotationX: 0, rotationY: 0, duration: 0.5, ease: "power3.out" });
      }
    });
  }

  /* ---------- Modais ---------- */
  // Quando um modal perde a classe "hidden", anima o fundo (fade) e o conteúdo (sobe com leve "pulo").
  function modalMotion() {
    document.querySelectorAll(".modal").forEach((modal) => {
      const observer = new MutationObserver(() => {
        if (modal.classList.contains("hidden")) return;
        gsap.fromTo(modal.querySelector(".modal-overlay"), { opacity: 0 }, { opacity: 1, duration: 0.25 });
        gsap.fromTo(
          modal.querySelector(".modal-content"),
          { y: 40, opacity: 0, scale: 0.95 },
          { y: 0, opacity: 1, scale: 1, duration: 0.45, ease: "back.out(1.5)", clearProps: "transform,opacity" },
        );
      });
      observer.observe(modal, { attributes: true, attributeFilter: ["class"] });
    });
  }

  /* ---------- Botões magnéticos, logo e favoritos ---------- */
  // Botões "magnéticos" que seguem o ponteiro, giro do ícone do logo, "pop" ao favoritar e pulso do WhatsApp.
  function microInteractions() {
    if (finePointer) {
      document.querySelectorAll(".btn-primary, .whatsapp-float, .back-to-top").forEach((el) => {
        const moveX = gsap.quickTo(el, "x", { duration: 0.4, ease: "power3.out" });
        const moveY = gsap.quickTo(el, "y", { duration: 0.4, ease: "power3.out" });

        el.addEventListener("pointermove", (event) => {
          const rect = el.getBoundingClientRect();
          moveX((event.clientX - (rect.left + rect.width / 2)) * 0.25);
          moveY((event.clientY - (rect.top + rect.height / 2)) * 0.35);
        });
        el.addEventListener("pointerleave", () => { moveX(0); moveY(0); });
      });
    }

    const logoIcon = document.querySelector(".logo i");
    document.querySelector(".logo")?.addEventListener("mouseenter", () => {
      gsap.fromTo(logoIcon, { rotation: 0 }, { rotation: 360, duration: 0.8, ease: "back.out(1.7)" });
    });

    document.addEventListener("click", (event) => {
      const btn = event.target.closest?.(".favorite-btn");
      if (!btn) return;
      gsap.fromTo(btn, { scale: 0.6 }, { scale: 1, duration: 0.5, ease: "elastic.out(1.2, 0.4)", clearProps: "transform" });
    });

    gsap.to(".whatsapp-float", { scale: 1.08, duration: 1.1, ease: "sine.inOut", yoyo: true, repeat: -1 });
  }

  // Inicialização quando o DOM estiver pronto.
  window.addEventListener("DOMContentLoaded", () => {
    heroIntro();
    heroFloat();
    showcaseTransitions();
    scrollReveals();
    catalogCascade();
    modalMotion();
    microInteractions();
  });
})();
