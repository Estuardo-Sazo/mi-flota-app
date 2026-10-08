/**
 * Lanza una escritura de Firestore sin esperar la confirmación del servidor.
 *
 * Con la caché persistente de Firestore, la escritura se aplica de inmediato en el dispositivo
 * (los listeners se actualizan al instante) y se sincroniza sola cuando vuelve la conexión.
 * Los promises de `addDoc`/`updateDoc`/`deleteDoc` solo se resuelven con el ack del servidor,
 * así que hacer `await` de ellos sin red deja la interfaz colgada.
 *
 * Devuelve `false` si la escritura no pudo ni encolarse (p. ej. todavía no hay sesión).
 */
export function queueWrite(write: () => Promise<unknown>): boolean {
  try {
    write().catch((e) => {
      console.error('Error al sincronizar un cambio con Firestore', e);
      alert('No se pudo sincronizar un cambio. Revisa tu conexión; si persiste, vuelve a intentarlo.');
    });
    return true;
  } catch (e) {
    console.error('No se pudo guardar el cambio', e);
    alert('Todavía no hay una sesión activa. Conéctate a internet al menos una vez para poder guardar datos.');
    return false;
  }
}
