function easterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function nextMonday(date: Date): Date {
  const d = new Date(date);
  const dow = d.getDay();
  if (dow === 1) return d;
  d.setDate(d.getDate() + (dow === 0 ? 1 : 8 - dow));
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function getColombianHolidays(year: number): Set<string> {
  const h = new Set<string>();
  const add = (d: Date) => h.add(dateKey(d));
  const addLE = (m: number, day: number) => add(nextMonday(new Date(year, m - 1, day)));

  // Festivos fijos
  add(new Date(year, 0, 1));    // Año Nuevo
  add(new Date(year, 4, 1));    // Día del Trabajo
  add(new Date(year, 6, 20));   // Independencia
  add(new Date(year, 7, 7));    // Batalla de Boyacá
  add(new Date(year, 11, 25));  // Navidad

  // Ley Emiliani — se trasladan al lunes siguiente si no caen en lunes
  addLE(1, 6);    // Reyes Magos
  addLE(3, 19);   // San José
  addLE(6, 29);   // San Pedro y San Pablo
  addLE(8, 15);   // Asunción de la Virgen
  addLE(10, 12);  // Día de la Raza
  addLE(11, 1);   // Todos los Santos
  addLE(11, 11);  // Independencia de Cartagena

  // Basados en Semana Santa
  const easter = easterDate(year);
  add(addDays(easter, -3));                 // Jueves Santo
  add(addDays(easter, -2));                 // Viernes Santo
  add(nextMonday(addDays(easter, 39)));     // Ascensión de Jesús
  add(nextMonday(addDays(easter, 60)));     // Corpus Christi
  add(nextMonday(addDays(easter, 68)));     // Sagrado Corazón de Jesús

  return h;
}

export function lastBusinessDay(targetDate: Date, holidays: Set<string>): Date {
  const d = new Date(targetDate);
  while (true) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6 && !holidays.has(dateKey(d))) return new Date(d);
    d.setDate(d.getDate() - 1);
  }
}

export type PayPeriod = { payDate: string; periodKey: string };

function isoWeekKey(d: Date): string {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dow = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dow);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// Retorna el período de pago actual si ya llegó la fecha de pago, o null si aún no.
export function getCurrentPayPeriod(
  frequency: "monthly" | "biweekly" | "weekly",
  today: Date,
): PayPeriod | null {
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  const todayStr = dateKey(today);
  const holidays = getColombianHolidays(year);
  const pad = (n: number) => String(n).padStart(2, "0");

  if (frequency === "monthly") {
    const payDate = lastBusinessDay(new Date(year, month, 0), holidays);
    // El salario se paga a fin del mes pero se usa el mes siguiente → periodKey apunta al mes siguiente
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    return todayStr >= dateKey(payDate)
      ? { payDate: dateKey(payDate), periodKey: `${nextYear}-${pad(nextMonth)}` }
      : null;
  }

  if (frequency === "biweekly") {
    if (day <= 15) {
      const payDate = lastBusinessDay(new Date(year, month - 1, 15), holidays);
      return todayStr >= dateKey(payDate)
        ? { payDate: dateKey(payDate), periodKey: `${year}-${pad(month)}-Q1` }
        : null;
    }
    const payDate = lastBusinessDay(new Date(year, month, 0), holidays);
    return todayStr >= dateKey(payDate)
      ? { payDate: dateKey(payDate), periodKey: `${year}-${pad(month)}-Q2` }
      : null;
  }

  // weekly
  const dow = today.getDay();
  const daysToFriday = dow === 0 ? -2 : 5 - dow;
  const friday = addDays(today, daysToFriday > 0 ? daysToFriday : daysToFriday);
  const payDate = lastBusinessDay(friday, holidays);
  return todayStr >= dateKey(payDate) && isoWeekKey(today) === isoWeekKey(friday)
    ? { payDate: dateKey(payDate), periodKey: isoWeekKey(friday) }
    : null;
}

