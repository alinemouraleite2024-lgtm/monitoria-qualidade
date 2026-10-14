// Desloca o relógio do processo (JS e, por ele, o do PGlite) em DIAS_DESLOCADOS dias.
const d = Number(process.env.DIAS_DESLOCADOS || 0) * 864e5;
const Real = Date;
class Falso extends Real { constructor(...a) { super(...(a.length ? a : [Real.now() + d])); } static now() { return Real.now() + d; } }
globalThis.Date = Falso;
