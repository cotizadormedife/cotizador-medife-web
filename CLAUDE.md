# Cotizador Medife Individual — Contexto del proyecto

> Generado a partir de la sesión de trabajo entre Diego Schwartzman (Producto y Precios, Medife) y Claude, para que cualquier persona (o cualquier sesión de Claude Code) pueda retomar el desarrollo sin haber estado en esa conversación. Pensado tanto para un compañero humano como para que Claude Code lo cargue automáticamente al abrir este repo.

## Qué es esto

Reescritura del cotizador de planes individuales de Medife (`medife_cotizador_individual.html`, un archivo HTML/JS legacy que corría 100% en el navegador, con toda la lista de precios y política de descuentos visible/editable desde las herramientas de desarrollador) como una aplicación web real:

- Precios, descuentos y lógica de cálculo viven **solo en el servidor** (Server Actions de Next.js con `service_role` de Supabase) — el navegador nunca recibe la tabla completa.
- Login con email + contraseña (Supabase Auth) + aprobación manual de un admin. Tres roles: `vendedor` / `admin` / `super_admin`.
- Cada cotización queda guardada con usuario, fecha y detalle completo (trazabilidad).
- El super_admin sube un Excel nuevo cada mes (lista de precios + políticas de descuento + regiones/filiales + planes, todo versionado por carga) y el sistema lo valida antes de activarlo.

Fase actual: solo el cotizador **individual**. El corpo (`medife_cotizador_corpo.html`) es una fase futura, no tocada.

El corpus completo de decisiones de producto y reglas de negocio está en los documentos de `OneDrive - ASE Conecta\Documents\Cotizador Medife\` (ver más abajo) — este archivo es un mapa para orientarse en el código, no reemplaza esos documentos.

## Stack

- **Next.js 15 (App Router, TypeScript)**, desplegado en **Vercel**.
- **Supabase**: Postgres + Auth + Storage. Cliente `anon` en el navegador solo para login; toda lectura/escritura de precios/descuentos/cotizaciones pasa por Server Actions con `service_role` (nunca expuesta al cliente). RLS como segunda barrera.
- `exceljs` para parsear el Excel de precios/descuentos del lado del servidor.
- `vitest` para tests unitarios (motor de cálculo, importadores).

## ⚠️ Hay DOS entornos en paralelo — todo cambio va a ambos

Este proyecto se migró de infraestructura una vez (agosto/septiembre 2026) y quedaron dos entornos productivos corriendo en simultáneo. **Todo commit se pushea a los dos remotos y se despliega en los dos.**

| | Entorno viejo | Entorno nuevo (el que usa Diego hoy) |
|---|---|---|
| GitHub | `github.com/ugdieguin/cotizador-medife-web` (remoto `origin`) | `github.com/cotizadormedife/cotizador-medife-web` (remoto `nuevo`) |
| Vercel | cuenta `diego-schwartzman` | cuenta "Medife" (plan Pro) |
| Dominio | `cotizador-medife-web.vercel.app` | **`cotizadormedife.com`** (comprado en GoDaddy) |
| Supabase | proyecto `vaerofsqxhcgxinezjpr` (us-west-2) | proyecto `vhbemwwqnkpgjtsvdjgi` (us-east-2) |
| Deploy | **manual**: `vercel --prod` (ver comando exacto abajo) | **automático** vía GitHub App al pushear a `nuevo` |

Los datos se migraron 1:1 entre ambos proyectos de Supabase (incluidas las contraseñas reales de los ~67 usuarios, copiadas como hash bcrypt directo). El `.env.local` de desarrollo local apunta hoy al proyecto **viejo** (`vaerofsqxhcgxinezjpr`) — tenelo en cuenta si algo no aparece donde esperás verlo en producción (`cotizadormedife.com` usa el proyecto nuevo).

**Flujo real usado en toda esta sesión, después de cada cambio:**

```bash
git push origin main
git push nuevo main
# entorno viejo: deploy manual
vercel --prod --yes
# entorno nuevo: se despliega solo (GitHub App) — no hace falta nada más
```

## Cómo correr esto localmente

No hay Node en el PATH del sistema en la máquina de Diego — hay un Node portable:

```bash
export PATH="/c/Users/dschwartzman/AppData/Local/node-portable/node-v22.14.0-win-x64:$PATH"
```

Dos certificados CA distintos entran en juego según qué se esté haciendo (esto costó bastante tiempo de diagnóstico en su momento, no son intercambiables):

- **Llamadas HTTPS/fetch normales** (Supabase Admin API, etc.) — proxy corporativo Netskope intercepta TLS. Hace falta:
  `export NODE_EXTRA_CA_CERTS="/c/Users/dschwartzman/AppData/Local/node-portable/netskope-ca.pem"`
- **Conexiones directas a Postgres** (scripts con `pg`, `MIGRATION_DATABASE_URL`) — usan el certificado propio de Supabase, NO el de Netskope:
  `NODE_EXTRA_CA_CERTS` apuntando a `C:\Users\dschwartzman\Downloads\prod-ca-2021.crt`
- Hay un bundle combinado en `AppData\Local\node-portable\combined-ca-bundle.pem` para scripts que necesitan ambos.

Comandos:

```bash
npm run dev          # servidor local, puerto 3000
npx tsc --noEmit -p . # typecheck — correr SIEMPRE antes de dar un cambio por terminado
npx vitest run        # suite de tests (76 tests al momento de escribir esto, lib/pricing + lib/excel + printLabels)
```

`.env.local` (no versionado) necesita: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SITE_URL`. Pedirle los valores reales a Diego — nunca están en el repo.

