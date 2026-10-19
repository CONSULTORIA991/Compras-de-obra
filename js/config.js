/*
 * CONFIGURACIÓN DE LA APLICACIÓN
 * ------------------------------------------------------------
 * MODO 'auto' (recomendado):
 *  - Publicada en GitHub Pages (*.github.io): datos CIFRADOS en este mismo repositorio,
 *    con usuario y contraseña para cada persona (igual que la app de PAGOS).
 *  - Abierta en el computador (localhost): MODO DEMOSTRACIÓN con usuarios de prueba.
 *  - Si se llenan SUPABASE_URL y SUPABASE_ANON_KEY: usa Supabase (opcional).
 */
window.APP_CONFIG = {
  MODO: 'auto',            // 'auto' | 'github' | 'demo' | 'supabase'
  GITHUB_OWNER: '',        // vacío = se deduce de la dirección <usuario>.github.io/<repo>
  GITHUB_REPO: '',
  GITHUB_RAMA: 'main',


  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',

  // Datos que aparecen en el documento de "Solicitud de cotización"
  EMPRESA: {
    nombre: 'ODESA CARIBE S.A.S.',
    nit: 'NIT 900.409.543',
    direccion: 'Calle 93 N 49C - 274 Local 2',
    ciudad: '',
    telefono: 'Tel. 313 577 8685',
    email: 'compras@odesa.com.co'   // ← confirme que este correo exista
  },

  // Días tras los cuales una tarea se marca como "Atrasada"
  DIAS_ALERTA: 2
};
