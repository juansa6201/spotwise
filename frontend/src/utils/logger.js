// Logger del frontend. Los errores siempre se loguean; info/warn solo en dev o
// si se activa VITE_LOG=true (para no ensuciar la consola en producción).
const verbose = import.meta.env.DEV || import.meta.env.VITE_LOG === 'true'

function emit(nivel, ...args) {
  if (nivel === 'error' || verbose) {
    console[nivel]('[spotwise]', ...args)
  }
}

const logger = {
  info: (...a) => emit('info', ...a),
  warn: (...a) => emit('warn', ...a),
  error: (...a) => emit('error', ...a),
}

export default logger