## Flujo de trabajo esperado para cada cambio

Este es el proceso que se siguió consistentemente durante toda la sesión, no es negociable salvo que Diego diga lo contrario:

1. Código + tests (Vitest) para todo lo que tenga lógica no trivial (el motor de cálculo y los importadores de Excel están muy bien cubiertos; los componentes de formulario React normalmente no tienen tests unitarios propios, se verifican en vivo).
2. `npx tsc --noEmit -p .` y `npx vitest run` en verde antes de seguir.
3. **Verificación en vivo en el navegador** con una cuenta de prueba descartable — nunca dar un cambio de UI por probado solo con tests:
   - Crear: `node scripts/create-test-user.mjs <email> <password> <nombre> <apellido> <celular>`
   - Aprobar: actualizar `profiles.status='approved'` directo (hay varios scripts puntuales creados y borrados durante la sesión con este patrón — `approve-test-user.mjs` quedó en `scripts/` como reutilizable)
   - Para probar como super_admin: además `role='super_admin'` y `empresa_id` = Medife (`00000000-0000-0000-0000-000000000001`) — el trigger de la base exige que todo super_admin pertenezca a Medife.
   - Probar en el navegador (login → la funcionalidad → confirmar).
   - Limpiar: `node scripts/delete-one-user.mjs <email>` — **si el usuario tiene role admin/super_admin, el hard-delete de Supabase Auth suele fallar ("Database error deleting user")**; en ese caso hacer soft-delete manual: `role='vendedor', status='rejected', disabled_at=now()`. Si el usuario llegó a generar cotizaciones de prueba, borrarlas también (`quotes` filtrando por `created_by`) antes de borrar el usuario.
4. Commit en español, con el número de RF entre paréntesis al final del asunto, y el trailer de coautoría:
   ```
   Descripción del cambio en español (RF-NN)

   Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
   ```
5. Push a los dos remotos, deploy manual al entorno viejo, confirmar que el nuevo se desplegó solo.
6. **Actualizar documentación** (ver abajo) — esto es una directiva explícita de Diego, no opcional: Documento Funcional y Documento de Versionado en cada cambio funcional; Documento DER en cada cambio de estructura de base de datos, por menor que sea.

