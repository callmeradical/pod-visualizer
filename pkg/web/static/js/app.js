// Pod Visualizer Frontend JavaScript

let currentNamespace = '';
let autoRefreshInterval = null;
let namespaceList = new Set();

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('Pod Visualizer frontend loaded');
    loadData();
    populateNamespaceFilter();
    
    // Set up event listeners
    document.getElementById('namespace').addEventListener('change', function() {
        currentNamespace = this.value;
        loadData();
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
    const currentValue = select.value;
    
    // Clear existing options except "All Namespaces"
    select.innerHTML = '<option value="">All Namespaces</option>';
    
    // Add namespace options
    Array.from(namespaceList).sort().forEach(namespace => {
        const option = document.createElement('option');
        option.value = namespace;
        option.textContent = namespace;
        select.appendChild(option);
    });
    
    // Restore selection
    select.value = currentValue;
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
