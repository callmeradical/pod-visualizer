package web

import (
	"context"
	"encoding/json"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"path/filepath"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/watch"

	"pod-visualizer/pkg/k8s"
)

// Server represents the web server
type Server struct {
	client     *k8s.Client
	port       int
	template   *template.Template
	upgrader   websocket.Upgrader
	clients    map[*websocket.Conn]bool
	broadcast  chan ClusterData
	clientsMux sync.RWMutex
}

// PodData represents pod data for JSON response
type PodData struct {
	Name            string `json:"name"`
	Namespace       string `json:"namespace"`
	Status          string `json:"status"`
	ContainerCount  int    `json:"containerCount"`
	ReadyContainers int    `json:"readyContainers"`
	StatusSymbol    string `json:"statusSymbol"`
}

// DeploymentData represents deployment data for JSON response
type DeploymentData struct {
	Name              string `json:"name"`
	Namespace         string `json:"namespace"`
	Replicas          int32  `json:"replicas"`
	ReadyReplicas     int32  `json:"readyReplicas"`
	AvailableReplicas int32  `json:"availableReplicas"`
}

// ClusterData represents the complete cluster state
type ClusterData struct {
	Pods                []PodData        `json:"pods"`
	Deployments         []DeploymentData `json:"deployments"`
	TotalContainers     int              `json:"totalContainers"`
	ReadyContainers     int              `json:"readyContainers"`
	ContainerPercentage float64          `json:"containerPercentage"`
	TotalReplicas       int32            `json:"totalReplicas"`
	ReadyReplicas       int32            `json:"readyReplicas"`
	ReplicaPercentage   float64          `json:"replicaPercentage"`
	LastUpdated         time.Time        `json:"lastUpdated"`
}

// NewServer creates a new web server
func NewServer(client *k8s.Client, port int) *Server {
	return &Server{
		client:    client,
		port:      port,
		upgrader:  websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }},
		clients:   make(map[*websocket.Conn]bool),
		broadcast: make(chan ClusterData, 256),
	}
}

// Start starts the web server
func (s *Server) Start() error {
	// Load templates
	tmpl, err := template.ParseGlob(filepath.Join("pkg", "web", "templates", "*.html"))
	if err != nil {
		return fmt.Errorf("failed to parse templates: %v", err)
	}
	s.template = tmpl

	// Setup routes
	http.HandleFunc("/", s.handleIndex)
	http.HandleFunc("/api/cluster", s.handleClusterData)
	http.HandleFunc("/ws", s.handleWebSocket)
	http.HandleFunc("/health", s.handleHealth)
	http.HandleFunc("/ready", s.handleReady)
	http.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir(filepath.Join("pkg", "web", "static")))))

	// Start WebSocket broadcaster and watcher goroutines
	go s.handleBroadcast()
	go s.watchKubernetesEvents()

	log.Printf("Starting web server on port %d", s.port)
	log.Printf("WebSocket endpoint available at ws://localhost:%d/ws", s.port)
	log.Printf("Open http://localhost:%d in your browser", s.port)

	return http.ListenAndServe(fmt.Sprintf(":%d", s.port), nil)
}

// handleIndex serves the main page
func (s *Server) handleIndex(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}

	err := s.template.ExecuteTemplate(w, "index.html", nil)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
}

