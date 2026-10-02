/* Painel → arte pronta para Instagram (post 1080x1080 e story 1080x1920) a partir do imóvel. */
window.Art = (() => {
  "use strict";

  let ui;
  let prop = null;
  let photo = null;     // HTMLImageElement carregada (ou null)
  let photoOk = true;
  let format = "post";

  const GOLD = "#eec136", INK = "#2b2c2e", MUTED = "#6e6e6a", WHITE = "#ffffff";
  const LOGO_FONT = "Montserrat, 'Plus Jakarta Sans', Arial, sans-serif";
  const BODY_FONT = "'Plus Jakarta Sans', Arial, sans-serif";

  function loadImage(src) {
    return new Promise((res) => {
      if (!src) { res(null); return; }
      const img = new Image();
      if (!src.startsWith("blob:")) img.crossOrigin = "anonymous";
      img.onload = () => res(img);
      img.onerror = () => res(null);
      img.src = src;
    });
  }

  function cover(ctx, img, x, y, w, h) {
    const r = Math.max(w / img.width, h / img.height);
    const sw = w / r, sh = h / r;
    ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
  }

  function fitText(ctx, text, maxW, size, weight, family) {
    let s = size;
    do { ctx.font = `${weight} ${s}px ${family}`; s -= 2; } while (ctx.measureText(text).width > maxW && s > 18);
  }

  function pill(ctx, text, x, y, bg, fg, size = 34) {
    ctx.font = `800 ${size}px ${BODY_FONT}`;
    const w = ctx.measureText(text).width + size * 1.2, h = size * 1.8;
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();
    ctx.fillStyle = fg;
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + size * 0.6, y + h / 2 + 1);
    ctx.textBaseline = "alphabetic";
    return w;
  }

  function logo(ctx, x, y, w, color) {
    const h = w * 0.84;
    ctx.strokeStyle = color; ctx.lineWidth = w * 0.045; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x + w * 0.06, y + h * 0.40); ctx.quadraticCurveTo(x + w * 0.5, y - h * 0.07, x + w * 0.94, y + h * 0.40); ctx.stroke();
    ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(x + w * 0.47, y + h * 0.31, w * 0.095, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color; ctx.font = `800 ${w * 0.6}px ${LOGO_FONT}`; ctx.textAlign = "center";
    ctx.fillText("VC", x + w * 0.5, y + h * 0.96); ctx.textAlign = "left";
  }

  function specsLine(p) {
    const { plural } = ui;
    return [p.area ? `${p.area} m²` : "", p.beds ? plural(p.beds, "quarto", "quartos") : "", p.baths ? plural(p.baths, "banheiro", "banheiros") : "", p.parking ? plural(p.parking, "vaga", "vagas") : ""].filter(Boolean).join("  ·  ");
  }

  function draw() {
    const c = ui.$("#artCanvas");
    const story = format === "story";
    c.width = 1080; c.height = story ? 1920 : 1080;
    const ctx = c.getContext("2d");
    const p = prop, rent = p.mode === "alugar";
    const settings = draw.settings || {};
    const photoH = story ? 1100 : 660;

    ctx.fillStyle = WHITE; ctx.fillRect(0, 0, c.width, c.height);
    if (photo) cover(ctx, photo, 0, 0, 1080, photoH);
    else {
      const g = ctx.createLinearGradient(0, 0, 1080, photoH); g.addColorStop(0, "#3a3b3e"); g.addColorStop(1, INK);
      ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, photoH);
      logo(ctx, 390, photoH / 2 - 150, 300, WHITE);
    }
    // escurece o topo para os selos
    const shade = ctx.createLinearGradient(0, 0, 0, 220); shade.addColorStop(0, "rgba(0,0,0,.35)"); shade.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = shade; ctx.fillRect(0, 0, 1080, 220);

    const top = story ? 210 : 48;
    let x = 48;
    x += pill(ctx, rent ? "PARA ALUGAR" : "À VENDA", x, top, GOLD, INK) + 14;
    if (Number(p.old_price) > Number(p.price)) pill(ctx, "BAIXOU O PREÇO", x, top, "#e6f4ec", "#1f6b40");
    ctx.font = `800 34px ${BODY_FONT}`;
    const codeTxt = `Cód. ${p.code}`;
    pill(ctx, codeTxt, 1080 - 48 - (ctx.measureText(codeTxt).width + 34 * 1.2), top, INK, WHITE);

    // painel de informações
    let y = photoH + (story ? 150 : 120);
    const priceTxt = ui.brl(p.price);
    fitText(ctx, priceTxt, 760, story ? 120 : 92, 800, LOGO_FONT);
    ctx.fillStyle = INK; ctx.fillText(priceTxt, 60, y);
    if (rent) {
      const w = ctx.measureText(priceTxt).width;
      ctx.font = `600 ${story ? 48 : 40}px ${BODY_FONT}`; ctx.fillStyle = MUTED; ctx.fillText("/mês", 72 + w, y);
    }
    y += story ? 95 : 72;
    fitText(ctx, `${p.type} · ${p.neighborhood}`, 960, story ? 58 : 46, 800, BODY_FONT);
    ctx.fillStyle = INK; ctx.fillText(`${p.type} · ${p.neighborhood}`, 60, y);
    const specs = specsLine(p);
    if (specs) {
      y += story ? 70 : 56;
      fitText(ctx, specs, 960, story ? 42 : 34, 600, BODY_FONT);
      ctx.fillStyle = MUTED; ctx.fillText(specs, 60, y);
    }
    if (story) {
      y += 150;
      ctx.font = `700 46px ${BODY_FONT}`; ctx.fillStyle = INK;
      ctx.fillText("Agende sua visita pelo WhatsApp", 60, y);
      if (settings.phone) { y += 64; ctx.font = `800 52px ${BODY_FONT}`; ctx.fillText(settings.phone, 60, y); }
    }

    // faixa da marca
    const barH = story ? 200 : 110, barY = c.height - barH;
    ctx.fillStyle = INK; ctx.fillRect(0, barY, 1080, barH);
    ctx.fillStyle = GOLD; ctx.fillRect(0, barY, 1080, 8);
    const lw = story ? 150 : 86;
    logo(ctx, 52, barY + (barH - lw * 0.84) / 2 + 4, lw, WHITE);
    ctx.fillStyle = WHITE; ctx.font = `700 ${story ? 50 : 34}px ${LOGO_FONT}`;
    ctx.fillText("IMÓVEIS", 52 + lw + 22, barY + barH / 2 + (story ? 6 : 2));
    ctx.font = `700 ${story ? 22 : 15}px ${BODY_FONT}`; ctx.fillStyle = "#c9c9c4";
    ctx.fillText("REALIZANDO SONHOS", 52 + lw + 24, barY + barH / 2 + (story ? 44 : 28));
    if (!story && settings.phone) {
      ctx.font = `800 34px ${BODY_FONT}`; ctx.fillStyle = WHITE; ctx.textAlign = "right";
      ctx.fillText(settings.phone, 1080 - 52, barY + barH / 2 + 14); ctx.textAlign = "left";
    }
  }

  function caption(p, s) {
    const rent = p.mode === "alugar";
    const lines = [
      `${p.type} ${rent ? "para alugar" : "à venda"} no bairro ${p.neighborhood}, em Brazópolis.`,
      "",
      specsLine(p).replace(/ {2}· {2}/g, " · "),
      `${ui.brl(p.price)}${rent ? "/mês" : ""}${Number(p.old_price) > Number(p.price) ? ` (antes ${ui.brl(p.old_price)})` : ""}`,
      "",
      `Mais fotos e agendamento de visita: ${ui.propUrl(p)}`,
      s.phone ? `WhatsApp: ${s.phone}` : "",
      `Cód. ${p.code}`,
      "",
      `#brazopolis #imoveisbrazopolis #vcimoveis #${rent ? "aluguel" : "venda"} #${String(p.type).toLowerCase().replace(/\s+/g, "")}`,
    ];
    return lines.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n").trim();
  }

  async function open(p) {
    prop = p;
    const { $ } = ui;
    $("#artDialog").hidden = false;
    document.body.classList.add("no-scroll");
    $("#artHint").textContent = "Carregando foto…";
    draw.settings = await Store.getSettings();
    try { await document.fonts.load(`800 60px Montserrat`); await document.fonts.load(`800 40px "Plus Jakarta Sans"`); } catch { /* usa fonte do sistema */ }
    const first = p.media.find((m) => m.type === "image");
    photo = await loadImage(first?.src);
    photoOk = Boolean(photo) || !first;
    $("#artHint").textContent = !first ? "Este imóvel não tem foto. Adicione uma para a arte ficar melhor."
      : photoOk ? "Prévia em tamanho reduzido. A imagem baixada sai em alta resolução." : "Não foi possível usar a foto deste imóvel. A arte saiu com fundo da marca.";
    $("#artCaption").value = caption(p, draw.settings);
    draw();
  }

  function close() {
    ui.$("#artDialog").hidden = true;
    document.body.classList.remove("no-scroll");
  }

  function init(ctx) {
    ui = ctx;
    const { $, $$ } = ui;
    $$("[data-art-close]").forEach((b) => b.addEventListener("click", close));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#artDialog").hidden) close(); });
    $$('input[name="artFormat"]').forEach((r) => r.addEventListener("change", () => { format = r.value; if (prop) draw(); }));
    $("#artCopy").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText($("#artCaption").value); ui.toast("Legenda copiada."); }
      catch { $("#artCaption").select(); }
    });
    $("#artDownload").addEventListener("click", () => {
      const c = $("#artCanvas");
      try {
        c.toBlob((blob) => {
          if (!blob) { ui.toast("Não foi possível gerar a imagem."); return; }
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = `vc-imoveis-cod-${prop.code}-${format}.png`;
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(a.href), 2000);
          ui.toast("Imagem baixada. É só postar com a legenda.");
        }, "image/png");
      } catch (ex) {
        console.error(ex);
        ui.toast("O navegador bloqueou a imagem por causa da foto. Tente outro imóvel ou recarregue a página.");
      }
    });
  }

  return { init, open };
})();
