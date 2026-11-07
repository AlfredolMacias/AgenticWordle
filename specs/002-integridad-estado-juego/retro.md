# Retro — 002 Game State Integrity


- La regla “5 vs. 6 intentos” se planteó como contradicción cuando guessCount era un conteo previo al insert, así que el código ya permitía 6. Se resolvió leyendo el código.
- La spec traía decisiones de implementación en Open Decisions (dónde se lanza el error); se movieron al plan.
- El plan era ambiguo sobre si la búsqueda del jugador ocurría dentro de la transacción; se fijó “lecturas antes, solo escrituras dentro”.
- Se usó la base de desarrollo para las pruebas, con guardia de host y limpieza en afterAll.
- La auditoría del agente descartó como “fuera de alcance” un test legado en rojo y dejó vivo el camino obsoleto de máximo de intentos; ambos se corrigieron.
- Una tarea (T-14) resultó demasiado grande y se dividió.
- El script de reconciliación se corre antes y después del despliegue.
- Aparecieron cambios de código de la 003 en la rama antes del plan, lo que contaminó la columna “Current” del contrato.