// Utilitários das funções da Vercel (arquivos com "_" não viram rota).
const fs = require("fs");
const path = require("path");

const readFile = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

/** Lê as chaves do Supabase das variáveis de ambiente da Vercel ou, se não houver, de js/config.js. */
function config() {
  let url = process.env.SUPABASE_URL;
  let key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    try {
      const src = readFile("js/config.js");
      url = url || (src.match(/supabaseUrl:\s*"([^"]*)"/) || [])[1];
      key = key || (src.match(/supabaseAnonKey:\s*"([^"]*)"/) || [])[1];
    } catch { /* sem config */ }
  }
  return url && key ? { url: url.replace(/\/$/, ""), key } : null;
}

/** Consulta a API do Supabase com a chave pública (respeita as regras de acesso do banco). */
async function rest(cfg, query) {
  const r = await fetch(`${cfg.url}/rest/v1/${query}`, {
    headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
  });
  if (!r.ok) throw new Error(`Supabase respondeu ${r.status}`);
  return r.json();
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const brl = (n) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function origin(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host || "vc-imoveis.vercel.app";
  const proto = req.headers["x-forwarded-proto"] || "https";
  return `${proto}://${host}`;
}

async function settings(cfg) {
  try {
    const rows = await rest(cfg, "settings?select=data&id=eq.1");
    return rows[0]?.data || {};
  } catch {
    return {};
  }
}

module.exports = { readFile, config, rest, esc, brl, origin, settings };
