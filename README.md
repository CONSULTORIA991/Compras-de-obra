# Compras de obra: solicitudes, aprobaciones, cotizaciones y pagos

Aplicación web (celular y computador) para reemplazar los pedidos de material por WhatsApp
con un flujo trazable:

```
Obra solicita ─► Jefes aprueban / dejan pendiente / rechazan (ítem por ítem)
             ─► Compras genera la solicitud de cotización (PDF / WhatsApp / correo)
             ─► Compras registra la cotización del proveedor
             ─► Jefes aprueban la cotización (con comparativo si hay varias)
             ─► Tesorería registra el pago ─► la solicitud se cierra sola
```

* Una solicitud **no se cierra** mientras tenga ítems pendientes, y siempre muestra cuáles faltan.
* Cada acción queda en el **historial** (quién, qué y cuándo).
* **Notificaciones dentro de la app** (campana) para jefes, compras, tesorería y el solicitante.
* **Reportes:** tiempo promedio por etapa ("¿dónde nos demoramos?"), tiempo por persona,
  respuesta de proveedores, cotizaciones pendientes, compras por proveedor y por proyecto, y
  materiales de mayor gasto. Se pueden exportar a Excel (CSV).

## Roles

| Rol | Puede |
|---|---|
| Solicitante (obra) | Crear solicitudes y agregar ítems; ver el estado de sus solicitudes |
| Jefe / Aprobador | Aprobar, dejar pendiente o rechazar ítems (y ajustar cantidades); aprobar o rechazar cotizaciones |
| Compras | Generar solicitudes de cotización, registrar cotizaciones y administrar proveedores y proyectos |
| Tesorería / Pagos | Registrar pagos con su soporte |
| Administrador | Todo lo anterior, más la gestión de usuarios |

Una persona puede tener varios roles.

---

## 1. Probar en modo demostración

Sin configurar nada, la app funciona en **modo demostración**: los datos quedan en el navegador
y trae usuarios de prueba (contraseña `demo123`). La pantalla de ingreso tiene botones para
entrar con cada rol.

Para abrirla en su computador, desde esta carpeta:

```bash
npx --yes serve .
```

(o cualquier servidor estático). La versión publicada en GitHub Pages no usa el modo demostración: pide activación y usuarios reales (ver punto 2).

## 2. Uso real: datos cifrados en este repositorio (igual que la app de PAGOS)

Publicada en GitHub Pages, la app guarda todo **cifrado dentro de este mismo repositorio**,
en la carpeta `datos/`. Cada persona entra con su propio usuario y contraseña:

| Archivo | Contenido |
|---|---|
| `datos/usuarios.json` | La llave maestra, envuelta con la contraseña de cada usuario. Los nombres de usuario van como huella (hash), no en texto. |
| `datos/config.enc` | Token de GitHub, usuarios y roles (cifrado) |
| `datos/compras.enc` | Solicitudes, cotizaciones, pagos, proyectos, proveedores y notificaciones (cifrado) |
| `datos/archivos/*` | Cotizaciones de proveedores y soportes de pago (cifrados) |

Cifrado AES-256-GCM. Las contraseñas se procesan con PBKDF2-SHA256 de 600.000 iteraciones.
Aunque el repositorio sea público, sin una contraseña válida no se puede leer nada.

**Activación (una sola vez):**
1. Abra la página publicada. Aparece **Activar la aplicación**.
2. En GitHub cree un **token de acceso fino**: foto de perfil → Settings → Developer settings →
   Personal access tokens → **Fine-grained tokens** → Generate new token.
   * Repository access: **Only select repositories** → este repositorio.
   * Permissions → **Contents: Read and write**.
3. Pegue el token, escriba su nombre, usuario y contraseña, y haga clic en **Activar y entrar**.
   Su usuario queda como Administrador y Tesorería.
4. En **Admin**, cree los proyectos, los proveedores y un usuario para cada persona.
   Entregue cada contraseña por un medio distinto al enlace.

**Cuando el token venza**, la app deja de guardar cambios. Cree uno nuevo con los mismos permisos y
péguelo en **Admin → Datos → Token de GitHub**.

**Si alguien olvida su contraseña**, el administrador le asigna una nueva en Admin → Usuarios.
Si una persona sale de la empresa, marque su usuario como **inactivo**.

**Enlace para pedir materiales (sin usuario).** Los trabajadores de obra entran a
`solicitud.html`, escriben su cédula, su nombre, el proyecto y lo que necesitan. Con la misma
cédula consultan el estado de sus solicitudes. Se activa en **Admin → Enlace de solicitudes**:
* Necesita un **repositorio privado** como buzón y un **token fino** con *Issues: Read and write*
  solo sobre ese buzón. Sirven el mismo buzón y el mismo token de la app de PAGOS, porque cada app
  toma solo sus envíos.