El numerado de RF sigue una única secuencia global — el siguiente disponible después de este documento es **RF-111**. Antes de asignar uno nuevo, confirmar el último real con:
```bash
git log --oneline | grep -oE "RF-[0-9]+" | sort -t- -k2 -n -u | tail -5
```

## El motor de cálculo (`lib/pricing/`)

- `engine.ts` — `computeQuote(input, data)`, función pura sin acceso a red. Pipeline: precio base por integrante → recargo geográfico (informativo, ya incluido en la lista) → Ajuste Lista Hijos → Segmento Joven → Descuento Filial → descuentos comerciales seleccionados (tope combinado -70%, reglas de exclusión/requisito leídas del Excel) → UCC → IVA (Voluntario) / Aportes estimados (Obligatorio) → GAF "interés general" (solo si ningún descuento comercial está activo) → proyección de cuotas 1-13/24/25.
- `memberKey.ts` — traduce (tipo de integrante, rango de edad) a la clave de precio. `rangoEfectivoPareja()` (RF-91) hace que Titular y Esposo/a con distinto rango se coticen ambos al más alto de los dos.
- `policyEligibility.ts` — toda la lógica de "¿esta política aplica acá, y es compatible con lo demás seleccionado?" (regiones, categoría, procedencia, rango de edad, exclusiones leídas del Excel).
- `repository.ts` — única puerta a Postgres para datos de pricing (usa `service_role`).
- `lib/excel/parseDiscountPolicies.ts` / `parsePriceList.ts` / `parseRegionesFiliales.ts` — importadores del Excel mensual. Cada carga versiona junto: precios, políticas de descuento, regiones/filiales y planes (todo atado a un `price_list_version_id`).

Reglas de negocio no obvias agregadas después del diseño inicial (ver el changelog más abajo para el detalle de cada una): exclusión mutua entre Opción 1/2/3, Opción 5 se suma (no concatena) con lo demás, Opción 6 exige Opción 4 y concatena después de su plazo, un descuento GAF a la vez, Monotributo cotiza siempre categoría A, Hijo 1/Hijo 2 con orden y unicidad en el interior, el importador ahora entiende "concatenable con [nombre]" apuntando a cualquier política (no solo a una Opción numerada).

## Estructura de carpetas

```
/app
  login, register, pending, /(auth)/...
  (app)/quotes/            cotizador + historial + PDF de impresión
  (app)/admin/users        gestión de usuarios (alcance completo si sos admin de Medife, acotado a tu empresa si no)
  (app)/admin/quotes       todas las cotizaciones, mismo alcance por empresa
  (app)/super-admin/       roles/empresas/price-lists — todo gateado por rol super_admin en el layout
/lib
  pricing/                 motor de cálculo (ver arriba)
  excel/                   importadores del Excel mensual
  auth/, supabase/, empresas.ts, auditLog.ts
/supabase/migrations       25 migraciones SQL al momento de escribir esto (0001 a 0025)
/scripts                   scripts de operación (migración, usuarios de prueba, promoción de roles) — usar el patrón NODE_EXTRA_CA_CERTS de arriba
```

## Documentación complementaria (OneDrive)

