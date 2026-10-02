/*
  Camada de dados compartilhada pelo site e pelo painel.
  - Com Supabase configurado (js/config.js): login real, banco de dados e armazenamento de fotos/vídeos.
  - Sem configuração: modo demonstração, com tudo guardado no navegador (IndexedDB).
*/
const Store = (() => {
  "use strict";

  const cfg = window.VC_CONFIG || {};
  const isLive = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  const sb = isLive ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;

  const BUCKET = "imoveis";
  const PUBLIC_STATUS = ["disponivel", "reservado"];
  const FIELDS = ["mode", "type", "neighborhood", "street", "price", "condo", "iptu", "area", "beds", "baths", "parking", "amenities", "description", "status"];
  const MAX_VIDEO_MB = 50;
  const DEMO_USER = { email: "demo@vcimoveis.com.br", password: "demo123" };

  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const pick = (obj) => Object.fromEntries(FIELDS.map((k) => [k, obj[k]]));

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
  const local = (() => {
    const mem = { properties: new Map(), media: new Map(), meta: new Map() };
    let dbp = null;
    const open = () => dbp || (dbp = new Promise((res) => {
      try {
        const req = indexedDB.open("vc-imoveis", 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          db.createObjectStore("properties", { keyPath: "id" });
          db.createObjectStore("media", { keyPath: "id" });
          db.createObjectStore("meta");
        };
        req.onsuccess = () => res(req.result);
        req.onerror = () => res(null);
      } catch { res(null); }
    }));
    const run = async (store, mode, fn) => {
      const db = await open();
      if (!db) return null;
      return new Promise((res, rej) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        t.oncomplete = () => res(req ? req.result : undefined);
        t.onerror = () => rej(t.error);
      });
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

  async function seedDemo() {
    if (await local.get("meta", "seeded")) return;
    const now = Date.now();
    let code = 0;
    for (const p of window.SEED_PROPERTIES || []) {
      code++;
      await local.put("properties", {
        ...pick(p),
        id: uid(),
        code,
        media: p.images.map((url) => ({ type: "image", url, path: null })),
        created_at: new Date(now - p.daysAgo * 864e5).toISOString(),
        updated_at: new Date(now - p.daysAgo * 864e5).toISOString(),
      });
    }
    await local.put("meta", true, "seeded");
  }

  const blobUrls = new Map();
  async function resolveSrc(url) {
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

  const byNewest = (a, b) => String(b.created_at).localeCompare(String(a.created_at));

  // ---------- Leitura ----------
  async function listPublic() {
    if (isLive) {
      const { data, error } = await sb.from("properties").select("*").in("status", PUBLIC_STATUS).order("created_at", { ascending: false });
      if (error) throw error;
      return data.map((p) => ({ ...p, media: (p.media || []).map((m) => ({ ...m, src: m.url })) }));
    }
    await seedDemo();
    const all = (await local.all("properties")).filter((p) => PUBLIC_STATUS.includes(p.status)).sort(byNewest);
    return Promise.all(all.map(resolve));
  }

  async function listAll() {
    if (isLive) {
      const { data, error } = await sb.from("properties").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data.map((p) => ({ ...p, media: (p.media || []).map((m) => ({ ...m, src: m.url })) }));
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
      if (error) throw error;
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

  // ---------- Escrita ----------
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

    const row = { ...pick(input), media };
    let saved;
    if (isLive) {
      const q = input.id
        ? sb.from("properties").update(row).eq("id", input.id).select().single()
        : sb.from("properties").insert(row).select().single();
      const { data, error } = await q;
      if (error) throw error;
      saved = data;
    } else {
      const now = new Date().toISOString();
      if (input.id) {
        const prev = await local.get("properties", input.id);
        saved = { ...prev, ...row, updated_at: now };
      } else {
        const all = await local.all("properties");
        saved = { ...row, id: uid(), code: Math.max(0, ...all.map((p) => p.code || 0)) + 1, created_at: now, updated_at: now };
      }
      await local.put("properties", saved);
    }
    await removeFiles(removedPaths);
    return resolve(saved);
  }

  async function setStatus(id, status) {
    if (isLive) {
      const { error } = await sb.from("properties").update({ status }).eq("id", id);
      if (error) throw error;
      return;
    }
    const prev = await local.get("properties", id);
    await local.put("properties", { ...prev, status, updated_at: new Date().toISOString() });
  }

  async function remove(prop) {
    if (isLive) {
      const { error } = await sb.from("properties").delete().eq("id", prop.id);
      if (error) throw error;
    } else {
      await local.del("properties", prop.id);
    }
    await removeFiles((prop.media || []).map((m) => m.path));
  }

  // ---------- Login ----------
  const auth = {
    async user() {
      if (isLive) {
        const { data } = await sb.auth.getSession();
        return data.session?.user ? { email: data.session.user.email } : null;
      }
      try { const e = sessionStorage.getItem("vc:demo-user"); return e ? { email: e } : null; } catch { return null; }
    },
    async signIn(email, password) {
      if (isLive) {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw new Error("E-mail ou senha incorretos.");
        const { data, error: e2 } = await sb.rpc("is_staff");
        if (e2 || !data) {
          await sb.auth.signOut();
          throw new Error("Este e-mail não está liberado para a equipe. Peça ao administrador para adicioná-lo.");
        }
        return { email };
      }
      if (email.trim().toLowerCase() !== DEMO_USER.email || password !== DEMO_USER.password) {
        throw new Error("E-mail ou senha incorretos.");
      }
      try { sessionStorage.setItem("vc:demo-user", DEMO_USER.email); } catch { /* sem storage */ }
      return { email: DEMO_USER.email };
    },
    async signOut() {
      if (isLive) await sb.auth.signOut();
      try { sessionStorage.removeItem("vc:demo-user"); } catch { /* sem storage */ }
    },
  };

  return { isLive, listPublic, listAll, save, setStatus, remove, auth, DEMO_USER, MAX_VIDEO_MB };
})();
