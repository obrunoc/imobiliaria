// /imovel/:code → página do imóvel com título, descrição e foto para a prévia do WhatsApp/Facebook/Google.
const { readFile, config, rest, esc, brl, origin } = require("./_lib");

module.exports = async (req, res) => {
  const code = parseInt(req.query.code, 10);
  const base = origin(req);
  let html = readFile("imovel.html");
  const cfg = config();

  let p = null;
  if (cfg && code > 0) {
    try {
      const rows = await rest(cfg, `properties?select=code,mode,type,neighborhood,price,area,beds,description,media,status&code=eq.${code}&status=in.(disponivel,reservado)&limit=1`);
      p = rows[0] || null;
    } catch { p = null; }
  }

  if (p) {
    const rent = p.mode === "alugar";
    const title = `${p.type} ${rent ? "para alugar" : "à venda"} · ${p.neighborhood} · ${brl(p.price)}${rent ? "/mês" : ""}`;
    const specs = [p.area && `${p.area} m²`, p.beds && `${p.beds} quarto${p.beds > 1 ? "s" : ""}`].filter(Boolean).join(" · ");
    const desc = [specs, String(p.description || "").slice(0, 160)].filter(Boolean).join(". ");
    const img = (p.media || []).find((m) => m.type === "image");
    const url = `${base}/imovel/${p.code}`;
    const ld = {
      "@context": "https://schema.org",
      "@type": "RealEstateListing",
      name: title,
      url,
      description: desc,
      image: img ? img.url : undefined,
      offers: { "@type": "Offer", price: Number(p.price), priceCurrency: "BRL" },
    };
    const og = `<meta name="description" content="${esc(desc)}" />
  <link rel="canonical" href="${esc(url)}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="VC Imóveis" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:url" content="${esc(url)}" />
  <meta property="og:image" content="${esc(img ? img.url : `${base}/img/og-image.png`)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`;
    html = html
      .replace(/<!--OG:START-->[\s\S]*?<!--OG:END-->/, og)
      .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)} · VC Imóveis</title>`);
  } else {
    html = html.replace('content="/img/og-image.png"', `content="${base}/img/og-image.png"`);
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
  res.status(200).send(html);
};
