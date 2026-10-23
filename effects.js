/*
 * effects.js — recursos de experiência: sons (Web Audio), envio do formulário por e-mail
 * (FormSubmit) e pequenos itens de interface (barra de progresso, voltar ao topo, brilho do cursor).
 */
(() => {
  "use strict";

  // Chave do localStorage que guarda se o usuário ligou os sons.
  const SOUND_KEY = "siteSoundEnabled";
  // Respeita quem pediu menos movimento no sistema operacional.
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // localStorage pode lançar erro (modo privado/bloqueado); estes helpers engolem a falha.
  const safeStorage = {
    get(key) {
      try { return localStorage.getItem(key); } catch { return null; }
    },
    set(key, value) {
      try { localStorage.setItem(key, value); } catch { /* ignore */ }
    },
  };

  /* ---------- Sons (Web Audio, sem arquivos externos) ---------- */
  // Sintetizador de sons: nada é tocado enquanto "enabled" for falso (desligado por padrão).
  const sound = {
    enabled: safeStorage.get(SOUND_KEY) === "1",
    ctx: null,

    // Cria o AudioContext sob demanda (navegadores exigem gesto do usuário) e o retoma se suspenso.
    ensure() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null;
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === "suspended") this.ctx.resume();
      return this.ctx;
    },

    // Toca uma nota curta: frequência inicial (e opcional final), duração, forma de onda, volume e atraso.
    tone({ freq = 440, to = null, dur = 0.12, type = "sine", vol = 0.06, delay = 0 }) {
      if (!this.enabled) return;
      const ctx = this.ensure();
      if (!ctx) return;

      const t0 = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);

      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.03);
    },

    // Efeitos prontos, montados a partir de tone(): clique, hover, abrir/fechar, favoritar, dados e resultado do formulário.
    click() { this.tone({ freq: 520, to: 320, dur: 0.09, type: "triangle", vol: 0.07 }); },
    hover() { this.tone({ freq: 880, dur: 0.04, type: "sine", vol: 0.02 }); },
    open() {
      this.tone({ freq: 330, to: 660, dur: 0.16, type: "triangle", vol: 0.06 });
    },
    close() {
      this.tone({ freq: 660, to: 330, dur: 0.14, type: "triangle", vol: 0.05 });
    },
    like() {
      this.tone({ freq: 660, dur: 0.08, type: "sine", vol: 0.07 });
      this.tone({ freq: 990, dur: 0.14, type: "sine", vol: 0.07, delay: 0.07 });
    },
    unlike() { this.tone({ freq: 420, to: 260, dur: 0.12, type: "sine", vol: 0.05 }); },
    dice() {
      for (let i = 0; i < 5; i += 1) {
        this.tone({ freq: 180 + Math.random() * 260, dur: 0.035, type: "square", vol: 0.025, delay: i * 0.05 });
      }
    },
    success() {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        this.tone({ freq, dur: 0.22, type: "triangle", vol: 0.07, delay: i * 0.1 });
      });
    },
    error() {
      this.tone({ freq: 220, to: 140, dur: 0.25, type: "sawtooth", vol: 0.05 });
    },
  };

  // Exposto globalmente para outros scripts poderem tocar sons.
  window.siteSound = sound;

  // Atualiza ícone e acessibilidade do botão de som conforme o estado.
  function updateSoundButton() {
    const btn = document.getElementById("soundToggleBtn");
    if (!btn) return;
    btn.setAttribute("aria-pressed", String(sound.enabled));
    btn.setAttribute("aria-label", sound.enabled ? "Desativar sons do site" : "Ativar sons do site");
    btn.innerHTML = `<i class="fa-solid ${sound.enabled ? "fa-volume-high" : "fa-volume-xmark"}"></i>`;
  }

  // Liga o botão de som e usa delegação de eventos para tocar sons em cliques e hovers de toda a página.
  function setupSound() {
    updateSoundButton();

    document.getElementById("soundToggleBtn")?.addEventListener("click", () => {
      sound.enabled = !sound.enabled;
      safeStorage.set(SOUND_KEY, sound.enabled ? "1" : "0");
      updateSoundButton();
      if (sound.enabled) sound.dice();
    });

    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      if (target.closest("#soundToggleBtn")) return;

      const fav = target.closest(".favorite-btn");
      if (fav) {
        // o estado é atualizado pelo script.js no mesmo clique; lemos depois dele
        setTimeout(() => (fav.classList.contains("is-favorite") ? sound.like() : sound.unlike()), 0);
        return;
      }

      if (target.closest(".game-card")) return sound.open();
      if (target.closest(".modal-close, [data-close-modal], [data-close-favorites]")) return sound.close();
      if (target.closest(".btn, .showcase-dot, .back-to-top")) sound.click();
    });

    document.addEventListener("mouseover", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const hovered = target.closest(".btn, .game-card, .menu a");
      if (hovered && !hovered.contains(event.relatedTarget)) sound.hover();
    });
  }

  /* ---------- Formulário -> e-mail (FormSubmit) ---------- */
  // Formulário de contato: valida, envia via fetch para o FormSubmit (que repassa ao e-mail) e mostra o resultado.
  function setupContactForm() {
    const form = document.getElementById("contactForm");
    if (!form) return;

    const status = document.getElementById("formStatus");
    const submitBtn = document.getElementById("contactSubmitBtn");
    const favoritesField = document.getElementById("favoritesField");
    const defaultLabel = submitBtn.innerHTML;

    function setStatus(message, kind) {
      status.textContent = message;
      status.dataset.kind = kind || "";
    }

    // Lê os favoritos do localStorage e devolve um texto para ir junto no e-mail.
    function getFavoritesText() {
      try {
        const list = JSON.parse(safeStorage.get("favoriteGames") || "[]");
        return Array.isArray(list) && list.length ? list.join(", ") : "Nenhum jogo favoritado";
      } catch {
        return "Nenhum jogo favoritado";
      }
    }

    // Marca campos obrigatórios inválidos e devolve o primeiro, para receber foco.
    function validate() {
      let firstInvalid = null;
      form.querySelectorAll("input[required], textarea[required]").forEach((field) => {
        const invalid = !field.checkValidity();
        field.classList.toggle("is-invalid", invalid);
        field.setAttribute("aria-invalid", String(invalid));
        if (invalid && !firstInvalid) firstInvalid = field;
      });
      return firstInvalid;
    }

    form.addEventListener("input", (event) => {
      if (event.target.classList?.contains("is-invalid") && event.target.checkValidity()) {
        event.target.classList.remove("is-invalid");
        event.target.setAttribute("aria-invalid", "false");
      }
    });

    // Envio: bloqueia o botão durante a requisição e sempre o restaura no finally.
    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const invalid = validate();
      if (invalid) {
        setStatus("Confira os campos destacados antes de enviar.", "error");
        sound.error();
        invalid.focus();
        window.siteFx?.shake(form);
        return;
      }

      favoritesField.value = getFavoritesText();

      submitBtn.disabled = true;
      submitBtn.classList.add("is-loading");
      submitBtn.innerHTML = `<span class="btn-label"><i class="fa-solid fa-circle-notch fa-spin"></i> Enviando...</span>`;
      setStatus("", "");

      try {
        const response = await fetch(form.action, {
          method: "POST",
          headers: { Accept: "application/json" },
          body: new FormData(form),
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok || result.success === "false" || result.success === false) {
          throw new Error(result.message || "Falha ao enviar.");
        }

        form.reset();
        setStatus("Pedido enviado! Responderemos no seu e-mail em breve.", "success");
        sound.success();
        window.siteFx?.confetti(submitBtn);
      } catch (error) {
        console.error(error);
        setStatus("Não foi possível enviar agora. Tente novamente ou fale pelo WhatsApp.", "error");
        sound.error();
        window.siteFx?.shake(form);
      } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove("is-loading");
        submitBtn.innerHTML = defaultLabel;
      }
    });
  }

  /* ---------- Interface: progresso, topo, brilho do cursor ---------- */
  // Barra de progresso da rolagem, botão de voltar ao topo, sombra do cabeçalho e brilho que segue o cursor.
  function setupUi() {
    const progress = document.getElementById("scrollProgress");
    const backToTop = document.getElementById("backToTopBtn");
    const header = document.querySelector(".header");

    function onScroll() {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = max > 0 ? window.scrollY / max : 0;
      if (progress) progress.style.transform = `scaleX(${ratio})`;
      backToTop?.classList.toggle("visible", window.scrollY > 600);
      header?.classList.toggle("is-scrolled", window.scrollY > 24);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    backToTop?.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    });

    const glow = document.getElementById("cursorGlow");
    if (glow && !reduceMotion && window.matchMedia("(pointer: fine)").matches) {
      window.addEventListener("pointermove", (event) => {
        glow.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
        glow.style.opacity = "1";
      }, { passive: true });
    } else {
      glow?.remove();
    }
  }

  // Inicialização quando o DOM estiver pronto.
  window.addEventListener("DOMContentLoaded", () => {
    setupSound();
    setupContactForm();
    setupUi();
  });
})();
