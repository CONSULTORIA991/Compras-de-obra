// Cifrado compartido por el enlace público de solicitudes (solicitud.html) y la app.
// - Envíos: se cifran en el celular con la llave pública de la empresa (RSA-OAEP 3072 + AES-256-GCM).
//   Solo la app, con la llave privada guardada cifrada, puede abrirlos.
// - Estado por cédula: la app publica el estado de las solicitudes de cada persona cifrado con una
//   llave derivada de su cédula (PBKDF2-SHA256), para que la consulte desde el enlace.
window.Sobre = (() => {
  const enc = new TextEncoder(), dec = new TextDecoder();
  const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const aleatorio = n => crypto.getRandomValues(new Uint8Array(n));
  const disponible = !!(window.crypto && crypto.subtle);
  const cedulaLimpia = c => String(c || '').replace(/\D/g, '');

  async function aes(llave, bytes) {
    const k = await crypto.subtle.importKey('raw', llave, { name: 'AES-GCM' }, false, ['encrypt']);
    const iv = aleatorio(12);
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, bytes));
    const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12); return out;
  }
  async function desAes(llave, d) {
    const k = await crypto.subtle.importKey('raw', llave, { name: 'AES-GCM' }, false, ['decrypt']);
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: d.subarray(0, 12) }, k, d.subarray(12)));
  }

  // ---------- par de llaves del buzón ----------
  async function generarPar() {
    const par = await crypto.subtle.generateKey({ name: 'RSA-OAEP', modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['encrypt', 'decrypt']);
    const pub = await crypto.subtle.exportKey('jwk', par.publicKey), priv = await crypto.subtle.exportKey('jwk', par.privateKey);
    return { pub: { kty: pub.kty, n: pub.n, e: pub.e, alg: pub.alg, ext: true }, priv };
  }
  async function cifrarSobre(pubJwk, datos) {
    const pub = await crypto.subtle.importKey('jwk', pubJwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);
    const llave = aleatorio(32);
    const ct = await aes(llave, enc.encode(JSON.stringify(datos)));
    const ek = new Uint8Array(await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, pub, llave));
    return JSON.stringify({ v: 1, ek: b64(ek), ct: b64(ct) });
  }
  async function abrirSobre(privJwk, texto) {
    const s = JSON.parse(texto);
    const priv = await crypto.subtle.importKey('jwk', privJwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['decrypt']);
    const llave = new Uint8Array(await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, priv, unb64(s.ek)));
    return JSON.parse(dec.decode(await desAes(llave, unb64(s.ct))));
  }

  // ---------- estado por cédula ----------
  async function idEstado(cedula) {
    const h = await crypto.subtle.digest('SHA-256', enc.encode('compras-estado-id:' + cedulaLimpia(cedula)));
    return [...new Uint8Array(h)].slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  async function llaveEstado(cedula) {
    const c = cedulaLimpia(cedula);
    const base = await crypto.subtle.importKey('raw', enc.encode(c), 'PBKDF2', false, ['deriveBits']);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode('compras-estado:' + c), iterations: 150000, hash: 'SHA-256' }, base, 256));
  }
  const cifrarEstado = async (cedula, obj) => aes(await llaveEstado(cedula), enc.encode(JSON.stringify(obj)));
  const descifrarEstado = async (cedula, bytes) => JSON.parse(dec.decode(await desAes(await llaveEstado(cedula), bytes)));

  // El token del buzón viaja ofuscado en la configuración pública (solo permite crear envíos en el buzón).
  const CLAVE_OF = enc.encode('compras-buzon');
  const ofuscar = t => b64(enc.encode(t).map((x, i) => x ^ CLAVE_OF[i % CLAVE_OF.length])).split('').reverse().join('');
  const desofuscar = s => dec.decode(unb64(s.split('').reverse().join('')).map((x, i) => x ^ CLAVE_OF[i % CLAVE_OF.length]));

  function radicado() {
    const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return [...aleatorio(6)].map(b => abc[b % abc.length]).join('');
  }

  return { disponible, b64, unb64, generarPar, cifrarSobre, abrirSobre, idEstado, cifrarEstado, descifrarEstado, ofuscar, desofuscar, radicado, cedulaLimpia };
})();
