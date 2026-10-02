/* Painel → Clientes: pedidos de visita, "me avise" e proprietários. Só a equipe logada vê. */
window.Leads = (() => {
  "use strict";

  let ui;
  let leads = [];
  let loaded = false;
  const view = { status: "novo", kind: "", q: "", matchFor: null };

  const KIND = {
    visita: { label: "Pedido de visita", cls: "k-visita" },
    alerta: { label: "Me avise", cls: "k-alerta" },
    anunciar: { label: "Quer anunciar", cls: "k-anunciar" },
    contato: { label: "Contato", cls: "k-contato" },
  };
  const STATUS = [
    ["novo", "Novos"],
    ["em_atendimento", "Em atendimento"],
    ["visitou", "Visitou"],
    ["fechado", "Fechou negócio"],
    ["descartado", "Descartados"],
    ["", "Todos"],
  ];
  const STATUS_ONE = { novo: "Novo", em_atendimento: "Em atendimento", visitou: "Visitou", fechado: "Fechou negócio", descartado: "Descartado" };

  const fmtWhen = (iso) => {
    const d = new Date(iso);
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    const yest = new Date(today); yest.setDate(today.getDate() - 1);
    const hm = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    if (sameDay) return `hoje, ${hm}`;
    if (d.toDateString() === yest.toDateString()) return `ontem, ${hm}`;
    return `${d.toLocaleDateString("pt-BR")} ${hm}`;
  };
  const fmtVisit = (date, time) => {
    if (!date) return "";
    const [y, m, dd] = date.split("-").map(Number);
    const d = new Date(y, m - 1, dd);
    return `${d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}${time ? ` às ${time}` : ""}`;
  };

  function criteriaText(c) {
    if (!c) return "";
    const { brl } = ui;
    return [c.type || "Qualquer tipo", c.mode === "alugar" ? "para alugar" : "para comprar",
      c.neighborhood ? `no ${c.neighborhood}` : "em qualquer bairro", c.beds ? `${c.beds}+ quartos` : "",
      c.priceMax ? `até ${brl(c.priceMax)}${c.mode === "alugar" ? "/mês" : ""}` : ""].filter(Boolean).join(", ");
  }

  /** Pedidos "me avise" (ainda em aberto) que combinam com o imóvel. */
  function matchesFor(p) {
    return leads.filter((l) => l.kind === "alerta" && !["fechado", "descartado"].includes(l.status) && Store.matches(l.criteria, p));
  }

  async function refresh() {
    try {
      leads = await Store.listLeads();
      loaded = true;
    } catch (ex) {
      console.error(ex);
      loaded = false;
    }
    updateBadge();
    if (!ui.$("#viewClientes").hidden) render();
  }

  function updateBadge() {
    const n = leads.filter((l) => l.status === "novo").length;
    const b = ui.$("#leadCount");
    b.hidden = n === 0;
    b.textContent = n;
  }

  function visible() {
    const q = ui.norm(view.q);
    let list = leads;
    if (view.matchFor) list = matchesFor(view.matchFor);
    return list.filter((l) =>
      (view.matchFor || !view.status || l.status === view.status) &&
      (!view.kind || l.kind === view.kind) &&
      (!q || ui.norm(`${l.name} ${l.phone} ${l.property_code || ""} ${l.message}`).includes(q)));
  }

  function cardHTML(l) {
    const { esc, icon, waTo, items, propUrl } = ui;
    const k = KIND[l.kind] || KIND.contato;
    const first = String(l.name).split(" ")[0];
    const prop = l.property_id ? items.find((p) => p.id === l.property_id) : items.find((p) => Number(p.code) === Number(l.property_code));
    let detail = "";
    let waText = `Olá, ${first}! Aqui é da VC Imóveis.`;
    if (l.kind === "visita") {
      const what = prop ? `${prop.type} · ${prop.neighborhood}` : `imóvel cód. ${l.property_code || "?"}`;
      detail = `<p><b>Quer visitar:</b> ${prop ? `<a href="${esc(propUrl(prop))}" target="_blank" rel="noopener">Cód. ${esc(prop.code)} · ${esc(what)}</a>` : esc(what)}<br/><b>Quando:</b> ${esc(fmtVisit(l.visit_date, l.visit_time)) || "a combinar"}</p>`;
      waText = `Olá, ${first}! Aqui é da VC Imóveis. Recebemos seu pedido de visita ao imóvel cód. ${l.property_code} para ${fmtVisit(l.visit_date, l.visit_time)}. Podemos confirmar?`;
    } else if (l.kind === "alerta") {
      const now = ui.items.filter((p) => Store.matches(l.criteria, p));
      detail = `<p><b>Procura:</b> ${esc(criteriaText(l.criteria))}</p>
        <p class="lead__match">${now.length
          ? `${icon("star")} Combina agora com: ${now.slice(0, 6).map((p) => `<a href="${esc(propUrl(p))}" target="_blank" rel="noopener">Cód. ${esc(p.code)}</a>`).join(", ")}`
          : "Nenhum imóvel disponível combina ainda. Quando cadastrar um, o painel avisa."}</p>`;
      const first3 = now.slice(0, 3).map((p) => propUrl(p)).join("\n");
      waText = now.length
        ? `Olá, ${first}! Aqui é da VC Imóveis. Você pediu para ser avisado(a) e chegou imóvel com o seu perfil:\n${first3}`
        : `Olá, ${first}! Aqui é da VC Imóveis. Recebemos seu pedido e vamos te avisar assim que aparecer um imóvel com o seu perfil.`;
    } else {
      detail = l.message ? `<p>${esc(l.message)}</p>` : "";
      if (l.kind === "anunciar") waText = `Olá, ${first}! Aqui é da VC Imóveis. Recebemos seu contato sobre o seu imóvel. Quando podemos conversar?`;
    }
    if (l.kind === "visita" && l.message) detail += `<p>${esc(l.message)}</p>`;

    const opts = Object.entries(STATUS_ONE).map(([v, t]) => `<option value="${v}" ${v === l.status ? "selected" : ""}>${t}</option>`).join("");
    return `
      <article class="lead ${l.status === "novo" ? "is-new" : ""}" data-lead="${esc(l.id)}">
        <div class="lead__head">
          <span class="kind ${k.cls}">${k.label}</span>
          <span class="lead__when">${esc(fmtWhen(l.created_at))}</span>
          <label class="lead__status"><span class="sr-only">Situação do atendimento</span>
            <select class="status-select ls-${esc(l.status)}" data-lstatus>${opts}</select></label>
        </div>
        <div class="lead__body">
          <div class="lead__who">
            <strong>${esc(l.name)}</strong>
            <span>${esc(l.phone)}</span>
          </div>
          <div class="lead__contact">
            <a class="btn btn--primary btn--sm" target="_blank" rel="noopener" href="${esc(waTo(l.phone, waText))}">${icon("whats")} WhatsApp</a>
            <a class="icon-btn" href="tel:+55${esc(ui.digits(l.phone))}" aria-label="Ligar para ${esc(l.name)}" title="Ligar">${icon("phone")}</a>
            <button class="icon-btn" data-ldel aria-label="Apagar dados deste cliente" title="Apagar dados deste cliente">${icon("trash")}</button>
          </div>
        </div>
        <div class="lead__detail">${detail}</div>
        <label class="lead__notes"><span class="sr-only">Anotações do atendimento</span>
          <textarea class="input textarea" rows="2" maxlength="4000" placeholder="Anotações do atendimento (só a equipe vê)" data-lnotes>${esc(l.notes || "")}</textarea></label>
      </article>`;
  }

  function render() {
    const { $, esc, plural } = ui;
    const count = (s) => (s ? leads.filter((l) => l.status === s).length : leads.length);
    $("#leadTabs").innerHTML = view.matchFor
      ? `<button type="button" class="status-tab is-active">Combinam com cód. ${esc(view.matchFor.code)} <b>${matchesFor(view.matchFor).length}</b></button>
         <button type="button" class="status-tab" data-ltab="novo">Ver todos os pedidos</button>`
      : STATUS.map(([k, t]) => `<button type="button" role="tab" class="status-tab ${view.status === k ? "is-active" : ""}" aria-selected="${view.status === k}" data-ltab="${k}">${t} <b>${count(k)}</b></button>`).join("");
    if (!loaded) { $("#leadList").innerHTML = `<p class="form-error">Não foi possível carregar os pedidos. Atualize a página.</p>`; return; }
    const list = visible();
    $("#leadList").innerHTML = list.length ? list.map(cardHTML).join("") : `
      <div class="feed-empty"><h3>${leads.length ? "Nenhum pedido aqui" : "Nenhum pedido ainda"}</h3>
      <p class="muted">${leads.length ? "Troque a aba ou limpe a busca." : "Quando alguém pedir visita, pedir para ser avisado ou quiser anunciar pelo site, aparece aqui."}</p></div>`;
    $("#leadSummary").textContent = `${plural(count("novo"), "pedido novo", "pedidos novos")} · ${plural(leads.length, "pedido", "pedidos")} no total`;
  }

  function show(arg) {
    view.matchFor = arg?.matchFor || null;
    if (!view.matchFor && !arg) view.status = view.status ?? "novo";
    render();
    refresh();
  }

  function init(ctx) {
    ui = ctx;
    const { $ } = ui;
    $("#leadTabs").addEventListener("click", (e) => {
      const b = e.target.closest("[data-ltab]");
      if (!b) return;
      view.matchFor = null;
      view.status = b.dataset.ltab;
      render();
    });
    $("#leadQ").addEventListener("input", (e) => { view.q = e.target.value; render(); });
    $("#leadKind").addEventListener("change", (e) => { view.kind = e.target.value; render(); });

    $("#leadList").addEventListener("change", async (e) => {
      const sel = e.target.closest("[data-lstatus]");
      if (!sel) return;
      const l = leads.find((x) => String(x.id) === sel.closest("[data-lead]").dataset.lead);
      const prev = l.status;
      l.status = sel.value;
      try {
        await Store.updateLead(l.id, { status: l.status });
        updateBadge();
        render();
        ui.toast(`Atendimento de ${l.name.split(" ")[0]}: ${STATUS_ONE[l.status].toLowerCase()}.`);
      } catch (ex) { console.error(ex); l.status = prev; render(); ui.toast("Não foi possível atualizar. Tente de novo."); }
    });

    $("#leadList").addEventListener("focusout", async (e) => {
      const ta = e.target.closest("[data-lnotes]");
      if (!ta) return;
      const l = leads.find((x) => String(x.id) === ta.closest("[data-lead]").dataset.lead);
      if ((l.notes || "") === ta.value) return;
      try {
        await Store.updateLead(l.id, { notes: ta.value });
        l.notes = ta.value;
        if (l.status === "novo") {
          l.status = "em_atendimento";
          await Store.updateLead(l.id, { status: l.status });
          updateBadge();
          render();
        }
        ui.toast("Anotação salva.");
      } catch (ex) { console.error(ex); ui.toast("Não foi possível salvar a anotação."); }
    });

    $("#leadList").addEventListener("click", async (e) => {
      const del = e.target.closest("[data-ldel]");
      if (!del) return;
      const l = leads.find((x) => String(x.id) === del.closest("[data-lead]").dataset.lead);
      if (!(await ui.confirmBox(`Apagar os dados de ${l.name} (nome, telefone e anotações)? Use quando o atendimento terminar ou quando o cliente pedir.`, "Apagar"))) return;
      try {
        await Store.deleteLead(l.id);
        leads = leads.filter((x) => x.id !== l.id);
        updateBadge();
        render();
        ui.toast("Dados do cliente apagados.");
      } catch (ex) { console.error(ex); ui.toast("Não foi possível apagar. Tente de novo."); }
    });

    $("#purgeLeads").addEventListener("click", async () => {
      const limit = Date.now() - 365 * 864e5;
      const old = leads.filter((l) => Date.parse(l.created_at) < limit);
      if (!old.length) { ui.toast("Nenhum pedido com mais de 12 meses."); return; }
      if (!(await ui.confirmBox(`Apagar ${old.length} pedido(s) com mais de 12 meses, como diz a Política de Privacidade?`, "Apagar"))) return;
      for (const l of old) { try { await Store.deleteLead(l.id); } catch (ex) { console.error(ex); } }
      await refresh();
      render();
      ui.toast("Pedidos antigos apagados.");
    });
  }

  return { init, show, refresh, matchesFor };
})();
