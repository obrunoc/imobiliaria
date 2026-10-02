/*
  Camada de dados compartilhada pelo site e pelo painel.
  - Com Supabase configurado (js/config.js): login real, banco de dados e armazenamento de fotos/vídeos.
  - Sem configuração: modo demonstração, com tudo guardado no navegador (IndexedDB).

  Regras de privacidade:
  - Visitantes só ENVIAM pedidos (leads); ler, alterar e apagar é só da equipe logada.
  - Documentos (contratos, recibos, termos) não passam por aqui: são gerados no navegador.
  - Locações ativas guardam só dados básicos (sem CPF/RG).
*/
const Store = (() => {
  "use strict";

  const cfg = window.VC_CONFIG || {};
  const isLive = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  const sb = isLive ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;

  const BUCKET = "imoveis";
  const PUBLIC_STATUS = ["disponivel", "reservado"];
  const FIELDS = ["mode", "type", "neighborhood", "street", "price", "condo", "iptu", "area", "beds", "baths", "parking", "amenities", "description", "status", "featured", "old_price"];
  const LEAD_KINDS = ["visita", "contato", "anunciar", "alerta"];
  const RENTAL_FIELDS = ["property_id", "property_label", "tenant_name", "tenant_phone", "owner_name", "rent", "due_day", "index_name", "start_date", "months", "notes", "status"];
  const MAX_VIDEO_MB = 50;
  const DEMO_USERS = [
    { email: "demo@vcimoveis.com.br", password: "demo123", role: "admin" },
    { email: "corretor@vcimoveis.com.br", password: "demo123", role: "corretor" },
  ];

  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]));
  const clip = (s, n) => String(s ?? "").trim().slice(0, n);
  const nowIso = () => new Date().toISOString();
  const ss = {
    get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* sem storage */ } },
    del(k) { try { sessionStorage.removeItem(k); } catch { /* sem storage */ } },
  };

  // ---------- Imagens: reduz para no máx. 1600 px antes de enviar ----------
  async function compressImage(file, max = 1600, quality = 0.82) {
    if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bmp.width * scale);
      canvas.height = Math.round(bmp.height * scale);
      canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", quality));
      return blob && blob.size < file.size ? blob : file;
    } catch {
      return file;
    }
  }

  // ---------- IndexedDB (modo demonstração), com fallback em memória ----------
  const STORES = ["properties", "media", "leads", "rentals"];
  const local = (() => {
    const mem = { properties: new Map(), media: new Map(), leads: new Map(), rentals: new Map(), meta: new Map() };
    let dbp = null;
    // Alguns navegadores (Safari antigo, pré-visualizações, modo privativo) nunca respondem ao IndexedDB.
    // Se não responder a tempo, seguimos em memória para o site não ficar preso em "Carregando".
    const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);
    const open = () => dbp || (dbp = withTimeout(new Promise((res) => {
      try {
        const req = indexedDB.open("vc-imoveis", 2);
        req.onupgradeneeded = () => {
          const db = req.result;
          STORES.forEach((s) => { if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: "id" }); });
          if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
        };
        req.onsuccess = () => res(req.result);
        req.onerror = () => res(null);
        req.onblocked = () => res(null);
      } catch { res(null); }
    }), 3000));
    const run = async (store, mode, fn) => {
      const db = await open();
      if (!db) return null;
      return withTimeout(new Promise((res, rej) => {
        try {
          const t = db.transaction(store, mode);
          const req = fn(t.objectStore(store));
          t.oncomplete = () => res(req ? req.result : undefined);
          t.onerror = () => rej(t.error);
        } catch (ex) { rej(ex); }
      }), 4000);
    };
    return {
      async all(store) { const r = await run(store, "readonly", (s) => s.getAll()); return r ?? [...mem[store].values()]; },
      async get(store, key) { const db = await open(); return db ? run(store, "readonly", (s) => s.get(key)) : mem[store].get(key); },
      async put(store, val, key) {
        const db = await open();
        if (!db) { mem[store].set(key ?? val.id, val); return; }
        await run(store, "readwrite", (s) => (key === undefined ? s.put(val) : s.put(val, key)));
      },
      async del(store, key) { const db = await open(); if (!db) { mem[store].delete(key); return; } await run(store, "readwrite", (s) => s.delete(key)); },
    };
  })();

  let seeding = null;
  function seedDemo() {
    return seeding || (seeding = (async () => {
      if (await local.get("meta", "seeded")) return;
      const now = Date.now();
      let code = 0;
      for (const p of window.SEED_PROPERTIES || []) {
        code++;
        const when = new Date(now - p.daysAgo * 864e5).toISOString();
        await local.put("properties", {
          ...pick(p, FIELDS),
          featured: Boolean(p.featured),
          old_price: p.old_price || null,
          id: uid(),
          code,
          views: Math.round(20 + Math.random() * 180),
          media: p.images.map((url) => ({ type: "image", url, path: null })),
          created_at: when,
          updated_at: when,
        });
      }
      await local.put("meta", true, "seeded");
    })());
  }

  const blobUrls = new Map();
  async function resolveSrc(url) {
    if (!url) return "";
    if (!url.startsWith("idb:")) return url;
    if (blobUrls.has(url)) return blobUrls.get(url);
    const rec = await local.get("media", url.slice(4));
    const src = rec ? URL.createObjectURL(rec.blob) : "";
    blobUrls.set(url, src);
    return src;
  }

  async function resolve(p) {
    const media = await Promise.all((p.media || []).map(async (m) => ({ ...m, src: await resolveSrc(m.url) })));
    return { ...p, media };
  }
  const resolveLive = (p) => ({ ...p, media: (p.media || []).map((m) => ({ ...m, src: m.url })) });

  const byNewest = (a, b) => String(b.created_at).localeCompare(String(a.created_at));
  const fail = (error) => { if (error) throw error; };

  // ---------- Imóveis ----------
  async function listPublic() {
    if (isLive) {
      const { data, error } = await sb.from("properties").select("*").in("status", PUBLIC_STATUS).order("created_at", { ascending: false });
      fail(error);
      return data.map(resolveLive);
    }
    await seedDemo();
    const all = (await local.all("properties")).filter((p) => PUBLIC_STATUS.includes(p.status)).sort(byNewest);
    return Promise.all(all.map(resolve));
  }

  async function getPublicByCode(code) {
    code = Number(code);
    if (!code) return null;
    if (isLive) {
      const { data, error } = await sb.from("properties").select("*").eq("code", code).in("status", PUBLIC_STATUS).maybeSingle();
      fail(error);
      return data ? resolveLive(data) : null;
    }
    await seedDemo();
    const p = (await local.all("properties")).find((x) => x.code === code && PUBLIC_STATUS.includes(x.status));
    return p ? resolve(p) : null;
  }

  async function listAll() {
    if (isLive) {
      const { data, error } = await sb.from("properties").select("*").order("created_at", { ascending: false });
      fail(error);
      return data.map(resolveLive);
    }
    await seedDemo();
    return Promise.all((await local.all("properties")).sort(byNewest).map(resolve));
  }

  // ---------- Arquivos ----------
  async function uploadFile(folder, blob, name, type) {
    if (isLive) {
      const ext = blob.type === "image/jpeg" ? "jpg" : (name.split(".").pop() || "bin").toLowerCase();
      const path = `${folder}/${uid()}.${ext}`;
      const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || undefined, upsert: false });
      fail(error);
      return { type, url: sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl, path };
    }
    const id = uid();
    await local.put("media", { id, blob });
    return { type, url: `idb:${id}`, path: `idb:${id}` };
  }

  async function removeFiles(paths) {
    const list = paths.filter(Boolean);
    if (!list.length) return;
    if (isLive) {
      const remote = list.filter((p) => !p.startsWith("idb:"));
      if (remote.length) await sb.storage.from(BUCKET).remove(remote);
      return;
    }
    for (const p of list) if (p.startsWith("idb:")) await local.del("media", p.slice(4));
  }

  /** Envia uma foto avulsa (ex.: foto da equipe) e devolve {url, path, src}. */
  async function uploadImage(folder, file) {
    const blob = await compressImage(file, 800);
    const up = await uploadFile(folder, blob, file.name, "image");
    return { ...up, src: await resolveSrc(up.url) };
  }

  /**
   * Salva um imóvel.
   * mediaItems: lista na ordem final; itens existentes {type, url, path} e novos {type, file}.
   * removedPaths: arquivos que saíram da lista e devem ser apagados.
   */
  async function save(input, mediaItems, removedPaths = [], onProgress) {
    const pending = mediaItems.filter((m) => m.file);
    const tooBig = pending.find((m) => m.type === "video" && m.file.size > MAX_VIDEO_MB * 1024 * 1024);
    if (tooBig) throw new Error(`O vídeo "${tooBig.file.name}" passa de ${MAX_VIDEO_MB} MB. Envie uma versão menor.`);

    const folder = input.id || uid();
    const media = [];
    let done = 0;
    onProgress?.(0, pending.length);
    for (const m of mediaItems) {
      if (!m.file) { media.push({ type: m.type, url: m.url, path: m.path || null }); continue; }
      const blob = m.type === "image" ? await compressImage(m.file) : m.file;
      media.push(await uploadFile(folder, blob, m.file.name, m.type));
      onProgress?.(++done, pending.length);
    }

    const row = { ...pick(input, FIELDS), media };
    let saved;
    if (isLive) {
      const q = input.id
        ? sb.from("properties").update(row).eq("id", input.id).select().single()
        : sb.from("properties").insert(row).select().single();
      const { data, error } = await q;
      fail(error);
      saved = data;
    } else {
      if (input.id) {
        const prev = await local.get("properties", input.id);
        saved = { ...prev, ...row, updated_at: nowIso() };
      } else {
        const all = await local.all("properties");
        saved = { ...row, id: uid(), views: 0, code: Math.max(0, ...all.map((p) => p.code || 0)) + 1, created_at: nowIso(), updated_at: nowIso() };
      }
      await local.put("properties", saved);
    }
    await removeFiles(removedPaths);
    return isLive ? resolveLive(saved) : resolve(saved);
  }

  async function patchProperty(id, patch) {
    if (isLive) {
      const { error } = await sb.from("properties").update(patch).eq("id", id);
      fail(error);
      return;
    }
    const prev = await local.get("properties", id);
    await local.put("properties", { ...prev, ...patch, updated_at: nowIso() });
  }
  const setStatus = (id, status) => patchProperty(id, { status });

  async function remove(prop) {
    if (isLive) {
      const { error } = await sb.from("properties").delete().eq("id", prop.id);
      fail(error);
    } else {
      await local.del("properties", prop.id);
    }
    await removeFiles((prop.media || []).map((m) => m.path));
  }

  /** Conta uma visualização (no máximo uma por imóvel por sessão do visitante). */
  async function addView(id) {
    const key = `vc:viewed:${id}`;
    if (ss.get(key)) return;
    ss.set(key, "1");
    try {
      if (isLive) { await sb.rpc("increment_view", { p_id: id }); return; }
      const prev = await local.get("properties", id);
      if (prev) await local.put("properties", { ...prev, views: (prev.views || 0) + 1 });
    } catch { /* contagem é opcional */ }
  }

  // ---------- Pedidos de clientes (leads) ----------
  /** Usado pelo site. O visitante só envia; não consegue ler nada de volta. */
  async function createLead(input) {
    if (!LEAD_KINDS.includes(input.kind)) throw new Error("Tipo de pedido inválido.");
    if (!input.consent) throw new Error("É preciso aceitar a Política de Privacidade.");
    const row = {
      kind: input.kind,
      property_id: input.property_id || null,
      property_code: input.property_code || null,
      name: clip(input.name, 120),
      phone: clip(input.phone, 30),
      message: clip(input.message, 1500),
      visit_date: input.visit_date || null,
      visit_time: input.visit_time ? clip(input.visit_time, 10) : null,
      criteria: input.criteria || null,
      consent: true,
    };
    if (row.name.length < 2) throw new Error("Informe seu nome.");
    if (row.phone.replace(/\D/g, "").length < 10) throw new Error("Informe um telefone com DDD.");
    if (isLive) {
      const { error } = await sb.from("leads").insert(row);
      fail(error);
      return;
    }
    await local.put("leads", { ...row, id: uid(), created_at: nowIso(), status: "novo", notes: "" });
  }

  async function listLeads() {
    if (isLive) {
      const { data, error } = await sb.from("leads").select("*").order("created_at", { ascending: false });
      fail(error);
      return data;
    }
    return (await local.all("leads")).sort(byNewest);
  }

  async function updateLead(id, patch) {
    const row = pick(patch, ["status", "notes"]);
    if (isLive) { const { error } = await sb.from("leads").update(row).eq("id", id); fail(error); return; }
    const prev = await local.get("leads", id);
    await local.put("leads", { ...prev, ...row });
  }

  async function deleteLead(id) {
    if (isLive) { const { error } = await sb.from("leads").delete().eq("id", id); fail(error); return; }
    await local.del("leads", id);
  }

  /** Um pedido "me avise" combina com um imóvel? */
  function matches(criteria, p) {
    if (!criteria || !PUBLIC_STATUS.includes(p.status)) return false;
    const c = criteria;
    const total = p.mode === "alugar" ? Number(p.price) + Number(p.condo || 0) + Number(p.iptu || 0) : Number(p.price);
    return (!c.mode || c.mode === p.mode)
      && (!c.type || c.type === p.type)
      && (!c.neighborhood || c.neighborhood === p.neighborhood)
      && (!c.beds || p.beds >= Number(c.beds))
      && (!c.priceMax || total <= Number(c.priceMax));
  }

  // ---------- Locações ativas ----------
  async function listRentals() {
    if (isLive) {
      const { data, error } = await sb.from("rentals").select("*").order("start_date", { ascending: false });
      fail(error);
      return data;
    }
    return (await local.all("rentals")).sort((a, b) => String(b.start_date).localeCompare(String(a.start_date)));
  }

  async function saveRental(input) {
    const row = pick(input, RENTAL_FIELDS);
    row.property_id = row.property_id || null;
    if (isLive) {
      const q = input.id
        ? sb.from("rentals").update(row).eq("id", input.id).select().single()
        : sb.from("rentals").insert(row).select().single();
      const { data, error } = await q;
      fail(error);
      return data;
    }
    const prev = input.id ? await local.get("rentals", input.id) : null;
    const saved = prev ? { ...prev, ...row, updated_at: nowIso() } : { ...row, id: uid(), created_at: nowIso(), updated_at: nowIso() };
    await local.put("rentals", saved);
    return saved;
  }

  async function deleteRental(id) {
    if (isLive) { const { error } = await sb.from("rentals").delete().eq("id", id); fail(error); return; }
    await local.del("rentals", id);
  }

  // ---------- Dados do site (contatos, Quem somos, equipe, depoimentos) ----------
  async function getSettings() {
    let data = {};
    try {
      if (isLive) {
        const r = await sb.from("settings").select("data").eq("id", 1).maybeSingle();
        data = r.data?.data || {};
      } else {
        data = (await local.get("meta", "settings")) || {};
      }
    } catch { data = {}; }
    const s = { ...(window.DEFAULT_SETTINGS || {}), ...data };
    s.team = await Promise.all((s.team || []).map(async (m) => ({ ...m, photoSrc: await resolveSrc(m.photo?.url) })));
    return s;
  }

  async function saveSettings(input, removedPaths = []) {
    const data = { ...input, team: (input.team || []).map(({ photoSrc, ...m }) => m) };
    if (isLive) {
      const { error } = await sb.from("settings").upsert({ id: 1, data, updated_at: nowIso() });
      fail(error);
    } else {
      await local.put("meta", data, "settings");
    }
    await removeFiles(removedPaths);
  }

  // ---------- Login ----------
  const auth = {
    async user() {
      if (isLive) {
        const { data } = await sb.auth.getSession();
        const u = data.session?.user;
        if (!u) return null;
        const { data: role } = await sb.rpc("my_role");
        return role ? { email: u.email, role } : null;
      }
      const email = ss.get("vc:demo-user");
      const u = DEMO_USERS.find((x) => x.email === email);
      return u ? { email: u.email, role: u.role } : null;
    },
    async signIn(email, password) {
      email = email.trim().toLowerCase();
      if (isLive) {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw new Error("E-mail ou senha incorretos.");
        const { data: role, error: e2 } = await sb.rpc("my_role");
        if (e2 || !role) {
          await sb.auth.signOut();
          throw new Error("Este e-mail não está liberado para a equipe. Peça ao administrador para adicioná-lo.");
        }
        return { email, role };
      }
      const u = DEMO_USERS.find((x) => x.email === email && x.password === password);
      if (!u) throw new Error("E-mail ou senha incorretos.");
      ss.set("vc:demo-user", u.email);
      return { email: u.email, role: u.role };
    },
    async signOut() {
      if (isLive) await sb.auth.signOut();
      ss.del("vc:demo-user");
    },
  };

  return {
    isLive, PUBLIC_STATUS, MAX_VIDEO_MB, DEMO_USERS,
    listPublic, getPublicByCode, listAll, save, setStatus, patchProperty, remove, addView, uploadImage,
    createLead, listLeads, updateLead, deleteLead, matches,
    listRentals, saveRental, deleteRental,
    getSettings, saveSettings,
    auth,
  };
})();
