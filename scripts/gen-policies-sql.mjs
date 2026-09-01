// Genera 0005_seed_policies.sql a partir de POLITICAS_AGOSTO, transcripta
// literalmente del cotizador legacy (medife_cotizador_individual.html, líneas 1172-1221).
import { writeFileSync } from 'fs';

const PLANES_CODES = ['INDIE', 'MEDIFEPLUS', 'BRONCE_C', 'BRONCE', 'PLATA', 'ORO', 'PLATINUM'];

const POLITICAS_AGOSTO = [
  {id:'prestadores-medife-amba',nombre:'PRESTADORES MEDIFE AMBA',tipo:'gaf',region:'AMBA',cat:'ambas',proc:'GAF',zona:null,valor:-0.15,planes:[true, true, true, true, true, true, true],detalle:'Val sobre valor final',permanente:true,plazoMeses:null},
  {id:'clientes-tributo-simple',nombre:'CLIENTES TRIBUTO SIMPLE',tipo:'gaf',region:'Nac',cat:'ambas',proc:'GAF',zona:null,valor:-0.1,planes:[true, true, true, true, true, true, true],detalle:'Val sobre valor final',permanente:true,plazoMeses:null},
  {id:'planes-empleados-10',nombre:'PLANES EMPLEADOS 10%',tipo:'gaf',region:'Nac',cat:'Obl',proc:'GAF',zona:null,valor:-0.1,planes:[true, true, true, true, true, true, true],detalle:'Val sobre valor final',permanente:true,plazoMeses:null},
  {id:'planes-empleados-15',nombre:'PLANES EMPLEADOS 15%',tipo:'gaf',region:'Nac',cat:'Obl',proc:'GAF',zona:null,valor:-0.15,planes:[true, true, true, true, true, true, true],detalle:'Val sobre valor final',permanente:true,plazoMeses:12},
  {id:'acipan',nombre:'ACIPAN',tipo:'gaf',region:'SurExt',cat:'ambas',proc:'GAF',zona:null,valor:-0.1,planes:[true, true, true, true, true, true, true],detalle:'Val sobre valor final',permanente:true,plazoMeses:12},
  {id:'camara-bariloche',nombre:'CAMARA DE COMERCIO BARILOCHE',tipo:'gaf',region:'SurExt',cat:'ambas',proc:'GAF',zona:null,valor:-0.1575,planes:[true, true, true, true, true, true, true],detalle:'Val sobre valor final',permanente:true,plazoMeses:12},
  {id:'ex-invap-jubilados',nombre:'EX INVAP JUBILADOS',tipo:'gaf',region:'SurExt',cat:'ambas',proc:'GAF',zona:null,valor:-0.3,planes:[true, true, true, true, true, true, true],detalle:'Val sobre valor final',permanente:true,plazoMeses:12},
  {id:'prestadores-medife-sur',nombre:'PRESTADORES MEDIFE SUR',tipo:'gaf',region:'SurExt',cat:'ambas',proc:'GAF',zona:null,valor:-0.15,planes:[true, true, true, true, true, true, true],detalle:'Val sobre valor final',permanente:true,plazoMeses:12},
  {id:'prestadores-medife-norte',nombre:'PRESTADORES MEDIFE NORTE',tipo:'gaf',region:'Norte',cat:'ambas',proc:'GAF',zona:null,valor:-0.15,planes:[true, true, true, true, true, true, true],detalle:'Val sobre valor final',permanente:true,plazoMeses:12},
  {id:'ucc',nombre:'UCC',tipo:'ucc',region:'Norte',cat:'ambas',proc:'GAF',zona:null,valor:-0.15,planes:[true, true, true, true, true, true, true],detalle:'Empleador acumulable',permanente:true,plazoMeses:null},
  {id:'recargo-comahue-Obl',nombre:'Recargo Comahue Obl',tipo:'recargo',region:'Sur',cat:'Obl',proc:'',zona:'Comahue',valor:0.16,planes:[true, true, true, true, true, true, true],detalle:'Comahue +16%',permanente:true,plazoMeses:null},
  {id:'recargo-patagonia-sur-Obl',nombre:'Recargo Patagonia Sur Obl',tipo:'recargo',region:'Sur',cat:'Obl',proc:'',zona:'Patagonia Sur',valor:0.16,planes:[true, true, true, true, true, true, true],detalle:'Patagonia Sur +16%',permanente:true,plazoMeses:null},
  {id:'recargo-patagonia-norte-Obl',nombre:'Recargo Patagonia Norte Obl',tipo:'recargo',region:'Sur',cat:'Obl',proc:'',zona:'Patagonia Norte',valor:0.16,planes:[true, true, true, true, true, true, true],detalle:'Patagonia Norte +16%',permanente:true,plazoMeses:null},
  {id:'recargo-comahue-Vol',nombre:'Recargo Comahue Vol',tipo:'recargo',region:'Sur',cat:'Vol',proc:'',zona:'Comahue',valor:0.26,planes:[true, true, true, true, true, true, true],detalle:'Comahue +26%',permanente:true,plazoMeses:null},
  {id:'recargo-patagonia-sur-Vol',nombre:'Recargo Patagonia Sur Vol',tipo:'recargo',region:'Sur',cat:'Vol',proc:'',zona:'Patagonia Sur',valor:0.26,planes:[true, true, true, true, true, true, true],detalle:'Patagonia Sur +26%',permanente:true,plazoMeses:null},
  {id:'recargo-patagonia-norte-Vol',nombre:'Recargo Patagonia Norte Vol',tipo:'recargo',region:'Sur',cat:'Vol',proc:'',zona:'Patagonia Norte',valor:0.26,planes:[true, true, true, true, true, true, true],detalle:'Patagonia Norte +26%',permanente:true,plazoMeses:null},
  {id:'recargo-bahia-Vol',nombre:'Recargo Bahía/MDQ Vol',tipo:'recargo',region:'Sur',cat:'Vol',proc:'',zona:'Bahía Blanca,Mar del Plata',valor:0.05,planes:[true, true, true, true, true, true, true],detalle:'Bahía Blanca / Mar del Plata +5%',permanente:true,plazoMeses:null},
  {id:'segmento-joven-h-29-amba-Vol',nombre:'Segmento Joven h/29',tipo:'dto',region:'AMBA',cat:'Vol',proc:'',zona:null,valor:-0.13,planes:[false, true, true, true, true, true, true],detalle:'Titulares_Hasta 29 años y 11 meses',permanente:true,plazoMeses:null},
  {id:'segmento-joven-h-29-amba-Obl',nombre:'Segmento Joven h/29',tipo:'dto',region:'AMBA',cat:'Obl',proc:'',zona:null,valor:-0.13,planes:[false, true, true, true, true, true, true],detalle:'Titulares_Hasta 29 años y 11 meses',permanente:true,plazoMeses:null},
  {id:'segmento-joven-h-25-amba-Vol',nombre:'Segmento Joven h/25',tipo:'dto',region:'AMBA',cat:'Vol',proc:'',zona:null,valor:-0.26,planes:[false, false, true, true, true, true, true],detalle:'Titulares_Hasta 25 años y 11 meses',permanente:true,plazoMeses:null},
  {id:'segmento-joven-h-25-amba-Obl',nombre:'Segmento Joven h/25',tipo:'dto',region:'AMBA',cat:'Obl',proc:'',zona:null,valor:-0.26,planes:[true, false, true, true, true, true, true],detalle:'Titulares_Hasta 25 años y 11 meses',permanente:true,plazoMeses:null},
  {id:'segmento-joven-h-25-interior-Vol',nombre:'Segmento Joven h/25',tipo:'dto',region:'Interior',cat:'Vol',proc:'',zona:null,valor:-0.26,planes:[false, false, true, true, true, true, true],detalle:'Titulares y Conyugues_Hasta 25 años y 11 meses',permanente:true,plazoMeses:null},
  {id:'segmento-joven-h-25-interior-Obl',nombre:'Segmento Joven h/25',tipo:'dto',region:'Interior',cat:'Obl',proc:'',zona:null,valor:-0.26,planes:[false, false, true, true, true, true, true],detalle:'Titulares y Conyugues_Hasta 25 años y 11 meses',permanente:true,plazoMeses:null},
  {id:'ajuste-lista-hijos-amba-Obl',nombre:'Ajuste lista Hijos',tipo:'dto',region:'AMBA',cat:'Obl',proc:'',zona:null,valor:-0.45,planes:[false, true, true, true, true, true, true],detalle:'Ajuste lista Hijos (hasta 25 años en AMBA)',permanente:true,plazoMeses:null},
  {id:'ajuste-lista-hijos-amba-Vol',nombre:'Ajuste lista Hijos',tipo:'dto',region:'AMBA',cat:'Vol',proc:'',zona:null,valor:-0.45,planes:[false, true, true, true, true, true, true],detalle:'Ajuste lista Hijos (hasta 25 años en AMBA)',permanente:true,plazoMeses:null},
  {id:'ajuste-lista-hijos-interior-Obl',nombre:'Ajuste lista Hijos',tipo:'dto',region:'Interior',cat:'Obl',proc:'',zona:null,valor:-0.55,planes:[false, true, true, true, true, true, true],detalle:'Ajuste lista Hijos',permanente:true,plazoMeses:null},
  {id:'ajuste-lista-hijos-interior-Vol',nombre:'Ajuste lista Hijos',tipo:'dto',region:'Interior',cat:'Vol',proc:'',zona:null,valor:-0.55,planes:[false, true, true, true, true, true, true],detalle:'Ajuste lista Hijos',permanente:true,plazoMeses:null},
  {id:'descuento-filial-noa-Obl',nombre:'Descuento Filial NOA',tipo:'dto',region:'Norte',cat:'Obl',proc:'',zona:'NOA',valor:-0.2,planes:[false, true, true, true, true, true, true],detalle:'NOA -20%',permanente:true,plazoMeses:null},
  {id:'descuento-filial-misiones-corrientes-Obl',nombre:'Descuento Filial Misiones/Corrientes',tipo:'dto',region:'Norte',cat:'Obl',proc:'',zona:'Misiones,Corrientes',valor:-0.25,planes:[false, true, true, true, true, true, true],detalle:'Misiones, Corrientes -25%',permanente:true,plazoMeses:null},
  {id:'descuento-filial-cordoba-Obl',nombre:'Descuento Filial Córdoba',tipo:'dto',region:'Norte',cat:'Obl',proc:'',zona:'Córdoba',valor:-0.1,planes:[false, true, true, true, true, true, true],detalle:'Córdoba -10%',permanente:true,plazoMeses:null},
  {id:'descuento-filial-santa-fe-Obl',nombre:'Descuento Filial Santa Fe',tipo:'dto',region:'Norte',cat:'Obl',proc:'',zona:'Santa Fe',valor:-0.05,planes:[false, true, true, true, true, true, true],detalle:'Santa Fe -5%',permanente:true,plazoMeses:null},
  {id:'opcion-1-nac-Vol',nombre:'Opción 1',tipo:'dto',region:'Nac',cat:'Vol',proc:'',zona:null,valor:-0.3,planes:[false, true, true, true, true, true, true],detalle:'30% × 3; 20% × 2; 10% × 2',permanente:false,plazoMeses:7,schedule:[{valor:-0.3,months:3},{valor:-0.2,months:2},{valor:-0.1,months:2}]},
  {id:'opcion-2-nac-Vol',nombre:'Opción 2',tipo:'dto',region:'Nac',cat:'Vol',proc:'',zona:null,valor:-0.3,planes:[false, true, true, true, true, true, true],detalle:'30% × 3; 10% × 6',permanente:false,plazoMeses:9,schedule:[{valor:-0.3,months:3},{valor:-0.1,months:6}]},
  {id:'opcion-3-nac-Vol',nombre:'Opción 3',tipo:'dto',region:'Nac',cat:'Vol',proc:'',zona:null,valor:-0.15,planes:[false, true, true, true, true, true, true],detalle:'15% × 10 meses',permanente:false,plazoMeses:10},
  {id:'opcion-4-nac-Vol',nombre:'Opción 4',tipo:'dto',region:'Nac',cat:'Vol',proc:'comprobable',zona:null,valor:-0.15,planes:[false, true, true, true, true, true, true],detalle:'15% × 12 · Con procedencia comprobable',permanente:false,plazoMeses:12},
  {id:'opcion-5-nac-Vol',nombre:'Opción 5',tipo:'dto',region:'Nac',cat:'Vol',proc:'comprobable',zona:null,valor:-0.05,planes:[false, true, true, true, true, true, true],detalle:'5% × 6 · Concatenable con Op 1,2,3',permanente:false,plazoMeses:6,concatenable:true},
  {id:'opcion-1-nac-Obl',nombre:'Opción 1',tipo:'dto',region:'Nac',cat:'Obl',proc:'',zona:null,valor:-0.45,planes:[false, true, true, true, true, true, true],detalle:'45% × 2; 30% × 3; 15% × 2',permanente:false,plazoMeses:7,schedule:[{valor:-0.45,months:2},{valor:-0.3,months:3},{valor:-0.15,months:2}]},
  {id:'opcion-2-nac-Obl',nombre:'Opción 2',tipo:'dto',region:'Nac',cat:'Obl',proc:'',zona:null,valor:-0.3,planes:[false, true, true, true, true, true, true],detalle:'30% × 6; 10% × 3',permanente:false,plazoMeses:9,schedule:[{valor:-0.3,months:6},{valor:-0.1,months:3}]},
  {id:'opcion-3-nac-Obl',nombre:'Opción 3',tipo:'dto',region:'Nac',cat:'Obl',proc:'',zona:null,valor:-0.2,planes:[false, true, true, true, true, true, true],detalle:'20% × 11 meses',permanente:false,plazoMeses:11},
  {id:'opcion-4-nac-Obl',nombre:'Opción 4',tipo:'dto',region:'Nac',cat:'Obl',proc:'comprobable',zona:null,valor:-0.2,planes:[false, true, true, true, true, true, true],detalle:'20% × 12 · Con procedencia comprobable',permanente:false,plazoMeses:12,concatenable:true},
  {id:'opcion-5-nac-Obl',nombre:'Opción 5',tipo:'dto',region:'Nac',cat:'Obl',proc:'comprobable',zona:null,valor:-0.05,planes:[false, true, true, true, true, true, true],detalle:'5% × 6 · Concatenable con Op 1,2,3',permanente:false,plazoMeses:6,concatenable:true},
  {id:'dto-mes-18-65-amba-oro-Obl',nombre:'Dto Mes ORO 18/65',tipo:'dto',region:'AMBA',cat:'Obl',proc:'',zona:null,valor:-0.1,planes:[false, false, false, false, false, true, false],detalle:'ORO 18 a 65 años · Acumulable con Dto Estratégico',permanente:false,plazoMeses:6},
  {id:'dto-mes-41-65-amba-plat-Obl',nombre:'Dto Mes Platinum 41/65',tipo:'dto',region:'AMBA',cat:'Obl',proc:'',zona:null,valor:-0.1,planes:[false, false, false, false, false, false, true],detalle:'Platinum 41 a 65 años · Acumulable con Dto Estratégico',permanente:false,plazoMeses:6},
  {id:'dto-mes-36-65-amba-oro-Vol',nombre:'Dto Mes ORO 36/65',tipo:'dto',region:'AMBA',cat:'Vol',proc:'',zona:null,valor:-0.1,planes:[false, false, false, false, false, true, false],detalle:'ORO 36 a 65 años · Acumulable con Dto Estratégico',permanente:false,plazoMeses:6},
  {id:'dto-mes-18-65-sur-oro-Obl',nombre:'Dto Mes ORO 18/65',tipo:'dto',region:'Sur',cat:'Obl',proc:'',zona:null,valor:-0.1,planes:[false, false, false, false, false, true, false],detalle:'ORO 18 a 65 años · Acumulable con Dto Estratégico',permanente:false,plazoMeses:6},
  {id:'dto-indie-18-25-amba-Obl',nombre:'Dto Indie 18/25',tipo:'dto',region:'AMBA',cat:'Obl',proc:'',zona:null,valor:-0.185,planes:[true, false, false, false, false, false, false],detalle:'Indie 18 a 25 años',permanente:false,plazoMeses:12},
  {id:'dto-indie-26-35-amba-Obl',nombre:'Dto Indie 26/35',tipo:'dto',region:'AMBA',cat:'Obl',proc:'',zona:null,valor:-0.2,planes:[true, false, false, false, false, false, false],detalle:'Indie 26 a 35 años',permanente:false,plazoMeses:12},
  {id:'dto-indie-36-40-amba-Obl',nombre:'Dto Indie 36/40',tipo:'dto',region:'AMBA',cat:'Obl',proc:'',zona:null,valor:-0.28,planes:[true, false, false, false, false, false, false],detalle:'Indie 36 a 40 años',permanente:false,plazoMeses:12},
];

