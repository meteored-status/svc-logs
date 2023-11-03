#!/bin/bash
cloud-build-local --config=packages/services-comun/despliegue/deployment.yaml --dryrun=false --push --substitutions=_SERVICIO="api",_ENTORNO="oregon",_CLUSTER="meteored-oregon-2",_REGION="us-west1" .
