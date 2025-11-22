package main

import (
	"context"
	"flag"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"

	"pod-visualizer/pkg/k8s"
	"pod-visualizer/pkg/web"

	"k8s.io/client-go/util/homedir"
)

func main() {
	var kubeconfig *string
	if home := homedir.HomeDir(); home != "" {
		kubeconfig = flag.String("kubeconfig", filepath.Join(home, ".kube", "config"), "(optional) absolute path to the kubeconfig file - not needed when running in cluster")
	} else {
		kubeconfig = flag.String("kubeconfig", "", "(optional) absolute path to the kubeconfig file - not needed when running in cluster")
	}

	port := flag.Int("port", 8080, "port for the web server")
	flag.Parse()

	// Create Kubernetes client
	client, err := k8s.NewClient(*kubeconfig)
	if err != nil {
		log.Fatalf("Error creating Kubernetes client: %v", err)
	}

	// Create and start web server
	server := web.NewServer(client, *port)

	// Handle graceful shutdown
	go func() {
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
		<-sigChan

		log.Println("Shutting down server...")
		os.Exit(0)
	}()

	// Start the server
	log.Printf("Pod Visualizer Web Server")
	log.Printf("========================")
	log.Printf("Connecting to Kubernetes cluster...")

	// Test connection
	ctx := context.Background()
	_, err = client.GetPods(ctx, "")
	if err != nil {
		log.Fatalf("Failed to connect to Kubernetes cluster: %v", err)
	}

	log.Printf("✅ Connected to Kubernetes cluster successfully")
	log.Printf("Starting web server on port %d...", *port)

	if err := server.Start(); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
