class CarControlApp {
    constructor() {
        // IMPORTANTE: Cambia esta IP por la IP PÚBLICA de tu EC2
        this.apiBaseUrl = 'http://98.91.159.217:5500'; // CON puerto
        this.socket = null;
        this.isConnected = false;
        this.currentDevice = 1;
        this.isDemoRunning = false;
        
        this.initializeEventListeners();
        this.loadDevices();
        this.connectSocketIO();
    }

    initializeEventListeners() {
        // Botones de movimiento
        document.querySelectorAll('.movement-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const operation = parseInt(e.target.closest('button').dataset.operation);
                this.sendMovementCommand(operation);
            });
        });

        // Selector de dispositivo
        document.getElementById('deviceSelect').addEventListener('change', (e) => {
            const oldDevice = this.currentDevice;
            this.currentDevice = parseInt(e.target.value);
            
            // Desuscribirse del dispositivo anterior y suscribirse al nuevo
            if (this.socket && this.socket.connected) {
                this.socket.emit('unsubscribe_device', { device_id: oldDevice });
                this.socket.emit('subscribe_device', { device_id: this.currentDevice });
            }
            
            this.showAlert(`Cambiado a: ${e.target.options[e.target.selectedIndex].text}`, 'info');
        });

        // Botón modo demo
        document.getElementById('demoBtn').addEventListener('click', () => {
            if (!this.isDemoRunning) {
                this.startDemoMode();
            } else {
                this.showAlert('⚠️ Demo ya en ejecución', 'warning');
            }
        });

        // Botón detener emergencia
        document.getElementById('stopBtn').addEventListener('click', () => {
            this.isDemoRunning = false;
            this.sendMovementCommand(3);
            this.showAlert('🛑 PARADA DE EMERGENCIA ACTIVADA', 'danger');
        });
    }

    async loadDevices() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/devices`);
            const data = await response.json();
            
            if (data.status === 'success') {
                this.populateDeviceSelect(data.data);
                this.showWsMessage('✅ Dispositivos cargados correctamente', 'success');
            }
        } catch (error) {
            console.error('Error loading devices:', error);
            this.showAlert('⚠️ Error al cargar dispositivos. Usando dispositivo por defecto.', 'warning');
        }
    }

    populateDeviceSelect(devices) {
        const select = document.getElementById('deviceSelect');
        select.innerHTML = '';
        
        if (devices.length === 0) {
            const option = document.createElement('option');
            option.value = 1;
            option.textContent = 'Carro_Principal (ID: 1)';
            select.appendChild(option);
            return;
        }
        
        devices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.id_dispositivo;
            option.textContent = `${device.nombre_dispositivo} (ID: ${device.id_dispositivo})`;
            if (device.id_dispositivo === this.currentDevice) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    }

    connectSocketIO() {
        try {
            this.updateConnectionStatus('Conectando...', 'warning');
            this.showWsMessage('🔄 Intentando conectar al servidor...', 'info');
            
            this.socket = io(this.apiBaseUrl, {
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionAttempts: 5
            });

            this.socket.on('connect', () => {
                this.isConnected = true;
                this.updateConnectionStatus('Conectado ✅', 'success');
                this.showAlert('✅ Conectado al servidor IoT', 'success');
                this.showWsMessage('🔗 Socket.IO conectado exitosamente', 'success');
                
                // Suscribirse al dispositivo actual
                this.socket.emit('subscribe_device', { device_id: this.currentDevice });
            });

            this.socket.on('disconnect', () => {
                this.isConnected = false;
                this.updateConnectionStatus('Desconectado ❌', 'danger');
                this.showWsMessage('🔌 Conexión perdida. Reintentando...', 'warning');
            });

            this.socket.on('connect_error', (error) => {
                console.error('Connection error:', error);
                this.updateConnectionStatus('Error ❌', 'danger');
                this.showWsMessage('❌ Error de conexión. Verificando servidor...', 'danger');
            });

            this.socket.on('connection_response', (data) => {
                this.showWsMessage(`📡 ${data.message}`, 'info');
            });

            this.socket.on('subscription_response', (data) => {
                this.showWsMessage(`✅ ${data.message}`, 'success');
            });

            // Escuchar actualizaciones PUSH del servidor
            this.socket.on('command_update', (data) => {
                if (data.type === 'new_command' && data.data) {
                    const operationText = this.getOperationText(data.data.status_operacion);
                    this.showWsMessage(`🚗 Comando confirmado: ${operationText}`, 'success');
                }
            });

            this.socket.on('obstacle_update', (data) => {
                if (data.type === 'new_obstacle' && data.data) {
                    this.showWsMessage(`🛡️ Obstáculo detectado: ${data.data.status_texto}`, 'warning');
                }
            });

            this.socket.on('sequence_update', (data) => {
                this.showWsMessage(`🎬 Actualización de secuencia: ${data.type}`, 'info');
            });

            this.socket.on('execution_update', (data) => {
                this.showWsMessage(`▶️ Ejecución: ${data.type}`, 'info');
            });

        } catch (error) {
            console.error('Socket.IO error:', error);
            this.showAlert('❌ Error al inicializar Socket.IO', 'danger');
        }
    }

    async sendMovementCommand(operation) {
        if (!this.isConnected) {
            this.showAlert('❌ No conectado al servidor. Esperando conexión...', 'danger');
            return;
        }

        const commandData = {
            id_dispositivo: this.currentDevice,
            status_operacion: operation
        };

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/commands`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(commandData)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.status === 'success') {
                const operationText = this.getOperationText(operation);
                const deviceName = document.getElementById('deviceSelect').options[document.getElementById('deviceSelect').selectedIndex].text;
                this.showAlert(`✅ Comando enviado: ${operationText}`, 'success');
                this.showWsMessage(`📤 Enviado a ${deviceName}: ${operationText}`, 'info');
            } else {
                this.showAlert(`❌ Error: ${data.message}`, 'danger');
                this.showWsMessage(`❌ ${data.message}`, 'danger');
            }
        } catch (error) {
            console.error('Error sending command:', error);
            this.showAlert(`⚠️ Error al enviar comando: ${error.message}`, 'danger');
            this.showWsMessage(`❌ Error: ${error.message}`, 'danger');
        }
    }

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
            11: '⟲ Giro 360° izquierda'
        };
        return operations[operation] || `Operación ${operation}`;
    }

    async startDemoMode() {
        if (!this.isConnected) {
            this.showAlert('❌ No conectado al servidor', 'danger');
            return;
        }

        if (this.isDemoRunning) {
            return;
        }

        this.isDemoRunning = true;

        const demoSequence = [
            { op: 1, text: 'Adelante', delay: 2000 },
            { op: 8, text: 'Giro 90° derecha', delay: 2000 },
            { op: 1, text: 'Adelante', delay: 2000 },
            { op: 9, text: 'Giro 90° izquierda', delay: 2000 },
            { op: 1, text: 'Adelante', delay: 2000 },
            { op: 3, text: 'Detener', delay: 1000 }
        ];

        this.showAlert('🚀 INICIANDO MODO DEMO...', 'info');
        this.showWsMessage('🔧 Modo demo iniciado - Secuencia automática', 'info');

        for (let i = 0; i < demoSequence.length; i++) {
            if (!this.isDemoRunning) {
                this.showWsMessage('⏹️ Demo cancelado', 'warning');
                break;
            }

            const step = demoSequence[i];
            await this.sendMovementCommand(step.op);
            this.showWsMessage(`🔧 Demo [${i + 1}/${demoSequence.length}]: ${step.text}`, 'info');
            
            await new Promise(resolve => setTimeout(resolve, step.delay));
        }

        if (this.isDemoRunning) {
            this.showAlert('✅ MODO DEMO COMPLETADO', 'success');
            this.showWsMessage('✅ Secuencia demo finalizada', 'success');
        }

        this.isDemoRunning = false;
    }

    updateConnectionStatus(text, type) {
        const statusElement = document.getElementById('connectionStatus');
        const statusDisplayElement = document.getElementById('connectionStatusDisplay');
        
        const badgeClass = {
            'success': 'custom-badge',
            'warning': 'badge bg-warning',
            'danger': 'badge bg-danger',
            'info': 'badge bg-info'
        }[type] || 'badge bg-secondary';
        
        statusElement.className = badgeClass;
        statusElement.textContent = text;
        
        if (statusDisplayElement) {
            statusDisplayElement.className = badgeClass;
            statusDisplayElement.textContent = text;
        }
    }

    showAlert(message, type) {
        const container = document.getElementById('alertsContainer');
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        container.appendChild(alertDiv);
        
        // Auto-remover después de 5 segundos
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }

    showWsMessage(message, type) {
        const container = document.getElementById('wsMessages');
        
        // Si es el primer mensaje, limpiar el placeholder
        if (container.children.length === 1 && container.children[0].classList.contains('text-center')) {
            container.innerHTML = '';
        }
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `alert alert-${type} mb-2 fade-in`;
        messageDiv.innerHTML = `
            <small><strong>${new Date().toLocaleTimeString()}</strong></small><br>
            ${message}
        `;
        container.appendChild(messageDiv);
        container.scrollTop = container.scrollHeight;

        // Limitar a 50 mensajes
        if (container.children.length > 50) {
            container.removeChild(container.firstChild);
        }
    }
}

// Inicializar aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Iniciando Control Carro IoT...');
    new CarControlApp();
});