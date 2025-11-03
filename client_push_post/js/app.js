class CarControlApp {
    constructor() {
        // ✅ CONFIGURACIÓN UNIFICADA
        this.apiBaseUrl = 'http://98.91.159.217:5500';
        this.socket = null;
        this.isConnected = false;
        this.currentDevice = 1;
        this.devices = [];
        this.commandsCount = 0;
        this.startTime = Date.now();
        
        // Inicializar obstáculos
        this.obstacleHistory = [];
        this.obstacleCount = 0;
        this.lastObstacleResult = null;
        
        // Inicializar
        console.log('🚀 Inicializando CarControlApp...');
        this.initializeEventListeners();
        this.loadDevices();
        this.connectSocketIO();
        this.startCounters();
    }

    // ========== WEBSOCKET CON SOCKET.IO ==========
    
    connectSocketIO() {
        try {
            console.log('🔌 Conectando a Socket.IO:', this.apiBaseUrl);
            
            this.socket = io(this.apiBaseUrl, {
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionAttempts: 10
            });

            this.socket.on('connect', () => {
                this.isConnected = true;
                this.updateConnectionStatus('Conectado ✅', 'success');
                this.showAlert('✅ Conectado al servidor IoT', 'success');
                this.showWsMessage('🔗 Socket.IO conectado - Listo para controlar', 'success');
                console.log('✅ Socket.IO conectado:', this.socket.id);
            });

            this.socket.on('connection_status', (data) => {
                this.showWsMessage(`📡 ${data.message}`, 'info');
            });

            this.socket.on('command_confirmation', (data) => {
                if (data.status === 'success') {
                    this.showWsMessage(`✅ ${data.message}`, 'success');
                } else {
                    this.showWsMessage(`❌ ${data.message}`, 'danger');
                }
            });

            // Escuchar movimientos de OTRAS apps
            this.socket.on('movement_command', (data) => {
                const movement = data.data;
                this.showWsMessage(
                    `🚗 Movimiento detectado: ${movement.status_texto} (${movement.nombre_dispositivo})`,
                    'info'
                );
            });

            // Escuchar obstáculos de OTRAS apps
            this.socket.on('obstacle_detected', (data) => {
                const obstacle = data.data;
                this.showWsMessage(
                    `🚨 Obstáculo detectado: ${obstacle.status_texto} (${obstacle.nombre_dispositivo})`,
                    'warning'
                );
            });

            this.socket.on('disconnect', () => {
                this.isConnected = false;
                this.updateConnectionStatus('Desconectado', 'secondary');
                this.showWsMessage('🔌 Socket.IO desconectado', 'secondary');
                console.log('❌ Socket.IO desconectado');
            });

            this.socket.on('connect_error', (error) => {
                this.updateConnectionStatus('Error ❌', 'danger');
                this.showWsMessage('❌ Error de conexión Socket.IO', 'danger');
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
            this.showAlert('❌ Error al conectar Socket.IO', 'danger');
        }
    }

    // ========== ENVÍO DE COMANDOS ==========
    
    async sendMovementCommand(operation) {
        console.log('📤 Enviando movimiento:', operation);
        
        if (!this.isConnected) {
            this.showAlert('❌ No conectado al servidor.', 'danger');
            return;
        }

        const operationText = this.getOperationText(operation);
        const deviceName = document.getElementById('deviceSelect')?.options[document.getElementById('deviceSelect').selectedIndex]?.text || 'Carro_Principal';
        
        this.showWsMessage(`✅ ${deviceName}: ${operationText}`, 'success');
        this.showAlert(`✅ Comando enviado: ${operationText}`, 'success');
        
        this.commandsCount++;
        document.getElementById('commandsCount').textContent = this.commandsCount;

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/movement`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id_dispositivo: this.currentDevice,
                    status_operacion: operation
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }

            const data = await response.json();
            console.log('✅ Respuesta del servidor:', data);
            
            if (data.status === 'success') {
                this.showWsMessage('✅ Movimiento registrado en servidor', 'success');
            }

        } catch (error) {
            console.error('❌ Error enviando movimiento:', error);
            this.showAlert('⚠️ Error al enviar comando: ' + error.message, 'warning');
        }
    }

    async sendObstacle() {
        console.log('📤 Enviando obstáculo...');
        
        if (!this.isConnected) {
            this.showAlert('❌ No conectado al servidor.', 'danger');
            return;
        }

        const tipo = document.getElementById('tipoObstaculo')?.value || "Izquierda";
        const deviceName = document.getElementById('deviceSelect')?.options[document.getElementById('deviceSelect').selectedIndex]?.text || 'Carro_Principal';
        
        let resultado;
        let alertType;
        
        switch(tipo) {
            case 'Izquierda':
                resultado = "Giro a la derecha realizado";
                alertType = 'warning';
                break;
            case 'Derecha':
                resultado = "Giro a la izquierda realizado";
                alertType = 'warning';
                break;
            case 'Frente':
                resultado = "Marcha atrás realizada";
                alertType = 'danger';
                break;
            case 'Atrás':
                resultado = "Aceleración hacia adelante";
                alertType = 'info';
                break;
            default:
                resultado = "Ruta despejada";
                alertType = 'success';
        }

        this.showAlert(`🚨 Obstáculo ${tipo} detectado: ${resultado}`, alertType);
        this.showWsMessage(`🚨 ${deviceName}: Obstáculo ${tipo} - ${resultado}`, alertType);

        this.commandsCount++;
        document.getElementById('commandsCount').textContent = this.commandsCount;

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/obstacle`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({
                    id_dispositivo: this.currentDevice,
                    tipo_obstaculo: tipo,
                    movimiento_realizado: resultado,
                    resultado: resultado
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }

            const data = await response.json();
            console.log('✅ Respuesta del servidor:', data);
            
            if (data.status === 'success') {
                this.showAlert('✅ Obstáculo registrado correctamente', 'success');
                this.showWsMessage('✅ Obstáculo registrado en servidor', 'success');
            }

        } catch (error) {
            console.error('❌ Error enviando obstáculo:', error);
            this.showAlert('⚠️ Error al registrar obstáculo: ' + error.message, 'warning');
        }
    }

    // ========== MÉTODOS AUXILIARES ==========

    getOperationText(operation) {
        const operations = {
            1: '🚗 Adelante', 
            2: '🚗 Atrás', 
            3: '🛑 Detener',
            4: '↗️ Vuelta adelante derecha', 
            5: '↖️ Vuelta adelante izquierda',
            6: '↘️ Vuelta atrás derecha', 
            7: '↙️ Vuelta atrás izquierda',
            8: '↷ Giro 90° derecha', 
            9: '↶ Giro 90° izquierda',
            10: '⟳ Giro 360° derecha', 
            11: '⟲ Giro 360° izquierda',
            12: '⭐ Movimiento Especial'
        };
        return operations[operation] || `Operación ${operation}`;
    }

    async loadDevices() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/devices`);
            const data = await response.json();
            
            if (data.status === 'success') {
                this.devices = data.data;
                this.populateDeviceSelect(this.devices);
                console.log('✅ Dispositivos cargados:', this.devices);
            }
        } catch (error) {
            console.error('⚠️ Error loading devices:', error);
            this.devices = [{
                id_dispositivo: 1,
                nombre_dispositivo: 'Carro_Principal'
            }];
            this.populateDeviceSelect(this.devices);
        }
    }

    populateDeviceSelect(devices) {
        const select = document.getElementById('deviceSelect');
        if (!select) return;
        
        select.innerHTML = '';
        
        if (devices && devices.length > 0) {
            devices.forEach(device => {
                const option = document.createElement('option');
                option.value = device.id_dispositivo;
                option.textContent = device.nombre_dispositivo;
                if (device.id_dispositivo === this.currentDevice) option.selected = true;
                select.appendChild(option);
            });
        } else {
            const option = document.createElement('option');
            option.value = 1;
            option.textContent = 'Carro_Principal';
            select.appendChild(option);
        }
    }

    updateConnectionStatus(text, type) {
        const statusElements = document.querySelectorAll('#connectionStatus');
        const badgeClass = {
            'success': 'bg-success status-connected',
            'warning': 'bg-warning',
            'danger': 'bg-danger',
            'secondary': 'bg-secondary'
        }[type] || 'bg-secondary';
        
        statusElements.forEach(element => {
            element.className = `badge ${badgeClass}`;
            element.textContent = text;
        });
    }

    showAlert(message, type) {
        const container = document.getElementById('alertsContainer');
        if (!container) {
            console.warn('⚠️ alertsContainer no encontrado');
            return;
        }
        
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        container.appendChild(alertDiv);
        
        setTimeout(() => {
            if (alertDiv.parentNode) alertDiv.remove();
        }, 5000);
    }

    showWsMessage(message, type) {
        const container = document.getElementById('wsMessages');
        if (!container) {
            console.warn('⚠️ wsMessages no encontrado');
            return;
        }
        
        if (container.children.length === 1 && container.children[0].classList.contains('text-center')) {
            container.innerHTML = '';
        }
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `alert alert-${type} mb-2 fade-in`;
        messageDiv.innerHTML = `
            <small>${new Date().toLocaleTimeString()}</small><br>
            ${message}
        `;
        container.appendChild(messageDiv);
        container.scrollTop = container.scrollHeight;

        if (container.children.length > 50) {
            container.removeChild(container.firstChild);
        }
    }

    initializeEventListeners() {
        console.log('🎧 Inicializando event listeners...');
        
        // Botones de movimiento
        document.querySelectorAll('.movement-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const operation = parseInt(e.target.closest('button').dataset.operation);
                console.log('🎮 Botón presionado:', operation);
                this.sendMovementCommand(operation);
            });
        });

        // Selector de dispositivo
        const deviceSelect = document.getElementById('deviceSelect');
        if (deviceSelect) {
            deviceSelect.addEventListener('change', (e) => {
                this.currentDevice = parseInt(e.target.value);
                const device = this.devices.find(d => d.id_dispositivo === this.currentDevice);
                this.showAlert(`Cambiado a: ${device ? device.nombre_dispositivo : 'Carro_Principal'}`, 'info');
            });
        }

        // Botón obstáculo
        const obstacleBtn = document.getElementById('sendObstacleBtn');
        if (obstacleBtn) {
            obstacleBtn.addEventListener('click', () => {
                console.log('🚧 Botón obstáculo presionado');
                this.sendObstacle();
            });
        }

        // Botón stop
        const stopBtn = document.getElementById('stopBtn');
        if (stopBtn) {
            stopBtn.addEventListener('click', () => {
                console.log('🛑 STOP presionado');
                this.sendMovementCommand(3);
                this.showAlert('🛑 PARADA DE EMERGENCIA ACTIVADA', 'danger');
            });
        }

        // Botones de demo (si existen)
        const demoBtn = document.getElementById('demoBtn');
        if (demoBtn) {
            demoBtn.addEventListener('click', () => {
                this.showAlert('ℹ️ Funcionalidad de demo en desarrollo', 'info');
            });
        }

        const manageDemosBtn = document.getElementById('manageDemosBtn');
        if (manageDemosBtn) {
            manageDemosBtn.addEventListener('click', () => {
                this.showAlert('ℹ️ Gestión de demos en desarrollo', 'info');
            });
        }

        const createDemoBtn = document.getElementById('createDemoBtn');
        if (createDemoBtn) {
            createDemoBtn.addEventListener('click', () => {
                this.showAlert('ℹ️ Crear demo en desarrollo', 'info');
            });
        }

        const manageCarsBtn = document.getElementById('manageCarsBtn');
        if (manageCarsBtn) {
            manageCarsBtn.addEventListener('click', () => {
                this.showAlert('ℹ️ Gestión de carros en desarrollo', 'info');
            });
        }

        console.log('✅ Event listeners inicializados');
    }

    startCounters() {
        setInterval(() => {
            const uptime = Math.floor((Date.now() - this.startTime) / 1000);
            const uptimeElement = document.getElementById('uptimeCounter');
            if (uptimeElement) {
                uptimeElement.textContent = `${uptime}s`;
            }
        }, 1000);
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    console.log('🌐 DOM cargado, iniciando app...');
    window.app = new CarControlApp();
    console.log('✅ App inicializada:', window.app);
});