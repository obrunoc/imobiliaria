/* Partes compartilhadas entre a página inicial (app.js) e a página de cada imóvel (imovel.js). */
window.Site = (() => {
  "use strict";

  // ---------- Utilidades ----------
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const brl = (n) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  const icon = (id) => `<svg aria-hidden="true"><use href="#i-${id}"/></svg>`;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const digits = (s) => String(s || "").replace(/\D/g, "");
  const city = () => (typeof CITY !== "undefined" ? CITY : "Brazópolis - MG");

  const totalOf = (p) => Number(p.price) + Number(p.condo || 0) + Number(p.iptu || 0);
  const comparable = (p) => (p.mode === "alugar" ? totalOf(p) : Number(p.price));
  const daysAgo = (p) => (Date.now() - Date.parse(p.created_at)) / 864e5;
  const cover = (p) => (p.media.find((m) => m.type === "image") || p.media[0] || {}).src || "";
  const priceDrop = (p) => (Number(p.old_price) > Number(p.price) ? Number(p.old_price) - Number(p.price) : 0);

  let settings = { ...(window.DEFAULT_SETTINGS || {}) };
  const wa = (text, number = settings.whatsapp) => `https://wa.me/${digits(number)}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

  /** Link público do imóvel. Em produção usa /imovel/12 (com prévia no WhatsApp). */
  function propUrl(p) {
    const local = location.protocol === "file:" || ["localhost", "127.0.0.1"].includes(location.hostname);
    return local ? `${location.origin}/imovel.html?cod=${p.code}` : `${location.origin}/imovel/${p.code}`;
  }

  // ---------- Favoritos (só neste navegador) ----------
  const favorites = (() => {
    let set;
    try { set = new Set((JSON.parse(localStorage.getItem("vc:favs")) || []).map(String)); } catch { set = new Set(); }
    const persist = () => { try { localStorage.setItem("vc:favs", JSON.stringify([...set])); } catch { /* sem storage */ } };
    return {
      has: (id) => set.has(String(id)),
      toggle(id) { id = String(id); const on = !set.has(id); on ? set.add(id) : set.delete(id); persist(); return on; },
    };
  })();

  // ---------- Toast ----------
  let toastTimer;
  function toast(text, ms = 2400) {
    const t = $("#toast");
    if (!t) return;
    t.textContent = text;
    t.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("is-visible"), ms);
  }

  // ---------- Dados do site (contatos etc.) ----------
  async function loadSettings() {
    try { settings = await Store.getSettings(); } catch { /* fica com o padrão */ }
    applySettings();
    return settings;
  }

  function applySettings() {
    const s = settings;
    $$("[data-s]").forEach((el) => {
      const v = s[el.dataset.s];
      el.textContent = v || "";
      const wrap = el.closest("[data-s-wrap]");
      if (wrap) wrap.hidden = !v;
    });
    $$("[data-s-whats]").forEach((a) => { a.href = wa(a.dataset.sWhats || "Olá! Vim pelo site da VC Imóveis."); });
    $$("[data-s-phone]").forEach((a) => { a.href = `tel:+55${digits(s.phone)}`; });
    $$("[data-s-insta]").forEach((a) => {
      const handle = String(s.instagram || "").replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/$/, "");
      a.hidden = !handle;
      a.href = `https://instagram.com/${encodeURIComponent(handle)}`;
      const label = a.querySelector("[data-insta-label]");
      if (label) label.textContent = `@${handle}`;
    });
  }

  // ---------- Formulários de contato (com consentimento LGPD) ----------
  function consentHTML(id) {
    return `<label class="consent"><input type="checkbox" id="${id}" required />
      <span>Li e concordo com a <a href="/privacidade.html" target="_blank" rel="noopener">Política de Privacidade</a>. Meus dados serão usados só para este atendimento.</span></label>
      <input type="text" name="empresa" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true" />`;
  }

  function phoneMask(el) {
    const d = digits(el.value).slice(0, 11);
    let out = d;
    if (d.length > 2) out = `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length > 7) out = `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
    el.value = out;
  }

  /**
   * Envia um pedido. Em caso de sucesso, troca o formulário por uma confirmação
   * com atalho para o WhatsApp da imobiliária.
   */
  async function submitLead(form, lead, waText) {
    if (form.querySelector(".hp")?.value) return; // robô preencheu o campo escondido
    const btn = form.querySelector('[type="submit"]');
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Enviando…";
    try {
      await Store.createLead(lead);
      form.outerHTML = `
        <div class="form-done" role="status">
          <span class="form-done__icon">${icon("check")}</span>
          <strong>Recebemos seu pedido!</strong>
          <p>A equipe da VC Imóveis vai te chamar no WhatsApp em breve. Se preferir, fale agora:</p>
          <a class="btn btn--outline btn--block" href="${esc(wa(waText))}" target="_blank" rel="noopener">${icon("whats")} Falar no WhatsApp</a>
        </div>`;
    } catch (ex) {
      console.error(ex);
      btn.disabled = false;
      btn.textContent = label;
      const msg = ex.message && !/fetch|network|failed/i.test(ex.message) ? ex.message : "Não foi possível enviar agora.";
      toast(`${msg} Tente de novo ou chame no WhatsApp.`, 4500);
    }
  }

  // ---------- Selos ----------
  function badgesHTML(p) {
    const list = [];
    if (p.status === "reservado") list.push(`<span class="badge badge--dark">Reservado</span>`);
    const drop = priceDrop(p);
    if (drop) list.push(`<span class="badge badge--drop">Baixou ${brl(drop)}</span>`);
    if (p.featured && list.length < 2) list.push(`<span class="badge badge--dark">Destaque</span>`);
    if (daysAgo(p) <= 3 && list.length < 2) list.push(`<span class="badge">Novo</span>`);
    return list.length ? `<div class="badges">${list.slice(0, 2).join("")}</div>` : "";
  }

  function specsHTML(p) {
    return [
      p.area ? `<span class="spec">${icon("area")}${p.area} m²</span>` : "",
      p.beds ? `<span class="spec">${icon("bed")}${plural(p.beds, "quarto", "quartos")}</span>` : "",
      p.baths ? `<span class="spec">${icon("bath")}${p.baths}</span>` : "",
      p.parking ? `<span class="spec">${icon("car")}${p.parking}</span>` : "",
    ].join("");
  }

  function cardHTML(p, i = 0) {
    const fav = favorites.has(p.id);
    const rent = p.mode === "alugar";
    const extra = rent && totalOf(p) !== Number(p.price) ? `<span class="card__sub">${brl(totalOf(p))}/mês com condomínio e IPTU</span>` : "";
    const src = cover(p);
    return `
      <article class="card" data-id="${esc(p.id)}" tabindex="0" style="animation-delay:${Math.min(i, 8) * 40}ms" aria-label="${esc(p.type)} em ${esc(p.neighborhood)}, código ${esc(p.code)}">
        <div class="card__media">
          ${src ? `<img src="${esc(src)}" alt="" loading="lazy" />` : ""}
          ${badgesHTML(p)}
          <button class="fav-btn ${fav ? "is-fav" : ""}" data-fav="${esc(p.id)}" aria-pressed="${fav}" aria-label="Favoritar">${icon(fav ? "heart" : "heart-o")}</button>
        </div>
        <div class="card__body">
          <div class="card__price">${brl(p.price)}${rent ? "<small>/mês</small>" : ""}${priceDrop(p) ? `<s class="card__old">${brl(p.old_price)}</s>` : ""}</div>
          ${extra}
          <h3 class="card__title">${esc(p.type)} · ${esc(p.neighborhood)}</h3>
          <div class="specs">${specsHTML(p)}<span class="spec spec--code">Cód. ${esc(p.code)}</span></div>
        </div>
      </article>`;
  }

  // ---------- Ficha completa do imóvel ----------
  function mediaHTML(m, alt) {
    if (!m || !m.src) return `<div class="gallery__empty">${icon("image")}<span>Sem fotos</span></div>`;
    return m.type === "video"
      ? `<video src="${esc(m.src)}" controls playsinline preload="metadata"></video>`
      : `<img src="${esc(m.src)}" alt="${esc(alt)}" />`;
  }

  function detailHTML(p, { inModal = false } = {}) {
    const rent = p.mode === "alugar";
    const fav = favorites.has(p.id);
    const mapQ = encodeURIComponent(`${p.street}, ${p.neighborhood}, ${city()}`);
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
    const media = p.media.length ? p.media : [null];
    const alt = `${p.type} em ${p.neighborhood}`;
    const drop = priceDrop(p);

    return `
      <div class="gallery__main" data-gallery>
        ${mediaHTML(media[0], `${alt}, foto 1`)}
        ${media.length > 1 ? `
          <button class="gallery__nav gallery__nav--prev" data-g="-1" aria-label="Anterior">${icon("left")}</button>
          <button class="gallery__nav gallery__nav--next" data-g="1" aria-label="Próxima">${icon("right")}</button>
          <span class="gallery__counter" data-gcount>1 / ${media.length}</span>` : ""}
      </div>
      <div class="detail">
        <div>
          <span class="detail__tag">${esc(p.type)} ${rent ? "para alugar" : "à venda"}${p.status === "reservado" ? " · Reservado" : ""}</span>
          <h2 id="mTitle">${esc(p.neighborhood)}</h2>
          <p class="muted">${p.street ? `${esc(p.street)} · ` : ""}${esc(city())} · Cód. ${esc(p.code)}</p>
          <div class="specs">${specsHTML(p)}</div>

          <div class="share-row">
            <a class="btn btn--outline btn--sm" data-share-wa target="_blank" rel="noopener" href="${esc(`https://wa.me/?text=${encodeURIComponent(`${p.type} ${rent ? "para alugar" : "à venda"} no bairro ${p.neighborhood} por ${brl(p.price)}${rent ? "/mês" : ""}: ${propUrl(p)}`)}`)}">${icon("whats")} Enviar para alguém</a>
            <button class="btn btn--outline btn--sm" type="button" data-copy-link>${icon("link")} Copiar link</button>
            ${inModal ? `<a class="btn btn--ghost btn--sm" href="${esc(propUrl(p))}">Abrir página do imóvel</a>` : ""}
          </div>

          ${p.description ? `<h3>Sobre o imóvel</h3><p class="detail__desc">${esc(p.description)}</p>` : ""}
          ${(p.amenities || []).length ? `<h3>Diferenciais</h3><div class="amen">${p.amenities.map((a) => `<span>${esc(a)}</span>`).join("")}</div>` : ""}

          ${!rent ? simulatorHTML(p) : ""}

          <a class="map-link" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${mapQ}">${icon("pin")} Ver localização no mapa</a>
        </div>

        <aside class="side">
          <div class="price-box">
            ${drop ? `<span class="drop-note">Baixou ${brl(drop)} · antes ${brl(p.old_price)}</span>` : ""}
            <div class="big">${brl(p.price)}${rent ? "<small>/mês</small>" : ""}</div>
            ${lines}
          </div>
          <form class="visit visit-form" data-visit novalidate>
            <h4>Agendar visita</h4>
            <div class="days" data-days aria-label="Dia"></div>
            <div class="times" data-times aria-label="Horário"></div>
            <input class="input" name="nome" required placeholder="Seu nome" autocomplete="name" maxlength="120" />
            <input class="input" name="tel" required type="tel" placeholder="Seu WhatsApp com DDD" autocomplete="tel" data-mask="phone" />
            ${consentHTML(`vc-${esc(p.code)}-${inModal ? "m" : "p"}`)}
            <button class="btn btn--primary btn--block" type="submit">Pedir visita</button>
          </form>
          <a class="btn btn--outline btn--block" target="_blank" rel="noopener" href="${esc(wa(`Olá! Tenho interesse no imóvel cód. ${p.code}: ${p.type} no bairro ${p.neighborhood}. ${propUrl(p)}`))}">${icon("whats")} Tirar dúvidas no WhatsApp</a>
          <button class="btn btn--outline btn--block ${fav ? "is-fav" : ""}" type="button" data-fav="${esc(p.id)}" aria-pressed="${fav}">${icon(fav ? "heart" : "heart-o")} ${fav ? "Salvo" : "Salvar"}</button>
        </aside>
      </div>`;
  }

  function simulatorHTML(p) {
    return `
      <details class="sim">
        <summary>${icon("calc")} Simular financiamento</summary>
        <div class="sim__body" data-sim data-price="${Number(p.price)}">
          <label><span class="sim__row"><span>Entrada</span><b data-sim-down-l></b></span><input type="range" min="20" max="80" step="5" value="20" data-sim-down /></label>
          <label><span class="sim__row"><span>Prazo</span><b data-sim-years-l></b></span><input type="range" min="5" max="35" step="5" value="30" data-sim-years /></label>
          <label><span class="sim__row"><span>Juros ao ano</span><b data-sim-rate-l></b></span><input type="range" min="8" max="14" step="0.25" value="11" data-sim-rate /></label>
          <div class="sim__result"><small>Primeira parcela aproximada</small><strong data-sim-out></strong><small data-sim-fin></small></div>
          <p class="sim__note">Simulação pela Tabela Price, sem seguros e taxas. As condições reais dependem da análise do banco. Fale com a gente para uma simulação oficial.</p>
        </div>
      </details>`;
  }

  /** Liga galeria, simulador, compartilhamento e agendamento dentro de "root". */
  function mountDetail(root, p) {
    // galeria
    const media = p.media;
    const box = $("[data-gallery]", root);
    if (media.length > 1) {
      let i = 0;
      const alt = `${p.type} em ${p.neighborhood}`;
      const show = (n) => {
        i = (n + media.length) % media.length;
        $("video", box)?.pause();
        $("img, video, .gallery__empty", box).outerHTML = mediaHTML(media[i], `${alt}, foto ${i + 1}`);
        $("[data-gcount]", box).textContent = `${i + 1} / ${media.length}`;
      };
      box.addEventListener("click", (e) => { const b = e.target.closest("[data-g]"); if (b) show(i + +b.dataset.g); });
      let x0 = null;
      box.addEventListener("touchstart", (e) => (x0 = e.touches[0].clientX), { passive: true });
      box.addEventListener("touchend", (e) => {
        if (x0 === null || e.target.closest("video")) { x0 = null; return; }
        const dx = e.changedTouches[0].clientX - x0;
        if (Math.abs(dx) > 40) show(i + (dx < 0 ? 1 : -1));
        x0 = null;
      });
      root.galleryStep = (d) => show(i + d);
    }

    // simulador
    const sim = $("[data-sim]", root);
    if (sim) {
      const price = Number(sim.dataset.price);
      const calc = () => {
        const down = +$("[data-sim-down]", sim).value, years = +$("[data-sim-years]", sim).value, rate = +$("[data-sim-rate]", sim).value;
        const r = Math.pow(1 + rate / 100, 1 / 12) - 1, n = years * 12, fin = price * (1 - down / 100);
        const pmt = (fin * r) / (1 - Math.pow(1 + r, -n));
        $("[data-sim-down-l]", sim).textContent = `${down}% · ${brl(price * down / 100)}`;
        $("[data-sim-years-l]", sim).textContent = `${years} anos`;
        $("[data-sim-rate-l]", sim).textContent = `${rate.toLocaleString("pt-BR")}%`;
        $("[data-sim-out]", sim).textContent = `${brl(Math.round(pmt))}/mês`;
        $("[data-sim-fin]", sim).textContent = `Valor financiado: ${brl(Math.round(fin))}`;
      };
      sim.addEventListener("input", calc);
      calc();
    }

    // copiar link
    $("[data-copy-link]", root)?.addEventListener("click", async () => {
      const url = propUrl(p);
      try { await navigator.clipboard.writeText(url); toast("Link copiado. É só colar no WhatsApp."); }
      catch { prompt("Copie o link do imóvel:", url); }
    });

    // agendamento → pedido de visita
    const WEEK = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const TIMES = ["09:00", "10:30", "14:00", "15:30", "17:00"];
    const days = [];
    const d = new Date();
    while (days.length < 7) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0) days.push(new Date(d)); }
    let selDay = 0, selTime = null;
    const form = $("[data-visit]", root);
    const draw = () => {
      const times = days[selDay].getDay() === 6 ? TIMES.slice(0, 2) : TIMES;
      if (!times.includes(selTime)) selTime = null;
      $("[data-days]", form).innerHTML = days.map((day, k) => `<button type="button" class="${k === selDay ? "is-active" : ""}" data-day="${k}" aria-pressed="${k === selDay}">${WEEK[day.getDay()]}<strong>${day.getDate()}</strong></button>`).join("");
      $("[data-times]", form).innerHTML = times.map((t) => `<button type="button" class="${t === selTime ? "is-active" : ""}" data-time="${t}" aria-pressed="${t === selTime}">${t}</button>`).join("");
    };
    draw();
    form.addEventListener("click", (e) => {
      const b = e.target.closest("[data-day], [data-time]");
      if (!b) return;
      if (b.dataset.day) selDay = +b.dataset.day; else selTime = b.dataset.time;
      draw();
    });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!selTime) { toast("Escolha um horário para a visita."); return; }
      const name = form.nome.value.trim(), phone = form.tel.value.trim();
      if (!name || digits(phone).length < 10) { toast("Preencha seu nome e WhatsApp com DDD."); return; }
      if (!form.querySelector(".consent input").checked) { toast("Marque que concorda com a Política de Privacidade."); return; }
      const day = days[selDay];
      const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
      const when = `${WEEK[day.getDay()].toLowerCase()}, ${day.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às ${selTime}`;
      submitLead(form, {
        kind: "visita", property_id: p.id, property_code: p.code, name, phone,
        visit_date: iso, visit_time: selTime, message: "", consent: true,
      }, `Olá! Pedi uma visita ao imóvel cód. ${p.code} (${p.type} · ${p.neighborhood}) para ${when}.`);
    });

    Store.addView(p.id);
  }

  // ---------- Eventos globais ----------
  document.addEventListener("input", (e) => { if (e.target.dataset?.mask === "phone") phoneMask(e.target); });
  document.addEventListener("error", (e) => { if (e.target.tagName === "IMG") e.target.classList.add("is-broken"); }, true);

  return {
    $, $$, brl, icon, plural, esc, digits, city, wa,
    totalOf, comparable, daysAgo, cover, priceDrop, propUrl,
    favorites, toast, loadSettings, get settings() { return settings; },
    consentHTML, submitLead,
    cardHTML, specsHTML, detailHTML, mountDetail,
  };
})();
