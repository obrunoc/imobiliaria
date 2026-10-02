/* Painel → Site: contatos, Quem somos, equipe e depoimentos (só admin). Tudo aqui é público. */
window.SiteSettings = (() => {
  "use strict";

  let ui;
  let data = null;
  let removed = [];
  let dirty = false;

  const KEYS = ["whatsapp", "phone", "email", "creci", "address", "hours", "instagram", "about", "googleReviewsUrl"];

  function teamHTML() {
    const { esc, icon } = ui;
    return (data.team || []).map((m, i) => `
      <div class="member-edit" data-m="${i}">
        <label class="member-edit__photo" title="Trocar foto">
          ${m.photoSrc ? `<img src="${esc(m.photoSrc)}" alt="" />` : `<span>${icon("image")}<small>Foto</small></span>`}
          <input type="file" accept="image/*" data-mphoto />
        </label>
        <div class="member-edit__fields">
          <input class="input" placeholder="Nome" value="${esc(m.name || "")}" data-mk="name" maxlength="80" />
          <input class="input" placeholder="Função (ex.: Corretor)" value="${esc(m.role || "")}" data-mk="role" maxlength="60" />
          <input class="input" placeholder="CRECI (opcional)" value="${esc(m.creci || "")}" data-mk="creci" maxlength="20" />
        </div>
        <div class="member-edit__tools">
          ${m.photoSrc ? `<button type="button" class="btn btn--ghost btn--sm" data-mnophoto>Tirar foto</button>` : ""}
          <button type="button" class="icon-btn" data-mdel aria-label="Remover pessoa">${icon("trash")}</button>
        </div>
      </div>`).join("") || `<p class="muted">Ninguém adicionado. A seção da equipe fica escondida no site até ter alguém.</p>`;
  }

  function reviewsHTML() {
    const { esc, icon } = ui;
    return (data.testimonials || []).map((t, i) => `
      <div class="review-edit" data-r="${i}">
        <textarea class="input textarea" rows="3" placeholder="O que o cliente disse" data-rk="text" maxlength="500">${esc(t.text || "")}</textarea>
        <div class="review-edit__row">
          <input class="input" placeholder="Nome do cliente" value="${esc(t.name || "")}" data-rk="name" maxlength="80" />
          <input class="input" placeholder="Detalhe (ex.: alugou no Centro)" value="${esc(t.detail || "")}" data-rk="detail" maxlength="80" />
          <button type="button" class="icon-btn" data-rdel aria-label="Remover depoimento">${icon("trash")}</button>
        </div>
      </div>`).join("") || `<p class="muted">Nenhum depoimento. A seção fica escondida no site até ter algum (ou o link do Google).</p>`;
  }

  function render() {
    const { $ } = ui;
    KEYS.forEach((k) => { const el = ui.$(`[data-k="${k}"]`); if (el) el.value = data[k] || ""; });
    $("#teamEdit").innerHTML = teamHTML();
    $("#reviewsEdit").innerHTML = reviewsHTML();
    $("#feedUrl").value = `${location.origin}/portais/vrsync.xml`;
  }

  async function show() {
    if (!ui.isAdmin()) return;
    if (dirty && data) { render(); return; }
    ui.$("#teamEdit").innerHTML = `<p class="muted">Carregando…</p>`;
    data = await Store.getSettings();
    data.team = (data.team || []).map((m) => ({ ...m }));
    data.testimonials = (data.testimonials || []).map((t) => ({ ...t }));
    removed = [];
    dirty = false;
    render();
  }

  async function save() {
    const { $, digits, toast } = ui;
    KEYS.forEach((k) => { const el = $(`[data-k="${k}"]`); if (el) data[k] = el.value.trim(); });
    let w = digits(data.whatsapp);
    if (w.length === 10 || w.length === 11) w = `55${w}`;
    if (w.length < 12) { $("#sWhats").classList.add("is-invalid"); $("#sWhats").focus(); toast("Informe o WhatsApp com DDD."); return; }
    data.whatsapp = w;
    const btn = $("#saveSite");
    btn.disabled = true;
    btn.textContent = "Salvando…";
    try {
      for (const m of data.team) {
        if (m.file) {
          const up = await Store.uploadImage("equipe", m.file);
          if (m.photo?.path) removed.push(m.photo.path);
          m.photo = { url: up.url, path: up.path };
          m.photoSrc = up.src;
          delete m.file;
        }
      }
      data.team = data.team.filter((m) => m.name?.trim());
      data.testimonials = data.testimonials.filter((t) => t.name?.trim() && t.text?.trim());
      await Store.saveSettings(data, removed);
      removed = [];
      dirty = false;
      render();
      toast("Dados do site salvos. Já aparecem para os visitantes.");
    } catch (ex) {
      console.error(ex);
      toast("Não foi possível salvar. Verifique a internet e tente de novo.");
    } finally {
      btn.disabled = false;
      btn.textContent = "Salvar alterações";
    }
  }

  function init(ctx) {
    ui = ctx;
    const { $ } = ui;
    $("#saveSite").addEventListener("click", save);
    $("#siteForm").addEventListener("submit", (e) => { e.preventDefault(); save(); });
    $("#siteForm").addEventListener("input", (e) => {
      dirty = true;
      e.target.classList?.remove("is-invalid");
      const mk = e.target.dataset.mk, rk = e.target.dataset.rk;
      if (mk) data.team[+e.target.closest("[data-m]").dataset.m][mk] = e.target.value;
      if (rk) data.testimonials[+e.target.closest("[data-r]").dataset.r][rk] = e.target.value;
    });
    $("#siteForm").addEventListener("change", (e) => {
      if (!e.target.matches("[data-mphoto]")) return;
      const f = e.target.files[0];
      if (!f || !f.type.startsWith("image/")) return;
      const m = data.team[+e.target.closest("[data-m]").dataset.m];
      m.file = f;
      m.photoSrc = URL.createObjectURL(f);
      dirty = true;
      $("#teamEdit").innerHTML = teamHTML();
    });
    $("#siteForm").addEventListener("click", (e) => {
      const card = e.target.closest("[data-m]");
      if (e.target.closest("[data-mdel]")) {
        const [m] = data.team.splice(+card.dataset.m, 1);
        if (m.photo?.path) removed.push(m.photo.path);
        dirty = true;
        $("#teamEdit").innerHTML = teamHTML();
      } else if (e.target.closest("[data-mnophoto]")) {
        const m = data.team[+card.dataset.m];
        if (m.photo?.path) removed.push(m.photo.path);
        m.photo = null; m.photoSrc = ""; m.file = null;
        dirty = true;
        $("#teamEdit").innerHTML = teamHTML();
      } else if (e.target.closest("[data-rdel]")) {
        data.testimonials.splice(+e.target.closest("[data-r]").dataset.r, 1);
        dirty = true;
        $("#reviewsEdit").innerHTML = reviewsHTML();
      }
    });
    $("#addMember").addEventListener("click", () => {
      data.team.push({ name: "", role: "Corretor(a)", creci: "" });
      dirty = true;
      $("#teamEdit").innerHTML = teamHTML();
      ui.$$("#teamEdit [data-mk='name']").pop()?.focus();
    });
    $("#addReview").addEventListener("click", () => {
      data.testimonials.push({ name: "", text: "", detail: "" });
      dirty = true;
      $("#reviewsEdit").innerHTML = reviewsHTML();
      ui.$$("#reviewsEdit [data-rk='text']").pop()?.focus();
    });
    $("#copyFeed").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText($("#feedUrl").value); ui.toast("Endereço copiado."); }
      catch { $("#feedUrl").select(); }
    });
  }

  return { init, show };
})();
