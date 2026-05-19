.PHONY: up migrate seed test smoke

up:
	cd docker && docker compose up --build

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
