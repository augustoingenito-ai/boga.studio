// Connection configuration is never printed: it contains private credentials.
export function postgresOptions(env = process.env) {
  let url;
  try {
    url = new URL(env.DATABASE_URL.trim());
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname) throw Error();
  } catch {
    throw new Error('DATABASE_URL debe ser la URI completa de Supabase → Connect → Session pooler.');
  }
  let user, password, database;
  try {
    user = decodeURIComponent(url.username);
    password = env.DATABASE_PASSWORD !== undefined ? env.DATABASE_PASSWORD : decodeURIComponent(url.password);
    database = decodeURIComponent(url.pathname.slice(1)) || 'postgres';
  } catch {
    throw new Error('DATABASE_URL contiene caracteres mal codificados. Copiá la URI original y cargá la contraseña en DATABASE_PASSWORD.');
  }
  if (!user || !password || /^(\[YOUR[-_]PASSWORD\]|YOUR[-_]PASSWORD)$/i.test(password)) {
    throw new Error('Completá DATABASE_PASSWORD en Render con la contraseña real de la base de Supabase, sin codificar.');
  }
  return {
    host: url.hostname,
    port: Number(url.port || 5432),
    database,
    user,
    password,
    max: 3,
    connectionTimeoutMillis: 15000,
    idleTimeoutMillis: 30000,
    // No connectionString is passed to pg: its parser would override the separate password and TLS options.
    ssl: {
      rejectUnauthorized: true,
      ...(env.DATABASE_CA_CERT ? { ca: env.DATABASE_CA_CERT.replace(/\\n/g, '\n') } : {}),
    },
  };
}

export function connectionError(code) {
  if (code === '28P01') return 'Supabase rechazó el acceso (28P01). Revisá DATABASE_PASSWORD: contraseña de la base de datos, no ADMIN_PASSWORD. Confirmá que DATABASE_URL corresponda al mismo proyecto y al Session pooler.';
  if (['SELF_SIGNED_CERT_IN_CHAIN', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'].includes(code)) return 'No se pudo verificar el certificado de Supabase. Cargá el certificado oficial completo en DATABASE_CA_CERT.';
  return 'No se pudo iniciar la base de datos. Revisá la conexión, disponibilidad y permisos de Supabase. No se modificaron las credenciales.';
}
