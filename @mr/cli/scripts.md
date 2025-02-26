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

### Compilar servicios
```bash
yarn mrpack devel -c
```

### Compilar TODOS los servicios
```bash
yarn mrpack devel -c -f
```

### Compilar y ejecutar servicios
```bash
n
```

### Compilar y ejecutar TODOS los servicios
```bash
yarn mrpack devel -c -e -f
```

### Ejecutar servicios
```bash
yarn mrpack devel -e
```

### Ejecutar TODOS los servicios
```bash
yarn mrpack devel -e -f
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
