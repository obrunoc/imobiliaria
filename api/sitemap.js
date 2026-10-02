// /sitemap.xml → lista de páginas para o Google encontrar cada imóvel.
const { config, rest, esc, origin } = require("./_lib");

module.exports = async (req, res) => {
  const base = origin(req);
  const urls = [
    { loc: `${base}/`, priority: "1.0" },
    { loc: `${base}/privacidade.html`, priority: "0.2" },
  ];
  const cfg = config();
  if (cfg) {
    try {
      const rows = await rest(cfg, "properties?select=code,updated_at&status=in.(disponivel,reservado)&order=code.desc");
      rows.forEach((p) => urls.push({ loc: `${base}/imovel/${p.code}`, lastmod: String(p.updated_at).slice(0, 10), priority: "0.8" }));
    } catch { /* devolve só as páginas fixas */ }
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${esc(u.lastmod)}</lastmod>` : ""}<priority>${u.priority}</priority></url>`).join("\n")}
</urlset>
`;
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600");
  res.status(200).send(xml);
};
