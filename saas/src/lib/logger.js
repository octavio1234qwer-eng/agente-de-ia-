const levels = { debug: 10, info: 20, warn: 30, error: 40 };

/**
 * Logger JSON de una línea por evento. Nunca registres contraseñas, tokens,
 * claves ni el contenido que los usuarios envían a la IA.
 */
export function createLogger({ level = 'info', silent = false } = {}) {
  const threshold = levels[level] ?? levels.info;
  const write = (lvl, msg, fields) => {
    if (silent || levels[lvl] < threshold) return;
    const line = JSON.stringify({ time: new Date().toISOString(), level: lvl, msg, ...fields });
    (lvl === 'error' || lvl === 'warn' ? process.stderr : process.stdout).write(`${line}\n`);
  };
  return {
    debug: (msg, fields) => write('debug', msg, fields),
    info: (msg, fields) => write('info', msg, fields),
    warn: (msg, fields) => write('warn', msg, fields),
    error: (msg, fields) => write('error', msg, fields),
  };
}

export function errorFields(error) {
  return { error: error?.message, code: error?.code, stack: error?.stack?.split('\n').slice(0, 4).join(' | ') };
}
