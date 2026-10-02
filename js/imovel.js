/* Página própria de cada imóvel: /imovel/12 (ou imovel.html?cod=12 quando roda localmente). */
(() => {
  "use strict";

  const { $, brl, icon } = U;
  const { favorites, toast } = Site;
  const root = $("#propRoot");

  const codeFromUrl = () => {
    const m = location.pathname.match(/\/imovel\/(\d+)/);
    return Number(m ? m[1] : new URLSearchParams(location.search).get("cod")) || 0;
  };

  function notFound() {
    document.title = "Imóvel não encontrado · VC Imóveis";
    root.innerHTML = `
      <div class="page-msg">
        <h1>Este imóvel não está mais disponível</h1>
        <p class="muted">Ele pode ter sido alugado ou vendido. Veja outras opções parecidas no site.</p>
        <a class="btn btn--primary" href="/#imoveis">Ver imóveis disponíveis</a>
      </div>`;
  }

  async function load() {
    $("#year").textContent = new Date().getFullYear();
    Site.loadSettings();
    const code = codeFromUrl();
    let p = null;
    try { p = await Store.getPublicByCode(code); } catch (err) { console.error(err); }
    if (!p) { notFound(); return; }

    const rent = p.mode === "alugar";
    document.title = `${p.type} ${rent ? "para alugar" : "à venda"} · ${p.neighborhood} · ${brl(p.price)}${rent ? "/mês" : ""} · VC Imóveis`;
    root.innerHTML = `
      <a class="page-prop__back" href="/#imoveis">${icon("left")} Ver todos os imóveis</a>
      <div class="page-prop__card">${Site.detailHTML(p)}</div>`;
    Site.mountDetail(root, p);

    document.addEventListener("keydown", (e) => {
      if (!root.galleryStep || e.target.matches("input, textarea, video")) return;
      if (e.key === "ArrowRight") root.galleryStep(1);
      if (e.key === "ArrowLeft") root.galleryStep(-1);
    });
  }

  document.addEventListener("click", (e) => {
    const fav = e.target.closest("[data-fav]");
    if (!fav) return;
    const on = favorites.toggle(fav.dataset.fav);
    fav.classList.toggle("is-fav", on);
    fav.setAttribute("aria-pressed", on);
    fav.innerHTML = `${icon(on ? "heart" : "heart-o")} ${on ? "Salvo" : "Salvar"}`;
    toast(on ? "Salvo nos favoritos" : "Removido dos favoritos");
  });

  $("#menuBtn")?.addEventListener("click", () => {
    const open = $("#nav").classList.toggle("is-open");
    $("#menuBtn").setAttribute("aria-expanded", open);
  });
  const favBtn = $("#openFavs");
  if (favBtn) favBtn.addEventListener("click", () => { location.href = "/#imoveis"; });

  load();
})();
