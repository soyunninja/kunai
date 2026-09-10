# EMPIEZA AQUÍ

Este paquete está preparado para empezar un repositorio nuevo con Pi + gentle-ai sin depender del historial de ChatGPT.

No contiene código de la aplicación. Contiene el contrato de producto, arquitectura, UX, fases y configuración base de SDD.

## 1. Copia el contenido completo en la raíz del repositorio

No copies los Markdown sueltos uno a uno. Conserva toda la estructura de carpetas.

La carpeta de contexto se llama `project/` y es visible. Ya no se usa `.project/`.

## 2. Inicializa Git

```bash
git init
git add .
git commit -m "add product and SDD foundation"
```

## 3. Prepara Pi + gentle-ai

Si no lo has hecho todavía:

```bash
gentle-ai install --agent pi
```

Después entra en la raíz del repositorio:

```bash
pi
```

Pi carga `AGENTS.md` automáticamente.

Dentro de Pi puedes comprobar el estado de gentle-ai con:

```text
/gentle-ai:status
```

## 4. Usa OpenSpec como almacén de artefactos SDD

Este proyecto quiere que las especificaciones queden versionadas en Git. Por eso el modo SDD esperado es `openspec`.

`openspec/config.yaml` ya está preparado con el contexto del producto. Si `/sdd-init` detecta que ya existe y pregunta si puede actualizarlo, debe conservar las reglas y decisiones de este repositorio y limitarse a enriquecer la información detectada, especialmente testing/tooling.

Ejecuta:

```text
/sdd-init
```

## 5. Empieza únicamente la fase 0001

El brief está en:

```text
docs/phases/0001-foundation.md
```

Inicia el cambio con:

```text
/sdd-new phase-0001-foundation
```

Cuando gentle-ai pregunte por el artifact store, elige:

```text
openspec
```

Para la estrategia de entrega/review, usa por defecto:

```text
ask-on-risk
```

No uses `/sdd-ff` al principio. Queremos revisar proposal, spec, design y tasks antes de implementar.

## 6. Regla principal

Pi no debe saltar a código porque "ya entiende" el producto.

Cada fase se desarrolla así:

```text
phase brief
   ↓
/sdd-new
   ↓
proposal
   ↓
/sdd-continue
   ↓
spec / design / tasks
   ↓
aprobación
   ↓
/sdd-apply
   ↓
/sdd-verify
   ↓
/sdd-archive
```

Al terminar una fase, se actualizan `project/context.md` y `project/phase-map.md` con estado verificado.

## 7. Qué NO debe hacer Pi

No debe:

- implementar varias fases de golpe;
- inventar funcionalidades que no aparecen en los documentos;
- convertir Travel o Dev en páginas especiales hard-coded;
- crear una arquitectura de workspaces o colaboración;
- añadir tareas/proyectos/timers todavía;
- meter una librería UI grande sin aprobación;
- guardar claves de IA o Google en el navegador;
- duplicar el workflow SDD creando `docs/specs/`.

## Primer mensaje recomendado para Pi

Después de iniciar Pi, puedes escribir:

> Lee AGENTS.md, project/context.md y docs/phases/0001-foundation.md. Vamos a desarrollar este proyecto con SDD y OpenSpec. No escribas código todavía. Confirma el estado del proyecto y empieza el flujo de la fase 0001 respetando las decisiones existentes.
