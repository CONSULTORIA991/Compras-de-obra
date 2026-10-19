/* App de Compras y Requisiciones de obra */
(function () {
  'use strict';
  const cfg = window.APP_CONFIG || {};
  const EMP = Object.assign({ nombre: 'Mi Empresa' }, cfg.EMPRESA || {});
  const DIAS_ALERTA = cfg.DIAS_ALERTA || 2;
  let store;
  try { store = window.createStore(); } catch (e) { document.getElementById('app').innerHTML = `<div class="login"><div class="card">${e.message}</div></div>`; return; }
  const DEMO = store.mode === 'demo';
  const GHM = store.mode === 'github';
  const MIN_CLAVE = GHM ? 10 : 8;
  const LBL_USUARIO = GHM ? 'Usuario' : 'Correo';

  const S = {
    user: null, reqs: [], proyectos: [], proveedores: [], perfiles: [], notifs: [],
    f: { q: '', proyecto: '', estado: 'abiertas', mias: false },
    cotTab: 'recibida', admTab: 'usuarios', rep: { desde: '', hasta: '', proyecto: '' }
  };

  /* ------------------------------------------------------------ catálogos */
  const ROLES = { solicitante: 'Solicitante (obra)', jefe: 'Jefe / Aprobador', compras: 'Compras', tesoreria: 'Tesorería / Pagos', admin: 'Administrador' };
  const UNIDADES = ['und', 'bulto', 'kg', 'galón', 'cuñete', 'lt', 'm', 'm²', 'm³', 'rollo', 'caja', 'paquete', 'par', 'juego', 'global'];
  const UNI_ALIAS = { und: 'und', unds: 'und', unidad: 'und', unidades: 'und', u: 'und', bulto: 'bulto', bultos: 'bulto', kg: 'kg', kilo: 'kg', kilos: 'kg', galon: 'galón', 'galón': 'galón', galones: 'galón', gl: 'galón', 'cuñete': 'cuñete', 'cuñetes': 'cuñete', lt: 'lt', litro: 'lt', litros: 'lt', m: 'm', metro: 'm', metros: 'm', ml: 'm', m2: 'm²', 'm²': 'm²', m3: 'm³', 'm³': 'm³', rollo: 'rollo', rollos: 'rollo', caja: 'caja', cajas: 'caja', paquete: 'paquete', paquetes: 'paquete', par: 'par', pares: 'par', juego: 'juego', juegos: 'juego' };
  const ITEM_EST = {
    revision: { l: 'Por revisar', c: 'gray' }, espera: { l: 'Pendiente', c: 'amber' }, rechazado: { l: 'Rechazado', c: 'red' },
    aprobado: { l: 'Aprobado · por cotizar', c: 'blue' }, cotizando: { l: 'Cotización solicitada', c: 'indigo' },
    cotizado: { l: 'Cotización por aprobar', c: 'purple' }, por_pagar: { l: 'Por pagar', c: 'orange' }, pagado: { l: 'Pagado', c: 'green' }
  };
  const REQ_EST = {
    revision: { l: 'En revisión', c: 'gray' }, aprobado: { l: 'Por cotizar', c: 'blue' }, cotizando: { l: 'Esperando cotización', c: 'indigo' },
    cotizado: { l: 'Cotización por aprobar', c: 'purple' }, por_pagar: { l: 'Por pagar', c: 'orange' }, espera: { l: 'Con ítems pendientes', c: 'amber' },
    cerrada: { l: 'Cerrada', c: 'green' }, cerrada_rech: { l: 'Cerrada (rechazada)', c: 'red' }
  };
  const COT_EST = {
    solicitada: { l: 'Esperando proveedor', c: 'indigo' }, recibida: { l: 'Por aprobar', c: 'purple' }, aprobada: { l: 'Aprobada · por pagar', c: 'orange' },
    pagada: { l: 'Pagada', c: 'green' }, rechazada: { l: 'Rechazada', c: 'red' }, descartada: { l: 'Descartada', c: 'gray' }, anulada: { l: 'Anulada', c: 'gray' }
  };
  const DECISION = { aprobado: 'Aprobado', espera: 'Pendiente', rechazado: 'Rechazado' };
  const ETAPAS = {
    jefe: { l: 'Revisión de jefes', d: 'Desde que se crea la solicitud hasta que el jefe decide cada ítem', rol: 'Jefes' },
    compras: { l: 'Compras pide cotización', d: 'Desde la aprobación hasta que compras envía la solicitud de cotización', rol: 'Compras' },
    proveedor: { l: 'Respuesta del proveedor', d: 'Desde la solicitud de cotización hasta que se registra la cotización', rol: 'Proveedores' },
    aprobCot: { l: 'Aprobación de cotización', d: 'Desde que llega la cotización hasta que el jefe la aprueba o rechaza', rol: 'Jefes' },
    pago: { l: 'Pago', d: 'Desde la aprobación de la cotización hasta que se registra el pago', rol: 'Tesorería' }
  };

  /* ------------------------------------------------------------ utilidades */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const now = () => new Date().toISOString();
  const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : 0; };
  const money = n => '$ ' + Math.round(n || 0).toLocaleString('es-CO');
  const fdate = t => t ? new Date(t).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const fdt = t => t ? new Date(t).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
  const dur = ms => {
    if (ms == null || !isFinite(ms)) return '—';
    const h = ms / 36e5;
    if (h < 1) return Math.max(1, Math.round(ms / 6e4)) + ' min';
    if (h < 48) return h.toFixed(1).replace('.', ',') + ' h';
    return (h / 24).toFixed(1).replace('.', ',') + ' días';
  };
  const edad = t => t ? Date.now() - new Date(t) : null;
  const hace = t => t ? 'hace ' + dur(edad(t)) : '';
  const diff = (a, b) => (a && b) ? Math.max(0, new Date(b) - new Date(a)) : null;
  const code = r => 'REQ-' + String(r.numero || 0).padStart(4, '0');
  const badge = (map, k) => { const x = map[k] || { l: k, c: 'gray' }; return `<span class="badge b-${x.c}">${x.l}</span>`; };
  const has = role => !!S.user && (S.user.roles || []).some(r => r === role || r === 'admin');
  const initials = n => String(n || '?').replace(/\(.*\)/, '').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const atrasado = t => t && edad(t) > DIAS_ALERTA * 864e5;
  const maxT = arr => arr.filter(Boolean).sort().pop() || null;
  const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
  const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };

  /* ------------------------------------------------------------ reglas del flujo */
  function itemStage(r, it) {
    if (it.estado !== 'aprobado') return it.estado;
    const cs = (r.cotizaciones || []).filter(c => c.itemIds.includes(it.id));
    if (cs.some(c => c.estado === 'pagada')) return 'pagado';
    if (cs.some(c => c.estado === 'aprobada')) return 'por_pagar';
    if (cs.some(c => c.estado === 'recibida')) return 'cotizado';
    if (cs.some(c => c.estado === 'solicitada')) return 'cotizando';
    return 'aprobado';
  }
  function reqInfo(r) {
    const st = r.items.map(i => itemStage(r, i));
    const cnt = {}; st.forEach(s => cnt[s] = (cnt[s] || 0) + 1);
    const total = st.length, fin = (cnt.rechazado || 0) + (cnt.pagado || 0);
    let estado;
    if (total && fin === total) estado = cnt.pagado ? 'cerrada' : 'cerrada_rech';
    else estado = ['revision', 'aprobado', 'cotizando', 'cotizado', 'por_pagar', 'espera'].find(s => cnt[s]) || 'revision';
    return { cnt, total, fin, estado, cerrada: estado.startsWith('cerrada'), pendientes: cnt.espera || 0 };
  }
  function cotTotals(items, precios, ivaPct, ivaInc, otros) {
    const sub = items.reduce((s, i) => s + num(precios[i.id]) * num(i.cantidad), 0);
    const pct = num(ivaPct) / 100;
    const iva = ivaInc ? sub - sub / (1 + pct) : sub * pct;
    return { subtotal: sub, iva, total: (ivaInc ? sub : sub + iva) + num(otros) };
  }
  const cotItems = (r, c) => c.itemIds.map(id => r.items.find(i => i.id === id)).filter(Boolean);
  const itemCompra = (r, i) => {
    const c = r.cotizaciones.find(c => ['aprobada', 'pagada'].includes(c.estado) && c.itemIds.includes(i.id));
    return c ? { c, precio: num(c.precios[i.id]) } : null;
  };
  const allCots = () => S.reqs.flatMap(r => (r.cotizaciones || []).map(c => ({ r, c })));
  const log = (r, accion, detalle) => r.eventos.push({ t: now(), uid: S.user.id, por: S.user.nombre, accion, detalle: detalle || '' });

  async function notificar(roles, mensaje, reqId, extra = []) {
    const ids = new Set(extra.filter(Boolean));
    S.perfiles.filter(p => p.activo !== false && (p.roles || []).some(r => roles.includes(r))).forEach(p => ids.add(p.id));
    ids.delete(S.user.id);
    if (ids.size) {
      try { await store.notify([...ids].map(u => ({ user_id: u, req_id: reqId, mensaje }))); }
      catch (e) { console.warn('No se pudo notificar', e); }
    }
  }

  /** Lee la versión más reciente, aplica cambios y guarda (reintenta si otro usuario editó). */
  async function mutate(reqId, fn) {
    for (let i = 0; i < 3; i++) {
      const r = await store.getReq(reqId);
      if (!r) throw new Error('No se encontró la solicitud');
      const antes = reqInfo(r).cerrada;
      if (fn(r) === false) return null;
      const info = reqInfo(r);
      if (info.cerrada && !antes) log(r, 'Solicitud cerrada', 'Todos los ítems fueron resueltos');
      try {
        const saved = await store.saveReq(r);
        const k = S.reqs.findIndex(x => x.id === saved.id);
        if (k >= 0) S.reqs[k] = saved; else S.reqs.unshift(saved);
        return { r: saved, cerro: info.cerrada && !antes };
      } catch (e) { if (e.message !== 'CONFLICT') throw e; }
    }
    throw new Error('Otra persona modificó esta solicitud al mismo tiempo. Recargue e intente de nuevo.');
  }

  /* ------------------------------------------------------------ UI básica */
  function toast(msg, tipo) {
    const t = $('#toast'); const d = document.createElement('div');
    d.className = 'toast ' + (tipo || ''); d.textContent = msg; t.appendChild(d);
    setTimeout(() => d.remove(), 3800);
  }
  let busyN = 0;
  function busy(on) { busyN += on ? 1 : -1; if (busyN < 0) busyN = 0; $('#busy').hidden = busyN === 0; }
  function modal(title, body, wide) {
    $('#modal').innerHTML = `<div class="modal-bg" onclick="if(event.target===this)App.cerrarModal()"><div class="modal${wide ? ' wide' : ''}" role="dialog" aria-modal="true">
      <header><h2>${title}</h2><button class="icon" type="button" onclick="App.cerrarModal()" aria-label="Cerrar">✕</button></header>
      <div class="modal-body">${body}</div></div></div>`;
    const first = $('#modal input:not([type=hidden]):not([type=checkbox]):not([type=radio]), #modal textarea, #modal select');
    if (first && window.innerWidth > 700) first.focus();
  }
  const cerrarModal = () => { $('#modal').innerHTML = ''; };
  const run = fn => async (...a) => {
    try { busy(true); await fn(...a); }
    catch (e) { console.error(e); toast(e.message || String(e), 'err'); }
    finally { busy(false); }
  };
  async function abrirArchivo(path) {
    const w = window.open('', '_blank');
    let url = await store.fileUrl(path);
    if (!url) { if (w) w.close(); throw new Error('Archivo no encontrado'); }
    if (url.startsWith('data:')) url = URL.createObjectURL(await (await fetch(url)).blob());
    if (w) w.location.href = url; else location.href = url;
  }
  function descargar(nombre, contenido, tipo) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([contenido], { type: tipo }));
    a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  }
  const csv = rows => '﻿' + rows.map(r => r.map(v => {
    const s = String(v ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(';')).join('\r\n');

  /* ------------------------------------------------------------ navegación */
  const NAV = [
    ['inicio', '🏠', 'Inicio', () => true],
    ['nueva', '➕', 'Nueva', () => true],
    ['requisiciones', '📋', 'Solicitudes', () => true],
    ['cotizaciones', '💲', 'Cotizaciones', () => has('compras') || has('jefe') || has('tesoreria')],
    ['reportes', '📊', 'Reportes', () => has('jefe') || has('compras') || has('tesoreria')],
    ['admin', '⚙️', 'Admin', () => has('admin') || has('compras')]
  ];
  const VIEWS = { inicio: viewInicio, nueva: viewNueva, requisiciones: viewReqs, req: viewReq, cotizaciones: viewCots, reportes: viewReportes, admin: viewAdmin };
  const parseHash = () => { const [p, a] = location.hash.replace(/^#\/?/, '').split('/'); return [p || 'inicio', a]; };

  async function refresh() {
    const d = await store.loadAll(); Object.assign(S, d);
    const me = S.perfiles.find(p => p.id === S.user.id); if (me) S.user = { ...S.user, ...me };
    try { S.notifs = await store.myNotifs(); } catch (e) { S.notifs = []; }
  }
  async function route() {
    cerrarModal();
    if (!S.user) return paintLogin();
    busy(true);
    try { await refresh(); } catch (e) { toast('Error cargando datos: ' + e.message, 'err'); }
    busy(false);
    paint();
  }
  function paint() {
    let [p, arg] = parseHash();
    const nav = NAV.find(n => n[0] === p);
    if (!VIEWS[p] || (nav && !nav[3]())) p = 'inicio';
    $('#app').innerHTML = shell(p);
    $('#main').innerHTML = VIEWS[p](arg);
    if (p === 'nueva') { addRow('itemRows'); }
    if (p === 'requisiciones') pintarListaReqs();
    window.scrollTo(0, 0);
  }

  function shell(p) {
    const unread = S.notifs.filter(n => !n.leida).length;
    const navHtml = NAV.filter(n => n[3]()).map(([k, ic, l]) =>
      `<a href="#/${k}" class="${p === k || (p === 'req' && k === 'requisiciones') ? 'on' : ''}"><span class="ni">${ic}</span><span class="nl">${l}</span></a>`).join('');
    return `${DEMO ? `<div class="demo-bar">Modo demostración: los datos se guardan solo en este navegador. <button class="link" onclick="App.resetDemo()">Reiniciar datos de prueba</button></div>` : ''}
    <header class="top">
      <a class="brand" href="#/inicio"><span class="logo-s">📦</span><span><b>Compras de obra</b><small>${esc(EMP.nombre)}</small></span></a>
      <nav class="nav">${navHtml}</nav>
      <div class="top-r">
        <button class="icon bell" id="bell" onclick="App.toggleNotifs()" title="Notificaciones" aria-label="Notificaciones">🔔${unread ? `<span class="dot">${unread}</span>` : ''}</button>
        <div class="user">
          <button class="user-btn" onclick="App.toggleUser()" title="${esc(S.user.nombre)}">${esc(initials(S.user.nombre))}</button>
          <div id="userMenu" class="menu" hidden>
            <div class="menu-h"><b>${esc(S.user.nombre)}</b><small>${esc(S.user.email)}</small><small>${(S.user.roles || []).map(r => ROLES[r] || r).join(', ')}</small></div>
            <button onclick="App.cambiarClave()">🔑 Cambiar contraseña</button>
            <button onclick="App.logout()">🚪 Cerrar sesión</button>
          </div>
        </div>
      </div>
      <div id="notifPanel" class="menu notif" hidden></div>
    </header>
    <main id="main"></main>`;
  }

  function paintLogin() {
    const demoUsers = [['obra@demo.co', 'Trabajador de obra'], ['jefe@demo.co', 'Jefe (aprueba)'], ['compras@demo.co', 'Compras'], ['tesoreria@demo.co', 'Tesorería (paga)'], ['admin@demo.co', 'Administrador']];
    if (store.needsSetup) return paintSetup();
    $('#app').innerHTML = `<div class="login"><div class="card login-card">
      <div class="logo">📦</div><h1>Compras de obra</h1><p class="muted">${esc(EMP.nombre)} · Solicitudes, aprobaciones, cotizaciones y pagos</p>
      ${GHM ? '<p class="lock">🔒 Acceso protegido · datos cifrados</p>' : ''}
      <form id="fLogin" onsubmit="App.login(event)">
        <label>${LBL_USUARIO}<input name="email" type="${GHM ? 'text' : 'email'}" required autocomplete="username" autocapitalize="none"></label>
        <label>Contraseña<input name="pass" type="password" required autocomplete="current-password"></label>
        ${GHM ? '<label class="check mb"><input type="checkbox" name="recordar"> Mantener la sesión en este dispositivo</label>' : ''}
        <button class="btn primary block">Ingresar</button>
        <p id="loginErr" class="err"></p>
      </form>
      ${DEMO ? `<div class="demo-users"><p class="muted sm">Modo demostración: entre como cualquier rol (contraseña <b>demo123</b>):</p>
        <div class="chips">${demoUsers.map(([e, l]) => `<button class="chip-btn" onclick="App.demoFill('${e}')">${l}</button>`).join('')}</div></div>` : ''}
    </div></div>`;
  }

  function paintSetup() {
    const ri = store.repoInfo ? store.repoInfo() : {};
    $('#app').innerHTML = `<div class="login"><div class="card login-card wide">
      <p class="lock">🔒 Configuración inicial</p><h1>Activar la aplicación</h1>
      <p class="muted">Se hace una sola vez. Se crea la llave de cifrado y su cuenta de administrador. Todos los datos se guardan cifrados en el repositorio <b>${esc(ri.owner)}/${esc(ri.repo)}</b>.</p>
      <ol class="steps">
        <li>En GitHub, cree un <b>token de acceso fino</b>: foto de perfil → <b>Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token</b>.</li>
        <li>En <b>Repository access</b> elija <b>Only select repositories</b> → <b>${esc(ri.repo)}</b>. En <b>Permissions → Contents</b> elija <b>Read and write</b>. Póngale la fecha de vencimiento más larga que permita.</li>
        <li>Péguelo abajo. Quedará guardado cifrado; nadie lo ve sin contraseña.</li>
      </ol>
      <form id="fSetup" onsubmit="App.activar(event)">
        <label>Token de GitHub<input name="token" type="password" autocomplete="off" required></label>
        <label>Su nombre<input name="nombre" autocomplete="name" required></label>
        <div class="grid2">
          <label>Usuario para entrar<input name="usuario" autocomplete="username" autocapitalize="none" required></label>
          <label>Contraseña (mín. ${MIN_CLAVE} caracteres)<input name="clave" type="password" autocomplete="new-password" required></label>
        </div>
        <label>Repita la contraseña<input name="clave2" type="password" autocomplete="new-password" required></label>
        <p class="muted sm">Su usuario quedará como Administrador y Tesorería. Después podrá crear los usuarios de cada persona desde Admin.</p>
        <button class="btn primary block">Activar y entrar</button>
        <p id="setupErr" class="err"></p>
      </form></div></div>`;
  }

  /* ------------------------------------------------------------ INICIO */
  function tareas() {
    const T = [];
    for (const r of S.reqs) {
      const st = r.items.map(i => [i, itemStage(r, i)]);
      const urg = r.prioridad === 'urgente';
      if (has('jefe')) {
        const rev = st.filter(([, s]) => s === 'revision');
        if (rev.length) T.push({ ic: '🧐', t: `Revisar ${rev.length} ítem(s)`, r, desde: maxT(rev.map(([i]) => i.creado)) || r.creado, urg });
        const esp = st.filter(([, s]) => s === 'espera');
        if (esp.length) T.push({ ic: '⏸', t: `${esp.length} ítem(s) pendiente(s) por definir`, r, desde: esp[0][0].decididoEn || r.creado, urg });
        r.cotizaciones.filter(c => c.estado === 'recibida').forEach(c => T.push({ ic: '✅', t: `Aprobar cotización ${c.codigo} · ${c.proveedorNombre} · ${money(c.total)}`, r, desde: c.fechaRecibida, urg }));
      }
      if (has('compras')) {
        const ap = st.filter(([, s]) => s === 'aprobado');
        if (ap.length) T.push({ ic: '📝', t: `Solicitar cotización de ${ap.length} ítem(s) aprobado(s)`, r, desde: maxT(ap.map(([i]) => i.decididoEn)), urg });
        r.cotizaciones.filter(c => c.estado === 'solicitada').forEach(c => T.push({ ic: '⏳', t: `Registrar respuesta de ${c.proveedorNombre} (${c.codigo})`, r, desde: c.fechaSolicitud, urg }));
      }
      if (has('tesoreria')) r.cotizaciones.filter(c => c.estado === 'aprobada').forEach(c => T.push({ ic: '💵', t: `Pagar ${money(c.total)} a ${c.proveedorNombre} (${c.codigo})`, r, desde: c.fechaDecision, urg }));
    }
    return T.sort((a, b) => (b.urg - a.urg) || String(a.desde).localeCompare(String(b.desde)));
  }
  const taskHtml = t => `<a class="task" href="#/req/${t.r.id}"><span class="ic">${t.ic}</span>
    <div class="grow"><b>${esc(t.t)}</b><small>${code(t.r)} · ${esc(t.r.proyecto)} · ${hace(t.desde)}</small></div>
    ${t.urg ? '<span class="badge b-red">Urgente</span>' : ''}${atrasado(t.desde) ? '<span class="badge b-amber">Atrasada</span>' : ''}</a>`;

  function viewInicio() {
    const T = tareas();
    const abiertas = S.reqs.filter(r => !reqInfo(r).cerrada);
    const pendItems = S.reqs.reduce((s, r) => s + r.items.filter(i => i.estado === 'espera').length, 0);
    const cots = allCots();
    const porAprobar = cots.filter(x => x.c.estado === 'recibida');
    const porPagar = cots.filter(x => x.c.estado === 'aprobada');
    const mias = S.reqs.filter(r => r.creadoPor === S.user.id).slice(0, 8);
    const soloSolic = !has('jefe') && !has('compras') && !has('tesoreria');
    return `<section class="hello"><div><h1>Hola, ${esc(S.user.nombre.split(' (')[0])}</h1><p class="muted">${(S.user.roles || []).map(r => ROLES[r]).join(' · ')}</p></div>
      <a class="btn primary" href="#/nueva">➕ Nueva solicitud</a></section>
    <section class="kpis">
      <div class="kpi"><span>Solicitudes abiertas</span><b>${abiertas.length}</b></div>
      <div class="kpi"><span>Ítems pendientes por definir</span><b class="${pendItems ? 't-amber' : ''}">${pendItems}</b></div>
      <div class="kpi"><span>Cotizaciones por aprobar</span><b>${porAprobar.length}</b><small>${money(porAprobar.reduce((s, x) => s + x.c.total, 0))}</small></div>
      <div class="kpi"><span>Aprobado por pagar</span><b>${porPagar.length}</b><small>${money(porPagar.reduce((s, x) => s + x.c.total, 0))}</small></div>
    </section>
    ${soloSolic ? '' : `<section class="card"><h2>Mis tareas pendientes <span class="count">${T.length}</span></h2>
      ${T.length ? `<div class="tasks">${T.map(taskHtml).join('')}</div>` : '<p class="empty">🎉 No tiene tareas pendientes.</p>'}</section>`}
    <section class="card"><h2>Mis solicitudes</h2>
      ${mias.length ? `<div class="rlist">${mias.map(reqCard).join('')}</div>` : '<p class="empty">Aún no ha creado solicitudes.</p>'}
    </section>`;
  }

  /* ------------------------------------------------------------ NUEVA SOLICITUD */
  function itemRowHtml(d = {}) {
    return `<div class="irow">
      <input class="i-desc" placeholder="Descripción (ej: cemento gris 50 kg)" value="${esc(d.descripcion || '')}" aria-label="Descripción">
      <input class="i-cant" type="number" min="0" step="any" inputmode="decimal" placeholder="Cant." value="${d.cantidad ?? ''}" aria-label="Cantidad">
      <select class="i-und" aria-label="Unidad">${UNIDADES.map(u => `<option${u === (d.unidad || 'und') ? ' selected' : ''}>${u}</option>`).join('')}</select>
      <button type="button" class="icon" title="Quitar ítem" onclick="this.parentNode.remove()">✕</button></div>`;
  }
  function addRow(cont, d) { const c = document.getElementById(cont); if (c) c.insertAdjacentHTML('beforeend', itemRowHtml(d)); }
  function collectRows(cont) {
    return $$('#' + cont + ' .irow').map(row => ({
      descripcion: $('.i-desc', row).value.trim(),
      cantidad: num($('.i-cant', row).value) || 1,
      unidad: $('.i-und', row).value
    })).filter(i => i.descripcion);
  }
  function parseLines(txt) {
    return txt.split(/\r?\n/).map(l => l.replace(/^\s*[-•*·\d]+[.)]\s+/, '').trim()).filter(Boolean).map(l => {
      const m = l.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
      if (!m) return { descripcion: l, cantidad: 1, unidad: 'und' };
      let resto = m[2].trim(), unidad = 'und';
      const w = resto.split(/\s+/)[0] || '';
      const k = w.toLowerCase().replace(/[.,]$/, '');
      if (UNI_ALIAS[k]) { unidad = UNI_ALIAS[k]; resto = resto.slice(w.length).replace(/^\s*(de\s+)?/i, ''); }
      return { descripcion: resto || l, cantidad: num(m[1]), unidad };
    });
  }
  function viewNueva() {
    const proys = S.proyectos.filter(p => p.activo !== false);
    if (!proys.length) return `<section class="card"><h1>Nueva solicitud</h1><p class="empty">No hay proyectos creados. Pida al administrador o a compras que cree los proyectos en Administración.</p></section>`;
    return `<section class="card narrow"><h1>Nueva solicitud de materiales</h1>
    <form id="fNueva" onsubmit="App.crearReq(event)">
      <div class="grid2">
        <label>Proyecto / obra *<select name="proyectoId" required><option value="">Seleccione…</option>${proys.map(p => `<option value="${p.id}">${esc(p.nombre)}</option>`).join('')}</select></label>
        <label>Solicitado por *<input name="solicitantes" required value="${esc(S.user.nombre.split(' (')[0])}"><small class="muted">Uno o varios nombres, separados por coma</small></label>
        <label>Prioridad<select name="prioridad"><option value="normal">Normal</option><option value="urgente">🔴 Urgente</option></select></label>
        <label>¿Para cuándo se necesita?<input type="date" name="fechaRequerida"></label>
      </div>
      <h2>Ítems</h2>
      <div class="irow head"><span>Descripción</span><span>Cant.</span><span>Unidad</span><span></span></div>
      <div id="itemRows"></div>
      <div class="row gap wrap">
        <button type="button" class="btn" onclick="App.addRow('itemRows')">＋ Agregar ítem</button>
        <button type="button" class="btn ghost" onclick="App.togglePaste()">📋 Pegar lista (por ejemplo, de WhatsApp)</button>
      </div>
      <div id="pasteBox" class="paste" hidden>
        <textarea id="pasteTxt" rows="5" placeholder="Una línea por ítem, por ejemplo:&#10;10 bultos cemento gris&#10;2 galones pintura blanca&#10;escoba"></textarea>
        <button type="button" class="btn" onclick="App.parsePaste('itemRows')">Convertir en ítems</button>
      </div>
      <label>Observaciones<textarea name="notas" rows="2" placeholder="Para qué se necesita, lugar de entrega, etc."></textarea></label>
      <div class="actions"><button class="btn primary">Enviar solicitud a aprobación</button></div>
    </form></section>`;
  }

  /* ------------------------------------------------------------ LISTA DE SOLICITUDES */
  function reqCard(r) {
    const info = reqInfo(r);
    const pct = info.total ? Math.round(info.fin / info.total * 100) : 0;
    return `<a class="rcard" href="#/req/${r.id}">
      <div class="rc-top"><b>${code(r)}</b>${badge(REQ_EST, info.estado)}${r.prioridad === 'urgente' && !info.cerrada ? '<span class="badge b-red">Urgente</span>' : ''}
        ${info.pendientes && info.estado !== 'espera' ? `<span class="badge b-amber">${info.pendientes} pendiente(s)</span>` : ''}</div>
      <div class="rc-p">${esc(r.proyecto)}</div>
      <div class="muted sm">${esc(r.solicitantes)} · ${fdate(r.creado)} · ${info.total} ítem(s)</div>
      <div class="chips">${Object.entries(info.cnt).map(([k, v]) => `<span class="chip c-${ITEM_EST[k].c}">${v} ${ITEM_EST[k].l.toLowerCase()}</span>`).join('')}</div>
      <div class="prog" title="${pct}% resuelto"><span style="width:${pct}%"></span></div></a>`;
  }
  function filtrarReqs() {
    const f = S.f, q = f.q.trim().toLowerCase();
    return S.reqs.filter(r => {
      const info = reqInfo(r);
      if (f.proyecto && r.proyectoId !== f.proyecto) return false;
      if (f.mias && r.creadoPor !== S.user.id) return false;
      if (f.estado === 'abiertas' && info.cerrada) return false;
      if (f.estado === 'cerradas' && !info.cerrada) return false;
      if (f.estado === 'con_pendientes' && !(info.pendientes && !info.cerrada)) return false;
      if (REQ_EST[f.estado] && info.estado !== f.estado) return false;
      if (q) {
        const hay = [code(r), r.proyecto, r.solicitantes, r.creadoPorNombre, ...r.items.map(i => i.descripcion), ...r.cotizaciones.map(c => c.proveedorNombre + ' ' + c.codigo)].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }
  function pintarListaReqs() {
    const L = filtrarReqs(); const el = $('#reqList'); if (!el) return;
    $('#reqCount').textContent = L.length;
    el.innerHTML = L.length ? L.map(reqCard).join('') : '<p class="empty">No hay solicitudes con estos filtros.</p>';
  }
  function viewReqs() {
    const f = S.f;
    const opts = [['abiertas', 'Abiertas'], ['con_pendientes', 'Con ítems pendientes'], ...Object.entries(REQ_EST).filter(([k]) => !k.startsWith('cerrada')).map(([k, v]) => [k, v.l]), ['cerradas', 'Cerradas'], ['todas', 'Todas']];
    return `<section class="card"><div class="row between wrap"><h1>Solicitudes <span class="count" id="reqCount"></span></h1><a class="btn primary" href="#/nueva">➕ Nueva</a></div>
      <div class="filters">
        <input type="search" placeholder="Buscar: número, material, proveedor, persona…" value="${esc(f.q)}" oninput="App.filtro('q',this.value)">
        <select onchange="App.filtro('estado',this.value)">${opts.map(([k, l]) => `<option value="${k}"${f.estado === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
        <select onchange="App.filtro('proyecto',this.value)"><option value="">Todos los proyectos</option>${S.proyectos.map(p => `<option value="${p.id}"${f.proyecto === p.id ? ' selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select>
        <label class="check"><input type="checkbox" ${f.mias ? 'checked' : ''} onchange="App.filtro('mias',this.checked)"> Solo mías</label>
      </div>
      <div class="rlist" id="reqList"></div></section>`;
  }

  /* ------------------------------------------------------------ DETALLE DE SOLICITUD */
  function viewReq(id) {
    const r = S.reqs.find(x => x.id === id);
    if (!r) return `<section class="card"><p class="empty">No se encontró la solicitud.</p><a class="btn" href="#/requisiciones">Volver</a></section>`;
    const info = reqInfo(r);
    const pend = r.items.filter(i => i.estado === 'espera');
    const porDecidir = r.items.filter(i => i.estado === 'revision' || i.estado === 'espera');
    const cotizables = r.items.filter(i => ['aprobado', 'cotizando', 'cotizado'].includes(itemStage(r, i)));
    const sinCot = r.items.filter(i => itemStage(r, i) === 'aprobado');
    const cotsVis = r.cotizaciones.slice().sort((a, b) => {
      const o = { recibida: 0, aprobada: 1, solicitada: 2, pagada: 3, rechazada: 4, descartada: 5, anulada: 6 };
      return o[a.estado] - o[b.estado];
    });

    const acciones = [];
    if (has('compras') && cotizables.length) {
      acciones.push(`<button class="btn primary" onclick="App.modalRFQ('${r.id}')">📄 Solicitar cotización${sinCot.length ? ` (${sinCot.length})` : ''}</button>`);
      acciones.push(`<button class="btn" onclick="App.modalRFQ('${r.id}',true)">📥 Registrar cotización ya recibida</button>`);
    }
    if (!info.cerrada) acciones.push(`<button class="btn ghost" onclick="App.modalAgregar('${r.id}')">＋ Agregar ítems</button>`);

    return `<a class="back" href="#/requisiciones">← Solicitudes</a>
    <section class="card">
      <div class="req-head">
        <div><h1>${code(r)} <span class="muted">· ${esc(r.proyecto)}</span></h1>
          <div class="row gap wrap">${badge(REQ_EST, info.estado)}${r.prioridad === 'urgente' ? '<span class="badge b-red">Urgente</span>' : ''}</div></div>
        <div class="prog big" title="${info.fin} de ${info.total} ítems resueltos"><span style="width:${info.total ? info.fin / info.total * 100 : 0}%"></span></div>
      </div>
      <dl class="meta">
        <div><dt>Solicitado por</dt><dd>${esc(r.solicitantes)}</dd></div>
        <div><dt>Registrado por</dt><dd>${esc(r.creadoPorNombre)}</dd></div>
        <div><dt>Fecha</dt><dd>${fdt(r.creado)}</dd></div>
        ${r.fechaRequerida ? `<div><dt>Se necesita para</dt><dd>${fdate(r.fechaRequerida + 'T12:00:00')}</dd></div>` : ''}
        ${r.notas ? `<div class="full"><dt>Observaciones</dt><dd>${esc(r.notas)}</dd></div>` : ''}
      </dl>
      ${pend.length && !info.cerrada ? `<div class="alert amber">⚠️ Esta solicitud <b>no se cerrará</b> mientras haya ítems pendientes: ${pend.map(i => `<b>${esc(i.descripcion)}</b>${i.nota ? ` (${esc(i.nota)})` : ''}`).join(', ')}.</div>` : ''}
      <h2>Ítems</h2>
      <div class="items">${r.items.map((i, k) => itemHtml(r, i, k)).join('')}</div>
      ${acciones.length ? `<div class="actions left">${acciones.join('')}</div>` : ''}
    </section>
    ${has('jefe') && porDecidir.length ? revisionHtml(r, porDecidir) : ''}
    ${r.cotizaciones.length ? `<section class="card"><h2>Cotizaciones</h2>${compareHtml(r)}<div class="cots">${cotsVis.map(c => cotCard(r, c)).join('')}</div></section>` : ''}
    <section class="card"><h2>Historial</h2><ol class="timeline">${r.eventos.slice().reverse().map(e => `<li><time>${fdt(e.t)}</time><div><b>${esc(e.accion)}</b> · ${esc(e.por)}${e.detalle ? `<div class="muted">${esc(e.detalle)}</div>` : ''}</div></li>`).join('')}</ol></section>`;
  }
  function itemHtml(r, i, k) {
    const st = itemStage(r, i), ic = itemCompra(r, i);
    return `<div class="it"><span class="it-n">${k + 1}</span>
      <div class="it-main"><b>${esc(i.descripcion)}</b><span class="muted">${i.cantidad} ${esc(i.unidad)}${i.cantidadSolicitada != null ? ` <s title="Cantidad solicitada">${i.cantidadSolicitada}</s>` : ''}</span>
        ${i.nota ? `<div class="it-note">💬 ${esc(i.nota)} <span class="muted">— ${esc(i.decididoPorNombre || '')}</span></div>` : ''}
        ${ic ? `<div class="it-note">🏪 ${esc(ic.c.proveedorNombre)} · ${money(ic.precio)} c/u · ${ic.c.codigo}</div>` : ''}</div>
      <div class="it-st">${badge(ITEM_EST, st)}</div></div>`;
  }
  function revisionHtml(r, items) {
    return `<section class="card hl" id="revision"><h2>🧐 Decisión de jefatura</h2>
      <p class="muted">Marque cada ítem. Los ítems <b>pendientes</b> mantienen la solicitud abierta hasta que se definan.</p>
      <form onsubmit="App.guardarRevision(event,'${r.id}')">
        <div class="row gap wrap mb">
          <button type="button" class="btn sm" onclick="App.marcarTodos(this.form,'aprobado')">✓ Aprobar todos</button>
          <button type="button" class="btn sm ghost" onclick="App.marcarTodos(this.form,'espera')">⏸ Todos pendientes</button>
        </div>
        ${items.map(i => `<div class="rev">
          <div class="rev-desc"><b>${esc(i.descripcion)}</b> ${i.estado === 'espera' ? badge(ITEM_EST, 'espera') : ''}</div>
          <div class="rev-ctl">
            <div class="seg">${[['aprobado', '✓ Aprobar'], ['espera', '⏸ Pendiente'], ['rechazado', '✕ Rechazar']].map(([v, l]) =>
              `<label class="seg-${v}"><input type="radio" name="d_${i.id}" value="${v}" ${i.estado === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
            <label class="qty">Cant.<input type="number" min="0" step="any" name="c_${i.id}" value="${i.cantidad}"><span>${esc(i.unidad)}</span></label>
          </div>
          <input name="n_${i.id}" placeholder="Comentario (opcional; recomendado si queda pendiente o se rechaza)" value="${esc(i.nota || '')}">
        </div>`).join('')}
        <div class="actions"><button class="btn primary">Guardar decisión</button></div>
      </form></section>`;
  }
  function cotCard(r, c) {
    const its = cotItems(r, c), A = [];
    const prov = S.proveedores.find(p => p.id === c.proveedorId) || {};
    A.push(`<button class="btn sm ghost" onclick="App.docRFQ('${r.id}','${c.id}')">📄 Documento</button>`);
    if (c.estado === 'solicitada' && has('compras')) {
      A.push(`<a class="btn sm ghost" target="_blank" rel="noopener" href="${waLink(r, c, prov)}">💬 WhatsApp</a>`);
      A.push(`<a class="btn sm ghost" href="${mailLink(r, c, prov)}">✉️ Correo</a>`);
      A.push(`<button class="btn sm primary" onclick="App.modalRespuesta('${r.id}','${c.id}')">📥 Registrar cotización</button>`);
      A.push(`<button class="btn sm danger-ghost" onclick="App.anularCot('${r.id}','${c.id}')">Anular</button>`);
    }
    if (c.archivo) A.push(`<button class="btn sm ghost" onclick="App.verArchivo('${c.archivo.path}')">📎 Cotización del proveedor</button>`);
    if (c.estado === 'recibida' && has('jefe')) {
      A.push(`<button class="btn sm success" onclick="App.modalDecision('${r.id}','${c.id}','aprobada')">✓ Aprobar</button>`);
      A.push(`<button class="btn sm danger" onclick="App.modalDecision('${r.id}','${c.id}','rechazada')">✕ Rechazar</button>`);
    }
    if (c.estado === 'aprobada' && has('tesoreria')) A.push(`<button class="btn sm primary" onclick="App.modalPago('${r.id}','${c.id}')">💵 Registrar pago</button>`);
    if (c.pago && c.pago.soporte) A.push(`<button class="btn sm ghost" onclick="App.verArchivo('${c.pago.soporte.path}')">🧾 Soporte de pago</button>`);
    const conPrecios = c.fechaRecibida;
    return `<article class="cot st-${c.estado}">
      <header><div><b>${c.codigo}</b> · ${esc(c.proveedorNombre)}</div>${badge(COT_EST, c.estado)}</header>
      <table class="tbl"><thead><tr><th>Ítem</th><th class="r">Cant.</th>${conPrecios ? '<th class="r">Vr. unit.</th><th class="r">Subtotal</th>' : ''}</tr></thead><tbody>
        ${its.map(i => `<tr><td>${esc(i.descripcion)}</td><td class="r">${i.cantidad} ${esc(i.unidad)}</td>${conPrecios ? `<td class="r">${money(c.precios[i.id])}</td><td class="r">${money(num(c.precios[i.id]) * i.cantidad)}</td>` : ''}</tr>`).join('')}
      </tbody>${conPrecios ? `<tfoot>
        <tr><td colspan="3" class="r">Subtotal${c.ivaInc ? ' (IVA incluido)' : ''}</td><td class="r">${money(c.subtotal)}</td></tr>
        <tr><td colspan="3" class="r">IVA ${c.ivaPct}%${c.ivaInc ? ' (incluido)' : ''}</td><td class="r">${money(c.iva)}</td></tr>
        ${num(c.otros) ? `<tr><td colspan="3" class="r">Flete / otros</td><td class="r">${money(c.otros)}</td></tr>` : ''}
        <tr class="tot"><td colspan="3" class="r">Total</td><td class="r">${money(c.total)}</td></tr></tfoot>` : ''}</table>
      <dl class="meta sm">
        <div><dt>Solicitada</dt><dd>${fdt(c.fechaSolicitud)} · ${esc(c.solicitadaPorNombre || '')}</dd></div>
        ${c.fechaLimite ? `<div><dt>Responder antes de</dt><dd>${fdate(c.fechaLimite + 'T12:00:00')}</dd></div>` : ''}
        ${c.fechaRecibida ? `<div><dt>Recibida</dt><dd>${fdt(c.fechaRecibida)} (${dur(diff(c.fechaSolicitud, c.fechaRecibida))})</dd></div>` : ''}
        ${c.entrega ? `<div><dt>Entrega</dt><dd>${esc(c.entrega)}</dd></div>` : ''}
        ${c.formaPago ? `<div><dt>Forma de pago</dt><dd>${esc(c.formaPago)}</dd></div>` : ''}
        ${c.validez ? `<div><dt>Validez</dt><dd>${esc(c.validez)}</dd></div>` : ''}
        ${c.notaCompras ? `<div class="full"><dt>Nota de compras</dt><dd>${esc(c.notaCompras)}</dd></div>` : ''}
        ${c.fechaDecision ? `<div class="full"><dt>${c.estado === 'rechazada' ? 'Rechazada' : 'Decisión'}</dt><dd>${fdt(c.fechaDecision)} · ${esc(c.decididaPorNombre || '')}${c.notaJefe ? ' · “' + esc(c.notaJefe) + '”' : ''}</dd></div>` : (c.notaJefe ? `<div class="full"><dt>Nota</dt><dd>${esc(c.notaJefe)}</dd></div>` : '')}
        ${c.pago ? `<div class="full"><dt>Pago</dt><dd>${money(c.pago.valor)} · ${esc(c.pago.medio)}${c.pago.referencia ? ' · Ref. ' + esc(c.pago.referencia) : ''} · ${fdate(c.pago.fecha + 'T12:00:00')} · ${esc(c.pago.porNombre)}${c.pago.nota ? ' · ' + esc(c.pago.nota) : ''}</dd></div>` : ''}
      </dl>
      <div class="cot-actions">${A.join('')}</div></article>`;
  }
  function compareHtml(r) {
    const cs = r.cotizaciones.filter(c => c.estado === 'recibida');
    if (cs.length < 2) return '';
    const ids = [...new Set(cs.flatMap(c => c.itemIds))];
    const its = ids.map(id => r.items.find(i => i.id === id)).filter(Boolean);
    const minTot = Math.min(...cs.map(c => c.total));
    return `<div class="compare"><h3>Comparativo de cotizaciones por aprobar</h3><div class="scroll-x"><table class="tbl">
      <thead><tr><th>Ítem</th>${cs.map(c => `<th class="r">${esc(c.proveedorNombre)}<br><small>${c.codigo}</small></th>`).join('')}</tr></thead><tbody>
      ${its.map(i => {
        const ps = cs.map(c => c.precios[i.id] != null && c.itemIds.includes(i.id) ? num(c.precios[i.id]) : null);
        const min = Math.min(...ps.filter(p => p != null));
        return `<tr><td>${esc(i.descripcion)} <span class="muted">(${i.cantidad} ${esc(i.unidad)})</span></td>${ps.map(p => `<td class="r ${p === min ? 'best' : ''}">${p == null ? '<span class="muted">No cotizó</span>' : money(p)}</td>`).join('')}</tr>`;
      }).join('')}</tbody>
      <tfoot><tr class="tot"><td>Total</td>${cs.map(c => `<td class="r ${c.total === minTot ? 'best' : ''}">${money(c.total)}</td>`).join('')}</tr>
      <tr><td>Entrega / pago</td>${cs.map(c => `<td class="r sm">${esc(c.entrega || '—')}<br>${esc(c.formaPago || '')}</td>`).join('')}</tr></tfoot></table></div>
      <p class="muted sm">En verde, el menor precio. Compare cuántos ítems cotizó cada proveedor antes de decidir.</p></div>`;
  }

  /* ------------------------------------------------------------ documento de cotización */
  const telWa = t => { let d = String(t || '').replace(/\D/g, ''); if (d.length === 10) d = '57' + d; return d; };
  function textoRFQ(r, c) {
    const its = cotItems(r, c);
    return `Buen día${c.proveedorNombre ? ', ' + c.proveedorNombre : ''}.\n${EMP.nombre} solicita cotización No. ${c.codigo}:\n\n` +
      its.map((i, k) => `${k + 1}. ${i.cantidad} ${i.unidad} - ${i.descripcion}`).join('\n') +
      `\n\n${c.observaciones ? c.observaciones + '\n' : ''}${c.fechaLimite ? 'Favor responder antes del ' + fdate(c.fechaLimite + 'T12:00:00') + '.\n' : ''}` +
      `Por favor indicar precio unitario, IVA, tiempo de entrega, forma de pago y validez de la oferta.\nGracias.\n${S.user.nombre.split(' (')[0]} - Compras ${EMP.nombre}`;
  }
  const waLink = (r, c, prov) => `https://wa.me/${telWa(prov.telefono)}?text=${encodeURIComponent(textoRFQ(r, c))}`;
  const mailLink = (r, c, prov) => `mailto:${encodeURIComponent(prov.email || '')}?subject=${encodeURIComponent('Solicitud de cotización ' + c.codigo + ' - ' + EMP.nombre)}&body=${encodeURIComponent(textoRFQ(r, c))}`;
  function docRFQ(reqId, cotId) {
    const r = S.reqs.find(x => x.id === reqId), c = r.cotizaciones.find(x => x.id === cotId);
    const prov = S.proveedores.find(p => p.id === c.proveedorId) || { nombre: c.proveedorNombre };
    const its = cotItems(r, c);
    const w = window.open('', '_blank');
    if (!w) return toast('El navegador bloqueó la ventana. Permita ventanas emergentes para este sitio.', 'err');
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${c.codigo} - Solicitud de cotización</title>
    <style>
      body{font-family:Arial,Helvetica,sans-serif;color:#1d2433;margin:0;padding:24px;background:#eef1f5}
      .doc{background:#fff;max-width:780px;margin:0 auto;padding:36px 40px;box-shadow:0 2px 12px rgba(0,0,0,.08)}
      .hd{display:flex;justify-content:space-between;gap:16px;border-bottom:3px solid #1f5fbf;padding-bottom:14px}
      .hd h1{margin:0;font-size:22px;color:#1f5fbf}.hd p{margin:2px 0;font-size:12px;color:#555}
      .num{text-align:right}.num b{display:block;font-size:20px}
      h2{font-size:16px;margin:22px 0 8px;letter-spacing:.5px}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;font-size:13px}.grid span{color:#666}
      table{width:100%;border-collapse:collapse;margin-top:10px;font-size:13px}
      th,td{border:1px solid #c9d1dd;padding:7px 8px;text-align:left}th{background:#eef3fb}
      td.r,th.r{text-align:right}td.blank{width:110px}
      .obs{font-size:13px;background:#f7f9fc;border:1px solid #e3e7ee;padding:10px 12px;border-radius:4px;white-space:pre-wrap}
      .ft{margin-top:40px;display:flex;justify-content:space-between;font-size:12px;color:#444}
      .firma{border-top:1px solid #888;padding-top:4px;width:240px}
      .bar{max-width:780px;margin:0 auto 12px;display:flex;gap:8px;justify-content:flex-end}
      .bar button{font:inherit;padding:8px 14px;border-radius:6px;border:1px solid #1f5fbf;background:#1f5fbf;color:#fff;cursor:pointer}
      .bar button.g{background:#fff;color:#1f5fbf}
      @media print{body{background:#fff;padding:0}.doc{box-shadow:none;padding:0}.bar{display:none}}
      @media (max-width:600px){body{padding:8px}.doc{padding:18px}.grid{grid-template-columns:1fr}.hd{flex-direction:column}.num{text-align:left}}
    </style></head><body>
    <div class="bar"><button class="g" onclick="navigator.clipboard&&navigator.clipboard.writeText(document.getElementById('txt').value).then(()=>alert('Texto copiado'))">Copiar texto</button><button onclick="print()">Imprimir / Guardar PDF</button></div>
    <div class="doc">
      <div class="hd"><div><h1>${esc(EMP.nombre)}</h1><p>${esc(EMP.nit || '')}</p><p>${esc(EMP.direccion || '')} ${esc(EMP.ciudad || '')}</p><p>${esc(EMP.telefono || '')} · ${esc(EMP.email || '')}</p></div>
        <div class="num"><span>SOLICITUD DE COTIZACIÓN</span><b>No. ${c.codigo}</b><p>Fecha: ${fdate(c.fechaSolicitud)}</p></div></div>
      <h2>PROVEEDOR</h2>
      <div class="grid"><div><span>Razón social:</span> ${esc(prov.nombre)}</div><div><span>NIT:</span> ${esc(prov.nit || '')}</div>
        <div><span>Contacto:</span> ${esc(prov.contacto || '')}</div><div><span>Teléfono:</span> ${esc(prov.telefono || '')}</div>
        <div><span>Correo:</span> ${esc(prov.email || '')}</div><div><span>Ciudad:</span> ${esc(prov.ciudad || '')}</div></div>
      <h2>DATOS DE LA SOLICITUD</h2>
      <div class="grid"><div><span>Proyecto / lugar de entrega:</span> ${esc(r.proyecto)}</div><div><span>Requisición interna:</span> ${code(r)}</div>
        ${c.fechaLimite ? `<div><span>Responder antes de:</span> ${fdate(c.fechaLimite + 'T12:00:00')}</div>` : ''}${r.fechaRequerida ? `<div><span>Material requerido para:</span> ${fdate(r.fechaRequerida + 'T12:00:00')}</div>` : ''}</div>
      <table><thead><tr><th>#</th><th>Descripción</th><th class="r">Cantidad</th><th>Unidad</th><th class="r">Vr. unitario</th><th class="r">Vr. total</th></tr></thead>
      <tbody>${its.map((i, k) => `<tr><td>${k + 1}</td><td>${esc(i.descripcion)}</td><td class="r">${i.cantidad}</td><td>${esc(i.unidad)}</td><td class="blank"></td><td class="blank"></td></tr>`).join('')}
      <tr><td colspan="5" class="r"><b>Subtotal</b></td><td></td></tr><tr><td colspan="5" class="r"><b>IVA</b></td><td></td></tr><tr><td colspan="5" class="r"><b>TOTAL</b></td><td></td></tr></tbody></table>
      <h2>OBSERVACIONES Y CONDICIONES</h2>
      <div class="obs">${c.observaciones ? esc(c.observaciones) + '\n' : ''}Favor indicar en su cotización: precio unitario antes de IVA, valor del IVA, costo de transporte (si aplica), tiempo de entrega, forma de pago y validez de la oferta.
Enviar la cotización respondiendo a este mensaje o al correo ${esc(EMP.email || '')}, citando el número ${c.codigo}.</div>
      <div class="ft"><div class="firma">${esc((c.solicitadaPorNombre || S.user.nombre).split(' (')[0])}<br>Compras · ${esc(EMP.nombre)}</div><div>Documento generado automáticamente</div></div>
    </div>
    <textarea id="txt" style="position:absolute;left:-9999px">${esc(textoRFQ(r, c))}</textarea>
    </body></html>`);
    w.document.close();
  }

  /* ------------------------------------------------------------ COTIZACIONES */
  function viewCots() {
    const all = allCots();
    const tabs = [['solicitada', 'Esperando proveedor'], ['recibida', 'Por aprobar'], ['aprobada', 'Por pagar'], ['pagada', 'Pagadas'], ['todas', 'Todas']];
    const L = all.filter(x => S.cotTab === 'todas' || x.c.estado === S.cotTab)
      .sort((a, b) => String(b.c.fechaRecibida || b.c.fechaSolicitud).localeCompare(String(a.c.fechaRecibida || a.c.fechaSolicitud)));
    const desde = c => c.estado === 'solicitada' ? c.fechaSolicitud : c.estado === 'recibida' ? c.fechaRecibida : c.estado === 'aprobada' ? c.fechaDecision : null;
    const sum = L.reduce((s, x) => s + (x.c.total || 0), 0);
    return `<section class="card"><h1>Cotizaciones</h1>
      <div class="tabs">${tabs.map(([k, l]) => `<button class="${S.cotTab === k ? 'on' : ''}" onclick="App.cotTab('${k}')">${l} <span class="count">${k === 'todas' ? all.length : all.filter(x => x.c.estado === k).length}</span></button>`).join('')}</div>
      ${sum ? `<p class="muted">Total en esta vista: <b>${money(sum)}</b></p>` : ''}
      ${L.length ? `<div class="scroll-x"><table class="tbl hover"><thead><tr><th>Cotización</th><th>Proveedor</th><th>Solicitud / proyecto</th><th class="r">Ítems</th><th class="r">Total</th><th>Estado</th><th>En este estado</th></tr></thead><tbody>
        ${L.map(({ r, c }) => { const d = desde(c); return `<tr onclick="location.hash='#/req/${r.id}'">
          <td><b>${c.codigo}</b></td><td>${esc(c.proveedorNombre)}</td><td>${code(r)}<br><small class="muted">${esc(r.proyecto)}</small></td>
          <td class="r">${c.itemIds.length}</td><td class="r">${c.total ? money(c.total) : '—'}</td><td>${badge(COT_EST, c.estado)}</td>
          <td>${d ? `<span class="${atrasado(d) ? 't-red' : ''}">${dur(edad(d))}</span>` : '—'}</td></tr>`; }).join('')}
      </tbody></table></div>` : '<p class="empty">No hay cotizaciones en este estado.</p>'}</section>`;
  }

  /* ------------------------------------------------------------ REPORTES */
  function reqsReporte() {
    const { desde, hasta, proyecto } = S.rep;
    return S.reqs.filter(r => (!proyecto || r.proyectoId === proyecto) && (!desde || r.creado.slice(0, 10) >= desde) && (!hasta || r.creado.slice(0, 10) <= hasta));
  }
  function metricas(reqs) {
    const M = { jefe: [], compras: [], proveedor: [], aprobCot: [], pago: [] };
    const Q = { jefe: [], compras: [], proveedor: [], aprobCot: [], pago: [] };
    for (const r of reqs) {
      for (const i of r.items) {
        const st = itemStage(r, i);
        if (['aprobado', 'rechazado', 'cotizando', 'cotizado', 'por_pagar', 'pagado'].includes(st) && i.decididoEn) M.jefe.push({ ms: diff(i.creado || r.creado, i.decididoEn), p: i.decididoPorNombre });
        if (st === 'revision' || st === 'espera') Q.jefe.push({ ms: edad(i.creado || r.creado), r });
        if (st === 'aprobado') Q.compras.push({ ms: edad(i.decididoEn), r });
      }
      for (const c of r.cotizaciones) {
        if (c.estado === 'anulada') continue;
        const base = maxT(cotItems(r, c).map(i => i.decididoEn));
        if (base) M.compras.push({ ms: diff(base, c.fechaSolicitud), p: c.solicitadaPorNombre });
        if (c.fechaRecibida) M.proveedor.push({ ms: diff(c.fechaSolicitud, c.fechaRecibida), p: c.proveedorNombre });
        else if (c.estado === 'solicitada') Q.proveedor.push({ ms: edad(c.fechaSolicitud), r });
        if (c.fechaDecision && c.fechaRecibida) M.aprobCot.push({ ms: diff(c.fechaRecibida, c.fechaDecision), p: c.decididaPorNombre });
        else if (c.estado === 'recibida') Q.aprobCot.push({ ms: edad(c.fechaRecibida), r });
        if (c.pago) M.pago.push({ ms: diff(c.fechaDecision, c.pago.registrado), p: c.pago.porNombre });
        else if (c.estado === 'aprobada') Q.pago.push({ ms: edad(c.fechaDecision), r });
      }
    }
    return { M, Q };
  }
  function viewReportes() {
    const reqs = reqsReporte();
    const { M, Q } = metricas(reqs);
    const etapas = Object.keys(ETAPAS).map(k => ({ k, ...ETAPAS[k], prom: avg(M[k].map(x => x.ms)), n: M[k].length, cola: Q[k].length, viejo: Q[k].length ? Math.max(...Q[k].map(x => x.ms)) : null }));
    const maxProm = Math.max(1, ...etapas.map(e => e.prom || 0));
    const lenta = etapas.filter(e => e.prom != null).sort((a, b) => b.prom - a.prom)[0];

    const pers = {};
    for (const k of ['jefe', 'compras', 'aprobCot', 'pago']) for (const x of M[k]) {
      const key = (x.p || '—') + '|' + k; (pers[key] = pers[key] || { p: x.p || '—', k, v: [] }).v.push(x.ms);
    }
    const persL = Object.values(pers).map(x => ({ ...x, prom: avg(x.v) })).sort((a, b) => b.prom - a.prom);

    const cots = reqs.flatMap(r => r.cotizaciones.filter(c => ['aprobada', 'pagada'].includes(c.estado)).map(c => ({ r, c })));
    const agrupar = keyFn => {
      const g = {};
      for (const { r, c } of cots) {
        const k = keyFn(r, c); const x = g[k] = g[k] || { k, n: 0, items: 0, total: 0, pagado: 0 };
        x.n++; x.items += c.itemIds.length; x.total += c.total || 0; x.pagado += c.pago ? num(c.pago.valor) : 0;
      }
      return Object.values(g).sort((a, b) => b.total - a.total);
    };
    const porProv = agrupar((r, c) => c.proveedorNombre), porProy = agrupar(r => r.proyecto);
    const totalComp = cots.reduce((s, x) => s + (x.c.total || 0), 0);
    const totalPag = cots.reduce((s, x) => s + (x.c.pago ? num(x.c.pago.valor) : 0), 0);
    const items = reqs.flatMap(r => r.items.map(i => itemStage(r, i)));
    const cntSt = {}; items.forEach(s => cntSt[s] = (cntSt[s] || 0) + 1);

    const mat = {};
    for (const { r, c } of cots) for (const i of cotItems(r, c)) {
      const k = i.descripcion.trim().toLowerCase(); const x = mat[k] = mat[k] || { d: i.descripcion, u: i.unidad, cant: 0, valor: 0, provs: new Set() };
      x.cant += num(i.cantidad); x.valor += num(c.precios[i.id]) * num(i.cantidad); x.provs.add(c.proveedorNombre);
    }
    const matL = Object.values(mat).sort((a, b) => b.valor - a.valor).slice(0, 10);

    const pendCots = reqs.flatMap(r => r.cotizaciones.filter(c => ['solicitada', 'recibida', 'aprobada'].includes(c.estado)).map(c => ({ r, c, d: c.estado === 'solicitada' ? c.fechaSolicitud : c.estado === 'recibida' ? c.fechaRecibida : c.fechaDecision })))
      .sort((a, b) => String(a.d).localeCompare(String(b.d)));
    const bar = (v, max, cls) => `<div class="bar ${cls || ''}"><span style="width:${max ? Math.max(2, v / max * 100) : 0}%"></span></div>`;
    const grupoTabla = (titulo, L) => `<section class="card"><h2>${titulo}</h2>${L.length ? `<div class="scroll-x"><table class="tbl"><thead><tr><th>${titulo.includes('proveedor') ? 'Proveedor' : 'Proyecto'}</th><th class="r">Compras</th><th class="r">Ítems</th><th class="r">Total aprobado</th><th class="r">Pagado</th><th class="r">Por pagar</th><th style="width:22%">Participación</th></tr></thead><tbody>
      ${L.map(x => `<tr><td><b>${esc(x.k)}</b></td><td class="r">${x.n}</td><td class="r">${x.items}</td><td class="r">${money(x.total)}</td><td class="r">${money(x.pagado)}</td><td class="r">${money(Math.max(0, x.total - x.pagado))}</td><td>${bar(x.total, L[0].total)}<small class="muted">${totalComp ? Math.round(x.total / totalComp * 100) : 0}%</small></td></tr>`).join('')}
      </tbody></table></div>` : '<p class="empty">Sin compras aprobadas en el período.</p>'}</section>`;

    return `<section class="card"><div class="row between wrap"><h1>Reportes</h1>
      <div class="row gap wrap"><button class="btn sm ghost" onclick="App.exportItems()">⬇️ Detalle de ítems (Excel)</button><button class="btn sm ghost" onclick="App.exportProv()">⬇️ Compras por proveedor (Excel)</button></div></div>
      <div class="filters">
        <label>Desde<input type="date" value="${S.rep.desde}" onchange="App.repF('desde',this.value)"></label>
        <label>Hasta<input type="date" value="${S.rep.hasta}" onchange="App.repF('hasta',this.value)"></label>
        <label>Proyecto<select onchange="App.repF('proyecto',this.value)"><option value="">Todos</option>${S.proyectos.map(p => `<option value="${p.id}"${S.rep.proyecto === p.id ? ' selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select></label>
      </div><p class="muted sm">Las fechas filtran por la fecha de creación de la solicitud.</p></section>
    <section class="kpis">
      <div class="kpi"><span>Solicitudes</span><b>${reqs.length}</b><small>${reqs.filter(r => reqInfo(r).cerrada).length} cerradas</small></div>
      <div class="kpi"><span>Ítems solicitados</span><b>${items.length}</b><small>${cntSt.rechazado || 0} rechazados · ${cntSt.espera || 0} pendientes</small></div>
      <div class="kpi"><span>Compras aprobadas</span><b>${money(totalComp)}</b><small>${cots.length} cotizaciones</small></div>
      <div class="kpi"><span>Pagado</span><b>${money(totalPag)}</b><small>Por pagar: ${money(totalComp - totalPag)}</small></div>
    </section>
    <section class="card"><h2>⏱️ ¿Dónde nos estamos demorando?</h2>
      ${lenta ? `<div class="alert amber">La etapa más lenta es <b>${lenta.l}</b> (${lenta.rol}): en promedio <b>${dur(lenta.prom)}</b>.</div>` : '<p class="empty">Aún no hay datos suficientes.</p>'}
      <div class="stages">${etapas.map(e => `<div class="stage ${lenta && e.k === lenta.k ? 'slow' : ''}">
        <div class="stage-h"><b>${e.l}</b><span class="muted sm">${e.rol}</span></div>
        <div class="stage-b">${bar(e.prom || 0, maxProm, lenta && e.k === lenta.k ? 'warn' : '')}<b class="stage-v">${dur(e.prom)}</b></div>
        <div class="muted sm">${e.d}. ${e.n} medición(es).${e.cola ? ` <span class="${atrasado(Date.now() - e.viejo) ? 't-red' : 't-amber'}">Hoy hay ${e.cola} en espera; el más antiguo lleva ${dur(e.viejo)}.</span>` : ''}</div></div>`).join('')}</div>
    </section>
    <section class="card"><h2>👤 Tiempo de respuesta por persona</h2>
      ${persL.length ? `<div class="scroll-x"><table class="tbl"><thead><tr><th>Persona</th><th>Etapa</th><th class="r">Acciones</th><th class="r">Promedio</th><th class="r">Más lenta</th></tr></thead><tbody>
      ${persL.map(x => `<tr><td><b>${esc(x.p)}</b></td><td>${ETAPAS[x.k].l}</td><td class="r">${x.v.length}</td><td class="r ${x.prom > DIAS_ALERTA * 864e5 ? 't-red' : ''}">${dur(x.prom)}</td><td class="r">${dur(Math.max(...x.v))}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="empty">Sin datos.</p>'}
      ${M.proveedor.length ? `<h3>Tiempo de respuesta de proveedores</h3><div class="scroll-x"><table class="tbl"><thead><tr><th>Proveedor</th><th class="r">Cotizaciones</th><th class="r">Promedio</th></tr></thead><tbody>
      ${Object.entries(M.proveedor.reduce((g, x) => ((g[x.p] = g[x.p] || []).push(x.ms), g), {})).map(([p, v]) => ({ p, v, a: avg(v) })).sort((a, b) => a.a - b.a)
        .map(x => `<tr><td>${esc(x.p)}</td><td class="r">${x.v.length}</td><td class="r">${dur(x.a)}</td></tr>`).join('')}</tbody></table></div>` : ''}
    </section>
    <section class="card"><h2>📌 Cotizaciones pendientes</h2>
      ${pendCots.length ? `<div class="scroll-x"><table class="tbl hover"><thead><tr><th>Cotización</th><th>Proveedor</th><th>Proyecto</th><th>Estado</th><th class="r">Total</th><th class="r">Esperando</th></tr></thead><tbody>
      ${pendCots.map(({ r, c, d }) => `<tr onclick="location.hash='#/req/${r.id}'"><td><b>${c.codigo}</b></td><td>${esc(c.proveedorNombre)}</td><td>${esc(r.proyecto)}</td><td>${badge(COT_EST, c.estado)}</td><td class="r">${c.total ? money(c.total) : '—'}</td><td class="r ${atrasado(d) ? 't-red' : ''}">${dur(edad(d))}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="empty">No hay cotizaciones pendientes.</p>'}</section>
    ${grupoTabla('🏪 Compras por proveedor', porProv)}
    ${grupoTabla('🏗️ Compras por proyecto', porProy)}
    <section class="card"><h2>🧱 Materiales con mayor gasto</h2>
      ${matL.length ? `<div class="scroll-x"><table class="tbl"><thead><tr><th>Material</th><th class="r">Cantidad</th><th class="r">Valor (antes de IVA)</th><th>Proveedores</th></tr></thead><tbody>
      ${matL.map(x => `<tr><td>${esc(x.d)}</td><td class="r">${x.cant} ${esc(x.u)}</td><td class="r">${money(x.valor)}</td><td class="sm">${esc([...x.provs].join(', '))}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">Sin datos.</p>'}</section>
    <section class="card"><h2>Estado actual de los ítems</h2><div class="stbars">
      ${Object.keys(ITEM_EST).filter(k => cntSt[k]).map(k => `<div class="stbar"><span class="lbl">${ITEM_EST[k].l}</span>${bar(cntSt[k], Math.max(...Object.values(cntSt)), 'c-' + ITEM_EST[k].c)}<b>${cntSt[k]}</b></div>`).join('')}
    </div></section>`;
  }

  /* ------------------------------------------------------------ ADMIN */
  function viewAdmin() {
    const tabs = [has('admin') && ['usuarios', '👥 Usuarios'], ['proveedores', '🏪 Proveedores'], ['proyectos', '🏗️ Proyectos'], has('admin') && ['datos', '💾 Datos']].filter(Boolean);
    if (!tabs.find(t => t[0] === S.admTab)) S.admTab = tabs[0][0];
    let body = '';
    if (S.admTab === 'usuarios') body = `<div class="row between wrap"><p class="muted">Cada persona entra con su correo y contraseña. Los roles definen qué puede hacer.</p><button class="btn primary" onclick="App.modalUsuario()">＋ Nuevo usuario</button></div>
      <div class="scroll-x"><table class="tbl hover"><thead><tr><th>Nombre</th><th>Correo</th><th>Roles</th><th>Estado</th></tr></thead><tbody>
      ${S.perfiles.map(p => `<tr onclick="App.modalUsuario('${p.id}')"><td><b>${esc(p.nombre || '(sin nombre)')}</b></td><td>${esc(p.email)}</td><td>${(p.roles || []).map(r => `<span class="chip">${ROLES[r] || r}</span>`).join(' ')}</td><td>${p.activo === false ? '<span class="badge b-red">Inactivo</span>' : '<span class="badge b-green">Activo</span>'}</td></tr>`).join('')}
      </tbody></table></div>`;
    if (S.admTab === 'proveedores') body = `<div class="row between wrap"><p class="muted">Estos datos se usan en el documento de solicitud de cotización y en WhatsApp/correo.</p><button class="btn primary" onclick="App.modalProveedor()">＋ Nuevo proveedor</button></div>
      <div class="scroll-x"><table class="tbl hover"><thead><tr><th>Proveedor</th><th>NIT</th><th>Contacto</th><th>Teléfono</th><th>Correo</th><th>Estado</th></tr></thead><tbody>
      ${S.proveedores.map(p => `<tr onclick="App.modalProveedor('${p.id}')"><td><b>${esc(p.nombre)}</b><br><small class="muted">${esc(p.ciudad || '')}</small></td><td>${esc(p.nit || '')}</td><td>${esc(p.contacto || '')}</td><td>${esc(p.telefono || '')}</td><td>${esc(p.email || '')}</td><td>${p.activo === false ? '<span class="badge b-gray">Inactivo</span>' : '<span class="badge b-green">Activo</span>'}</td></tr>`).join('')}
      </tbody></table></div>`;
    if (S.admTab === 'proyectos') body = `<div class="row between wrap"><p class="muted">Obras o proyectos a los que se cargan las solicitudes.</p><button class="btn primary" onclick="App.modalProyecto()">＋ Nuevo proyecto</button></div>
      <div class="scroll-x"><table class="tbl hover"><thead><tr><th>Proyecto</th><th class="r">Solicitudes</th><th>Estado</th></tr></thead><tbody>
      ${S.proyectos.map(p => `<tr onclick="App.modalProyecto('${p.id}')"><td><b>${esc(p.nombre)}</b></td><td class="r">${S.reqs.filter(r => r.proyectoId === p.id).length}</td><td>${p.activo === false ? '<span class="badge b-gray">Inactivo</span>' : '<span class="badge b-green">Activo</span>'}</td></tr>`).join('')}
      </tbody></table></div>`;
    if (S.admTab === 'datos') body = `<p>Descargue una copia de seguridad de toda la información (solicitudes, cotizaciones, pagos, proveedores y proyectos).</p>
      <div class="row gap wrap"><button class="btn" onclick="App.backup()">⬇️ Descargar copia (JSON)</button><button class="btn" onclick="App.exportItems()">⬇️ Detalle de ítems (Excel)</button>
      ${DEMO ? `<button class="btn danger-ghost" onclick="App.resetDemo()">Reiniciar datos de demostración</button>` : ''}</div>
      <p class="muted sm">Modo actual: <b>${DEMO ? 'Demostración (datos en este navegador)' : GHM ? 'Datos cifrados en el repositorio de GitHub' : 'Supabase (base de datos en la nube)'}</b></p>
      ${GHM ? `<h2>Token de GitHub</h2><p class="muted">Cuando el token venza, la app dejará de guardar cambios. Cree uno nuevo (mismos permisos: solo este repositorio, Contents: Read and write) y péguelo aquí.</p>
      <form class="row gap wrap" onsubmit="App.guardarToken(event)"><input name="token" type="password" autocomplete="off" placeholder="Token nuevo" style="max-width:360px"><button class="btn">Actualizar token</button></form>` : ''}`;
    return `<section class="card"><h1>Administración</h1>
      <div class="tabs">${tabs.map(([k, l]) => `<button class="${S.admTab === k ? 'on' : ''}" onclick="App.admTab('${k}')">${l}</button>`).join('')}</div>${body}</section>`;
  }

  /* ------------------------------------------------------------ ACCIONES */
  const App = {};
  App.cerrarModal = cerrarModal;
  App.addRow = addRow;
  App.demoFill = e => { const f = $('#fLogin'); f.email.value = e; f.pass.value = 'demo123'; f.requestSubmit ? f.requestSubmit() : f.dispatchEvent(new Event('submit')); };
  App.login = async ev => {
    ev.preventDefault(); const f = new FormData(ev.target); const err = $('#loginErr'); err.textContent = '';
    try { busy(true); S.user = await store.login(f.get('email'), f.get('pass'), !!f.get('recordar')); busy(false); if (!location.hash || location.hash === '#/') location.hash = '#/inicio'; await route(); }
    catch (e) { err.textContent = e.message; if (store.needsSetup) paintSetup(); } finally { busyN = 0; busy(false); }
  };
  App.activar = async ev => {
    ev.preventDefault(); const f = new FormData(ev.target); const err = $('#setupErr'); err.textContent = '';
    const clave = f.get('clave');
    if (clave.length < MIN_CLAVE) return err.textContent = `La contraseña debe tener al menos ${MIN_CLAVE} caracteres.`;
    if (clave !== f.get('clave2')) return err.textContent = 'Las contraseñas no coinciden.';
    try {
      busy(true);
      S.user = await store.setup({ token: f.get('token').trim(), nombre: f.get('nombre').trim(), usuario: f.get('usuario').trim(), clave });
      busy(false); toast('Aplicación activada. Cree los proyectos, proveedores y usuarios en Admin.');
      location.hash = '#/admin'; await route();
    } catch (e) { err.textContent = e.message; } finally { busyN = 0; busy(false); }
  };
  App.guardarToken = run(async ev => {
    ev.preventDefault(); const t = String(new FormData(ev.target).get('token') || '').trim();
    if (!t) throw new Error('Pegue el token nuevo');
    await store.updateToken(t); ev.target.reset(); toast('Token actualizado');
  });
  App.logout = run(async () => { await store.logout(); S.user = null; location.hash = ''; paintLogin(); });
  App.resetDemo = () => { if (confirm('¿Borrar todos los datos de este navegador y volver a los datos de prueba?')) { store.reset(); store.logout(); location.hash = ''; location.reload(); } };
  App.toggleUser = () => { const m = $('#userMenu'); m.hidden = !m.hidden; $('#notifPanel').hidden = true; };
  App.toggleNotifs = () => {
    const p = $('#notifPanel'); $('#userMenu').hidden = true;
    if (!p.hidden) { p.hidden = true; return; }
    const unread = S.notifs.filter(n => !n.leida);
    p.innerHTML = `<div class="menu-h row between"><b>Notificaciones</b>${unread.length ? `<button class="link" onclick="App.leerTodas()">Marcar todas como leídas</button>` : ''}</div>
      ${S.notifs.length ? S.notifs.slice(0, 30).map(n => `<button class="notif-i ${n.leida ? '' : 'new'}" onclick="App.abrirNotif('${n.id}','${n.req_id || ''}')"><span>${esc(n.mensaje)}</span><small>${hace(n.creado)}</small></button>`).join('') : '<p class="empty">Sin notificaciones.</p>'}`;
    p.hidden = false;
  };
  App.abrirNotif = run(async (id, reqId) => {
    const n = S.notifs.find(x => x.id === id); if (n && !n.leida) { await store.markRead([id]); n.leida = true; }
    $('#notifPanel').hidden = true;
    if (reqId) { if (location.hash === '#/req/' + reqId) await route(); else location.hash = '#/req/' + reqId; }
  });
  App.leerTodas = run(async () => { const ids = S.notifs.filter(n => !n.leida).map(n => n.id); await store.markRead(ids); S.notifs.forEach(n => n.leida = true); paint(); });
  App.cambiarClave = () => {
    $('#userMenu').hidden = true;
    modal('Cambiar contraseña', `<form onsubmit="App.guardarClave(event)">
      <label>Nueva contraseña<input type="password" name="p1" minlength="${MIN_CLAVE}" required autocomplete="new-password"></label>
      <label>Repetir contraseña<input type="password" name="p2" minlength="${MIN_CLAVE}" required autocomplete="new-password"></label>
      <p class="muted sm">Mínimo ${MIN_CLAVE} caracteres.</p><div class="actions"><button class="btn primary">Guardar</button></div></form>`);
  };
  App.guardarClave = run(async ev => {
    ev.preventDefault(); const f = new FormData(ev.target);
    if (f.get('p1') !== f.get('p2')) throw new Error('Las contraseñas no coinciden');
    await store.changePassword(f.get('p1')); cerrarModal(); toast('Contraseña actualizada');
  });

  // Nueva solicitud
  App.togglePaste = () => { const b = $('#pasteBox'); b.hidden = !b.hidden; if (!b.hidden) $('#pasteTxt').focus(); };
  App.parsePaste = cont => {
    const its = parseLines($('#pasteTxt').value); if (!its.length) return;
    $$('#' + cont + ' .irow').forEach(row => { if (!$('.i-desc', row).value.trim()) row.remove(); });
    its.forEach(i => addRow(cont, i)); $('#pasteTxt').value = ''; $('#pasteBox').hidden = true;
    toast(its.length + ' ítem(s) agregados. Revise cantidades y unidades.');
  };
  App.crearReq = run(async ev => {
    ev.preventDefault(); const f = new FormData(ev.target);
    const items = collectRows('itemRows');
    if (!items.length) throw new Error('Agregue al menos un ítem con descripción');
    const p = S.proyectos.find(x => x.id === f.get('proyectoId')); if (!p) throw new Error('Seleccione el proyecto');
    const t = now();
    const req = {
      id: newId(), proyectoId: p.id, proyecto: p.nombre, solicitantes: f.get('solicitantes').trim(), prioridad: f.get('prioridad'),
      fechaRequerida: f.get('fechaRequerida') || null, notas: f.get('notas').trim(), creado: t, creadoPor: S.user.id, creadoPorNombre: S.user.nombre,
      items: items.map(i => ({ id: newId(), ...i, estado: 'revision', nota: '', creado: t })), cotizaciones: [], eventos: []
    };
    log(req, 'Solicitud creada', `${items.length} ítem(s) · Solicitado por: ${req.solicitantes}`);
    const saved = await store.createReq(req);
    await notificar(['jefe'], `Nueva solicitud ${code(saved)} (${p.nombre}) con ${items.length} ítem(s) por revisar${req.prioridad === 'urgente' ? ' · URGENTE' : ''}`, saved.id);
    toast('Solicitud ' + code(saved) + ' enviada a aprobación');
    location.hash = '#/req/' + saved.id;
  });
  App.modalAgregar = id => {
    modal('Agregar ítems a la solicitud', `<form onsubmit="App.guardarAgregar(event,'${id}')">
      <div id="addRows"></div>
      <div class="row gap wrap"><button type="button" class="btn sm" onclick="App.addRow('addRows')">＋ Otro ítem</button></div>
      <p class="muted sm">Los ítems nuevos quedan "Por revisar" y se notifica a los jefes.</p>
      <div class="actions"><button class="btn primary">Agregar</button></div></form>`, true);
    addRow('addRows');
  };
  App.guardarAgregar = run(async (ev, id) => {
    ev.preventDefault(); const items = collectRows('addRows'); if (!items.length) throw new Error('Escriba al menos un ítem');
    const res = await mutate(id, r => {
      const t = now(); items.forEach(i => r.items.push({ id: newId(), ...i, estado: 'revision', nota: '', creado: t }));
      log(r, 'Ítems agregados', items.map(i => `${i.cantidad} ${i.unidad} ${i.descripcion}`).join(' · '));
    });
    await notificar(['jefe'], `${code(res.r)}: se agregaron ${items.length} ítem(s) por revisar`, id);
    cerrarModal(); toast('Ítems agregados'); paint();
  });

  // Revisión de jefes
  App.marcarTodos = (form, v) => $$(`input[type=radio][value=${v}]`, form).forEach(x => x.checked = true);
  App.guardarRevision = run(async (ev, id) => {
    ev.preventDefault(); const f = new FormData(ev.target);
    const r0 = S.reqs.find(x => x.id === id);
    const dec = r0.items.filter(i => ['revision', 'espera'].includes(i.estado)).map(i => ({
      id: i.id, v: f.get('d_' + i.id), nota: String(f.get('n_' + i.id) || '').trim(), cant: num(f.get('c_' + i.id))
    })).filter(d => d.v);
    if (!dec.length) throw new Error('No ha marcado ningún ítem');
    const cuenta = { aprobado: 0, espera: 0, rechazado: 0 };
    const res = await mutate(id, r => {
      const cambios = []; Object.keys(cuenta).forEach(k => cuenta[k] = 0);
      for (const d of dec) {
        const it = r.items.find(i => i.id === d.id);
        if (!it || !['revision', 'espera'].includes(it.estado)) continue;
        const cantCambia = d.cant > 0 && d.cant !== it.cantidad;
        if (it.estado === d.v && (it.nota || '') === d.nota && !cantCambia) continue;
        if (cantCambia) { if (it.cantidadSolicitada == null) it.cantidadSolicitada = it.cantidad; it.cantidad = d.cant; }
        Object.assign(it, { estado: d.v, nota: d.nota, decididoEn: now(), decididoPor: S.user.id, decididoPorNombre: S.user.nombre });
        cuenta[d.v]++;
        cambios.push(`${DECISION[d.v]}: ${it.descripcion}${cantCambia ? ` (cant. ${it.cantidad})` : ''}${d.nota ? ' — ' + d.nota : ''}`);
      }
      if (!cambios.length) return false;
      log(r, 'Revisión de jefatura', cambios.join(' · '));
    });
    if (!res) return toast('No hubo cambios');
    const c = code(res.r);
    if (cuenta.aprobado) await notificar(['compras'], `${c}: ${cuenta.aprobado} ítem(s) aprobado(s), listos para cotizar (${res.r.proyecto})`, id);
    await notificar([], `${c} revisada: ${cuenta.aprobado} aprobado(s), ${cuenta.espera} pendiente(s), ${cuenta.rechazado} rechazado(s)`, id, [res.r.creadoPor]);
    toast('Decisión guardada'); paint();
  });

  // Solicitud de cotización (RFQ)
  App.modalRFQ = (id, directa) => {
    const r = S.reqs.find(x => x.id === id);
    const its = r.items.filter(i => ['aprobado', 'cotizando', 'cotizado'].includes(itemStage(r, i)));
    const provs = S.proveedores.filter(p => p.activo !== false);
    modal(directa ? 'Registrar cotización ya recibida' : 'Solicitar cotización', `<form onsubmit="App.crearRFQ(event,'${id}',${!!directa})">
      <h3>Ítems a cotizar</h3>
      <div class="checks">${its.map(i => { const st = itemStage(r, i); return `<label class="check"><input type="checkbox" name="it" value="${i.id}" ${st === 'aprobado' ? 'checked' : ''}> ${esc(i.descripcion)} <span class="muted">· ${i.cantidad} ${esc(i.unidad)}</span> ${st !== 'aprobado' ? badge(ITEM_EST, st) : ''}</label>`; }).join('')}</div>
      <h3>${directa ? 'Proveedor' : 'Proveedor(es)'} <small class="muted">${directa ? '' : '— se genera un documento por proveedor'}</small></h3>
      <div class="checks">${provs.map(p => `<label class="check"><input type="${directa ? 'radio' : 'checkbox'}" name="pv" value="${p.id}"> ${esc(p.nombre)} <span class="muted">${esc(p.telefono || '')}</span></label>`).join('') || '<p class="muted">No hay proveedores registrados.</p>'}</div>
      <details ${provs.length ? '' : 'open'}><summary>＋ Proveedor nuevo</summary><div class="grid2">
        <label>Nombre<input name="nvNombre"></label><label>Teléfono / WhatsApp<input name="nvTel" inputmode="tel"></label>
        <label>Correo<input name="nvEmail" type="email"></label><label>NIT<input name="nvNit"></label></div></details>
      ${directa ? '' : `<div class="grid2"><label>Responder antes de<input type="date" name="limite"></label></div>
      <label>Observaciones para el proveedor<textarea name="obs" rows="2">Entrega en obra: ${esc(r.proyecto)}</textarea></label>`}
      <div class="actions"><button class="btn primary">${directa ? 'Continuar e ingresar precios' : 'Generar solicitud(es) de cotización'}</button></div></form>`, true);
  };
  App.crearRFQ = run(async (ev, id, directa) => {
    ev.preventDefault(); const f = new FormData(ev.target);
    const itemIds = f.getAll('it'); let provIds = f.getAll('pv');
    if (!itemIds.length) throw new Error('Seleccione al menos un ítem');
    const nv = String(f.get('nvNombre') || '').trim();
    if (nv) {
      const p = await store.upsert('proveedores', { id: newId(), nombre: nv, telefono: String(f.get('nvTel') || '').trim(), email: String(f.get('nvEmail') || '').trim(), nit: String(f.get('nvNit') || '').trim(), contacto: '', ciudad: '', activo: true });
      S.proveedores.push(p); provIds = directa ? [p.id] : [...provIds, p.id];
    }
    if (!provIds.length) throw new Error('Seleccione o cree un proveedor');
    let creadas = [];
    const res = await mutate(id, r => {
      creadas = [];
      for (const pid of provIds) {
        const p = S.proveedores.find(x => x.id === pid);
        const c = {
          id: newId(), codigo: `SC-${String(r.numero).padStart(4, '0')}-${r.cotizaciones.length + 1}`, proveedorId: p.id, proveedorNombre: p.nombre,
          itemIds: itemIds.filter(x => r.items.some(i => i.id === x)), estado: 'solicitada', fechaSolicitud: now(), solicitadaPor: S.user.id, solicitadaPorNombre: S.user.nombre,
          observaciones: directa ? '' : String(f.get('obs') || '').trim(), fechaLimite: f.get('limite') || null, precios: {}
        };
        r.cotizaciones.push(c); creadas.push(c);
        log(r, directa ? 'Cotización directa iniciada' : 'Solicitud de cotización generada', `${c.codigo} a ${p.nombre} (${c.itemIds.length} ítem(s))`);
      }
    });
    if (directa) return App.modalRespuesta(id, creadas[0].id);
    const r = res.r;
    paint();
    modal('Solicitudes de cotización listas', `<p>Envíe cada documento al proveedor. Queda registrado como <b>esperando proveedor</b> hasta que registre la cotización recibida.</p>
      ${creadas.map(c => { const p = S.proveedores.find(x => x.id === c.proveedorId) || {}; return `<div class="sent"><div><b>${c.codigo}</b> · ${esc(c.proveedorNombre)}<br><small class="muted">${esc(p.telefono || 'sin teléfono')} · ${esc(p.email || 'sin correo')}</small></div>
        <div class="row gap wrap"><button class="btn sm" onclick="App.docRFQ('${r.id}','${c.id}')">📄 Ver / PDF</button><a class="btn sm" target="_blank" rel="noopener" href="${waLink(r, c, p)}">💬 WhatsApp</a><a class="btn sm" href="${mailLink(r, c, p)}">✉️ Correo</a></div></div>`; }).join('')}
      <div class="actions"><button class="btn primary" onclick="App.cerrarModal()">Listo</button></div>`, true);
  });
  App.docRFQ = docRFQ;
  App.modalRespuesta = (id, cid) => {
    const r = S.reqs.find(x => x.id === id), c = r.cotizaciones.find(x => x.id === cid);
    const its = cotItems(r, c);
    modal(`Cotización ${c.codigo} · ${esc(c.proveedorNombre)}`, `<form id="fCot" onsubmit="App.guardarCot(event,'${id}','${cid}')" oninput="App.calcCot()">
      <p class="muted sm">Ingrese el valor unitario de cada ítem. Deje en blanco los ítems que el proveedor no cotizó.</p>
      <div class="scroll-x"><table class="tbl"><thead><tr><th>Ítem</th><th class="r">Cant.</th><th class="r">Vr. unitario</th><th class="r">Subtotal</th></tr></thead><tbody>
      ${its.map(i => `<tr><td>${esc(i.descripcion)}</td><td class="r">${i.cantidad} ${esc(i.unidad)}</td><td class="r"><input class="money" type="number" min="0" step="any" inputmode="decimal" name="p_${i.id}" data-cant="${i.cantidad}" value="${c.precios[i.id] ?? ''}"></td><td class="r" id="st_${i.id}">—</td></tr>`).join('')}
      </tbody></table></div>
      <div class="grid3">
        <label>IVA %<input type="number" name="ivaPct" value="${c.ivaPct ?? 19}" min="0" step="any"></label>
        <label>Flete / otros<input type="number" name="otros" value="${c.otros || 0}" min="0" step="any"></label>
        <label class="check mt"><input type="checkbox" name="ivaInc" ${c.ivaInc ? 'checked' : ''}> Los precios ya incluyen IVA</label>
      </div>
      <div class="totbox" id="cotTot"></div>
      <div class="grid3">
        <label>Tiempo de entrega<input name="entrega" value="${esc(c.entrega || '')}" placeholder="Ej: 2 días"></label>
        <label>Forma de pago<input name="formaPago" list="fpagos" value="${esc(c.formaPago || '')}" placeholder="Contado, crédito 30 días…"></label>
        <label>Validez<input name="validez" value="${esc(c.validez || '')}" placeholder="Ej: 15 días"></label>
      </div>
      <datalist id="fpagos"><option>Contado</option><option>Contraentrega</option><option>Anticipo 50%</option><option>Crédito 30 días</option><option>Crédito 60 días</option></datalist>
      <label>Archivo de la cotización (PDF o foto)<input type="file" name="archivo" accept="application/pdf,image/*"></label>
      <label>Nota para los jefes<textarea name="nota" rows="2" placeholder="Ej: es el único que tiene entrega inmediata">${esc(c.notaCompras || '')}</textarea></label>
      <div class="actions"><button class="btn primary">Guardar y enviar a aprobación</button></div></form>`, true);
    App.calcCot();
  };
  App.calcCot = () => {
    const f = $('#fCot'); if (!f) return;
    let sub = 0;
    $$('input[name^=p_]', f).forEach(inp => { const v = num(inp.value) * num(inp.dataset.cant); sub += v; $('#st_' + inp.name.slice(2)).textContent = inp.value ? money(v) : '—'; });
    const pct = num(f.ivaPct.value) / 100, inc = f.ivaInc.checked, otros = num(f.otros.value);
    const iva = inc ? sub - sub / (1 + pct) : sub * pct, total = (inc ? sub : sub + iva) + otros;
    $('#cotTot').innerHTML = `<span>Subtotal${inc ? ' (IVA incl.)' : ''}: <b>${money(sub)}</b></span><span>IVA: <b>${money(iva)}</b></span>${otros ? `<span>Otros: <b>${money(otros)}</b></span>` : ''}<span class="big">Total: <b>${money(total)}</b></span>`;
  };
  App.guardarCot = run(async (ev, id, cid) => {
    ev.preventDefault(); const f = new FormData(ev.target);
    const r0 = S.reqs.find(x => x.id === id), c0 = r0.cotizaciones.find(x => x.id === cid);
    const precios = {};
    c0.itemIds.forEach(i => { const v = f.get('p_' + i); if (v !== '' && v != null && num(v) > 0) precios[i] = num(v); });
    if (!Object.keys(precios).length) throw new Error('Ingrese el precio de al menos un ítem');
    let archivo = c0.archivo || null;
    const file = f.get('archivo'); if (file && file.size) archivo = await store.uploadFile(file, id);
    const res = await mutate(id, r => {
      const c = r.cotizaciones.find(x => x.id === cid);
      if (!['solicitada', 'recibida'].includes(c.estado)) throw new Error('Esta cotización ya fue decidida');
      c.itemIds = c.itemIds.filter(i => precios[i] != null);
      c.precios = precios;
      Object.assign(c, cotTotals(cotItems(r, c), precios, f.get('ivaPct'), !!f.get('ivaInc'), f.get('otros')), {
        ivaPct: num(f.get('ivaPct')), ivaInc: !!f.get('ivaInc'), otros: num(f.get('otros')),
        entrega: String(f.get('entrega') || '').trim(), formaPago: String(f.get('formaPago') || '').trim(), validez: String(f.get('validez') || '').trim(),
        notaCompras: String(f.get('nota') || '').trim(), archivo, estado: 'recibida', fechaRecibida: now(), recibidaPor: S.user.id, recibidaPorNombre: S.user.nombre
      });
      log(r, 'Cotización recibida', `${c.codigo} · ${c.proveedorNombre} · ${money(c.total)}${c.notaCompras ? ' · ' + c.notaCompras : ''}`);
    });
    const c = res.r.cotizaciones.find(x => x.id === cid);
    await notificar(['jefe'], `${code(res.r)}: cotización ${c.codigo} de ${c.proveedorNombre} por ${money(c.total)} lista para aprobar`, id);
    cerrarModal(); toast('Cotización enviada a los jefes para aprobación'); paint();
  });
  App.anularCot = run(async (id, cid) => {
    const motivo = prompt('¿Por qué se anula esta solicitud de cotización? (ej: proveedor no respondió)'); if (motivo == null) return;
    await mutate(id, r => { const c = r.cotizaciones.find(x => x.id === cid); c.estado = 'anulada'; c.notaJefe = 'Anulada: ' + motivo; log(r, 'Cotización anulada', `${c.codigo} · ${c.proveedorNombre} · ${motivo}`); });
    toast('Cotización anulada'); paint();
  });
  App.verArchivo = run(abrirArchivo);

  // Decisión sobre cotización
  App.modalDecision = (id, cid, dec) => {
    const r = S.reqs.find(x => x.id === id), c = r.cotizaciones.find(x => x.id === cid);
    const otras = r.cotizaciones.filter(x => x.id !== cid && ['solicitada', 'recibida'].includes(x.estado) && x.itemIds.some(i => c.itemIds.includes(i)));
    modal(dec === 'aprobada' ? 'Aprobar cotización' : 'Rechazar cotización', `<form onsubmit="App.decidirCot(event,'${id}','${cid}','${dec}')">
      <p><b>${c.codigo}</b> · ${esc(c.proveedorNombre)} · <b>${money(c.total)}</b></p>
      ${dec === 'aprobada' ? `<p class="muted">Se notificará a Tesorería para el pago y a Compras.</p>${otras.length ? `<div class="alert">Las otras cotizaciones abiertas que cubran los mismos ítems (${otras.map(x => esc(x.proveedorNombre)).join(', ')}) se marcarán como descartadas.</div>` : ''}` : '<p class="muted">Compras será notificado y podrá pedir otra cotización.</p>'}
      <label>${dec === 'aprobada' ? 'Comentario (opcional)' : 'Motivo del rechazo *'}<textarea name="nota" rows="2" ${dec === 'rechazada' ? 'required' : ''}></textarea></label>
      <div class="actions"><button class="btn ${dec === 'aprobada' ? 'success' : 'danger'}">${dec === 'aprobada' ? '✓ Aprobar' : '✕ Rechazar'}</button></div></form>`);
  };
  App.decidirCot = run(async (ev, id, cid, dec) => {
    ev.preventDefault(); const nota = String(new FormData(ev.target).get('nota') || '').trim();
    const res = await mutate(id, r => {
      const c = r.cotizaciones.find(x => x.id === cid);
      if (c.estado !== 'recibida') throw new Error('Esta cotización ya no está por aprobar');
      if (dec === 'aprobada') {
        const ya = r.cotizaciones.filter(x => x.id !== cid && ['aprobada', 'pagada'].includes(x.estado)).flatMap(x => x.itemIds);
        const choque = c.itemIds.filter(i => ya.includes(i));
        if (choque.length) throw new Error('Estos ítems ya tienen otra cotización aprobada: ' + choque.map(i => r.items.find(x => x.id === i).descripcion).join(', '));
      }
      Object.assign(c, { estado: dec, fechaDecision: now(), decididaPor: S.user.id, decididaPorNombre: S.user.nombre, notaJefe: nota });
      log(r, dec === 'aprobada' ? 'Cotización aprobada' : 'Cotización rechazada', `${c.codigo} · ${c.proveedorNombre} · ${money(c.total)}${nota ? ' · ' + nota : ''}`);
      if (dec === 'aprobada') {
        const cub = new Set(r.cotizaciones.filter(x => ['aprobada', 'pagada'].includes(x.estado)).flatMap(x => x.itemIds));
        r.cotizaciones.filter(x => ['solicitada', 'recibida'].includes(x.estado) && x.itemIds.every(i => cub.has(i))).forEach(x => {
          x.estado = 'descartada'; x.notaJefe = 'Descartada al aprobarse ' + c.codigo;
          log(r, 'Cotización descartada', `${x.codigo} · ${x.proveedorNombre}`);
        });
      }
    });
    const c = res.r.cotizaciones.find(x => x.id === cid), k = code(res.r);
    if (dec === 'aprobada') {
      await notificar(['tesoreria'], `${k}: cotización ${c.codigo} (${c.proveedorNombre}) aprobada por ${money(c.total)}. Pendiente de pago`, id);
      await notificar(['compras'], `${k}: se aprobó la cotización ${c.codigo} de ${c.proveedorNombre}`, id);
    } else await notificar(['compras'], `${k}: cotización ${c.codigo} de ${c.proveedorNombre} RECHAZADA · ${nota}`, id);
    cerrarModal(); toast(dec === 'aprobada' ? 'Cotización aprobada; se notificó a Tesorería' : 'Cotización rechazada'); paint();
  });

  // Pago
  App.modalPago = (id, cid) => {
    const r = S.reqs.find(x => x.id === id), c = r.cotizaciones.find(x => x.id === cid);
    modal('Registrar pago', `<form onsubmit="App.guardarPago(event,'${id}','${cid}')">
      <p><b>${c.codigo}</b> · ${esc(c.proveedorNombre)} · Total aprobado <b>${money(c.total)}</b>${c.formaPago ? ' · ' + esc(c.formaPago) : ''}</p>
      <div class="grid2">
        <label>Fecha de pago<input type="date" name="fecha" value="${today()}" required></label>
        <label>Valor pagado<input type="number" name="valor" value="${Math.round(c.total)}" min="0" step="any" required></label>
        <label>Medio<select name="medio"><option>Transferencia</option><option>Efectivo</option><option>Cheque</option><option>Tarjeta</option><option>Crédito del proveedor</option></select></label>
        <label>Referencia / No. comprobante<input name="referencia"></label>
      </div>
      <label>Soporte de pago (opcional)<input type="file" name="soporte" accept="application/pdf,image/*"></label>
      <label>Nota<textarea name="nota" rows="2"></textarea></label>
      <div class="actions"><button class="btn primary">💵 Registrar pago</button></div></form>`);
  };
  App.guardarPago = run(async (ev, id, cid) => {
    ev.preventDefault(); const f = new FormData(ev.target);
    let soporte = null; const file = f.get('soporte'); if (file && file.size) soporte = await store.uploadFile(file, id);
    const res = await mutate(id, r => {
      const c = r.cotizaciones.find(x => x.id === cid);
      if (c.estado !== 'aprobada') throw new Error('Esta cotización no está pendiente de pago');
      c.pago = { fecha: f.get('fecha'), valor: num(f.get('valor')), medio: f.get('medio'), referencia: String(f.get('referencia') || '').trim(), nota: String(f.get('nota') || '').trim(), soporte, registrado: now(), por: S.user.id, porNombre: S.user.nombre };
      c.estado = 'pagada';
      log(r, 'Pago registrado', `${c.codigo} · ${c.proveedorNombre} · ${money(c.pago.valor)} · ${c.pago.medio}${c.pago.referencia ? ' · Ref. ' + c.pago.referencia : ''}`);
    });
    const c = res.r.cotizaciones.find(x => x.id === cid), k = code(res.r);
    await notificar(['compras'], `${k}: pago registrado a ${c.proveedorNombre} por ${money(c.pago.valor)}. Ya se puede realizar la compra`, id, [res.r.creadoPor]);
    if (res.cerro) await notificar(['jefe'], `${k} quedó cerrada: todos los ítems resueltos`, id, [res.r.creadoPor]);
    cerrarModal(); toast('Pago registrado'); paint();
  });

  // Listas y filtros
  App.filtro = (k, v) => { S.f[k] = v; pintarListaReqs(); };
  App.cotTab = k => { S.cotTab = k; paint(); };
  App.admTab = k => { S.admTab = k; paint(); };
  App.repF = (k, v) => { S.rep[k] = v; paint(); };

  // Admin
  App.modalUsuario = id => {
    if (!has('admin')) return;
    const u = id ? S.perfiles.find(p => p.id === id) : { roles: ['solicitante'], activo: true };
    modal(id ? 'Editar usuario' : 'Nuevo usuario', `<form onsubmit="App.guardarUsuario(event,'${id || ''}')">
      <label>Nombre completo<input name="nombre" required value="${esc(u.nombre || '')}"></label>
      <label>${GHM ? 'Usuario para ingresar' : 'Correo (usuario para ingresar)'}<input name="email" type="${GHM ? 'text' : 'email'}" autocapitalize="none" required value="${esc(u.email || '')}" ${id ? 'disabled' : ''}></label>
      ${id ? (GHM ? `<label>Nueva contraseña (opcional)<input name="password" type="text" minlength="${MIN_CLAVE}" autocomplete="off"><small class="muted">Úsela si la persona olvidó su contraseña o para reactivar un usuario inactivo.</small></label>` : '')
           : `<label>Contraseña inicial<input name="password" type="text" minlength="${MIN_CLAVE}" required autocomplete="off"><small class="muted">Mínimo ${MIN_CLAVE} caracteres. Entréguela por un medio distinto al enlace; la persona podrá cambiarla al entrar.</small></label>`}
      <h3>Roles</h3><div class="checks">${Object.entries(ROLES).map(([k, l]) => `<label class="check"><input type="checkbox" name="roles" value="${k}" ${(u.roles || []).includes(k) ? 'checked' : ''}> ${l}</label>`).join('')}</div>
      ${id ? `<label class="check"><input type="checkbox" name="activo" ${u.activo !== false ? 'checked' : ''}> Usuario activo (puede ingresar)</label>` : ''}
      <div class="actions"><button class="btn primary">Guardar</button></div></form>`);
  };
  App.guardarUsuario = run(async (ev, id) => {
    ev.preventDefault(); const f = new FormData(ev.target); const roles = f.getAll('roles');
    if (!roles.length) throw new Error('Asigne al menos un rol');
    if (id) {
      if (id === S.user.id && !roles.includes('admin')) throw new Error('No puede quitarse a sí mismo el rol de administrador');
      const pw = String(f.get('password') || '');
      if (pw && pw.length < MIN_CLAVE) throw new Error(`La contraseña debe tener al menos ${MIN_CLAVE} caracteres`);
      const antes = S.perfiles.find(p => p.id === id);
      if (GHM && antes && antes.activo === false && f.get('activo') && !pw) throw new Error('Para reactivar el usuario, asígnele una contraseña nueva');
      await store.upsert('perfiles', { id, nombre: f.get('nombre').trim(), roles, activo: !!f.get('activo'), ...(pw ? { password: pw } : {}) });
    } else await store.createUser({ nombre: f.get('nombre').trim(), email: f.get('email').trim(), password: f.get('password'), roles });
    cerrarModal(); toast('Usuario guardado'); await route();
  });
  App.modalProveedor = id => {
    const p = id ? S.proveedores.find(x => x.id === id) : { activo: true };
    modal(id ? 'Editar proveedor' : 'Nuevo proveedor', `<form onsubmit="App.guardarProveedor(event,'${id || ''}')"><div class="grid2">
      <label>Razón social *<input name="nombre" required value="${esc(p.nombre || '')}"></label><label>NIT<input name="nit" value="${esc(p.nit || '')}"></label>
      <label>Contacto<input name="contacto" value="${esc(p.contacto || '')}"></label><label>Teléfono / WhatsApp<input name="telefono" inputmode="tel" value="${esc(p.telefono || '')}"></label>
      <label>Correo<input name="email" type="email" value="${esc(p.email || '')}"></label><label>Ciudad<input name="ciudad" value="${esc(p.ciudad || '')}"></label></div>
      <label class="check"><input type="checkbox" name="activo" ${p.activo !== false ? 'checked' : ''}> Activo</label>
      <div class="actions"><button class="btn primary">Guardar</button></div></form>`);
  };
  App.guardarProveedor = run(async (ev, id) => {
    ev.preventDefault(); const f = new FormData(ev.target);
    const o = { id: id || newId(), activo: !!f.get('activo') };
    ['nombre', 'nit', 'contacto', 'telefono', 'email', 'ciudad'].forEach(k => o[k] = String(f.get(k) || '').trim());
    await store.upsert('proveedores', o); cerrarModal(); toast('Proveedor guardado'); await route();
  });
  App.modalProyecto = id => {
    const p = id ? S.proyectos.find(x => x.id === id) : { activo: true };
    modal(id ? 'Editar proyecto' : 'Nuevo proyecto', `<form onsubmit="App.guardarProyecto(event,'${id || ''}')">
      <label>Nombre del proyecto / obra<input name="nombre" required value="${esc(p.nombre || '')}"></label>
      <label class="check"><input type="checkbox" name="activo" ${p.activo !== false ? 'checked' : ''}> Activo (aparece al crear solicitudes)</label>
      <div class="actions"><button class="btn primary">Guardar</button></div></form>`);
  };
  App.guardarProyecto = run(async (ev, id) => {
    ev.preventDefault(); const f = new FormData(ev.target);
    await store.upsert('proyectos', { id: id || newId(), nombre: f.get('nombre').trim(), activo: !!f.get('activo') });
    cerrarModal(); toast('Proyecto guardado'); await route();
  });
  App.backup = run(async () => {
    const d = await store.loadAll();
    descargar(`respaldo-compras-${today()}.json`, JSON.stringify(d, null, 2), 'application/json');
  });
  App.exportItems = () => {
    const rows = [['Solicitud', 'Fecha', 'Proyecto', 'Solicitado por', 'Prioridad', 'Ítem', 'Cantidad', 'Unidad', 'Estado', 'Decidido por', 'Fecha decisión', 'Comentario jefe', 'Proveedor', 'Cotización', 'Vr. unitario', 'Vr. total (sin IVA)', 'Estado cotización', 'Fecha pago']];
    for (const r of reqsReporte()) for (const i of r.items) {
      const ic = itemCompra(r, i);
      rows.push([code(r), r.creado.slice(0, 10), r.proyecto, r.solicitantes, r.prioridad, i.descripcion, i.cantidad, i.unidad, ITEM_EST[itemStage(r, i)].l, i.decididoPorNombre || '', (i.decididoEn || '').slice(0, 10), i.nota || '',
        ic ? ic.c.proveedorNombre : '', ic ? ic.c.codigo : '', ic ? Math.round(ic.precio) : '', ic ? Math.round(ic.precio * i.cantidad) : '', ic ? COT_EST[ic.c.estado].l : '', ic && ic.c.pago ? ic.c.pago.fecha : '']);
    }
    descargar(`items-compras-${today()}.csv`, csv(rows), 'text/csv;charset=utf-8');
  };
  App.exportProv = () => {
    const rows = [['Proveedor', 'NIT', 'Cotización', 'Solicitud', 'Proyecto', 'Fecha aprobación', 'Total', 'Estado', 'Fecha pago', 'Valor pagado', 'Medio', 'Referencia']];
    for (const r of reqsReporte()) for (const c of r.cotizaciones.filter(x => ['aprobada', 'pagada'].includes(x.estado))) {
      const p = S.proveedores.find(x => x.id === c.proveedorId) || {};
      rows.push([c.proveedorNombre, p.nit || '', c.codigo, code(r), r.proyecto, (c.fechaDecision || '').slice(0, 10), Math.round(c.total), COT_EST[c.estado].l, c.pago ? c.pago.fecha : '', c.pago ? Math.round(c.pago.valor) : '', c.pago ? c.pago.medio : '', c.pago ? c.pago.referencia : '']);
    }
    descargar(`compras-por-proveedor-${today()}.csv`, csv(rows), 'text/csv;charset=utf-8');
  };
  window.App = App;

  /* ------------------------------------------------------------ arranque */
  document.addEventListener('click', e => {
    if (!e.target.closest('.user')) { const m = $('#userMenu'); if (m) m.hidden = true; }
    if (!e.target.closest('#notifPanel') && !e.target.closest('#bell')) { const n = $('#notifPanel'); if (n) n.hidden = true; }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarModal(); });
  window.addEventListener('hashchange', route);
  setInterval(async () => {
    if (!S.user || document.hidden) return;
    try {
      const antes = S.notifs.filter(n => !n.leida).length;
      S.notifs = await store.myNotifs();
      const ahora = S.notifs.filter(n => !n.leida).length;
      const b = $('#bell'); if (b) b.innerHTML = '🔔' + (ahora ? `<span class="dot">${ahora}</span>` : '');
      if (ahora > antes) toast('Tiene ' + (ahora - antes) + ' notificación(es) nueva(s)');
    } catch (e) { }
  }, 30000);

  (async () => {
    try { S.user = await store.init(); }
    catch (e) { S.user = null; $('#app').innerHTML = `<div class="login"><div class="card login-card"><div class="logo">📦</div><p>${esc(e.message)}</p></div></div>`; return; }
    await route();
  })();
})();
