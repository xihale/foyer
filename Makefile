BUN ?= bun
GO  ?= go

.PHONY: build frontend fmt test dev dev-api dev-web seed

# go 只嵌入 frontend/dist；源码变更必须先 vite 出包
frontend:
	cd frontend && $(BUN) install && $(BUN) run build

build: frontend
	CGO_ENABLED=0 $(GO) build -trimpath -ldflags='-s -w' -o foyer .

dev:
	$(MAKE) -j2 dev-api dev-web

# 后端只出 /api+/icons，页面走 vite（/api、/icons 反代到 :3002）
dev-api:
	FOYER_DEV=1 $(GO) run .

dev-web:
	cd frontend && $(BUN) install && $(BUN) run dev

fmt:
	gofmt -w *.go

test:
	$(GO) test ./...

seed:
	sqlite3 data/foyer.db < schema.sql
