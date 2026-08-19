// Cálculo de dias úteis. Funções puras, sem dependência de estado da aplicação.
// Extraídas do App.jsx na F0-12 sem alteração de lógica.

export const getBusinessDaysInMonth = (year: number, month: number): number => {
  let count = 0;
  const date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    const day = date.getDay();
    if (day !== 0 && day !== 6) count++;
    date.setDate(date.getDate() + 1);
  }
  return count;
};

export const getBusinessDaysRemaining = (year: number, month: number, currentDayStr: string): number => {
  const today = new Date(currentDayStr);
  let count = 0;
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  while (date.getMonth() === month) {
    const day = date.getDay();
    if (day !== 0 && day !== 6) count++;
    date.setDate(date.getDate() + 1);
  }
  return count;
};
