package k8s

import (
	"context"
	"fmt"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

// Client wraps the Kubernetes clientset
type Client struct {
	clientset *kubernetes.Clientset
}

// PodInfo contains relevant pod information for visualization
type PodInfo struct {
	Name            string
	Namespace       string
	Status          string
	ContainerCount  int
	ReadyContainers int
}

// DeploymentInfo contains relevant deployment information
type DeploymentInfo struct {
	Name              string
	Namespace         string
	Replicas          int32
	ReadyReplicas     int32
	AvailableReplicas int32
}

// NewClient creates a new Kubernetes client
// It prioritizes in-cluster configuration when running inside a pod
func NewClient(kubeconfigPath string) (*Client, error) {
	var config *rest.Config
	var err error

	// Always try in-cluster config first (when running inside a pod)
	config, err = rest.InClusterConfig()
	if err != nil {
		// Fall back to kubeconfig if not running in cluster
		if kubeconfigPath == "" {
			return nil, fmt.Errorf("not running in cluster and no kubeconfig provided: %v", err)
		}

		config, err = clientcmd.BuildConfigFromFlags("", kubeconfigPath)
		if err != nil {
			return nil, fmt.Errorf("failed to create config from kubeconfig: %v", err)
		}
	}

	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create clientset: %v", err)
	}

	return &Client{clientset: clientset}, nil
}

// GetPods retrieves pods from the cluster
func (c *Client) GetPods(ctx context.Context, namespace string) ([]PodInfo, error) {
	var pods *corev1.PodList
	var err error

	if namespace == "" {
		pods, err = c.clientset.CoreV1().Pods("").List(ctx, metav1.ListOptions{})
	} else {
		pods, err = c.clientset.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{})
	}

	if err != nil {
		return nil, fmt.Errorf("failed to list pods: %v", err)
	}

	var podInfos []PodInfo
	for _, pod := range pods.Items {
		readyContainers := 0
		for _, containerStatus := range pod.Status.ContainerStatuses {
			if containerStatus.Ready {
				readyContainers++
			}
		}

		podInfo := PodInfo{
			Name:            pod.Name,
			Namespace:       pod.Namespace,
			Status:          string(pod.Status.Phase),
			ContainerCount:  len(pod.Spec.Containers),
			ReadyContainers: readyContainers,
		}
		podInfos = append(podInfos, podInfo)
	}

	return podInfos, nil
}

// GetDeployments retrieves deployments from the cluster
func (c *Client) GetDeployments(ctx context.Context, namespace string) ([]DeploymentInfo, error) {
	var deployments *appsv1.DeploymentList
	var err error

	if namespace == "" {
		deployments, err = c.clientset.AppsV1().Deployments("").List(ctx, metav1.ListOptions{})
	} else {
		deployments, err = c.clientset.AppsV1().Deployments(namespace).List(ctx, metav1.ListOptions{})
	}

	if err != nil {
		return nil, fmt.Errorf("failed to list deployments: %v", err)
	}

	var deploymentInfos []DeploymentInfo
	for _, deployment := range deployments.Items {
		deploymentInfo := DeploymentInfo{
			Name:              deployment.Name,
			Namespace:         deployment.Namespace,
			Replicas:          *deployment.Spec.Replicas,
			ReadyReplicas:     deployment.Status.ReadyReplicas,
			AvailableReplicas: deployment.Status.AvailableReplicas,
		}
		deploymentInfos = append(deploymentInfos, deploymentInfo)
	}

	return deploymentInfos, nil
}

// GetClientset returns the underlying Kubernetes clientset for advanced operations
func (c *Client) GetClientset() *kubernetes.Clientset {
	return c.clientset
}
