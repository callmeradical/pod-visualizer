package web

import (
	"context"
	"encoding/json"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"path/filepath"
	"time"

	"pod-visualizer/pkg/k8s"
)

// Server represents the web server
type Server struct {
	client   *k8s.Client
	port     int
	template *template.Template
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
		client: client,
		port:   port,
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
	http.HandleFunc("/health", s.handleHealth)
	http.HandleFunc("/ready", s.handleReady)
	http.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir(filepath.Join("pkg", "web", "static")))))

	log.Printf("Starting web server on port %d", s.port)
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
