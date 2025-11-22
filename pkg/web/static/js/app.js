// Pod Visualizer Frontend JavaScript

let currentNamespace = '';
let autoRefreshInterval = null;
let namespaceList = new Set();
let websocket = null;
let isWebSocketEnabled = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 2000; // 2 seconds

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('Pod Visualizer frontend loaded');
    
    // Get default namespace from meta tag
    const defaultNamespace = document.querySelector('meta[name="default-namespace"]')?.getAttribute('content') || '';
    if (defaultNamespace) {
        currentNamespace = defaultNamespace;
        console.log('Setting default namespace to:', defaultNamespace);
    }
    
    // Try to connect to WebSocket first
    connectWebSocket();
    
    // Fallback to HTTP polling if WebSocket fails
    setTimeout(() => {
        if (!isWebSocketEnabled) {
            console.log('WebSocket not available, falling back to HTTP polling');
            loadData();
            populateNamespaceFilter();
        }
    }, 1000);
    
    // Set up event listeners
    document.getElementById('namespace').addEventListener('change', function() {
        currentNamespace = this.value;
        if (!isWebSocketEnabled) {
            loadData();
        } else {
            // With WebSocket, we could send a message to change namespace
            // For now, we'll let the next update handle it
            console.log('Namespace changed to:', currentNamespace);
        }
    });
});

