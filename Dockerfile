# foyer —— 单二进制自托管面板 + 监控
# 阶段1：前端构建；阶段2：Go 编译静态二进制（内嵌 dist）；运行时 scratch

FROM oven/bun:1-alpine AS frontend
WORKDIR /src/frontend
COPY frontend/package.json frontend/bun.lock ./
RUN bun install --frozen-lockfile
COPY frontend/ ./
RUN bun run build

FROM golang:1.26-alpine AS backend
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY *.go schema.sql ./
COPY --from=frontend /src/frontend/dist/ frontend/dist/
# CGO_ENABLED=0 纯静态；alpine 基底自带 ca-certificates-bundle，
# scratch 运行层没有系统 CA，HTTPS 探测/ntfy/图标抓取全靠这份拷贝
RUN CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /out/foyer .

FROM scratch
COPY --from=backend /out/foyer /foyer
COPY --from=backend /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
VOLUME /data
WORKDIR /data
EXPOSE 3002
ENTRYPOINT ["/foyer"]
