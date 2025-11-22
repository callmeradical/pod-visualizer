package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"path/filepath"

	"pod-visualizer/pkg/k8s"
	"pod-visualizer/pkg/visualizer"

	"k8s.io/client-go/util/homedir"
)

func main() {
	var kubeconfig *string
	if home := homedir.HomeDir(); home != "" {
		kubeconfig = flag.String("kubeconfig", filepath.Join(home, ".kube", "config"), "(optional) absolute path to the kubeconfig file - not needed when running in cluster")
	} else {
		kubeconfig = flag.String("kubeconfig", "", "(optional) absolute path to the kubeconfig file - not needed when running in cluster")
	}

	namespace := flag.String("namespace", "", "namespace to filter pods (empty for all namespaces)")
	flag.Parse()

	// Create Kubernetes client
	client, err := k8s.NewClient(*kubeconfig)
	if err != nil {
		log.Fatalf("Error creating Kubernetes client: %v", err)
	}

	// Get pod information
	ctx := context.Background()
	pods, err := client.GetPods(ctx, *namespace)
	if err != nil {
		log.Fatalf("Error getting pods: %v", err)
	}

	// Get deployment information
	deployments, err := client.GetDeployments(ctx, *namespace)
	if err != nil {
		log.Fatalf("Error getting deployments: %v", err)
	}

	// Create and display visualization
	viz := visualizer.New()
	fmt.Println("Pod Visualizer - Kubernetes Container Overview")
	fmt.Println("============================================")
	viz.DisplayPods(pods)
	fmt.Println()
	viz.DisplayDeployments(deployments)
}
