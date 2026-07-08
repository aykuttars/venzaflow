.PHONY: up migrate seed test test-docker smoke smoke-tenants

up:
	docker compose -f docker/docker-compose.yml --env-file .env up --build -d

down:
	docker compose -f docker/docker-compose.yml --env-file .env down

rebuild:
	docker compose -f docker/docker-compose.yml --env-file .env down
	DOCKER_BUILDKIT=0 docker compose -f docker/docker-compose.yml --env-file .env build --no-cache
	docker compose -f docker/docker-compose.yml --env-file .env up -d --force-recreate

migrate:
	cd backend && DJANGO_SETTINGS_MODULE=config.settings.dev python manage.py migrate

seed:
	cd backend && DJANGO_SETTINGS_MODULE=config.settings.dev python manage.py seed_demo

test:
	cd backend && DJANGO_SETTINGS_MODULE=config.settings.dev bash scripts/run_tests.sh

test-docker:
	docker run --rm --entrypoint bash --env-file .env -v "$$(pwd)/backend:/app" -w /app \
		-e DJANGO_SETTINGS_MODULE=config.settings.dev \
		venzaflow-api$${ENVIRONMENT:+_$${ENVIRONMENT}}:$${TAG:-latest} \
		-c "bash scripts/run_tests.sh"

smoke:
	./docker/scripts/smoke-test.sh

smoke-tenants:
	cd backend && python scripts/smoke_tenant_modules.py

REGISTRY ?= 10.0.0.3:5000
TAG ?= latest
build-push:
	REGISTRY=$(REGISTRY) TAG=$(TAG) ./docker/scripts/build-push.sh
