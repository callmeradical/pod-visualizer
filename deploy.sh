#!/bin/bash

# Pod Visualizer Deployment Script
# This script builds and deploys the Pod Visualizer to Kubernetes

set -e

# Configuration
IMAGE_NAME="pod-visualizer"
IMAGE_TAG="latest"
NAMESPACE="pod-visualizer"

echo "🚀 Pod Visualizer Deployment Script"
echo "===================================="

# Build Docker image
echo "📦 Building Docker image..."
docker build -t "${IMAGE_NAME}:${IMAGE_TAG}" .
echo "✅ Docker image built successfully"

# Apply Kubernetes manifests
echo "🔧 Applying Kubernetes manifests..."

# Create namespace and RBAC
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/rbac.yaml

echo "✅ Kubernetes manifests applied"

# Wait for deployment to be ready
echo "⏳ Waiting for deployment to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/pod-visualizer-web -n ${NAMESPACE}

echo "🎉 Deployment completed successfully!"
echo ""
echo "📋 Deployment Status:"
kubectl get pods -n ${NAMESPACE}
echo ""
echo "🌐 Access the application:"
echo "  Port-forward: kubectl port-forward -n ${NAMESPACE} svc/pod-visualizer-web 8080:80"
echo "  Then visit: http://localhost:8080"
echo ""
echo "🔍 Check logs:"
echo "  kubectl logs -n ${NAMESPACE} deployment/pod-visualizer-web -f"
echo ""
echo "🧹 To clean up:"
echo "  kubectl delete namespace ${NAMESPACE}"
