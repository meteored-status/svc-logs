CREATE TABLE `clientes` (
  `id` varchar(25) NOT NULL,
  `backends` json DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `grupos` (
  `cliente` varchar(25) NOT NULL,
  `id` varchar(100) NOT NULL,
  `backends` json DEFAULT NULL,
  PRIMARY KEY (`cliente`,`id`),
  CONSTRAINT `cliente-grupo` FOREIGN KEY (`cliente`) REFERENCES `clientes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `gcs` (
  `bucket` varchar(125) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `cliente` varchar(25) NOT NULL,
  `grupo` varchar(100) DEFAULT NULL,
  `tipo` enum('cloudflare') NOT NULL,
  PRIMARY KEY (`bucket`),
  KEY `cliente` (`cliente`,`grupo`),
  CONSTRAINT `gcs-cliente` FOREIGN KEY (`cliente`) REFERENCES `clientes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `gcs-grupo` FOREIGN KEY (`cliente`, `grupo`) REFERENCES `grupos` (`cliente`, `id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `procesando` (
  `bucket` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `archivo` varchar(220) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `estado` enum('recibido','procesando','repescando','error') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'recibido',
  `fecha` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`bucket`,`archivo`),
  KEY `archivo` (`archivo`),
  KEY `estado` (`estado`),
  KEY `fecha` (`fecha`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `repesca` (
  `bucket` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `archivo` varchar(220) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `backends` json DEFAULT NULL,
  `i` tinyint unsigned DEFAULT NULL,
  `tratando` tinyint(1) NOT NULL DEFAULT '0',
  `mensaje` text,
  `contador` int unsigned NOT NULL DEFAULT '1',
  `origen` enum('ingest','repesca','huerfano') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'ingest',
  `fecha` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`bucket`,`archivo`),
  UNIQUE KEY `i` (`i`),
  KEY `archivo` (`archivo`),
  KEY `tratando` (`tratando`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
