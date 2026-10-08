import { format, isToday, isYesterday } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Convierte la fecha de un movimiento a Date local.
 * Las fechas sin hora ("2025-09-02", de datos importados) se interpretarían como UTC y
 * podrían caer en el día anterior en zonas horarias de América; aquí se fijan al mediodía local.
 */
export function parseTxDate(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }
  return new Date(value);
}

/** Clave de día local (yyyy-MM-dd) para agrupar movimientos. */
export function dayKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/** "Hoy", "Ayer" o "Mar 6 oct". */
export function dayLabel(date: Date): string {
  if (isToday(date)) return 'Hoy';
  if (isYesterday(date)) return 'Ayer';
  const text = format(date, "EEE d MMM", { locale: es }).replace(/\./g, '');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Hora local corta, p. ej. "3:44 p. m.". */
export function timeLabel(date: Date): string {
  return date.toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit' });
}

/** Valor para <input type="datetime-local"> en hora local. */
export function toDateTimeInput(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm");
}
