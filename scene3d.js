/*
 * scene3d.js — cena 3D de fundo feita com Three.js (r128).
 *
 * Objetos de jogos de tabuleiro (dados, cartas, peões e fichas hexagonais)
 * flutuando atrás do conteúdo. A cena reage ao mouse (parallax), à rolagem
 * da página e ao clique no fundo (os objetos recebem um "empurrão" e giram).
 *
 * Se o WebGL ou o Three.js não estiverem disponíveis, o canvas é removido
 * e o site continua funcionando normalmente.
 */
(() => {
  "use strict";

  const canvas = document.getElementById("scene3d");
  if (!canvas) return;

  // Sem Three.js (CDN fora do ar, por exemplo): remove o canvas e sai
  if (!window.THREE) {
    canvas.remove();
    return;
  }

  const THREE = window.THREE;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Telas pequenas ganham menos objetos e menos qualidade para poupar bateria
  const isSmallScreen = () => window.innerWidth < 768;

  // Paleta alinhada com as cores do site
  const COLORS = {
    green: 0x22c55e,
    blue: 0x60a5fa,
    amber: 0xf59e0b,
    rose: 0xfb7185,
    violet: 0xa78bfa,
    ivory: 0xf8fafc,
  };
  const COLOR_LIST = Object.values(COLORS);

  /* =====================================================================
   * Renderer, cena, câmera e luzes
   * ===================================================================== */

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true, // fundo transparente: o gradiente do site aparece atrás
      antialias: !isSmallScreen(),
      powerPreference: "low-power",
    });
  } catch (error) {
    console.warn("WebGL indisponível, cena 3D desativada.", error);
    canvas.remove();
    return;
  }

  // Limita a densidade de pixels para não pesar em telas retina
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSmallScreen() ? 1.5 : 1.75));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.z = 14;

  // Luz ambiente suave + luz principal + duas luzes coloridas que dão o "clima"
  scene.add(new THREE.AmbientLight(0xffffff, 0.75));

  const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
  keyLight.position.set(5, 8, 10);
  scene.add(keyLight);

  const blueLight = new THREE.PointLight(COLORS.blue, 0.9, 40);
  blueLight.position.set(-10, 4, 6);
  scene.add(blueLight);

  const greenLight = new THREE.PointLight(COLORS.green, 0.8, 40);
  greenLight.position.set(10, -4, 6);
  scene.add(greenLight);

  // Grupo que contém todos os objetos (facilita mexer na cena inteira com a rolagem)
  const world = new THREE.Group();
  scene.add(world);

  /* =====================================================================
   * Texturas desenhadas em <canvas> (sem imagens externas)
   * ===================================================================== */

  // Desenha um retângulo com cantos arredondados
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Posição dos pontinhos (grade 3x3) para cada face do dado
  const PIPS = {
    1: [[1, 1]],
    2: [[0, 0], [2, 2]],
    3: [[0, 0], [1, 1], [2, 2]],
    4: [[0, 0], [2, 0], [0, 2], [2, 2]],
    5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
    6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
  };

  // Cria a textura de uma face do dado com N pontinhos
  function dieFaceTexture(number, bodyColor, pipColor) {
    const size = 128;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d");

    ctx.fillStyle = bodyColor;
    ctx.fillRect(0, 0, size, size);

    // Leve borda interna para dar volume
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.lineWidth = 6;
    roundRect(ctx, 5, 5, size - 10, size - 10, 18);
    ctx.stroke();

    ctx.fillStyle = pipColor;
    PIPS[number].forEach(([col, row]) => {
      ctx.beginPath();
      ctx.arc(28 + col * 36, 28 + row * 36, 10, 0, Math.PI * 2);
      ctx.fill();
    });

    const texture = new THREE.CanvasTexture(c);
    texture.anisotropy = 4;
    return texture;
  }

  // Frente da carta: naipe grande no centro e pequeno nos cantos
  function cardFaceTexture(symbol, color) {
    const w = 128;
    const h = 192;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");

    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(15,23,42,0.25)";
    ctx.lineWidth = 4;
    roundRect(ctx, 4, 4, w - 8, h - 8, 12);
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 78px serif";
    ctx.fillText(symbol, w / 2, h / 2 + 4);
    ctx.font = "bold 26px serif";
    ctx.fillText(symbol, 22, 24);
    ctx.fillText(symbol, w - 22, h - 24);

    return new THREE.CanvasTexture(c);
  }

  // Verso da carta: fundo colorido com padrão de losangos
  function cardBackTexture(color) {
    const w = 128;
    const h = 192;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");

    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 3;

    for (let y = -h; y < h * 2; y += 24) {
      for (let x = -w; x < w * 2; x += 24) {
        ctx.beginPath();
        ctx.moveTo(x, y + 12);
        ctx.lineTo(x + 12, y);
        ctx.lineTo(x + 24, y + 12);
        ctx.lineTo(x + 12, y + 24);
        ctx.closePath();
        ctx.stroke();
      }
    }

    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = 8;
    roundRect(ctx, 6, 6, w - 12, h - 12, 12);
    ctx.stroke();

    return new THREE.CanvasTexture(c);
  }

  /* =====================================================================
   * Fábricas de objetos
   * ===================================================================== */

  // Dado: cubo com 6 materiais (uma textura por face)
  function createDie() {
    const bodies = ["#f8fafc", "#ef4444", "#2563eb", "#16a34a", "#f59e0b"];
    const body = bodies[Math.floor(Math.random() * bodies.length)];
    const pip = body === "#f8fafc" || body === "#f59e0b" ? "#0f172a" : "#f8fafc";

    const materials = [1, 2, 3, 4, 5, 6].map((n) => new THREE.MeshStandardMaterial({
      map: dieFaceTexture(n, body, pip),
      roughness: 0.35,
      metalness: 0.05,
    }));

    return new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), materials);
  }

  // Carta: caixa bem fina com frente e verso texturizados
  function createCard() {
    const suits = [
      ["♠", "#0f172a"],
      ["♥", "#dc2626"],
      ["♦", "#dc2626"],
      ["♣", "#0f172a"],
    ];
    const [symbol, color] = suits[Math.floor(Math.random() * suits.length)];
    const backColors = ["#1d4ed8", "#15803d", "#b45309", "#7c3aed"];
    const back = backColors[Math.floor(Math.random() * backColors.length)];

    const side = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.6 });
    // Ordem das faces do BoxGeometry: +x, -x, +y, -y, +z (frente), -z (verso)
    const materials = [
      side, side, side, side,
      new THREE.MeshStandardMaterial({ map: cardFaceTexture(symbol, color), roughness: 0.5 }),
      new THREE.MeshStandardMaterial({ map: cardBackTexture(back), roughness: 0.5 }),
    ];

    return new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.6, 0.04), materials);
  }

  // Peão: perfil girado (LatheGeometry) + esfera na cabeça
  function createPawn() {
    const color = COLOR_LIST[Math.floor(Math.random() * COLOR_LIST.length)];
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.15 });

    const profile = [
      [0.0, 0.0], [0.52, 0.0], [0.52, 0.1], [0.34, 0.24],
      [0.22, 0.7], [0.4, 0.78], [0.4, 0.9], [0.18, 0.98],
    ].map(([x, y]) => new THREE.Vector2(x, y));

    const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 24), material);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 16), material);
    head.position.y = 1.22;

    const pawn = new THREE.Group();
    pawn.add(body, head);
    // Centraliza o peão no próprio eixo para girar de forma natural
    body.position.y = -0.7;
    head.position.y = 0.52;
    return pawn;
  }

  // Ficha hexagonal (tile de jogos de estratégia)
  function createToken() {
    const color = COLOR_LIST[Math.floor(Math.random() * COLOR_LIST.length)];
    const token = new THREE.Group();

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.7, 0.2, 6),
      new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.1 }),
    );
    // Miolo mais claro para parecer uma ficha com relevo
    const inner = new THREE.Mesh(
      new THREE.CylinderGeometry(0.46, 0.46, 0.24, 6),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 }),
    );
    token.add(base, inner);
    return token;
  }

  const FACTORIES = [createDie, createCard, createPawn, createToken, createDie, createCard];

  /* =====================================================================
   * Montagem da cena
   * ===================================================================== */

  const items = [];
  let halfW = 10;
  let halfH = 6;

  // Metade da largura/altura visíveis no plano z = 0
  function updateViewSize() {
    const vFov = (camera.fov * Math.PI) / 180;
    halfH = Math.tan(vFov / 2) * camera.position.z;
    halfW = halfH * camera.aspect;
  }

  function buildItems() {
    const total = isSmallScreen() ? 9 : 18;

    for (let i = 0; i < total; i += 1) {
      const mesh = FACTORIES[i % FACTORIES.length]();
      const portrait = camera.aspect < 1;

      // Em telas largas empurramos os objetos para as laterais (longe do texto)
      const side = Math.random() < 0.5 ? -1 : 1;
      const nx = portrait ? Math.random() * 2 - 1 : side * (0.5 + Math.random() * 0.5);

      const item = {
        mesh,
        nx,
        ny: Math.random() * 2 - 1,
        z: -6 + Math.random() * 8,
        scale: 0.8 + Math.random() * 0.9,
        phase: Math.random() * Math.PI * 2,
        bobSpeed: 0.4 + Math.random() * 0.6,
        spin: new THREE.Vector3(
          (Math.random() - 0.5) * 0.5,
          (Math.random() - 0.5) * 0.7,
          (Math.random() - 0.5) * 0.4,
        ),
        impulse: new THREE.Vector3(), // extra de rotação vindo do clique
        baseX: 0,
        baseY: 0,
      };

      mesh.scale.setScalar(item.scale);
      mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      world.add(mesh);
      items.push(item);
    }
  }

  // Recalcula as posições-base quando a janela muda de tamanho
  function layoutItems() {
    items.forEach((item) => {
      item.baseX = item.nx * halfW;
      item.baseY = item.ny * halfH;
    });
  }

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    updateViewSize();
    layoutItems();
  }

  /* =====================================================================
   * Interação: mouse, rolagem e clique
   * ===================================================================== */

  const pointer = { x: 0, y: 0 }; // -1 a 1
  const smooth = { x: 0, y: 0 };
  let scrollY = 0;

  window.addEventListener("pointermove", (event) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  window.addEventListener("scroll", () => { scrollY = window.scrollY; }, { passive: true });

  // Clicar no fundo (fora de botões/cards) dá um empurrão nos objetos sob o cursor
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  window.addEventListener("click", (event) => {
    if (reduceMotion || !(event.target instanceof Element)) return;
    if (event.target.closest("a, button, input, select, textarea, label, .card, .game-card, .package-card, .step, .modal, .drawer, .stat, .contact-form")) return;

    ndc.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);

    const hits = raycaster.intersectObjects(world.children, true);
    if (!hits.length) return;

    // Descobre a qual item pertence o mesh atingido (peões e fichas são grupos)
    const hitItem = items.find((item) => {
      let node = hits[0].object;
      while (node) {
        if (node === item.mesh) return true;
        node = node.parent;
      }
      return false;
    });

    if (hitItem) {
      hitItem.impulse.set(
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 8,
      );
      window.siteSound?.dice(); // som de dado (se o usuário ligou o som)
    }
  });

  /* =====================================================================
   * Loop de animação
   * ===================================================================== */

  const clock = new THREE.Clock();
  let running = false;

  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);

    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    // Suaviza o movimento do mouse (parallax com atraso)
    smooth.x += (pointer.x - smooth.x) * 0.05;
    smooth.y += (pointer.y - smooth.y) * 0.05;

    camera.position.x = smooth.x * 1.2;
    camera.position.y = -smooth.y * 0.8;
    camera.lookAt(0, 0, 0);

    // A rolagem desloca a cena inteira devagar, criando profundidade
    world.position.y = scrollY * 0.004;
    world.rotation.y = scrollY * 0.0002;

    items.forEach((item) => {
      const { mesh } = item;

      // Flutuação suave (sobe e desce)
      mesh.position.x = item.baseX;
      mesh.position.y = item.baseY + Math.sin(t * item.bobSpeed + item.phase) * 0.5;
      mesh.position.z = item.z;

      // Rotação contínua + impulso do clique (que vai se dissipando)
      mesh.rotation.x += (item.spin.x + item.impulse.x) * dt;
      mesh.rotation.y += (item.spin.y + item.impulse.y) * dt;
      mesh.rotation.z += (item.spin.z + item.impulse.z) * dt;
      item.impulse.multiplyScalar(0.96);
    });

    renderer.render(scene, camera);
  }

  // Pausa quando a aba não está visível (economiza CPU/GPU e bateria)
  function start() {
    if (running || reduceMotion) return;
    running = true;
    clock.start();
    frame();
  }

  function stop() {
    running = false;
  }

  document.addEventListener("visibilitychange", () => {
    document.hidden ? stop() : start();
  });

  /* =====================================================================
   * Inicialização
   * ===================================================================== */

  // Revela o canvas (fade-in definido no CSS)
  function reveal() {
    canvas.classList.add("is-visible");
  }

  updateViewSize();
  buildItems();
  resize();

  // Debounce do resize para não recalcular a cada pixel
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  });

  if (reduceMotion) {
    // Sem animação: um único quadro estático
    renderer.render(scene, camera);
    reveal();
  } else {
    start();
    // O canvas aparece só quando o loader sai; o timeout é só uma garantia
    window.addEventListener("site:ready", reveal, { once: true });
    setTimeout(reveal, 9000);
  }
})();
