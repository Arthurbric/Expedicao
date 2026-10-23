/*
 * script.js — lógica principal do site: catálogo de jogos (carregado de data/games.json),
 * filtros, favoritos (salvos no localStorage), modais, tema claro/escuro e slider de destaques.
 */

// Estado global da página: lista completa, lista filtrada e controle do slider.
const state = {
  games: [],
  filtered: [],
  showOnlyFavorites: false,
  activeSlide: 0,
  sliderInterval: null,
};

// Referências aos elementos do DOM usados pelo script (buscadas uma única vez).
const els = {
  grid: document.getElementById("catalogGrid"),
  info: document.getElementById("catalogInfo"),
  search: document.getElementById("searchInput"),
  difficulty: document.getElementById("difficultyFilter"),
  time: document.getElementById("timeFilter"),
  players: document.getElementById("playersFilter"),
  style: document.getElementById("styleFilter"),
  owner: document.getElementById("ownerFilter"),
  clearBtn: document.getElementById("clearFiltersBtn"),
  showOnlyFavoritesBtn: document.getElementById("showOnlyFavoritesBtn"),
  openFavoritesBtn: document.getElementById("openFavoritesBtn"),

  modal: document.getElementById("gameModal"),
  modalImage: document.getElementById("modalImage"),
  modalTitle: document.getElementById("modalTitle"),
  modalOwner: document.getElementById("modalOwner"),
  modalMeta: document.getElementById("modalMeta"),
  modalDescription: document.getElementById("modalDescription"),
  closeModalBtn: document.getElementById("closeModalBtn"),

  favoritesModal: document.getElementById("favoritesModal"),
  closeFavoritesBtn: document.getElementById("closeFavoritesBtn"),
  favoritesList: document.getElementById("favoritesList"),
  clearFavoritesBtn: document.getElementById("clearFavoritesBtn"),
  sendFavoritesWhatsappBtn: document.getElementById("sendFavoritesWhatsappBtn"),
  themeToggleBtn: document.getElementById("themeToggleBtn"),
  showcaseSlider: document.getElementById("showcaseSlider"),
  showcaseDots: document.querySelectorAll(".showcase-dot"),
};

// Número de WhatsApp usado ao enviar favoritos (placeholder: trocar pelo número real).
const whatsappNumber = "5500000000000";
// Favoritos persistem entre visitas; o Set evita duplicados.
const favorites = new Set(JSON.parse(localStorage.getItem("favoriteGames") || "[]"));
const THEME_STORAGE_KEY = "preferredTheme";

// Atualiza ícone e texto do botão de tema conforme o tema ativo.
function updateThemeToggleLabel(theme) {
  if (!els.themeToggleBtn) return;
  const icon = theme === "light" ? "fa-regular fa-moon" : "fa-regular fa-sun";
  const label = theme === "light" ? "Tema escuro" : "Tema claro";

  els.themeToggleBtn.innerHTML = `<i class="${icon}"></i>${label}`;
}

// Aplica o tema no <body> (via data-theme, lido pelo CSS) e salva a escolha.
function applyTheme(theme) {
  const normalizedTheme = theme === "light" ? "light" : "dark";
  document.body.setAttribute("data-theme", normalizedTheme);
  localStorage.setItem(THEME_STORAGE_KEY, normalizedTheme);
  updateThemeToggleLabel(normalizedTheme);
}

// Define o tema inicial (preferência salva > preferência do sistema) e liga o botão de alternar.
function setupTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
  const initialTheme = savedTheme || (prefersLight ? "light" : "dark");

  applyTheme(initialTheme);

  els.themeToggleBtn?.addEventListener("click", () => {
    const currentTheme = document.body.getAttribute("data-theme");
    applyTheme(currentTheme === "light" ? "dark" : "light");
  });
}

// Mostra o slide do índice informado (com volta circular) e sincroniza as bolinhas.
function showSlide(index) {
  if (!els.showcaseSlider || !els.showcaseDots.length) return;
  const slides = els.showcaseSlider.querySelectorAll(".showcase-slide");

  state.activeSlide = (index + slides.length) % slides.length;

  slides.forEach((slide, slideIndex) => {
    slide.classList.toggle("active", slideIndex === state.activeSlide);
  });

  els.showcaseDots.forEach((dot, dotIndex) => {
    dot.classList.toggle("active", dotIndex === state.activeSlide);
  });
}

