/* Painel → Locações: acompanha fim de contrato e reajuste anual. Guarda só dados básicos. */
window.Rentals = (() => {
  "use strict";

  let ui;
  let rentals = [];
  let editing = null;
  let tab = "ativa";
  const DAY = 864e5;
  const CALC_URL = "https://www3.bcb.gov.br/CALCIDADAO/publico/exibirFormCorrecaoValores.do?method=exibirFormCorrecaoValores";

  const parse = (iso) => { const [y, m, d] = String(iso).split("-").map(Number); return y ? new Date(y, m - 1, d) : null; };
  const addMonths = (dt, n) => { const r = new Date(dt); const day = r.getDate(); r.setMonth(r.getMonth() + n); if (r.getDate() !== day) r.setDate(0); return r; };
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const fmt = (d) => d.toLocaleDateString("pt-BR");
  const daysUntil = (d) => Math.round((d - today()) / DAY);

  /** Datas importantes de uma locação. */
  function timeline(r) {
    const start = parse(r.start_date);
    if (!start) return null;
    const end = addMonths(start, Number(r.months) || 0);
    let k = 1, adj = addMonths(start, 12);
    while (adj <= today()) { k++; adj = addMonths(start, 12 * k); }
    return { start, end, nextAdjust: adj, toEnd: daysUntil(end), toAdjust: daysUntil(adj) };
  }

  function flags(r) {
    if (r.status !== "ativa") return [];
    const t = timeline(r);
    if (!t) return [];
    const out = [];
    if (t.toEnd < 0) out.push({ cls: "late", text: `Prazo terminou em ${fmt(t.end)}` });
    else if (t.toEnd <= 60) out.push({ cls: "warn", text: `Contrato termina em ${t.toEnd} dia${t.toEnd === 1 ? "" : "s"}` });
    if (t.toAdjust <= 30) out.push({ cls: "warn", text: `Reajuste (${r.index_name}) em ${t.toAdjust} dia${t.toAdjust === 1 ? "" : "s"}` });
    return out;
  }

  async function refresh() {
    try { rentals = await Store.listRentals(); } catch (ex) { console.error(ex); rentals = []; }
    const n = rentals.filter((r) => flags(r).length).length;
    const b = ui.$("#rentalCount");
    b.hidden = n === 0;
    b.textContent = n;
    if (!ui.$("#viewLocacoes").hidden) render();
  }

  function render() {
    const { $, esc, brl, icon, waTo, plural } = ui;
    const active = rentals.filter((r) => r.status === "ativa");
    const ending = active.filter((r) => { const t = timeline(r); return t && t.toEnd <= 60; }).length;
    const adjusting = active.filter((r) => { const t = timeline(r); return t && t.toAdjust <= 30; }).length;
    $("#rentalAlerts").innerHTML = active.length ? `
      <span class="r-chip">${plural(active.length, "locação ativa", "locações ativas")}</span>
      ${adjusting ? `<span class="r-chip r-chip--warn">${plural(adjusting, "reajuste", "reajustes")} nos próximos 30 dias</span>` : ""}
      ${ending ? `<span class="r-chip r-chip--warn">${plural(ending, "contrato terminando", "contratos terminando")} em até 60 dias</span>` : ""}
      ${adjusting ? `<a class="link-btn" href="${CALC_URL}" target="_blank" rel="noopener">Calcular reajuste na Calculadora do Cidadão (Banco Central)</a>` : ""}` : "";

    $("#rentalTabs").innerHTML = [["ativa", "Ativas"], ["encerrada", "Encerradas"]].map(([k, t]) =>
      `<button type="button" role="tab" class="status-tab ${tab === k ? "is-active" : ""}" aria-selected="${tab === k}" data-rtab="${k}">${t} <b>${rentals.filter((r) => r.status === k).length}</b></button>`).join("");

    const list = rentals.filter((r) => r.status === tab).sort((a, b) => {
      const fa = flags(a).length, fb = flags(b).length;
      if (fa !== fb) return fb - fa;
      return (timeline(a)?.toAdjust ?? 9999) - (timeline(b)?.toAdjust ?? 9999);
    });
    $("#rentalList").innerHTML = list.length ? list.map((r) => {
      const t = timeline(r);
      const fl = flags(r);
      const first = String(r.tenant_name).split(" ")[0];
      return `
        <article class="rental" data-rental="${esc(r.id)}">
          <div class="rental__main">
            <span class="rental__label">${esc(r.property_label)}</span>
            <strong>${esc(r.tenant_name)}</strong>
            <span class="muted">${r.owner_name ? `Proprietário: ${esc(r.owner_name)} · ` : ""}${brl(r.rent)}/mês${r.due_day ? ` · vence dia ${esc(r.due_day)}` : ""}</span>
            ${fl.length ? `<div class="rental__flags">${fl.map((f) => `<span class="r-flag r-flag--${f.cls}">${esc(f.text)}</span>`).join("")}</div>` : ""}
          </div>
          <dl class="rental__dates">
            <div><dt>Início</dt><dd>${t ? fmt(t.start) : "-"}</dd></div>
            <div><dt>Término</dt><dd>${t ? fmt(t.end) : "-"}</dd></div>
            <div><dt>Próximo reajuste</dt><dd>${t && r.status === "ativa" ? `${fmt(t.nextAdjust)} · ${esc(r.index_name)}` : "-"}</dd></div>
          </dl>
          <div class="rental__actions">
            ${r.tenant_phone ? `<a class="icon-btn" target="_blank" rel="noopener" href="${esc(waTo(r.tenant_phone, `Olá, ${first}! Aqui é da VC Imóveis.`))}" aria-label="WhatsApp do inquilino" title="WhatsApp do inquilino">${icon("whats")}</a>` : ""}
            <button class="icon-btn" data-redit aria-label="Editar locação" title="Editar">${icon("edit")}</button>
          </div>
        </article>`;
    }).join("") : `<div class="feed-empty"><h3>${tab === "ativa" ? "Nenhuma locação ativa registrada" : "Nenhuma locação encerrada"}</h3>
      <p class="muted">${tab === "ativa" ? "Registre as locações para o painel avisar sobre reajustes e fim de contrato. Dica: ao marcar um imóvel como Alugado ou gerar o contrato, o painel oferece registrar." : ""}</p></div>`;
  }

  // ---------- Editor ----------
  function fillProps(selectedId) {
    const { esc, items } = ui;
    const rentalsProps = items.filter((p) => p.mode === "alugar");
    ui.$("#rProp").innerHTML = `<option value="">Outro / não cadastrado</option>` + rentalsProps.map((p) =>
      `<option value="${esc(p.id)}" ${String(p.id) === String(selectedId) ? "selected" : ""}>Cód. ${esc(p.code)} · ${esc(p.type)} · ${esc(p.neighborhood)}</option>`).join("");
  }
  const labelFor = (p) => [p.type, p.street, p.neighborhood].filter(Boolean).join(" · ");

  function openNew(pre = {}) {
    const p = pre.property;
    open({
      property_id: p?.id || "", property_label: p ? labelFor(p) : (pre.property_label || ""),
      tenant_name: pre.tenant_name || "", tenant_phone: "", owner_name: pre.owner_name || "",
      rent: pre.rent ?? (p ? p.price : 0), due_day: pre.due_day || "", index_name: pre.index_name || "IPCA",
      start_date: pre.start_date || "", months: pre.months || 30, notes: "", status: "ativa",
    }, true);
  }

  function open(r, isNew = false) {
    const { $, brl } = ui;
    editing = isNew ? null : r;
    $("#rentalTitle").textContent = isNew ? "Nova locação" : "Editar locação";
    fillProps(r.property_id);
    $("#rLabel").value = r.property_label || "";
    $("#rTenant").value = r.tenant_name || "";
    $("#rPhone").value = r.tenant_phone || "";
    $("#rOwner").value = r.owner_name || "";
    $("#rRent").value = Number(r.rent) ? brl(r.rent) : "";
    $("#rDue").value = r.due_day || "";
    $("#rStart").value = r.start_date || "";
    $("#rMonths").value = r.months || "";
    $("#rIndex").value = r.index_name || "IPCA";
    $("#rStatus").value = r.status || "ativa";
    $("#rNotes").value = r.notes || "";
    $("#rDelete").hidden = isNew;
    $$invalid().forEach((el) => el.classList.remove("is-invalid"));
    $("#rentalEditor").hidden = false;
    document.body.classList.add("no-scroll");
    $("#rTenant").focus();
  }
  const $$invalid = () => ui.$$("#rentalForm .is-invalid");

  function close() {
    ui.$("#rentalEditor").hidden = true;
    document.body.classList.remove("no-scroll");
  }

  async function save(e) {
    e.preventDefault();
    const { $, digits, toast } = ui;
    const data = {
      id: editing?.id,
      property_id: $("#rProp").value || null,
      property_label: $("#rLabel").value.trim(),
      tenant_name: $("#rTenant").value.trim(),
      tenant_phone: $("#rPhone").value.trim(),
      owner_name: $("#rOwner").value.trim(),
      rent: Number(digits($("#rRent").value)) || 0,
      due_day: Number($("#rDue").value) || null,
      index_name: $("#rIndex").value,
      start_date: $("#rStart").value,
      months: Number($("#rMonths").value) || 0,
      notes: $("#rNotes").value.trim(),
      status: $("#rStatus").value,
    };
    const missing = [];
    if (!data.property_label) missing.push($("#rLabel"));
    if (data.tenant_name.length < 2) missing.push($("#rTenant"));
    if (!data.rent) missing.push($("#rRent"));
    if (!data.start_date) missing.push($("#rStart"));
    if (!data.months) missing.push($("#rMonths"));
    if (missing.length) { missing.forEach((el) => el.classList.add("is-invalid")); missing[0].focus(); toast("Preencha os campos marcados."); return; }
    $("#rSave").disabled = true;
    try {
      await Store.saveRental(data);
      close();
      await refresh();
      render();
      toast(data.id ? "Locação atualizada." : "Locação registrada. O painel vai avisar sobre reajuste e fim do contrato.");
    } catch (ex) {
      console.error(ex);
      toast("Não foi possível salvar a locação. Tente de novo.");
    } finally {
      $("#rSave").disabled = false;
    }
  }

  function show() { render(); refresh(); }

  function init(ctx) {
    ui = ctx;
    const { $ } = ui;
    $("#newRental").addEventListener("click", () => openNew());
    $("#rentalForm").addEventListener("submit", save);
    $("#rentalForm").addEventListener("input", (e) => e.target.classList?.remove("is-invalid"));
    $("#rProp").addEventListener("change", (e) => {
      const p = ui.items.find((x) => String(x.id) === e.target.value);
      if (!p) return;
      $("#rLabel").value = labelFor(p);
      if (!ui.digits($("#rRent").value)) $("#rRent").value = ui.brl(p.price);
    });
    ui.$$("[data-rental-close]").forEach((b) => b.addEventListener("click", close));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#rentalEditor").hidden && $("#confirm").hidden) close(); });
    $("#rentalTabs").addEventListener("click", (e) => { const b = e.target.closest("[data-rtab]"); if (b) { tab = b.dataset.rtab; render(); } });
    $("#rentalList").addEventListener("click", (e) => {
      const b = e.target.closest("[data-redit]");
      if (!b) return;
      const r = rentals.find((x) => String(x.id) === b.closest("[data-rental]").dataset.rental);
      if (r) open(r);
    });
    $("#rDelete").addEventListener("click", async () => {
      if (!editing) return;
      if (!(await ui.confirmBox(`Excluir o registro da locação de ${editing.tenant_name}? (O contrato assinado não é afetado.)`, "Excluir"))) return;
      try { await Store.deleteRental(editing.id); close(); await refresh(); render(); ui.toast("Registro excluído."); }
      catch (ex) { console.error(ex); ui.toast("Não foi possível excluir."); }
    });
  }

  return { init, show, refresh, openNew };
})();
