// Pod Visualizer Frontend JavaScript

let currentNamespace = '';
let autoRefreshInterval = null;
let namespaceList = new Set();
let websocket = null;
let isWebSocketEnabled = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 2000; // 2 seconds

// Track pods for animations
let previousPods = new Map(); // podName -> podData
let animationQueue = [];

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
            // With WebSocket, we'll let the next update handle it
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
    // Update stats
    updateStatsBar(data);
    
    // Update pods with animations
    updatePodsWithAnimations(data.pods);
}

// Update stats bar
function updateStatsBar(data) {
    // Update pod counts
    document.getElementById('ready-pods').textContent = data.pods.filter(p => p.status === 'Running').length;
    document.getElementById('total-pods').textContent = data.pods.length;
    
    // Update container counts
    document.getElementById('ready-containers').textContent = data.readyContainers;
    document.getElementById('total-containers').textContent = data.totalContainers;
}

// Update pods section with animations
function updatePodsWithAnimations(pods) {
    const container = document.getElementById('pods-container');
    
    if (pods.length === 0) {
        container.innerHTML = '<div class="empty-state">No pods found</div>';
        previousPods.clear();
        return;
    }
    
    // Create a map of current pods
    const currentPods = new Map();
    pods.forEach(pod => currentPods.set(pod.name, pod));
    
    // Find new, updated, and removed pods
    const newPods = [];
    const updatedPods = [];
    const removedPods = [];
    
    // Check for new and updated pods
    currentPods.forEach((pod, name) => {
        if (!previousPods.has(name)) {
            newPods.push(pod);
        } else {
            const prevPod = previousPods.get(name);
            if (hasSignificantChange(prevPod, pod)) {
                updatedPods.push({ previous: prevPod, current: pod });
            }
        }
    });
    
    // Check for removed pods
    previousPods.forEach((pod, name) => {
        if (!currentPods.has(name)) {
            removedPods.push(pod);
        }
    });
    
    // Handle removed pods first
    removedPods.forEach(pod => {
        const existingCard = document.querySelector(`[data-pod-name="${pod.name}"]`);
        if (existingCard) {
            existingCard.classList.add('leaving');
            setTimeout(() => {
                if (existingCard.parentNode) {
                    existingCard.parentNode.removeChild(existingCard);
                }
            }, 400);
        }
    });
    
    // Update or create pod cards
    const podsHtml = pods.map(pod => createPodCard(pod, newPods.includes(pod))).join('');
    
    // Only replace if we don't have existing content or if it's a complete refresh
    if (container.querySelector('.loading-state') || container.querySelector('.empty-state')) {
        container.innerHTML = podsHtml;
        // Add entering animation to all cards
        setTimeout(() => {
            container.querySelectorAll('.pod-card').forEach((card, index) => {
                card.style.animationDelay = `${index * 0.1}s`;
                card.classList.add('entering');
            });
        }, 10);
    } else {
        // Selective update - handle new pods
        newPods.forEach((pod, index) => {
            const newCard = document.createElement('div');
            newCard.innerHTML = createPodCard(pod, true);
            const cardElement = newCard.firstElementChild;
            
            // Add with delay based on index
            setTimeout(() => {
                container.appendChild(cardElement);
                setTimeout(() => cardElement.classList.add('entering'), 10);
            }, index * 200);
        });
        
        // Update existing pods
        updatedPods.forEach(({ previous, current }) => {
            const existingCard = document.querySelector(`[data-pod-name="${current.name}"]`);
            if (existingCard) {
                updatePodCard(existingCard, previous, current);
            }
        });
    }
    
    // Store current state for next comparison
    previousPods.clear();
    currentPods.forEach((pod, name) => previousPods.set(name, { ...pod }));
}

// Create HTML for a single pod card
function createPodCard(pod, isNew = false) {
    const statusClass = pod.status.toLowerCase();
    const containers = generateContainerBlocks(pod);
    
    return `
        <div class="pod-card ${isNew ? 'new' : ''}" data-pod-name="${pod.name}">
            <div class="pod-header">
                <div class="pod-info">
                    <h3>${pod.name}</h3>
                    <div class="namespace">${pod.namespace}</div>
                </div>
                <div class="pod-status ${statusClass}">${pod.status}</div>
            </div>
            <div class="container-blocks" data-container-count="${pod.containerCount}">
                ${containers}
            </div>
            <div class="pod-stats">
                ${pod.readyContainers}/${pod.containerCount} containers ready
            </div>
        </div>
    `;
}

// Update an existing pod card with animations
function updatePodCard(cardElement, previousPod, currentPod) {
    // Update status if changed
    const statusElement = cardElement.querySelector('.pod-status');
    if (previousPod.status !== currentPod.status) {
        statusElement.className = `pod-status ${currentPod.status.toLowerCase()}`;
        statusElement.textContent = currentPod.status;
        statusElement.classList.add('status-change');
        setTimeout(() => statusElement.classList.remove('status-change'), 800);
    }
    
    // Update container blocks if changed
    if (previousPod.readyContainers !== currentPod.readyContainers || 
        previousPod.containerCount !== currentPod.containerCount) {
        
        const blocksContainer = cardElement.querySelector('.container-blocks');
        const newBlocks = generateContainerBlocks(currentPod);
        
        // Animate container changes
        animateContainerChanges(blocksContainer, previousPod, currentPod);
        
        // Update stats
        const statsElement = cardElement.querySelector('.pod-stats');
        statsElement.textContent = `${currentPod.readyContainers}/${currentPod.containerCount} containers ready`;
    }
}

