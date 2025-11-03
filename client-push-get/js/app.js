class CarMonitoringApp {
    constructor() {
        // ✅ CONFIGURACIÓN UNIFICADA
        this.apiBaseUrl = 'http://98.91.159.217:5500';  // Sin CORS proxy
        this.socket = null;  // Socket.IO instance
        this.isConnected = false;
        this.currentDevice = 1;
        this.stats = {
            totalMovements: 0,
            totalObstacles: 0,
            activeDevices: 0,
            wsMessages: 0,
            connections: 0,
            startTime: Date.now()
        };
        
        this.initializeApp();
    }

    initializeApp() {
        this.initializeEventListeners();
        this.connectSocketIO();  // ✅ Cambio importante
        this.loadInitialData();
        this.startUptimeCounter();
    }

    // ========== WEBSOCKET CON SOCKET.IO ==========
    
    connectSocketIO() {
        try {
            // ✅ Usar Socket.IO en lugar de WebSocket nativo
            this.socket = io(this.apiBaseUrl, {
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionAttempts: 10
            });

            // Evento: Conectado
            this.socket.on('connect', () => {
                this.isConnected = true;
                this.stats.connections++;
                this.updateConnectionStatus('Conectado ✅', 'success');
                this.addRealTimeMessage('🔗 Sistema de monitoreo conectado', 'system');
                this.showNotification('Socket.IO conectado exitosamente', 'success');
                console.log('✅ Socket.IO conectado:', this.socket.id);
            });

            // Evento: Estado de conexión
            this.socket.on('connection_status', (data) => {
                this.addRealTimeMessage(`📡 ${data.message}`, 'system');
            });

            // ✅ ESCUCHAR MOVIMIENTOS EN TIEMPO REAL
            this.socket.on('movement_command', (data) => {
                this.stats.wsMessages++;
                this.updateStats();
                
                const movement = data.data;
                const deviceName = movement.nombre_dispositivo || 'Dispositivo';
                const operationText = movement.status_texto || 'Operación';
                
                // Agregar a tiempo real
                this.addRealTimeMovement(
                    `🚗 ${deviceName} - ${operationText}`,
                    movement.status_operacion
                );
                
                // Actualizar historial después de un breve delay
                setTimeout(() => this.loadMovementsHistory(), 500);
            });

            // ✅ ESCUCHAR OBSTÁCULOS EN TIEMPO REAL
            this.socket.on('obstacle_detected', (data) => {
                this.stats.wsMessages++;
                this.updateStats();
                
                const obstacle = data.data;
                const deviceName = obstacle.nombre_dispositivo || 'Dispositivo';
                const obstacleText = obstacle.status_texto || 'Obstáculo';
                
                // Agregar a tiempo real
                this.addRealTimeObstacle(
                    `⚠️ ${deviceName} - ${obstacleText}`,
                    obstacle.status_obstaculo
                );
                
                // Actualizar historial después de un breve delay
                setTimeout(() => this.loadObstaclesHistory(), 500);
            });

            // Evento: Desconectado
            this.socket.on('disconnect', () => {
                this.isConnected = false;
                this.updateConnectionStatus('Desconectado', 'secondary');
                this.addRealTimeMessage('🔌 Desconectado del servidor Socket.IO', 'system');
                console.log('❌ Socket.IO desconectado');
                
                setTimeout(() => {
                    if (!this.isConnected) {
                        this.addRealTimeMessage('🔄 Intentando reconectar...', 'system');
                    }
                }, 5000);
            });

            // Evento: Error
            this.socket.on('connect_error', (error) => {
                this.updateConnectionStatus('Error ❌', 'danger');
                this.addRealTimeMessage('❌ Error en conexión Socket.IO', 'system');
                console.error('Socket.IO error:', error);
            });

            // Heartbeat cada 30 segundos
            setInterval(() => {
                if (this.isConnected) {
                    this.socket.emit('ping');
                }
            }, 30000);

        } catch (error) {
            console.error('Error inicializando Socket.IO:', error);
            this.showNotification('Error al conectar Socket.IO', 'danger');
        }
    }

    // ========== CARGA DE DATOS INICIALES (REST API) ==========

    async loadInitialData() {
        await this.checkApiStatus();
        await this.loadMovementsHistory();
        await this.loadObstaclesHistory();
        await this.loadStats();
    }

    async checkApiStatus() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/health`);
            const data = await response.json();
            
            document.getElementById('apiStatus').innerHTML = `
                <span class="badge bg-success">En línea</span>
                <small class="d-block">${data.service}</small>
            `;
            
        } catch (error) {
            document.getElementById('apiStatus').innerHTML = `
                <span class="badge bg-danger">Desconectado</span>
                <small class="d-block">Error de conexión</small>
            `;
        }
    }

    async loadMovementsHistory() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/commands?device_id=${this.currentDevice}&limit=15`);
            const data = await response.json();
            
            if (data.status === 'success') {
                this.displayMovementsHistory(data.data);
                this.stats.totalMovements = data.data.length;
                this.updateStats();
            }
        } catch (error) {
            console.error('Error loading movements:', error);
            this.addRealTimeMessage('❌ Error al cargar movimientos', 'system');
        }
    }

    async loadObstaclesHistory() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/obstacles?device_id=${this.currentDevice}&limit=10`);
            const data = await response.json();
            
            if (data.status === 'success') {
                this.displayObstaclesHistory(data.data);
                this.stats.totalObstacles = data.data.length;
                this.updateStats();
            }
        } catch (error) {
            console.error('Error loading obstacles:', error);
            this.addRealTimeMessage('❌ Error al cargar obstáculos', 'system');
        }
    }

    async loadStats() {
        try {
            const [movementsRes, obstaclesRes, devicesRes] = await Promise.all([
                fetch(`${this.apiBaseUrl}/api/commands?limit=100`),
                fetch(`${this.apiBaseUrl}/api/obstacles?limit=100`),
                fetch(`${this.apiBaseUrl}/api/devices`)
            ]);

            const movements = await movementsRes.json();
            const obstacles = await obstaclesRes.json();
            const devices = await devicesRes.json();

            this.stats.totalMovements = movements.data?.length || 0;
            this.stats.totalObstacles = obstacles.data?.length || 0;
            this.stats.activeDevices = devices.data?.length || 0;
            
            this.updateStats();
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    // ========== VISUALIZACIÓN DE DATOS ==========

    displayMovementsHistory(movements) {
        const container = document.getElementById('movementsHistory');
        
        if (!movements || movements.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="bi bi-inbox display-6"></i>
                    <p class="mt-2">No hay movimientos registrados</p>
                </div>
            `;
            return;
        }

        let html = '';
        movements.forEach(movement => {
            const date = new Date(movement.fecha_hora).toLocaleString();
            html += `
                <div class="message-item movement fade-in">
                    <div class="message-header">
                        <span class="message-time">${date}</span>
                        <span class="message-type ${this.getMovementTypeClass(movement.status_operacion)}">
                            ${movement.status_texto}
                        </span>
                    </div>
                    <p class="message-content">
                        <strong>${movement.nombre_dispositivo}</strong><br>
                        ${movement.status_texto}
                    </p>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    displayObstaclesHistory(obstacles) {
        const container = document.getElementById('obstaclesHistory');
        
        if (!obstacles || obstacles.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="bi bi-shield-check display-6"></i>
                    <p class="mt-2">No hay obstáculos detectados</p>
                </div>
            `;
            return;
        }

        let html = '';
        obstacles.forEach(obstacle => {
            const date = new Date(obstacle.fecha_hora).toLocaleString();
            html += `
                <div class="message-item obstacle fade-in">
                    <div class="message-header">
                        <span class="message-time">${date}</span>
                        <span class="message-type ${this.getObstacleTypeClass(obstacle.status_obstaculo)}">
                            ${obstacle.status_texto}
                        </span>
                    </div>
                    <p class="message-content">
                        <strong>${obstacle.nombre_dispositivo}</strong><br>
                        Obstáculo: ${obstacle.status_texto}
                    </p>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    // ========== TIEMPO REAL ==========

    addRealTimeMovement(message, operation) {
        const container = document.getElementById('realTimeMovements');
        this.addRealTimeMessageToContainer(message, 'movement', operation, container);
    }

    addRealTimeObstacle(message, obstacle) {
        const container = document.getElementById('realTimeObstacles');
        const type = [4, 5].includes(obstacle) ? 'emergency' : 'obstacle';
        this.addRealTimeMessageToContainer(message, type, obstacle, container);
    }

    addRealTimeMessage(message, type) {
        // Para mensajes del sistema, mostrarlos en ambos contenedores
        if (type === 'system') {
            this.addRealTimeMessageToContainer(message, 'system', null, document.getElementById('realTimeMovements'));
            this.addRealTimeMessageToContainer(message, 'system', null, document.getElementById('realTimeObstacles'));
        }
    }

    addRealTimeMessageToContainer(message, type, data, container) {
        // Si es el primer mensaje, limpiar el placeholder
        if (container.children.length === 1 && container.children[0].classList.contains('text-center')) {
            container.innerHTML = '';
        }
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message-item ${type} fade-in`;
        
        const typeClass = this.getMessageTypeClass(type);
        const typeText = type.toUpperCase();
        
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="message-time">${new Date().toLocaleTimeString()}</span>
                <span class="message-type ${typeClass}">
                    ${typeText}
                </span>
            </div>
            <p class="message-content">${message}</p>
        `;
        
        container.appendChild(messageDiv);
        container.scrollTop = container.scrollHeight;

        // Limitar a 50 mensajes
        if (container.children.length > 50) {
            container.removeChild(container.firstChild);
        }
    }

    // ========== MÉTODOS AUXILIARES ==========

    getMovementTypeClass(operation) {
        if ([1, 2].includes(operation)) return 'movement';
        if (operation === 3) return 'system';
        if ([8, 9, 10, 11].includes(operation)) return 'movement';
        return 'system';
    }

    getObstacleTypeClass(obstacle) {
        if ([1, 2, 3].includes(obstacle)) return 'obstacle';
        if ([4, 5].includes(obstacle)) return 'emergency';
        return 'obstacle';
    }

    getMessageTypeClass(type) {
        const classes = {
            'movement': 'movement',
            'obstacle': 'obstacle',
            'emergency': 'emergency',
            'system': 'system'
        };
        return classes[type] || 'system';
    }

    clearRealTimeData() {
        const containers = [
            'realTimeMovements',
            'realTimeObstacles'
        ];
        
        containers.forEach(containerId => {
            const container = document.getElementById(containerId);
            container.innerHTML = `
                <div class="text-center text-muted py-5">
                    <i class="bi bi-trash display-4"></i>
                    <p class="mt-3">Log limpiado</p>
                </div>
            `;
        });
        
        this.showNotification('Logs de tiempo real limpiados', 'info');
    }

    updateConnectionStatus(text, type) {
        const element = document.getElementById('wsStatus');
        const badgeClass = {
            'success': 'bg-success',
            'warning': 'bg-warning',
            'danger': 'bg-danger',
            'secondary': 'bg-secondary'
        }[type] || 'bg-secondary';
        
        element.innerHTML = `<span class="badge ${badgeClass}">${text}</span>`;
    }

    updateStats() {
        document.getElementById('totalMovements').textContent = this.stats.totalMovements;
        document.getElementById('totalObstacles').textContent = this.stats.totalObstacles;
        
        document.getElementById('statsTotalMovements').textContent = this.stats.totalMovements;
        document.getElementById('statsTotalObstacles').textContent = this.stats.totalObstacles;
        document.getElementById('statsActiveDevices').textContent = this.stats.activeDevices;
        document.getElementById('statsWsMessages').textContent = this.stats.wsMessages;
        document.getElementById('statsConnections').textContent = this.stats.connections;
    }

    startUptimeCounter() {
        setInterval(() => {
            const uptime = Math.floor((Date.now() - this.stats.startTime) / 1000);
            document.getElementById('statsUptime').textContent = `${uptime}s`;
        }, 1000);
    }

    showNotification(message, type) {
        const alertClass = {
            'success': 'alert-success',
            'danger': 'alert-danger', 
            'warning': 'alert-warning',
            'info': 'alert-info'
        }[type] || 'alert-info';

        const alertDiv = document.createElement('div');
        alertDiv.className = `alert ${alertClass} alert-dismissible fade show position-fixed`;
        alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 1050; min-width: 300px;';
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        document.body.appendChild(alertDiv);

        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 3000);
    }

    initializeEventListeners() {
        document.getElementById('connectBtn').addEventListener('click', () => {
            if (!this.isConnected) {
                this.connectSocketIO();
            }
        });

        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadMovementsHistory();
            this.loadObstaclesHistory();
            this.showNotification('Datos actualizados', 'info');
        });

        document.getElementById('clearBtn').addEventListener('click', () => {
            this.clearRealTimeData();
        });

        document.getElementById('deviceSelect').addEventListener('change', (e) => {
            this.currentDevice = parseInt(e.target.value);
            this.loadMovementsHistory();
            this.loadObstaclesHistory();
            this.showNotification(`Cambiado a: ${e.target.options[e.target.selectedIndex].text}`, 'info');
        });

        document.getElementById('autoRefresh').addEventListener('change', (e) => {
            this.toggleAutoRefresh(e.target.checked);
        });
    }

    toggleAutoRefresh(enabled) {
        if (enabled) {
            this.autoRefreshInterval = setInterval(() => {
                if (this.isConnected) {
                    this.loadMovementsHistory();
                    this.loadObstaclesHistory();
                }
            }, 10000);
        } else {
            if (this.autoRefreshInterval) {
                clearInterval(this.autoRefreshInterval);
            }
        }
    }
}
// Inicializar aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    new CarMonitoringApp();
});