// Load cluster data from API
async function loadData() {
    try {
        setLoadingState(true);
        
        const params = new URLSearchParams();
        if (currentNamespace) {
            params.append('namespace', currentNamespace);
        }
        
        const response = await fetch(`/api/cluster?${params.toString()}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        updateDashboard(data);
        updateLastUpdatedTime(data.lastUpdated);
        updateNamespaceList(data.pods, data.deployments);
        
    } catch (error) {
        console.error('Error loading data:', error);
        showError('Failed to load data: ' + error.message);
    } finally {
        setLoadingState(false);
    }
}

// Update the dashboard with cluster data
function updateDashboard(data) {
    // Update summary cards
    updateSummaryCards(data);
    
    // Update pods section
    updatePodsSection(data.pods);
    
    // Update deployments section
    updateDeploymentsSection(data.deployments);
}

// Update summary cards
function updateSummaryCards(data) {
    // Container summary
    document.getElementById('ready-containers').textContent = data.readyContainers;
    document.getElementById('total-containers').textContent = data.totalContainers;
    document.getElementById('container-percentage').textContent = `${data.containerPercentage.toFixed(1)}%`;
    
    const containerProgress = document.getElementById('container-progress');
    containerProgress.style.width = `${data.containerPercentage}%`;
    
    // Replica summary
    document.getElementById('ready-replicas').textContent = data.readyReplicas;
    document.getElementById('total-replicas').textContent = data.totalReplicas;
    document.getElementById('replica-percentage').textContent = `${data.replicaPercentage.toFixed(1)}%`;
    
    const replicaProgress = document.getElementById('replica-progress');
    replicaProgress.style.width = `${data.replicaPercentage}%`;
}

// Update pods section
function updatePodsSection(pods) {
    const container = document.getElementById('pods-container');
    
    if (pods.length === 0) {
        container.innerHTML = '<div class="empty-state">No pods found</div>';
        return;
    }
    
    const podsHtml = pods.map(pod => `
        <div class="resource-item fade-in">
            <div class="resource-header">
                <span class="status-symbol">${pod.statusSymbol}</span>
                <span class="resource-name">${pod.name}</span>
                <span class="resource-namespace">/ ${pod.namespace}</span>
            </div>
            <div class="visual-blocks">
                ${generateBlocks(pod.readyContainers, pod.containerCount - pod.readyContainers)}
            </div>
            <div class="resource-stats">
                ${pod.readyContainers}/${pod.containerCount} containers ready
                • Status: ${pod.status}
            </div>
        </div>
    `).join('');
    
    container.innerHTML = podsHtml;
}

// Update deployments section
function updateDeploymentsSection(deployments) {
    const container = document.getElementById('deployments-container');
    
    if (deployments.length === 0) {
        container.innerHTML = '<div class="empty-state">No deployments found</div>';
        return;
    }
    
    const deploymentsHtml = deployments.map(deployment => `
        <div class="resource-item fade-in">
            <div class="resource-header">
                <span class="status-symbol">📦</span>
                <span class="resource-name">${deployment.name}</span>
                <span class="resource-namespace">/ ${deployment.namespace}</span>
            </div>
            <div class="visual-blocks">
                ${generateBlocks(deployment.readyReplicas, deployment.replicas - deployment.readyReplicas)}
            </div>
            <div class="resource-stats">
                ${deployment.readyReplicas}/${deployment.replicas} replicas ready
                • Available: ${deployment.availableReplicas}
            </div>
        </div>
    `).join('');
    
    container.innerHTML = deploymentsHtml;
}

// Generate visual blocks
function generateBlocks(ready, notReady) {
    const readyBlocks = '█'.repeat(ready);
    const notReadyBlocks = '░'.repeat(notReady);
    
    return `
        <span class="block-ready">${readyBlocks}</span><span class="block-not-ready">${notReadyBlocks}</span>
    `;
}

// Update namespace list for filter
function updateNamespaceList(pods, deployments) {
    const allResources = [...pods, ...deployments];
    allResources.forEach(resource => {
        namespaceList.add(resource.namespace);
    });
    
    populateNamespaceFilter();
}

// Populate namespace filter dropdown
function populateNamespaceFilter() {
    const select = document.getElementById('namespace');
    const currentValue = currentNamespace || select.value;
    
    // Clear existing options except "All Namespaces"
    select.innerHTML = '<option value="">All Namespaces</option>';
    
    // Add namespace options
    Array.from(namespaceList).sort().forEach(namespace => {
        const option = document.createElement('option');
        option.value = namespace;
        option.textContent = namespace;
        select.appendChild(option);
    });
    
    // Set selection to current namespace or restore previous selection
    select.value = currentValue;
    
    // If we have a default namespace but it's not in the list yet, add it
    if (currentNamespace && !namespaceList.has(currentNamespace)) {
        const option = document.createElement('option');
        option.value = currentNamespace;
        option.textContent = currentNamespace;
        select.appendChild(option);
        select.value = currentNamespace;
    }
}

// Update last updated time
function updateLastUpdatedTime(timestamp) {
    const lastUpdatedElement = document.getElementById('last-updated');
    const date = new Date(timestamp);
    lastUpdatedElement.textContent = date.toLocaleTimeString();
}

// Set loading state
function setLoadingState(isLoading) {
    const refreshBtn = document.getElementById('refresh-btn');
    
    if (isLoading) {
        refreshBtn.textContent = '🔄 Loading...';
        refreshBtn.disabled = true;
    } else {
        refreshBtn.textContent = '🔄 Refresh';
        refreshBtn.disabled = false;
    }
}

// Show error message
function showError(message) {
    const podsContainer = document.getElementById('pods-container');
    const deploymentsContainer = document.getElementById('deployments-container');
    
    const errorHtml = `<div class="error">${message}</div>`;
    
    podsContainer.innerHTML = errorHtml;
    deploymentsContainer.innerHTML = errorHtml;
}

// Refresh data manually
function refreshData() {
    loadData();
}

// Toggle auto-refresh
function toggleAutoRefresh() {
    const checkbox = document.getElementById('auto-refresh');
    
    if (checkbox.checked) {
        // Start auto-refresh every 30 seconds
        autoRefreshInterval = setInterval(() => {
            console.log('Auto-refreshing data...');
            loadData();
        }, 30000);
        console.log('Auto-refresh enabled (30s interval)');
    } else {
        // Stop auto-refresh
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
            autoRefreshInterval = null;
        }
        console.log('Auto-refresh disabled');
    }
}

// Handle keyboard shortcuts
document.addEventListener('keydown', function(event) {
    // Ctrl/Cmd + R for refresh
    if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
        event.preventDefault();
        refreshData();
    }
    
    // F5 for refresh
    if (event.key === 'F5') {
        event.preventDefault();
        refreshData();
    }
});

// WebSocket Functions

// Connect to WebSocket for real-time updates
function connectWebSocket() {
    try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        console.log('Attempting to connect to WebSocket:', wsUrl);
        websocket = new WebSocket(wsUrl);
        
        websocket.onopen = function(event) {
            console.log('✅ WebSocket connected successfully');
            isWebSocketEnabled = true;
            reconnectAttempts = 0;
            updateConnectionStatus('Connected', true);
            
            // Disable auto-refresh since we have real-time updates
            const autoRefreshCheckbox = document.getElementById('auto-refresh');
            if (autoRefreshCheckbox && autoRefreshCheckbox.checked) {
                autoRefreshCheckbox.checked = false;
                toggleAutoRefresh();
            }
        };
        
        websocket.onmessage = function(event) {
            try {
                const data = JSON.parse(event.data);
                console.log('📡 Received WebSocket data update');
                
                // Filter data based on current namespace if needed
                let filteredData = data;
                if (currentNamespace) {
                    filteredData = {
                        ...data,
                        pods: data.pods.filter(pod => pod.namespace === currentNamespace),
                        deployments: data.deployments.filter(dep => dep.namespace === currentNamespace)
                    };
                    
                    // Recalculate totals for filtered data
                    filteredData.totalContainers = filteredData.pods.reduce((sum, pod) => sum + pod.containerCount, 0);
                    filteredData.readyContainers = filteredData.pods.reduce((sum, pod) => sum + pod.readyContainers, 0);
                    filteredData.containerPercentage = filteredData.totalContainers > 0 ? 
                        (filteredData.readyContainers / filteredData.totalContainers) * 100 : 0;
                        
                    filteredData.totalReplicas = filteredData.deployments.reduce((sum, dep) => sum + dep.replicas, 0);
                    filteredData.readyReplicas = filteredData.deployments.reduce((sum, dep) => sum + dep.readyReplicas, 0);
                    filteredData.replicaPercentage = filteredData.totalReplicas > 0 ? 
                        (filteredData.readyReplicas / filteredData.totalReplicas) * 100 : 0;
                }
                
                updateDashboard(filteredData);
                updateLastUpdatedTime(data.lastUpdated);
                updateNamespaceList(data.pods, data.deployments); // Use full data for namespace list
                
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };
        
        websocket.onclose = function(event) {
            console.log('🔌 WebSocket connection closed');
            isWebSocketEnabled = false;
            updateConnectionStatus('Disconnected', false);
            
            // Attempt to reconnect
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttempts++;
                console.log(`Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
                setTimeout(() => {
                    connectWebSocket();
                }, RECONNECT_DELAY * reconnectAttempts); // Exponential backoff
            } else {
                console.log('Max reconnection attempts reached, falling back to HTTP polling');
                fallbackToPolling();
            }
        };
        
        websocket.onerror = function(error) {
            console.error('WebSocket error:', error);
            isWebSocketEnabled = false;
            updateConnectionStatus('Error', false);
        };
        
    } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        fallbackToPolling();
    }
}

