# ---- Development ----
FROM golang:1.24.4 AS dev

WORKDIR /backend

# Hot reloading mod
RUN go install github.com/air-verse/air@latest
EXPOSE 9090
EXPOSE 2345

ENTRYPOINT ["air", "-c", ".air.toml"]

# ---- Production build ----
FROM golang:1.24.4 AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o server .

# ---- Production runtime ----
FROM gcr.io/distroless/static-debian12 AS production

WORKDIR /app
COPY --from=builder /app/server .

EXPOSE 9090

ENTRYPOINT ["/app/server"]
