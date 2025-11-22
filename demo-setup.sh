#!/bin/bash

# Demo Deployment Script for Pod Visualizer
# This script sets up the demo namespace and deploys the Pod Visualizer with sample applications

set -e

echo "🚀 Pod Visualizer Demo Setup"
echo "============================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    print_error "kubectl is not installed or not in PATH"
    exit 1
fi

# Check if helm is available
if ! command -v helm &> /dev/null; then
    print_error "helm is not installed or not in PATH"
    exit 1
fi

print_status "Creating demo namespace and sample applications..."

# Apply demo namespace and applications
kubectl apply -f k8s/demo-namespace.yaml

print_status "Waiting for demo applications to be ready..."

# Wait for deployments to be available
kubectl wait --for=condition=available --timeout=300s deployment/demo-app-frontend -n pod-visualizer-demo
kubectl wait --for=condition=available --timeout=300s deployment/demo-app-backend -n pod-visualizer-demo
kubectl wait --for=condition=available --timeout=300s deployment/demo-app-database -n pod-visualizer-demo

print_status "Building local Pod Visualizer image..."

# Build the Docker image
docker build -t pod-visualizer .

print_status "Deploying Pod Visualizer..."

# Deploy using Helm with local image
helm upgrade --install pod-visualizer ./helm/pod-visualizer \
    --set image.repository=pod-visualizer \
    --set image.tag=latest \
    --set image.pullPolicy=Never

print_status "Waiting for Pod Visualizer to be ready..."

# Wait for pod-visualizer deployment
kubectl wait --for=condition=available --timeout=300s deployment/pod-visualizer

print_status "Setup complete! 🎉"

echo ""
echo "📋 Demo Overview:"
echo "=================="
echo "• Demo Namespace: pod-visualizer-demo"
echo "• Sample Applications:"
echo "  - demo-app-frontend (3 replicas) - nginx"
echo "  - demo-app-backend (2 replicas) - redis"
echo "  - demo-app-database (1 replica) - postgres"
echo "• Pod Visualizer: Running in default namespace"

echo ""
echo "🌐 Access Instructions:"
echo "======================="
echo "1. Port forward to access the web interface:"
echo "   kubectl port-forward service/pod-visualizer 8080:80"
echo ""
echo "2. Open your browser to: http://localhost:8080"
echo ""
echo "3. The visualizer will default to the 'pod-visualizer-demo' namespace"

echo ""
echo "🧪 Testing Real-time Updates:"
echo "============================"
echo "Try these commands to see real-time updates:"
echo ""
echo "# Scale up frontend"
echo "kubectl scale deployment demo-app-frontend --replicas=5 -n pod-visualizer-demo"
echo ""
echo "# Scale down backend"
echo "kubectl scale deployment demo-app-backend --replicas=1 -n pod-visualizer-demo"
echo ""
echo "# Create a test pod"
echo "kubectl run test-pod --image=nginx --restart=Never -n pod-visualizer-demo"
echo ""
echo "# Delete the test pod"
echo "kubectl delete pod test-pod -n pod-visualizer-demo"

echo ""
print_status "Demo environment is ready! 🚀"
