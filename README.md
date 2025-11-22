# Pod Visualizer

A Go application that reads pods and deployments from a Kubernetes cluster and displays a visual representation of running containers. Available as both a **CLI tool** and a **web dashboard**.

## Features

- 📊 Visual representation of pods and their containers
- 📦 Deployment status overview with replica counts
- 🔍 Namespace filtering support
- ✅ Container readiness status indicators
- 📈 Summary progress bars for overall cluster health
- 🖥️ CLI-friendly output with emoji status indicators
- 🌐 **Web dashboard with real-time updates**
- 🔄 **Auto-refresh functionality**
- 📱 **Mobile-responsive design**

## Applications

This project includes two applications:

1. **CLI Tool** (`pod-visualizer`) - Command-line interface
2. **Web Dashboard** (`pod-visualizer-web`) - Web-based interface

## Prerequisites

- Go 1.19+ (for building from source)
- Access to a Kubernetes cluster
- Valid kubeconfig file (usually at `~/.kube/config`) **OR** running inside Kubernetes
- Docker (for containerized deployment)

## Installation

### Building from Source

```bash
git clone <your-repo-url>
cd pod-visualizer
make build          # Builds both CLI and web applications
```

### Using Pre-built Binaries

Download the appropriate binaries for your platform from the releases page.

### Containerized Deployment (Recommended for Production)

The application is designed to run inside Kubernetes using in-cluster authentication:

```bash
# Build and deploy to Kubernetes cluster
make docker-build
make deploy

# Or use the deployment script directly
./deploy.sh
```

### Helm Chart Deployment (Recommended)

The project includes a comprehensive Helm chart for production deployments:

```bash
# Install with Helm
helm install pod-visualizer ./helm/pod-visuqalizer

# Or from a packaged chart
make helm-package
helm install pod-visualizer ./pod-visualizer-*.tgz

# Upgrade existing installation
helm upgrade pod-visualizer ./helm/pod-visualizer

# Uninstall
helm uninstall pod-visualizer
```

#### Helm Configuration

Customize your deployment with values:

```bash
# Create custom values file
cat > my-values.yaml << EOF
replicaCount: 3
image:
  repository: your-dockerhub-username/pod-visualizer
  tag: latest
ingress:
  enabled: true
  hosts:
    - host: pod-visualizer.example.com
      paths:
        - path: /
          pathType: Prefix
resources:
  limits:
    cpu: 500m
    memory: 512Mi
EOF

# Deploy with custom values
helm install pod-visualizer ./helm/pod-visualizer -f my-values.yaml
```

## Usage

### CLI Tool

```bash
# Display all pods and deployments across all namespaces
./bin/pod-visualizer

# Display pods and deployments in a specific namespace
./bin/pod-visualizer -namespace kube-system

# Use a custom kubeconfig file
./bin/pod-visualizer -kubeconfig /path/to/your/kubeconfig
```

### Web Dashboard

```bash
# Start the web server on default port (8080)
./bin/pod-visualizer-web

# Start on a custom port
./bin/pod-visualizer-web -port 9090

# Use a custom kubeconfig file
./bin/pod-visualizer-web -kubeconfig /path/to/your/kubeconfig
```

Then open your browser and navigate to `http://localhost:8080`

### Command Line Options

#### CLI Tool (`pod-visualizer`)
- `-kubeconfig`: Path to kubeconfig file (default: `~/.kube/config`)
- `-namespace`: Filter results to specific namespace (default: all namespaces)

#### Web Dashboard (`pod-visualizer-web`)
- `-kubeconfig`: Path to kubeconfig file (default: `~/.kube/config`)
- `-port`: Port for the web server (default: `8080`)

## Web Dashboard Features

The web interface provides:

- **Real-time Data**: Live visualization of your cluster state
- **Auto-refresh**: Optional 30-second automatic updates
- **Namespace Filtering**: Dropdown to filter by namespace
- **Interactive UI**: Hover effects and smooth animations
- **Progress Bars**: Visual representation of cluster health
- **Responsive Design**: Works on desktop and mobile devices
- **Keyboard Shortcuts**: 
  - `Ctrl/Cmd + R` or `F5`: Manual refresh
  - Auto-refresh toggle for continuous monitoring

### Web Dashboard Screenshots

The web interface displays:
- Summary cards showing container and replica statistics
- Visual blocks representing ready vs not-ready containers
- Real-time status with emoji indicators
- Filterable namespace views
- Progress bars for overall cluster health

## CLI Example Output

```
Pod Visualizer - Kubernetes Container Overview
============================================
Pods Overview (3 total)
----------------------------------------
✅ kube-system/coredns-558bd4d5db-abc123: ██ (2/2 containers ready)
⏳ default/my-app-7d5f8c6b4-def456: █░ (1/2 containers ready)
✅ default/nginx-deployment-9f4c8b7a5-ghi789: █ (1/1 containers ready)

Container Summary:
Running: 4/5 (80.0%) [████████████████████████████████████████░░░░░░░░░░]

Deployments Overview (2 total)
----------------------------------------
📦 kube-system/coredns: ██ (2/2 replicas ready)
📦 default/my-app: █░ (1/2 replicas ready)

Replica Summary:
Ready: 3/4 (75.0%) [█████████████████████████████████████░░░░░░░░░░░░░]
```

