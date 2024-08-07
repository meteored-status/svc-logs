#!/usr/bin/env bash

gcloud storage buckets notifications create gs://mr-cf-logs-ed --topic=meteored-status-cf-logs
gcloud storage buckets notifications create gs://mr-cf-logs-fce --topic=meteored-status-cf-logs
gcloud storage buckets notifications create gs://mr-cf-logs-hoteles --topic=meteored-status-cf-logs
gcloud storage buckets notifications create gs://mr-cf-logs-meteored --topic=meteored-status-cf-logs
gcloud storage buckets notifications create gs://mr-cf-logs-motor --topic=meteored-status-cf-logs
gcloud storage buckets notifications create gs://mr-cf-logs-tiempo-ar --topic=meteored-status-cf-logs
gcloud storage buckets notifications create gs://mr-cf-logs-tiempo-at --topic=meteored-status-cf-logs
gcloud storage buckets notifications create gs://mr-cf-logs-tiempo-bo --topic=meteored-status-cf-logs
gcloud storage buckets notifications create gs://mr-cf-logs-tiempo-br --topic=meteored-status-cf-logs
gcloud storage buckets notifications create gs://mr-cf-logs-tiempo-ca --topic=meteored-status-cf-logs
gcloud storage buckets notifications create gs://mr-cf-logs-tiempo-cl --topic=meteored-status-cf-logs
gcloud storage buckets notifications create gs://mr-cf-logs-tiempo-cr --topic=meteored-status-cf-logs
gcloud storage buckets notifications create gs://mr-cf-logs-tiempo-de --topic=meteored-status-cf-logs
gcloud storage buckets notifications create gs://mr-cf-logs-tiempo-do --topic=meteored-status-cf-logs
gcloud storage buckets notifications create gs://mr-cf-logs-tiempo-ec --topic=meteored-status-cf-logs
gcloud storage buckets notifications create gs://mr-cf-logs-tiempo-en --topic=meteored-status-cf-logs
gcloud storage buckets notifications create gs://mr-cf-logs-tiempo-es --topic=meteored-status-cf-logs
gcloud storage buckets notifications create gs://mr-cf-logs-tiempo-eu --topic=meteored-status-cf-logs
gcloud storage buckets notifications create gs://mr-cf-logs-tiempo-fr --topic=meteored-status-cf-logs
gcloud storage buckets notifications create gs://mr-cf-logs-tiempo-hn --topic=meteored-status-cf-logs
gcloud storage buckets notifications create gs://mr-cf-logs-tiempo-it --topic=meteored-status-cf-logs
gcloud storage buckets notifications create gs://mr-cf-logs-tiempo-mx --topic=meteored-status-cf-logs
gcloud storage buckets notifications create gs://mr-cf-logs-tiempo-nl --topic=meteored-status-cf-logs
gcloud storage buckets notifications create gs://mr-cf-logs-tiempo-pa --topic=meteored-status-cf-logs
gcloud storage buckets notifications create gs://mr-cf-logs-tiempo-pe --topic=meteored-status-cf-logs
gcloud storage buckets notifications create gs://mr-cf-logs-tiempo-pt --topic=meteored-status-cf-logs
gcloud storage buckets notifications create gs://mr-cf-logs-tiempo-py --topic=meteored-status-cf-logs
gcloud storage buckets notifications create gs://mr-cf-logs-tiempo-ru --topic=meteored-status-cf-logs
gcloud storage buckets notifications create gs://mr-cf-logs-tiempo-uy --topic=meteored-status-cf-logs
gcloud storage buckets notifications create gs://mr-cf-logs-tiempo-ve --topic=meteored-status-cf-logs


gcloud storage buckets notifications create gs://cf-workers --topic=meteored-status-cf-workers --project=meteored-status
