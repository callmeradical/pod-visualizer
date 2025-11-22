package visualizer

import (
	"fmt"
	"strings"

	"pod-visualizer/pkg/k8s"
)

// Visualizer handles the display of Kubernetes resources
type Visualizer struct {
	blockChar     string
	emptyChar     string
	maxLineLength int
}

// New creates a new Visualizer with default settings
func New() *Visualizer {
	return &Visualizer{
		blockChar:     "█",
		emptyChar:     "░",
		maxLineLength: 80,
	}
}

// DisplayPods shows a visual representation of pods and their containers
func (v *Visualizer) DisplayPods(pods []k8s.PodInfo) {
	if len(pods) == 0 {
		fmt.Println("No pods found.")
		return
	}

	fmt.Printf("Pods Overview (%d total)\n", len(pods))
	fmt.Println(strings.Repeat("-", 40))

	totalContainers := 0
	runningContainers := 0

	for _, pod := range pods {
		totalContainers += pod.ContainerCount
		runningContainers += pod.ReadyContainers

		// Create visual representation
		status := v.getStatusSymbol(pod.Status)
		readyBlocks := strings.Repeat(v.blockChar, pod.ReadyContainers)
		notReadyBlocks := strings.Repeat(v.emptyChar, pod.ContainerCount-pod.ReadyContainers)

		fmt.Printf("%s %s/%s: %s%s (%d/%d containers ready)\n",
			status,
			pod.Namespace,
			pod.Name,
			readyBlocks,
			notReadyBlocks,
			pod.ReadyContainers,
			pod.ContainerCount,
		)
	}

	fmt.Println()
	v.displayContainerSummary(runningContainers, totalContainers)
}

// DisplayDeployments shows a visual representation of deployments and their replicas
func (v *Visualizer) DisplayDeployments(deployments []k8s.DeploymentInfo) {
	if len(deployments) == 0 {
		fmt.Println("No deployments found.")
		return
	}

	fmt.Printf("Deployments Overview (%d total)\n", len(deployments))
	fmt.Println(strings.Repeat("-", 40))

	totalReplicas := int32(0)
	readyReplicas := int32(0)

	for _, deployment := range deployments {
		totalReplicas += deployment.Replicas
		readyReplicas += deployment.ReadyReplicas

		// Create visual representation
		readyBlocks := strings.Repeat(v.blockChar, int(deployment.ReadyReplicas))
		notReadyBlocks := strings.Repeat(v.emptyChar, int(deployment.Replicas-deployment.ReadyReplicas))

		fmt.Printf("📦 %s/%s: %s%s (%d/%d replicas ready)\n",
			deployment.Namespace,
			deployment.Name,
			readyBlocks,
			notReadyBlocks,
			deployment.ReadyReplicas,
			deployment.Replicas,
		)
	}

	fmt.Println()
	v.displayReplicaSummary(readyReplicas, totalReplicas)
}

// displayContainerSummary shows an overall container status summary
func (v *Visualizer) displayContainerSummary(running, total int) {
	fmt.Println("Container Summary:")

	// Calculate percentage
	percentage := 0.0
	if total > 0 {
		percentage = float64(running) / float64(total) * 100
	}

	// Create a visual progress bar
	barWidth := 50
	filledWidth := int(float64(barWidth) * percentage / 100)
	emptyWidth := barWidth - filledWidth

	progressBar := strings.Repeat(v.blockChar, filledWidth) + strings.Repeat(v.emptyChar, emptyWidth)

	fmt.Printf("Running: %d/%d (%.1f%%) [%s]\n", running, total, percentage, progressBar)
}

// displayReplicaSummary shows an overall replica status summary
func (v *Visualizer) displayReplicaSummary(ready, total int32) {
	fmt.Println("Replica Summary:")

	// Calculate percentage
	percentage := 0.0
	if total > 0 {
		percentage = float64(ready) / float64(total) * 100
	}

	// Create a visual progress bar
	barWidth := 50
	filledWidth := int(float64(barWidth) * percentage / 100)
	emptyWidth := barWidth - filledWidth

	progressBar := strings.Repeat(v.blockChar, filledWidth) + strings.Repeat(v.emptyChar, emptyWidth)

	fmt.Printf("Ready: %d/%d (%.1f%%) [%s]\n", ready, total, percentage, progressBar)
}

// getStatusSymbol returns a symbol representing the pod status
func (v *Visualizer) getStatusSymbol(status string) string {
	switch strings.ToLower(status) {
	case "running":
		return "✅"
	case "pending":
		return "⏳"
	case "failed":
		return "❌"
	case "succeeded":
		return "✅"
	default:
		return "❓"
	}
}
