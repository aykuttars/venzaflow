.PHONY: up migrate seed test smoke

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
	cd backend && DJANGO_SETTINGS_MODULE=config.settings.dev python manage.py test

smoke:
	./docker/scripts/smoke-test.sh

REGISTRY ?= 10.0.0.3:5000
TAG ?= latest
build-push:
	REGISTRY=$(REGISTRY) TAG=$(TAG) ./docker/scripts/build-push.sh
