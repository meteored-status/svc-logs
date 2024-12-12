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

CREATE TABLE `hosts` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `ip` varchar(39) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `nombre` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `grupo` int unsigned DEFAULT NULL,
  `tipo` enum('dedicated','k8s','vm','saas') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `servicios` set('backend','database') NOT NULL,
  `enabled` tinyint(1) NOT NULL,
  `img` tinytext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `munin` tinytext,
  `load` tinytext,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ip` (`ip`),
  KEY `enabled` (`enabled`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `hosts` (`id`, `ip`, `nombre`, `grupo`, `tipo`, `servicios`, `enabled`, `img`, `munin`, `load`)
VALUES
  ('1', '130.211.59.210', 'GKE Bélgica', NULL, 'k8s', 'backend', '1', NULL, NULL, NULL),
  ('2', '34.105.71.156', 'GKE Oregón', NULL, 'k8s', 'backend', '1', NULL, NULL, NULL),
  ('3', '34.95.250.252', 'GKE Brasil', NULL, 'k8s', 'backend', '1', NULL, NULL, NULL),
  ('4', '104.155.42.116', 'GKE Test', NULL, 'k8s', 'backend', '1', NULL, NULL, NULL),
  ('5', '162.55.237.104', 'NginX Europa 1', '1', 'dedicated', 'backend', '1', 'http://162.55.237.104/munin/localdomain/localhost.localdomain/nginx_request-day.png', 'http://162.55.237.104/munin/localdomain/localhost.localdomain/index.html', 'http://backend1.europa.meteored.com/peticiones/extranet/carga_maquina.php'),
  ('6', '168.119.35.23', 'NginX Europa 2', '1', 'dedicated', 'backend', '1', 'http://168.119.35.23/munin/localdomain/localhost.localdomain/nginx_request-day.png', 'http://168.119.35.23/munin/localdomain/localhost.localdomain/index.html', 'http://backend2.europa.meteored.com/peticiones/extranet/carga_maquina.php'),
  ('7', '168.119.89.109', 'NginX Europa 3', '1', 'dedicated', 'backend', '1', 'http://168.119.89.109/munin/localdomain/localhost.localdomain/nginx_request-day.png', 'http://168.119.89.109/munin/localdomain/localhost.localdomain/index.html', 'http://backend3.europa.meteored.com/peticiones/extranet/carga_maquina.php'),
  ('8', '168.119.6.46', 'NginX Europa 4', '1', 'dedicated', 'backend', '1', 'http://168.119.6.46/munin/localdomain/localhost.localdomain/nginx_request-day.png', 'http://168.119.6.46/munin/localdomain/localhost.localdomain/index.html', 'http://backend4.europa.meteored.com/peticiones/extranet/carga_maquina.php'),
  ('9', '116.202.117.81', 'NginX Europa 5', '1', 'dedicated', 'backend', '1', 'http://116.202.117.81/munin/localdomain/localhost.localdomain/nginx_request-day.png', 'http://116.202.117.81/munin/localdomain/localhost.localdomain/index.html', 'http://backend5.europa.meteored.com/peticiones/extranet/carga_maquina.php'),
  ('10', '158.69.127.191', 'NginX Canadá 1', '2', 'dedicated', 'backend', '1', 'http://158.69.127.191/munin/localdomain/localhost.localdomain/nginx_request-day.png', 'http://158.69.127.191/munin/localdomain/localhost.localdomain/index.html', 'http://backend1.usa.meteored.com/peticiones/extranet/carga_maquina.php'),
  ('11', '158.69.116.88', 'NginX Canadá 2', '2', 'dedicated', 'backend', '0', 'http://158.69.116.88/munin/localdomain/localhost.localdomain/nginx_request-day.png', 'http://158.69.116.88/munin/localdomain/localhost.localdomain/index.html', 'http://backend2.usa.meteored.com/peticiones/extranet/carga_maquina.php'),
  ('12', '51.222.10.187', 'NginX Canadá 3', '2', 'dedicated', 'backend', '1', 'http://51.222.10.187/munin/localdomain/localhost.localdomain/nginx_request-day.png', 'http://51.222.10.187/munin/localdomain/localhost.localdomain/index.html', 'http://backend3.usa.meteored.com/peticiones/extranet/carga_maquina.php'),
  ('13', '51.222.255.218', 'NginX Canadá 4', '2', 'dedicated', 'backend', '1', 'http://51.222.255.218/munin/localdomain/localhost.localdomain/nginx_request-day.png', 'http://51.222.255.218/munin/localdomain/localhost.localdomain/index.html', 'http://backend4.usa.meteored.com/peticiones/extranet/carga_maquina.php'),
  ('14', '51.222.255.219', 'NginX Canadá 5', '2', 'dedicated', 'backend', '1', 'http://51.222.255.219/munin/localdomain/localhost.localdomain/nginx_request-day.png', 'http://51.222.255.219/munin/localdomain/localhost.localdomain/index.html', 'http://backend5.usa.meteored.com/peticiones/extranet/carga_maquina.php'),
  ('15', '51.222.41.96', 'NginX Canadá 6', '2', 'dedicated', 'backend', '1', 'http://51.222.41.96/munin/localdomain/localhost.localdomain/nginx_request-day.png', 'http://51.222.41.96/munin/localdomain/localhost.localdomain/index.html', 'http://backend6.usa.meteored.com/peticiones/extranet/carga_maquina.php'),
  ('16', '158.69.26.17', 'NginX Canadá 7', '2', 'dedicated', 'backend', '1', 'http://158.69.26.17/munin/localdomain/localhost.localdomain/nginx_request-day.png', 'http://158.69.26.17/munin/localdomain/localhost.localdomain/index.html', 'http://backend7.usa.meteored.com/peticiones/extranet/carga_maquina.php'),
  ('17', '147.135.105.138', 'NginX Oregón 1', '3', 'dedicated', 'backend', '1', 'http://147.135.105.138/munin/localdomain/localhost.localdomain/nginx_request-day.png', 'http://147.135.105.138/munin/localdomain/localhost.localdomain/index.html', 'http://backend1.oregon.meteored.com/peticiones/extranet/carga_maquina.php'),
  ('18', '51.81.166.12', 'NginX Oregón 2', '3', 'dedicated', 'backend', '1', 'http://51.81.166.12/munin/localdomain/localhost.localdomain/nginx_request-day.png', 'http://51.81.166.12/munin/localdomain/localhost.localdomain/index.html', 'http://backend2.oregon.meteored.com/peticiones/extranet/carga_maquina.php'),
  ('19', '51.81.166.122', 'NginX Oregón 3', '3', 'dedicated', 'backend', '1', 'http://51.81.166.122/munin/localdomain/localhost.localdomain/nginx_request-day.png', 'http://51.81.166.122/munin/localdomain/localhost.localdomain/index.html', 'http://backend3.oregon.meteored.com/peticiones/extranet/carga_maquina.php'),
  ('20', '213.133.100.150', 'Foro', NULL, 'dedicated', 'backend,database', '1', 'http://213.133.100.150/munin/localdomain/localhost.localdomain/apache_accesses-day.png', 'http://213.133.100.150/munin/localdomain/localhost.localdomain/index.html', NULL),
  ('21', '46.4.97.254', 'Test', NULL, 'dedicated', 'backend,database', '1', NULL, NULL, NULL),
  ('22', '144.76.104.94', 'MySQL Europa 1', '1', 'dedicated', 'database', '1', 'http://mysql1.europa.meteored.com/munin/localdomain/localhost.localdomain/load-day.png', 'http://mysql1.europa.meteored.com/munin/localdomain/localhost.localdomain/index.html', NULL),
  ('23', '176.9.139.149', 'MySQL Europa 2', '1', 'dedicated', 'database', '1', 'http://mysql2.europa.meteored.com/munin/localdomain/localhost.localdomain/load-day.png', 'http://mysql2.europa.meteored.com/munin/localdomain/localhost.localdomain/index.html', NULL),
  ('24', '54.39.28.155', 'MySQL Canadá 1', '2', 'dedicated', 'database', '1', 'http://mysql1.usa.meteored.com/munin/localdomain/localhost.localdomain/load-day.png', 'http://mysql1.usa.meteored.com/munin/localdomain/localhost.localdomain/index.html', NULL),
  ('25', '54.39.29.66', 'MySQL Canadá 2', '2', 'dedicated', 'database', '1', 'http://mysql2.usa.meteored.com/munin/localdomain/localhost.localdomain/load-day.png', 'http://mysql2.usa.meteored.com/munin/localdomain/localhost.localdomain/index.html', NULL),
  ('26', '147.135.105.13', 'MySQL Oregón 1', '3', 'dedicated', 'database', '1', 'http://mysql1.oregon.meteored.com/munin/localdomain/localhost.localdomain/load-day.png', 'http://mysql1.oregon.meteored.com/munin/localdomain/localhost.localdomain/index.html', NULL),
  ('27', '35.246.251.162', 'MySQL Alemania 1', NULL, 'saas', 'database', '1', NULL, NULL, NULL),
  ('28', '34.77.41.214', 'MySQL Bélgica 1', NULL, 'saas', 'database', '1', NULL, NULL, NULL),
  ('29', '34.39.129.149', 'MySQL Brasil 1', NULL, 'saas', 'database', '1', NULL, NULL, NULL);
