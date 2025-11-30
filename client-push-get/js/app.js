class CarMonitoringApp {
    constructor() {
        this.apiBaseUrl = 'http://98.91.159.217:5500';
        
        // ==========================================
        // WEBSOCKET CONFIGURATION
        // ==========================================
        this.WS_HOST = '98.91.159.217';
        this.WS_PORT = 5501;
        this.WS_PATH = '/client';
        this.WS_URL = `ws://${this.WS_HOST}:${this.WS_PORT}${this.WS_PATH}`;
        
        this.ws = null;
        this.isConnected = false;
        this.currentDevice = 1;
        
        // ==========================================
        // ESTADO ACTUAL DEL CARRO
        // ==========================================
        this.currentState = {
            lastMovement: 'Sin movimientos',
            lastMovementTime: '',
            lastObstacle: 'Sin obstáculos',
            lastObstacleTime: '',
            currentStatus: 'Desconectado',
            statusTimestamp: ''
        };
        
        // ==========================================
        // HISTORIALES
        // ==========================================
        this.movementsHistory = [];
        this.obstaclesHistory = [];
        
        // ==========================================
        // ESTADÍSTICAS
        // ==========================================
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
        console.log('🚀 Inicializando app de monitoreo...');
        this.hideRedundantSections();
        this.initializeEventListeners();
        this.connectWebSocket();
        this.loadInitialData();
        this.startUptimeCounter();
        this.initializeStatusUpdates();
    }

    // ==========================================
    // ✅ OCULTAR SECCIONES REDUNDANTES
    // ==========================================
    hideRedundantSections() {
        // Ocultar "Movimientos en Tiempo Real"
        const realTimeMovements = document.querySelector('#realTimeMovements')?.closest('.col-lg-6');
        if (realTimeMovements) {
            realTimeMovements.style.display = 'none';
            console.log('🗑️ Ocultando "Movimientos en Tiempo Real" (redundante)');
        }
        
        // Ocultar "Obstáculos Detectados"
        const realTimeObstacles = document.querySelector('#realTimeObstacles')?.closest('.col-lg-6');
        if (realTimeObstacles) {
            realTimeObstacles.style.display = 'none';
            console.log('🗑️ Ocultando "Obstáculos Detectados" (redundante)');
        }
    }

    // ==========================================
    // WEBSOCKET CONNECTION
    // ==========================================
    connectWebSocket() {
        console.log('🔌 Conectando a WebSocket...', this.WS_URL);
        
        try {
            this.ws = new WebSocket(this.WS_URL);
            
            this.ws.onopen = () => {
                console.log('✅ WebSocket conectado');
                this.isConnected = true;
                this.stats.connections++;
                this.updateConnectionStatus('Conectado ✅', 'success');
                this.updateCurrentStatus('Conectado - Carro Principal');
                this.showNotification('WebSocket conectado exitosamente', 'success');
                
                // Cargar datos iniciales
                setTimeout(() => this.loadInitialData(), 500);
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('📨 WebSocket:', data);
                    this.stats.wsMessages++;
                    this.updateStats();
                    
                    this.handleWebSocketMessage(data);
                    
                } catch (e) {
                    console.error('❌ Error procesando mensaje:', e);
                }
            };
            
            this.ws.onerror = (error) => {
                console.error('❌ WebSocket error:', error);
                this.isConnected = false;
                this.updateConnectionStatus('Error ❌', 'danger');
                this.updateCurrentStatus('Error de conexión');
            };
            
            this.ws.onclose = (event) => {
                console.log('🔌 WebSocket desconectado');
                this.isConnected = false;
                this.updateConnectionStatus('Desconectado', 'secondary');
                this.updateCurrentStatus('Desconectado');
                
                // Reconectar después de 5 segundos
                setTimeout(() => {
                    console.log('🔄 Intentando reconectar...');
                    this.connectWebSocket();
                }, 5000);
            };
            
        } catch (error) {
            console.error('❌ Error creando WebSocket:', error);
            this.isConnected = false;
            this.updateConnectionStatus('Error ❌', 'danger');
        }
    }

    // ==========================================
    // ✅ MANEJO DE MENSAJES WEBSOCKET - CORREGIDO
    // ==========================================
    handleWebSocketMessage(data) {
        const type = data.type || data.event;
        
        // ========== COMANDO EJECUTADO ==========
        if (type === 'command_executed') {
            console.log('🚗 Comando ejecutado:', data);
            
            const operationText = this.getOperationText(data.operation || data.command);
            const deviceName = `Dispositivo ${data.device_id || this.currentDevice}`;
            
            // Actualizar estado actual
            this.updateCurrentMovement(operationText);
            
            // Agregar al historial
            this.movementsHistory.unshift({
                id_evento: Date.now(),
                fecha_hora: new Date().toISOString(),
                status_texto: operationText,
                nombre_dispositivo: deviceName,
                id_dispositivo: data.device_id || this.currentDevice,
                status_operacion: data.operation
            });
            
            // Mantener solo últimos 20
            if (this.movementsHistory.length > 20) {
                this.movementsHistory = this.movementsHistory.slice(0, 20);
            }
            
            this.stats.totalMovements++;
            this.updateStats();
            this.renderMovementsHistory();
        }
        
        // ========== OBSTÁCULO DETECTADO ==========
        else if (type === 'obstacle_detected') {
            console.log('🛑 Obstáculo detectado:', data);
            
            const obstacleText = `Obstáculo a ${data.distance || 0}cm`;
            const deviceName = `Dispositivo ${data.device_id || this.currentDevice}`;
            
            // Actualizar estado actual
            this.updateCurrentObstacle(obstacleText);
            
            // Agregar al historial
            this.obstaclesHistory.unshift({
                id_evento: Date.now(),
                fecha_hora: new Date().toISOString(),
                status_texto: obstacleText,
                nombre_dispositivo: deviceName,
                id_dispositivo: data.device_id || this.currentDevice,
                ubicacion: data.location || 'front',
                distancia_detectada: data.distance || 0,
                automatico: true
            });
            
            // Mantener solo últimos 20
            if (this.obstaclesHistory.length > 20) {
                this.obstaclesHistory = this.obstaclesHistory.slice(0, 20);
            }
            
            this.stats.totalObstacles++;
            this.updateStats();
            this.renderObstaclesHistory();
        }
        
        // ========== HEARTBEAT ==========
        else if (type === 'car_heartbeat') {
            // Solo actualizar estado si es necesario
            if (data.battery) {
                // Podrías mostrar batería si quisieras
            }
        }
        
        // ========== ESTADO DEL CARRO ==========
        else if (type === 'car_status') {
            if (data.status === 'connected') {
                this.updateCurrentStatus('Conectado - Carro Principal');
            } else {
                this.updateCurrentStatus('Desconectado');
            }
        }
    }

    // ==========================================
    // ✅ ACTUALIZAR ESTADO ACTUAL - CORREGIDO
    // ==========================================
    updateCurrentMovement(operationText) {
        this.currentState.lastMovement = operationText;
        this.currentState.lastMovementTime = new Date().toLocaleTimeString();
        this.renderCurrentStatus();
    }

    updateCurrentObstacle(obstacleText) {
        this.currentState.lastObstacle = obstacleText;
        this.currentState.lastObstacleTime = new Date().toLocaleTimeString();
        this.renderCurrentStatus();
    }

    updateCurrentStatus(status) {
        this.currentState.currentStatus = status;
        this.currentState.statusTimestamp = new Date().toLocaleTimeString();
        this.renderCurrentStatus();
    }

    // ==========================================
    // ✅ RENDERIZAR ESTADO ACTUAL - CORREGIDO
    // ==========================================
    renderCurrentStatus() {
        // Último movimiento
        const movementElement = document.getElementById('lastMovement');
        const movementTimeElement = document.getElementById('lastMovementTime');
        
        if (movementElement && movementTimeElement) {
            movementElement.innerHTML = `<span class="text-success fw-bold">${this.currentState.lastMovement}</span>`;
            movementTimeElement.textContent = `Hora: ${this.currentState.lastMovementTime}`;
        }

        // Último obstáculo
        const obstacleElement = document.getElementById('lastObstacle');
        const obstacleTimeElement = document.getElementById('lastObstacleTime');
        
        if (obstacleElement && obstacleTimeElement) {
            obstacleElement.innerHTML = `<span class="text-warning fw-bold">${this.currentState.lastObstacle}</span>`;
            obstacleTimeElement.textContent = `Hora: ${this.currentState.lastObstacleTime}`;
        }

        // Estado actual
        const statusElement = document.getElementById('currentStatus');
        const statusTimeElement = document.getElementById('statusTimestamp');
        
        if (statusElement && statusTimeElement) {
            const statusBadge = this.isConnected ? 
                '<span class="badge bg-success">Conectado</span>' :
                '<span class="badge bg-secondary">Desconectado</span>';
            
            statusElement.innerHTML = statusBadge;
            statusTimeElement.textContent = `Actualizado: ${this.currentState.statusTimestamp}`;
        }
    }

    // ==========================================
    // ✅ RENDERIZAR HISTORIAL DE MOVIMIENTOS - CORREGIDO
    // ==========================================
    renderMovementsHistory() {
        const container = document.getElementById('movementsHistory');
        
        if (!container) {
            console.log('❌ No se encontró movementsHistory');
            return;
        }
        
        if (!this.movementsHistory || this.movementsHistory.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="bi bi-inbox display-6"></i>
                    <p class="mt-2">No hay movimientos registrados</p>
                </div>
            `;
            return;
        }

        console.log('📊 Renderizando movimientos:', this.movementsHistory.length);

        let html = '';
        this.movementsHistory.forEach(movement => {
            const date = new Date(movement.fecha_hora).toLocaleString();
            const operationClass = this.getMovementClass(movement.status_operacion);
            
            html += `
                <div class="message-item ${operationClass} fade-in">
                    <div class="message-header">
                        <span class="message-time">${date}</span>
                        <span class="message-type movement">
                            ${movement.status_texto}
                        </span>
                    </div>
                    <p class="message-content mb-0">
                        <strong>${movement.nombre_dispositivo}</strong><br>
                        ${movement.status_texto}
                    </p>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    // ==========================================
    // ✅ RENDERIZAR HISTORIAL DE OBSTÁCULOS - CORREGIDO
    // ==========================================
    renderObstaclesHistory() {
        const container = document.getElementById('obstaclesHistory');
        
        if (!container) {
            console.log('❌ No se encontró obstaclesHistory');
            return;
        }
        
        if (!this.obstaclesHistory || this.obstaclesHistory.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="bi bi-shield-check display-6"></i>
                    <p class="mt-2">No hay obstáculos detectados</p>
                </div>
            `;
            return;
        }

        console.log('📊 Renderizando obstáculos:', this.obstaclesHistory.length);

        let html = '';
        this.obstaclesHistory.forEach(obstacle => {
            const date = new Date(obstacle.fecha_hora).toLocaleString();
            const distancia = obstacle.distancia_detectada || 'N/A';
            
            html += `
                <div class="message-item obstacle fade-in">
                    <div class="message-header">
                        <span class="message-time">${date}</span>
                        <span class="message-type obstacle">
                            🛑 OBSTÁCULO
                        </span>
                    </div>
                    <p class="message-content mb-0">
                        <strong>${obstacle.nombre_dispositivo}</strong><br>
                        ${obstacle.status_texto}
                        ${distancia !== 'N/A' ? `<br><small class="text-muted">Distancia: ${distancia} cm</small>` : ''}
                    </p>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    // ==========================================
    // CARGAR DATOS HTTP INICIALES
    // ==========================================
    async loadInitialData() {
        console.log('📡 Cargando datos iniciales...');
        await this.checkApiStatus();
        await this.loadMovementsFromAPI();
        await this.loadObstaclesFromAPI();
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

    async loadMovementsFromAPI() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/commands?device_id=${this.currentDevice}&limit=20`);
            const data = await response.json();
            
            if (data.status === 'success' && data.data) {
                this.movementsHistory = data.data;
                this.stats.totalMovements = data.data.length;
                this.updateStats();
                this.renderMovementsHistory();
                
                // Actualizar último movimiento si existe
                if (data.data.length > 0) {
                    const latest = data.data[0];
                    this.updateCurrentMovement(latest.status_texto);
                }
            }
        } catch (error) {
            console.error('❌ Error cargando movimientos:', error);
        }
    }

    async loadObstaclesFromAPI() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/obstacles?device_id=${this.currentDevice}&limit=20`);
            const data = await response.json();
            
            if (data.status === 'success' && data.data) {
                this.obstaclesHistory = data.data;
                this.stats.totalObstacles = data.data.length;
                this.updateStats();
                this.renderObstaclesHistory();
                
                // Actualizar último obstáculo si existe
                if (data.data.length > 0) {
                    const latest = data.data[0];
                    this.updateCurrentObstacle(latest.status_texto);
                }
            }
        } catch (error) {
            console.error('❌ Error cargando obstáculos:', error);
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
            console.error('❌ Error cargando estadísticas:', error);
        }
    }

    // ==========================================
    // HELPERS
    // ==========================================
    getOperationText(operation) {
        const operations = {
            1: '🚗 Adelante',
            2: '🚗 Atrás',
            3: '🛑 Detener',
            4: '↗️ Vuelta Adelante Der.',
            5: '↖️ Vuelta Adelante Izq.',
            6: '↘️ Vuelta Atrás Der.',
            7: '↙️ Vuelta Atrás Izq.',
            8: '↷ Giro 90° Derecha',
            9: '↶ Giro 90° Izquierda',
            10: '⟳ Giro 360° Derecha',
            11: '⟲ Giro 360° Izquierda',
            'forward': '🚗 Adelante',
            'backward': '🚗 Atrás',
            'stop': '🛑 Detener',
            'turn_right': '↷ Giro 90° Derecha',
            'turn_left': '↶ Giro 90° Izquierda'
        };
        return operations[operation] || `Operación ${operation}`;
    }

    getMovementClass(operation) {
        if ([1, 2, 'forward', 'backward'].includes(operation)) return 'movement';
        if ([3, 'stop'].includes(operation)) return 'system';
        return 'movement';
    }

    updateConnectionStatus(text, type) {
        const element = document.getElementById('wsStatus');
        const badgeClass = {
            'success': 'bg-success',
            'warning': 'bg-warning',
            'danger': 'bg-danger',
            'secondary': 'bg-secondary'
        }[type] || 'bg-secondary';
        
        if (element) {
            element.innerHTML = `<span class="badge ${badgeClass}">${text}</span>`;
        }
    }

    updateStats() {
        const elements = {
            'totalMovements': this.stats.totalMovements,
            'totalObstacles': this.stats.totalObstacles,
            'statsTotalMovements': this.stats.totalMovements,
            'statsTotalObstacles': this.stats.totalObstacles,
            'statsActiveDevices': this.stats.activeDevices,
            'statsWsMessages': this.stats.wsMessages,
            'statsConnections': this.stats.connections
        };
        
        Object.entries(elements).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });
    }

    startUptimeCounter() {
        setInterval(() => {
            const uptime = Math.floor((Date.now() - this.stats.startTime) / 1000);
            const el = document.getElementById('statsUptime');
            if (el) el.textContent = `${uptime}s`;
        }, 1000);
    }

    initializeStatusUpdates() {
        setInterval(() => {
            this.renderCurrentStatus();
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

    // ==========================================
    // EVENT LISTENERS
    // ==========================================
    initializeEventListeners() {
        const connectBtn = document.getElementById('connectBtn');
        if (connectBtn) {
            connectBtn.addEventListener('click', () => {
                this.connectWebSocket();
            });
        }

        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.loadMovementsFromAPI();
                this.loadObstaclesFromAPI();
                this.showNotification('Datos actualizados', 'info');
            });
        }

        const clearBtn = document.getElementById('clearBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.movementsHistory = [];
                this.obstaclesHistory = [];
                this.renderMovementsHistory();
                this.renderObstaclesHistory();
                this.showNotification('Logs limpiados', 'info');
            });
        }

        const deviceSelect = document.getElementById('deviceSelect');
        if (deviceSelect) {
            deviceSelect.addEventListener('change', (e) => {
                this.currentDevice = parseInt(e.target.value);
                this.loadMovementsFromAPI();
                this.loadObstaclesFromAPI();
                this.showNotification(`Cambiado a: ${e.target.options[e.target.selectedIndex].text}`, 'info');
            });
        }

        const autoRefresh = document.getElementById('autoRefresh');
        if (autoRefresh) {
            autoRefresh.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.autoRefreshInterval = setInterval(() => {
                        if (this.isConnected) {
                            this.loadMovementsFromAPI();
                            this.loadObstaclesFromAPI();
                        }
                    }, 10000);
                } else {
                    if (this.autoRefreshInterval) {
                        clearInterval(this.autoRefreshInterval);
                    }
                }
            });
        }
    }
}

// Inicializar aplicación
document.addEventListener('DOMContentLoaded', () => {
    window.monitoringApp = new CarMonitoringApp();
    console.log('✅ App de monitoreo inicializada');
});