// handleClusterData serves cluster data as JSON
func (s *Server) handleClusterData(w http.ResponseWriter, r *http.Request) {
	namespace := r.URL.Query().Get("namespace")

	// Get pod information
	pods, err := s.client.GetPods(r.Context(), namespace)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get pods: %v", err), http.StatusInternalServerError)
		return
	}

	// Get deployment information
	deployments, err := s.client.GetDeployments(r.Context(), namespace)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get deployments: %v", err), http.StatusInternalServerError)
		return
	}

	// Convert to response format
	podData := make([]PodData, len(pods))
	totalContainers := 0
	readyContainers := 0

	for i, pod := range pods {
		totalContainers += pod.ContainerCount
		readyContainers += pod.ReadyContainers

		podData[i] = PodData{
			Name:            pod.Name,
			Namespace:       pod.Namespace,
			Status:          pod.Status,
			ContainerCount:  pod.ContainerCount,
			ReadyContainers: pod.ReadyContainers,
			StatusSymbol:    getStatusSymbol(pod.Status),
		}
	}

	deploymentData := make([]DeploymentData, len(deployments))
	totalReplicas := int32(0)
	readyReplicasTotal := int32(0)

	for i, deployment := range deployments {
		totalReplicas += deployment.Replicas
		readyReplicasTotal += deployment.ReadyReplicas

		deploymentData[i] = DeploymentData{
			Name:              deployment.Name,
			Namespace:         deployment.Namespace,
			Replicas:          deployment.Replicas,
			ReadyReplicas:     deployment.ReadyReplicas,
			AvailableReplicas: deployment.AvailableReplicas,
		}
	}

	// Calculate percentages
	containerPercentage := 0.0
	if totalContainers > 0 {
		containerPercentage = float64(readyContainers) / float64(totalContainers) * 100
	}

	replicaPercentage := 0.0
	if totalReplicas > 0 {
		replicaPercentage = float64(readyReplicasTotal) / float64(totalReplicas) * 100
	}

	clusterData := ClusterData{
		Pods:                podData,
		Deployments:         deploymentData,
		TotalContainers:     totalContainers,
		ReadyContainers:     readyContainers,
		ContainerPercentage: containerPercentage,
		TotalReplicas:       totalReplicas,
		ReadyReplicas:       readyReplicasTotal,
		ReplicaPercentage:   replicaPercentage,
		LastUpdated:         time.Now(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(clusterData)
}

// getStatusSymbol returns a symbol for the pod status
func getStatusSymbol(status string) string {
	switch status {
	case "Running":
		return "✅"
	case "Pending":
		return "⏳"
	case "Failed":
		return "❌"
	case "Succeeded":
		return "✅"
	default:
		return "❓"
	}
}

// handleHealth returns a simple health check
func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"status":    "healthy",
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

// handleReady checks if the server can connect to Kubernetes API
func (s *Server) handleReady(w http.ResponseWriter, r *http.Request) {
	// Test connection to Kubernetes API
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	_, err := s.client.GetPods(ctx, "")
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]string{
			"status":    "not ready",
			"error":     err.Error(),
			"timestamp": time.Now().Format(time.RFC3339),
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"status":    "ready",
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

// handleWebSocket handles WebSocket connections
func (s *Server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := s.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}
	defer func() {
		s.clientsMux.Lock()
		delete(s.clients, conn)
		s.clientsMux.Unlock()
		conn.Close()
	}()

	// Register new client
	s.clientsMux.Lock()
	s.clients[conn] = true
	s.clientsMux.Unlock()

	log.Printf("New WebSocket client connected. Total clients: %d", len(s.clients))

	// Send initial data immediately
	clusterData, err := s.getClusterData(context.Background(), "")
	if err == nil {
		conn.WriteJSON(clusterData)
	}

	// Keep connection alive and handle client messages
	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			log.Printf("WebSocket client disconnected: %v", err)
			break
		}
	}
}

// handleBroadcast broadcasts cluster data to all connected WebSocket clients
func (s *Server) handleBroadcast() {
	for {
		select {
		case clusterData := <-s.broadcast:
			s.clientsMux.RLock()
			for conn := range s.clients {
				err := conn.WriteJSON(clusterData)
				if err != nil {
					log.Printf("Error sending data to WebSocket client: %v", err)
					conn.Close()
					delete(s.clients, conn)
				}
			}
			s.clientsMux.RUnlock()
		}
	}
}

// watchKubernetesEvents watches for changes in Kubernetes resources and broadcasts updates
func (s *Server) watchKubernetesEvents() {
	log.Println("Starting Kubernetes events watcher...")
	
	ctx := context.Background()
	
	for {
		// Watch pods
		go s.watchPods(ctx)
		
		// Watch deployments  
		go s.watchDeployments(ctx)
		
		// Send periodic updates every 10 seconds as fallback
		ticker := time.NewTicker(10 * time.Second)
		for range ticker.C {
			clusterData, err := s.getClusterData(ctx, "")
			if err != nil {
				log.Printf("Error getting cluster data: %v", err)
				continue
			}
			
			select {
			case s.broadcast <- clusterData:
			default:
				// Channel is full, skip this update
			}
		}
	}
}

