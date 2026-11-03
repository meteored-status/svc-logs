# Scripts interesantes

## Opciones de MRPACK

### Actualizar frameworks
```bash
yarn mrpack framework --update
```

### Actualizar frameworks y dependencias
```bash
yarn mrpack update
```

### Compilar servicios (una única vez)
```bash
yarn mrpack devel -c
```

### Compilar servicios en modo watch
```bash
yarn mrpack devel -c -w
```

### Compilar TODOS los servicios en modo watch
```bash
yarn mrpack devel -c -f -w
```

### Compilar y ejecutar servicios en modo watch
```bash
yarn mrpack devel -c -e -w
```

### Compilar y ejecutar TODOS los servicios en modo watch
```bash
yarn mrpack devel -c -e -f -w
```

### Ejecutar servicios
```bash
yarn mrpack devel -e
```

### Ejecutar TODOS los servicios
```bash
yarn mrpack devel -e -f
```

### Ejecutar contra el emulador de Pub/Sub local
Da de alta la topología de los `mrpack.pubsub.ts` en el emulador (docker `pubsub` de mrenv) y lanza los servicios contra él.
Solo existe el script raíz si el monorepo tiene algún `mrpack.pubsub.ts`.
```bash
yarn run devel-pubsub
# equivale a
yarn mrpack devel -e -p
```

### Ejecutar solo un servicio contra el emulador de Pub/Sub local
```bash
yarn mrpack devel -e -p --solo=amateur
```

### Dar de alta, comprobar, purgar o limpiar la topología de Pub/Sub
```bash
yarn mrpack pubsub -u   # alta (crea lo que falta, corrige lo que difiere)
yarn mrpack pubsub -s   # estado (recursos, extras y servicios push)
yarn mrpack pubsub -r   # purga las suscripciones declaradas (descarta sus mensajes pendientes)
yarn mrpack pubsub -l   # borra lo que este repo dio de alta y ya no declara
```

### Compilar TODOS los servicios para PRODUCCIÓN
```bash
yarn mrpack deploy --env=produccion
```

### Compilar TODOS los servicios para TEST
```bash
yarn mrpack deploy --env=test
```

### Inicializar proyecto
```bash
yarn mrpack init
```

### Resetear los frameworks
```bash
yarn mrpack framework --reset
```

### Subir los cambios de los frameworks
```bash
yarn mrpack upload
```
