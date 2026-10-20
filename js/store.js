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
        load();
        const ya = req.radicado && db.reqs.find(x => x.radicado === req.radicado);
        if (ya) return clone(ya);
        db.seq = (db.seq || 0) + 1;
        const r = clone(req); r.numero = db.seq; r._v = 1; db.reqs.push(r); persist(); return clone(r);
      },
      // --- enlace público de solicitudes (en demostración vive en este navegador)
      buzonInfo() { return db && db.buzon ? { repo: 'demostración (este navegador)' } : null; },
      async activarBuzon() { load(); db.buzon = { activo: true }; persist(); },
      async publicarConfigSolicitud(proyectos) {
        if (!db || !db.buzon) return;
        try { localStorage.setItem('compras_solcfg_demo', JSON.stringify({ v: 1, demo: true, proyectos })); } catch (e) { }
      },
      async leerBuzon() {
        let l = []; try { l = JSON.parse(localStorage.getItem('compras_buzon_demo') || '[]'); } catch (e) { }
        return l.map(d => ({ ref: d.radicado, datos: d }));
      },
      async cerrarEnvio(ref) {
        try { const l = JSON.parse(localStorage.getItem('compras_buzon_demo') || '[]').filter(d => d.radicado !== ref); localStorage.setItem('compras_buzon_demo', JSON.stringify(l)); } catch (e) { }
      },
      async publicarEstado(cedula, obj) {
        const id = await Sobre.idEstado(cedula);
        let m = {}; try { m = JSON.parse(localStorage.getItem('compras_estado_demo') || '{}'); } catch (e) { }
        m[id] = JSON.stringify({ v: 1, d: Sobre.b64(await Sobre.cifrarEstado(cedula, obj)) });
        try { localStorage.setItem('compras_estado_demo', JSON.stringify(m)); } catch (e) { }
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
      async getClaudeKey() { load(); return db.claudeKey || null; },
      async setClaudeKey(k) { load(); if (k) db.claudeKey = k; else delete db.claudeKey; persist(); },
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
      async getClaudeKey() { return null; },
      async setClaudeKey() { throw new Error('La lectura con Claude no está disponible en el modo Supabase.'); },
      buzonInfo() { return null; },
      async activarBuzon() { throw new Error('El enlace público de solicitudes no está disponible en el modo Supabase.'); },
      async publicarConfigSolicitud() { }, async leerBuzon() { return []; }, async cerrarEnvio() { }, async publicarEstado() { },
      reset() { }
    };
  }

  /* ------------------------------------------- GITHUB (cifrado) */
  /*
   * Igual que la app de PAGOS: los datos viven CIFRADOS en el mismo repositorio.
   *   datos/usuarios.json   llave maestra envuelta con la contraseña de cada usuario
   *   datos/config.enc      token de GitHub, usuarios y roles (cifrado)
   *   datos/compras.enc     solicitudes, cotizaciones, pagos, proyectos, proveedores (cifrado)
   *   datos/archivos/*      cotizaciones y soportes de pago (cifrados)
   * Cifrado AES-256-GCM; contraseñas con PBKDF2-SHA256 de 600.000 iteraciones.
   */
  function GitHubStore() {
    const enc = new TextEncoder(), dec = new TextDecoder(), ITER = 600000;
    const R_USU = 'datos/usuarios.json', R_CONF = 'datos/config.enc', R_DATA = 'datos/compras.enc';
    const rArch = n => 'datos/archivos/' + n;
    const SES = 'compras-obra-sesion';
    const API = 'https://api.github.com';
    let gh = { owner: '', repo: '', branch: cfg.GITHUB_RAMA || 'main', token: '' };
    let maestra = null, rawM = null, uid = null, conf = null, confEtag = null, cache = null, etag = null, api_buzon = null;

    // --- cifrado
    const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
    const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
    const aleatorio = n => crypto.getRandomValues(new Uint8Array(n));
    async function idUsuario(u) {
      const h = await crypto.subtle.digest('SHA-256', enc.encode('compras-obra:' + String(u).trim().toLowerCase()));
      return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
    }
    async function llaveDeClave(clave, salt, iter) {
      const base = await crypto.subtle.importKey('raw', enc.encode(clave), 'PBKDF2', false, ['deriveKey']);
      return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter || ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    }
    const importar = raw => crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    async function cifrar(llave, bytes) {
      const iv = aleatorio(12);
      const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, llave, bytes));
      const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12); return out;
    }
    const descifrar = async (llave, d) => new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: d.subarray(0, 12) }, llave, d.subarray(12)));
    async function envolver(raw, clave) { const salt = aleatorio(16); return { salt: b64(salt), iter: ITER, llave: b64(await cifrar(await llaveDeClave(clave, salt, ITER), raw)) }; }
    const desenvolver = async (e, clave) => descifrar(await llaveDeClave(clave, unb64(e.salt), e.iter), unb64(e.llave));
    const cifrarJSON = (k, o) => cifrar(k, enc.encode(JSON.stringify(o)));
    const descifrarJSON = async (k, d) => JSON.parse(dec.decode(await descifrar(k, d)));

    // --- API de GitHub
    function desdeUbicacion() {
      if (cfg.GITHUB_OWNER && cfg.GITHUB_REPO) return { owner: cfg.GITHUB_OWNER, repo: cfg.GITHUB_REPO };
      const host = location.hostname.toLowerCase();
      if (!host.endsWith('.github.io')) return null;
      const owner = host.slice(0, -'.github.io'.length);
      const seg = location.pathname.split('/').filter(Boolean)[0];
      return { owner, repo: seg && !/\.html?$/i.test(seg) ? seg : owner + '.github.io' };
    }
    const cab = extra => Object.assign({ Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, gh.token ? { Authorization: 'Bearer ' + gh.token } : {}, extra || {});
    const url = ruta => `${API}/repos/${gh.owner}/${gh.repo}/contents/${ruta.split('/').map(encodeURIComponent).join('/')}`;
    async function fallo(r) {
      let m = ''; try { m = (await r.json()).message || ''; } catch (e) { }
      const err = new Error(
        r.status === 401 ? 'El token de GitHub no es válido o venció. El administrador debe actualizarlo en Admin → Datos.' :
        r.status === 403 && /rate limit/i.test(m) ? 'GitHub limitó temporalmente las consultas. Espere unos minutos e intente de nuevo.' :
        r.status === 403 ? 'El token de GitHub no tiene permiso de escritura en este repositorio.' :
        r.status === 404 ? 'No se encontró el repositorio o el token no tiene acceso a él.' :
        'GitHub respondió con un error (' + r.status + (m ? ': ' + m : '') + ').');
      err.status = r.status; err.conflicto = r.status === 409 || (r.status === 422 && /sha/i.test(m));
      return err;
    }
    async function leer(ruta, op) {
      op = op || {};
      const r = await fetch(url(ruta) + '?ref=' + encodeURIComponent(gh.branch), { headers: cab(op.etag ? { 'If-None-Match': op.etag } : null), cache: 'no-store' });
      if (r.status === 304) return { sinCambios: true };
      if (r.status === 404) return null;
      if (!r.ok) throw await fallo(r);
      const j = await r.json();
      const rb = await fetch(`${API}/repos/${gh.owner}/${gh.repo}/git/blobs/${j.sha}`, { headers: cab(), cache: 'no-store' });
      if (!rb.ok) throw await fallo(rb);
      return { sha: j.sha, bytes: unb64(((await rb.json()).content || '').replace(/\s/g, '')), etag: r.headers.get('ETag') };
    }
    async function leerPublico(ruta) {
      try { return await leer(ruta); }
      catch (e) {
        const r = await fetch(ruta + '?t=' + Date.now(), { cache: 'no-store' });
        if (r.status === 404) return null;
        if (!r.ok) throw e;
        return { sha: null, bytes: new Uint8Array(await r.arrayBuffer()) };
      }
    }
    async function escribir(ruta, bytes, sha) {
      const cuerpo = { message: 'Actualización', content: b64(bytes), branch: gh.branch };
      if (sha) cuerpo.sha = sha;
      const r = await fetch(url(ruta), { method: 'PUT', headers: cab({ 'Content-Type': 'application/json' }), body: JSON.stringify(cuerpo) });
      if (!r.ok) throw await fallo(r);
      return (await r.json()).content.sha;
    }
    async function verificar() {
      const r = await fetch(`${API}/repos/${gh.owner}/${gh.repo}`, { headers: cab(), cache: 'no-store' });
      if (!r.ok) throw await fallo(r);
      const j = await r.json();
      if (j.permissions && j.permissions.push === false) throw new Error('El token no tiene permiso de escritura (Contents: Read and write).');
    }
    const espera = () => new Promise(ok => setTimeout(ok, 400 + Math.random() * 700));

    // Lee la versión más reciente de un archivo, aplica el cambio y guarda; si otra persona guardó al mismo tiempo, reintenta.
    async function mutarArchivo(ruta, abrir, cerrar, fn) {
      for (let i = 0; i < 6; i++) {
        const r = await leer(ruta);
        const d = await abrir(r);
        const res = await fn(d);
        if (res === false) return { d, res };
        try { await escribir(ruta, await cerrar(d), r && r.sha); return { d, res }; }
        catch (e) { if (e.conflicto) { await espera(); continue; } throw e; }
      }
      throw new Error('Varias personas guardaron al mismo tiempo. Intente de nuevo.');
    }
    const vacio = () => ({ v: 1, seq: 0, reqs: [], proyectos: [], proveedores: [], notifs: [] });
    async function mutarDatos(fn) {
      const { d, res } = await mutarArchivo(R_DATA, async r => r ? descifrarJSON(maestra, r.bytes) : vacio(), d => cifrarJSON(maestra, d), fn);
      cache = d; etag = null; return res;
    }
    async function mutarConf(fn) {
      const { d } = await mutarArchivo(R_CONF, async r => descifrarJSON(maestra, r.bytes), d => cifrarJSON(maestra, d), fn);
      conf = d; confEtag = null;
    }
    const mutarUsuarios = fn => mutarArchivo(R_USU, async r => r ? JSON.parse(dec.decode(r.bytes)) : { v: 1, usuarios: {} },
      async d => enc.encode(JSON.stringify(d, null, 1)), fn);

    async function datos(fresco) {
      const r = await leer(R_DATA, fresco ? null : { etag });
      if (r && r.sinCambios && cache) return cache;
      cache = r && !r.sinCambios ? await descifrarJSON(maestra, r.bytes) : vacio();
      etag = r && !r.sinCambios ? r.etag : null;
      return cache;
    }
    async function refrescarConf() {
      const r = await leer(R_CONF, { etag: confEtag });
      if (r && !r.sinCambios) { conf = await descifrarJSON(maestra, r.bytes); confEtag = r.etag; gh.token = conf.token; }
      const yo = conf.perfiles[uid];
      if (!yo || yo.activo === false) { this_logout(); throw new Error('Su acceso fue retirado. Hable con el administrador.'); }
    }
    const perfilPub = (id, p) => ({ id, nombre: p.nombre, email: p.usuario, roles: p.roles || [], activo: p.activo !== false });
    const perfiles = () => Object.entries(conf.perfiles || {}).map(([id, p]) => perfilPub(id, p)).sort((a, b) => String(a.nombre).localeCompare(b.nombre));
    function guardarSesion(recordar) {
      const s = JSON.stringify({ owner: gh.owner, repo: gh.repo, branch: gh.branch, uid, raw: b64(rawM) });
      try { sessionStorage.setItem(SES, s); } catch (e) { }
      try { if (recordar) localStorage.setItem(SES, s); else localStorage.removeItem(SES); } catch (e) { }
    }
    function this_logout() {
      try { sessionStorage.removeItem(SES); } catch (e) { }
      try { localStorage.removeItem(SES); } catch (e) { }
      maestra = rawM = uid = conf = cache = etag = confEtag = null; gh.token = '';
    }
    async function abrirSesion(raw, id) {
      rawM = raw; maestra = await importar(raw);
      const cf = await leerPublico(R_CONF);
      if (!cf) throw new Error('La aplicación no está activada.');
      conf = await descifrarJSON(maestra, cf.bytes);
      const yo = conf.perfiles && conf.perfiles[id];
      if (!yo || yo.activo === false) throw new Error('Su acceso fue retirado. Hable con el administrador.');
      uid = id; gh.token = conf.token;
      return perfilPub(id, yo);
    }
    const MIME = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', heic: 'image/heic' };

    const api = {
      mode: 'github',
      needsSetup: false,
      repoInfo: () => ({ owner: gh.owner, repo: gh.repo }),
      async init() {
        if (!(window.crypto && crypto.subtle)) throw new Error('Este navegador no permite el cifrado necesario. Abra la página desde la dirección https:// publicada.');
        const ub = desdeUbicacion();
        if (ub) Object.assign(gh, ub);
        let s = null;
        try { s = JSON.parse(sessionStorage.getItem(SES) || localStorage.getItem(SES) || 'null'); } catch (e) { }
        if (s && s.raw) {
          Object.assign(gh, { owner: s.owner, repo: s.repo, branch: s.branch || gh.branch });
          try { return await abrirSesion(unb64(s.raw), s.uid); }
          catch (e) { if (e.name === 'OperationError' || /retirado/.test(e.message)) this_logout(); }
        }
        if (!gh.owner) throw new Error('No se pudo identificar el repositorio. Configure GITHUB_OWNER y GITHUB_REPO en js/config.js.');
        try { api.needsSetup = !(await leerPublico(R_USU)); } catch (e) { api.needsSetup = false; }
        return null;
      },
      async login(usuario, clave, recordar) {
        const uf = await leerPublico(R_USU);
        if (!uf) { api.needsSetup = true; throw new Error('La aplicación aún no está activada.'); }
        const e = (JSON.parse(dec.decode(uf.bytes)).usuarios || {})[await idUsuario(usuario)];
        let raw = null;
        if (e) { try { raw = await desenvolver(e, clave); } catch (x) { raw = null; } }
        if (!raw) throw new Error('Usuario o contraseña incorrectos');
        const yo = await abrirSesion(raw, await idUsuario(usuario));
        guardarSesion(recordar);
        return yo;
      },
      async setup({ token, nombre, usuario, clave }) {
        gh.token = token;
        await verificar();
        if (await leer(R_USU)) throw new Error('Esta aplicación ya fue activada en este repositorio. Use la pantalla de ingreso.');
        const raw = aleatorio(32), llave = await importar(raw), id = await idUsuario(usuario);
        const c = { v: 1, owner: gh.owner, repo: gh.repo, branch: gh.branch, token, perfiles: { [id]: { usuario, nombre, roles: ['admin', 'tesoreria'], activo: true } } };
        await escribir(R_CONF, await cifrarJSON(llave, c), null);
        await escribir(R_DATA, await cifrarJSON(llave, vacio()), null);
        await escribir(R_USU, enc.encode(JSON.stringify({ v: 1, usuarios: { [id]: await envolver(raw, clave) } }, null, 1)), null);
        api.needsSetup = false;
        const yo = await abrirSesion(raw, id);
        guardarSesion(false);
        return yo;
      },
      async logout() { this_logout(); },
      async changePassword(p) { await mutarUsuarios(async d => { d.usuarios[uid] = await envolver(rawM, p); }); },
      async loadAll() {
        await refrescarConf();
        const d = await datos();
        return { reqs: clone(d.reqs).sort((a, b) => b.numero - a.numero), proyectos: clone(d.proyectos), proveedores: clone(d.proveedores), perfiles: perfiles() };
      },
      async getReq(id) { const d = await datos(true); const r = d.reqs.find(x => x.id === id); return r ? clone(r) : null; },
      async createReq(req) {
        let r = clone(req);
        await mutarDatos(d => {
          const ya = r.radicado && d.reqs.find(x => x.radicado === r.radicado);   // envío del enlace ya registrado
          if (ya) { r = clone(ya); return false; }
          d.seq = (d.seq || 0) + 1; r.numero = d.seq; r._v = 1; d.reqs = d.reqs.filter(x => x.id !== r.id); d.reqs.push(clone(r));
        });
        return r;
      },
      // --- enlace público de solicitudes: buzón (repositorio privado) + configuración pública
      buzonInfo() { return conf && conf.buzon ? { owner: conf.buzon.owner, repo: conf.buzon.repo } : null; },
      async activarBuzon(repo, token) {
        // Acepta la URL completa o el nombre con espacios (GitHub los convierte en guiones)
        repo = String(repo || '').trim().replace(/\/+$/, '').replace(/^.*\//, '').replace(/\s+/g, '-');
        if (!repo || !token) throw new Error('Escriba el repositorio buzón y el token');
        if (repo.toLowerCase() === gh.repo.toLowerCase()) throw new Error('El buzón debe ser un repositorio distinto al de la app (y privado).');
        if (token === conf.token) throw new Error('Use un token distinto al de la app: este queda en el formulario público.');
        const r = await fetch(`${API}/repos/${gh.owner}/${repo}`, { headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token }, cache: 'no-store' });
        if (!r.ok) throw new Error(r.status === 404 ? 'No encontré el repositorio buzón o el token no tiene acceso a él.' : 'El token del buzón no es válido (error ' + r.status + ').');
        if (!(await r.json()).private) throw new Error('El repositorio buzón debe ser privado.');
        const par = conf.buzon && conf.buzon.priv ? { pub: conf.buzon.pub, priv: conf.buzon.priv } : await Sobre.generarPar();
        await mutarConf(c => { c.buzon = { owner: gh.owner, repo, token, pub: par.pub, priv: par.priv }; });
      },
      async publicarConfigSolicitud(proyectos) {
        if (!conf || !conf.buzon) return;
        const b = conf.buzon;
        const pub = { v: 1, owner: b.owner, repo: b.repo, t: Sobre.ofuscar(b.token), pub: b.pub, proyectos };
        const texto = JSON.stringify(pub, null, 1);
        for (let i = 0; i < 3; i++) {
          const actual = await leer('solicitud-config.json');
          if (actual && dec.decode(actual.bytes) === texto) return;
          try { await escribir('solicitud-config.json', enc.encode(texto), actual && actual.sha); return; }
          catch (e) { if (!e.conflicto) throw e; await espera(); }
        }
      },
      async leerBuzon() {
        const b = conf && conf.buzon; if (!b) return [];
        const api = async (ruta, metodo, cuerpo) => {
          const r = await fetch(`${API}/repos/${b.owner}/${b.repo}${ruta}`, { method: metodo || 'GET', cache: 'no-store',
            headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', Authorization: 'Bearer ' + b.token, ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
            body: cuerpo ? JSON.stringify(cuerpo) : undefined });
          if (!r.ok && r.status !== 204) { const e = new Error(r.status === 401 ? 'El token del buzón de solicitudes venció o no es válido (Admin → Enlace).' : 'Error del buzón (' + r.status + ')'); e.status = r.status; throw e; }
          return r.status === 204 ? null : r.json();
        };
        api_buzon = api;
        const issues = (await api('/issues?state=open&per_page=50&sort=created&direction=asc')).filter(i => !i.pull_request && /^compras-v1/.test(i.body || ''));
        const out = [];
        for (const is of issues) {
          try {
            const partes = Number(((is.body.match(/partes=(\d+)/) || [])[1]) || 1);
            let sobre = is.body.slice(is.body.indexOf('\n') + 1), comentarios = [];
            if (partes > 1) {
              comentarios = (await api(`/issues/${is.number}/comments?per_page=100`)).sort((a, c) => a.id - c.id);
              for (let k = 2; k <= partes; k++) {
                const cm = comentarios.find(c => (c.body || '').startsWith(`parte ${k}\n`));
                if (!cm) throw new Error('incompleto');
                sobre += cm.body.slice(cm.body.indexOf('\n') + 1);
              }
            }
            out.push({ ref: { n: is.number, comentarios: comentarios.map(c => c.id) }, datos: await Sobre.abrirSobre(b.priv, sobre) });
          } catch (e) { /* envío incompleto o dañado: se deja en el buzón */ }
        }
        return out;
      },
      async cerrarEnvio(ref, rad) {
        if (!api_buzon) return;
        for (const id of ref.comentarios || []) await api_buzon(`/issues/comments/${id}`, 'DELETE');
        await api_buzon(`/issues/${ref.n}`, 'PATCH', { state: 'closed', body: 'procesado ' + (rad || '') });
      },
      async publicarEstado(cedula, obj) {
        const ruta = 'estado/' + await Sobre.idEstado(cedula) + '.json';
        const bytes = enc.encode(JSON.stringify({ v: 1, d: b64(await Sobre.cifrarEstado(cedula, obj)) }));
        for (let i = 0; i < 3; i++) {
          const actual = await leer(ruta);
          try { await escribir(ruta, bytes, actual && actual.sha); return; }
          catch (e) { if (!e.conflicto) throw e; await espera(); }
        }
      },
      async saveReq(req) {
        const r = clone(req); r._v = req._v + 1;
        await mutarDatos(d => {
          const i = d.reqs.findIndex(x => x.id === req.id);
          if (i < 0) throw new Error('La solicitud no existe');
          if (d.reqs[i]._v !== req._v) throw new Error('CONFLICT');
          d.reqs[i] = clone(r);
        });
        return r;
      },
      async upsert(table, obj) {
        const o = clone(obj); if (!o.id) o.id = newId();
        if (table === 'perfiles') {
          const { password, ...resto } = o;
          if (password) await mutarUsuarios(async d => { d.usuarios[o.id] = await envolver(rawM, password); });
          if (resto.activo === false) await mutarUsuarios(d => { if (!d.usuarios[o.id]) return false; delete d.usuarios[o.id]; });
          await mutarConf(c => {
            const p = c.perfiles[o.id]; if (!p) throw new Error('Usuario no encontrado');
            if (resto.nombre != null) p.nombre = resto.nombre;
            if (resto.roles) p.roles = resto.roles;
            if (resto.activo != null) p.activo = resto.activo;
          });
          return perfilPub(o.id, conf.perfiles[o.id]);
        }
        await mutarDatos(d => {
          const arr = d[table] = d[table] || [];
          const i = arr.findIndex(x => x.id === o.id);
          if (i >= 0) arr[i] = { ...arr[i], ...o }; else arr.push(o);
        });
        return o;
      },
      async createUser({ nombre, email, password, roles }) {
        const usuario = String(email).trim(), id = await idUsuario(usuario);
        if (conf.perfiles[id] && conf.perfiles[id].activo !== false) throw new Error('Ya existe un usuario con ese nombre de usuario');
        await mutarUsuarios(async d => { d.usuarios[id] = await envolver(rawM, password); });
        await mutarConf(c => { c.perfiles[id] = { usuario, nombre, roles, activo: true }; });
        return perfilPub(id, conf.perfiles[id]);
      },
      async updateToken(token) {
        const ant = gh.token; gh.token = token;
        try { await verificar(); } catch (e) { gh.token = ant; throw e; }
        await mutarConf(c => { c.token = token; });
      },
      async uploadFile(file) {
        if (file.size > 20e6) throw new Error('El archivo debe pesar menos de 20 MB');
        const ext = ((file.name.match(/\.(\w{2,5})$/) || [])[1] || 'bin').toLowerCase();
        const nombre = newId() + '.' + ext;
        await escribir(rArch(nombre), await cifrar(maestra, new Uint8Array(await file.arrayBuffer())), null);
        return { nombre: file.name, path: nombre };
      },
      async fileUrl(path) {
        const r = await leer(rArch(path)); if (!r) return null;
        const ext = (path.split('.').pop() || '').toLowerCase();
        return URL.createObjectURL(new Blob([await descifrar(maestra, r.bytes)], { type: MIME[ext] || 'application/octet-stream' }));
      },
      async notify(list) {
        const t = new Date().toISOString();
        await mutarDatos(d => { d.notifs = (d.notifs || []).concat(list.map(n => ({ id: newId(), leida: false, creado: t, ...n }))).slice(-1500); });
      },
      async myNotifs() {
        if (!uid) return [];
        const d = await datos();
        return clone((d.notifs || []).filter(n => n.user_id === uid).sort((a, b) => b.creado.localeCompare(a.creado)).slice(0, 50));
      },
      async markRead(ids) {
        if (!ids.length) return;
        await mutarDatos(d => { let n = 0; (d.notifs || []).forEach(x => { if (ids.includes(x.id) && !x.leida) { x.leida = true; n++; } }); if (!n) return false; });
      },
      async getClaudeKey() { return (conf && conf.claudeKey) || null; },
      async setClaudeKey(k) { await mutarConf(c => { if (k) c.claudeKey = k; else delete c.claudeKey; }); },
      reset() { }
    };
    return api;
  }

  window.createStore = () => {
    const modo = cfg.MODO || 'auto';
    if (modo === 'supabase' || (modo === 'auto' && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY)) return SupaStore();
    if (modo === 'github' || (modo === 'auto' && location.hostname.toLowerCase().endsWith('.github.io'))) return GitHubStore();
    return LocalStore();
  };
})();
