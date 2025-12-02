create table if not exists send_task_status (
  id tinyint unsigned auto_increment primary key,
  name varchar(20) not null comment 'Nombre del estado',
  description varchar(255) not null comment 'Descripción del estado',
  constraint send_task_status_id_uindex unique (id)
);

create table if not exists send_task_type (
  id tinyint unsigned auto_increment primary key,
  name varchar(20) not null comment 'Nombre del estado',
  description varchar(255) not null comment 'Descripción del tipo',
  constraint send_task_status_id_uindex unique (id)
);

create table if not exists send_task (
  id bigint unsigned auto_increment primary key,
  status tinyint unsigned not null comment 'Estado de la tarea',
  start_validity timestamp not null comment 'Comienzo de validez',
  end_validity timestamp null comment 'Fin de validez',
  type tinyint unsigned not null comment 'Tipo de la tarea',
  tries tinyint default 0 not null comment 'Numero de intentos',
  retry tinyint(1) default 0 not null comment 'Tipo de la tarea',
  constraint send_task_id_uindex unique (id),
  constraint send_task_status_id_fk foreign key (status) references send_task_status (id),
  constraint send_task_type_id_fk foreign key (type) references send_task_type (id)
);

create table send_schedule (
  id bigint unsigned auto_increment primary key,
  send_task bigint unsigned not null comment 'Identificador de la tarea de envío',
  send_date timestamp not null comment 'Fecha de envío',
  constraint send_schedule_id_uindex unique (id),
  constraint fk_send_schedule_task foreign key (send_task) references send_task (id)
);

create table if not exists periodicity (
  id int unsigned auto_increment primary key,
  pattern varchar(50) not null comment 'Patrón similar al de cronjob',
  send_task_id bigint unsigned not null comment 'Identificador de la tarea de envío',
  timezone varchar(30) not null comment 'Nombre de la zona horaria de la periodicidad',
  constraint periodicity_id_uindex unique (id),
  constraint periodicity_send_task_id_fk foreign key (send_task_id) references send_task (id)
);

create table if not exists variant (
  id bigint unsigned auto_increment primary key,
  type smallint unsigned not null comment 'Tipo de variante',
  name varchar(50) not null comment 'Nombre de la variante',
  send_task_id bigint unsigned not null,
  constraint variant_id_uindex unique (id),
  constraint variant_send_task_id_fk foreign key (send_task_id) references send_task (id)
);

create table send_method_type (
  id tinyint unsigned primary key,
  name varchar(20) not null comment 'Nombre del tipo de método de envío'
);

create table if not exists send_method (
  id bigint unsigned auto_increment primary key,
  type tinyint unsigned not null comment 'Tipo de método de envío',
  constraint fk_send_method_type_id foreign key (type) references send_method_type (id)
);

create table send_method_r (
  send_method bigint unsigned not null,
  send_task bigint unsigned not null,
  primary key (send_method, send_task),
  constraint fk_send_method_r_send_method foreign key (send_method) references send_method (id),
  constraint fk_send_method_r_send_task foreign key (send_task) references send_task (id)
);

create table if not exists email (
  id bigint unsigned primary key,
  name varchar(255) null comment 'Nombre del propietario',
  address varchar(50) not null comment 'Dirección de correo',
  blacklist tinyint(1) default 0 not null comment 'Lista negra',
  constraint correo_direccion_uindex unique (address),
  constraint correo_id_uindex unique (id),
  constraint fk_email_send_method foreign key (id) references send_method (id)
);

-- DATA --

insert into send_task_status (id, name, description) values
  (1,'ACTIVE','Estado activo en la tarea envio'),
  (2,'INACTIVE','Estado inactivo en la tarea')
;

insert into send_method_type (id, name) values
  (1, 'EMAIL')
;

insert into send_task_type (id, name, description) values
  (1, 'NEWSLETTER', 'Tipo de servicio de Newsletter')
;
