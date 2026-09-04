# Selecom — Especificación del Coordinador de Operaciones

## 1. Objetivo del perfil

El **Coordinador de Operaciones** es el usuario encargado de transformar las necesidades y requerimientos de la empresa en actividades de trabajo organizadas.

Su función principal es:

> **Recibir requerimientos, planificar trabajos, crear y asignar órdenes de trabajo, organizar el calendario y consultar el avance operativo del equipo.**

No debe tener permisos administrativos sobre usuarios, roles, configuración del sistema ni auditoría.

---

# 2. Principio general de funcionamiento

El flujo operativo recomendado es:

**Requerimiento → Planificación → Orden de Trabajo → Calendario → Asignación → Ejecución → Supervisión → Informe**

### Responsabilidades por perfil

| Perfil | Función principal |
|---|---|
| Administrador | Administra usuarios, permisos y configuración del sistema |
| Coordinador de Operaciones | Planifica y organiza los trabajos |
| Supervisor | Supervisa y valida la ejecución |
| Técnico | Ejecuta el trabajo y registra evidencias |

---

# 3. Menú del Coordinador de Operaciones

El menú recomendado es:

```text
OVERVIEW
├── Dashboard
│
PLANNING
├── Requirements
├── Calendar
└── Work Orders
│
TEAM
├── Technicians
└── Supervisors
│
ATTENDANCE
└── Team Attendance
│
RESOURCES
├── Documents
├── Forms / Requests
└── Reports
```

---

# 4. Dashboard

## Función principal

Mostrar al Coordinador una visión rápida del estado de las operaciones.

## Información recomendada

- Órdenes de trabajo programadas para hoy.
- Órdenes pendientes.
- Órdenes en proceso.
- Órdenes completadas.
- Órdenes atrasadas.
- Órdenes sin técnico asignado.
- Requerimientos pendientes.
- Técnicos disponibles.
- Técnicos ocupados.
- Alertas importantes.

## Acciones rápidas

- Crear requerimiento.
- Crear orden de trabajo.
- Abrir calendario.
- Consultar técnicos.
- Consultar solicitudes.
- Generar reporte.

---

# 5. Requirements — Requerimientos

## Función principal

Recibir y gestionar las necesidades de trabajo antes de convertirlas en una Orden de Trabajo.

Un requerimiento representa:

> **"La empresa necesita que se realice un trabajo."**

## Origen del requerimiento

Puede ser creado por:

- Administrador.
- Coordinador de Operaciones.
- Otro usuario autorizado.

## Datos recomendados

- ID del requerimiento.
- Fecha de creación.
- Solicitante.
- Cliente.
- Ubicación.
- Tipo de servicio.
- Descripción.
- Fecha solicitada.
- Prioridad.
- Documentos adjuntos.
- Estado.

## Estados

```text
PENDIENTE
    ↓
EN REVISIÓN
    ↓
APROBADO / PLANIFICADO
    ↓
CONVERTIDO EN OT
    ↓
CERRADO
```

También puede existir:

```text
RECHAZADO
CANCELADO
```

## Acción principal

El Coordinador debe poder:

**Revisar requerimiento → planificarlo → convertirlo en Orden de Trabajo.**

---

# 6. Calendar — Calendario

## Función principal

Organizar visualmente las actividades y órdenes de trabajo.

Debe permitir visualizar:

- Día.
- Semana.
- Mes.
- Técnico asignado.
- Supervisor asignado.
- Cliente.
- Horario.
- Estado.
- Prioridad.

## Acciones

El Coordinador puede:

- Crear actividad.
- Programar OT.
- Reprogramar.
- Cambiar horario.
- Cambiar técnico.
- Cambiar supervisor.
- Cancelar programación.
- Consultar detalles de la OT.

## Regla importante

El calendario de operaciones **NO debe utilizarse como sistema de asistencia**.

El horario laboral de una persona y el horario de una Orden de Trabajo son conceptos diferentes.

Ejemplo:

```text
Horario laboral:
08:00 - 17:30

Orden de Trabajo:
10:00 - 13:00
```

---

# 7. Work Orders — Órdenes de Trabajo

## Función principal

Gestionar trabajos que ya fueron planificados y asignados.

Una OT representa:

> **"Este trabajo debe realizarse bajo estas condiciones y por estas personas."**

## Datos principales

- ID de OT.
- Cliente.
- Ubicación.
- Tipo de servicio.
- Descripción.
- Fecha.
- Hora de inicio.
- Hora de finalización.
- Técnico asignado.
- Supervisor asignado.
- Prioridad.
- Estado.
- Requerimiento de origen.
- Documentos relacionados.

## Estados recomendados

```text
BORRADOR
PROGRAMADA
ASIGNADA
EN PROCESO
COMPLETADA
OBSERVADA
CERRADA
CANCELADA
```

## Permisos del Coordinador

Puede:

- Crear OT.
- Editar OT antes de su ejecución.
- Asignar técnico.
- Asignar supervisor.
- Cambiar fecha.
- Cambiar horario.
- Cambiar prioridad.
- Reprogramar.
- Consultar avance.
- Consultar evidencias.
- Consultar observaciones.

## Restricción importante

El Coordinador no debe modificar ni eliminar evidencias técnicas registradas por el Técnico después de la ejecución.

---

# 8. Technicians — Técnicos

## Función principal

Consultar la disponibilidad y carga de trabajo de los técnicos para realizar asignaciones.

## Información que puede consultar

- Nombre.
- Estado.
- Especialidad.
- OT asignadas.
- OT pendientes.
- OT en proceso.
- Disponibilidad.
- Asistencia del día.

## Ejemplo

```text
Juan Pérez
Estado: Disponible
Asistencia: Presente
OT hoy: 2
OT pendientes: 1
```

## Permisos

El Coordinador puede:

- Consultar técnicos.
- Consultar disponibilidad.
- Consultar carga de trabajo.
- Asignar técnicos a OT.

No debe administrar cuentas de usuario ni modificar permisos.

---

# 9. Supervisors — Supervisores

## Función principal

Consultar los supervisores disponibles y asignarlos a trabajos cuando corresponda.

## Información

- Nombre.
- Estado.
- Actividades asignadas.
- OT supervisadas.
- Disponibilidad.

## Permisos

El Coordinador puede:

- Consultar supervisores.
- Consultar carga de trabajo.
- Asignar supervisor a una OT.

No debe administrar sus cuentas ni permisos.

---

# 10. Team Attendance — Asistencia del equipo

## Función principal

Permitir al Coordinador consultar la asistencia del personal para conocer quién está disponible para trabajar.

La asistencia debe ser un **módulo independiente**, aunque esté dentro de Selecom.

## Información diaria

```text
Técnico          Asistencia       Hora
Juan Pérez       Presente         07:55
Carlos López     Presente         07:58
Pedro García     Tardanza         08:17
Luis Torres      Pendiente        --
```

## Uso operativo

La asistencia puede ayudar al Coordinador a decidir a quién asignar una OT.

Ejemplo:

```text
Crear OT
   ↓
Seleccionar técnico
   ↓
Mostrar disponibilidad
   ↓
Mostrar asistencia
   ↓
Asignar técnico
```

## Restricción

El Coordinador debe consultar la asistencia, pero no modificar libremente los registros oficiales.

---

# 11. Documents — Documentos

## Función principal

Consultar documentos necesarios para planificar y ejecutar trabajos.

Puede incluir:

- Documentos de clientes.
- Fichas técnicas.
- Informes anteriores.
- Manuales.
- Certificados.
- Fotografías.
- Cotizaciones.
- Documentación relacionada con OT.

## Permisos

El Coordinador puede consultar los documentos necesarios para sus funciones.

La administración global de documentos debe depender de permisos específicos.

---

# 12. Forms / Requests — Solicitudes internas

## Función principal

Gestionar solicitudes realizadas por Técnicos y Supervisores.

Una solicitud interna representa:

> **"El trabajador necesita que la empresa atienda o apruebe algo."**

No debe confundirse con un requerimiento de trabajo.

## Tipos de solicitud

### 12.1 Permiso / ausencia

Ejemplo:

```text
Solicitante: Técnico
Tipo: Permiso
Fecha: 04/09/2026
Motivo: Motivo personal
Estado: Pendiente
```

### 12.2 Reintegro

Ejemplo:

```text
Solicitante: Técnico
Tipo: Reintegro
Monto: S/ 45.00
Motivo: Compra necesaria para completar OT
OT relacionada: OT-00152
Comprobante: archivo adjunto
Estado: Pendiente
```

### 12.3 Queja

Permite registrar problemas o inconformidades ocurridas durante el trabajo.

### 12.4 Incidencia

Permite comunicar un problema operativo, técnico o administrativo.

### 12.5 Otros

Debe existir una categoría adicional para casos no contemplados.

## Flujo

```text
Técnico / Supervisor
        ↓
Crea solicitud
        ↓
Solicitud pendiente
        ↓
Revisión
        ↓
Administrador
        ↓
APROBAR / RECHAZAR
        ↓
Notificación al solicitante
```

## Rol del Coordinador

El Coordinador puede consultar solicitudes relacionadas con la operación y hacer seguimiento cuando corresponda.

La aprobación final de solicitudes administrativas sensibles debe permanecer en Administración.

---

# 13. Reports — Reportes

## Función principal

Consultar y generar información operacional.

## Filtros recomendados

- Fecha.
- Cliente.
- Técnico.
- Supervisor.
- Estado de OT.
- Tipo de servicio.
- Prioridad.
- Ubicación.

## Reportes recomendados