// Update connection status indicator
function updateConnectionStatus(status, isConnected) {
    const statusElement = document.getElementById('connection-status');
    if (!statusElement) return;
    
    statusElement.textContent = status;
    statusElement.className = isConnected ? 'connected' : 'disconnected';
    
    if (isConnected) {
        statusElement.title = 'Real-time updates via WebSocket';
    } else {
        statusElement.title = 'Using HTTP polling for updates';
    }
}

// Fallback to HTTP polling when WebSocket fails
function fallbackToPolling() {
    console.log('Falling back to HTTP polling mode');
    isWebSocketEnabled = false;
    updateConnectionStatus('Polling', false);
    
    // Load initial data
    loadData();
    populateNamespaceFilter();
    
    // Enable auto-refresh by default when using polling
    const autoRefreshCheckbox = document.getElementById('auto-refresh');
    if (autoRefreshCheckbox && !autoRefreshCheckbox.checked) {
        autoRefreshCheckbox.checked = true;
        toggleAutoRefresh();
    }
}

// Disconnect WebSocket (useful for debugging or switching modes)
function disconnectWebSocket() {
    if (websocket) {
        websocket.close();
        websocket = null;
    }
    isWebSocketEnabled = false;
    reconnectAttempts = MAX_RECONNECT_ATTEMPTS; // Prevent reconnection
}
