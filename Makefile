.PHONY: build build-cli build-web run run-web clean test fmt vet helm-lint helm-install helm-upgrade

# Build both CLI and web applications
build: build-cli build-web

# Build the CLI application
build-cli:
	go build -o bin/pod-visualizer ./cmd/pod-visualizer

# Build the web application
build-web:
	go build -o bin/pod-visualizer-web ./cmd/pod-visualizer-web

# Run the CLI application
run-cli: build-cli
	./bin/pod-visualizer

# Run the web application
run-web: build-web
	./bin/pod-visualizer-web

# Run CLI (default)
run: run-cli

# Clean build artifacts
clean:
	rm -rf bin/

# Run tests
test:
	go test ./...

# Format code
fmt:
	go fmt ./...

# Run go vet
vet:
	go vet ./...

# Run all checks
check: fmt vet test

# Install dependencies
deps:
	go mod download
	go mod tidy

# Create bin directory
bin:
	mkdir -p bin

# Build for different platforms
build-linux:
	GOOS=linux GOARCH=amd64 go build -o bin/pod-visualizer-linux ./cmd/pod-visualizer
	GOOS=linux GOARCH=amd64 go build -o bin/pod-visualizer-web-linux ./cmd/pod-visualizer-web

build-windows:
	GOOS=windows GOARCH=amd64 go build -o bin/pod-visualizer-windows.exe ./cmd/pod-visualizer
	GOOS=windows GOARCH=amd64 go build -o bin/pod-visualizer-web-windows.exe ./cmd/pod-visualizer-web

build-mac:
	GOOS=darwin GOARCH=amd64 go build -o bin/pod-visualizer-mac ./cmd/pod-visualizer
	GOOS=darwin GOARCH=amd64 go build -o bin/pod-visualizer-web-mac ./cmd/pod-visualizer-web

# Docker targets
docker-build:
	docker build -t pod-visualizer:latest .

docker-build-dev:
	docker build -t pod-visualizer:dev .

docker-run:
	docker run -p 8080:8080 pod-visualizer:latest

docker-push:
	docker push pod-visualizer:latest

# Kubernetes deployment
deploy:
	./deploy.sh

deploy-dev:
	IMAGE_TAG=dev ./deploy.sh

# Helm targets
helm-lint:
	helm lint helm/pod-visualizer

helm-template:
	helm template pod-visualizer helm/pod-visualizer --debug

helm-install:
	helm install pod-visualizer helm/pod-visualizer

helm-upgrade:
	helm upgrade pod-visualizer helm/pod-visualizer

helm-uninstall:
	helm uninstall pod-visualizer

helm-package:
	helm package helm/pod-visualizer

# Development targets
dev-setup:
	go mod download
	go install github.com/cosmtrek/air@latest

dev-run:
	air

# CI/CD targets
ci-test: deps test vet
	@echo "All CI tests passed!"

ci-build: build docker-build
	@echo "CI build completed!"

# Release targets
tag:
	@read -p "Enter version (e.g., v1.0.0): " VERSION; \
	git tag -a $$VERSION -m "Release $$VERSION"; \
	git push origin $$VERSION

release: tag
	@echo "Release tagged and pushed! GitHub Actions will handle the rest."
