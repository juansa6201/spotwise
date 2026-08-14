// Retiene el análisis en curso SOLO durante el ida y vuelta a la pantalla de
// login. Es memoria en módulo (a propósito, no sessionStorage): se pierde al
// recargar la página y no se comparte entre navegaciones normales. Así el
// análisis se descarta al recargar o al moverse por el sitio, y únicamente
// sobrevive cuando el usuario va a iniciar sesión para guardarlo y vuelve.
let pendiente = null

// Se llama solo al ir a iniciar sesión desde el resultado.
export const guardarPendiente = (snapshot) => { pendiente = snapshot }

// Lectura pura (sin efectos): puede invocarse varias veces sin consecuencias,
// necesario para el inicializador de useState bajo React StrictMode.
export const leerPendiente = () => pendiente

// Descarta lo retenido. Se llama una vez ya montada la página, cuando el estado
// inicial ya lo tomó, para que no reaparezca en una navegación posterior.
export const limpiarPendiente = () => { pendiente = null }
