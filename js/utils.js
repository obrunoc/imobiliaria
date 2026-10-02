/* Utilitários usados pelo site e pelo painel. Carregado antes de todos os outros scripts. */
window.U = (() => {
  "use strict";

  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const isLocal = () => location.protocol === "file:" || ["localhost", "127.0.0.1"].includes(location.hostname);

  return {
    $: (sel, el = document) => el.querySelector(sel),
    $$: (sel, el = document) => [...el.querySelectorAll(sel)],
    /** Escapa texto para inserir em HTML. */
    esc: (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]),
    /** R$ 1.500 (sem centavos) */
    brl: (n) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }),
    /** R$ 1.500,00 (com centavos) */
    money: (n) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
    digits: (s) => String(s ?? "").replace(/\D/g, ""),
    norm: (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(),
    plural: (n, one, many) => `${n} ${n === 1 ? one : many}`,
    icon: (id) => `<svg aria-hidden="true"><use href="#i-${id}"/></svg>`,
    uniqSorted: (arr) => [...new Set(arr.filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    city: () => (typeof CITY !== "undefined" ? CITY : "Brazópolis - MG"),

    /** Link público do imóvel: /imovel/12 em produção (com prévia no WhatsApp). */
    propUrl: (p) => (isLocal() ? `${location.origin}/imovel.html?cod=${p.code}` : `${location.origin}/imovel/${p.code}`),

    /** Link de WhatsApp para um número brasileiro (acrescenta o 55 se faltar). */
    waTo(phone, text) {
      let d = String(phone ?? "").replace(/\D/g, "");
      if (d.length === 10 || d.length === 11) d = `55${d}`;
      return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
    },

    /** (35) 99999-9999 enquanto digita. */
    phoneMask(el) {
      const d = String(el.value).replace(/\D/g, "").slice(0, 11);
      let out = d;
      if (d.length > 2) out = `(${d.slice(0, 2)}) ${d.slice(2)}`;
      if (d.length > 7) out = `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
      el.value = out;
    },

    /** Copia texto; se o navegador não deixar, mostra para a pessoa copiar. */
    async copy(text) {
      try { await navigator.clipboard.writeText(text); return true; }
      catch { window.prompt("Copie o texto:", text); return false; }
    },
  };
})();
