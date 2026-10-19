/*
 * CONFIGURACIÓN DE LA APLICACIÓN
 * ------------------------------------------------------------
 * Si SUPABASE_URL y SUPABASE_ANON_KEY están vacíos, la app funciona en
 * MODO DEMOSTRACIÓN (datos guardados solo en el navegador, usuarios de prueba).
 *
 * Para producción: cree un proyecto en https://supabase.com, ejecute
 * supabase/schema.sql y pegue aquí la URL y la "anon public key"
 * (Project Settings → API). La anon key es pública por diseño: la seguridad
 * la dan el login y las políticas RLS de la base de datos.
 */
window.APP_CONFIG = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',

  // Datos que aparecen en el documento de "Solicitud de cotización"
  EMPRESA: {
    nombre: 'ODESA',
    nit: 'NIT 000.000.000-0',
    direccion: 'Dirección de la empresa',
    ciudad: 'Ciudad',
    telefono: 'Teléfono',
    email: 'compras@odesa.com.co'
  },

  // Días tras los cuales una tarea se marca como "Atrasada"
  DIAS_ALERTA: 2
};
