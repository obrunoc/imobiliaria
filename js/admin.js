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
  const view = { status: "", q: "", mode: "" };

  // ---------- Toast e confirmação ----------
  let toastTimer;
  function toast(text, ms = 2600) {
    const t = $("#toast");
    t.textContent = text;
    t.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("is-visible"), ms);
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

  // ---------- Login ----------
  async function boot() {
    $("#demoNote").hidden = Store.isLive;
    $("#demoBanner").hidden = Store.isLive;
    $("#maxVideo").textContent = Store.MAX_VIDEO_MB;
    const user = await Store.auth.user();
    user ? showApp(user) : showLogin();
  }

  function showLogin() {
    $("#appView").hidden = true;
    $("#loginView").hidden = false;
    $("#loginEmail").focus();
  }

  async function showApp(user) {
    $("#loginView").hidden = true;
    $("#appView").hidden = false;
    $("#userEmail").textContent = user.email;
    await refresh();
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
      const user = await Store.auth.signIn(email, pass);
      err.hidden = true;
      $("#loginPass").value = "";
      await showApp(user);
    } catch (ex) {
      err.textContent = ex.message || "Não foi possível entrar. Tente de novo.";
      err.hidden = false;
    } finally {
      $("#loginBtn").disabled = false;
      $("#loginBtn").textContent = "Entrar";
    }
  });

  $("#fillDemo").addEventListener("click", () => {
    $("#loginEmail").value = Store.DEMO_USER.email;
    $("#loginPass").value = Store.DEMO_USER.password;
    $("#loginBtn").focus();
  });

  $("#logoutBtn").addEventListener("click", async () => {
    Contracts.clear();
    setView("imoveis");
    await Store.auth.signOut();
    items = [];
    showLogin();
  });

  // ---------- Lista ----------
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
    const live = items.filter((p) => p.status === "disponivel" || p.status === "reservado").length;
    $("#summary").textContent = `${plural(live, "imóvel aparecendo", "imóveis aparecendo")} no site · ${plural(items.length, "cadastrado", "cadastrados")} no total`;
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
    const options = STATUS_BY_MODE[p.mode].map((s) => `<option value="${s}" ${s === p.status ? "selected" : ""}>${STATUS[s]}</option>`).join("");
    return `
      <article class="row ${faded ? "is-faded" : ""}" data-id="${esc(p.id)}">
        ${img ? `<img class="row__thumb" src="${esc(img.src)}" alt="" data-edit loading="lazy" />` : `<div class="row__thumb" data-edit>${icon("image")}</div>`}
        <div class="row__info" data-edit>
          <div class="row__meta"><span class="mode-tag">${p.mode === "alugar" ? "Aluguel" : "Venda"}</span><span>Cód. ${esc(p.code)}</span></div>
          <span class="row__title">${esc(p.type)} · ${esc(p.neighborhood)}</span>
          <span class="row__sub">${p.street ? `${esc(p.street)} · ` : ""}${extras}</span>
        </div>
        <div class="row__price">${brl(p.price)}${p.mode === "alugar" ? "<small>/mês</small>" : ""}</div>
        <label class="row__status"><span class="sr-only">Situação</span>
          <select class="status-select st-${p.status}" data-status>${options}</select>
        </label>
        <div class="row__actions">
          ${p.mode === "alugar" ? `<button class="icon-btn" data-contract aria-label="Gerar contrato de locação" title="Gerar contrato">${icon("doc")}</button>` : ""}
          <button class="icon-btn" data-edit aria-label="Editar" title="Editar">${icon("edit")}</button>
          <button class="icon-btn" data-del aria-label="Excluir" title="Excluir">${icon("trash")}</button>
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
    } catch (ex) {
      console.error(ex);
      p.status = prev;
      renderFeed();
      toast("Não foi possível mudar a situação. Tente de novo.");
    }
  });

  document.addEventListener("click", async (e) => {
    if (e.target.closest("[data-new]") || e.target.closest("#newBtn")) { openEditor(null); return; }
    const row = e.target.closest(".row");
    if (!row) return;
    const p = items.find((x) => String(x.id) === row.dataset.id);
    if (e.target.closest("[data-del]")) { await deleteProp(p); return; }
    if (e.target.closest("[data-contract]")) { setView("contratos", p); return; }
    if (e.target.closest("[data-edit]")) openEditor(p);
  });

  async function deleteProp(p) {
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

  // ---------- Editor ----------
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
    $("#deleteBtn").hidden = !p;
    $("#progress").hidden = true;
    renderMedia();

    $("#editor").hidden = false;
    document.body.classList.add("no-scroll");
    $(".editor__body").scrollTop = 0;
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

  $("#editForm").addEventListener("input", (e) => {
    ed.dirty = true;
    e.target.classList?.remove("is-invalid");
    if (e.target.matches("[data-money]")) {
      const d = digits(e.target.value);
      e.target.value = d ? brl(+d) : "";
    }
  });
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
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#editor").hidden && $("#confirm").hidden) closeEditor(); });

  $("#deleteBtn").addEventListener("click", async () => {
    if (await deleteProp(ed.prop)) closeEditor(true);
  });

  $("#editForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (ed.saving) return;
    const mode = $('input[name="mode"]:checked').value;
    const data = {
      id: ed.prop?.id,
      mode,
      status: $("#eStatus").value,
      type: $("#eType").value,
      neighborhood: $("#eHood").value.trim(),
      street: $("#eStreet").value.trim(),
      price: moneyOut($("#ePrice")),
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
      toast(data.id ? `Imóvel cód. ${saved.code} atualizado.` : `Imóvel cód. ${saved.code} cadastrado${["disponivel", "reservado"].includes(saved.status) ? " e já aparece no site" : ""}.`, 3500);
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

  // ---------- Abas do painel ----------
  function setView(name, prop) {
    $("#viewImoveis").hidden = name !== "imoveis";
    $("#viewContratos").hidden = name !== "contratos";
    $$("[data-view]").forEach((b) => {
      const on = b.dataset.view === name;
      b.classList.toggle("is-active", on);
      if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    if (name === "contratos") Contracts.open(prop);
    window.scrollTo(0, 0);
  }
  $$("[data-view]").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));

  Contracts.init({ getRentals: () => items.filter((p) => p.mode === "alugar"), toast, confirmBox });
  fillStaticEditor();
  boot();
})();
