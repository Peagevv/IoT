class CarControlApp {
    constructor() {
        this.apiBaseUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent('http://98.91.159.217:5500');
        this.wsUrl = 'ws://98.91.159.217:5500';
        this.ws = null;
        this.isConnected = false;
        this.currentDevice = 1;
        this.demos = [];
        this.devices = []; // Array para almacenar los dispositivos
        this.isDemoRunning = false;
        this.commandsCount = 0;
        this.startTime = Date.now();
        
        this.initializeEventListeners();
        this.loadDevices();
        this.loadDemos();
        this.connectWebSocket();
        this.startCounters();
    }
    // ========== WEBSOCKET IMPLEMENTATION ==========

    connectWebSocket() {
        try {
            this.ws = new WebSocket(this.wsUrl);
            this.updateConnectionStatus('Conectando...', 'warning');
            this.showWsMessage('🔌 Intentando conexión WebSocket...', 'info');

            this.ws.onopen = () => {
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.updateConnectionStatus('Conectado ✅', 'success');
                this.showAlert('✅ Conexión WebSocket establecida', 'success');
                this.showWsMessage('🔗 WebSocket conectado - Listo para control en tiempo real', 'success');
                
                // Enviar mensaje de identificación
                this.sendWebSocketMessage({
                    type: 'identification',
                    user: 'web_interface',
                    device: this.currentDevice
                });
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                } catch (error) {
                    // Si no es JSON, mostrar mensaje plano
                    this.showWsMessage(`📨 ${event.data}`, 'info');
                }
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateConnectionStatus('Error ❌', 'danger');
                this.showAlert('❌ Error en conexión WebSocket', 'danger');
                this.showWsMessage('❌ Error de conexión WebSocket', 'danger');
            };

            this.ws.onclose = (event) => {
                this.isConnected = false;
                this.updateConnectionStatus('Desconectado', 'secondary');
                
                if (event.code !== 1000) { // No es un cierre normal
                    this.showWsMessage('🔌 Conexión WebSocket perdida', 'warning');
                    this.attemptReconnection();
                } else {
                    this.showWsMessage('🔌 Conexión WebSocket cerrada', 'secondary');
                }
            };

        } catch (error) {
            console.error('Error al crear WebSocket:', error);
            this.showAlert('❌ No se pudo conectar al servidor WebSocket', 'danger');
            this.attemptReconnection();
        }
    }

    attemptReconnection() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * this.reconnectAttempts, 10000); // Backoff exponencial
            
            this.showWsMessage(`🔄 Reconectando en ${delay/1000} segundos... (Intento ${this.reconnectAttempts}/${this.maxReconnectAttempts})`, 'warning');
            
            setTimeout(() => {
                if (!this.isConnected) {
                    this.connectWebSocket();
                }
            }, delay);
        } else {
            this.showWsMessage('❌ Máximo de intentos de reconexión alcanzado', 'danger');
            this.showAlert('❌ No se puede conectar al servidor. Verifica tu conexión.', 'danger');
        }
    }

    sendWebSocketMessage(message) {
        if (this.isConnected && this.ws) {
            try {
                this.ws.send(JSON.stringify(message));
                return true;
            } catch (error) {
                console.error('Error enviando mensaje WebSocket:', error);
                this.showWsMessage('❌ Error enviando comando', 'danger');
                return false;
            }
        } else {
            this.showWsMessage('❌ No conectado al servidor', 'danger');
            return false;
        }
    }

    handleWebSocketMessage(data) {
        // Manejar diferentes tipos de mensajes del servidor
        switch (data.type) {
            case 'movement_confirmation':
                this.handleMovementConfirmation(data);
                break;
                
            case 'sensor_data':
                this.handleSensorData(data);
                break;
                
            case 'obstacle_detected':
                this.handleObstacleDetection(data);
                break;
                
            case 'system_status':
                this.handleSystemStatus(data);
                break;
                
            case 'error':
                this.handleErrorMessage(data);
                break;
                
            case 'ping':
                this.handlePing(data);
                break;
                
            default:
                this.showWsMessage(`📨 ${JSON.stringify(data)}`, 'info');
                break;
        }
    }

    handleMovementConfirmation(data) {
        const operationText = this.getOperationText(data.operation);
        const status = data.success ? 'success' : 'danger';
        const icon = data.success ? '✅' : '❌';
        
        this.showWsMessage(`${icon} Movimiento confirmado: ${operationText}`, status);
        
        if (data.sensor_data) {
            this.updateSensorDisplay(data.sensor_data);
        }
    }

    handleSensorData(data) {
        this.updateSensorDisplay(data);
        this.showWsMessage(`📊 Datos de sensores: Distancia ${data.distance || 0}cm`, 'info');
    }

    handleObstacleDetection(data) {
        this.showWsMessage(`🚨 OBSTÁCULO DETECTADO! Distancia: ${data.distance}cm`, 'danger');
        this.showAlert(`🚨 Obstáculo detectado a ${data.distance}cm`, 'danger');
        
        // Parar el carro automáticamente si está muy cerca
        if (data.distance < 15) {
            this.sendMovementCommand(3); // Detener
            this.showWsMessage('🛑 Deteniendo carro por seguridad', 'warning');
        }
    }

    handleSystemStatus(data) {
        this.updateSystemStatus(data);
        this.showWsMessage(`⚙️ Estado del sistema: ${data.message}`, 'info');
    }

    handleErrorMessage(data) {
        this.showWsMessage(`❌ Error: ${data.message}`, 'danger');
        this.showAlert(`Error: ${data.message}`, 'danger');
    }

    handlePing(data) {
        // Responder al ping
        this.sendWebSocketMessage({
            type: 'pong',
            timestamp: Date.now()
        });
    }

    updateSensorDisplay(sensorData) {
        // Actualizar la interfaz con datos de sensores
        const sensorDisplay = document.getElementById('sensorDisplay');
        if (sensorDisplay) {
            sensorDisplay.innerHTML = `
                <small>Distancia: ${sensorData.distance || 0}cm</small>
                <small>Velocidad: ${sensorData.speed || 0}%</small>
                <small>Batería: ${sensorData.battery || 'N/A'}%</small>
            `;
        }
    }

    updateSystemStatus(statusData) {
        // Actualizar estado del sistema
        document.getElementById('statusIndicator').textContent = 
            statusData.status === 'online' ? 'Online' : 'Offline';
        
        const statusClass = statusData.status === 'online' ? 'text-success' : 'text-danger';
        document.getElementById('statusIndicator').className = statusClass;
    }

    // ========== MOVEMENT COMMANDS WITH WEBSOCKET ==========

    async sendMovementCommand(operation) {
        const operationText = this.getOperationText(operation);
        const deviceName = document.getElementById('deviceSelect').options[document.getElementById('deviceSelect').selectedIndex].text;
        
        // Mostrar mensaje inmediatamente
        this.showWsMessage(`📤 Enviando: ${deviceName} - ${operationText}`, 'info');

        // Intentar enviar via WebSocket primero
        const wsSuccess = this.sendWebSocketMessage({
            type: 'movement_command',
            device_id: this.currentDevice,
            operation: operation,
            timestamp: Date.now()
        });

        // Si WebSocket falla, usar HTTP como fallback
        if (!wsSuccess) {
            this.showWsMessage('🔄 Fallback a HTTP...', 'warning');
            try {
                await fetch(`${this.apiBaseUrl}/api/movement?device_id=${this.currentDevice}&operation=${operation}`);
                this.showWsMessage(`✅ ${deviceName}: ${operationText} (via HTTP)`, 'success');
            } catch (error) {
                this.showWsMessage(`❌ Error enviando comando: ${operationText}`, 'danger');
            }
        }

        // Actualizar contador
        this.commandsCount++;
        document.getElementById('commandsCount').textContent = this.commandsCount;
    }

    // ========== DEMO MODE WITH WEBSOCKET ==========

    startDemoMode(demoSequence) {
        if (!this.isConnected) {
            this.showAlert('❌ No conectado al servidor. Usando modo local.', 'warning');
        }

        if (this.isDemoRunning) {
            this.showAlert('⚠️ Ya hay una demo en ejecución', 'warning');
            return;
        }

        this.isDemoRunning = true;
        this.showAlert('🚀 INICIANDO MODO DEMO...', 'info');
        this.showWsMessage('🔧 Modo demo iniciado - Secuencia automática', 'info');

        let currentIndex = 0;
        
        const executeNextStep = () => {
            if (currentIndex < demoSequence.length && this.isDemoRunning) {
                const step = demoSequence[currentIndex];
                
                // Enviar comando de movimiento
                this.sendMovementCommand(step.op);
                this.showWsMessage(`🔧 Demo [${currentIndex + 1}/${demoSequence.length}]: ${step.text}`, 'info');
                
                currentIndex++;
                
                // Programar siguiente paso
                if (this.isDemoRunning) {
                    setTimeout(executeNextStep, step.delay);
                }
            } else {
                this.isDemoRunning = false;
                if (currentIndex >= demoSequence.length) {
                    this.showAlert('✅ MODO DEMO COMPLETADO', 'success');
                    this.showWsMessage('✅ Secuencia demo finalizada exitosamente', 'success');
                } else {
                    this.showAlert('⏹️ Demo interrumpida', 'warning');
                }
            }
        };

        executeNextStep();
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
            const device = this.devices.find(d => d.id_dispositivo === this.currentDevice);
            this.showAlert(`Cambiado a: ${device ? device.nombre_dispositivo : 'Carro_Principal'}`, 'info');
        });

        // Botón modo demo
        document.getElementById('demoBtn').addEventListener('click', () => {
            this.showDemoSelector();
        });

        // Botón gestionar demos
        document.getElementById('manageDemosBtn').addEventListener('click', () => {
            this.showDemoManager();
        });

        // Botón crear nueva demo
        document.getElementById('createDemoBtn').addEventListener('click', () => {
            this.showDemoCreator();
        });

        // Botón gestionar carros
        document.getElementById('manageCarsBtn').addEventListener('click', () => {
            this.showCarManager();
        });

        // Botón detener emergencia
        document.getElementById('stopBtn').addEventListener('click', () => {
            this.stopAllDemos();
            this.sendMovementCommand(3);
            this.showAlert('🛑 PARADA DE EMERGENCIA ACTIVADA', 'danger');
        });
    }

    async loadDevices() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/devices`);
            
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const text = await response.text();
            const data = JSON.parse(text);
            
            if (data.status === 'success') {
                this.devices = data.data;
                this.populateDeviceSelect(this.devices);
            } else {
                throw new Error(`Error del servidor: ${data.message}`);
            }
        } catch (error) {
            console.error('Error loading devices:', error);
            // Dispositivos por defecto
            this.devices = [
                {
                    id_dispositivo: 1,
                    nombre_dispositivo: 'Carro_Principal',
                    descripcion: 'Carro principal de control',
                    estado: 'activo',
                    fecha_creacion: new Date().toISOString()
                }
            ];
            this.populateDeviceSelect(this.devices);
        }
    }

    async loadDemos() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/demos`);
            
            if (response.ok) {
                const text = await response.text();
                const data = JSON.parse(text);
                
                if (data.status === 'success') {
                    this.demos = data.data;
                    this.updateDemosCount();
                    return;
                }
            }
        } catch (error) {
            console.log('No se pudieron cargar demos del servidor, usando demos locales');
        }
        
        // Fallback: demos locales
        this.demos = [
            {
                id_demo: 1,
                nombre_demo: 'Demo Básico',
                secuencia: [
                    {op: 1, text: 'Adelante', delay: 2000},
                    {op: 8, text: 'Giro derecha', delay: 2000},
                    {op: 1, text: 'Adelante', delay: 2000},
                    {op: 9, text: 'Giro izquierda', delay: 2000},
                    {op: 1, text: 'Adelante', delay: 2000},
                    {op: 3, text: 'Detener', delay: 1000}
                ],
                descripcion: 'Secuencia básica de movimiento'
            },
            {
                id_demo: 2,
                nombre_demo: 'Exploración',
                secuencia: [
                    {op: 1, text: 'Adelante', delay: 1500},
                    {op: 10, text: 'Giro 360', delay: 3000},
                    {op: 1, text: 'Adelante', delay: 1500},
                    {op: 4, text: 'Vuelta derecha', delay: 2000},
                    {op: 1, text: 'Adelante', delay: 1500},
                    {op: 3, text: 'Detener', delay: 1000}
                ],
                descripcion: 'Secuencia de exploración completa'
            }
        ];
        this.updateDemosCount();
    }

    updateDemosCount() {
        document.getElementById('demosCount').textContent = this.demos.length;
    }

    populateDeviceSelect(devices = null) {
        const select = document.getElementById('deviceSelect');
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
            option.selected = true;
            select.appendChild(option);
        }
    }

    async sendMovementCommand(operation) {
        if (!this.isConnected) {
            this.showAlert('❌ No conectado al servidor.', 'danger');
            return;
        }

        const operationText = this.getOperationText(operation);
        const deviceName = document.getElementById('deviceSelect').options[document.getElementById('deviceSelect').selectedIndex].text;
        
        this.showWsMessage(`✅ ${deviceName}: ${operationText}`, 'success');
        this.showAlert(`✅ Comando enviado: ${operationText}`, 'success');
        
        // Actualizar contador
        this.commandsCount++;
        document.getElementById('commandsCount').textContent = this.commandsCount;

        try {
            await fetch(`${this.apiBaseUrl}/api/movement?device_id=${this.currentDevice}&operation=${operation}`);
        } catch (error) {
            // Ignorar errores silenciosamente
        }
    }

    getOperationText(operation) {
        const operations = {
            1: '🚗 Adelante', 2: '🚗 Atrás', 3: '🛑 Detener',
            4: '↗️ Vuelta adelante derecha', 5: '↖️ Vuelta adelante izquierda',
            6: '↘️ Vuelta atrás derecha', 7: '↙️ Vuelta atrás izquierda',
            8: '↷ Giro 90° derecha', 9: '↶ Giro 90° izquierda',
            10: '⟳ Giro 360° derecha', 11: '⟲ Giro 360° izquierda',
            12: '⭐ Movimiento Especial'
        };
        return operations[operation] || `Operación ${operation}`;
    }

    // ========== GESTIÓN DE CARROS ==========

    showCarManager() {
        this.createModal(
            'carManagerModal',
            'Gestor de Carros',
            'custom-card-header-info',
            this.createCarManagerContent(),
            'large'
        );
    }

    createCarManagerContent() {
        const container = document.createElement('div');
        
        // Botón agregar nuevo carro
        const addBtnContainer = document.createElement('div');
        addBtnContainer.className = 'd-grid gap-2 mb-3';
        
        const addBtn = this.createButton(
            'Agregar Nuevo Carro',
            'custom-btn-success',
            'bi-plus-circle',
            () => this.showCarCreator()
        );
        
        addBtnContainer.appendChild(addBtn);
        
        // Lista de carros
        const carList = document.createElement('div');
        carList.className = 'list-group custom-list-group';
        
        if (this.devices.length === 0) {
            const emptyItem = document.createElement('div');
            emptyItem.className = 'list-group-item text-center text-muted py-4';
            emptyItem.innerHTML = `
                <i class="bi bi-inbox display-4"></i>
                <p class="mt-3">No hay carros registrados</p>
                <small>Agrega tu primer carro para comenzar</small>
            `;
            carList.appendChild(emptyItem);
        } else {
            this.devices.forEach(device => {
                const carItem = this.createCarListItem(device);
                carList.appendChild(carItem);
            });
        }
        
        container.appendChild(addBtnContainer);
        container.appendChild(carList);
        
        return container;
    }

    createCarListItem(device) {
        const item = document.createElement('div');
        item.className = 'list-group-item custom-list-group-item';
        
        const header = document.createElement('div');
        header.className = 'd-flex w-100 justify-content-between align-items-start';
        
        const title = document.createElement('h6');
        title.className = 'mb-1 text-purple';
        title.textContent = device.nombre_dispositivo;
        
        const status = document.createElement('span');
        status.className = `badge ${device.estado === 'activo' ? 'bg-success' : 'bg-secondary'}`;
        status.textContent = device.estado === 'activo' ? 'Activo' : 'Inactivo';
        
        header.appendChild(title);
        header.appendChild(status);
        
        const description = document.createElement('p');
        description.className = 'mb-1';
        description.textContent = device.descripcion || 'Sin descripción';
        
        const deviceInfo = document.createElement('small');
        deviceInfo.className = 'text-muted';
        deviceInfo.textContent = `ID: ${device.id_dispositivo} | Creado: ${new Date(device.fecha_creacion).toLocaleDateString()}`;
        
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'mt-2';
        
        const selectBtn = this.createButton(
            'Seleccionar',
            'custom-btn-primary btn-sm me-1',
            'bi-check-circle',
            () => {
                this.currentDevice = device.id_dispositivo;
                this.populateDeviceSelect(this.devices);
                this.showAlert(`✅ Carro seleccionado: ${device.nombre_dispositivo}`, 'success');
                this.closeModal('carManagerModal');
            }
        );
        
        const editBtn = this.createButton(
            'Editar',
            'custom-btn-warning btn-sm me-1',
            'bi-pencil',
            () => this.showCarEditor(device)
        );
        
        const deleteBtn = this.createButton(
            'Eliminar',
            'custom-btn-danger btn-sm',
            'bi-trash',
            () => this.deleteCar(device.id_dispositivo)
        );
        
        buttonContainer.appendChild(selectBtn);
        buttonContainer.appendChild(editBtn);
        buttonContainer.appendChild(deleteBtn);
        
        item.appendChild(header);
        item.appendChild(description);
        item.appendChild(deviceInfo);
        item.appendChild(buttonContainer);
        
        return item;
    }

    showCarCreator() {
        this.createModal(
            'carCreatorModal',
            'Agregar Nuevo Carro',
            'custom-card-header-success',
            this.createCarForm(),
            'medium'
        );
    }

    showCarEditor(device) {
        this.createModal(
            'carEditorModal',
            'Editar Carro',
            'custom-card-header-warning',
            this.createCarForm(device),
            'medium'
        );
    }

    createCarForm(device = null) {
        const container = document.createElement('div');
        
        // Nombre del carro
        const nameGroup = this.createFormGroup(
            'Nombre del Carro:',
            'text',
            'carName',
            'Ej: Carro_Explorador_1',
            device ? device.nombre_dispositivo : ''
        );
        
        // Descripción
        const descGroup = document.createElement('div');
        descGroup.className = 'mb-3';
        
        const descLabel = document.createElement('label');
        descLabel.className = 'form-label';
        descLabel.textContent = 'Descripción:';
        
        const descTextarea = document.createElement('textarea');
        descTextarea.id = 'carDescription';
        descTextarea.className = 'form-control custom-input';
        descTextarea.rows = 3;
        descTextarea.placeholder = 'Describe las características del carro...';
        if (device && device.descripcion) {
            descTextarea.value = device.descripcion;
        }
        
        descGroup.appendChild(descLabel);
        descGroup.appendChild(descTextarea);
        
        // Estado (solo para edición)
        let statusGroup;
        if (device) {
            statusGroup = document.createElement('div');
            statusGroup.className = 'mb-3';
            
            const statusLabel = document.createElement('label');
            statusLabel.className = 'form-label';
            statusLabel.textContent = 'Estado:';
            
            const statusSelect = document.createElement('select');
            statusSelect.id = 'carStatus';
            statusSelect.className = 'form-select custom-select';
            
            const activeOption = document.createElement('option');
            activeOption.value = 'activo';
            activeOption.textContent = 'Activo';
            if (device.estado === 'activo') activeOption.selected = true;
            
            const inactiveOption = document.createElement('option');
            inactiveOption.value = 'inactivo';
            inactiveOption.textContent = 'Inactivo';
            if (device.estado === 'inactivo') inactiveOption.selected = true;
            
            statusSelect.appendChild(activeOption);
            statusSelect.appendChild(inactiveOption);
            
            statusGroup.appendChild(statusLabel);
            statusGroup.appendChild(statusSelect);
        }
        
        // Botones de acción
        const actionContainer = document.createElement('div');
        actionContainer.className = 'd-grid gap-2';
        
        const saveBtn = this.createButton(
            device ? 'Actualizar Carro' : 'Guardar Carro',
            'custom-btn-success',
            'bi-check-circle',
            () => device ? this.updateCar(device.id_dispositivo) : this.saveCar()
        );
        
        actionContainer.appendChild(saveBtn);
        
        // Ensamblar todo
        container.appendChild(nameGroup);
        container.appendChild(descGroup);
        if (statusGroup) container.appendChild(statusGroup);
        container.appendChild(actionContainer);
        
        return container;
    }

    async saveCar() {
        const name = document.getElementById('carName').value;
        const description = document.getElementById('carDescription').value;
        
        if (!name) {
            this.showAlert('❌ El nombre del carro es requerido', 'danger');
            return;
        }
        
        const newCar = {
            id_dispositivo: Date.now(), // ID temporal
            nombre_dispositivo: name,
            descripcion: description,
            estado: 'activo',
            fecha_creacion: new Date().toISOString()
        };
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/devices`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(newCar)
            });
            
            if (response.ok) {
                this.showAlert('✅ Carro guardado correctamente', 'success');
                await this.loadDevices();
                this.closeModal('carCreatorModal');
            } else {
                throw new Error('Error del servidor');
            }
        } catch (error) {
            // Si falla el servidor, guardar localmente
            this.devices.push(newCar);
            this.populateDeviceSelect(this.devices);
            this.showAlert('✅ Carro guardado localmente', 'success');
            this.closeModal('carCreatorModal');
        }
    }

    async updateCar(carId) {
        const name = document.getElementById('carName').value;
        const description = document.getElementById('carDescription').value;
        const status = document.getElementById('carStatus').value;
        
        if (!name) {
            this.showAlert('❌ El nombre del carro es requerido', 'danger');
            return;
        }
        
        const updatedCar = {
            nombre_dispositivo: name,
            descripcion: description,
            estado: status
        };
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/devices/${carId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updatedCar)
            });
            
            if (response.ok) {
                this.showAlert('✅ Carro actualizado correctamente', 'success');
                await this.loadDevices();
                this.closeModal('carEditorModal');
            } else {
                throw new Error('Error del servidor');
            }
        } catch (error) {
            // Si falla el servidor, actualizar localmente
            const index = this.devices.findIndex(d => d.id_dispositivo === carId);
            if (index !== -1) {
                this.devices[index] = { ...this.devices[index], ...updatedCar };
                this.populateDeviceSelect(this.devices);
                this.showAlert('✅ Carro actualizado localmente', 'success');
                this.closeModal('carEditorModal');
            }
        }
    }

    async deleteCar(carId) {
        const car = this.devices.find(d => d.id_dispositivo === carId);
        if (!car) return;
        
        if (confirm(`¿Estás segura de que quieres eliminar el carro "${car.nombre_dispositivo}"?`)) {
            try {
                const response = await fetch(`${this.apiBaseUrl}/api/devices/${carId}`, {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    this.showAlert('✅ Carro eliminado correctamente', 'success');
                    await this.loadDevices();
                    // Si eliminamos el carro actual, cambiar al primero disponible
                    if (this.currentDevice === carId) {
                        this.currentDevice = this.devices.length > 0 ? this.devices[0].id_dispositivo : 1;
                        this.populateDeviceSelect(this.devices);
                    }
                }
            } catch (error) {
                // Si falla el servidor, eliminar localmente
                this.devices = this.devices.filter(d => d.id_dispositivo !== carId);
                this.populateDeviceSelect(this.devices);
                // Si eliminamos el carro actual, cambiar al primero disponible
                if (this.currentDevice === carId) {
                    this.currentDevice = this.devices.length > 0 ? this.devices[0].id_dispositivo : 1;
                }
                this.showAlert('✅ Carro eliminado localmente', 'success');
            }
        }
    }

    // ========== MÉTODOS EXISTENTES (sin cambios) ==========

    startDemoMode(demoSequence) {
        if (!this.isConnected) {
            this.showAlert('❌ No conectado al servidor', 'danger');
            return;
        }

        if (this.isDemoRunning) {
            this.showAlert('⚠️ Ya hay una demo en ejecución', 'warning');
            return;
        }

        this.isDemoRunning = true;
        this.showAlert('🚀 INICIANDO MODO DEMO...', 'info');
        this.showWsMessage('🔧 Modo demo iniciado - Secuencia automática', 'info');

        let currentIndex = 0;
        
        const executeNextStep = () => {
            if (currentIndex < demoSequence.length && this.isDemoRunning) {
                const step = demoSequence[currentIndex];
                this.sendMovementCommand(step.op);
                this.showWsMessage(`🔧 Demo: ${step.text}`, 'info');
                currentIndex++;
                setTimeout(executeNextStep, step.delay);
            } else {
                this.isDemoRunning = false;
                this.showAlert('✅ MODO DEMO COMPLETADO', 'success');
                this.showWsMessage('✅ Secuencia demo finalizada', 'success');
            }
        };

        executeNextStep();
    }

    stopAllDemos() {
        this.isDemoRunning = false;
        this.showAlert('⏹️ Todas las demos detenidas', 'warning');
        this.showWsMessage('⏹️ Demo interrumpida por el usuario', 'warning');
    }

    showDemoSelector() {
        this.createModal(
            'demoSelectorModal',
            'Seleccionar Demo',
            'custom-card-header-info',
            this.createDemoSelectorContent(),
            'medium'
        );
    }

    createDemoSelectorContent() {
        const container = document.createElement('div');
        
        if (this.demos.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'text-center text-muted py-4';
            emptyMessage.innerHTML = `
                <i class="bi bi-inbox display-4"></i>
                <p class="mt-3">No hay demos disponibles</p>
                <button class="btn custom-btn-success" id="createFirstDemoBtn">
                    <i class="bi bi-plus-circle"></i> Crear Primera Demo
                </button>
            `;
            container.appendChild(emptyMessage);
            
            setTimeout(() => {
                document.getElementById('createFirstDemoBtn').addEventListener('click', () => {
                    this.closeModal('demoSelectorModal');
                    this.showDemoCreator();
                });
            }, 100);
            
            return container;
        }
        
        const select = document.createElement('select');
        select.id = 'demoSelector';
        select.className = 'form-select custom-select mb-3';
        
        this.demos.forEach(demo => {
            const option = document.createElement('option');
            option.value = demo.id_demo;
            option.textContent = `${demo.nombre_demo} - ${demo.descripcion}`;
            select.appendChild(option);
        });
        
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'd-grid gap-2';
        
        const executeBtn = this.createButton(
            'Ejecutar Demo',
            'custom-btn-demo',
            'bi-play-fill',
            () => this.executeSelectedDemo()
        );
        
        const deleteBtn = this.createButton(
            'Eliminar Demo',
            'custom-btn-danger',
            'bi-trash',
            () => this.deleteSelectedDemo()
        );
        
        buttonContainer.appendChild(executeBtn);
        buttonContainer.appendChild(deleteBtn);
        
        container.appendChild(select);
        container.appendChild(buttonContainer);
        
        return container;
    }

    executeSelectedDemo() {
        const selector = document.getElementById('demoSelector');
        const demoId = parseInt(selector.value);
        const demo = this.demos.find(d => d.id_demo === demoId);
        
        if (demo) {
            this.startDemoMode(demo.secuencia);
            this.closeModal('demoSelectorModal');
        }
    }

    async deleteSelectedDemo() {
        const selector = document.getElementById('demoSelector');
        const demoId = parseInt(selector.value);
        const demo = this.demos.find(d => d.id_demo === demoId);
        
        if (confirm(`¿Estás segura de que quieres eliminar la demo "${demo.nombre_demo}"?`)) {
            try {
                const response = await fetch(`${this.apiBaseUrl}/api/demos/${demoId}`, {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    this.showAlert('✅ Demo eliminada correctamente', 'success');
                    await this.loadDemos();
                    this.closeModal('demoSelectorModal');
                }
            } catch (error) {
                // Si falla el servidor, eliminar localmente
                this.demos = this.demos.filter(d => d.id_demo !== demoId);
                this.updateDemosCount();
                this.showAlert('✅ Demo eliminada localmente', 'success');
                this.closeModal('demoSelectorModal');
            }
        }
    }

    showDemoCreator() {
        this.createModal(
            'demoCreatorModal',
            'Crear Nueva Demo',
            'custom-card-header-success',
            this.createDemoCreatorContent(),
            'large'
        );
    }

    createDemoCreatorContent() {
        const container = document.createElement('div');
        
        // Nombre de la demo
        const nameGroup = this.createFormGroup(
            'Nombre de la Demo:',
            'text',
            'demoName',
            'Ej: Exploración Avanzada'
        );
        
        // Descripción
        const descGroup = document.createElement('div');
        descGroup.className = 'mb-3';
        
        const descLabel = document.createElement('label');
        descLabel.className = 'form-label';
        descLabel.textContent = 'Descripción:';
        
        const descTextarea = document.createElement('textarea');
        descTextarea.id = 'demoDescription';
        descTextarea.className = 'form-control custom-input';
        descTextarea.rows = 2;
        descTextarea.placeholder = 'Describe la secuencia de movimientos';
        
        descGroup.appendChild(descLabel);
        descGroup.appendChild(descTextarea);
        
        // Constructor de secuencia
        const sequenceGroup = document.createElement('div');
        sequenceGroup.className = 'mb-3';
        
        const sequenceLabel = document.createElement('label');
        sequenceLabel.className = 'form-label';
        sequenceLabel.textContent = 'Secuencia de Movimientos:';
        
        const sequenceBuilder = document.createElement('div');
        sequenceBuilder.id = 'sequenceBuilder';
        sequenceBuilder.className = 'border rounded p-3 custom-message-container';
        sequenceBuilder.style.maxHeight = '300px';
        sequenceBuilder.style.overflowY = 'auto';
        
        const emptyMessage = document.createElement('div');
        emptyMessage.id = 'emptySequenceMessage';
        emptyMessage.className = 'text-center text-muted py-4';
        
        const emptyText = document.createElement('p');
        emptyText.textContent = 'No hay movimientos en la secuencia';
        emptyText.className = 'mb-3';
        
        const addBtn = this.createButton(
            'Agregar Primer Movimiento',
            'custom-btn-info btn-sm',
            'bi-plus-circle',
            () => this.addMovementToSequence()
        );
        
        emptyMessage.appendChild(emptyText);
        emptyMessage.appendChild(addBtn);
        
        const sequenceList = document.createElement('div');
        sequenceList.id = 'sequenceList';
        sequenceList.className = 'd-none';
        
        sequenceBuilder.appendChild(emptyMessage);
        sequenceBuilder.appendChild(sequenceList);
        
        sequenceGroup.appendChild(sequenceLabel);
        sequenceGroup.appendChild(sequenceBuilder);
        
        // Botones de acción
        const actionContainer = document.createElement('div');
        actionContainer.className = 'd-grid gap-2';
        
        const addMovementBtn = this.createButton(
            'Agregar Movimiento',
            'custom-btn-primary',
            'bi-plus-circle',
            () => this.addMovementToSequence()
        );
        
        const saveBtn = this.createButton(
            'Guardar Demo',
            'custom-btn-success',
            'bi-check-circle',
            () => this.saveDemo()
        );
        
        actionContainer.appendChild(addMovementBtn);
        actionContainer.appendChild(saveBtn);
        
        // Ensamblar todo
        container.appendChild(nameGroup);
        container.appendChild(descGroup);
        container.appendChild(sequenceGroup);
        container.appendChild(actionContainer);
        
        return container;
    }

    addMovementToSequence() {
        const movementStep = this.createMovementStep();
        const sequenceList = document.getElementById('sequenceList');
        const emptyMessage = document.getElementById('emptySequenceMessage');
        
        emptyMessage.classList.add('d-none');
        sequenceList.classList.remove('d-none');
        sequenceList.appendChild(movementStep);
        
        // Scroll to bottom
        sequenceList.scrollTop = sequenceList.scrollHeight;
    }

    createMovementStep() {
        const step = document.createElement('div');
        step.className = 'movement-step card custom-card mb-2';
        
        const cardBody = document.createElement('div');
        cardBody.className = 'card-body py-2';
        
        const row = document.createElement('div');
        row.className = 'row align-items-center';
        
        // Selector de operación
        const opCol = document.createElement('div');
        opCol.className = 'col-md-5';
        
        const opSelect = document.createElement('select');
        opSelect.className = 'form-select custom-select movement-operation';
        
        // Agregar opciones de movimiento
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
        
        Object.entries(operations).forEach(([key, value]) => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = value;
            opSelect.appendChild(option);
        });
        
        opCol.appendChild(opSelect);
        
        // Input de delay
        const delayCol = document.createElement('div');
        delayCol.className = 'col-md-4';
        
        const delayInputGroup = document.createElement('div');
        delayInputGroup.className = 'input-group';
        
        const delayInput = document.createElement('input');
        delayInput.type = 'number';
        delayInput.className = 'form-control custom-input movement-delay';
        delayInput.placeholder = 'Duración (ms)';
        delayInput.value = '2000';
        delayInput.min = '500';
        delayInput.step = '100';
        
        const delaySpan = document.createElement('span');
        delaySpan.className = 'input-group-text';
        delaySpan.textContent = 'ms';
        
        delayInputGroup.appendChild(delayInput);
        delayInputGroup.appendChild(delaySpan);
        delayCol.appendChild(delayInputGroup);
        
        // Botón eliminar
        const deleteCol = document.createElement('div');
        deleteCol.className = 'col-md-3';
        
        const deleteBtn = this.createButton(
            'Eliminar',
            'custom-btn-danger btn-sm w-100',
            'bi-trash',
            () => {
                step.remove();
                this.updateSequenceView();
            }
        );
        
        deleteCol.appendChild(deleteBtn);
        
        // Ensamblar
        row.appendChild(opCol);
        row.appendChild(delayCol);
        row.appendChild(deleteCol);
        cardBody.appendChild(row);
        step.appendChild(cardBody);
        
        return step;
    }

    updateSequenceView() {
        const sequenceList = document.getElementById('sequenceList');
        const emptyMessage = document.getElementById('emptySequenceMessage');
        
        if (sequenceList.children.length === 0) {
            emptyMessage.classList.remove('d-none');
            sequenceList.classList.add('d-none');
        }
    }

    async saveDemo() {
        const name = document.getElementById('demoName').value;
        const description = document.getElementById('demoDescription').value;
        const movements = [];
        
        document.querySelectorAll('.movement-step').forEach(step => {
            const operation = step.querySelector('.movement-operation').value;
            const delay = step.querySelector('.movement-delay').value;
            const operationText = this.getOperationText(parseInt(operation));
            
            movements.push({
                op: parseInt(operation),
                text: operationText,
                delay: parseInt(delay)
            });
        });
        
        if (!name || movements.length === 0) {
            this.showAlert('❌ Nombre y al menos un movimiento requeridos', 'danger');
            return;
        }
        
        const newDemo = {
            id_demo: Date.now(), // ID temporal
            nombre_demo: name,
            descripcion: description,
            secuencia: movements,
            fecha_creacion: new Date().toISOString()
        };
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/demos`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(newDemo)
            });
            
            if (response.ok) {
                this.showAlert('✅ Demo guardada correctamente', 'success');
                await this.loadDemos();
                this.closeModal('demoCreatorModal');
            } else {
                throw new Error('Error del servidor');
            }
        } catch (error) {
            // Si falla el servidor, guardar localmente
            this.demos.push(newDemo);
            this.updateDemosCount();
            this.showAlert('✅ Demo guardada localmente', 'success');
            this.closeModal('demoCreatorModal');
        }
    }

    showDemoManager() {
        this.createModal(
            'demoManagerModal',
            'Gestor de Demos',
            'custom-card-header-dark',
            this.createDemoManagerContent(),
            'large'
        );
    }

    createDemoManagerContent() {
        const container = document.createElement('div');
        
        // Botón crear nueva demo
        const createBtnContainer = document.createElement('div');
        createBtnContainer.className = 'd-grid gap-2 mb-3';
        
        const createBtn = this.createButton(
            'Crear Nueva Demo',
            'custom-btn-success',
            'bi-plus-circle',
            () => {
                this.closeModal('demoManagerModal');
                this.showDemoCreator();
            }
        );
        
        createBtnContainer.appendChild(createBtn);
        
        // Lista de demos
        const demoList = document.createElement('div');
        demoList.className = 'list-group custom-list-group';
        
        if (this.demos.length === 0) {
            const emptyItem = document.createElement('div');
            emptyItem.className = 'list-group-item text-center text-muted py-4';
            emptyItem.innerHTML = `
                <i class="bi bi-inbox display-4"></i>
                <p class="mt-3">No hay demos creadas</p>
                <small>Crea tu primera demo para comenzar</small>
            `;
            demoList.appendChild(emptyItem);
        } else {
            this.demos.forEach(demo => {
                const demoItem = this.createDemoListItem(demo);
                demoList.appendChild(demoItem);
            });
        }
        
        container.appendChild(createBtnContainer);
        container.appendChild(demoList);
        
        return container;
    }

    createDemoListItem(demo) {
        const item = document.createElement('div');
        item.className = 'list-group-item custom-list-group-item';
        
        const header = document.createElement('div');
        header.className = 'd-flex w-100 justify-content-between align-items-start';
        
        const title = document.createElement('h6');
        title.className = 'mb-1 text-purple';
        title.textContent = demo.nombre_demo;
        
        const date = document.createElement('small');
        date.className = 'text-muted';
        date.textContent = demo.fecha_creacion ? 
            new Date(demo.fecha_creacion).toLocaleDateString() : 'Recién creada';
        
        header.appendChild(title);
        header.appendChild(date);
        
        const description = document.createElement('p');
        description.className = 'mb-1';
        description.textContent = demo.descripcion;
        
        const sequenceInfo = document.createElement('small');
        sequenceInfo.className = 'text-muted';
        sequenceInfo.textContent = `Secuencia: ${demo.secuencia.length} movimientos`;
        
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'mt-2';
        
        const executeBtn = this.createButton(
            'Ejecutar',
            'custom-btn-primary btn-sm me-1',
            'bi-play-fill',
            () => {
                this.closeModal('demoManagerModal');
                this.startDemoMode(demo.secuencia);
            }
        );
        
        const deleteBtn = this.createButton(
            'Eliminar',
            'custom-btn-danger btn-sm',
            'bi-trash',
            () => this.deleteDemo(demo.id_demo)
        );
        
        buttonContainer.appendChild(executeBtn);
        buttonContainer.appendChild(deleteBtn);
        
        item.appendChild(header);
        item.appendChild(description);
        item.appendChild(sequenceInfo);
        item.appendChild(buttonContainer);
        
        return item;
    }

    async deleteDemo(demoId) {
        const demo = this.demos.find(d => d.id_demo === demoId);
        if (!demo) return;
        
        if (confirm(`¿Estás segura de que quieres eliminar la demo "${demo.nombre_demo}"?`)) {
            try {
                const response = await fetch(`${this.apiBaseUrl}/api/demos/${demoId}`, {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    this.showAlert('✅ Demo eliminada correctamente', 'success');
                    await this.loadDemos();
                    this.closeModal('demoManagerModal');
                }
            } catch (error) {
                // Si falla el servidor, eliminar localmente
                this.demos = this.demos.filter(d => d.id_demo !== demoId);
                this.updateDemosCount();
                this.showAlert('✅ Demo eliminada localmente', 'success');
                this.closeModal('demoManagerModal');
            }
        }
    }

    // ========== MÉTODOS AUXILIARES ==========

    createModal(id, title, headerClass, content, size = 'medium') {
        // Eliminar modal existente si hay
        const existingModal = document.getElementById(id);
        if (existingModal) {
            existingModal.remove();
        }
        
        const modal = document.createElement('div');
        modal.id = id;
        modal.className = 'modal fade';
        modal.tabIndex = -1;
        
        const modalDialog = document.createElement('div');
        modalDialog.className = size === 'large' ? 'modal-dialog modal-lg' : 'modal-dialog';
        
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content custom-card';
        
        // Header
        const modalHeader = document.createElement('div');
        modalHeader.className = `modal-header ${headerClass}`;
        
        const modalTitle = document.createElement('h5');
        modalTitle.className = 'modal-title';
        modalTitle.textContent = title;
        
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'btn-close';
        closeBtn.setAttribute('data-bs-dismiss', 'modal');
        
        modalHeader.appendChild(modalTitle);
        modalHeader.appendChild(closeBtn);
        
        // Body
        const modalBody = document.createElement('div');
        modalBody.className = 'modal-body';
        modalBody.appendChild(content);
        
        modalContent.appendChild(modalHeader);
        modalContent.appendChild(modalBody);
        modalDialog.appendChild(modalContent);
        modal.appendChild(modalDialog);
        
        document.body.appendChild(modal);
        
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
        
        modal.addEventListener('hidden.bs.modal', () => {
            modal.remove();
        });
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            const bsModal = bootstrap.Modal.getInstance(modal);
            if (bsModal) {
                bsModal.hide();
            }
        }
    }

    createButton(text, btnClass, iconClass, onClick) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `btn ${btnClass}`;
        button.innerHTML = `<i class="bi ${iconClass}"></i> ${text}`;
        button.addEventListener('click', onClick);
        return button;
    }

    createFormGroup(labelText, inputType, inputId, placeholder, value = '') {
        const group = document.createElement('div');
        group.className = 'mb-3';
        
        const label = document.createElement('label');
        label.className = 'form-label';
        label.textContent = labelText;
        
        const input = document.createElement('input');
        input.type = inputType;
        input.id = inputId;
        input.className = 'form-control custom-input';
        input.placeholder = placeholder;
        if (value) input.value = value;
        
        group.appendChild(label);
        group.appendChild(input);
        
        return group;
    }

    startCounters() {
        // Contador de tiempo activo
        setInterval(() => {
            const uptime = Math.floor((Date.now() - this.startTime) / 1000);
            document.getElementById('uptimeCounter').textContent = `${uptime}s`;
        }, 1000);
    }

    // ========== MÉTODOS EXISTENTES ==========

    connectWebSocket() {
        if (this.wsUrl) {
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
        
        setTimeout(() => {
            if (alertDiv.parentNode) alertDiv.remove();
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
            <small>${new Date().toLocaleTimeString()}</small><br>
            ${message}
        `;
        container.appendChild(messageDiv);
        container.scrollTop = container.scrollHeight;

        if (container.children.length > 50) {
            container.removeChild(container.firstChild);
        }
    }
}

// Inicializar aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.app = new CarControlApp();
});