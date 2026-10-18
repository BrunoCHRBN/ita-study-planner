export function formatISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getTodayISO(): string {
  return formatISODate(new Date());
}

export function addDaysISO(baseIso: string, days: number): string {
  const [y, m, d] = baseIso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return formatISODate(dt);
}

/**
 * Retorna os 7 dias da semana (Segunda a Domingo) que contém a data referência.
 */
export function getWeekDatesISO(referenceIso: string): {
  date: string;
  dayOfWeek: number; // 0 (Dom) a 6 (Sab)
  labelShort: string;
  labelFull: string;
  dayNumber: string;
}[] {
  const [y, m, d] = referenceIso.split("-").map(Number);
  const ref = new Date(y, m - 1, d);
  const currentDay = ref.getDay(); // 0 = Dom, 1 = Seg ... 6 = Sab
  // Ajustar para Segunda-feira como início da semana tática
  const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
  const monday = new Date(y, m - 1, d + diffToMonday);

  const shortNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const fullNames = [
    "Domingo",
    "Segunda-feira",
    "Terça-feira",
    "Quarta-feira",
    "Quinta-feira",
    "Sexta-feira",
    "Sábado",
  ];

  const result = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(
      monday.getFullYear(),
      monday.getMonth(),
      monday.getDate() + i
    );
    const dow = dt.getDay();
    result.push({
      date: formatISODate(dt),
      dayOfWeek: dow,
      labelShort: shortNames[dow],
      labelFull: fullNames[dow],
      dayNumber: String(dt.getDate()).padStart(2, "0"),
    });
  }
  return result;
}

export function formatMinutes(totalMinutes: number): string {
  const sign = totalMinutes < 0 ? "-" : "";
  const abs = Math.abs(Math.round(totalMinutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${sign}${m}m`;
  if (m === 0) return `${sign}${String(h).padStart(2, "0")}h00`;
  return `${sign}${String(h).padStart(2, "0")}h${String(m).padStart(2, "0")}`;
}

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(mins: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(mins)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatEditorialDatePtBr(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const weekdays = [
    "Domingo",
    "Segunda-feira",
    "Terça-feira",
    "Quarta-feira",
    "Quinta-feira",
    "Sexta-feira",
    "Sábado",
  ];
  const months = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  return `${weekdays[dt.getDay()]}, ${d} de ${months[dt.getMonth()]} de ${y}`;
}
