# Mapa de ficheros

Este fichero existe para que no haya dudas sobre dónde va cada documento.

## Raíz

### `AGENTS.md`

Contexto que Pi carga automáticamente. Es la regla de entrada para cualquier agente.

### `README.md`

Resumen del proyecto para humanos y agentes.

### `START_HERE.md`

Pasos concretos para arrancar el repositorio con Pi + gentle-ai.

### `.gitignore`

Base segura para no versionar secretos, builds ni `pb_data/`.

## `project/`

Contexto operativo visible del proyecto. Sustituye a la antigua carpeta oculta `.project/`.

### `project/context.md`

Estado actual verificado, fase activa y siguiente acción.

### `project/rules.md`

Reglas obligatorias de producto/arquitectura para los agentes.

### `project/product-decisions.md`

Decisiones que ya has tomado y no deben volver a preguntarte.

### `project/open-decisions.md`

Decisiones aún no cerradas y en qué fase deben resolverse.

### `project/phase-map.md`

Mapa de fases y estado de cada una.

## `docs/product/`

Define qué producto queremos construir.

No describe necesariamente lo que ya está implementado.

## `docs/architecture/`

Límites técnicos aceptados: PocketBase, datos, widgets, integraciones, seguridad, etc.

## `docs/ux/`

Comportamiento visual/interactivo: dashboard, grid, responsive, settings, onboarding y tamaños.

## `docs/integrations/`

Contrato funcional esperado para Search, Weather, Markets/Currency, Google Calendar, IA y festivos.

## `docs/phases/`

Briefs de las fases del roadmap.

IMPORTANTE: estos briefs NO sustituyen a los artefactos SDD de gentle-ai.

Sirven como entrada para `/sdd-new`.

## `docs/workflow/`

Cómo trabajar con Pi + gentle-ai, definición de Done, review y decisiones.

## `docs/decisions/`

ADRs de decisiones técnicas ya aceptadas.

## `docs/reference/`

Material de referencia, incluidas las imágenes visuales originales que pasaste en ChatGPT.

## `openspec/`

Esta es la carpeta oficial para los artefactos SDD de gentle-ai.

### `openspec/config.yaml`

Contexto y reglas SDD del proyecto.

### `openspec/changes/`

Aquí gentle-ai crea cada cambio activo:

```text
openspec/changes/phase-0001-foundation/
├── proposal.md
├── specs/
├── design.md
├── tasks.md
└── ...
```

### `openspec/changes/archive/`

Histórico de cambios terminados.

### `openspec/specs/`

Especificaciones consolidadas después de archivar cambios.

## Lo que NO debes crear manualmente

No hace falta crear:

- `.project/`
- `docs/specs/`
- `.pi/agents/`
- cadenas/agentes SDD propios para sustituir a gentle-ai

`gentle-pi` se ocupa de sus propios recursos Pi/SDD.