// watchPods watches for pod changes
func (s *Server) watchPods(ctx context.Context) {
	for {
		watcher, err := s.client.GetClientset().CoreV1().Pods("").Watch(ctx, metav1.ListOptions{})
		if err != nil {
			log.Printf("Error creating pod watcher: %v", err)
			time.Sleep(5 * time.Second)
			continue
		}

		for event := range watcher.ResultChan() {
			if event.Type == watch.Added || event.Type == watch.Modified || event.Type == watch.Deleted {
				clusterData, err := s.getClusterData(ctx, "")
				if err != nil {
					log.Printf("Error getting cluster data after pod event: %v", err)
					continue
				}
				
				select {
				case s.broadcast <- clusterData:
				default:
					// Channel is full, skip this update
				}
			}
		}
		
		watcher.Stop()
		time.Sleep(1 * time.Second) // Brief pause before restarting watcher
	}
}

// watchDeployments watches for deployment changes
func (s *Server) watchDeployments(ctx context.Context) {
	for {
		watcher, err := s.client.GetClientset().AppsV1().Deployments("").Watch(ctx, metav1.ListOptions{})
		if err != nil {
			log.Printf("Error creating deployment watcher: %v", err)
			time.Sleep(5 * time.Second)
			continue
		}

		for event := range watcher.ResultChan() {
			if event.Type == watch.Added || event.Type == watch.Modified || event.Type == watch.Deleted {
				clusterData, err := s.getClusterData(ctx, "")
				if err != nil {
					log.Printf("Error getting cluster data after deployment event: %v", err)
					continue
				}
				
				select {
				case s.broadcast <- clusterData:
				default:
					// Channel is full, skip this update
				}
			}
		}
		
		watcher.Stop()
		time.Sleep(1 * time.Second) // Brief pause before restarting watcher
	}
}

// getClusterData is a helper method to get cluster data
func (s *Server) getClusterData(ctx context.Context, namespace string) (ClusterData, error) {
	// Get pod information
	pods, err := s.client.GetPods(ctx, namespace)
	if err != nil {
		return ClusterData{}, err
	}

	// Get deployment information
	deployments, err := s.client.GetDeployments(ctx, namespace)
	if err != nil {
		return ClusterData{}, err
	}

	// Convert to response format
	podData := make([]PodData, len(pods))
	totalContainers := 0
	readyContainers := 0

	for i, pod := range pods {
		totalContainers += pod.ContainerCount
		readyContainers += pod.ReadyContainers

		podData[i] = PodData{
			Name:            pod.Name,
			Namespace:       pod.Namespace,
			Status:          pod.Status,
			ContainerCount:  pod.ContainerCount,
			ReadyContainers: pod.ReadyContainers,
			StatusSymbol:    getStatusSymbol(pod.Status),
		}
	}

	deploymentData := make([]DeploymentData, len(deployments))
	totalReplicas := int32(0)
	readyReplicasTotal := int32(0)

	for i, deployment := range deployments {
		totalReplicas += deployment.Replicas
		readyReplicasTotal += deployment.ReadyReplicas

		deploymentData[i] = DeploymentData{
			Name:              deployment.Name,
			Namespace:         deployment.Namespace,
			Replicas:          deployment.Replicas,
			ReadyReplicas:     deployment.ReadyReplicas,
			AvailableReplicas: deployment.AvailableReplicas,
		}
	}

	// Calculate percentages
	containerPercentage := 0.0
	if totalContainers > 0 {
		containerPercentage = float64(readyContainers) / float64(totalContainers) * 100
	}

	replicaPercentage := 0.0
	if totalReplicas > 0 {
		replicaPercentage = float64(readyReplicasTotal) / float64(totalReplicas) * 100
	}

	return ClusterData{
		Pods:                podData,
		Deployments:         deploymentData,
		TotalContainers:     totalContainers,
		ReadyContainers:     readyContainers,
		ContainerPercentage: containerPercentage,
		TotalReplicas:       totalReplicas,
		ReadyReplicas:       readyReplicasTotal,
		ReplicaPercentage:   replicaPercentage,
		LastUpdated:         time.Now(),
	}, nil
}
