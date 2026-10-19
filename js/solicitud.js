// Enlace público para pedir materiales (sin usuario).
// La solicitud se cifra en el celular con la llave pública de la empresa y se deja en el buzón
// (repositorio privado de GitHub). La app la recoge y la registra como "Por revisar".
// Con la cédula, cada persona consulta el estado de lo que ha pedido.
(() => {
  const $ = s => document.querySelector(s);
  const cfgApp = window.APP_CONFIG || {};
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const UNIDADES = ['und', 'bulto', 'kg', 'galón', 'cuñete', 'lt', 'm', 'm²', 'm³', 'rollo', 'caja', 'paquete', 'par', 'juego', 'global'];
  const ALIAS = { und: 'und', unds: 'und', unidad: 'und', unidades: 'und', u: 'und', bulto: 'bulto', bultos: 'bulto', kg: 'kg', kilo: 'kg', kilos: 'kg', galon: 'galón', 'galón': 'galón', galones: 'galón', gl: 'galón', 'cuñete': 'cuñete', 'cuñetes': 'cuñete', lt: 'lt', litro: 'lt', litros: 'lt', m: 'm', metro: 'm', metros: 'm', ml: 'm', m2: 'm²', m3: 'm³', rollo: 'rollo', rollos: 'rollo', caja: 'caja', cajas: 'caja', paquete: 'paquete', paquetes: 'paquete', par: 'par', pares: 'par', juego: 'juego', juegos: 'juego' };
  const host = location.hostname.toLowerCase();
  const GH = host.endsWith('.github.io') || cfgApp.MODO === 'github';
  const ls = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } } };
  let cfg = null;

  // Repositorio de la app (donde se publica el estado), deducido de <usuario>.github.io/<repo>/
  const repoApp = (() => {
    if (cfgApp.GITHUB_OWNER && cfgApp.GITHUB_REPO) return { owner: cfgApp.GITHUB_OWNER, repo: cfgApp.GITHUB_REPO };
    if (!host.endsWith('.github.io')) return null;
    const seg = location.pathname.split('/').filter(Boolean)[0];
    const owner = host.slice(0, -'.github.io'.length);
    return { owner, repo: seg && !/\.html?$/i.test(seg) ? seg : owner + '.github.io' };
  })();

  $('#empresa').textContent = (cfgApp.EMPRESA && cfgApp.EMPRESA.nombre) || '';
  if (!Sobre.disponible) aviso('Este navegador no permite el cifrado necesario. Abre el enlace en Chrome o Safari actualizado.');

  function aviso(t) { const a = $('#aviso'); a.textContent = t; a.hidden = !t; }
  function error(t) { const e = $('#err'); e.textContent = t || ''; e.hidden = !t; if (t) e.scrollIntoView({ behavior: 'smooth', block: 'center' }); }

  async function cargarConfig() {
    try {
      if (GH) {
        const r = await fetch('solicitud-config.json?t=' + Date.now(), { cache: 'no-store' });
        if (!r.ok) throw 0;
        cfg = await r.json();
        if (!cfg.pub || !cfg.owner || !cfg.repo || !cfg.t) throw 0;
      } else {
        cfg = ls.get('compras_solcfg_demo', null);
        if (!cfg) throw 0;
      }
    } catch (e) {
      cfg = null;
      aviso('Este enlace todavía no está activo. Pide a la oficina de compras que lo active.');
      $('#enviar').disabled = true;
    }
    const sel = $('#proyecto'), txt = $('#proyectoTxt');
    const ps = (cfg && cfg.proyectos) || [];
    if (ps.length) sel.insertAdjacentHTML('beforeend', ps.map(p => `<option>${esc(p)}</option>`).join('') + '<option value="__otro">Otro…</option>');
    else { sel.hidden = true; sel.required = false; txt.hidden = false; txt.required = true; }
    sel.addEventListener('change', () => { const otro = sel.value === '__otro'; txt.hidden = !otro; txt.required = otro; if (otro) txt.focus(); });
    const ult = ls.get('sol_datos', {});
    if (ult.proyecto && ps.includes(ult.proyecto)) sel.value = ult.proyecto;
  }

  // ---------- ítems ----------
  function fila(d = {}) {
    $('#items').insertAdjacentHTML('beforeend', `<div class="irow">
      <input class="i-desc" placeholder="Ej: cemento gris 50 kg" value="${esc(d.descripcion || '')}" aria-label="Material">
      <input class="i-cant" type="number" min="0" step="any" inputmode="decimal" placeholder="Cant." value="${d.cantidad ?? ''}" aria-label="Cantidad">
      <select class="i-und" aria-label="Unidad">${UNIDADES.map(u => `<option${u === (d.unidad || 'und') ? ' selected' : ''}>${u}</option>`).join('')}</select>
      <button type="button" class="icon" title="Quitar" onclick="this.parentNode.remove()">✕</button></div>`);
  }
  function filas() {
    return [...document.querySelectorAll('#items .irow')].map(r => ({
      descripcion: r.querySelector('.i-desc').value.trim(), cantidad: Number(String(r.querySelector('.i-cant').value).replace(',', '.')) || 1, unidad: r.querySelector('.i-und').value
    })).filter(i => i.descripcion);
  }
  function convertir() {
    const lineas = $('#pasteTxt').value.split(/\r?\n/).map(l => l.replace(/^\s*[-•*·\d]+[.)]\s+/, '').trim()).filter(Boolean);
    if (!lineas.length) return;
    document.querySelectorAll('#items .irow').forEach(r => { if (!r.querySelector('.i-desc').value.trim()) r.remove(); });
    for (const l of lineas) {
      const m = l.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
      if (!m) { fila({ descripcion: l, cantidad: 1 }); continue; }
      let resto = m[2].trim(), unidad = 'und';
      const w = resto.split(/\s+/)[0] || '', k = w.toLowerCase().replace(/[.,]$/, '');
      if (ALIAS[k]) { unidad = ALIAS[k]; resto = resto.slice(w.length).replace(/^\s*(de\s+)?/i, ''); }
      fila({ descripcion: resto || l, cantidad: Number(m[1].replace(',', '.')), unidad });
    }
    $('#pasteTxt').value = ''; $('#pasteBox').hidden = true;
  }

  // ---------- envío ----------
  async function api(ruta, cuerpo, token) {
    const r = await fetch('https://api.github.com/repos/' + cfg.owner + '/' + cfg.repo + ruta, {
      method: 'POST', headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo)
    });
    if (!r.ok) throw { status: r.status };
    return r.json();
  }
  let enviando = false;
  $('#fSol').addEventListener('submit', async ev => {
    ev.preventDefault();
    error('');
    if (enviando || !cfg) return;
    if ($('#sitio').value) return;   // relleno automático de robots
    const proyecto = $('#proyecto').hidden || $('#proyecto').value === '__otro' ? $('#proyectoTxt').value.trim() : $('#proyecto').value;
    const d = {
      cedula: Sobre.cedulaLimpia($('#cedula').value), nombre: $('#nombre').value.trim().replace(/\s+/g, ' '), celular: $('#celular').value.replace(/[^\d+]/g, ''),
      proyecto, prioridad: $('#prioridad').value, fechaRequerida: $('#fechaReq').value || null, notas: $('#notas').value.trim(), items: filas()
    };
    if (d.cedula.length < 5) return error('Escribe tu número de cédula, solo números.');
    if (d.nombre.split(' ').length < 2) return error('Escribe tu nombre completo (nombre y apellido).');
    if (!d.proyecto) return error('Elige el proyecto u obra.');
    if (!d.items.length) return error('Escribe al menos un material.');
    const btn = $('#enviar'); enviando = true; btn.disabled = true; btn.textContent = '⏳ Enviando…';
    try {
      const rad = Sobre.radicado();
      const datos = { v: 1, radicado: rad, fecha: new Date().toISOString(), ...d };
      if (GH) {
        const sobre = await Sobre.cifrarSobre(cfg.pub, datos);
        const partes = []; for (let i = 0; i < sobre.length; i += 60000) partes.push(sobre.slice(i, i + 60000));
        const token = Sobre.desofuscar(cfg.t);
        const is = await api('/issues', { title: 'Solicitud ' + rad, body: `compras-v1 partes=${partes.length}\n` + partes[0] }, token);
        for (let i = 1; i < partes.length; i++) await api(`/issues/${is.number}/comments`, { body: `parte ${i + 1}\n` + partes[i] }, token);
      } else {
        const l = ls.get('compras_buzon_demo', []); l.push(datos); ls.set('compras_buzon_demo', l);
      }
      ls.set('sol_datos', { cedula: d.cedula, nombre: d.nombre, celular: d.celular, proyecto: d.proyecto });
      const env = ls.get('sol_enviadas', []); env.unshift({ radicado: rad, fecha: datos.fecha, cedula: d.cedula, proyecto: d.proyecto, items: d.items }); ls.set('sol_enviadas', env.slice(0, 50));
      $('#fSol').hidden = true; $('#radicado').textContent = rad; $('#listo').hidden = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      error(e && e.status ? 'No se pudo enviar (error ' + e.status + '). Inténtalo de nuevo en unos minutos o avisa a compras.' : 'No se pudo enviar. Revisa tu conexión a internet e inténtalo de nuevo.');
    } finally { enviando = false; btn.disabled = false; btn.textContent = 'Enviar solicitud'; }
  });
  function otra() {
    $('#fSol').reset(); $('#items').innerHTML = ''; fila(); llenarDatos();
    $('#fSol').hidden = false; $('#listo').hidden = true; error('');
  }
  function llenarDatos() {
    const u = ls.get('sol_datos', {});
    if (u.cedula) $('#cedula').value = u.cedula;
    if (u.nombre) $('#nombre').value = u.nombre;
    if (u.celular) $('#celular').value = u.celular;
    if (u.cedula) $('#cedulaC').value = u.cedula;
  }

  // ---------- consulta por cédula ----------
  async function leerEstado(cedula) {
    const id = await Sobre.idEstado(cedula);
    let texto = null;
    if (GH) {
      try {
        const r = await fetch(`https://api.github.com/repos/${repoApp.owner}/${repoApp.repo}/contents/estado/${id}.json?ref=${cfgApp.GITHUB_RAMA || 'main'}`, { headers: { Accept: 'application/vnd.github.raw+json' }, cache: 'no-store' });
        if (r.status === 404) return null;
        if (!r.ok) throw 0;
        texto = await r.text();
      } catch (e) {
        const r = await fetch(`estado/${id}.json?t=${Date.now()}`, { cache: 'no-store' });
        if (r.status === 404) return null;
        if (!r.ok) throw new Error('consulta');
        texto = await r.text();
      }
    } else texto = ls.get('compras_estado_demo', {})[id] || null;
    if (!texto) return null;
    return Sobre.descifrarEstado(cedula, Sobre.unb64(JSON.parse(texto).d));
  }
  const color = e => /rechaz/i.test(e) ? 'red' : /pendiente/i.test(e) ? 'amber' : /pagad|cerrada/i.test(e) ? 'green' : /revis/i.test(e) ? 'gray' : 'blue';
  const fecha = t => t ? new Date(t).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
  $('#fConsulta').addEventListener('submit', async ev => {
    ev.preventDefault();
    const ced = Sobre.cedulaLimpia($('#cedulaC').value), out = $('#mias');
    if (ced.length < 5) { out.innerHTML = '<p class="err">Escribe tu cédula, solo números.</p>'; return; }
    out.innerHTML = '<p class="muted">⏳ Consultando…</p>';
    let est = null, fallo = false;
    try { est = await leerEstado(ced); } catch (e) { fallo = true; }
    const regs = (est && est.solicitudes) || [];
    const pend = ls.get('sol_enviadas', []).filter(x => x.cedula === ced && !regs.some(s => s.radicado === x.radicado));
    if (!regs.length && !pend.length) {
      out.innerHTML = `<p class="empty">${fallo ? 'No se pudo consultar en este momento. Inténtalo en unos minutos.' : 'No hay solicitudes registradas con esta cédula. Si acabas de enviar una, puede tardar unos minutos en aparecer.'}</p>`;
      return;
    }
    out.innerHTML = (est && est.nombre ? `<p>Hola, <b>${esc(est.nombre.split(' ')[0])}</b>. Estas son tus solicitudes:</p>` : '') +
      pend.map(x => `<article class="cot"><header><div><b>Radicado ${esc(x.radicado)}</b> · ${esc(x.proyecto)}</div><span class="badge b-indigo">Recibida · en registro</span></header>
        <p class="muted sm">${fecha(x.fecha)} · ${x.items.length} ítem(s): ${esc(x.items.map(i => i.descripcion).join(', '))}</p></article>`).join('') +
      regs.map(s => `<article class="cot"><header><div><b>${esc(s.codigo)}</b> · ${esc(s.proyecto)}</div><span class="badge b-${color(s.estado)}">${esc(s.estado)}</span></header>
        <p class="muted sm">${fecha(s.fecha)}${s.radicado ? ' · radicado ' + esc(s.radicado) : ''}</p>
        <table class="tbl"><tbody>${s.items.map(i => `<tr><td>${esc(i.d)}${i.n ? `<br><small class="muted">💬 ${esc(i.n)}</small>` : ''}</td><td class="r">${esc(i.c)} ${esc(i.u)}</td><td class="r"><span class="badge b-${color(i.e)}">${esc(i.e)}</span></td></tr>`).join('')}</tbody></table></article>`).join('') +
      (est ? `<p class="muted sm">Actualizado: ${new Date(est.actualizado).toLocaleString('es-CO')}</p>` : '');
  });

  function tab(t) {
    $('#vNueva').hidden = t !== 'nueva'; $('#vMias').hidden = t !== 'mias';
    $('#tabNueva').classList.toggle('on', t === 'nueva'); $('#tabMias').classList.toggle('on', t === 'mias');
    if (t === 'mias' && $('#cedulaC').value) $('#fConsulta').requestSubmit();
  }
  window.Pub = { tab, fila, convertir, otra, pegar: () => { const b = $('#pasteBox'); b.hidden = !b.hidden; if (!b.hidden) $('#pasteTxt').focus(); } };

  fila(); llenarDatos(); cargarConfig();
})();
