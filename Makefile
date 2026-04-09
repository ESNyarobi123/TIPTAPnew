.PHONY: install dev build test e2e docker-up docker-down migrate seed

install:
	pnpm install

dev:
	pnpm dev

build:
	pnpm build

test:
	pnpm test

e2e:
	pnpm test:e2e

docker-up:
	docker compose -f infra/docker/docker-compose.yml up -d

docker-down:
	docker compose -f infra/docker/docker-compose.yml down

migrate:
	./infra/scripts/migrate.sh

seed:
	./infra/scripts/seed.sh
