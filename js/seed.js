/* Datos de prueba para el MODO DEMOSTRACIÓN (no se usan con Supabase). */
window.buildSeed = function (newId) {
  const H = 36e5, D = 864e5, base = Date.now();
  const iso = ms => new Date(ms).toISOString();
  const LBL = { aprobado: 'Aprobado', espera: 'Pendiente', rechazado: 'Rechazado' };

  const U = (nombre, email, roles) => ({ id: newId(), nombre, email, roles, activo: true, pass: 'demo123' });
  const admin = U('Administrador', 'admin@demo.co', ['admin']);
  const obra1 = U('Carlos Pérez (Maestro de obra)', 'obra@demo.co', ['solicitante']);
  const obra2 = U('Luis Gómez (Residente)', 'residente@demo.co', ['solicitante']);
  const jefe = U('Ing. Andrea Rojas', 'jefe@demo.co', ['jefe']);
  const jefe2 = U('Ing. Mario Díaz', 'gerente@demo.co', ['jefe']);
  const compras = U('Diana Torres (Compras)', 'compras@demo.co', ['compras']);
  const teso = U('Tesorería', 'tesoreria@demo.co', ['tesoreria']);
  const perfiles = [admin, obra1, obra2, jefe, jefe2, compras, teso];

  const P = n => ({ id: newId(), nombre: n, activo: true });
  const [torre, vega, ofis] = [P('Edificio Torre Norte'), P('Casa Campestre La Vega'), P('Remodelación Oficinas Centro')];
  const proyectos = [torre, vega, ofis];

  const V = (nombre, nit, contacto, telefono, email, ciudad) => ({ id: newId(), nombre, nit, contacto, telefono, email, ciudad, activo: true });
  const pConst = V('Ferretería El Constructor', '900.123.456-1', 'Jorge Ramírez', '3001234567', 'ventas@elconstructor.example', 'Bogotá');
  const pSanJose = V('Depósito de Materiales San José', '800.987.654-3', 'Martha León', '3109876543', 'cotizaciones@sanjose.example', 'Bogotá');
  const pPint = V('Pinturas y Acabados Ltda.', '901.555.222-8', 'Felipe Castro', '3205552222', 'pedidos@pinturas.example', 'Chía');
  const pElec = V('Eléctricos del Centro', '830.444.111-0', 'Sandra Mora', '3014441111', 'ventas@electricos.example', 'Bogotá');
  const proveedores = [pConst, pSanJose, pPint, pElec];

  let seq = 0; const reqs = [];
  const ev = (t, u, accion, detalle) => ({ t: iso(t), uid: u.id, por: u.nombre, accion, detalle });

  function req(dias, proy, quien, solicitantes, items, opts = {}) {
    const t0 = base - dias * D;
    const r = {
      id: newId(), numero: ++seq, _v: 1, proyectoId: proy.id, proyecto: proy.nombre, solicitantes,
      prioridad: opts.urgente ? 'urgente' : 'normal', fechaRequerida: null, notas: opts.notas || '',
      creado: iso(t0), creadoPor: quien.id, creadoPorNombre: quien.nombre,
      items: items.map(([d, c, u]) => ({ id: newId(), descripcion: d, cantidad: c, unidad: u, estado: 'revision', nota: '', creado: iso(t0) })),
      cotizaciones: [],
      eventos: [ev(t0, quien, 'Solicitud creada', `${items.length} ítem(s) · Solicitado por: ${solicitantes}`)]
    };
    r._t0 = t0; reqs.push(r); return r;
  }
  function decidir(r, horas, j, decisiones) {
    const t = r._t0 + horas * H, cambios = [];
    decisiones.forEach((d, i) => {
      if (!d) return;
      const [e, n] = Array.isArray(d) ? d : [d, ''];
      const it = r.items[i];
      Object.assign(it, { estado: e, nota: n, decididoEn: iso(t), decididoPor: j.id, decididoPorNombre: j.nombre });
      cambios.push(`${LBL[e]}: ${it.descripcion}${n ? ' (' + n + ')' : ''}`);
    });
    r.eventos.push(ev(t, j, 'Revisión de jefatura', cambios.join(' · ')));
  }
  function cot(r, idxs, prov, hSol, o = {}) {
    const n = r.cotizaciones.length + 1;
    const c = {
      id: newId(), codigo: `SC-${String(r.numero).padStart(4, '0')}-${n}`, proveedorId: prov.id, proveedorNombre: prov.nombre,
      itemIds: idxs.map(i => r.items[i].id), estado: 'solicitada', fechaSolicitud: iso(r._t0 + hSol * H),
      solicitadaPor: compras.id, solicitadaPorNombre: compras.nombre, observaciones: `Entrega en obra: ${r.proyecto}`, precios: {}
    };
    r.eventos.push(ev(r._t0 + hSol * H, compras, 'Solicitud de cotización generada', `${c.codigo} a ${prov.nombre} (${idxs.length} ítem(s))`));
    if (o.hRec != null) {
      idxs.forEach((i, k) => { c.precios[r.items[i].id] = o.precios[k]; });
      const sub = idxs.reduce((s, i, k) => s + o.precios[k] * r.items[i].cantidad, 0);
      Object.assign(c, {
        estado: 'recibida', ivaPct: 19, ivaInc: false, otros: o.otros || 0, subtotal: sub, iva: sub * 0.19,
        total: sub * 1.19 + (o.otros || 0), entrega: o.entrega || '2 días hábiles', formaPago: o.formaPago || 'Contado',
        validez: '15 días', fechaRecibida: iso(r._t0 + o.hRec * H), recibidaPor: compras.id, recibidaPorNombre: compras.nombre
      });
      r.eventos.push(ev(r._t0 + o.hRec * H, compras, 'Cotización recibida', `${c.codigo} · ${prov.nombre} · $ ${Math.round(c.total).toLocaleString('es-CO')}`));
    }
    if (o.hDec != null) {
      const j = o.jefe || jefe;
      Object.assign(c, { estado: o.dec || 'aprobada', fechaDecision: iso(r._t0 + o.hDec * H), decididaPor: j.id, decididaPorNombre: j.nombre, notaJefe: o.nota || '' });
      r.eventos.push(ev(r._t0 + o.hDec * H, j, c.estado === 'aprobada' ? 'Cotización aprobada' : 'Cotización rechazada', `${c.codigo} · ${prov.nombre}${o.nota ? ' · ' + o.nota : ''}`));
    }
    if (o.hPago != null) {
      const tp = r._t0 + o.hPago * H;
      c.estado = 'pagada';
      c.pago = { fecha: iso(tp).slice(0, 10), valor: Math.round(c.total), medio: 'Transferencia', referencia: 'TRF-' + (1000 + seq * 7 + n), nota: '', registrado: iso(tp), por: teso.id, porNombre: teso.nombre };
      r.eventos.push(ev(tp, teso, 'Pago registrado', `${c.codigo} · ${prov.nombre} · $ ${c.pago.valor.toLocaleString('es-CO')} · Transferencia`));
    }
    r.cotizaciones.push(c); return c;
  }
  const descartar = (r, c, por) => { c.estado = 'descartada'; c.notaJefe = 'Descartada al aprobarse ' + por.codigo; };

  // 1. Cerrada y pagada
  let r = req(18, torre, obra1, 'Carlos Pérez', [['Cemento gris 50 kg', 20, 'bulto'], ['Arena de pega', 3, 'm³'], ['Varilla corrugada 1/2"', 30, 'und']]);
  decidir(r, 5, jefe, ['aprobado', 'aprobado', 'aprobado']);
  cot(r, [0, 1, 2], pSanJose, 20, { hRec: 44, precios: [32000, 95000, 21500], hDec: 50, hPago: 60 });
  r.eventos.push(ev(r._t0 + 60 * H, teso, 'Solicitud cerrada', 'Todos los ítems fueron resueltos'));

  // 2. Dos cotizaciones comparadas, una aprobada y pagada, ítem rechazado
  r = req(14, vega, obra2, 'Luis Gómez, Pedro Ruiz', [['Pintura vinilo blanca tipo 1', 5, 'galón'], ['Rodillo de felpa 9"', 4, 'und'], ['Brocha 3"', 6, 'und'], ['Lija agua #120', 20, 'und']]);
  decidir(r, 9, jefe2, ['aprobado', 'aprobado', 'aprobado', ['rechazado', 'Hay en bodega']]);
  const a2 = cot(r, [0, 1, 2], pPint, 30, { hRec: 70, precios: [68000, 18000, 9500] });
  const b2 = cot(r, [0, 1, 2], pConst, 30, { hRec: 80, precios: [74000, 16500, 11000] });
  Object.assign(a2, { estado: 'aprobada', fechaDecision: iso(r._t0 + 100 * H), decididaPor: jefe2.id, decididaPorNombre: jefe2.nombre, notaJefe: 'Mejor precio' });
  r.eventos.push(ev(r._t0 + 100 * H, jefe2, 'Cotización aprobada', `${a2.codigo} · ${pPint.nombre} · Mejor precio`));
  descartar(r, b2, a2);
  a2.estado = 'pagada';
  a2.pago = { fecha: iso(r._t0 + 130 * H).slice(0, 10), valor: Math.round(a2.total), medio: 'Transferencia', referencia: 'TRF-2231', nota: '', registrado: iso(r._t0 + 130 * H), por: teso.id, porNombre: teso.nombre };
  r.eventos.push(ev(r._t0 + 130 * H, teso, 'Pago registrado', `${a2.codigo} · ${pPint.nombre} · $ ${a2.pago.valor.toLocaleString('es-CO')}`));
  r.eventos.push(ev(r._t0 + 130 * H, teso, 'Solicitud cerrada', 'Todos los ítems fueron resueltos'));

  // 3. Por pagar + un ítem PENDIENTE (la solicitud no se cierra)
  r = req(9, ofis, obra1, 'Carlos Pérez', [['Cable THHN #12 (rollo 100 m)', 3, 'rollo'], ['Toma doble con polo a tierra', 15, 'und'], ['Interruptor sencillo', 10, 'und'], ['Tubo conduit PVC 1/2"', 20, 'und']]);
  decidir(r, 22, jefe, ['aprobado', 'aprobado', ['espera', 'Confirmar referencia con el arquitecto'], 'aprobado']);
  cot(r, [0, 1, 3], pElec, 40, { hRec: 90, precios: [289000, 12500, 4200], hDec: 110 });

  // 4. Urgente, esperando respuesta del proveedor
  r = req(5, torre, obra2, 'Luis Gómez', [['Puntilla 2" con cabeza', 5, 'kg'], ['Alambre negro #18', 10, 'kg'], ['Escoba plástica', 4, 'und']], { urgente: true });
  decidir(r, 30, jefe, ['aprobado', 'aprobado', 'aprobado']);
  cot(r, [0, 1, 2], pConst, 60);

  // 5. Cotización recibida, por aprobar
  r = req(3, vega, obra2, 'Luis Gómez', [['Impermeabilizante acrílico', 2, 'cuñete'], ['Malla de refuerzo', 1, 'rollo']]);
  decidir(r, 8, jefe2, ['aprobado', 'aprobado']);
  cot(r, [0, 1], pPint, 20, { hRec: 40, precios: [245000, 89000] });

  // 6. Aprobada, por cotizar (tarea de compras)
  r = req(2, ofis, obra1, 'Carlos Pérez, Andrés Mejía', [['Lámina de drywall 1/2"', 12, 'und'], ['Perfil omega', 30, 'und'], ['Tornillo drywall 6x1"', 2, 'caja']]);
  decidir(r, 20, jefe, ['aprobado', 'aprobado', 'aprobado']);

  // 7. Recién creada, por revisar (tarea de jefes)
  req(0.3, torre, obra1, 'Carlos Pérez', [['Guantes de carnaza', 10, 'par'], ['Casco de seguridad', 5, 'und'], ['Gafas de seguridad', 5, 'und']], { notas: 'Llegó personal nuevo a la obra' });

  // 8. Rechazada completa (cerrada)
  r = req(1, vega, obra2, 'Luis Gómez', [['Alquiler mezcladora 1 bulto', 1, 'global']]);
  decidir(r, 4, jefe, [['rechazado', 'Usar la mezcladora de Torre Norte']]);
  r.eventos.push(ev(r._t0 + 4 * H, jefe, 'Solicitud cerrada', 'Todos los ítems fueron resueltos'));

  reqs.forEach(x => delete x._t0);
  const notifs = [];
  const N = (u, rq, m) => notifs.push({ id: newId(), user_id: u.id, req_id: rq.id, mensaje: m, leida: false, creado: iso(base - 2 * H) });
  N(jefe, reqs[6], 'Nueva solicitud REQ-0007 (Edificio Torre Norte) con 3 ítem(s) por revisar');
  N(jefe2, reqs[6], 'Nueva solicitud REQ-0007 (Edificio Torre Norte) con 3 ítem(s) por revisar');
  N(jefe, reqs[4], 'REQ-0005: cotización SC-0005-1 de Pinturas y Acabados Ltda. lista para aprobar');
  N(compras, reqs[5], 'REQ-0006: 3 ítem(s) aprobados, listos para cotizar');
  N(teso, reqs[2], 'REQ-0003: cotización SC-0003-1 (Eléctricos del Centro) aprobada. Pendiente de pago');

  return { seq, perfiles, proyectos, proveedores, reqs, notifs, files: {} };
};