`C:\Users\dschwartzman\OneDrive - ASE Conecta\Documents\Cotizador Medife\`:

- **Documento_Funcional** — lista de RFs (requerimientos funcionales) con su descripción.
- **Documento_Versionado_y_Pedidos_de_Cambio** — historial de versiones (v1.NN), una fila por cambio, con fecha/hora real del commit y horas estimadas.
- **Documento_UAT** — casos de prueba.
- **Documento_Tecnico** — infraestructura actual (los dos entornos de la tabla de arriba), pendientes de infra.
- **Documento_DER_Modelo_de_Datos** — diagrama + diccionario de datos de las 21+ tablas.

**Directiva explícita de Diego, memorizada para toda sesión de Claude en este proyecto:** actualizar Funcional/Versionado en cada cambio funcional, y el DER en cada cambio de estructura de base de datos por menor que sea. Un audit de los 4 documentos (25/09/2026) encontró y corrigió un backfill grande: faltaban RF-49, 62, 67, 68, 72, 80, 81, 83 a 90 y 92 a 97 en Funcional, y 6 filas de versión (v1.58 a v1.63) en Versionado; también se agregó a Documento Técnico la descripción del segundo entorno (viejo) que faltaba. Documento_DER se confirmó al día, sin gaps. **Esto quedó al día hasta RF-110/v1.76 (10/10/2026)** — Funcional y Versionado incluyen RF-98 a RF-110 (RF-100/101/102 desarrollados por Rodrigo Mierez) y el resumen de la sección 1 del Versionado está recalculado. Antes de asumir que sigue así, pedirle a Claude que chequee de nuevo si pasó tiempo (todo cambio posterior puede no estar reflejado si no se pidió explícitamente actualizarlo).

## Pendientes conocidos (no resueltos al momento de escribir esto)

- SMTP del proyecto Supabase nuevo sigue sin configurar (usa el mailer gratuito de Supabase, rate limit bajo) — el viejo sí tiene SMTP propio (Gmail) configurado.
- ~~El importador nunca asignaba `tipo: "ucc"`~~ — resuelto en RF-102 (confirmado por el negocio con la lista de octubre 2026).
- **Topes de aportes cargados a mano en producción el 09/10/2026** (RF-103): agosto 4.509.567,41 y septiembre 4.691.748,47 (leídos de los Excel de esos meses) y octubre **4.771.508** (deducido del caso real de Diego, sueldo 4.771.508 = límite del tope; **pendiente confirmar contra la celda B9 de la hoja "C aux" del Excel de octubre**, la diferencia sería de centavos). El tope general de respaldo (`aporte_tope`) quedó en 4.771.508. Se fijaron con `scripts/fijar-tope-aportes.mjs <lista-uuid|general> <valor>` (lee `.env.nuevo`). Las cargas de Excel nuevas lo guardan solas y el reporte lo muestra. **Volver a subir el Excel de septiembre y octubre sigue siendo necesario solo por UCC (RF-102).**
- **Acceso de solo lectura/operación al proyecto nuevo**: `.env.nuevo` (no versionado, ignorado por git; contiene la URL y la `service_role` del proyecto de cotizadormedife.com) — cada persona crea el suyo desde Supabase → Project Settings → API Keys → pestaña "Legacy". `scripts/reporte-usuarios-cotizaciones.mjs` lo usa para el reporte de altas de usuarios y cuántos cotizaron; no escribe nada.
- **Otros parámetros del Excel que siguen fijos en el sistema** (misma clase de riesgo que el tope, hoy sin error conocido): tabla de Monotributo (hoja "C aux", B11:B21), factores 0,93/0,97 y porcentajes 2,55%/5,1%. Si cambian, hay que actualizarlos a mano en `monotributo_brackets`/`pricing_config` o extender el importador como se hizo con el tope.
- **Entorno viejo sincronizado el 06/10/2026**: RF-100 a RF-102 se habían subido solo al entorno nuevo (Rodrigo, con Diego ausente); Diego los trajo con un merge fast-forward de `nuevo/main`, los pusheó a `origin` y los desplegó con `vercel --prod`. **Ojo con el autor del último commit (`HEAD`)**: la cuenta vieja de Vercel (plan personal) solo acepta despliegues cuyo commit más reciente esté firmado por `ugdieguin`; con un `HEAD` de otra persona el `vercel --prod` queda colgado en estado `UNKNOWN` sin construir (pasó el 06/10 con `HEAD` de Rodrigo, y ya había pasado el 01/09 — commit `b289daf`). Si pasa: hacer un commit propio encima (aunque sea de documentación) y volver a desplegar. Cualquiera que trabaje en el repo con otra identidad de git debe tenerlo en cuenta, o decidir si el entorno viejo se da de baja.
- **El 30/09/2026 el push a `nuevo` no disparó el despliegue automático** (ningún ícono de Vercel en los commits de GitHub; el del 29/09 sí se desplegó solo). Se desplegó a mano con "Create Deployment" desde el panel de Vercel. El push siguiente (`8a6b49e`, mismo día) sí se desplegó solo, así que parece una falla puntual de la integración GitHub↔Vercel. Si vuelve a pasar: revisar la conexión Git del proyecto en Vercel y la GitHub App, y desplegar a mano mientras tanto.
- Diego mencionó una vez una segunda migración "solo de datos" a futuro — no la volvió a pedir, no es urgente.

## Changelog de funcionalidades (RF)

RF-1 a RF-43: funcionalidades base definidas en el Documento Funcional durante el desarrollo inicial (auth + aprobación, motor de cálculo, formulario del cotizador, historial/backoffice, importador de Excel, ABM de Empresas/Brokers). Para el detalle de cada uno, ver el Documento Funcional — no están tageados individualmente en los mensajes de commit de esa etapa.

Desde RF-44 en adelante, un renglón por commit (fecha, qué cambió):

- 2026-09-03 — Habilitar/deshabilitar listas de precios (RF-44, RF-45)
- 2026-09-03 — Número de cotización, buscador de usuarios, ajustes de UI (RF-46 a RF-49)
- 2026-09-04 — Número de cotización como título en resultado y PDF (RF-50)
- 2026-09-04 — Nombre y valor de cada descuento elegido, empresa del vendedor (RF-23, RF-52)
- 2026-09-04 — Cruce de filtros Usuario/Empresa en todas las cotizaciones (RF-53)
- 2026-09-07 — Activo/Inactivo por última cotización, luego corregido a fecha de alta (RF-55)
- 2026-09-07/08 — Link de primer ingreso sin vencimiento, regeneración manual, email confirmado al canjearlo (RF-21, RF-56, RF-57, RF-58)
- 2026-09-09 — Autogestión de datos personales en el header (RF-59)
- 2026-09-10 — Exclusión mutua Opción 1/2/3, Opción 6, tácticos regionales (RF-60/61/62)
- 2026-09-10/11 — Integrante 1 siempre Titular, un solo Esposo/a, un solo Titular (RF-63, ampliado)
- 2026-09-11 — Opción 6 exige Opción 4 (corrige RF-61); vigencia real en listas y cotizador (RF-64/65); elimina combo genérico de lista (RF-41)
- 2026-09-14 — Elegir pisar mes actual o crear el siguiente al cargar precios (RF-66)
- 2026-09-14 — Número de versión en la vigencia, Estado simplificado a Activa/Inactiva (RF-67/68)
- 2026-09-15 — Importador de descuentos/recargos versionado por lista (RF-M8); quitar/otorgar Admin-Super Admin (RF-70); importador de regiones/filiales, cotizador reactivo por lista (RF-M9)
- 2026-09-16 — Reglas de combinación de descuentos: exclusión bidireccional, no convivencia de tácticos en el mismo plan (RF-M10); rediseño de impresión/PDF (RF-71); cuota 25 en la proyección (RF-72)
- 2026-09-17 — Cadena de N concatenables sin principal, sueldo bruto en el PDF (RF-M12/RF-73); corrige Opción 6 (RF-79); corrige origen del aporte en PDF y Comentarios de GAF (RF-80/81)
- 2026-09-18 — Planes dinámicos por lista, leídos del Excel (RF-82/RF-M13); corrige Opción 5 (RF-83); ordena políticas por nombre (RF-84)
- 2026-09-22 — Corrige impresión duplicando ~34 páginas (RF-85); cronograma de descuento permanente sin %(RF-86); impresión rota del modal "Ver detalle" (RF-87); RLS en `_migrations` (RF-88)
- 2026-09-23 — Corrige crash en detalle de cotizaciones viejas, dos rondas (RF-89, RF-90)
- 2026-09-23 — **Titular/Esposo/a al rango de edad más alto entre ambos** (RF-91)
- 2026-09-23 — Botón "Nueva cotización" que resetea el formulario (RF-92, con ajuste de estilo el mismo día)
- 2026-09-23 — **Monotributo cotiza siempre categoría A, oculta al usuario** (RF-93); **un solo descuento GAF a la vez** (RF-94)
- 2026-09-23 — El importador entiende "concatenable con [nombre]" apuntando a cualquier política, no solo a una Opción numerada (RF-95)
- 2026-09-24 — **En el interior, Hijo 2 no se puede elegir antes que Hijo 1, y Hijo 1 es único por grupo** (RF-96)
- 2026-09-25 — **Botón "Eliminar" empresa/broker, bloqueado si tiene vendedores/admin asociados** (RF-97)
- 2026-09-25 — Botón "Aprobar" en "Todos los usuarios" para revertir un usuario `rejected` (antes quedaba bloqueado sin ninguna acción disponible en la interfaz) (RF-98)
- 2026-09-25 — **El % de "Uso Interno" (Ajuste Hijos / Segmento Joven) se calcula sobre el precio sin el recargo geográfico**, no sobre el precio de lista — el sistema de Medife donde se carga ese % no tiene el recargo en su propia base (RF-99)
- 2026-09-29 — **Segmento Joven h/29 (AMBA, Titular 26-35 sin familia) pasa a ser optativo**: se muestra tildado por default en "Opciones de descuento" y el vendedor lo destilda si el titular tiene 30-35 años (pedido de brokers y fuerza de ventas). Se guarda como `sinSegmentoJoven29` en `quotes.input`, sin cambio de estructura en la base (RF-100)
- 2026-09-30 — **Opción 1/2/3 van solo con Opción 5 y Opción 4 solo con Opción 6** (Opción 7 sigue sola): tildar una destilda las incompatibles, y el motor lo valida también (si llegan juntas, gana la elegida más recientemente). Se identifican por slug, el Excel no lo expresa en Comentarios. No afecta tácticos ni GAF (RF-101)
- 2026-09-30 — **UCC se importa con `tipo: "ucc"`** (antes quedaba como un GAF más y solo aplicaba sin descuento comercial activo) y se acumula con estratégicos/tácticos; el importador entiende "No es acumulable a otro GAF" (lista de octubre 2026) como exclusión del grupo GAF. Las listas ya cargadas necesitan volver a subirse para tomarlo (RF-102). Esto resuelve el pendiente de UCC de la sección "Pendientes conocidos".
- 2026-10-09 — **El tope de remuneración para aportes se lee de cada Excel (hoja "C aux") y se guarda por lista** en `pricing_config` con la clave `aporte_tope@<id de la lista>` (sin cambio de estructura; `armarConfig` en `lib/pricing/configPorLista.ts`). Bug real: sueldo 4.771.508 daba aporte $347.591 y el Excel $354.069,75 — la fórmula era idéntica, el tope del sistema era el de agosto (RF-103)
- 2026-10-09 — **Fechas y horas en hora de Argentina y 24 h** (`lib/fechas.ts`): la base guarda en UTC (correcto) pero las pantallas formateaban en el servidor de Vercel (UTC) y `es-AR` por defecto muestra 12 h sin a. m./p. m. — 16:30 se veía "07:30". También el filtro "Hasta" de "Todas las cotizaciones" excluía el día completo; ahora "Desde/Hasta" son días de Argentina inclusivos. **Regla: nunca usar `toLocaleString("es-AR")` a secas; usar `fmtFechaHoraAR`/`fmtFechaAR`** (RF-104)
- 2026-10-09 — **Imprimir desde el celular respeta los planes elegidos**: `window.print()` no espera en móvil y el código restauraba todos los planes enseguida; ahora se restaura recién en `afterprint` (RF-105)
- 2026-10-09 — **Dashboard estadístico para administradores** (`/admin/dashboard`, `app/(app)/admin/dashboard/`, `lib/dashboard/`): pestañas Personas (super_admin elige grupo/persona; admin solo su grupo) y Empresas / Grupos (solo super_admin); períodos de meses completos en hora de Argentina con "Todo el año"; tarjetas (vendedores, cotizaciones, promedio por vendedor) y gráfico comparativo (ver RF-107). **Hasta que Diego apruebe el release solo lo ve su usuario** (`lib/dashboard/acceso.ts`: para liberarlo a todos los admin/super_admin se pone `DASHBOARD_RELEASE_APROBADO = true`). "Vendedores" = usuarios aprobados y habilitados (todos los roles). Sin cambios de base; las cotizaciones se leen paginadas (PostgREST devuelve máx. 1000 por consulta) — si el volumen crece mucho conviene pasar el conteo a una función SQL (RF-106)
- 2026-10-10 — **Dashboard: gráfico comparativo y filtros plegables** (`lib/dashboard/grafico.ts`, `Resultados.tsx`, `DashboardFilters.tsx`): una barra por persona o empresa, una al lado de la otra, mes a mes (nunca sumadas en una sola); máximo 10 series: 9 colores de una paleta categórica validada + una barra blanca con contorno negro (con más, se muestran las 10 con más cotizaciones y se avisa; ver RF-108); se quitaron la comparativa horizontal, el gráfico agregado por mes y la tabla de detalle; los bloques Empresas/Grupos y Personas del filtro se pliegan con un triángulo (RF-107)
- 2026-10-10 — **Dashboard: top 10 en los gráficos** (`lib/dashboard/grafico.ts`, `estiloSerie`): se suman un amarillo (`#ffe500`, validado con `validate_palette.js`: ΔE 37 contra el rojo vecino y 17 contra el ámbar de la leyenda) y una barra blanca con contorno negro (box-shadow inset, no cambia el tamaño). Para agregar más series habría que cambiar de codificación (no inventar más colores parecidos) (RF-108)
- 2026-10-10 — **Dashboard Personas: grupo entre paréntesis para el super_admin** (`etiquetaConGrupo` en `lib/dashboard/estadisticas.ts`, `page.tsx`): en el gráfico (leyenda y tooltip) y en la lista de personas, cada persona se muestra como `Nombre (Empresa/Grupo)`; el admin de empresa no lo ve (todas son de su grupo). Aclaración: el gráfico siempre fue por usuario (`created_by`), nunca por empresa; varias cuentas de brokers están registradas con nombre de broker/empresa (RF-109)
- 2026-10-10 — **Dashboard: los filtros solo ofrecen a quien cotizó en el período** (`actividadPorMes`/`tuvoActividad` en `lib/dashboard/estadisticas.ts`, `cargarCotizacionesRango` en `cargar.ts`, `DashboardFilters.tsx`): en Personas y en Empresas/Grupos solo aparecen las personas/empresas con al menos una cotización en alguno de los meses tildados, y la lista se actualiza al instante al cambiar año/meses (si "Todas" estaba tildado, sigue tildado sobre las que quedan). El servidor carga las cotizaciones de todo el rango desde 2026 (páginas en paralelo) y las usa para estadísticas y filtros. En Personas el promedio ÷ personas elegidas ahora cuenta solo personas con actividad; en Empresas, "Todas" sigue contando todas las empresas para no cambiar "Cantidad de vendedores". **Pendiente de escala**: la carga crece con el volumen (~14 mil cotizaciones/mes; ~3 s hoy); si se vuelve lenta, pasar a una función SQL que devuelva solo conteos por persona y mes (RF-110)

## Convenciones de esta sesión (para mantener consistencia)

- Responder y commitear siempre en español.
- Nunca usar `--no-verify` ni saltar hooks.
- Nunca hardcodear tokens/contraseñas en texto de comandos — usar archivos (vía Write) o variables de entorno.
- Preferir arreglar la causa raíz de un problema TLS/certificados antes que desactivar la validación (`rejectUnauthorized: false`).
- Cuentas de prueba: siempre descartables, siempre limpiadas al final (ver el flujo de arriba).
- No agregar abstracciones ni validaciones para casos que no se pidieron explícitamente.