* La solicitud se cifra en el celular con la llave pública de la empresa y queda en el buzón.
  Cualquier jefe o persona de compras conectada la recoge, la registra como *Por revisar* y
  vacía el envío.
* El estado de cada persona se publica en `estado/`, cifrado con una llave derivada de su cédula.
  Quien conozca una cédula puede ver lo que esa persona pidió y su estado (no se muestran precios
  ni proveedores).
* `solicitud-config.json` es público: lleva la llave pública, el token del buzón (ofuscado) y la
  lista de proyectos activos.

**Lectura automática de cotizaciones.** Al registrar la cotización de un proveedor, elija el PDF o
la foto. La app la lee y llena los precios unitarios de cada ítem, el IVA, el flete, el tiempo
de entrega, la forma de pago y la validez. Los campos llenados quedan en verde para revisarlos, y
la app compara el total del documento con el total calculado.
* Sin configurar nada, funciona el **lector propio** (gratis): PDF con texto, como los que
  generan los programas de facturación.
* Con una **clave de la API de Claude** (Admin → Datos), la lectura es más precisa y también
  funciona con cotizaciones escaneadas y fotos de WhatsApp. Cada lectura cuesta unos pocos
  centavos de dólar en su cuenta de Anthropic. La clave queda guardada cifrada.

## 3. Opcional: Supabase en lugar del repositorio

La seguridad la da **Supabase** (plan gratuito): login con contraseña cifrada (bcrypt),
conexión HTTPS y reglas de acceso en la base de datos (Row Level Security). Sin sesión iniciada
no se puede leer ningún dato.

1. Cree una cuenta y un proyecto en <https://supabase.com>.
2. Abra **SQL Editor → New query**, pegue todo el contenido de [`supabase/schema.sql`](supabase/schema.sql) y haga clic en **Run**.
3. En **Authentication → Sign In / Providers → Email**:
   * desactive **Confirm email** (los usuarios los crea el administrador desde la app);
   * deje activo **Allow new users to sign up**. Así puede crear usuarios desde la app.
     Si alguien se registra por su cuenta, su usuario queda **inactivo** y no ve nada.
4. En **Authentication → Users → Add user**, cree su propio usuario (correo y contraseña).
5. En el SQL Editor, conviértase en administrador (cambie el correo):
   ```sql
   update public.perfiles set roles = '{admin,tesoreria}', activo = true, nombre = 'Su nombre'
   where email = 'su-correo@odesa.com.co';
   ```
6. En **Project Settings → API**, copie la **Project URL** y la **anon public key** y péguelas en
   [`js/config.js`](js/config.js). La anon key es pública por diseño; no copie nunca la
   `service_role` key.
7. Ajuste en `js/config.js` los datos de la empresa (NIT, dirección, teléfono, correo) que salen en el documento de cotización.
8. Entre a la app con su usuario. En **Admin**, cree proyectos, proveedores y los usuarios de
   cada persona con sus roles.

## 4. Subir a GitHub y publicar

```bash
git init
git add .
git commit -m "App de compras de obra"
git branch -M main
git remote add origin https://github.com/SU-USUARIO/compras-obra.git
git push -u origin main
```

Para publicarla, use una de estas opciones:

* **GitHub Pages:** Settings → Pages → Deploy from branch → `main` / root. Con un repositorio
  **privado**, GitHub Pages requiere un plan pago de GitHub.
* **Gratis con repositorio privado:** conecte el repositorio en **Netlify**, **Vercel** o
  **Cloudflare Pages** (sitio estático, sin comando de build).

La URL resultante se abre desde cualquier celular. Se puede "Agregar a la pantalla de inicio"
para usarla como una app.

## Estructura

```
index.html          Página principal
css/styles.css      Estilos (pensados primero para celular)
js/config.js        Configuración: Supabase y datos de la empresa
js/store.js         Capa de datos (demo / cifrado en GitHub / Supabase)
js/app.js           Pantallas y reglas del flujo
js/seed.js          Datos de prueba del modo demostración
supabase/schema.sql Tablas, seguridad y almacenamiento de archivos
```

## Limitaciones de este prototipo (para la versión 2)

* Los permisos por rol se aplican en la interfaz. Todos los usuarios comparten la misma llave
  de cifrado, así que técnicamente cualquier usuario activo podría modificar datos fuera de la
  app. Es el mismo modelo de la app de PAGOS.
* Al desactivar a alguien, deja de poder entrar con su contraseña. Para cortar del todo un
  acceso comprometido, cambie también el token de GitHub.
* Cada cambio queda como un commit "Actualización" en el repositorio. Eso también sirve como
  historial y respaldo.
* Las notificaciones son dentro de la app y se revisan cada 30 segundos. El correo o WhatsApp
  automáticos se pueden agregar después.
* No hay etapa de "recibido en obra" ni pagos parciales (abonos). Ambas son fáciles de agregar.
