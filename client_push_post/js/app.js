class CarControlApp {
    constructor() {
        this.apiBaseUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent('http://98.91.159.217:5500');
        this.wsUrl = null;
        this.ws = null;
        this.isConnected = false;
        this.currentDevice = 1; // Carro_Principal por defecto
        
        this.initializeEventListeners();
        this.loadDevices();
        this.connectWebSocket();
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
            this.currentDevice = parseInt(e.target.value);
            this.showAlert(`Cambiado a: ${e.target.options[e.target.selectedIndex].text}`, 'info');
        });

        // Botón modo demo
        document.getElementById('demoBtn').addEventListener('click', () => {
            this.startDemoMode();
        });

        // Botón detener emergencia
        document.getElementById('stopBtn').addEventListener('click', () => {
            this.sendMovementCommand(3); // Detener
            this.showAlert('🛑 PARADA DE EMERGENCIA ACTIVADA', 'danger');
        });
    }

    async loadDevices() {
        try {
            console.log('Cargando dispositivos desde:', `${this.apiBaseUrl}/api/devices`);
            
            const response = await fetch(`${this.apiBaseUrl}/api/devices`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const text = await response.text();
            console.log('Respuesta dispositivos:', text);
            
            let data;
            try {
                data = JSON.parse(text);
            } catch (parseError) {
                throw new Error(`Error parseando JSON: ${parseError.message}`);
            }
            
            if (data.status === 'success') {
                this.populateDeviceSelect(data.data);
                this.showAlert('Dispositivos cargados correctamente', 'success');
            } else {
                throw new Error(`Error del servidor: ${data.message || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error loading devices:', error);
            this.showAlert('Error al cargar dispositivos: ' + error.message, 'danger');
            // Cargar dispositivo por defecto
            this.populateDeviceSelect();
        }
    }

    populateDeviceSelect(devices = null) {
        const select = document.getElementById('deviceSelect');
        select.innerHTML = '';
        
        if (devices && devices.length > 0) {
            devices.forEach(device => {
                const option = document.createElement('option');
                option.value = device.id_dispositivo;
                option.textContent = device.nombre_dispositivo;
                if (device.id_dispositivo === this.currentDevice) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
        } else {
            // Dispositivo por defecto si no hay datos
            const option = document.createElement('option');
            option.value = 1;
            option.textContent = 'Carro_Principal';
            option.selected = true;
            select.appendChild(option);
        }
    }

    async sendMovementCommand(operation) {
        if (!this.isConnected) {
            this.showAlert('❌ No conectado al servidor. Verifica la conexión.', 'danger');
            return;
        }

        const commandData = {
            id_dispositivo: this.currentDevice,
            status_operacion: operation,
            timestamp: new Date().toISOString()
        };

        console.log('Enviando comando:', commandData);

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/commands`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(commandData)
            });
            
            console.log('Respuesta del servidor - Status:', response.status);
            
            if (response.ok) {
                const result = await response.json();
                console.log('Comando exitoso:', result);
                
                if (result.status === 'success') {
                    this.showWsMessage(`✅ ${result.message || 'Comando ejecutado correctamente'}`, 'success');
                } else {
                    this.showWsMessage(`⚠️ ${result.message || 'Comando procesado con advertencia'}`, 'warning');
                }
            } else {
                let errorMessage = `Error ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.message || errorMessage;
                } catch (e) {
                    // Si no se puede parsear el error, usar status text
                    errorMessage = `${response.status} - ${response.statusText}`;
                }
                this.showWsMessage(`❌ ${errorMessage}`, 'danger');
                console.error('Error response:', errorMessage);
            }
        } catch (error) {
            this.showWsMessage(`❌ Error de conexión: ${error.message}`, 'danger');
            console.error('Network error:', error);
        }

        const operationText = this.getOperationText(operation);
        const deviceName = document.getElementById('deviceSelect').options[document.getElementById('deviceSelect').selectedIndex].text;
        this.showAlert(`📤 Enviando a ${deviceName}: ${operationText}`, 'info');
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

    startDemoMode() {
        if (!this.isConnected) {
            this.showAlert('❌ No conectado al servidor', 'danger');
            return;
        }

        const demoSequence = [
            { op: 1, text: 'Adelante', delay: 2000 },
            { op: 8, text: 'Giro derecha', delay: 2000 },
            { op: 1, text: 'Adelante', delay: 2000 },
            { op: 9, text: 'Giro izquierda', delay: 2000 },
            { op: 1, text: 'Adelante', delay: 2000 },
            { op: 3, text: 'Detener', delay: 1000 }
        ];

        this.showAlert('🚀 INICIANDO MODO DEMO...', 'info');
        this.showWsMessage('🔧 Modo demo iniciado - Secuencia automática', 'info');

        let currentIndex = 0;
        
        const executeNextStep = () => {
            if (currentIndex < demoSequence.length) {
                const step = demoSequence[currentIndex];
                this.sendMovementCommand(step.op);
                this.showWsMessage(`🔧 Demo: ${step.text}`, 'info');
                currentIndex++;
                setTimeout(executeNextStep, step.delay);
            } else {
                this.showAlert('✅ MODO DEMO COMPLETADO', 'success');
                this.showWsMessage('✅ Secuencia demo finalizada', 'success');
            }
        };

        executeNextStep();
    }

    connectWebSocket() {
        if (this.wsUrl) {
            // Código WebSocket original
            try {
                this.ws = new WebSocket(this.wsUrl);
                this.updateConnectionStatus('Conectando...', 'warning');

                this.ws.onopen = () => {
                    this.isConnected = true;
                    this.updateConnectionStatus('Conectado ✅', 'success');
                    this.showAlert('✅ Conectado al servidor IoT', 'success');
                    this.showWsMessage('🔗 WebSocket conectado - Listo para controlar', 'success');
                };

                this.ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        this.handleWebSocketMessage(data);
                    } catch (error) {
                        console.log('Mensaje recibido:', event.data);
                        this.showWsMessage(`📨 ${event.data}`, 'info');
                    }
                };

                this.ws.onerror = (error) => {
                    this.updateConnectionStatus('Error ❌', 'danger');
                    this.showAlert('❌ Error de conexión WebSocket', 'danger');
                    this.showWsMessage('❌ Error en conexión WebSocket', 'danger');
                };

                this.ws.onclose = (event) => {
                    this.isConnected = false;
                    this.updateConnectionStatus('Desconectado', 'secondary');
                    this.showWsMessage('🔌 Conexión WebSocket cerrada', 'secondary');
                    
                    setTimeout(() => {
                        if (!this.isConnected) {
                            this.showWsMessage('🔄 Intentando reconectar...', 'warning');
                            this.connectWebSocket();
                        }
                    }, 3000);
                };

            } catch (error) {
                console.error('WebSocket error:', error);
                this.showAlert('❌ Error al conectar WebSocket', 'danger');
            }
        } else {
            // Simular conexión exitosa via HTTP
            this.isConnected = true;
            this.updateConnectionStatus('Conectado ✅ (HTTP)', 'success');
            this.showAlert('✅ Conectado al servidor via HTTP', 'success');
            this.showWsMessage('🔗 Conectado via APIs REST HTTP', 'success');
        }
    }

    handleWebSocketMessage(data) {
        if (data.event === 'command_confirmation') {
            if (data.data.status === 'success') {
                this.showWsMessage(`✅ ${data.data.message}`, 'success');
            } else {
                this.showWsMessage(`❌ ${data.data.message}`, 'danger');
            }
        } else if (data.event === 'movement_command') {
            const operationText = this.getOperationText(data.data.status_operacion);
            this.showWsMessage(`🚗 Comando ejecutado: ${operationText}`, 'info');
        } else if (data.event === 'connection_status') {
            this.showWsMessage(`📡 ${data.data.message}`, 'info');
        }
    }

    updateConnectionStatus(text, type) {
        const statusElement = document.getElementById('connectionStatus');
        const badgeClass = {
            'success': 'bg-success status-connected',
            'warning': 'bg-warning',
            'danger': 'bg-danger',
            'secondary': 'bg-secondary'
        }[type] || 'bg-secondary';
        
        statusElement.className = `badge ${badgeClass}`;
        statusElement.textContent = text;
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
            <small>${new Date().toLocaleTimeString()}</small><br>
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
    new CarControlApp();
});