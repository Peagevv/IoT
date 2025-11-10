class CarMonitoringApp {
    constructor() {
        this.apiBaseUrl = 'http://98.91.159.217:5500';
       this.socket = io('wss://98.91.159.217:5500');// Cambiar de WebSocket a Socket.IO
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
        this.connectSocketIO();  // Cambiar a Socket.IO
        this.loadInitialData();
        this.startUptimeCounter();
    }

    // CAMBIAR: Reemplazar connectWebSocket por connectSocketIO
    connectSocketIO() {
        if (this.isConnected) {
            this.showNotification('Ya estás conectado al servidor', 'info');
            return;
        }

        try {
            this.updateConnectionStatus('Conectando...', 'warning');
            
            // Usar Socket.IO en lugar de WebSocket nativo
            this.socket = io(this.apiBaseUrl, {
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionDelay: 1000
            });

            this.socket.on('connect', () => {
                this.isConnected = true;
                this.stats.connections++;
                this.updateConnectionStatus('Conectado ✅', 'success');
                this.addRealTimeMessage('🔗 Sistema de monitoreo conectado', 'system');
                this.showNotification('Socket.IO conectado exitosamente', 'success');
                
                // Suscribirse al dispositivo actual
                this.socket.emit('subscribe_device', { device_id: this.currentDevice });
            });

            this.socket.on('disconnect', () => {
                this.isConnected = false;
                this.updateConnectionStatus('Desconectado', 'secondary');
                this.addRealTimeMessage('🔌 Desconectado del servidor', 'system');
            });

            this.socket.on('connect_error', (error) => {
                this.updateConnectionStatus('Error ❌', 'danger');
                this.addRealTimeMessage('❌ Error en la conexión', 'system');
                console.error('Socket.IO error:', error);
            });

            // ==================== ESCUCHAR EVENTOS DEL APP CONTROL ====================
            
            // Comandos del carro
            this.socket.on('command_update', (data) => {
                this.stats.wsMessages++;
                this.updateStats();
                
                if (data.type === 'new_command') {
                    this.handleCommandUpdate(data.data);
                }
            });

            // Obstáculos
            this.socket.on('obstacle_update', (data) => {
                this.stats.wsMessages++;
                this.updateStats();
                
                if (data.type === 'new_obstacle' || data.type === 'manual_obstacle_created') {
                    this.handleObstacleUpdate(data.data);
                }
            });

            // Secuencias
            this.socket.on('sequence_update', (data) => {
                this.stats.wsMessages++;
                this.updateStats();
                
                if (data.type === 'sequence_created' || data.type === 'sequence_updated') {
                    this.handleSequenceUpdate(data.data);
                }
            });

            // Ejecuciones
            this.socket.on('execution_update', (data) => {
                this.stats.wsMessages++;
                this.updateStats();
                
                if (data.type === 'execution_started') {
                    this.handleExecutionUpdate(data.data);
                }
            });

            // Respuestas del servidor
            this.socket.on('connection_response', (data) => {
                this.addRealTimeMessage(`📡 ${data.message}`, 'system');
            });

            this.socket.on('subscription_response', (data) => {
                this.addRealTimeMessage(`✅ ${data.message}`, 'system');
            });

        } catch (error) {
            console.error('Socket.IO connection error:', error);
            this.showNotification('Error al conectar Socket.IO', 'danger');
        }
    }

    // ==================== MANEJAR EVENTOS ESPECÍFICOS ====================

    handleCommandUpdate(commandData) {
        const operationText = this.getOperationText(commandData.status_operacion);
        const deviceName = this.getDeviceName(commandData.id_dispositivo);
        
        this.addRealTimeMovement(
            `🚗 ${deviceName} - ${operationText}`,
            commandData.status_operacion
        );
        
        // Actualizar estadísticas
        this.stats.totalMovements++;
        this.updateStats();
        
        // Recargar historial después de un breve delay
        setTimeout(() => this.loadMovementsHistory(), 500);
    }

    handleObstacleUpdate(obstacleData) {
        const deviceName = this.getDeviceName(obstacleData.id_dispositivo);
        const obstacleText = this.getObstacleText(obstacleData.status_obstaculo);
        
        this.addRealTimeObstacle(
            `⚠️ ${deviceName} - ${obstacleText}`,
            obstacleData.status_obstaculo
        );
        
        // Actualizar estadísticas
        this.stats.totalObstacles++;
        this.updateStats();
        
        // Recargar historial después de un breve delay
        setTimeout(() => this.loadObstaclesHistory(), 500);
    }

    handleSequenceUpdate(sequenceData) {
        this.addRealTimeMessage(
            `📋 Secuencia "${sequenceData.nombre_secuencia}" actualizada`,
            'system'
        );
    }

    handleExecutionUpdate(executionData) {
        this.addRealTimeMessage(
            `🎬 Ejecutando secuencia: ${executionData.id_secuencia}`,
            'system'
        );
    }

    // ==================== ACTUALIZAR EVENT LISTENER PARA CAMBIAR DISPOSITIVO ====================

    initializeEventListeners() {
        document.getElementById('connectBtn').addEventListener('click', () => {
            this.connectSocketIO();  // Cambiado a Socket.IO
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
            const oldDevice = this.currentDevice;
            this.currentDevice = parseInt(e.target.value);
            
            // Cambiar suscripción en WebSocket
            if (this.socket && this.socket.connected) {
                this.socket.emit('unsubscribe_device', { device_id: oldDevice });
                this.socket.emit('subscribe_device', { device_id: this.currentDevice });
            }
            
            this.loadMovementsHistory();
            this.loadObstaclesHistory();
            this.showNotification(`Cambiado a: ${e.target.options[e.target.selectedIndex].text}`, 'info');
        });

        document.getElementById('autoRefresh').addEventListener('change', (e) => {
            this.toggleAutoRefresh(e.target.checked);
        });
    }

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
                fetch(`${this.apiBaseUrl}/api/commands`),
                fetch(`${this.apiBaseUrl}/api/obstacles`),
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

    getMovementTypeClass(operation) {
        if ([1, 2].includes(operation)) return 'movement'; // Movimiento básico
        if (operation === 3) return 'system'; // Detener
        if ([8, 9, 10, 11].includes(operation)) return 'movement'; // Giros
        return 'system'; // Otros
    }

    getObstacleTypeClass(obstacle) {
        if ([1, 2, 3].includes(obstacle)) return 'obstacle'; // Obstáculos normales
        if ([4, 5].includes(obstacle)) return 'emergency'; // Obstáculos críticos
        return 'obstacle';
    }

    getOperationText(operation) {
        const operations = {
            1: 'Adelante', 2: 'Atrás', 3: 'Detener',
            4: 'Vuelta adelante derecha', 5: 'Vuelta adelante izquierda',
            6: 'Vuelta atrás derecha', 7: 'Vuelta atrás izquierda',
            8: 'Giro 90° derecha', 9: 'Giro 90° izquierda',
            10: 'Giro 360° derecha', 11: 'Giro 360° izquierda'
        };
        return operations[operation] || `Operación ${operation}`;
    }

    getObstacleText(obstacle) {
        const obstacles = {
            1: 'Obstáculo adelante',
            2: 'Obstáculo adelante-izquierda', 
            3: 'Obstáculo adelante-derecha',
            4: 'Obstáculo múltiple',
            5: 'Retroceder - Obstáculo crítico'
        };
        return obstacles[obstacle] || `Obstáculo ${obstacle}`;
    }

    getDeviceName(deviceId) {
        const select = document.getElementById('deviceSelect');
        const option = select.querySelector(`option[value="${deviceId}"]`);
        return option ? option.textContent : `Dispositivo ${deviceId}`;
    }

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

    toggleAutoRefresh(enabled) {
        if (enabled) {
            this.autoRefreshInterval = setInterval(() => {
                if (this.isConnected) {
                    this.loadMovementsHistory();
                    this.loadObstaclesHistory();
                }
            }, 10000); // Actualizar cada 10 segundos
        } else {
            if (this.autoRefreshInterval) {
                clearInterval(this.autoRefreshInterval);
            }
        }
    }

    showNotification(message, type) {
        // Crear notificación toast simple
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

        // Auto-remover después de 3 segundos
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 3000);
    }
}

// Inicializar aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    new CarMonitoringApp();
});