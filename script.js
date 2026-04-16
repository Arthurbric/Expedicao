const state = {
  games: [],
  filtered: [],
  showOnlyFavorites: false,
  activeSlide: 0,
  sliderInterval: null,
};

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

const whatsappNumber = "5500000000000";
const favorites = new Set(JSON.parse(localStorage.getItem("favoriteGames") || "[]"));
const THEME_STORAGE_KEY = "preferredTheme";

function updateThemeToggleLabel(theme) {
  if (!els.themeToggleBtn) return;
  const icon = theme === "light" ? "fa-regular fa-moon" : "fa-regular fa-sun";
  const label = theme === "light" ? "Tema escuro" : "Tema claro";

  els.themeToggleBtn.innerHTML = `<i class="${icon}"></i>${label}`;
}

function applyTheme(theme) {
  const normalizedTheme = theme === "light" ? "light" : "dark";
  document.body.setAttribute("data-theme", normalizedTheme);
  localStorage.setItem(THEME_STORAGE_KEY, normalizedTheme);
  updateThemeToggleLabel(normalizedTheme);
}

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

function normalize(value = "") {
  return value.toString().trim().toLowerCase();
}

function escapeHtml(text = "") {
  return text
    .toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeOptions(data, key) {
  return [...new Set(data.map((item) => item[key]).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}

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

function createPlaceholder(name = "Jogo") {
  const div = document.createElement("div");
  div.className = "game-image-placeholder";
  div.setAttribute("role", "img");
  div.setAttribute("aria-label", "Imagem de capa não disponível");
  div.textContent = name.split(" ")[0] || "Jogo";
  return div;
}

function saveFavorites() {
  localStorage.setItem("favoriteGames", JSON.stringify([...favorites]));
}

function getGameId(game) {
  return game.jogo;
}

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

function updateWhatsappButton() {
  els.sendFavoritesWhatsappBtn.href = buildWhatsappLink();
}

function updateFavoriteButtonsUI() {
  document.querySelectorAll(".favorite-btn").forEach((button) => {
    const gameId = button.dataset.favorite;
    const icon = button.querySelector("i");
    const isFavorite = favorites.has(gameId);

    button.classList.toggle("is-favorite", isFavorite);
    icon.className = isFavorite ? "fa-solid fa-heart" : "fa-regular fa-heart";
  });
}

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

function openFavoritesModal() {
  renderFavoritesList();
  els.favoritesModal.classList.remove("hidden");
  els.favoritesModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeFavoritesModal() {
  els.favoritesModal.classList.add("hidden");
  els.favoritesModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

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

function closeGameModal() {
  els.modal.classList.add("hidden");
  els.modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function attachImageFallback(img, gameName) {
  img.addEventListener("error", () => {
    const placeholder = createPlaceholder(gameName);
    img.replaceWith(placeholder);
  });
}

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

function applyFilters() {
  const searchTerm = normalize(els.search.value);
  const difficultyTerm = normalize(els.difficulty.value);
  const timeTerm = normalize(els.time.value);
  const playersTerm = normalize(els.players.value);
  const styleTerm = normalize(els.style.value);
  const ownerTerm = normalize(els.owner.value);

  state.filtered = state.games.filter((game) => {
    const matchesSearch = normalize(game.jogo).includes(searchTerm);
    const matchesDifficulty = !difficultyTerm || normalize(game.dificuldade) === difficultyTerm;
    const matchesTime = !timeTerm || normalize(game.tempo) === timeTerm;
    const matchesPlayers = !playersTerm || normalize(game.jogadores) === playersTerm;
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

function setupFilters() {
  injectOptions(els.difficulty, safeOptions(state.games, "dificuldade"));
  injectOptions(els.time, safeOptions(state.games, "tempo"));
  injectOptions(els.players, safeOptions(state.games, "jogadores"));
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

window.addEventListener("DOMContentLoaded", initCatalog);
window.addEventListener("DOMContentLoaded", setupTheme);
window.addEventListener("DOMContentLoaded", setupShowcase);
