#!/bin/bash
cloud-build-local --config=@mr/cli/deployment/std/build.yaml --dryrun=false --push --substitutions=_SERVICIO="api",_ENTORNO="oregon",_CLUSTER="meteored-oregon-2",_REGION="us-west1" .