- OT realizadas.
- OT pendientes.
- OT atrasadas.
- OT por técnico.
- OT por supervisor.
- OT por cliente.
- Trabajos realizados por período.
- Incidencias.
- Evidencias.
- Actividades canceladas.
- Actividades reprogramadas.

---

# 14. Relación entre módulos

La relación principal debe ser:

```text
REQUIREMENT
     │
     │ convertir
     ▼
WORK ORDER
     │
     ├──────────────► CALENDAR
     │
     ├──────────────► TECHNICIAN
     │
     └──────────────► SUPERVISOR
                          │
                          ▼
                     EJECUCIÓN
                          │
                          ▼
                    EVIDENCIAS
                          │
                          ▼
                       REPORT
```

La asistencia funciona como información complementaria:

```text
ATTENDANCE
     │
     ▼
Disponibilidad del personal
     │
     ▼
Asignación de OT
```

---

# 15. Flujo completo de operaciones

## Paso 1 — Se genera una necesidad

Administración registra un requerimiento:

> "Cliente necesita mantenimiento."

## Paso 2 — Operaciones recibe el requerimiento

El Coordinador revisa la información.

## Paso 3 — Planificación

Define:

- Fecha.
- Horario.
- Técnico.
- Supervisor.
- Prioridad.
- Recursos necesarios.

## Paso 4 — Creación de OT

El requerimiento se convierte en una Orden de Trabajo.

## Paso 5 — Calendario

La OT aparece automáticamente en el calendario.

## Paso 6 — Ejecución

El Técnico realiza el trabajo.

Registra:

- Actividades.
- Observaciones.
- Checklist.
- Fotografías.
- Resultado.

## Paso 7 — Supervisión

El Supervisor revisa el trabajo y sus evidencias.

## Paso 8 — Cierre

La OT queda completada/cerrada.

## Paso 9 — Reporte

Operaciones utiliza la información para generar reportes e informes.

---

# 16. Integración con asistencia

La asistencia debe funcionar como un módulo independiente:

```text
ASISTENCIA
├── Horarios
├── Marcación
├── Validación
├── Historial
└── Reportes
```

Pero sus datos pueden utilizarse en Operaciones.

Ejemplo:

```text
Juan
Asistencia: PRESENTE
Disponibilidad: DISPONIBLE
OT: 2
```

Esto permite que el Coordinador tome mejores decisiones al asignar trabajos.

---

# 17. Límites del Coordinador

El Coordinador **NO debe tener acceso a**:

```text
Users
Roles & Permissions
System Settings
Audit Logs
```

Tampoco debe:

- Crear administradores.
- Cambiar roles.
- Modificar permisos.
- Cambiar configuraciones globales.
- Eliminar registros históricos de asistencia.
- Alterar evidencias técnicas ya registradas.

---

# 18. Principio de permisos

El sistema debe trabajar con **roles y permisos**, no solamente ocultando elementos visuales del menú.

Ejemplo:

```text
ROLE: coordinator

dashboard.view             ✓
requirements.view          ✓
requirements.create        ✓
requirements.edit          ✓

calendar.view              ✓
calendar.create            ✓
calendar.edit              ✓

work_orders.view           ✓
work_orders.create         ✓
work_orders.edit           ✓
work_orders.assign         ✓

technicians.view           ✓
supervisors.view           ✓

attendance.view            ✓

documents.view             ✓
requests.view              ✓
reports.view               ✓

users.manage               ✗
roles.manage               ✗
settings.manage            ✗
audit_logs.view            ✗
```

Los permisos deben validarse también en el backend/API y no únicamente en el frontend.

---

# 19. Objetivo final del módulo

El Coordinador de Operaciones debe poder responder rápidamente estas preguntas:

1. **¿Qué trabajos tenemos pendientes?**
2. **¿Qué trabajos debemos realizar hoy?**
3. **¿Qué requerimientos nuevos llegaron?**
4. **¿Qué técnico está disponible?**
5. **¿Qué supervisor está disponible?**
6. **¿Quién está presente hoy?**
7. **¿Qué OT están programadas?**
8. **¿Qué OT están en proceso?**
9. **¿Qué trabajos ya terminaron?**
10. **¿Qué información necesito para generar el informe?**

La interfaz debe estar diseñada alrededor de estas necesidades operativas.

---

# 20. Resumen funcional

El **Coordinador de Operaciones** no administra el sistema.

Su responsabilidad es:

> **RECIBIR → PLANIFICAR → PROGRAMAR → ASIGNAR → MONITOREAR → CONSULTAR → REPORTAR**

Mientras que:

```text
ADMINISTRADOR
Administra el sistema
        ↓
COORDINADOR
Administra la operación
        ↓
SUPERVISOR
Supervisa el trabajo
        ↓
TÉCNICO
Ejecuta el trabajo
```

Esta separación debe mantenerse tanto en la interfaz como en los permisos del backend.
