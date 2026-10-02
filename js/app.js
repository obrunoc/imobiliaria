(() => {
  "use strict";

  // ---------- Utilidades ----------
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const brl = (n) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  const icon = (id) => `<svg aria-hidden="true"><use href="#i-${id}"/></svg>`;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const digits = (s) => String(s || "").replace(/\D/g, "");
  const uniqSorted = (arr) => [...new Set(arr.filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));

  const storage = {
    get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
    set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* sem storage */ } },
  };

  const WHATS = (window.VC_CONFIG && window.VC_CONFIG.whatsapp) || "5535000000000";
  const PRICES = {
    comprar: [200000, 300000, 500000, 800000],
    alugar: [1000, 1500, 2000, 3000],
  };

  // ---------- Estado ----------
  let PROPERTIES = [];
  const DEFAULTS = { mode: "comprar", hood: "", type: "", beds: 0, priceMax: 0, parking: 0, amenities: [], sort: "recent" };
  const state = { ...DEFAULTS, amenities: [] };
  const favorites = new Set(storage.get("vc:favs", []).map(String));
  let lastFocus = null;
  let loaded = false;

  const totalOf = (p) => Number(p.price) + Number(p.condo || 0) + Number(p.iptu || 0);
  const comparable = (p) => (p.mode === "alugar" ? totalOf(p) : Number(p.price));
  const daysAgo = (p) => (Date.now() - Date.parse(p.created_at)) / 864e5;
  const cover = (p) => (p.media.find((m) => m.type === "image") || p.media[0] || {}).src || "";
  const findProp = (id) => PROPERTIES.find((x) => String(x.id) === String(id));

  function filtered() {
    const list = PROPERTIES.filter((p) =>
      p.mode === state.mode &&
      (!state.hood || p.neighborhood === state.hood) &&
      (!state.type || p.type === state.type) &&
      p.beds >= state.beds &&
      p.parking >= state.parking &&
      (!state.priceMax || comparable(p) <= state.priceMax) &&
      state.amenities.every((a) => (p.amenities || []).includes(a)));
    const sorters = {
      recent: (a, b) => String(b.created_at).localeCompare(String(a.created_at)),
      "price-asc": (a, b) => comparable(a) - comparable(b),
      "price-desc": (a, b) => comparable(b) - comparable(a),
    };
    return list.sort(sorters[state.sort]);
  }

  const hasFilters = () => state.hood || state.type || state.beds || state.priceMax || state.parking || state.amenities.length;

  // ---------- Cards ----------
  function specsHTML(p) {
    return [
      p.area ? `<span class="spec">${icon("area")}${p.area} m²</span>` : "",
      p.beds ? `<span class="spec">${icon("bed")}${plural(p.beds, "quarto", "quartos")}</span>` : "",
      p.baths ? `<span class="spec">${icon("bath")}${p.baths}</span>` : "",
      p.parking ? `<span class="spec">${icon("car")}${p.parking}</span>` : "",
    ].join("");
  }

  function cardHTML(p, i) {
    const fav = favorites.has(String(p.id));
    const rent = p.mode === "alugar";
    const extra = rent && totalOf(p) !== Number(p.price) ? `<span class="card__sub">${brl(totalOf(p))}/mês com condomínio e IPTU</span>` : "";
    const badge = p.status === "reservado" ? `<span class="badge badge--dark">Reservado</span>` : daysAgo(p) <= 3 ? `<span class="badge">Novo</span>` : "";
    const src = cover(p);
    return `
      <article class="card" data-id="${esc(p.id)}" tabindex="0" style="animation-delay:${Math.min(i, 8) * 40}ms" aria-label="${esc(p.type)} em ${esc(p.neighborhood)}">
        <div class="card__media">
          ${src ? `<img src="${esc(src)}" alt="" loading="lazy" />` : ""}
          ${badge}
          <button class="fav-btn ${fav ? "is-fav" : ""}" data-fav="${esc(p.id)}" aria-pressed="${fav}" aria-label="Favoritar">${icon(fav ? "heart" : "heart-o")}</button>
        </div>
        <div class="card__body">
          <div class="card__price">${brl(p.price)}${rent ? "<small>/mês</small>" : ""}</div>
          ${extra}
          <h3 class="card__title">${esc(p.type)} · ${esc(p.neighborhood)}</h3>
          <div class="specs">${specsHTML(p)}</div>
        </div>
      </article>`;
  }

  // ---------- Render ----------
  function render() {
    if (!loaded) return;
    const list = filtered();
    $("#grid").innerHTML = list.map(cardHTML).join("");
    $("#empty").hidden = list.length > 0;
    $("#resultsTitle").textContent = state.mode === "alugar" ? "Imóveis para alugar" : "Imóveis à venda";
    $("#resultsCount").textContent = plural(list.length, "imóvel disponível", "imóveis disponíveis");
    $("#clearRow").hidden = !hasFilters();
    $("#moreDot").hidden = !(state.parking || state.amenities.length);
    syncControls();
  }

  function syncControls() {
    $$("[data-mode]").forEach((b) => {
      const on = b.dataset.mode === state.mode;
      b.classList.toggle("is-active", on);
      b.setAttribute(b.getAttribute("role") === "tab" ? "aria-selected" : "aria-checked", on);
    });
    const sets = { fHood: state.hood, fType: state.type, fBeds: String(state.beds), fPrice: String(state.priceMax || ""), sort: state.sort };
    Object.entries(sets).forEach(([id, v]) => {
      const el = $(`#${id}`);
      el.value = v;
      if (id !== "sort") el.classList.toggle("is-set", Boolean(v) && v !== "0");
    });
    $$("#fParking button").forEach((b) => b.classList.toggle("is-active", +b.dataset.value === state.parking));
    $$("#fAmenities button").forEach((b) => b.classList.toggle("is-active", state.amenities.includes(b.dataset.amenity)));
  }

  function fillPriceSelect() {
    const rent = state.mode === "alugar";
    $("#fPrice").innerHTML = `<option value="">Preço</option>` +
      PRICES[state.mode].map((v) => `<option value="${v}">Até ${brl(v)}${rent ? "/mês" : ""}</option>`).join("");
  }

  function setMode(mode) {
    if (state.mode === mode) return;
    state.mode = mode;
    state.priceMax = 0;
    fillPriceSelect();
    render();
  }

  function clearFilters() {
    Object.assign(state, { ...DEFAULTS, mode: state.mode, sort: state.sort, amenities: [] });
    render();
  }

  // ---------- Favoritos ----------
  function toggleFav(id) {
    const on = !favorites.has(id);
    on ? favorites.add(id) : favorites.delete(id);
    storage.set("vc:favs", [...favorites]);
    toast(on ? "Salvo nos favoritos" : "Removido dos favoritos");
    $$(`[data-fav="${CSS.escape(id)}"]`).forEach((b) => {
      b.classList.toggle("is-fav", on);
      b.setAttribute("aria-pressed", on);
      b.innerHTML = b.classList.contains("btn") ? `${icon(on ? "heart" : "heart-o")} ${on ? "Salvo" : "Salvar"}` : icon(on ? "heart" : "heart-o");
    });
    updateFavCount();
    if (!$("#favDrawer").hidden) renderFavs();
  }

  function updateFavCount() {
    const n = PROPERTIES.filter((p) => favorites.has(String(p.id))).length;
    $("#favCount").hidden = n === 0;
    $("#favCount").textContent = n;
    $("#openFavs use").setAttribute("href", n ? "#i-heart" : "#i-heart-o");
  }

  function renderFavs() {
    const items = PROPERTIES.filter((p) => favorites.has(String(p.id)));
    $("#favList").innerHTML = items.length
      ? items.map((p) => `
        <div class="fav-item" data-open="${esc(p.id)}" tabindex="0">
          <img src="${esc(cover(p))}" alt="" />
          <div><strong>${brl(p.price)}${p.mode === "alugar" ? "/mês" : ""}</strong><span>${esc(p.type)} · ${esc(p.neighborhood)}</span></div>
          <button class="icon-btn" data-fav="${esc(p.id)}" aria-label="Remover dos favoritos">${icon("close")}</button>
        </div>`).join("")
      : `<p class="fav-empty">Toque no coração de um imóvel para guardá-lo aqui.</p>`;
  }

  function openDrawer() {
    lastFocus = document.activeElement;
    renderFavs();
    $("#favDrawer").hidden = false;
    document.body.classList.add("no-scroll");
    $("#favDrawer .icon-btn").focus();
  }

  function closeDrawer() {
    $("#favDrawer").hidden = true;
    if ($("#modal").hidden) document.body.classList.remove("no-scroll");
    lastFocus?.focus?.();
  }

  // ---------- Detalhes ----------
  let galleryStep = null;

  function openDetail(id) {
    const p = findProp(id);
    if (!p) return;
    lastFocus = document.activeElement;
    $("#modalContent").innerHTML = detailHTML(p);
    $("#modal").hidden = false;
    document.body.classList.add("no-scroll");
    $("#modalContent").scrollTop = 0;
    $(".modal__panel").focus();
    setupGallery(p);
    setupScheduler();
  }

  function closeModal() {
    if ($("#modal").hidden) return;
    $("#modal").hidden = true;
    $$("#modalContent video").forEach((v) => v.pause());
    $("#modalContent").innerHTML = "";
    galleryStep = null;
    if ($("#favDrawer").hidden) document.body.classList.remove("no-scroll");
    lastFocus?.focus?.();
  }

  function mediaHTML(m, alt) {
    return m.type === "video"
      ? `<video src="${esc(m.src)}" controls playsinline preload="metadata"></video>`
      : `<img src="${esc(m.src)}" alt="${esc(alt)}" />`;
  }

  function detailHTML(p) {
    const rent = p.mode === "alugar";
    const fav = favorites.has(String(p.id));
    const city = typeof CITY !== "undefined" ? CITY : "Brazópolis - MG";
    const mapQ = encodeURIComponent(`${p.street}, ${p.neighborhood}, ${city}`);
    const msg = encodeURIComponent(`Olá! Tenho interesse no imóvel cód. ${p.code}: ${p.type} no bairro ${p.neighborhood}.`);
    const lines = rent
      ? `<ul class="lines">
          <li><span>Aluguel</span><span>${brl(p.price)}</span></li>
          ${Number(p.condo) ? `<li><span>Condomínio</span><span>${brl(p.condo)}</span></li>` : ""}
          ${Number(p.iptu) ? `<li><span>IPTU</span><span>${brl(p.iptu)}</span></li>` : ""}
          <li class="total"><span>Total por mês</span><span>${brl(totalOf(p))}</span></li>
        </ul>`
      : (Number(p.condo) || Number(p.iptu)) ? `<ul class="lines">
          ${Number(p.condo) ? `<li><span>Condomínio</span><span>${brl(p.condo)}/mês</span></li>` : ""}
          ${Number(p.iptu) ? `<li><span>IPTU</span><span>${brl(p.iptu)}/mês</span></li>` : ""}
        </ul>` : "";
    const media = p.media.length ? p.media : [{ type: "image", src: "" }];
    const alt = `${p.type} em ${p.neighborhood}`;

    return `
      <div class="gallery__main" id="gMain">
        ${mediaHTML(media[0], `${alt}, foto 1`)}
        ${media.length > 1 ? `
          <button class="gallery__nav gallery__nav--prev" data-g="-1" aria-label="Anterior">${icon("left")}</button>
          <button class="gallery__nav gallery__nav--next" data-g="1" aria-label="Próxima">${icon("right")}</button>
          <span class="gallery__counter" id="gCounter">1 / ${media.length}</span>` : ""}
      </div>
      <div class="detail">
        <div>
          <span class="detail__tag">${esc(p.type)} ${rent ? "para alugar" : "à venda"}${p.status === "reservado" ? " · Reservado" : ""}</span>
          <h2 id="mTitle">${esc(p.neighborhood)}</h2>
          <p class="muted">${p.street ? `${esc(p.street)} · ` : ""}${esc(city)} · Cód. ${esc(p.code)}</p>
          <div class="specs">${specsHTML(p)}</div>

          ${p.description ? `<h3>Sobre o imóvel</h3><p class="detail__desc">${esc(p.description)}</p>` : ""}

          ${(p.amenities || []).length ? `<h3>Diferenciais</h3><div class="amen">${p.amenities.map((a) => `<span>${esc(a)}</span>`).join("")}</div>` : ""}

          <a class="map-link" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${mapQ}">${icon("pin")} Ver localização no mapa</a>
        </div>

        <aside class="side">
          <div class="price-box">
            <div class="big">${brl(p.price)}${rent ? "<small>/mês</small>" : ""}</div>
            ${lines}
          </div>
          <div class="visit">
            <h4>Agendar visita</h4>
            <div class="days" id="days" aria-label="Dia"></div>
            <div class="times" id="times" aria-label="Horário"></div>
            <form class="visit-form" id="visitForm">
              <input class="input" id="vName" name="nome" required placeholder="Seu nome" autocomplete="name" />
              <input class="input" id="vPhone" name="tel" required type="tel" placeholder="Seu WhatsApp" autocomplete="tel" data-mask="phone" />
              <button class="btn btn--primary btn--block" type="submit">Agendar visita</button>
            </form>
          </div>
          <a class="btn btn--outline btn--block" target="_blank" rel="noopener" href="https://wa.me/${WHATS}?text=${msg}">${icon("whats")} Tirar dúvidas no WhatsApp</a>
          <button class="btn btn--outline btn--block ${fav ? "is-fav" : ""}" data-fav="${esc(p.id)}" aria-pressed="${fav}">${icon(fav ? "heart" : "heart-o")} ${fav ? "Salvo" : "Salvar"}</button>
        </aside>
      </div>`;
  }

  function setupGallery(p) {
    const media = p.media;
    if (media.length < 2) return;
    let i = 0;
    const alt = `${p.type} em ${p.neighborhood}`;
    const show = (n) => {
      i = (n + media.length) % media.length;
      $("#gMain video")?.pause();
      $("#gMain img, #gMain video").outerHTML = mediaHTML(media[i], `${alt}, foto ${i + 1}`);
      $("#gCounter").textContent = `${i + 1} / ${media.length}`;
    };
    galleryStep = (d) => show(i + d);
    $("#gMain").addEventListener("click", (e) => {
      const nav = e.target.closest("[data-g]");
      if (nav) show(i + +nav.dataset.g);
    });
    let x0 = null;
    $("#gMain").addEventListener("touchstart", (e) => (x0 = e.touches[0].clientX), { passive: true });
    $("#gMain").addEventListener("touchend", (e) => {
      if (x0 === null || e.target.closest("video")) { x0 = null; return; }
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) show(i + (dx < 0 ? 1 : -1));
      x0 = null;
    });
  }

  function setupScheduler() {
    const WEEK = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const TIMES = ["09:00", "10:30", "14:00", "15:30", "17:00"];
    const days = [];
    const d = new Date();
    while (days.length < 7) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() !== 0) days.push(new Date(d));
    }
    let selDay = 0, selTime = null;
    const draw = () => {
      const times = days[selDay].getDay() === 6 ? TIMES.slice(0, 2) : TIMES;
      if (!times.includes(selTime)) selTime = null;
      $("#days").innerHTML = days.map((day, k) => `<button type="button" class="${k === selDay ? "is-active" : ""}" data-day="${k}" aria-pressed="${k === selDay}">${WEEK[day.getDay()]}<strong>${day.getDate()}</strong></button>`).join("");
      $("#times").innerHTML = times.map((t) => `<button type="button" class="${t === selTime ? "is-active" : ""}" data-time="${t}" aria-pressed="${t === selTime}">${t}</button>`).join("");
    };
    draw();
    $("#days").addEventListener("click", (e) => { const b = e.target.closest("[data-day]"); if (b) { selDay = +b.dataset.day; draw(); } });
    $("#times").addEventListener("click", (e) => { const b = e.target.closest("[data-time]"); if (b) { selTime = b.dataset.time; draw(); } });
    $("#visitForm").addEventListener("submit", (e) => {
      e.preventDefault();
      if (!selTime) { toast("Escolha um horário"); return; }
      const day = days[selDay];
      toast(`Pedido enviado: ${WEEK[day.getDay()].toLowerCase()}, ${day.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às ${selTime}. Vamos confirmar pelo WhatsApp.`, 4000);
      e.target.reset();
      selTime = null;
      draw();
    });
  }

  // ---------- Toast ----------
  let toastTimer;
  function toast(text, ms = 2200) {
    const t = $("#toast");
    t.textContent = text;
    t.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("is-visible"), ms);
  }

  // ---------- Setup ----------
  function buildStaticUI() {
    $("#fParking").innerHTML = [0, 1, 2].map((v) => `<button type="button" data-value="${v}">${v ? `${v}+` : "Tanto faz"}</button>`).join("");
    $("#year").textContent = new Date().getFullYear();
    fillPriceSelect();
  }

  // Bairros, tipos e comodidades vêm dos imóveis cadastrados
  function buildDataUI() {
    const opts = (arr) => arr.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
    const hoods = opts(uniqSorted(PROPERTIES.map((p) => p.neighborhood)));
    const types = opts(uniqSorted(PROPERTIES.map((p) => p.type)));
    $("#heroHood").innerHTML = `<option value="">Todos os bairros</option>${hoods}`;
    $("#fHood").innerHTML = `<option value="">Bairro</option>${hoods}`;
    $("#heroType").innerHTML = `<option value="">Todos os tipos</option>${types}`;
    $("#fType").innerHTML = `<option value="">Tipo</option>${types}`;
    const amen = uniqSorted(PROPERTIES.flatMap((p) => p.amenities || []));
    $("#fAmenities").innerHTML = amen.map((a) => `<button type="button" data-amenity="${esc(a)}">${esc(a)}</button>`).join("");
  }

  const scrollToResults = () => $("#imoveis").scrollIntoView({ behavior: "smooth" });

  function bindEvents() {
    $("#menuBtn").addEventListener("click", () => {
      const open = $("#nav").classList.toggle("is-open");
      $("#menuBtn").setAttribute("aria-expanded", open);
    });
    $("#nav").addEventListener("click", () => { $("#nav").classList.remove("is-open"); $("#menuBtn").setAttribute("aria-expanded", false); });
    $$("[data-set-mode]").forEach((a) => a.addEventListener("click", () => setMode(a.dataset.setMode)));
    $$("[data-mode]").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));

    $("#heroSearch").addEventListener("submit", (e) => {
      e.preventDefault();
      state.hood = $("#heroHood").value;
      state.type = $("#heroType").value;
      render();
      scrollToResults();
    });

    $("#fHood").addEventListener("change", (e) => { state.hood = e.target.value; render(); });
    $("#fType").addEventListener("change", (e) => { state.type = e.target.value; render(); });
    $("#fBeds").addEventListener("change", (e) => { state.beds = +e.target.value; render(); });
    $("#fPrice").addEventListener("change", (e) => { state.priceMax = +e.target.value || 0; render(); });
    $("#sort").addEventListener("change", (e) => { state.sort = e.target.value; render(); });
    $("#moreBtn").addEventListener("click", () => {
      const open = $("#more").hidden;
      $("#more").hidden = !open;
      $("#moreBtn").setAttribute("aria-expanded", open);
    });
    $("#fParking").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { state.parking = +b.dataset.value; render(); } });
    $("#fAmenities").addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      const a = b.dataset.amenity;
      state.amenities = state.amenities.includes(a) ? state.amenities.filter((x) => x !== a) : [...state.amenities, a];
      render();
    });
    $("#clearFilters").addEventListener("click", clearFilters);
    $("#emptyClear").addEventListener("click", clearFilters);
    $("#openFavs").addEventListener("click", openDrawer);

    document.addEventListener("click", (e) => {
      const fav = e.target.closest("[data-fav]");
      if (fav) { toggleFav(fav.dataset.fav); return; }
      const card = e.target.closest(".card[data-id], [data-open]");
      if (card) {
        if (!$("#favDrawer").hidden) closeDrawer();
        openDetail(card.dataset.id || card.dataset.open);
        return;
      }
      if (e.target.closest("#modal [data-close]")) closeModal();
      if (e.target.closest("#favDrawer [data-close]")) closeDrawer();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.matches(".card[data-id], [data-open]")) e.target.click();
      if (e.key === "Escape") { if (!$("#modal").hidden) closeModal(); else if (!$("#favDrawer").hidden) closeDrawer(); }
      if (galleryStep && !e.target.matches("input, video")) {
        if (e.key === "ArrowRight") galleryStep(1);
        if (e.key === "ArrowLeft") galleryStep(-1);
      }
    });

    // máscara de telefone
    document.addEventListener("input", (e) => {
      if (e.target.dataset.mask !== "phone") return;
      const d = digits(e.target.value).slice(0, 11);
      let out = d;
      if (d.length > 2) out = `(${d.slice(0, 2)}) ${d.slice(2)}`;
      if (d.length > 7) out = `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
      e.target.value = out;
    });

    // imagem que falhar some em vez de mostrar ícone quebrado
    document.addEventListener("error", (e) => { if (e.target.tagName === "IMG") e.target.classList.add("is-broken"); }, true);
  }

  async function load() {
    $("#resultsCount").textContent = "Carregando imóveis…";
    try {
      PROPERTIES = await Store.listPublic();
    } catch (err) {
      console.error(err);
      $("#resultsCount").textContent = "Não foi possível carregar os imóveis agora. Atualize a página em instantes.";
      return;
    }
    loaded = true;
    buildDataUI();
    updateFavCount();
    render();
  }

  buildStaticUI();
  bindEvents();
  load();
})();
