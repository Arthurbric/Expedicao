/*
 * ui.js — interface geral do site:
 *   1) Tela de carregamento (loader) e liberação das animações do GSAP
 *   2) Header: menu lateral (celular), link ativo ao rolar e esconder/mostrar ao rolar
 *   3) Barra inferior estilo aplicativo (celular)
 *   4) Contadores animados da faixa de números
 */
(() => {
  "use strict";

  // Respeita quem pediu menos movimento no sistema operacional
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Tempo mínimo que o loader fica na tela (ms) para a animação ser vista
  const LOADER_MIN_TIME = reduceMotion ? 0 : 2200;
  // Segurança: se algo travar, o loader some sozinho depois disso (ms)
  const LOADER_MAX_TIME = 8000;

  const body = document.body;

  /* =====================================================================
   * 1) LOADER
   * ===================================================================== */

  // Enquanto o loader está na tela, congelamos o relógio global do GSAP.
  // Assim a animação de entrada do hero (animations.js) só começa quando o loader sair.
  // O loader em si usa apenas CSS, então não é afetado por esta pausa.
  if (window.gsap && !reduceMotion) {
    window.gsap.globalTimeline.pause();
  }

  // Frases que trocam enquanto carrega (clima de jogo de tabuleiro)
  const LOADER_PHRASES = [
    "Embaralhando as cartas...",
    "Rolando os dados...",
    "Montando o tabuleiro...",
    "Convocando os jogadores...",
    "Sorteando quem começa...",
    "Quase na sua vez!",
  ];

  function setupLoader() {
    const loader = document.getElementById("pageLoader");
    if (!loader) return;

    // Sem animação: remove o loader na hora
    if (reduceMotion) {
      finishLoader(loader, 0);
      return;
    }

    const fill = document.getElementById("loaderBarFill");
    const percentText = document.getElementById("loaderPercent");
    const phrase = document.getElementById("loaderPhrase");

    const startedAt = performance.now();
    let pageLoaded = document.readyState === "complete";
    let progress = 0;
    let phraseIndex = 0;
    let finished = false;

    window.addEventListener("load", () => { pageLoaded = true; });

    // Troca a frase a cada 700ms
    const phraseTimer = setInterval(() => {
      phraseIndex = (phraseIndex + 1) % LOADER_PHRASES.length;
      if (phrase) phrase.textContent = LOADER_PHRASES[phraseIndex];
    }, 700);

    // Atualiza a barra: sobe suavemente até 90% e só chega a 100% quando a página carregou
    function tick(now) {
      if (finished) return;

      const elapsed = now - startedAt;
      const timeRatio = Math.min(elapsed / LOADER_MIN_TIME, 1);
      const target = pageLoaded ? 100 : Math.min(timeRatio * 90, 90);

      // Aproximação suave (easing) em direção ao alvo
      progress += (target - progress) * 0.08;
      if (target - progress < 0.4) progress = target;

      const rounded = Math.round(progress);
      if (fill) fill.style.transform = `scaleX(${progress / 100})`;
      if (percentText) percentText.textContent = `${rounded}%`;

      const timeUp = elapsed >= LOADER_MIN_TIME;
      const forced = elapsed >= LOADER_MAX_TIME;

      if ((pageLoaded && timeUp && progress >= 99.5) || forced) {
        finished = true;
        clearInterval(phraseTimer);
        if (fill) fill.style.transform = "scaleX(1)";
        if (percentText) percentText.textContent = "100%";
        if (phrase) phrase.textContent = "Bora jogar! 🎉";
        // Pequena pausa para a pessoa ver o 100% antes das cortinas abrirem
        finishLoader(loader, 450);
        return;
      }

      requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  // Abre as cortinas, libera a rolagem e solta as animações do GSAP
  function finishLoader(loader, delay) {
    setTimeout(() => {
      loader.classList.add("is-done");
      body.classList.remove("is-loading");

      // Retoma o GSAP: o hero começa a animar agora, enquanto as cortinas abrem
      if (window.gsap) window.gsap.globalTimeline.resume();

      // Avisa os outros scripts (ex.: cena 3D) que o site está liberado
      window.dispatchEvent(new CustomEvent("site:ready"));

      // Remove o loader do DOM depois da transição de saída
      setTimeout(() => loader.remove(), 1100);
    }, delay);
  }

  /* =====================================================================
   * 2) HEADER
   * ===================================================================== */

  const header = document.querySelector(".header");
  const drawer = document.getElementById("mobileDrawer");
  const menuToggle = document.getElementById("menuToggleBtn");

  function openDrawer() {
    if (!drawer) return;
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    menuToggle?.setAttribute("aria-expanded", "true");
    menuToggle?.setAttribute("aria-label", "Fechar menu");
    menuToggle?.classList.add("is-open");
    body.classList.add("drawer-open");
    // Leva o foco para o primeiro link (acessibilidade)
    drawer.querySelector("a")?.focus();
  }

  function closeDrawer() {
    if (!drawer || !drawer.classList.contains("is-open")) return;
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    menuToggle?.setAttribute("aria-expanded", "false");
    menuToggle?.setAttribute("aria-label", "Abrir menu");
    menuToggle?.classList.remove("is-open");
    body.classList.remove("drawer-open");
  }

  function setupDrawer() {
    menuToggle?.addEventListener("click", () => {
      drawer?.classList.contains("is-open") ? closeDrawer() : openDrawer();
    });

    // Fecha ao clicar no fundo escuro ou em qualquer link do menu
    drawer?.addEventListener("click", (event) => {
      if (event.target.closest("[data-close-drawer], a")) closeDrawer();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeDrawer();
    });

    // Se a tela voltar a ficar grande, garante que o menu lateral não fique preso aberto
    window.matchMedia("(min-width: 1025px)").addEventListener("change", (e) => {
      if (e.matches) closeDrawer();
    });
  }

  // Descobre qual seção está visível e marca o link correspondente como ativo
  function setupScrollSpy() {
    const links = [...document.querySelectorAll(".menu a, .drawer-panel a:not(.btn), .bottom-nav a")];
    const sectionIds = ["sobre", "como-funciona", "pacotes", "catalogo", "contato"];
    const sections = sectionIds
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    function update() {
      // "Linha de leitura" a 35% da altura da tela
      const line = window.scrollY + window.innerHeight * 0.35;
      let current = "topo";

      sections.forEach((section) => {
        if (section.offsetTop <= line) current = section.id;
      });

      links.forEach((link) => {
        const target = (link.getAttribute("href") || "").replace("#", "");
        link.classList.toggle("is-active", target === current);
      });
    }

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  // Esconde o header ao rolar para baixo e mostra ao rolar para cima (economiza espaço no celular)
  function setupHeaderAutoHide() {
    let lastY = window.scrollY;
    let ticking = false;

    window.addEventListener("scroll", () => {
      if (ticking) return;
      ticking = true;

      requestAnimationFrame(() => {
        const y = window.scrollY;
        const goingDown = y > lastY + 6;
        const goingUp = y < lastY - 6;

        if (!body.classList.contains("drawer-open")) {
          if (goingDown && y > 280) header?.classList.add("is-hidden");
          if (goingUp || y < 120) header?.classList.remove("is-hidden");
        }

        lastY = y;
        ticking = false;
      });
    }, { passive: true });
  }

  /* =====================================================================
   * 3) BARRA INFERIOR (CELULAR)
   * ===================================================================== */

  function setupBottomNav() {
    // O botão "Favoritos" da barra inferior reaproveita o botão do header
    document.getElementById("bottomFavoritesBtn")?.addEventListener("click", () => {
      document.getElementById("openFavoritesBtn")?.click();
    });
  }

  /* =====================================================================
   * 4) CONTADORES
   * ===================================================================== */

  // Anima um número de 0 até o valor final (easing de desaceleração)
  function countUp(el) {
    const end = Number(el.dataset.count) || 0;
    const suffix = el.dataset.suffix || "";
    const duration = reduceMotion ? 0 : 1400;
    const start = performance.now();

    function step(now) {
      const t = duration ? Math.min((now - start) / duration, 1) : 1;
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = `${Math.round(end * eased)}${suffix}`;
      if (t < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }

  async function setupCounters() {
    // O total de jogos vem do mesmo arquivo do catálogo, então nunca fica desatualizado
    try {
      const response = await fetch("./data/games.json");
      const games = await response.json();
      const gamesEl = document.getElementById("statGames");
      if (gamesEl) gamesEl.dataset.count = String(games.length);
    } catch (error) {
      console.error("Não foi possível ler o total de jogos:", error);
    }

    const counters = document.querySelectorAll("[data-count]");
    if (!("IntersectionObserver" in window)) {
      counters.forEach(countUp);
      return;
    }

    // Só começa a contar quando o número aparece na tela
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        countUp(entry.target);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.6 });

    counters.forEach((el) => observer.observe(el));
  }

  window.addEventListener("DOMContentLoaded", () => {
    setupLoader();
    setupDrawer();
    setupScrollSpy();
    setupHeaderAutoHide();
    setupBottomNav();
    setupCounters();
  });
})();
