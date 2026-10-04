/* Painel da equipe: login, papéis (dono/corretor), abas, avisos e confirmações. */
(() => {
  "use strict";

  const { $, $$, brl, digits } = U;

  let user = null;
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
    ...U, toast, confirmBox,
    get items() { return Properties.items; },
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
    await Properties.refresh();
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
    Properties.reset();
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

  // Máscaras de dinheiro e telefone (todas as telas do painel)
  document.addEventListener("input", (e) => {
    if (e.target.matches?.("[data-money]")) { const d = digits(e.target.value); e.target.value = d ? brl(+d) : ""; }
    if (e.target.dataset?.mask === "phone") U.phoneMask(e.target);
  });

  // ---------- Início ----------
  Properties.init(ui);
  Leads.init(ui);
  Rentals.init(ui);
  Docs.init(ui);
  SiteSettings.init(ui);
  Art.init(ui);
  boot();
})();