// Retorna la próxima fecha de pago (para mostrar al usuario).
export function getNextPayDate(
  frequency: "monthly" | "biweekly" | "weekly",
  today: Date,
): string {
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  const todayStr = dateKey(today);
  const holidays = getColombianHolidays(year);

  const nextMonthPayDate = () => {
    const nm = month === 12 ? 1 : month + 1;
    const ny = month === 12 ? year + 1 : year;
    return dateKey(lastBusinessDay(new Date(ny, nm, 0), holidays));
  };

  if (frequency === "monthly") {
    const pd = dateKey(lastBusinessDay(new Date(year, month, 0), holidays));
    return todayStr <= pd ? pd : nextMonthPayDate();
  }

  if (frequency === "biweekly") {
    if (day <= 15) {
      const pd = dateKey(lastBusinessDay(new Date(year, month - 1, 15), holidays));
      if (todayStr <= pd) return pd;
    }
    const pd = dateKey(lastBusinessDay(new Date(year, month, 0), holidays));
    if (todayStr <= pd) return pd;
    // Q1 del mes siguiente
    const nm = month === 12 ? 1 : month + 1;
    const ny = month === 12 ? year + 1 : year;
    return dateKey(lastBusinessDay(new Date(ny, nm - 1, 15), holidays));
  }

  // weekly — próximo viernes hábil
  const dow = today.getDay();
  const daysToFriday = dow <= 5 ? 5 - dow : 6;
  const friday = addDays(today, daysToFriday === 0 ? 7 : daysToFriday);
  return dateKey(lastBusinessDay(friday, holidays));
}

// ── Ingresos no-salario con día de pago fijo ──────────────────────────────

function clampDay(day: number, year: number, month: number): number {
  return Math.min(day, new Date(year, month, 0).getDate());
}

// Retorna el período activo si ya llegó el día de pago, o null si todavía no.
export function getCustomPayPeriod(
  frequency: "monthly" | "biweekly" | "weekly",
  today: Date,
  dayOfMonth: number,
): PayPeriod | null {
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  const todayStr = dateKey(today);
  const pad = (n: number) => String(n).padStart(2, "0");

  if (frequency === "monthly") {
    const pd = `${year}-${pad(month)}-${pad(clampDay(dayOfMonth, year, month))}`;
    return todayStr >= pd ? { payDate: pd, periodKey: `${year}-${pad(month)}` } : null;
  }

  if (frequency === "biweekly") {
    if (day <= 15) {
      const q1Day = clampDay(Math.min(dayOfMonth, 15), year, month);
      const pd = `${year}-${pad(month)}-${pad(q1Day)}`;
      return todayStr >= pd ? { payDate: pd, periodKey: `${year}-${pad(month)}-Q1` } : null;
    }
    // Q2: siempre último día del mes
    const lastDay = new Date(year, month, 0).getDate();
    const pd = `${year}-${pad(month)}-${pad(lastDay)}`;
    return todayStr >= pd ? { payDate: pd, periodKey: `${year}-${pad(month)}-Q2` } : null;
  }

  // weekly: usa último día hábil de semana (aplica independientemente de is_salary)
  return getCurrentPayPeriod("weekly", today);
}

// Retorna la próxima fecha de pago para un ingreso no-salario.
export function getNextCustomPayDate(
  frequency: "monthly" | "biweekly" | "weekly",
  today: Date,
  dayOfMonth: number,
): string {
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  const todayStr = dateKey(today);
  const pad = (n: number) => String(n).padStart(2, "0");

  const nextQ1 = (y: number, m: number) => {
    const d = clampDay(Math.min(dayOfMonth, 15), y, m);
    return `${y}-${pad(m)}-${pad(d)}`;
  };
  const lastDayStr = (y: number, m: number) =>
    `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}`;

  if (frequency === "monthly") {
    const pd = `${year}-${pad(month)}-${pad(clampDay(dayOfMonth, year, month))}`;
    if (todayStr <= pd) return pd;
    const nm = month === 12 ? 1 : month + 1;
    const ny = month === 12 ? year + 1 : year;
    return `${ny}-${pad(nm)}-${pad(clampDay(dayOfMonth, ny, nm))}`;
  }

  if (frequency === "biweekly") {
    if (day <= 15) {
      const pd = nextQ1(year, month);
      if (todayStr <= pd) return pd;
    }
    const pd = lastDayStr(year, month);
    if (todayStr <= pd) return pd;
    const nm = month === 12 ? 1 : month + 1;
    const ny = month === 12 ? year + 1 : year;
    return nextQ1(ny, nm);
  }

  return getNextPayDate("weekly", today);
}
