/*
  Movimento do site: parallax, elementos que surgem ao rolar e cabeçalho com sombra.
  Leve de propósito: sem bibliotecas, um único laço por quadro e só "transform"/"opacity".
  Quem ativou "reduzir movimento" no sistema vê tudo parado.
*/
(() => {
  "use strict";

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const header = document.querySelector(".header");

  // ---------- Surgir ao rolar ----------
  // Marque um elemento com data-reveal. Irmãos marcados entram em sequência (até 3 por vez).
  if (!reduce && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      }
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.06 });

    const watch = (el) => {
      if (el.dataset.revealOn) return;
      el.dataset.revealOn = "1";
      const siblings = [...(el.parentElement?.children || [])].filter((c) => c.hasAttribute("data-reveal"));
      el.style.setProperty("--reveal-delay", `${(siblings.indexOf(el) % 3) * 90}ms`);
      io.observe(el);
    };

    document.querySelectorAll("[data-reveal]").forEach(watch);
    // cards e listas são montados depois pelo JavaScript
    new MutationObserver((muts) => {
      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (n.nodeType !== 1) continue;
          if (n.hasAttribute("data-reveal")) watch(n);
          n.querySelectorAll("[data-reveal]").forEach(watch);
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
    document.documentElement.classList.add("motion");
  }

  // ---------- Parallax ----------
  // data-parallax="0.2": a camada anda 20% da rolagem, em relação ao centro da sua seção.
  const layers = reduce ? [] : [...document.querySelectorAll("[data-parallax]")].map((el) => ({
    el,
    speed: Number(el.dataset.parallax) || 0,
    scope: el.closest("section, header, footer") || el.parentElement,
    center: 0,
    top: 0,
    bottom: 0,
  }));

  function measure() {
    const y = scrollY;
    for (const l of layers) {
      const r = l.scope.getBoundingClientRect();
      l.top = r.top + y;
      l.bottom = r.bottom + y;
      l.center = l.top + r.height / 2;
    }
  }

  let ticking = false;
  function frame() {
    ticking = false;
    const y = scrollY;
    const vh = innerHeight;
    header?.classList.toggle("is-scrolled", y > 8);
    const k = innerWidth < 760 ? 0.5 : 1; // mais suave em telas pequenas
    for (const l of layers) {
      if (l.bottom < y - 200 || l.top > y + vh + 200) continue; // fora da tela: não mexe
      const offset = (y + vh / 2 - l.center) * l.speed * k;
      l.el.style.setProperty("--py", `${offset.toFixed(1)}px`);
    }
  }
  const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };

  addEventListener("scroll", request, { passive: true });
  addEventListener("resize", () => { measure(); request(); }, { passive: true });
  // a página muda de altura quando os imóveis carregam
  if ("ResizeObserver" in window) new ResizeObserver(() => { measure(); request(); }).observe(document.body);
  measure();
  frame();
})();
