(() => {
  "use strict";

  const { $, $$, brl, icon, plural, esc, digits, norm, uniqSorted } = U;
  const { comparable, cover, favorites, toast } = Site;

  const PRICES = {
    comprar: [200000, 300000, 500000, 800000],
    alugar: [1000, 1500, 2000, 3000],
  };

  // ---------- Estado ----------
  let PROPERTIES = [];
  const DEFAULTS = { mode: "comprar", text: "", hood: "", type: "", beds: 0, priceMax: 0, parking: 0, amenities: [], sort: "recent" };
  const state = { ...DEFAULTS, amenities: [] };
  let lastFocus = null;
  let loaded = false;

  const findProp = (id) => PROPERTIES.find((x) => String(x.id) === String(id));
  const codeQuery = () => { const m = norm(state.text).match(/^(?:cod(?:igo)?\.?\s*)?(\d+)$/); return m ? Number(m[1]) : 0; };

  function filtered() {
    const code = codeQuery();
    if (code) return PROPERTIES.filter((p) => Number(p.code) === code);
    const q = norm(state.text);
    const list = PROPERTIES.filter((p) =>
      p.mode === state.mode &&
      (!q || norm(`${p.street} ${p.neighborhood} ${p.type}`).includes(q)) &&
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

  const hasFilters = () => state.text || state.hood || state.type || state.beds || state.priceMax || state.parking || state.amenities.length;

  // ---------- Render ----------
  function render() {
    if (!loaded) return;
    const list = filtered();
    const code = codeQuery();
    $("#grid").innerHTML = list.map(Site.cardHTML).join("");
    $("#empty").hidden = list.length > 0;
    $("#resultsTitle").textContent = code ? `Imóvel cód. ${code}` : state.mode === "alugar" ? "Imóveis para alugar" : "Imóveis à venda";
    $("#resultsCount").textContent = code && !list.length
      ? "Nenhum imóvel disponível com esse código."
      : plural(list.length, "imóvel disponível", "imóveis disponíveis");
    $("#clearRow").hidden = !hasFilters();
    $("#moreDot").hidden = !(state.parking || state.amenities.length);
    syncControls();
  }

  function renderFeatured() {
    const list = PROPERTIES.filter((p) => p.featured).slice(0, 3);
    $("#destaques").hidden = list.length === 0;
    $("#featuredGrid").innerHTML = list.map(Site.cardHTML).join("");
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
    if (document.activeElement !== $("#fText")) $("#fText").value = state.text;
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

  // ---------- Quem somos / equipe / depoimentos ----------
  function renderAbout(s) {
    $("#aboutText").textContent = s.about || "";
    const team = (s.team || []).filter((m) => m.name);
    $("#team").hidden = team.length === 0;
    $("#team").innerHTML = team.map((m) => {
      const initials = m.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
      return `
        <figure class="member">
          ${m.photoSrc ? `<img src="${esc(m.photoSrc)}" alt="Foto de ${esc(m.name)}" loading="lazy" />` : `<span class="member__initials" aria-hidden="true">${esc(initials)}</span>`}
          <figcaption><strong>${esc(m.name)}</strong>${m.role ? `<span>${esc(m.role)}</span>` : ""}${m.creci ? `<small>CRECI ${esc(m.creci)}</small>` : ""}</figcaption>
        </figure>`;
    }).join("");

    const reviews = (s.testimonials || []).filter((t) => t.name && t.text);
    $("#reviews").hidden = reviews.length === 0 && !s.googleReviewsUrl;
    $("#reviewsList").innerHTML = reviews.map((t) => `
      <blockquote class="review">
        <div class="review__stars" aria-label="5 estrelas">${icon("star").repeat(5)}</div>
        <p>${esc(t.text)}</p>
        <footer>${esc(t.name)}${t.detail ? ` · <span>${esc(t.detail)}</span>` : ""}</footer>
      </blockquote>`).join("");
    const g = $("#googleReviews");
    g.hidden = !s.googleReviewsUrl;
    if (s.googleReviewsUrl) g.href = s.googleReviewsUrl;
  }

  // ---------- Favoritos ----------
  function toggleFav(id) {
    const on = favorites.toggle(id);
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
    const n = PROPERTIES.filter((p) => favorites.has(p.id)).length;
    $("#favCount").hidden = n === 0;
    $("#favCount").textContent = n;
    $("#openFavs use").setAttribute("href", n ? "#i-heart" : "#i-heart-o");
  }

  function renderFavs() {
    const items = PROPERTIES.filter((p) => favorites.has(p.id));
    $("#favList").innerHTML = items.length
      ? items.map((p) => `
        <div class="fav-item" data-open="${esc(p.id)}" tabindex="0">
          <img src="${esc(cover(p, true))}" alt="" loading="lazy" />
          <div><strong>${brl(p.price)}${p.mode === "alugar" ? "/mês" : ""}</strong><span>${esc(p.type)} · ${esc(p.neighborhood)} · Cód. ${esc(p.code)}</span></div>
          <button class="icon-btn" data-fav="${esc(p.id)}" aria-label="Remover dos favoritos">${icon("close")}</button>
        </div>`).join("")
      : `<p class="fav-empty">Toque no coração de um imóvel para guardá-lo aqui.</p>`;
  }

  // ---------- Janelas (detalhe, me avise, favoritos) ----------
  function openLayer(el) {
    lastFocus = document.activeElement;
    el.hidden = false;
    document.body.classList.add("no-scroll");
    ($(".modal__panel", el) || $(".icon-btn", el))?.focus();
  }

  function closeLayer(el) {
    if (el.hidden) return;
    el.hidden = true;
    $$("video", el).forEach((v) => v.pause());
    if (el.id === "modal") $("#modalContent").innerHTML = "";
    if ($$(".modal:not([hidden]), .drawer:not([hidden])").length === 0) document.body.classList.remove("no-scroll");
    lastFocus?.focus?.();
  }

  function openDetail(id) {
    const p = findProp(id);
    if (!p) return;
    const box = $("#modalContent");
    box.innerHTML = Site.detailHTML(p, { inModal: true });
    box.scrollTop = 0;
    openLayer($("#modal"));
    Site.mountDetail(box, p);
  }

  // ---------- "Me avise quando aparecer" ----------
  function setupAlertForm() {
    const form = $("#alertForm");
    $("#alertConsent").innerHTML = Site.consentHTML("aConsent");
    const syncPrice = () => {
      const rent = form.querySelector('input[name="aMode"]:checked').value === "alugar";
      $("#aPriceLbl").textContent = rent ? "Até quanto por mês" : "Até quanto (valor do imóvel)";
    };
    form.addEventListener("change", (e) => { if (e.target.name === "aMode") syncPrice(); });
    $("#aPrice").addEventListener("input", (e) => { const d = digits(e.target.value); e.target.value = d ? brl(+d) : ""; });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = $("#aName").value.trim(), phone = $("#aPhone").value.trim();
      if (!name || digits(phone).length < 10) { toast("Preencha seu nome e WhatsApp com DDD."); return; }
      if (!$("#aConsent").checked) { toast("Marque que concorda com a Política de Privacidade."); return; }
      const criteria = {
        mode: form.querySelector('input[name="aMode"]:checked').value,
        type: $("#aType").value || null,
        neighborhood: $("#aHood").value || null,
        beds: Number($("#aBeds").value) || 0,
        priceMax: Number(digits($("#aPrice").value)) || 0,
      };
      const desc = [criteria.type || "Imóvel", criteria.mode === "alugar" ? "para alugar" : "para comprar",
        criteria.neighborhood && `no bairro ${criteria.neighborhood}`, criteria.beds && `${criteria.beds}+ quartos`,
        criteria.priceMax && `até ${brl(criteria.priceMax)}`].filter(Boolean).join(", ");
      Site.submitLead(form, { kind: "alerta", name, phone, criteria, message: desc, consent: true },
        `Olá! Estou procurando: ${desc}. Pode me avisar quando aparecer?`);
    });
    syncPrice();
  }

  function openAlert() {
    // pré-preenche com o que a pessoa estava buscando
    const form = $("#alertForm");
    if (form) {
      const radio = form.querySelector(`input[name="aMode"][value="${state.mode}"]`);
      if (radio) { radio.checked = true; radio.dispatchEvent(new Event("change", { bubbles: true })); }
      $("#aType").value = state.type;
      $("#aHood").value = state.hood;
      $("#aBeds").value = String(Math.min(state.beds, 3));
      if (state.priceMax) $("#aPrice").value = brl(state.priceMax);
    }
    openLayer($("#alertModal"));
  }

  // ---------- Formulário do proprietário ----------
  function setupOwnerForm() {
    $("#ownerConsent").innerHTML = Site.consentHTML("oConsent");
    const form = $("#ownerForm");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = $("#oName").value.trim(), phone = $("#oPhone").value.trim();
      if (!name || digits(phone).length < 10) { toast("Preencha seu nome e WhatsApp com DDD."); return; }
      if (!$("#oConsent").checked) { toast("Marque que concorda com a Política de Privacidade."); return; }
      const goal = form.querySelector('input[name="ownerMode"]:checked').value;
      const message = [`Quer ${goal} o imóvel.`, $("#oProp").value.trim(), $("#oMsg").value.trim()].filter(Boolean).join(" ");
      Site.submitLead(form, { kind: "anunciar", name, phone, message, consent: true },
        `Olá! Quero ${goal} meu imóvel: ${$("#oProp").value.trim() || "gostaria de uma avaliação"}.`);
    });
  }

  // ---------- Setup ----------
  function buildStaticUI() {
    $("#fParking").innerHTML = [0, 1, 2].map((v) => `<button type="button" data-value="${v}">${v ? `${v}+` : "Tanto faz"}</button>`).join("");
    $("#year").textContent = new Date().getFullYear();
    fillPriceSelect();
  }

  // Bairros, tipos e diferenciais vêm dos imóveis cadastrados
  function buildDataUI() {
    const opts = (arr) => arr.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
    const hoodList = uniqSorted(PROPERTIES.map((p) => p.neighborhood));
    const typeList = uniqSorted(PROPERTIES.map((p) => p.type));
    $("#heroHood").innerHTML = `<option value="">Todos os bairros</option>${opts(hoodList)}`;
    $("#fHood").innerHTML = `<option value="">Bairro</option>${opts(hoodList)}`;
    $("#heroType").innerHTML = `<option value="">Todos os tipos</option>${opts(typeList)}`;
    $("#fType").innerHTML = `<option value="">Tipo</option>${opts(typeList)}`;
    const allHoods = uniqSorted([...(typeof NEIGHBORHOODS !== "undefined" ? NEIGHBORHOODS : []), ...hoodList]);
    const allTypes = uniqSorted([...(typeof PROPERTY_TYPES !== "undefined" ? PROPERTY_TYPES : []), ...typeList]);
    $("#aHood").innerHTML = `<option value="">Tanto faz</option>${opts(allHoods)}`;
    $("#aType").innerHTML = `<option value="">Tanto faz</option>${opts(allTypes)}`;
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
      state.text = "";
      render();
      scrollToResults();
    });
    $("#heroCodeBtn").addEventListener("click", () => { scrollToResults(); setTimeout(() => $("#fText").focus(), 400); });

    let textTimer;
    $("#fText").addEventListener("input", (e) => { clearTimeout(textTimer); textTimer = setTimeout(() => { state.text = e.target.value.trim(); render(); }, 200); });
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
    $("#openFavs").addEventListener("click", () => { renderFavs(); openLayer($("#favDrawer")); });

    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-open-alert]")) { openAlert(); return; }
      const fav = e.target.closest("[data-fav]");
      if (fav) { toggleFav(fav.dataset.fav); return; }
      const card = e.target.closest(".card[data-id], [data-open]");
      if (card) {
        if (!$("#favDrawer").hidden) closeLayer($("#favDrawer"));
        openDetail(card.dataset.id || card.dataset.open);
        return;
      }
      const closer = e.target.closest("[data-close]");
      if (closer) closeLayer(closer.closest(".modal, .drawer"));
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.matches(".card[data-id], [data-open]")) e.target.click();
      if (e.key === "Escape") {
        const open = $$(".modal:not([hidden]), .drawer:not([hidden])").pop();
        if (open) closeLayer(open);
      }
      const box = $("#modalContent");
      if (!$("#modal").hidden && box.galleryStep && !e.target.matches("input, textarea, video")) {
        if (e.key === "ArrowRight") box.galleryStep(1);
        if (e.key === "ArrowLeft") box.galleryStep(-1);
      }
    });
  }

  async function load() {
    $("#resultsCount").textContent = "Carregando imóveis…";
    // cards provisórios no formato dos reais, para a página não parecer vazia
    $("#grid").innerHTML = '<div class="card card--skeleton" aria-hidden="true"><div class="card__media"></div><div class="card__body"><i></i><i></i><i></i></div></div>'.repeat(3);
    Site.loadSettings().then(renderAbout);
    try {
      PROPERTIES = await Store.listPublic();
    } catch (err) {
      console.error(err);
      $("#resultsCount").textContent = "Não foi possível carregar os imóveis agora. Atualize a página em instantes.";
      return;
    }
    loaded = true;
    buildDataUI();
    renderFeatured();
    updateFavCount();
    render();
  }

  buildStaticUI();
  bindEvents();
  setupAlertForm();
  setupOwnerForm();
  load();
})();
