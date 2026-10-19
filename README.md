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

(o cualquier servidor estático). También funciona al publicarla en GitHub Pages.

## 2. Pasar a producción (datos reales, usuario y contraseña)

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

## 3. Subir a GitHub y publicar

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
js/store.js         Capa de datos (modo demo / Supabase)
js/app.js           Pantallas y reglas del flujo
js/seed.js          Datos de prueba del modo demostración
supabase/schema.sql Tablas, seguridad y almacenamiento de archivos
```

## Limitaciones de este prototipo (para la versión 2)

* Los permisos por rol se aplican en la interfaz. En la base de datos, cualquier usuario
  **activo** puede modificar solicitudes. Para un control estricto, las acciones (aprobar,
  pagar…) deben pasar a funciones del servidor (RPC) que validen el rol.
* Las notificaciones son dentro de la app y se revisan cada 30 segundos. El correo o WhatsApp
  automáticos se pueden agregar después.
* No hay etapa de "recibido en obra" ni pagos parciales (abonos). Ambas son fáciles de agregar.
