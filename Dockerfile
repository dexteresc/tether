FROM golang:1.24.4 AS base

WORKDIR /backend

# Hot reloading mod
RUN go install github.com/air-verse/air@latest
EXPOSE 8080
EXPOSE 2345

ENTRYPOINT ["air"]