function sq(s) {
  if (s === null || s === undefined) return 'null';
  return `'${String(s).replace(/'/g, "''")}'`;
}
function num(n) {
  return n === null || n === undefined ? 'null' : n;
}
function bool(b) {
  return b ? 'true' : 'false';
}

const lines = [];
lines.push('-- Semilla de políticas de descuento/recargo/gaf/ucc (fase 1): transcripción 1:1');
lines.push('-- de POLITICAS_AGOSTO del cotizador legacy (medife_cotizador_individual.html).');
lines.push('-- La categoría "ambas" del legacy se representa con categoria_scope = null (sin filtro).');
lines.push('');
lines.push('insert into discount_policies (id, nombre, tipo, region, categoria_scope, procedencia_gate, zona_filial, valor_pct, permanente, plazo_meses, concatenable, detalle) values');

const policyRows = POLITICAS_AGOSTO.map((pol) => {
  const catScope = pol.cat === 'ambas' ? 'null' : sq(pol.cat);
  return `  (${sq(pol.id)}, ${sq(pol.nombre)}, ${sq(pol.tipo)}, ${sq(pol.region)}, ${catScope}, ${sq(pol.proc || '')}, ${sq(pol.zona)}, ${pol.valor}, ${bool(pol.permanente)}, ${num(pol.plazoMeses)}, ${bool(!!pol.concatenable)}, ${sq(pol.detalle)})`;
});
lines.push(policyRows.join(',\n') + ';');
lines.push('');

lines.push('insert into discount_policy_plan_rules (discount_policy_id, plan_code, aplica) values');
const planRuleRows = [];
for (const pol of POLITICAS_AGOSTO) {
  pol.planes.forEach((aplica, i) => {
    planRuleRows.push(`  (${sq(pol.id)}, ${sq(PLANES_CODES[i])}, ${bool(aplica)})`);
  });
}
lines.push(planRuleRows.join(',\n') + ';');
lines.push('');

const withSchedule = POLITICAS_AGOSTO.filter((p) => p.schedule);
lines.push('insert into discount_policy_schedule (discount_policy_id, seq, valor_pct, months) values');
const scheduleRows = [];
for (const pol of withSchedule) {
  pol.schedule.forEach((block, i) => {
    scheduleRows.push(`  (${sq(pol.id)}, ${i + 1}, ${block.valor}, ${block.months})`);
  });
}
lines.push(scheduleRows.join(',\n') + ';');

writeFileSync(new URL('../supabase/migrations/0005_seed_policies.sql', import.meta.url), lines.join('\n') + '\n');
console.log(`Generated ${POLITICAS_AGOSTO.length} policies, ${planRuleRows.length} plan rules, ${scheduleRows.length} schedule rows`);
