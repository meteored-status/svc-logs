-- Topología de cada deployment (BAK-1810, «Probar» en API Docs).
--
-- Se aplica A MANO en la base `doc` de cada proyecto (test y producción), igual que `ddl-create.sql`. Mientras no
-- esté aplicada (o el usuario del autodoc no tenga permiso de escritura sobre estas columnas), `mrpack autodoc`
-- documenta igualmente, con un aviso y sin topología.
--
-- topology:    JSON que extrae `mrpack autodoc` del clon de kustomize (hosts públicos del `router.json`, `Service` interno,
--              `alone`). Es mutable y NO forma parte del documento versionado: no entra en el hash ni crea versiones.
-- topology_at: cuándo se escribió por última vez (frescura).
--
-- Requiere además: GRANT UPDATE (topology, topology_at) ON doc.openapi_service al usuario del autodoc y
-- GRANT SELECT sobre esas columnas al de doc-backend.

ALTER TABLE openapi_service
  ADD COLUMN topology JSON NULL,
  ADD COLUMN topology_at DATETIME NULL;
