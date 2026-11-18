-- Almacén de la documentación OpenAPI que genera `mrpack autodoc` (paso «Generar Documentación» de Cloud Build).
--
-- Se aplica A MANO en la base `doc` de cada proyecto (test y producción) antes del primer build con este
-- paso: cada entorno es un proyecto GCP distinto con su propia base, así que no hay columna de entorno.
-- Los cambios posteriores van en `mapping/alter/ddl-alter-NNNN.sql`.
--
-- openapi_service: un registro por deployment (`info.title` del documento) con su versión vigente.
--                  `topology`/`topology_at` (alter 0001): topología extraída del repo kustomize, fuera del documento
--                  versionado y de su hash.
--                  `dpto` (alter 0002): departamento del deployment (etiqueta `dpto` de kustomize o de `deploy.lambda.labels`);
--                  NULL = no se conoce con certeza.
-- openapi_version: contratos distintos de cada servicio; solo se inserta una fila nueva si el hash del
--                  documento canónico cambia (un contrato normalmente no cambia entre despliegues).
-- La tabla `openapi` anterior deja de escribirse.
-- Para borrar un servicio hay que poner antes `current_version` a NULL (la FK circular lo impide si no).

CREATE TABLE openapi_service (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  repository      VARCHAR(150) NOT NULL,
  deployment      VARCHAR(150) NOT NULL,
  workspace       VARCHAR(150) NOT NULL,
  current_version INT UNSIGNED NULL,
  first_seen_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  removed_at      DATETIME NULL,
  topology        JSON NULL,
  topology_at     DATETIME NULL,
  dpto            VARCHAR(32) NULL,
  UNIQUE KEY uk_deployment (deployment),
  KEY ix_repository (repository)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE openapi_version (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  service_id  INT UNSIGNED NOT NULL,
  hash        CHAR(64) NOT NULL,
  version     VARCHAR(50) NULL,
  commit_sha  CHAR(40) NULL,
  doc         JSON NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_service_created (service_id, created_at),
  CONSTRAINT fk_openapi_version_service FOREIGN KEY (service_id) REFERENCES openapi_service (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE openapi_service ADD CONSTRAINT fk_openapi_service_current FOREIGN KEY (current_version) REFERENCES openapi_version (id);