// Slider de destaques: troca automática a cada 5,5s; clicar numa bolinha reinicia o temporizador.
function setupShowcase() {
  if (!els.showcaseSlider || !els.showcaseDots.length) return;

  showSlide(0);

  els.showcaseDots.forEach((dot, dotIndex) => {
    dot.addEventListener("click", () => {
      showSlide(dotIndex);
      if (state.sliderInterval) {
        clearInterval(state.sliderInterval);
      }
      state.sliderInterval = setInterval(() => showSlide(state.activeSlide + 1), 5500);
    });
  });

  state.sliderInterval = setInterval(() => showSlide(state.activeSlide + 1), 5500);
}

// Padroniza texto (string, minúsculas, sem espaços nas pontas) para comparações nos filtros.
function normalize(value = "") {
  return value.toString().trim().toLowerCase();
}

// Escapa caracteres especiais para inserir texto do JSON em innerHTML com segurança (evita XSS).
function escapeHtml(text = "") {
  return text
    .toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ATENÇÃO: parsePlayersRange e parseTimeRange são declaradas duas vezes neste arquivo.
// Em JavaScript vale a ÚLTIMA definição (mais abaixo); esta primeira versão é sobrescrita.
function parsePlayersRange(playersText = "") {
  return parseNumericRange(playersText);
}

function parseTimeRange(timeText = "") {
  return parseNumericRange(timeText);
}

// Converte textos como "2 - 6", "3+" ou "30 min" em { min, max }; "+" significa sem limite máximo.
function parseNumericRange(rawText = "") {
  const normalized = normalize(rawText);

  if (!normalized) {
    return null;
  }

  const numbers = normalized.match(/\d+/g)?.map(Number) || [];

  if (!numbers.length) {
    return null;
  }

  if (normalized.includes("+")) {
    return { min: numbers[0], max: Number.POSITIVE_INFINITY };
  }

  if (numbers.length >= 2) {
    const [first, second] = numbers;
    return { min: Math.min(first, second), max: Math.max(first, second) };
  }

  return { min: numbers[0], max: numbers[0] };
}

// Definição VÁLIDA de parsePlayersRange (a última no arquivo): faixa de jogadores, aceita "3+" (sem máximo).
function parsePlayersRange(playersText = "") {
  const normalized = normalize(playersText);

  if (!normalized) {
    return null;
  }

  const numbers = normalized.match(/\d+/g)?.map(Number) || [];

  if (!numbers.length) {
    return null;
  }

  if (normalized.includes("+")) {
    return { min: numbers[0], max: Number.POSITIVE_INFINITY };
  }

  if (numbers.length >= 2) {
    const [first, second] = numbers;
    return { min: Math.min(first, second), max: Math.max(first, second) };
  }

  return { min: numbers[0], max: numbers[0] };
}

// Definição VÁLIDA de parseTimeRange (a última no arquivo): faixa de minutos; não trata "+" de propósito.
function parseTimeRange(timeText = "") {
  const normalized = normalize(timeText);

  if (!normalized) {
    return null;
  }

  const numbers = normalized.match(/\d+/g)?.map(Number) || [];

  if (!numbers.length) {
    return null;
  }

  if (numbers.length >= 2) {
    const [first, second] = numbers;
    return { min: Math.min(first, second), max: Math.max(first, second) };
  }

  return { min: numbers[0], max: numbers[0] };
}

// Lista valores únicos e ordenados de um campo (ex.: dificuldade) para montar os <select>.
function safeOptions(data, key) {
  return [...new Set(data.map((item) => item[key]).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}

// Cria as <option> dentro do select, preservando o valor já selecionado.
function injectOptions(select, options) {
  const current = select.value;

  options.forEach((option) => {
    const node = document.createElement("option");
    node.value = option;
    node.textContent = option;
    select.appendChild(node);
  });

  select.value = current;
}

// Cria um bloco colorido com a 1ª palavra do nome quando a capa não existe ou falha ao carregar.
function createPlaceholder(name = "Jogo") {
  const div = document.createElement("div");
  div.className = "game-image-placeholder";
  div.setAttribute("role", "img");
  div.setAttribute("aria-label", "Imagem de capa não disponível");
  div.textContent = name.split(" ")[0] || "Jogo";
  return div;
}

// Grava os favoritos no localStorage (chave lida também pelo effects.js para o e-mail do formulário).
function saveFavorites() {
  localStorage.setItem("favoriteGames", JSON.stringify([...favorites]));
}

// Identificador do jogo nos favoritos: o próprio nome (por isso nomes no JSON devem ser únicos).
function getGameId(game) {
  return game.jogo;
}

// Monta o link wa.me com a lista numerada dos jogos favoritos como mensagem.
function buildWhatsappLink() {
  const favoriteGames = state.games.filter((game) => favorites.has(getGameId(game)));

  if (!favoriteGames.length) {
    return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Olá! Ainda não há jogos favoritos selecionados.")}`;
  }

  const textLines = [
    "Olá! Estes são os jogos favoritos selecionados:",
    "",
    ...favoriteGames.map((game, index) => `${index + 1}. ${game.jogo}`),
  ];

  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(textLines.join("\n"))}`;
}

// Atualiza o href do botão "Enviar favoritos no WhatsApp".
function updateWhatsappButton() {
  els.sendFavoritesWhatsappBtn.href = buildWhatsappLink();
}

// Sincroniza o coração (cheio/vazio) de todos os cards visíveis com o conjunto de favoritos.
function updateFavoriteButtonsUI() {
  document.querySelectorAll(".favorite-btn").forEach((button) => {
    const gameId = button.dataset.favorite;
    const icon = button.querySelector("i");
    const isFavorite = favorites.has(gameId);

    button.classList.toggle("is-favorite", isFavorite);
    icon.className = isFavorite ? "fa-solid fa-heart" : "fa-regular fa-heart";
  });
}

// Desenha a lista do modal de favoritos (miniatura, nome, estilo e botão remover).
function renderFavoritesList() {
  const favoriteGames = state.games.filter((game) => favorites.has(getGameId(game)));
  els.favoritesList.innerHTML = "";

  if (!favoriteGames.length) {
    els.favoritesList.innerHTML = `<div class="favorite-empty">Nenhum jogo favoritado ainda.</div>`;
    updateWhatsappButton();
    return;
  }

  favoriteGames.forEach((game) => {
    const item = document.createElement("div");
    item.className = "favorite-item";

    const thumbWrap = document.createElement("div");

    if (game.imagem) {
      const img = document.createElement("img");
      img.className = "favorite-thumb";
      img.src = game.imagem;
      img.alt = `Capa do jogo ${game.jogo}`;
      img.loading = "lazy";

      img.addEventListener("error", () => {
        const placeholder = document.createElement("div");
        placeholder.className = "favorite-thumb-placeholder";
        placeholder.textContent = (game.jogo || "Jogo").split(" ")[0];
        img.replaceWith(placeholder);
      });

      thumbWrap.appendChild(img);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "favorite-thumb-placeholder";
      placeholder.textContent = (game.jogo || "Jogo").split(" ")[0];
      thumbWrap.appendChild(placeholder);
    }

    const info = document.createElement("div");
    info.className = "favorite-item-info";
    info.innerHTML = `
      <strong>${escapeHtml(game.jogo)}</strong>
      <span>${escapeHtml(game.responsavel || "Equipe")} • ${escapeHtml(game.estilo || "Sem estilo")}</span>
    `;

    const removeBtn = document.createElement("button");
    removeBtn.className = "remove-favorite-btn";
    removeBtn.type = "button";
    removeBtn.dataset.removeFavorite = getGameId(game);
    removeBtn.textContent = "Remover";

    item.appendChild(thumbWrap);
    item.appendChild(info);
    item.appendChild(removeBtn);

    els.favoritesList.appendChild(item);
  });

  document.querySelectorAll("[data-remove-favorite]").forEach((button) => {
    button.addEventListener("click", () => {
      const gameId = button.dataset.removeFavorite;
      favorites.delete(gameId);
      saveFavorites();
      renderFavoritesList();
      updateFavoriteButtonsUI();
      applyFilters();
    });
  });

  updateWhatsappButton();
}

// Abre o modal de favoritos e trava a rolagem da página.
function openFavoritesModal() {
  renderFavoritesList();
  els.favoritesModal.classList.remove("hidden");
  els.favoritesModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

// Fecha o modal de favoritos e libera a rolagem.
function closeFavoritesModal() {
  els.favoritesModal.classList.add("hidden");
  els.favoritesModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

// Abre o modal de detalhes do jogo (capa, responsável, metadados e descrição).
function openGameModal(game) {
  if (game.imagem) {
    els.modalImage.src = game.imagem;
    els.modalImage.style.display = "block";
  } else {
    els.modalImage.removeAttribute("src");
    els.modalImage.style.display = "none";
  }

  els.modalImage.alt = `Capa do jogo ${game.jogo || "Jogo"}`;
  els.modalTitle.textContent = game.jogo || "Jogo";
  els.modalOwner.textContent = `Responsável: ${game.responsavel || "Equipe"}`;

  els.modalMeta.innerHTML = `
    <span>${escapeHtml(game.dificuldade || "Não informado")}</span>
    <span>${escapeHtml(game.tempo || "Não informado")}</span>
    <span>${escapeHtml(game.jogadores || "Não informado")} jogadores</span>
    <span>${escapeHtml(game.estilo || "Não informado")}</span>
  `;

  els.modalDescription.textContent =
    game.descricao || "Ainda não há uma descrição detalhada para este jogo.";

  els.modal.classList.remove("hidden");
  els.modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

// Fecha o modal de detalhes do jogo.
function closeGameModal() {
  els.modal.classList.add("hidden");
  els.modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

// Se a imagem remota falhar, troca por um placeholder em vez de deixar o card quebrado.
function attachImageFallback(img, gameName) {
  img.addEventListener("error", () => {
    const placeholder = createPlaceholder(gameName);
    img.replaceWith(placeholder);
  });
}

// Redesenha a grade do catálogo com a lista recebida: cria os cards e liga clique, teclado e favoritar.
function renderGames(data) {
  els.grid.innerHTML = "";

  if (!data.length) {
    els.info.textContent = "Nenhum jogo encontrado com os filtros atuais.";
    els.grid.innerHTML = `<p class="card">Tente ajustar os filtros para visualizar mais opções.</p>`;
    return;
  }

  els.info.textContent = `${data.length} jogo(s) encontrado(s).`;

  data.forEach((game) => {
    const card = document.createElement("article");
    card.className = "game-card";
    card.setAttribute("tabindex", "0");

    const gameId = getGameId(game);
    const isFavorite = favorites.has(gameId);

    card.innerHTML = `
      <button class="favorite-btn ${isFavorite ? "is-favorite" : ""}" type="button" aria-label="Favoritar jogo" data-favorite="${escapeHtml(gameId)}">
        <i class="fa-${isFavorite ? "solid" : "regular"} fa-heart"></i>
      </button>

      <div class="game-media"></div>

      <div class="game-content">
        <h3>${escapeHtml(game.jogo)}</h3>
        <p class="owner-line"><strong>Responsável:</strong> ${escapeHtml(game.responsavel || "Equipe")}</p>

        <div class="meta">
          <span>${escapeHtml(game.dificuldade || "Não informado")}</span>
          <span>${escapeHtml(game.tempo || "Não informado")}</span>
          <span>${escapeHtml(game.jogadores || "Não informado")} jogadores</span>
          <span>${escapeHtml(game.estilo || "Não informado")}</span>
        </div>

        <p class="game-description-preview">
          ${escapeHtml(game.descricao || "Clique no card para ver a descrição completa do jogo.")}
        </p>
      </div>
    `;

    const media = card.querySelector(".game-media");

    if (game.imagem) {
      const img = document.createElement("img");
      img.className = "game-image";
      img.src = game.imagem;
      img.alt = `Capa do jogo ${game.jogo}`;
      img.loading = "lazy";
      attachImageFallback(img, game.jogo);
      media.appendChild(img);
    } else {
      media.appendChild(createPlaceholder(game.jogo));
    }

    card.addEventListener("click", (event) => {
      if (event.target.closest(".favorite-btn")) return;
      openGameModal(game);
    });

    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openGameModal(game);
      }
    });

    els.grid.appendChild(card);
  });

  document.querySelectorAll(".favorite-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();

      const gameId = button.dataset.favorite;
      const icon = button.querySelector("i");

      if (favorites.has(gameId)) {
        favorites.delete(gameId);
        button.classList.remove("is-favorite");
        icon.className = "fa-regular fa-heart";
      } else {
        favorites.add(gameId);
        button.classList.add("is-favorite");
        icon.className = "fa-solid fa-heart";
      }

      saveFavorites();
      renderFavoritesList();
      updateWhatsappButton();

      if (state.showOnlyFavorites) {
        applyFilters();
      }
    });
  });
}

// Aplica busca, selects, tempo/jogadores (número dentro da faixa do jogo) e "só favoritos", depois redesenha.
function applyFilters() {
  const searchTerm = normalize(els.search.value);
  const difficultyTerm = normalize(els.difficulty.value);
  const timeTerm = normalize(els.time.value);
  const timeMinutes = Number.parseInt(timeTerm, 10);
  const hasTimeFilter = Number.isInteger(timeMinutes) && timeMinutes > 0;
  const playersTerm = normalize(els.players.value);
  const playersCount = Number.parseInt(playersTerm, 10);
  const hasPlayersCountFilter = Number.isInteger(playersCount) && playersCount > 0;
  const styleTerm = normalize(els.style.value);
  const ownerTerm = normalize(els.owner.value);

  state.filtered = state.games.filter((game) => {
    const matchesSearch = normalize(game.jogo).includes(searchTerm);
    const matchesDifficulty = !difficultyTerm || normalize(game.dificuldade) === difficultyTerm;
    const gameTime = parseTimeRange(game.tempo);
    const matchesTime =
      !hasTimeFilter ||
      (gameTime && timeMinutes >= gameTime.min && timeMinutes <= gameTime.max);
    const gamePlayers = parsePlayersRange(game.jogadores);
    const matchesPlayers =
      !hasPlayersCountFilter ||
      (gamePlayers && playersCount >= gamePlayers.min && playersCount <= gamePlayers.max);
    const matchesStyle = !styleTerm || normalize(game.estilo) === styleTerm;
    const matchesOwner = !ownerTerm || normalize(game.responsavel) === ownerTerm;
    const matchesFavorite = !state.showOnlyFavorites || favorites.has(getGameId(game));

    return (
      matchesSearch &&
      matchesDifficulty &&
      matchesTime &&
      matchesPlayers &&
      matchesStyle &&
      matchesOwner &&
      matchesFavorite
    );
  });

  renderGames(state.filtered);
}

// Preenche os selects com valores do JSON e liga eventos de filtros, limpar, favoritos, modais e tecla Esc.
function setupFilters() {
  injectOptions(els.difficulty, safeOptions(state.games, "dificuldade"));
  injectOptions(els.style, safeOptions(state.games, "estilo"));
  injectOptions(els.owner, safeOptions(state.games, "responsavel"));

  [els.search, els.difficulty, els.time, els.players, els.style, els.owner].forEach((el) => {
    el.addEventListener("input", applyFilters);
    el.addEventListener("change", applyFilters);
  });

  els.clearBtn.addEventListener("click", () => {
    els.search.value = "";
    els.difficulty.value = "";
    els.time.value = "";
    els.players.value = "";
    els.style.value = "";
    els.owner.value = "";
    state.showOnlyFavorites = false;
    els.showOnlyFavoritesBtn.textContent = "Só favoritos";
    applyFilters();
  });

  els.showOnlyFavoritesBtn.addEventListener("click", () => {
    state.showOnlyFavorites = !state.showOnlyFavorites;
    els.showOnlyFavoritesBtn.textContent = state.showOnlyFavorites ? "Mostrando favoritos" : "Só favoritos";
    applyFilters();
  });

  els.openFavoritesBtn.addEventListener("click", openFavoritesModal);
  els.closeFavoritesBtn.addEventListener("click", closeFavoritesModal);

  els.favoritesModal.addEventListener("click", (event) => {
    if (event.target.matches("[data-close-favorites='true']")) {
      closeFavoritesModal();
    }
  });

  els.clearFavoritesBtn.addEventListener("click", () => {
    favorites.clear();
    saveFavorites();
    renderFavoritesList();
    updateFavoriteButtonsUI();
    applyFilters();
  });

  els.closeModalBtn.addEventListener("click", closeGameModal);

  els.modal.addEventListener("click", (event) => {
    if (event.target.matches("[data-close-modal='true']")) {
      closeGameModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!els.modal.classList.contains("hidden")) {
        closeGameModal();
      }
      if (!els.favoritesModal.classList.contains("hidden")) {
        closeFavoritesModal();
      }
    }
  });
}

// Carrega data/games.json e inicializa o catálogo; em caso de erro mostra uma mensagem na tela.
async function initCatalog() {
  try {
    const response = await fetch("./data/games.json");
    if (!response.ok) {
      throw new Error("Falha ao carregar o catálogo.");
    }

    state.games = await response.json();
    setupFilters();
    renderFavoritesList();
    updateWhatsappButton();
    applyFilters();
  } catch (error) {
    els.info.textContent = "Não foi possível carregar o catálogo no momento.";
    els.grid.innerHTML = `<p class="card">Erro: ${escapeHtml(error.message)}</p>`;
    console.error(error);
  }
}

// Inicialização quando o DOM estiver pronto.
window.addEventListener("DOMContentLoaded", initCatalog);
window.addEventListener("DOMContentLoaded", setupTheme);
window.addEventListener("DOMContentLoaded", setupShowcase);
