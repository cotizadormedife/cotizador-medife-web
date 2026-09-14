-- Bug real: "concatenable" en el motor de cálculo significa "se aplica recién
-- después de que termine el plazo de las políticas no concatenables"
-- (comportamiento pensado originalmente para la Opción 5). La Opción 6 se
-- había cargado con concatenable=true reutilizando ese mismo mecanismo, pero
-- su regla de negocio real es otra: se suma a la Opción 4 en simultáneo,
-- durante los mismos 12 meses (15%+15% = 30%, no 15% seguido de otro 15%
-- después). Además, Opción 4 Obligatorio había quedado con concatenable=true
-- por asimetría con la versión Voluntario (que sí estaba en false), lo que
-- hacía que el descuento ni siquiera se reflejara en el precio "hoy" de las
-- tarjetas de plan cuando Opción 4 Obligatorio se elegía sola.
update discount_policies set concatenable = false where id in (
  'opcion-4-nac-Obl',
  'opcion-6-nac-Vol',
  'opcion-6-nac-Obl'
);