// Generate container blocks HTML
function generateContainerBlocks(pod) {
    let blocks = '';
    
    // Ready containers
    for (let i = 0; i < pod.readyContainers; i++) {
        blocks += `<div class="container-block ready" title="Container ${i + 1}: Ready"></div>`;
    }
    
    // Not ready containers
    const notReadyCount = pod.containerCount - pod.readyContainers;
    for (let i = 0; i < notReadyCount; i++) {
        const status = pod.status === 'Pending' ? 'pending' : 
                      pod.status === 'Failed' ? 'failed' : 'not-ready';
        blocks += `<div class="container-block ${status}" title="Container ${pod.readyContainers + i + 1}: ${status}"></div>`;
    }
    
    return blocks;
}

// Animate container block changes
function animateContainerChanges(container, prevPod, currentPod) {
    const prevReady = prevPod.readyContainers;
    const currentReady = currentPod.readyContainers;
    const prevTotal = prevPod.containerCount;
    const currentTotal = currentPod.containerCount;
    
    // If total containers changed, rebuild completely with animation
    if (prevTotal !== currentTotal) {
        const newBlocks = generateContainerBlocks(currentPod);
        container.innerHTML = newBlocks;
        
        // Animate new blocks
        container.querySelectorAll('.container-block').forEach((block, index) => {
            block.classList.add('new');
            block.style.animationDelay = `${index * 0.1}s`;
            setTimeout(() => block.classList.remove('new'), 500 + (index * 100));
        });
    }
    // If only readiness changed, animate status changes
    else if (prevReady !== currentReady) {
        const blocks = container.querySelectorAll('.container-block');
        
        // Handle containers becoming ready
        if (currentReady > prevReady) {
            for (let i = prevReady; i < currentReady; i++) {
                if (blocks[i]) {
                    blocks[i].className = 'container-block ready status-change';
                    blocks[i].title = `Container ${i + 1}: Ready`;
                    setTimeout(() => blocks[i].classList.remove('status-change'), 800);
                }
            }
        }
        // Handle containers becoming not ready
        else if (currentReady < prevReady) {
            const status = currentPod.status === 'Pending' ? 'pending' : 
                          currentPod.status === 'Failed' ? 'failed' : 'not-ready';
            
            for (let i = currentReady; i < prevReady; i++) {
                if (blocks[i]) {
                    blocks[i].className = `container-block ${status} status-change`;
                    blocks[i].title = `Container ${i + 1}: ${status}`;
                    setTimeout(() => blocks[i].classList.remove('status-change'), 800);
                }
            }
        }
    }
}

// Check if there's a significant change between pods
function hasSignificantChange(prevPod, currentPod) {
    return prevPod.status !== currentPod.status ||
           prevPod.readyContainers !== currentPod.readyContainers ||
           prevPod.containerCount !== currentPod.containerCount;
}

// Update namespace list for filter
function updateNamespaceList(pods, deployments) {
    const allResources = [...pods, ...(deployments || [])];
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
        refreshBtn.disabled = true;
        refreshBtn.style.opacity = '0.5';
    } else {
        refreshBtn.disabled = false;
        refreshBtn.style.opacity = '1';
    }
}

// Show error message
function showError(message) {
    const container = document.getElementById('pods-container');
    container.innerHTML = `<div class="error">${message}</div>`;
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
            updateConnectionStatus('connected');
            
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
                        deployments: (data.deployments || []).filter(dep => dep.namespace === currentNamespace)
                    };
                    
                    // Recalculate totals for filtered data
                    filteredData.totalContainers = filteredData.pods.reduce((sum, pod) => sum + pod.containerCount, 0);
                    filteredData.readyContainers = filteredData.pods.reduce((sum, pod) => sum + pod.readyContainers, 0);
                }
                
                updateDashboard(filteredData);
                updateLastUpdatedTime(data.lastUpdated);
                updateNamespaceList(data.pods, data.deployments || []); // Use full data for namespace list
                
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };
        
        websocket.onclose = function(event) {
            console.log('🔌 WebSocket connection closed');
            isWebSocketEnabled = false;
            updateConnectionStatus('disconnected');
            
            // Attempt to reconnect
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttempts++;
                console.log(`Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
                updateConnectionStatus('connecting');
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
            updateConnectionStatus('disconnected');
        };
        
    } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        fallbackToPolling();
    }
}

// Update connection status indicator
function updateConnectionStatus(status) {
    const statusDot = document.getElementById('connection-status');
    if (!statusDot) return;
    
    statusDot.className = `status-dot ${status}`;
    
    const titles = {
        connected: 'Connected - Real-time updates',
        connecting: 'Connecting...',
        disconnected: 'Disconnected - Using polling'
    };
    
    statusDot.title = titles[status] || status;
}

// Fallback to HTTP polling when WebSocket fails
function fallbackToPolling() {
    console.log('Falling back to HTTP polling mode');
    isWebSocketEnabled = false;
    updateConnectionStatus('disconnected');
    
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
