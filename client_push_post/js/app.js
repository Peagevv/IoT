class CarControlApp {
    constructor() {
        this.apiBaseUrl = 'http://98.91.159.217:5500';
        this.socket = null;
        this.isConnected = false;
        this.currentDevice = 1;
        this.isDemoRunning = false;
        this.devices = [];
        this.sequences = [];
        
        this.initializeEventListeners();
        this.loadDevices();
        this.loadSequences();
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

        // Botón nueva secuencia
        document.getElementById('newSequenceBtn').addEventListener('click', () => {
            this.openSequenceModal();
        });

        // Botón nuevo dispositivo
        document.getElementById('newDeviceBtn').addEventListener('click', () => {
            this.openDeviceModal();
        });

        // Botón guardar secuencia
        document.getElementById('saveSequenceBtn').addEventListener('click', () => {
            this.saveSequence();
        });
    }

    // ==================== DISPOSITIVOS ====================

    async loadDevices() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/devices`);
            const data = await response.json();
            
            if (data.status === 'success') {
                this.devices = data.data;
                this.populateDeviceSelect(data.data);
                this.renderDevicesList(data.data);
                this.showWsMessage('✅ Dispositivos cargados correctamente', 'success');
            }
        } catch (error) {
            console.error('Error loading devices:', error);
            this.showAlert('⚠️ Error al cargar dispositivos', 'warning');
        }
    }

    populateDeviceSelect(devices) {
        const selects = [
            document.getElementById('deviceSelect'),
            document.getElementById('sequenceDevice')
        ];
        
        selects.forEach(select => {
            if (!select) return;
            
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
        });
    }

    renderDevicesList(devices) {
        const container = document.getElementById('devicesList');
        
        if (devices.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center text-muted py-5">
                    <i class="bi bi-car-front display-4"></i>
                    <p class="mt-3">No hay dispositivos registrados</p>
                    <button class="btn custom-btn-demo" onclick="app.openDeviceModal()">
                        <i class="bi bi-plus-circle"></i> Agregar Primer Dispositivo
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = devices.map(device => `
            <div class="col-md-4 mb-3">
                <div class="card custom-card h-100">
                    <div class="card-body">
                        <h5 class="card-title">
                            <i class="bi bi-car-front-fill text-primary"></i> ${device.nombre_dispositivo}
                        </h5>
                        <p class="card-text">
                            <strong>ID:</strong> ${device.id_dispositivo}<br>
                            <strong>Estado:</strong> 
                            <span class="badge ${device.id_dispositivo === this.currentDevice ? 'bg-success' : 'bg-secondary'}">
                                ${device.id_dispositivo === this.currentDevice ? 'Activo' : 'Disponible'}
                            </span>
                        </p>
                    </div>
                    <div class="card-footer bg-transparent border-0">
                        <div class="btn-group w-100" role="group">
                            <button class="btn btn-sm custom-btn-primary" onclick="app.selectDevice(${device.id_dispositivo})">
                                <i class="bi bi-check-circle"></i> Seleccionar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    selectDevice(deviceId) {
        document.getElementById('deviceSelect').value = deviceId;
        document.getElementById('deviceSelect').dispatchEvent(new Event('change'));
        
        // Scroll al panel de control
        document.getElementById('control-section').scrollIntoView({ behavior: 'smooth' });
    }

    openDeviceModal(device = null) {
        const modal = new bootstrap.Modal(document.getElementById('deviceModal'));
        
        if (device) {
            document.getElementById('deviceModalTitle').textContent = 'Editar Dispositivo';
            document.getElementById('deviceId').value = device.id_dispositivo;
            document.getElementById('deviceName').value = device.nombre_dispositivo;
            document.getElementById('deviceDescription').value = device.descripcion || '';
        } else {
            document.getElementById('deviceModalTitle').textContent = 'Nuevo Dispositivo';
            document.getElementById('deviceForm').reset();
            document.getElementById('deviceId').value = '';
        }
        
        modal.show();
    }

    // ==================== SECUENCIAS ====================

    async loadSequences() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/sequences`);
            const data = await response.json();
            
            if (data.status === 'success') {
                this.sequences = data.data;
                this.renderSequencesList(data.data);
                this.showWsMessage('✅ Secuencias cargadas correctamente', 'success');
            }
        } catch (error) {
            console.error('Error loading sequences:', error);
            this.showAlert('⚠️ Error al cargar secuencias', 'warning');
        }
    }

    renderSequencesList(sequences) {
        const container = document.getElementById('sequencesList');
        
        if (sequences.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center text-muted py-5">
                    <i class="bi bi-collection-play display-4"></i>
                    <p class="mt-3">No hay secuencias guardadas</p>
                    <button class="btn custom-btn-demo" onclick="app.openSequenceModal()">
                        <i class="bi bi-plus-circle"></i> Crear Primera Secuencia
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = sequences.map(seq => {
            // Obtener las operaciones como array (compatible con ambas estructuras)
            const operationsArray = Array.isArray(seq.operaciones) ? 
                seq.operaciones : 
                (seq.operaciones ? seq.operaciones.split(',').map(op => parseInt(op.trim())) : []);
            
            const operationsText = operationsArray.map(op => this.getOperationText(op)).join(', ');
            const deviceName = this.devices.find(d => d.id_dispositivo === seq.id_dispositivo)?.nombre_dispositivo || 'Desconocido';
            
            return `
                <div class="col-md-6 col-lg-4 mb-3">
                    <div class="card custom-card h-100">
                        <div class="card-body">
                            <h5 class="card-title">
                                <i class="bi bi-collection-play text-info"></i> ${seq.nombre_secuencia}
                            </h5>
                            <p class="card-text">
                                <strong>Dispositivo:</strong> ${deviceName}<br>
                                <strong>Operaciones:</strong> ${operationsArray.length}<br>
                                <small class="text-muted">${operationsText.substring(0, 60)}${operationsText.length > 60 ? '...' : ''}</small>
                            </p>
                        </div>
                        <div class="card-footer bg-transparent border-0">
                            <div class="btn-group w-100" role="group">
                                <button class="btn btn-sm custom-btn-demo" onclick="app.executeSequence(${seq.id_secuencia})">
                                    <i class="bi bi-play-fill"></i> Ejecutar
                                </button>
                                <button class="btn btn-sm custom-btn-primary" onclick="app.openSequenceModal(${JSON.stringify(seq).replace(/"/g, '&quot;')})">
                                    <i class="bi bi-pencil"></i> Editar
                                </button>
                                <button class="btn btn-sm custom-btn-stop" onclick="app.deleteSequence(${seq.id_secuencia})">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    openSequenceModal(sequence = null) {
        const modal = new bootstrap.Modal(document.getElementById('sequenceModal'));
        
        if (sequence) {
            document.getElementById('sequenceModalTitle').textContent = 'Editar Secuencia';
            document.getElementById('sequenceId').value = sequence.id_secuencia;
            document.getElementById('sequenceName').value = sequence.nombre_secuencia;
            document.getElementById('sequenceDevice').value = sequence.id_dispositivo;
            
            // Convertir operaciones a string separado por comas (compatible con ambas estructuras)
            let operationsString;
            if (Array.isArray(sequence.operaciones)) {
                operationsString = sequence.operaciones.join(',');
            } else {
                operationsString = sequence.operaciones || '';
            }
            document.getElementById('sequenceOperations').value = operationsString;
        } else {
            document.getElementById('sequenceModalTitle').textContent = 'Nueva Secuencia';
            document.getElementById('sequenceForm').reset();
            document.getElementById('sequenceId').value = '';
            document.getElementById('sequenceDevice').value = this.currentDevice;
        }
        
        modal.show();
    }

    async saveSequence() {
        const id = document.getElementById('sequenceId').value;
        const name = document.getElementById('sequenceName').value.trim();
        const device = parseInt(document.getElementById('sequenceDevice').value);
        const operations = document.getElementById('sequenceOperations').value.trim();

        if (!name || !device || !operations) {
            this.showAlert('⚠️ Por favor completa todos los campos', 'warning');
            return;
        }

        // Validar que las operaciones sean números separados por comas
        const opsArray = operations.split(',').map(op => parseInt(op.trim()));
        const validOps = opsArray.every(op => !isNaN(op) && op >= 1 && op <= 11);
        
        if (!validOps) {
            this.showAlert('⚠️ Las operaciones deben ser números entre 1 y 11 separados por comas', 'warning');
            return;
        }

        // Preparar datos para la estructura de base de datos
        const sequenceData = {
            id_dispositivo: device,
            nombre_secuencia: name,
            movimientos: opsArray  // Enviar como array para la nueva estructura
        };

        try {
            let url, method;
            
            if (id) {
                // Para editar
                url = `${this.apiBaseUrl}/api/sequences/${id}`;
                method = 'PUT';
            } else {
                // Para crear nueva
                url = `${this.apiBaseUrl}/api/sequences`;
                method = 'POST';
            }

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(sequenceData)
            });

            const data = await response.json();

            if (data.status === 'success') {
                this.showAlert(`✅ Secuencia ${id ? 'actualizada' : 'creada'} correctamente`, 'success');
                bootstrap.Modal.getInstance(document.getElementById('sequenceModal')).hide();
                await this.loadSequences();
            } else {
                this.showAlert(`❌ Error: ${data.message}`, 'danger');
            }
        } catch (error) {
            console.error('Error saving sequence:', error);
            this.showAlert('⚠️ Error al guardar secuencia', 'danger');
        }
    }

    async deleteSequence(id) {
        if (!confirm('¿Estás seguro de eliminar esta secuencia?')) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/sequences/${id}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (data.status === 'success') {
                this.showAlert('✅ Secuencia eliminada', 'success');
                await this.loadSequences();
            } else {
                this.showAlert(`❌ Error: ${data.message}`, 'danger');
            }
        } catch (error) {
            console.error('Error deleting sequence:', error);
            this.showAlert('⚠️ Error al eliminar secuencia', 'danger');
        }
    }

    async executeSequence(sequenceId) {
        if (!this.isConnected) {
            this.showAlert('❌ No conectado al servidor', 'danger');
            return;
        }

        if (this.isDemoRunning) {
            this.showAlert('⚠️ Ya hay una secuencia en ejecución', 'warning');
            return;
        }

        const sequence = this.sequences.find(s => s.id_secuencia === sequenceId);
        if (!sequence) {
            this.showAlert('❌ Secuencia no encontrada', 'danger');
            return;
        }

        this.isDemoRunning = true;
        
        // Cambiar al dispositivo de la secuencia si es diferente
        if (sequence.id_dispositivo !== this.currentDevice) {
            document.getElementById('deviceSelect').value = sequence.id_dispositivo;
            document.getElementById('deviceSelect').dispatchEvent(new Event('change'));
        }

        // Obtener operaciones (compatible con ambas estructuras)
        let operations;
        if (Array.isArray(sequence.operaciones)) {
            operations = sequence.operaciones;
        } else {
            operations = sequence.operaciones ? sequence.operaciones.split(',').map(op => parseInt(op.trim())) : [];
        }
        
        this.showAlert(`🚀 Ejecutando secuencia: ${sequence.nombre_secuencia}`, 'info');
        this.showWsMessage(`🎬 Iniciando secuencia: ${sequence.nombre_secuencia}`, 'info');

        for (let i = 0; i < operations.length; i++) {
            if (!this.isDemoRunning) {
                this.showWsMessage('⏹️ Secuencia cancelada', 'warning');
                break;
            }

            const op = operations[i];
            await this.sendMovementCommand(op);
            const opText = this.getOperationText(op);
            this.showWsMessage(`🎬 [${i + 1}/${operations.length}] ${opText}`, 'info');
            
            // Esperar 2 segundos entre operaciones
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        if (this.isDemoRunning) {
            this.showAlert(`✅ Secuencia completada: ${sequence.nombre_secuencia}`, 'success');
            this.showWsMessage('✅ Secuencia finalizada', 'success');
        }

        this.isDemoRunning = false;
    }

    // ==================== SOCKET.IO ====================
    
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
                if (data.type === 'sequence_created' || data.type === 'sequence_updated' || data.type === 'sequence_deleted') {
                    this.loadSequences();
                }
            });

        } catch (error) {
            console.error('Socket.IO error:', error);
            this.showAlert('❌ Error al inicializar Socket.IO', 'danger');
        }
    }

    // ==================== COMANDOS ====================
    
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
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            if (data.status === 'success') {
                const operationText = this.getOperationText(operation);
                const deviceName = document.getElementById('deviceSelect').options[document.getElementById('deviceSelect').selectedIndex].text;
                this.showAlert(`✅ Comando enviado: ${operationText}`, 'success');
                this.showWsMessage(`📤 Enviado a ${deviceName}: ${operationText}`, 'info');
            } else {
                this.showAlert(`❌ Error: ${data.message}`, 'danger');
            }
        } catch (error) {
            console.error('Error sending command:', error);
            this.showAlert(`⚠️ Error al enviar comando`, 'danger');
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

    // ==================== DEMO RÁPIDO ====================
    
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
        this.showWsMessage('🔧 Modo demo iniciado', 'info');

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
            this.showWsMessage('✅ Secuencia finalizada', 'success');
        }

        this.isDemoRunning = false;
    }

    // ==================== UI HELPERS ====================
    
    updateConnectionStatus(text, type) {
        const statusElements = document.querySelectorAll('#connectionStatus, #connectionStatusDisplay');
        const badgeClass = {
            'success': 'custom-badge',
            'warning': 'badge bg-warning',
            'danger': 'badge bg-danger'
        }[type] || 'badge bg-secondary';
        
        statusElements.forEach(el => {
            el.className = badgeClass;
            el.textContent = text;
        });
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
        
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }

    showWsMessage(message, type) {
        const container = document.getElementById('wsMessages');
        
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

        if (container.children.length > 50) {
            container.removeChild(container.firstChild);
        }
    }
}

// Variable global para acceder desde HTML
let app;

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Iniciando Control Carro IoT con CRUD...');
    app = new CarControlApp();
});