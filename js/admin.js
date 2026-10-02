(() => {
  "use strict";

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const brl = (n) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const icon = (id) => `<svg aria-hidden="true"><use href="#i-${id}"/></svg>`;
  const digits = (s) => String(s || "").replace(/\D/g, "");
  const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const propUrl = (p) => (["localhost", "127.0.0.1"].includes(location.hostname) ? `${location.origin}/imovel.html?cod=${p.code}` : `${location.origin}/imovel/${p.code}`);
  /** Link de WhatsApp para falar com um cliente (acrescenta 55 se faltar). */
  const waTo = (phone, text) => {
    let d = digits(phone);
    if (d.length === 10 || d.length === 11) d = `55${d}`;
    return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
  };

  const STATUS = {
    disponivel: "Disponível",
    reservado: "Reservado",
    alugado: "Alugado",
    vendido: "Vendido",
    oculto: "Oculto (fora do site)",
  };
  const STATUS_BY_MODE = {
    comprar: ["disponivel", "reservado", "vendido", "oculto"],
    alugar: ["disponivel", "reservado", "alugado", "oculto"],
  };
  const TABS = [
    { key: "", label: "Todos" },
    { key: "disponivel", label: "Disponíveis" },
    { key: "reservado", label: "Reservados" },
    { key: "alugado", label: "Alugados" },
    { key: "vendido", label: "Vendidos" },
    { key: "oculto", label: "Ocultos" },
  ];

  let items = [];
  let user = null;
  const view = { status: "", q: "", mode: "" };
  const isAdmin = () => user?.role === "admin";

  // ---------- Toast (com ação opcional) e confirmação ----------
  let toastTimer;
  function toast(text, ms = 2800, action) {
    const t = $("#toast");
    $("#toastText").textContent = text;
    const btn = $("#toastAction");
    btn.hidden = !action;
    if (action) { btn.textContent = action.label; btn.onclick = () => { t.classList.remove("is-visible"); action.onClick(); }; }
    t.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("is-visible"), action ? Math.max(ms, 7000) : ms);
  }

  function confirmBox(text, yesLabel = "Confirmar") {
    return new Promise((resolve) => {
      const box = $("#confirm");
      $("#confirmText").textContent = text;
      $("#confirmYes").textContent = yesLabel;
      box.hidden = false;
      $("#confirmNo").focus();
      const done = (val) => {
        box.hidden = true;
        $("#confirmYes").onclick = $("#confirmNo").onclick = null;
        document.removeEventListener("keydown", onKey, true);
        resolve(val);
      };
      const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); done(false); } };
      document.addEventListener("keydown", onKey, true);
      $("#confirmYes").onclick = () => done(true);
      $("#confirmNo").onclick = () => done(false);
    });
  }

  // Contexto compartilhado com os módulos (clientes, locações, documentos, site, arte)
  const ui = {
    $, $$, brl, esc, icon, digits, norm, plural, toast, confirmBox, waTo, propUrl, STATUS,
    get items() { return items; },
    get user() { return user; },
    isAdmin,
    setView: (name, arg) => setView(name, arg),
  };
  window.AdminUI = ui;

  // ---------- Login ----------
  async function boot() {
    $("#demoNote").hidden = Store.isLive;
    $("#demoBanner").hidden = Store.isLive;
    $("#maxVideo").textContent = Store.MAX_VIDEO_MB;
    const u = await Store.auth.user();
    u ? showApp(u) : showLogin();
  }

  function showLogin() {
    $("#appView").hidden = true;
    $("#loginView").hidden = false;
    $("#loginEmail").focus();
  }

  async function showApp(u) {
    user = u;
    $("#loginView").hidden = true;
    $("#appView").hidden = false;
    $("#userEmail").textContent = `${u.email} · ${u.role === "admin" ? "dono" : "corretor"}`;
    $$("[data-admin-only]").forEach((el) => (el.hidden = !isAdmin()));
    setView("imoveis");
    await refresh();
    Leads.refresh();
    Rentals.refresh();
  }

  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("#loginEmail").value.trim();
    const pass = $("#loginPass").value;
    const err = $("#loginError");
    if (!email || !pass) { err.textContent = "Preencha e-mail e senha."; err.hidden = false; return; }
    $("#loginBtn").disabled = true;
    $("#loginBtn").textContent = "Entrando…";
    try {
      const u = await Store.auth.signIn(email, pass);
      err.hidden = true;
      $("#loginPass").value = "";
      await showApp(u);
    } catch (ex) {
      err.textContent = ex.message || "Não foi possível entrar. Tente de novo.";
      err.hidden = false;
    } finally {
      $("#loginBtn").disabled = false;
      $("#loginBtn").textContent = "Entrar";
    }
  });

  $("#fillDemo").addEventListener("click", () => {
    const u = Store.DEMO_USERS[0];
    $("#loginEmail").value = u.email;
    $("#loginPass").value = u.password;
    $("#loginBtn").focus();
  });

  $("#logoutBtn").addEventListener("click", async () => {
    Docs.clearAll();
    await Store.auth.signOut();
    items = [];
    user = null;
    showLogin();
  });

  // ---------- Abas ----------
  const VIEWS = { imoveis: "#viewImoveis", clientes: "#viewClientes", locacoes: "#viewLocacoes", docs: "#viewDocs", site: "#viewSite" };
  function setView(name, arg) {
    if (name === "site" && !isAdmin()) name = "imoveis";
    Object.entries(VIEWS).forEach(([k, sel]) => ($(sel).hidden = k !== name));
    $$("[data-view]").forEach((b) => {
      const on = b.dataset.view === name;
      b.classList.toggle("is-active", on);
      if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    if (name === "clientes") Leads.show(arg);
    if (name === "locacoes") Rentals.show(arg);
    if (name === "docs") Docs.open(arg);
    if (name === "site") SiteSettings.show();
    window.scrollTo(0, 0);
  }
  $$("[data-view]").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));

  // ---------- Lista de imóveis ----------
  async function refresh() {
    $("#feed").innerHTML = `<p class="muted">Carregando…</p>`;
    try {
      items = await Store.listAll();
    } catch (ex) {
      console.error(ex);
      $("#feed").innerHTML = `<p class="form-error">Não foi possível carregar os imóveis. Verifique a internet e atualize a página.</p>`;
      return;
    }
    renderFeed();
  }

  function renderTabs() {
    const count = (k) => (k ? items.filter((p) => p.status === k).length : items.length);
    $("#statusTabs").innerHTML = TABS.map((t) => `
      <button type="button" role="tab" class="status-tab ${view.status === t.key ? "is-active" : ""}" aria-selected="${view.status === t.key}" data-tab="${t.key}">
        ${t.label} <b>${count(t.key)}</b>
      </button>`).join("");
    const live = items.filter((p) => Store.PUBLIC_STATUS.includes(p.status));
    const views = live.reduce((s, p) => s + (p.views || 0), 0);
    $("#summary").textContent = `${plural(live.length, "imóvel aparecendo", "imóveis aparecendo")} no site · ${plural(items.length, "cadastrado", "cadastrados")} · ${views.toLocaleString("pt-BR")} visualizações`;
  }

  function visibleItems() {
    const q = norm(view.q);
    return items.filter((p) =>
      (!view.status || p.status === view.status) &&
      (!view.mode || p.mode === view.mode) &&
      (!q || norm(`${p.code} ${p.type} ${p.neighborhood} ${p.street}`).includes(q)));
  }

  function rowHTML(p) {
    const img = p.media.find((m) => m.type === "image");
    const photos = p.media.filter((m) => m.type === "image").length;
    const videos = p.media.filter((m) => m.type === "video").length;
    const extras = [photos && plural(photos, "foto", "fotos"), videos && plural(videos, "vídeo", "vídeos")].filter(Boolean).join(" · ") || "Sem fotos";
    const faded = ["alugado", "vendido", "oculto"].includes(p.status);
    const isPublic = Store.PUBLIC_STATUS.includes(p.status);
    const options = STATUS_BY_MODE[p.mode].map((s) => `<option value="${s}" ${s === p.status ? "selected" : ""}>${STATUS[s]}</option>`).join("");
    const drop = Number(p.old_price) > Number(p.price);
    return `
      <article class="row ${faded ? "is-faded" : ""}" data-id="${esc(p.id)}">
        ${img ? `<img class="row__thumb" src="${esc(img.src)}" alt="" data-edit loading="lazy" />` : `<div class="row__thumb" data-edit>${icon("image")}</div>`}
        <div class="row__info" data-edit>
          <div class="row__meta">
            <span class="mode-tag">${p.mode === "alugar" ? "Aluguel" : "Venda"}</span><span>Cód. ${esc(p.code)}</span>
            ${p.featured ? `<span class="feat-tag">${icon("star")} Destaque</span>` : ""}
          </div>
          <span class="row__title">${esc(p.type)} · ${esc(p.neighborhood)}</span>
          <span class="row__sub">${p.street ? `${esc(p.street)} · ` : ""}${extras} · ${icon("eye")} ${(p.views || 0).toLocaleString("pt-BR")}</span>
        </div>
        <div class="row__price">${brl(p.price)}${p.mode === "alugar" ? "<small>/mês</small>" : ""}${drop ? `<span class="row__drop">baixou de ${brl(p.old_price)}</span>` : ""}</div>
        <label class="row__status"><span class="sr-only">Situação</span>
          <select class="status-select st-${p.status}" data-status>${options}</select>
        </label>
        <div class="row__actions">
          <button class="icon-btn ${p.featured ? "is-on" : ""}" data-feat aria-pressed="${Boolean(p.featured)}" aria-label="${p.featured ? "Tirar dos destaques" : "Colocar nos destaques"}" title="${p.featured ? "Tirar dos destaques" : "Colocar nos destaques"}">${icon(p.featured ? "star" : "star-o")}</button>
          ${isPublic ? `<button class="icon-btn" data-link aria-label="Copiar link do anúncio" title="Copiar link do anúncio">${icon("link")}</button>` : ""}
          <button class="icon-btn" data-art aria-label="Gerar arte para Instagram" title="Arte para Instagram">${icon("palette")}</button>
          ${p.mode === "alugar" ? `<button class="icon-btn" data-contract aria-label="Gerar contrato de locação" title="Gerar contrato">${icon("doc")}</button>` : ""}
          <button class="icon-btn" data-edit aria-label="Editar" title="Editar">${icon("edit")}</button>
          ${isAdmin() ? `<button class="icon-btn" data-del aria-label="Excluir" title="Excluir">${icon("trash")}</button>` : ""}
        </div>
      </article>`;
  }

  function renderFeed() {
    renderTabs();
    const list = visibleItems();
    $("#feed").innerHTML = list.map(rowHTML).join("");
    const empty = $("#feedEmpty");
    empty.hidden = list.length > 0;
    if (!list.length) {
      empty.innerHTML = items.length
        ? `<h3>Nenhum imóvel nesse filtro</h3><p class="muted">Troque a aba ou limpe a busca.</p>`
        : `<h3>Nenhum imóvel cadastrado ainda</h3><p class="muted">Cadastre o primeiro e ele aparece no site na hora.</p><button class="btn btn--primary" data-new>${icon("plus")} Cadastrar imóvel</button>`;
    }
  }

  $("#statusTabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tab]");
    if (!b) return;
    view.status = b.dataset.tab;
    renderFeed();
  });
  $("#q").addEventListener("input", (e) => { view.q = e.target.value; renderFeed(); });
  $("#modeFilter").addEventListener("change", (e) => { view.mode = e.target.value; renderFeed(); });

  $("#feed").addEventListener("change", async (e) => {
    const sel = e.target.closest("[data-status]");
    if (!sel) return;
    const p = items.find((x) => String(x.id) === sel.closest(".row").dataset.id);
    const prev = p.status;
    p.status = sel.value;
    renderFeed();
    try {
      await Store.setStatus(p.id, p.status);
      toast(`Cód. ${p.code} agora está como ${STATUS[p.status].toLowerCase()}.`);
      if (p.status === "alugado") {
        toast(`Cód. ${p.code} alugado. Quer registrar a locação para acompanhar vencimentos e reajustes?`, 7000,
          { label: "Registrar", onClick: () => { setView("locacoes"); Rentals.openNew({ property: p }); } });
      }
    } catch (ex) {
      console.error(ex);
      p.status = prev;
      renderFeed();
      toast("Não foi possível mudar a situação. Tente de novo.");
    }
  });

  document.addEventListener("click", async (e) => {
    if (e.target.closest("[data-new]") || e.target.closest("#newBtn")) { openEditor(null); return; }
    const row = e.target.closest("#feed .row");
    if (!row) return;
    const p = items.find((x) => String(x.id) === row.dataset.id);
    if (e.target.closest("[data-del]")) { await deleteProp(p); return; }
    if (e.target.closest("[data-contract]")) { setView("docs", p); return; }
    if (e.target.closest("[data-art]")) { Art.open(p); return; }
    if (e.target.closest("[data-link]")) {
      const url = propUrl(p);
      try { await navigator.clipboard.writeText(url); toast("Link do anúncio copiado. Cole no WhatsApp ou Instagram."); }
      catch { prompt("Copie o link do anúncio:", url); }
      return;
    }
    if (e.target.closest("[data-feat]")) {
      const on = !p.featured;
      p.featured = on;
      renderFeed();
      try {
        await Store.patchProperty(p.id, { featured: on });
        toast(on ? `Cód. ${p.code} entrou nos destaques da página inicial.` : `Cód. ${p.code} saiu dos destaques.`);
      } catch (ex) { console.error(ex); p.featured = !on; renderFeed(); toast("Não foi possível alterar o destaque."); }
      return;
    }
    if (e.target.closest("[data-edit]")) openEditor(p);
  });

  async function deleteProp(p) {
    if (!isAdmin()) { toast("Só o dono pode excluir imóveis. Você pode marcar como Oculto."); return false; }
    const ok = await confirmBox(`Excluir o imóvel cód. ${p.code} (${p.type} · ${p.neighborhood})? As fotos e vídeos também serão apagados. Isso não pode ser desfeito.`, "Excluir");
    if (!ok) return false;
    try {
      await Store.remove(p);
      items = items.filter((x) => x.id !== p.id);
      renderFeed();
      toast(`Imóvel cód. ${p.code} excluído.`);
      return true;
    } catch (ex) {
      console.error(ex);
      toast("Não foi possível excluir. Tente de novo.");
      return false;
    }
  }

  // ---------- Editor de imóvel ----------
  const ed = { prop: null, media: [], removed: [], dirty: false, saving: false };

  function fillStaticEditor() {
    $("#eType").innerHTML = PROPERTY_TYPES.map((t) => `<option>${esc(t)}</option>`).join("");
  }

  function amenityOptions(selected) {
    const all = [...new Set([...AMENITIES, ...items.flatMap((p) => p.amenities || []), ...selected])];
    $("#eAmenities").innerHTML = all.map((a) => `
      <label><input type="checkbox" value="${esc(a)}" ${selected.includes(a) ? "checked" : ""} /><span>${esc(a)}</span></label>`).join("");
  }

  function setStatusOptions(mode, current) {
    const list = STATUS_BY_MODE[mode];
    const val = list.includes(current) ? current : "disponivel";
    $("#eStatus").innerHTML = list.map((s) => `<option value="${s}" ${s === val ? "selected" : ""}>${STATUS[s]}</option>`).join("");
    $("#ePriceLabel").textContent = mode === "alugar" ? "Aluguel por mês *" : "Preço de venda *";
  }

  const moneyIn = (el, v) => { el.value = Number(v) ? brl(v) : ""; };
  const moneyOut = (el) => Number(digits(el.value)) || 0;

  function openEditor(p) {
    ed.prop = p;
    ed.removed = [];
    ed.dirty = false;
    ed.media.forEach((m) => m.file && URL.revokeObjectURL(m.src));
    ed.media = p ? p.media.map((m) => ({ ...m })) : [];
    const d = p || { mode: "comprar", status: "disponivel", type: PROPERTY_TYPES[0], amenities: [] };

    $("#editorTitle").textContent = p ? `Editar imóvel · Cód. ${p.code}` : "Novo imóvel";
    $$('input[name="mode"]').forEach((r) => (r.checked = r.value === d.mode));
    setStatusOptions(d.mode, d.status);
    $("#eFeatured").checked = Boolean(d.featured);
    $("#eType").value = d.type;
    if ($("#eType").value !== d.type) { $("#eType").insertAdjacentHTML("beforeend", `<option>${esc(d.type)}</option>`); $("#eType").value = d.type; }
    $("#eHood").value = d.neighborhood || "";
    $("#eStreet").value = d.street || "";
    moneyIn($("#ePrice"), d.price);
    moneyIn($("#eCondo"), d.condo);
    moneyIn($("#eIptu"), d.iptu);
    ["Area", "Beds", "Baths", "Parking"].forEach((k) => { $(`#e${k}`).value = p ? (d[k.toLowerCase()] ?? 0) : ""; });
    $("#eDesc").value = d.description || "";
    $("#eAmenityNew").value = "";
    amenityOptions(d.amenities || []);
    const hoods = [...new Set([...NEIGHBORHOODS, ...items.map((x) => x.neighborhood)])].sort((a, b) => a.localeCompare(b, "pt-BR"));
    $("#hoodList").innerHTML = hoods.map((h) => `<option value="${esc(h)}">`).join("");
    $$(".is-invalid", $("#editForm")).forEach((el) => el.classList.remove("is-invalid"));
    $("#deleteBtn").hidden = !p || !isAdmin();
    $("#progress").hidden = true;
    $("#priceHint").textContent = p && Number(p.old_price) > Number(p.price)
      ? `Selo "Baixou o preço" ativo (antes ${brl(p.old_price)}). Se subir o preço de novo para esse valor ou mais, o selo sai.`
      : `Se você baixar o preço, o site mostra o selo "Baixou o preço" automaticamente.`;
    renderMedia();

    $("#editor").hidden = false;
    document.body.classList.add("no-scroll");
    $("#editor .editor__body").scrollTop = 0;
    (p ? $("#eHood") : $("#dropzone")).focus?.();
  }

  async function closeEditor(force = false) {
    if (ed.saving) return;
    if (!force && ed.dirty && !(await confirmBox("Sair sem salvar? As alterações feitas serão perdidas.", "Sair sem salvar"))) return;
    $("#editor").hidden = true;
    document.body.classList.remove("no-scroll");
    $$("#mediaGrid video").forEach((v) => v.pause());
  }

  function renderMedia() {
    const n = ed.media.length;
    let coverDone = false;
    $("#mediaGrid").innerHTML = ed.media.map((m, i) => {
      const isCover = !coverDone && m.type === "image" && (coverDone = true);
      return `
        <div class="media-item">
          ${m.type === "video" ? `<video src="${esc(m.src)}" muted playsinline preload="metadata"></video>` : `<img src="${esc(m.src)}" alt="" />`}
          ${isCover ? `<span class="media-item__cover">Capa</span>` : ""}
          ${m.type === "video" ? `<span class="media-item__video">${icon("play")} Vídeo</span>` : ""}
          ${m.file ? `<span class="media-item__new">Novo</span>` : ""}
          <div class="media-item__tools">
            <button type="button" data-mmove="-1" data-i="${i}" ${i === 0 ? "disabled" : ""} aria-label="Mover para a esquerda">${icon("left")}</button>
            <button type="button" data-mmove="1" data-i="${i}" ${i === n - 1 ? "disabled" : ""} aria-label="Mover para a direita">${icon("right")}</button>
            <button type="button" data-mrm data-i="${i}" aria-label="Remover">${icon("close")}</button>
          </div>
        </div>`;
    }).join("");
  }

  function addFiles(fileList) {
    const files = [...fileList].filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
    const skipped = fileList.length - files.length;
    for (const f of files) {
      const type = f.type.startsWith("video/") ? "video" : "image";
      if (type === "video" && f.size > Store.MAX_VIDEO_MB * 1024 * 1024) {
        toast(`O vídeo "${f.name}" passa de ${Store.MAX_VIDEO_MB} MB e não foi adicionado.`, 4000);
        continue;
      }
      ed.media.push({ type, file: f, src: URL.createObjectURL(f) });
    }
    if (skipped) toast("Alguns arquivos foram ignorados: envie só fotos ou vídeos.");
    ed.dirty = true;
    renderMedia();
  }

  $("#fileInput").addEventListener("change", (e) => { addFiles(e.target.files); e.target.value = ""; });
  const dz = $("#dropzone");
  ["dragenter", "dragover"].forEach((t) => dz.addEventListener(t, (e) => { e.preventDefault(); dz.classList.add("is-over"); }));
  ["dragleave", "drop"].forEach((t) => dz.addEventListener(t, (e) => { e.preventDefault(); dz.classList.remove("is-over"); }));
  dz.addEventListener("drop", (e) => addFiles(e.dataTransfer.files));

  $("#mediaGrid").addEventListener("click", (e) => {
    const mv = e.target.closest("[data-mmove]");
    const rm = e.target.closest("[data-mrm]");
    if (mv) {
      const i = +mv.dataset.i, j = i + +mv.dataset.mmove;
      [ed.media[i], ed.media[j]] = [ed.media[j], ed.media[i]];
    } else if (rm) {
      const [m] = ed.media.splice(+rm.dataset.i, 1);
      if (m.file) URL.revokeObjectURL(m.src);
      else if (m.path) ed.removed.push(m.path);
    } else return;
    ed.dirty = true;
    renderMedia();
  });

  // Máscaras de dinheiro e telefone (todas as telas do painel)
  document.addEventListener("input", (e) => {
    if (e.target.matches?.("[data-money]")) { const d = digits(e.target.value); e.target.value = d ? brl(+d) : ""; }
    if (e.target.dataset?.mask === "phone") {
      const d = digits(e.target.value).slice(0, 11);
      let out = d;
      if (d.length > 2) out = `(${d.slice(0, 2)}) ${d.slice(2)}`;
      if (d.length > 7) out = `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
      e.target.value = out;
    }
  });

  $("#editForm").addEventListener("input", (e) => { ed.dirty = true; e.target.classList?.remove("is-invalid"); });
  $("#editForm").addEventListener("change", (e) => {
    ed.dirty = true;
    if (e.target.name === "mode") setStatusOptions(e.target.value, $("#eStatus").value);
  });

  $("#addAmenity").addEventListener("click", () => {
    const v = $("#eAmenityNew").value.trim();
    if (!v) return;
    const checked = $$("#eAmenities input:checked").map((i) => i.value);
    amenityOptions([...new Set([...checked, v])]);
    $("#eAmenityNew").value = "";
    ed.dirty = true;
  });
  $("#eAmenityNew").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); $("#addAmenity").click(); } });

  $$("[data-editor-close]").forEach((b) => b.addEventListener("click", () => closeEditor()));
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !$("#confirm").hidden) return;
    if (!$("#editor").hidden) closeEditor();
  });

  $("#deleteBtn").addEventListener("click", async () => {
    if (await deleteProp(ed.prop)) closeEditor(true);
  });

  /** Selo "Baixou o preço": guarda o preço anterior quando o novo é menor. */
  function computeOldPrice(prev, newPrice) {
    if (!prev) return null;
    const before = Number(prev.price), old = Number(prev.old_price) || 0;
    if (newPrice < before) return Math.max(before, old);
    if (old && newPrice < old) return old;
    return null;
  }

  $("#editForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (ed.saving) return;
    const mode = $('input[name="mode"]:checked').value;
    const price = moneyOut($("#ePrice"));
    const data = {
      id: ed.prop?.id,
      mode,
      status: $("#eStatus").value,
      featured: $("#eFeatured").checked,
      type: $("#eType").value,
      neighborhood: $("#eHood").value.trim(),
      street: $("#eStreet").value.trim(),
      price,
      old_price: ed.prop && ed.prop.mode === mode ? computeOldPrice(ed.prop, price) : null,
      condo: moneyOut($("#eCondo")),
      iptu: moneyOut($("#eIptu")),
      area: Number($("#eArea").value) || 0,
      beds: Number($("#eBeds").value) || 0,
      baths: Number($("#eBaths").value) || 0,
      parking: Number($("#eParking").value) || 0,
      amenities: $$("#eAmenities input:checked").map((i) => i.value),
      description: $("#eDesc").value.trim(),
    };

    const missing = [];
    if (!data.neighborhood) missing.push($("#eHood"));
    if (!data.price) missing.push($("#ePrice"));
    if (missing.length) {
      missing.forEach((el) => el.classList.add("is-invalid"));
      missing[0].focus();
      toast("Preencha os campos marcados.");
      return;
    }
    if (!ed.media.some((m) => m.type === "image") && data.status !== "oculto") {
      const go = await confirmBox("Este imóvel está sem fotos. Anúncios sem foto recebem bem menos visitas. Salvar mesmo assim?", "Salvar sem fotos");
      if (!go) return;
    }

    ed.saving = true;
    $("#saveBtn").disabled = true;
    $("#saveBtn").textContent = "Salvando…";
    const prog = $("#progress");
    try {
      const saved = await Store.save(data, ed.media, ed.removed, (done, total) => {
        prog.hidden = !total;
        prog.textContent = `Enviando arquivos: ${done} de ${total}`;
      });
      ed.media.forEach((m) => m.file && URL.revokeObjectURL(m.src));
      const i = items.findIndex((x) => x.id === saved.id);
      if (i >= 0) items[i] = saved; else items.unshift(saved);
      ed.saving = false;
      closeEditor(true);
      renderFeed();
      const msg = data.id ? `Imóvel cód. ${saved.code} atualizado.` : `Imóvel cód. ${saved.code} cadastrado${Store.PUBLIC_STATUS.includes(saved.status) ? " e já aparece no site" : ""}.`;
      const waiting = Leads.matchesFor(saved);
      if (waiting.length) {
        toast(`${msg} ${plural(waiting.length, "cliente pediu", "clientes pediram")} para ser avisado de um imóvel assim.`, 9000,
          { label: "Ver clientes", onClick: () => setView("clientes", { matchFor: saved }) });
      } else {
        toast(msg, 3500);
      }
    } catch (ex) {
      console.error(ex);
      toast(ex.message && !/fetch|network/i.test(ex.message) ? ex.message : "Não foi possível salvar. Verifique a internet e tente de novo.", 4500);
    } finally {
      ed.saving = false;
      $("#saveBtn").disabled = false;
      $("#saveBtn").textContent = "Salvar imóvel";
      prog.hidden = true;
    }
  });

  // ---------- Início ----------
  Leads.init(ui);
  Rentals.init(ui);
  Docs.init(ui);
  SiteSettings.init(ui);
  Art.init(ui);
  fillStaticEditor();
  boot();
})();
