/* Página de Política de Privacidade: só preenche contatos e o menu. */
(() => {
  "use strict";
  U.$("#year").textContent = new Date().getFullYear();
  Site.loadSettings();
  U.$("#menuBtn").addEventListener("click", (e) => {
    const open = U.$("#nav").classList.toggle("is-open");
    e.currentTarget.setAttribute("aria-expanded", open);
  });
  U.$("#openFavs").addEventListener("click", () => { location.href = "/#imoveis"; });
})();
