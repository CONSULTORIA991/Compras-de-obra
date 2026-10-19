/*
 * Capa de datos. Dos implementaciones con la misma interfaz:
 *  - LocalStore: modo demostración (localStorage del navegador)
 *  - SupaStore:  producción (Supabase: login seguro + base de datos Postgres)
 */
(function () {
  'use strict';
  const cfg = window.APP_CONFIG || {};
  const newId = () => (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  window.newId = newId;
  const clone = o => JSON.parse(JSON.stringify(o));

  async function hash(s) {
    try {
      const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
      return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return 'x' + h;
    }
  }

  /* ---------------------------------------------------------- DEMO */
  function LocalStore() {
    const KEY = 'compras_req_demo_v1', SKEY = 'compras_req_demo_sesion';
    let db = null, meId = null;
    const persist = () => {
      try { localStorage.setItem(KEY, JSON.stringify(db)); }
      catch (e) { throw new Error('No se pudo guardar en este navegador (¿almacenamiento lleno?).'); }
    };
    const load = () => {
      try { db = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { db = null; }
      if (!db) { db = window.buildSeed(newId); try { persist(); } catch (e) { /* sin almacenamiento: solo memoria */ } }
    };
    const pub = u => { const { pass, passHash, ...rest } = u; return clone(rest); };

    return {
      mode: 'demo',
      async init() {
        load();
        try { meId = sessionStorage.getItem(SKEY); } catch (e) { meId = null; }
        const u = db.perfiles.find(p => p.id === meId && p.activo !== false);
        return u ? pub(u) : null;
      },
      async login(email, pass) {
        load();
        const u = db.perfiles.find(p => p.email.toLowerCase() === String(email).trim().toLowerCase());
        const ok = u && (u.passHash ? u.passHash === await hash(pass) : u.pass === pass);
        if (!ok) throw new Error('Usuario o contraseña incorrectos');
        if (u.activo === false) throw new Error('Usuario inactivo. Hable con el administrador.');
        meId = u.id; try { sessionStorage.setItem(SKEY, u.id); } catch (e) { }
        return pub(u);
      },
      async logout() { meId = null; try { sessionStorage.removeItem(SKEY); } catch (e) { } },
      async changePassword(p) {
        load(); const u = db.perfiles.find(x => x.id === meId);
        u.passHash = await hash(p); delete u.pass; persist();
      },
      async loadAll() {
        load();
        return {
          reqs: clone(db.reqs).sort((a, b) => b.numero - a.numero),
          proyectos: clone(db.proyectos), proveedores: clone(db.proveedores),
          perfiles: db.perfiles.map(pub)
        };
      },
      async getReq(id) { load(); const r = db.reqs.find(x => x.id === id); return r ? clone(r) : null; },
      async createReq(req) {
        load(); db.seq = (db.seq || 0) + 1;
        const r = clone(req); r.numero = db.seq; r._v = 1; db.reqs.push(r); persist(); return clone(r);
      },
      async saveReq(req) {
        load(); const i = db.reqs.findIndex(x => x.id === req.id);
        if (i < 0) throw new Error('La solicitud no existe');
        if (db.reqs[i]._v !== req._v) throw new Error('CONFLICT');
        const r = clone(req); r._v = req._v + 1; db.reqs[i] = r; persist(); return clone(r);
      },
      async upsert(table, obj) {
        load(); const arr = db[table]; const o = clone(obj); if (!o.id) o.id = newId();
        let i = arr.findIndex(x => x.id === o.id);
        if (i >= 0) arr[i] = { ...arr[i], ...o }; else { arr.push(o); i = arr.length - 1; }
        persist(); return table === 'perfiles' ? pub(arr[i]) : clone(arr[i]);
      },
      async createUser({ nombre, email, password, roles }) {
        load();
        if (db.perfiles.some(p => p.email.toLowerCase() === email.toLowerCase())) throw new Error('Ya existe un usuario con ese correo');
        const u = { id: newId(), nombre, email, roles, activo: true, passHash: await hash(password) };
        db.perfiles.push(u); persist(); return pub(u);
      },
      async uploadFile(file) {
        if (file.size > 1.5e6) throw new Error('En modo demostración los archivos deben pesar menos de 1,5 MB');
        const url = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file); });
        load(); const id = newId(); db.files = db.files || {}; db.files[id] = url; persist();
        return { nombre: file.name, path: id };
      },
      async fileUrl(path) { load(); return (db.files || {})[path] || null; },
      async notify(list) {
        load(); db.notifs = db.notifs || [];
        for (const n of list) db.notifs.push({ id: newId(), leida: false, creado: new Date().toISOString(), ...n });
        persist();
      },
      async myNotifs() {
        load();
        return clone((db.notifs || []).filter(n => n.user_id === meId)
          .sort((a, b) => b.creado.localeCompare(a.creado)).slice(0, 50));
      },
      async markRead(ids) { load(); (db.notifs || []).forEach(n => { if (ids.includes(n.id)) n.leida = true; }); persist(); },
      reset() { try { localStorage.removeItem(KEY); } catch (e) { } }
    };
  }

  /* ---------------------------------------------------- SUPABASE */
  function SupaStore() {
    if (!window.supabase) throw new Error('No se pudo cargar la librería de Supabase (revise su conexión a internet).');
    const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    let me = null;
    const chk = r => { if (r.error) throw new Error(r.error.message); return r.data; };
    const fromRow = row => ({ ...row.data, id: row.id, numero: row.numero, _v: row.version });
    const strip = req => { const { numero, _v, ...d } = req; return d; };
    async function profile(user) {
      const p = chk(await sb.from('perfiles').select('*').eq('id', user.id).single());
      if (p.activo === false) { await sb.auth.signOut(); throw new Error('Usuario inactivo. Hable con el administrador.'); }
      return p;
    }
    return {
      mode: 'supabase',
      async init() {
        const { data } = await sb.auth.getSession();
        if (data.session) { try { me = await profile(data.session.user); } catch (e) { me = null; } }
        return me;
      },
      async login(email, pass) {
        const { data, error } = await sb.auth.signInWithPassword({ email: String(email).trim(), password: pass });
        if (error) throw new Error('Usuario o contraseña incorrectos');
        me = await profile(data.user); return me;
      },
      async logout() { await sb.auth.signOut(); me = null; },
      async changePassword(p) { const { error } = await sb.auth.updateUser({ password: p }); if (error) throw new Error(error.message); },
      async loadAll() {
        const [r, p, v, u] = await Promise.all([
          sb.from('requisiciones').select('*').order('numero', { ascending: false }),
          sb.from('proyectos').select('*').order('nombre'),
          sb.from('proveedores').select('*').order('nombre'),
          sb.from('perfiles').select('id,nombre,email,roles,activo').order('nombre')
        ]);
        return { reqs: chk(r).map(fromRow), proyectos: chk(p), proveedores: chk(v), perfiles: chk(u) };
      },
      async getReq(id) { const d = chk(await sb.from('requisiciones').select('*').eq('id', id).single()); return fromRow(d); },
      async createReq(req) { return fromRow(chk(await sb.from('requisiciones').insert({ id: req.id, data: strip(req) }).select().single())); },
      async saveReq(req) {
        const d = chk(await sb.from('requisiciones')
          .update({ data: strip(req), version: req._v + 1, actualizado: new Date().toISOString() })
          .eq('id', req.id).eq('version', req._v).select());
        if (!d.length) throw new Error('CONFLICT');
        return fromRow(d[0]);
      },
      async upsert(table, obj) {
        if (table === 'perfiles') {
          const { id, ...rest } = obj;
          return chk(await sb.from('perfiles').update(rest).eq('id', id).select().single());
        }
        return chk(await sb.from(table).upsert(obj).select().single());
      },
      async createUser({ nombre, email, password, roles }) {
        // Cliente temporal: crea la cuenta sin cerrar la sesión del administrador
        const tmp = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY,
          { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'tmp-alta-usuario' } });
        const { data, error } = await tmp.auth.signUp({ email, password, options: { data: { nombre } } });
        if (error) throw new Error(error.message);
        if (!data.user || (data.user.identities && data.user.identities.length === 0)) throw new Error('Ya existe un usuario con ese correo');
        return chk(await sb.from('perfiles').update({ nombre, roles, activo: true }).eq('id', data.user.id).select().single());
      },
      async uploadFile(file, folder) {
        if (file.size > 10e6) throw new Error('El archivo debe pesar menos de 10 MB');
        const path = `${folder || 'general'}/${newId()}-${file.name.replace(/[^\w.\-]/g, '_')}`;
        chk(await sb.storage.from('adjuntos').upload(path, file));
        return { nombre: file.name, path };
      },
      async fileUrl(path) { return chk(await sb.storage.from('adjuntos').createSignedUrl(path, 3600)).signedUrl; },
      async notify(list) { if (list.length) chk(await sb.from('notificaciones').insert(list)); },
      async myNotifs() {
        if (!me) return [];
        return chk(await sb.from('notificaciones').select('*').eq('user_id', me.id).order('creado', { ascending: false }).limit(50));
      },
      async markRead(ids) { if (ids.length) chk(await sb.from('notificaciones').update({ leida: true }).in('id', ids)); },
      reset() { }
    };
  }

  window.createStore = () => (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY) ? SupaStore() : LocalStore();
})();
