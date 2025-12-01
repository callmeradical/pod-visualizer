# Pod Visualizer Demo

A Kubernetes pod visualizer with **real-time WebSocket updates** - perfect for demos and cluster monitoring.

## 🚀 Quick Demo

```bash
# Option 1: Use pre-built Helm chart from DockerHub (recommended)
helm upgrade --install pod-visualizer oci://registry-1.docker.io/callmeradical/pod-visualizer --version 0.1.0
kubectl apply -f https://raw.githubusercontent.com/callmeradical/pod-visualizer/main/k8s/demo-namespace.yaml

# Option 2a: NodePort with specific port (30080)
helm upgrade --install pod-visualizer oci://registry-1.docker.io/callmeradical/pod-visualizer \
  --version 0.1.0 --set service.type=NodePort --set service.nodePort=30080
kubectl apply -f https://raw.githubusercontent.com/callmeradical/pod-visualizer/main/k8s/demo-namespace.yaml
# Access via http://localhost:30080 (or http://<node-ip>:30080)

# Option 2b: NodePort with random port assignment (30000-32767)
helm upgrade --install pod-visualizer oci://registry-1.docker.io/callmeradical/pod-visualizer \
  --version 0.1.0 --set service.type=NodePort
kubectl apply -f https://raw.githubusercontent.com/callmeradical/pod-visualizer/main/k8s/demo-namespace.yaml
# Check assigned port: kubectl get service pod-visualizer

# Option 3: Clone and build locally
git clone <your-repo-url>
cd pod-visualizer
./demo-setup.sh
helm install pod-visualizer ./helm/pod-visualizer

# Access the visualizer (if using ClusterIP)
kubectl port-forward service/pod-visualizer 8080:80
# Open http://localhost:8080
```

## ✨ Features

- 🔄 **Real-time WebSocket updates** - see changes instantly
- 📊 Visual representation of pods and deployments
- 🎯 **Demo namespace** with sample applications
- 📱 Mobile-responsive web interface
- 🔍 Namespace filtering and smart defaults

## 📦 What's Included

- **Web Dashboard** with live updates
- **CLI Tool** for terminal use  
- **Demo Environment** with 3-tier sample app
- **Helm Chart** for easy deployment

## 🎮 Try It Out

The demo creates a `pod-visualizer-demo` namespace with sample applications. Try scaling them to see real-time updates:

```bash
# Scale frontend and watch live updates
kubectl scale deployment demo-app-frontend --replicas=5 -n pod-visualizer-demo

# Scale backend 
kubectl scale deployment demo-app-backend --replicas=3 -n pod-visualizer-demo
```

## 🛠️ Development

```bash
make build          # Build both CLI and web
make run-web        # Run web server locally
make docker-build   # Build container
```

## 📱 Usage Examples

### CLI Output
```
✅ demo-app-frontend-6965cd6458-7tp5n: ███ (3/3 replicas ready)
⏳ demo-app-backend-566bc66c95-kr4k9: ██░ (2/3 replicas ready)
✅ demo-app-database-74679fdf97-7bn46: █ (1/1 replicas ready)

Container Summary: 6/7 (85.7%) [████████████████████████████████████████░░░░]
```

### Web Interface
- Real-time pod status updates via WebSocket
- Automatic fallback to HTTP polling
- Interactive namespace filtering
- Visual container readiness indicators

---

*This is a demonstration project showcasing Kubernetes visualization with real-time capabilities.*
