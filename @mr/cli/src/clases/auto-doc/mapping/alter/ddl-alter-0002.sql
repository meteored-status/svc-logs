-- Departamento de cada deployment. Primer paso de BAK-1810 (restricción por departamento de lo privado en API Docs): se
-- guarda ya para que cada servicio lo tenga cuando se despliegue el acceso por departamento; de momento nadie lo lee.
--
-- Se aplica A MANO en la base `doc` de cada proyecto (test y producción), igual que `ddl-create.sql`. Mientras no
-- esté aplicada (o el usuario del autodoc no tenga permiso de escritura sobre la columna), `mrpack autodoc`
-- documenta igualmente, con un aviso y sin departamento.
--
-- dpto: etiqueta `dpto` del deployment, que extrae `mrpack autodoc` del clon de kustomize (o `deploy.lambda.labels.dpto`
--       del `mrpack.json` en las lambdas). Formato `^[a-z0-9-]{1,32}$` (el mismo que tendrá el CHECK
--       de `department.id` en panel-usuarios). NULL = no se conoce con certeza (sin etiqueta,
--       ambigua o que no se interpreta) o aún no se ha documentado con una versión de `@mr/cli` que lo extraiga.
--       Es mutable y NO forma parte del documento versionado: no entra en el hash ni crea versiones.
--
-- Requiere además: GRANT UPDATE (dpto) ON doc.openapi_service al usuario del autodoc y GRANT SELECT sobre esa columna al
-- de doc-backend (si su SELECT es por columnas). Cuando doc-backend lo lea (BAK-1810), sin ese GRANT leerá `dpto` como NULL
-- y nadie verá la documentación interna de ese servicio.

ALTER TABLE openapi_service ADD COLUMN dpto VARCHAR(32) NULL;
