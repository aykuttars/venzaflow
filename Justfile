set shell := ["bash", "-eu", "-o", "pipefail", "-c"]

default:
    @just --list

up:
    cd docker && docker compose up --build

migrate:
    cd backend && export DJANGO_SETTINGS_MODULE=config.settings.dev && . .venv/bin/activate 2>/dev/null || true; python manage.py migrate

seed:
    cd backend && export DJANGO_SETTINGS_MODULE=config.settings.dev && python manage.py seed_demo

test:
    cd backend && export DJANGO_SETTINGS_MODULE=config.settings.dev && python manage.py test

smoke:
    ./docker/scripts/smoke-test.sh

build-push registry='10.0.0.3:5000' tag='latest':
    REGISTRY={{registry}} TAG={{tag}} ./docker/scripts/build-push.sh

# Prod: pull images from registry and start the stack.
prod-up registry='10.0.0.3:5000' tag='latest':
    REGISTRY={{registry}} TAG={{tag}} docker compose -f docker/docker-compose.prod.yml --env-file .env pull
    REGISTRY={{registry}} TAG={{tag}} docker compose -f docker/docker-compose.prod.yml --env-file .env up -d
    REGISTRY={{registry}} TAG={{tag}} docker compose -f docker/docker-compose.prod.yml --env-file .env ps

prod-down:
    docker compose -f docker/docker-compose.prod.yml --env-file .env down

prod-logs:
    docker compose -f docker/docker-compose.prod.yml --env-file .env logs -f --tail=200

prod-seed:
    docker compose -f docker/docker-compose.prod.yml --env-file .env exec backend python manage.py seed_demo