### Status Symbols

- ✅ Running/Ready
- ⏳ Pending
- ❌ Failed
- ❓ Unknown
- █ Ready container/replica
- ░ Not ready container/replica

## Project Structure

```
pod-visualizer/
├── cmd/
│   ├── pod-visualizer/          # CLI application
│   │   └── main.go
│   └── pod-visualizer-web/      # Web application
│       └── main.go
├── pkg/
│   ├── k8s/                     # Kubernetes client package
│   │   └── client.go
│   ├── visualizer/              # CLI display logic package
│   │   └── display.go
│   └── web/                     # Web server package
│       ├── server.go
│       ├── static/
│       │   ├── css/style.css
│       │   └── js/app.js
│       └── templates/
│           └── index.html
├── bin/                         # Built binaries
├── Makefile                     # Build automation
├── go.mod                       # Go module definition
├── go.sum                       # Go module checksums
└── README.md
```

## Development

### Building

```bash
make build          # Build both applications
make build-cli      # Build CLI only
make build-web      # Build web server only
make run-cli        # Build and run CLI
make run-web        # Build and run web server
make clean          # Remove build artifacts
make test           # Run tests
make check          # Run formatting, vetting, and tests
```

### Cross-compilation

```bash
make build-linux    # Build for Linux (both CLI and web)
make build-windows  # Build for Windows (both CLI and web)
make build-mac      # Build for macOS (both CLI and web)
```

### Docker and Kubernetes

```bash
make docker-build   # Build Docker image
make deploy         # Deploy to Kubernetes cluster
```

### Helm Development

```bash
make helm-lint      # Lint Helm chart
make helm-template  # Test Helm template rendering
make helm-package   # Package chart for distribution
```

### CI/CD Pipeline

The project includes GitHub Actions workflows for:

- **Continuous Integration**: Automated testing, linting, and security scanning
- **Container Building**: Multi-platform Docker image builds
- **Security Scanning**: Trivy vulnerability scanning for code and containers
- **Helm Chart Validation**: Chart linting and template testing
- **Automated Releases**: Tag-based releases with GitHub releases and Helm chart packages

#### Setting up CI/CD

1. **Fork the repository** on GitHub
2. **Set up DockerHub secrets** in repository settings:
   - `DOCKERHUB_USERNAME`: Your DockerHub username
   - `DOCKERHUB_TOKEN`: Your DockerHub access token
3. **Update image repository** in `.github/workflows/ci-cd.yml` and `helm/pod-visualizer/values.yaml`
4. **Push changes** - CI/CD will run automatically

**Note**: The workflow includes proper permissions for security scanning and handles pull requests from forks gracefully.

#### Creating Releases

```bash
# Create and push a version tag
make tag
# Enter version when prompted (e.g., v1.0.0)

# This will trigger the release workflow which:
# - Builds and pushes tagged container images
# - Creates a GitHub release
# - Packages and attaches Helm chart
```

### Security

The project includes comprehensive security features:
- **CodeQL v4** for future-proof security scanning
- **Trivy vulnerability scanning** for code and containers  
- **Automated security uploads** to GitHub Security tab
- **Fork-friendly workflows** that handle permission issues gracefully
- **Security policy** documentation in `SECURITY.md`

See [SECURITY.md](SECURITY.md) for detailed security information and reporting procedures.

## Kubernetes Deployment

### In-Cluster Deployment (Recommended)

The application automatically detects when running inside Kubernetes and uses in-cluster authentication:

```bash
# Quick deployment
make docker-build && make deploy

# Manual deployment
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/rbac.yaml

# Access the application
kubectl port-forward -n pod-visualizer svc/pod-visualizer-web 8080:80
```

### RBAC Permissions

The application requires the following permissions:
- **Pods**: `get`, `list`, `watch`
- **Deployments**: `get`, `list`, `watch`

These are automatically configured by the included RBAC manifests.

### Health Checks

The web server includes health check endpoints:
- `/health` - Basic health check
- `/ready` - Readiness check that tests Kubernetes API connectivity

### Architecture

When deployed in Kubernetes:
1. Uses ServiceAccount with appropriate RBAC permissions
2. Automatically discovers Kubernetes API endpoint
3. Authenticates using mounted service account token
4. No kubectl or external kubeconfig required
5. Includes proper security context and resource limits

## API Endpoints

The web server exposes the following endpoints:

- `GET /` - Main dashboard page
- `GET /api/cluster` - JSON API for cluster data
  - Query parameter: `?namespace=<namespace>` (optional)
- `GET /static/*` - Static assets (CSS, JS, images)

## Troubleshooting

### Common Issues

1. **Cannot connect to cluster**: Ensure your kubeconfig is valid and points to an accessible cluster
2. **Permission denied**: Verify your Kubernetes user has read access to pods and deployments
3. **No pods found**: Check if you're looking in the correct namespace
4. **Web server won't start**: Check if the port is already in use
5. **Static files not loading**: Ensure you're running the web server from the project root directory

### Testing Connection

```bash
# Test if kubectl works with your config
kubectl get pods

# Test the CLI application
./bin/pod-visualizer -namespace default

# Test the web server
./bin/pod-visualizer-web -port 8080
# Then visit http://localhost:8080
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `make check`
5. Submit a pull request

## License

[Add your license information here]
