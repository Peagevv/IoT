class CarControlApp {
    constructor() {
        this.apiBaseUrl = 'http://98.91.159.217:5500';
        
        // ==========================================
        // CONFIGURACIÓN WEBSOCKET (PRINCIPAL) - GLOBAL
        // ==========================================
        this.WS_HOST = '98.91.159.217';
        this.WS_PORT = 5501;
        this.WS_PATH = '/client';
        this.WS_URL = `ws://${this.WS_HOST}:${this.WS_PORT}${this.WS_PATH}`;
        
        // ✅ WebSocket global
        this.ws = null;
        this.isWSConnected = false;
        this.carConnected = false;
        
        // ==========================================
        // SISTEMA DE MODOS
        // ==========================================
        this.currentMode = 'manual'; // manual o sequence
        this.modeChangePending = false;
        
        // ==========================================
        // CONTROL DE VELOCIDAD
        // ==========================================
        this.currentSpeed = 'medium'; // Velocidad por defecto
        
        // Mapeo de velocidades a valores PWM para el Arduino
        this.SPEED_VALUES = {
            low: 100,      // ~40% velocidad
            medium: 150,   // ~60% velocidad (actual)
            high: 200      // ~80% velocidad
        };
        
        // ==========================================
        // MAPEO CORREGIDO PARA COINCIDIR CON LA API
        // ==========================================
        this.OPERATIONS = {
            // BÁSICOS
            1: { command: 'forward', duration: 1000, name: 'Adelante' },
            2: { command: 'backward', duration: 1000, name: 'Atrás' },
            3: { command: 'stop', duration: 100, name: 'Detener' },
            
            // VUELTAS ADELANTE
            4: { command: 'curve_forward_right', duration: 800, name: 'Vuelta Adelante Der.' },
            5: { command: 'curve_forward_left', duration: 800, name: 'Vuelta Adelante Izq.' },
            
            // VUELTAS ATRÁS
            6: { command: 'curve_backward_right', duration: 800, name: 'Vuelta Atrás Der.' },
            7: { command: 'curve_backward_left', duration: 800, name: 'Vuelta Atrás Izq.' },
            
            // GIROS 90°
            8: { command: 'turn_right', duration: 500, name: 'Giro 90° Derecha' },
            9: { command: 'turn_left', duration: 500, name: 'Giro 90° Izquierda' },
            
            // GIROS 360°
            10: { command: 'spin_right', duration: 2000, name: 'Giro 360° Derecha' },
            11: { command: 'spin_left', duration: 2000, name: 'Giro 360° Izquierda' }
        };

        this.isConnected = false;
        this.currentDevice = 1;
        this.isDemoRunning = false;
        this.devices = [];
        this.sequences = [];
        this.commandHistory = [];
        this.obstacleHistory = [];
        
        // ==========================================
        // SISTEMA DE DETECCIÓN DE OBSTÁCULOS
        // ==========================================
        this.initializeObstacleDetection();
        
        this.initializeEventListeners();
        this.connectWebSocket();
        this.initializeStatusUpdates();
        
        // ✅ Cargar datos iniciales via WebSocket
        setTimeout(() => this.loadInitialData(), 1000);
    }

    // ✅ CONVERTIDO: Método único para cargar datos iniciales via WebSocket
    async loadInitialData() {
        console.log('📊 Solicitando datos iniciales via WebSocket...');
        
        if (!this.isWSConnected) {
            console.log('⏳ WebSocket no conectado, reintentando en 1 segundo...');
            setTimeout(() => this.loadInitialData(), 1000);
            return;
        }
        
        // Solicitar dispositivos
        this.sendWSMessage({ type: "get_devices" });
        
        // Solicitar secuencias
        this.sendWSMessage({ type: "get_sequences" });
        
        // Solicitar obstáculos
        this.sendWSMessage({ 
            type: "get_obstacles",
            device_id: this.currentDevice,
            limit: 10
        });
        
        // ✅ NUEVO: Solicitar movimientos
        this.sendWSMessage({ 
            type: "get_commands",
            device_id: this.currentDevice,
            limit: 10
        });

        console.log('🎉 Todos los datos solicitados via WebSocket');
    }

    // ==========================================
    // ✅ NUEVO: CARGAR MOVIMIENTOS VIA WEBSOCKET
    // ==========================================

    async loadMovementsWS() {
        this.sendWSMessage({ 
            type: "get_commands",
            device_id: this.currentDevice,
            limit: 10
        });
    }

    // ==========================================
    // ✅ NUEVO: MOSTRAR TABLA DE MOVIMIENTOS
    // ==========================================

    displayMovementsTable(movements) {
        const container = document.getElementById('movementsTable');
        if (!container) {
            console.log('❌ No se encontró el contenedor movementsTable');
            return;
        }
        
        if (!movements || movements.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="bi bi-inbox display-6"></i>
                    <p class="mt-2">No hay movimientos registrados</p>
                </div>
            `;
            return;
        }

        let html = `
            <div class="table-responsive">
                <table class="table table-striped table-hover table-sm">
                    <thead class="table-dark">
                        <tr>
                            <th>#</th>
                            <th>Operación</th>
                            <th>Dispositivo</th>
                            <th>Fecha/Hora</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        // Mostrar solo los últimos 10 movimientos
        const lastMovements = movements.slice(-10);
        
        lastMovements.forEach((movement, index) => {
            const date = new Date(movement.fecha_hora).toLocaleString();
            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td>
                        <span class="badge bg-primary">${movement.status_texto}</span>
                    </td>
                    <td>${movement.nombre_dispositivo || `Dispositivo ${movement.id_dispositivo}`}</td>
                    <td><small>${date}</small></td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
                <div class="text-muted text-center small">
                    Mostrando los últimos ${lastMovements.length} movimientos
                </div>
            </div>
        `;

        container.innerHTML = html;
        console.log('✅ Tabla de movimientos actualizada:', lastMovements.length, 'registros');
    }

    // ==========================================
    // WEBSOCKET - SISTEMA COMPLETO DE TIEMPO REAL
    // ==========================================

    connectWebSocket() {
        console.log('🔌 Conectando a WebSocket...', this.WS_URL);
        
        try {
            this.ws = new WebSocket(this.WS_URL);
            
            this.ws.onopen = () => {
                console.log('✅ WebSocket conectado');
                this.isWSConnected = true;
                this.updateServerStatus(true);
                this.showNotification('Conectado al servidor WebSocket', 'success');
                
                // Cargar datos una vez conectado
                setTimeout(() => this.loadInitialData(), 500);
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('🔍 DEBUG - Mensaje WebSocket recibido:', data);
                    
                    // ========== SISTEMA DE ACTUALIZACIÓN EN TIEMPO REAL ==========
                    if (data.type === 'data_updated') {
                        console.log('🎯 DEBUG - Actualización de datos detectada:', data.update_type);
                        this.handleDataUpdate(data.update_type, data.data);
                    }
                    
                    // ========== RESPUESTAS A SOLICITUDES ESPECÍFICAS ==========
                    else if (data.type === 'devices_list') {
                        console.log('📱 Lista de dispositivos recibida:', data.data);
                        this.devices = data.data;
                        this.populateDeviceSelect(this.devices);
                        this.renderDevicesList(this.devices);
                    }
                    
                    else if (data.type === 'sequences_list') {
                        console.log('📜 Lista de secuencias recibida:', data.data);
                        this.sequences = data.data;
                        this.renderSequencesList(this.sequences);
                    }
                    
                    else if (data.type === 'obstacles_list') {
                        console.log('🛑 Lista de obstáculos recibida:', data.data);
                        this.updateObstaclesTable(data.data);
                    }
                    
                    else if (data.type === 'commands_list') {
                        console.log('🎮 Lista de comandos recibida:', data.data);
                        this.displayMovementsTable(data.data);
                    }
                    
                    // ========== COMANDO EJECUTADO ==========
                    else if (data.type === 'command_executed') {
                        console.log(`✅ Comando "${data.command}" ejecutado`);
                        this.showNotification(`Comando ${data.command} ejecutado`, 'success');
                        
                        // Actualizar tabla de movimientos automáticamente
                        this.refreshCommandsDisplay();
                    }
                    
                    // ========== ESTADO DEL CARRO ==========
                    else if (data.type === 'car_status') {
                        this.updateCarStatus(data.status === 'connected');
                        if (data.status === 'connected') {
                            this.showNotification('Carro conectado', 'success');
                        } else {
                            this.showNotification('Carro desconectado', 'warning');
                        }
                    }
                    
                    // ========== HEARTBEAT (BATERÍA) ==========
                    else if (data.type === 'car_heartbeat') {
                        this.updateBattery(data.battery);
                        this.updateCarStatus(true);
                    }
                    
                    // ========== MANEJO DE EVENTOS DE MODO ==========
                    else if (data.event === 'mode_changed') {
                        this.currentMode = data.autonomous_mode ? 'sequence' : 'manual';
                        this.updateModeIndicator(this.currentMode);
                        this.modeChangePending = false;
                        console.log(`✅ Modo cambiado a: ${this.currentMode}`);
                    }
                    
                    // ========== OBSTÁCULO DETECTADO EN MODO MANUAL ==========
                    else if ((data.event === 'obstacle_detected' || data.type === 'obstacle_detected') && this.currentMode === 'manual') {
                        const distance = data.distance || data.obstacle_distance || 0;
                        this.showObstacleAlertManual(distance);
                        this.playAlertSound();
                        
                        // Actualizar tabla de obstáculos automáticamente
                        this.refreshObstaclesDisplay();
                    }
                    
                    // ========== OBSTÁCULO ESQUIVADO EN MODO SECUENCIA ==========
                    else if (data.event === 'obstacle_avoided' && this.currentMode === 'sequence') {
                        const distance = data.distance || 0;
                        this.showObstacleAvoidedAuto(distance);
                    }
                    
                    // ========== OBSTÁCULOS DETECTADOS POR EL CARRO ==========
                    else if (data.type === 'obstacle_detected') {
                        console.log('🛑 OBSTÁCULO DETECTADO POR EL CARRO:', data);
                        
                        this.addObstacleToTableRealTime({
                            status_texto: 'Obstáculo detectado automáticamente',
                            distance: data.distance,
                            location: data.location || 'front',
                            distancia_detectada: data.distance,
                            ubicacion: this.getLocationText(data.location || 'front'),
                            fecha_hora: new Date().toISOString(),
                            automatico: true
                        });
                        
                        this.updateObstacleCounter();
                        this.handleObstacleDetection(data);
                        
                        // Actualizar tabla de obstáculos automáticamente
                        this.refreshObstaclesDisplay();
                    }
                    
                    // ========== VÍA LIBRE ==========
                    else if (data.type === 'path_clear') {
                        console.log('✅ VÍA LIBRE:', data);
                        this.handlePathClear(data);
                    }
                    
                    // ========== HEARTBEAT CON OBSTÁCULOS ==========
                    else if (data.type === 'car_heartbeat' && data.obstacle_detected !== undefined) {
                        this.updateObstacleStatusFromHeartbeat(data);
                    }

                    // ========== RESPUESTAS DE CREACIÓN/ELIMINACIÓN ==========
                    else if (data.type === 'obstacle_created') {
                        console.log('✅ Obstáculo creado via WebSocket:', data);
                        this.showNotification('✅ Obstáculo registrado correctamente', 'success');
                        // Actualizar tabla de obstáculos automáticamente
                        this.refreshObstaclesDisplay();
                    }

                    else if (data.type === 'obstacle_deleted') {
                        console.log('✅ Obstáculo eliminado via WebSocket:', data);
                        this.showNotification('✅ Obstáculo eliminado correctamente', 'success');
                        // Actualizar tabla de obstáculos automáticamente
                        this.refreshObstaclesDisplay();
                    }

                    else if (data.type === 'device_created' || data.type === 'device_updated') {
                        console.log('✅ Dispositivo guardado via WebSocket:', data);
                        this.showNotification('✅ Dispositivo guardado correctamente', 'success');
                        // Recargar lista de dispositivos automáticamente
                        this.refreshDevicesDisplay();
                    }

                    else if (data.type === 'device_deleted') {
                        console.log('✅ Dispositivo eliminado via WebSocket:', data);
                        this.showNotification('✅ Dispositivo eliminado correctamente', 'success');
                        // Recargar lista de dispositivos automáticamente
                        this.refreshDevicesDisplay();
                    }

                    else if (data.type === 'sequence_created' || data.type === 'sequence_updated') {
                        console.log('✅ Secuencia guardada via WebSocket:', data);
                        this.showNotification('✅ Secuencia guardada correctamente', 'success');
                        // Recargar lista de secuencias automáticamente
                        this.refreshSequencesDisplay();
                    }

                    else if (data.type === 'sequence_deleted') {
                        console.log('✅ Secuencia eliminada via WebSocket:', data);
                        this.showNotification('✅ Secuencia eliminada correctamente', 'success');
                        // Recargar lista de secuencias automáticamente
                        this.refreshSequencesDisplay();
                    }
                    
                    // ========== RESPUESTA DE COMANDO ==========
                    else if (data.status === 'success') {
                        console.log(`✅ Comando aceptado por servidor: ${data.message}`);
                        if (data.cars_reached === 0) {
                            this.showNotification('No hay carros conectados', 'warning');
                            this.updateCarStatus(false);
                        } else {
                            this.updateCarStatus(true);
                        }
                    }
                    
                    // ========== MENSAJE DE BIENVENIDA ==========
                    else if (data.status === 'connected' && data.type === 'client') {
                        console.log(`Carros disponibles: ${data.cars_connected}`);
                        if (data.cars_connected > 0) {
                            this.updateCarStatus(true);
                        }
                    }
                    
                } catch (e) {
                    console.error('❌ Error procesando mensaje WebSocket:', e);
                }
            };
            
            this.ws.onerror = (error) => {
                console.error('❌ WebSocket error:', error);
                this.isWSConnected = false;
                this.updateServerStatus(false);
                this.showNotification('Error de conexión WebSocket', 'error');
            };
            
            this.ws.onclose = (event) => {
                console.log('🔌 WebSocket desconectado:', event.code, event.reason);
                this.isWSConnected = false;
                this.updateServerStatus(false);
                
                // Reconectar después de 5 segundos
                setTimeout(() => {
                    console.log('🔄 Intentando reconectar WebSocket...');
                    this.connectWebSocket();
                }, 5000);
            };
            
        } catch (error) {
            console.error('Error creando WebSocket:', error);
            this.isWSConnected = false;
            this.updateServerStatus(false);
        }
    }

    // ==========================================
    // ✅ ENVIAR MENSAJES WEBSOCKET
    // ==========================================

    sendWSMessage(message) {
        if (this.isWSConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(JSON.stringify(message));
                console.log('📤 Mensaje WebSocket enviado:', message);
                return true;
            } catch (error) {
                console.error('❌ Error enviando mensaje WebSocket:', error);
                return false;
            }
        } else {
            console.warn('⚠️ WebSocket no conectado, mensaje no enviado:', message);
            this.showNotification('⚠️ No conectado al servidor', 'warning');
            return false;
        }
    }

    // ==========================================
    // ✅ SISTEMA DE ACTUALIZACIÓN EN TIEMPO REAL CORREGIDO
    // ==========================================

    handleDataUpdate(updateType, data) {
        console.log(`🔄 Procesando actualización: ${updateType}`, data);
        
        switch(updateType) {
            case 'commands':
                console.log('🔄 Actualizando tabla de comandos/movimientos...');
                this.refreshCommandsDisplay();
                break;
                
            case 'obstacles':
                console.log('🔄 Actualizando tabla de obstáculos...');
                this.refreshObstaclesDisplay();
                break;
                
            case 'devices':
                console.log('🔄 Actualizando lista de dispositivos...');
                this.refreshDevicesDisplay();
                break;
                
            case 'sequences':
                console.log('🔄 Actualizando lista de secuencias...');
                this.refreshSequencesDisplay();
                break;
                
            default:
                console.log(`📊 Actualización no manejada: ${updateType}`);
        }
        
        // Mostrar notificación al usuario
        this.showWsMessage(`📊 ${this.getUpdateTypeText(updateType)} actualizado`, 'info');
    }

    getUpdateTypeText(updateType) {
        const types = {
            'commands': 'Comandos',
            'obstacles': 'Obstáculos',
            'devices': 'Dispositivos', 
            'sequences': 'Secuencias'
        };
        return types[updateType] || updateType;
    }

    async refreshCommandsDisplay() {
        console.log('🔄 Solicitando actualización de comandos...');
        await this.loadMovementsWS();
    }

    async refreshObstaclesDisplay() {
        console.log('🔄 Solicitando actualización de obstáculos...');
        this.sendWSMessage({ 
            type: "get_obstacles",
            device_id: this.currentDevice,
            limit: 10
        });
    }

    async refreshDevicesDisplay() {
        console.log('🔄 Solicitando actualización de dispositivos...');
        this.sendWSMessage({ type: "get_devices" });
    }

    async refreshSequencesDisplay() {
        console.log('🔄 Solicitando actualización de secuencias...');
        this.sendWSMessage({ type: "get_sequences" });
    }

    // ==========================================
    // ✅ NOTIFICAR ACTUALIZACIONES VIA WEBSOCKET
    // ==========================================

    notifyDataUpdate(updateType, data = null) {
        const message = {
            type: 'data_update_notification',
            update_type: updateType,
            data: data,
            timestamp: new Date().toISOString(),
            device_id: this.currentDevice,
            action: 'refresh'
        };
        
        this.sendWSMessage(message);
    }

    // ==========================================
    // ✅ GUARDAR COMANDOS EN BASE DE DATOS CON NOTIFICACIÓN
    // ==========================================

    async saveCommandToDatabase(command) {
        try {
            console.log('💾 Guardando comando en BD:', command);
            
            const commandToOperationId = {
                'forward': 1, 'backward': 2, 'stop': 3,
                'curve_forward_right': 4, 'curve_forward_left': 5,
                'curve_backward_right': 6, 'curve_backward_left': 7,
                'turn_right': 8, 'turn_left': 9,
                'spin_right': 10, 'spin_left': 11
            };
            
            const operationId = commandToOperationId[command] || 0;
            const operationText = this.getOperationText(operationId);
            
            const commandData = {
                type: 'create_command',
                id_dispositivo: this.currentDevice,
                status_operacion: operationId,
                status_texto: operationText,
                fecha_hora: new Date().toISOString()
            };
            
            if (this.sendWSMessage(commandData)) {
                console.log('✅ Comando enviado para guardar en BD:', operationText);
                this.showNotification(`✅ ${operationText} guardado en historial`, 'success');
                
                // ✅ NOTIFICAR A TODOS LOS CLIENTES SOBRE EL CAMBIO
                this.notifyDataUpdate('commands', {
                    command: command,
                    operation_text: operationText,
                    device_id: this.currentDevice
                });
                
                // Actualizar tabla de movimientos después de un breve delay
                setTimeout(() => this.refreshCommandsDisplay(), 1000);
            }
                
        } catch (error) {
            console.error('❌ Error guardando comando en BD:', error);
        }
    }

    // ==========================================
    // CONTROL DE VELOCIDAD
    // ==========================================

    setSpeed(speed) {
        this.currentSpeed = speed;
        
        // Actualizar UI
        document.querySelectorAll('.speed-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`.speed-btn[data-speed="${speed}"]`).classList.add('active');
        
        // Actualizar badge
        const badge = document.getElementById('currentSpeed');
        if (badge) {
            badge.textContent = speed === 'low' ? 'Baja' : speed === 'medium' ? 'Media' : 'Alta';
            badge.className = 'badge ' + (speed === 'low' ? 'bg-success' : speed === 'medium' ? 'bg-warning' : 'bg-danger');
        }
        
        // Enviar al Arduino via WebSocket
        const message = {
            command: 'set_speed',
            speed: this.SPEED_VALUES[speed],
            timestamp: new Date().toISOString()
        };
        
        this.sendWSMessage(message);
        console.log(`⚡ Velocidad cambiada a: ${speed} (${this.SPEED_VALUES[speed]} PWM)`);
        this.showNotification(`Velocidad: ${badge.textContent}`, 'info');
    }

    // ==========================================
    // ENVIAR COMANDOS WEBSOCKET
    // ==========================================

    sendWSCommand(operationId) {
        const operation = this.OPERATIONS[operationId];
        
        if (!operation) {
            console.error(`Operación ${operationId} no encontrada`);
            this.showNotification(`Operación ${operationId} no encontrada`, 'error');
            return;
        }
        
        if (!this.isWSConnected) {
            this.showNotification('No conectado al servidor WebSocket', 'error');
            return;
        }

        // Verificar obstáculos antes de movimientos hacia adelante
        if ((operation.command === 'forward' || 
             operation.command === 'curve_forward_right' || 
             operation.command === 'curve_forward_left') && 
            this.obstacleStatus.detected) {
            
            console.log('🚫 Movimiento bloqueado - Obstáculo detectado');
            this.showNotification(`⚠️ Movimiento bloqueado - Obstáculo detectado a ${this.obstacleStatus.distance}cm`, 'warning');
            
            const blockedMessage = {
                type: 'movement_blocked',
                command: operation.command,
                reason: 'obstacle_detected',
                distance: this.obstacleStatus.distance,
                location: this.obstacleStatus.location,
                timestamp: new Date().toISOString()
            };
            this.sendWSMessage(blockedMessage);
            return;
        }
        
        const message = {
            command: operation.command,
            duration: operation.duration,
            speed: this.SPEED_VALUES[this.currentSpeed],
            timestamp: new Date().toISOString()
        };
        
        console.log(`📤 Enviando comando al servidor: ${operation.name} a velocidad ${this.currentSpeed}`);
        
        try {
            if (this.sendWSMessage(message)) {
                this.showNotification(`Ejecutando: ${operation.name} (Velocidad: ${this.currentSpeed})`, 'info');
                
                this.addToCommandHistory({
                    id_dispositivo: this.currentDevice,
                    status_operacion: operationId,
                    status_texto: this.getOperationText(operationId)
                });
                
                // Programar actualización de la tabla de movimientos
                setTimeout(() => this.refreshCommandsDisplay(), 1500);
            }
            
        } catch (error) {
            console.error('Error enviando comando WebSocket:', error);
            this.showNotification('Error enviando comando', 'error');
        }
    }

    // ==========================================
    // SISTEMA DE MODOS
    // ==========================================

    setMode(mode) {
        if (!this.isWSConnected) {
            this.showNotification('❌ No conectado al carro', 'error');
            return;
        }
        
        this.currentMode = mode;
        this.modeChangePending = true;
        
        const message = {
            command: 'toggle_autonomous'
        };
        
        this.sendWSMessage(message);
        console.log(`🔄 Cambiando a modo: ${mode}`);
        this.showNotification(`🔄 Cambiando a modo: ${mode}`, 'info');
        
        this.updateModeIndicator(mode);
    }

    updateModeIndicator(mode) {
        const indicator = document.getElementById('modeIndicator');
        if (indicator) {
            indicator.textContent = mode === 'manual' ? '🎮 MODO MANUAL' : '🤖 MODO AUTÓNOMO';
            indicator.className = `mode-indicator ${mode}`;
        }
        
        // Actualizar botones de modo
        const manualBtn = document.querySelector('[onclick*="setManualMode"]');
        const autoBtn = document.querySelector('[onclick*="setAutoMode"]');
        
        if (manualBtn && autoBtn) {
            manualBtn.classList.toggle('active', mode === 'manual');
            autoBtn.classList.toggle('active', mode === 'sequence');
        }
    }

    // ==========================================
    // GESTIÓN DE DISPOSITIVOS (CON NOTIFICACIONES)
    // ==========================================

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
        if (!container) return;
        
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
                            <strong>Descripción:</strong> ${device.descripcion || 'Sin descripción'}<br>
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
                            <button class="btn btn-sm custom-btn-warning" onclick="app.openDeviceModal(${JSON.stringify(device).replace(/"/g, '&quot;')})">
                                <i class="bi bi-pencil"></i> Editar
                            </button>
                            <button class="btn btn-sm custom-btn-stop" onclick="app.deleteDevice(${device.id_dispositivo})">
                                <i class="bi bi-trash"></i> Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    selectDevice(deviceId) {
        const oldDevice = this.currentDevice;
        this.currentDevice = deviceId;
        
        document.getElementById('deviceSelect').value = deviceId;
        
        this.showAlert(`Cambiado a: ${document.getElementById('deviceSelect').options[document.getElementById('deviceSelect').selectedIndex].text}`, 'info');
        this.updateCurrentStatus();
        
        // Recargar datos del nuevo dispositivo
        this.refreshObstaclesDisplay();
        this.refreshCommandsDisplay();
        
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

    saveDevice() {
        const id = document.getElementById('deviceId').value;
        const name = document.getElementById('deviceName').value.trim();
        const description = document.getElementById('deviceDescription').value.trim();

        if (!name) {
            this.showAlert('⚠️ El nombre del dispositivo es requerido', 'warning');
            return;
        }

        if (!this.isWSConnected) {
            this.showAlert('❌ No conectado al servidor', 'danger');
            return;
        }

        const deviceData = {
            type: id ? 'update_device' : 'create_device',
            device_id: id || null,
            nombre_dispositivo: name,
            descripcion: description,
            timestamp: new Date().toISOString()
        };

        if (this.sendWSMessage(deviceData)) {
            console.log('💾 Enviando dispositivo via WebSocket:', deviceData);
            
            // Cerrar modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('deviceModal'));
            if (modal) modal.hide();
            
            this.showAlert(`✅ Dispositivo ${id ? 'actualizado' : 'creado'} via WebSocket`, 'success');
            
            // ✅ NOTIFICAR ACTUALIZACIÓN
            this.notifyDataUpdate('devices');
        }
    }

    deleteDevice(deviceId) {
        if (!confirm('¿Estás seguro de eliminar este dispositivo? Esta acción no se puede deshacer.')) {
            return;
        }

        if (!this.isWSConnected) {
            this.showAlert('❌ No conectado al servidor', 'danger');
            return;
        }

        const deleteData = {
            type: 'delete_device',
            device_id: deviceId,
            timestamp: new Date().toISOString()
        };

        if (this.sendWSMessage(deleteData)) {
            console.log('🗑️ Enviando eliminación de dispositivo via WebSocket:', deleteData);
            
            // ✅ NOTIFICAR ACTUALIZACIÓN
            setTimeout(() => this.notifyDataUpdate('devices'), 500);
        }
    }

    // ==========================================
    // GESTIÓN DE SECUENCIAS (CON NOTIFICACIONES)
    // ==========================================

    renderSequencesList(sequences) {
        const container = document.getElementById('sequencesList');
        if (!container) return;
        
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
                                <button class="btn btn-sm custom-btn-demo" onclick="app.executeSequenceWithMode(${seq.id_secuencia})">
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
            
            let operationsString;
            if (Array.isArray(sequence.operaciones)) {
                operationsString = sequence.operaciones.join(',');
            } else {
                operationsString = sequence.operaciones || '';
            }
            document.getElementById('sequenceOperations').value = operationsString;
        } else {
            document.getElementById('sequenceModalTitle'). textContent = 'Nueva Secuencia';
            document.getElementById('sequenceForm').reset();
            document.getElementById('sequenceId').value = '';
            document.getElementById('sequenceDevice').value = this.currentDevice;
        }
        
        modal.show();
    }

    saveSequence() {
        const id = document.getElementById('sequenceId').value;
        const name = document.getElementById('sequenceName').value.trim();
        const device = parseInt(document.getElementById('sequenceDevice').value);
        const operations = document.getElementById('sequenceOperations').value.trim();

        if (!name || !device || !operations) {
            this.showAlert('⚠️ Por favor completa todos los campos', 'warning');
            return;
        }

        const opsArray = operations.split(',').map(op => parseInt(op.trim()));
        const validOps = opsArray.every(op => !isNaN(op) && op >= 1 && op <= 11);
        
        if (!validOps) {
            this.showAlert('⚠️ Las operaciones deben ser números entre 1 y 11 separados por comas', 'warning');
            return;
        }

        if (!this.isWSConnected) {
            this.showAlert('❌ No conectado al servidor', 'danger');
            return;
        }

        const sequenceData = {
            type: id ? 'update_sequence' : 'create_sequence',
            sequence_id: id || null,
            id_dispositivo: device,
            nombre_secuencia: name,
            movimientos: opsArray,
            timestamp: new Date().toISOString()
        };

        if (this.sendWSMessage(sequenceData)) {
            console.log('💾 Enviando secuencia via WebSocket:', sequenceData);
            
            // Cerrar modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('sequenceModal'));
            if (modal) modal.hide();
            
            this.showAlert(`✅ Secuencia ${id ? 'actualizada' : 'creada'} via WebSocket`, 'success');
            
            // ✅ NOTIFICAR ACTUALIZACIÓN
            this.notifyDataUpdate('sequences');
        }
    }

    deleteSequence(id) {
        if (!confirm('¿Estás seguro de eliminar esta secuencia?')) {
            return;
        }

        if (!this.isWSConnected) {
            this.showAlert('❌ No conectado al servidor', 'danger');
            return;
        }

        const deleteData = {
            type: 'delete_sequence',
            sequence_id: id,
            timestamp: new Date().toISOString()
        };

        if (this.sendWSMessage(deleteData)) {
            console.log('🗑️ Enviando eliminación de secuencia via WebSocket:', deleteData);
            
            // ✅ NOTIFICAR ACTUALIZACIÓN
            setTimeout(() => this.notifyDataUpdate('sequences'), 500);
        }
    }

    // ==========================================
    // GESTIÓN DE OBSTÁCULOS (CON NOTIFICACIONES)
    // ==========================================

    createManualObstacle(ubicacion) {
        if (!this.isWSConnected) {
            this.showAlert('❌ No conectado al servidor', 'danger');
            return;
        }

        const obstacleMapping = {
            'frente': 1,
            'izquierda': 2,
            'derecha': 3,
            'atras': 5,
            'retroceso': 5
        };

        const status_obstaculo = obstacleMapping[ubicacion];
        const descripcion = `Obstáculo manual en ${ubicacion}`;

        const obstacleData = {
            type: 'create_manual_obstacle',
            id_dispositivo: this.currentDevice,
            status_obstaculo: status_obstaculo,
            ubicacion: ubicacion,
            descripcion: descripcion,
            timestamp: new Date().toISOString()
        };

        if (this.sendWSMessage(obstacleData)) {
            console.log('📤 Enviando obstáculo manual via WebSocket:', obstacleData);
            this.showAlert(`✅ Obstáculo en ${ubicacion} registrado via WebSocket`, 'success');
            
            // ✅ NOTIFICAR ACTUALIZACIÓN
            setTimeout(() => this.notifyDataUpdate('obstacles'), 500);
        }
    }

    deleteManualObstacle(obstacleId) {
        if (!confirm('¿Eliminar este obstáculo manual?')) {
            return;
        }

        if (!this.isWSConnected) {
            this.showAlert('❌ No conectado al servidor', 'danger');
            return;
        }

        const deleteData = {
            type: 'delete_manual_obstacle',
            obstacle_id: obstacleId,
            timestamp: new Date().toISOString()
        };

        if (this.sendWSMessage(deleteData)) {
            console.log('🗑️ Enviando eliminación de obstáculo via WebSocket:', deleteData);
            
            // ✅ NOTIFICAR ACTUALIZACIÓN
            setTimeout(() => this.notifyDataUpdate('obstacles'), 500);
        }
    }

    clearManualObstacles() {
        if (!confirm('¿Eliminar todos los obstáculos manuales?')) {
            return;
        }

        if (!this.isWSConnected) {
            this.showAlert('❌ No conectado al servidor', 'danger');
            return;
        }

        const clearData = {
            type: 'clear_manual_obstacles',
            device_id: this.currentDevice,
            timestamp: new Date().toISOString()
        };

        if (this.sendWSMessage(clearData)) {
            console.log('🧹 Enviando limpieza de obstáculos via WebSocket:', clearData);
            this.showAlert('✅ Limpiando obstáculos manuales via WebSocket', 'success');
            
            // ✅ NOTIFICAR ACTUALIZACIÓN
            setTimeout(() => this.notifyDataUpdate('obstacles'), 500);
        }
    }

    // ==========================================
    // ACTUALIZAR TABLA DE OBSTÁCULOS
    // ==========================================

    updateObstaclesTable(obstacles) {
        const container = document.getElementById('manualObstaclesList');
        if (!container) {
            console.log('❌ No se encontró el contenedor manualObstaclesList');
            return;
        }
        
        if (obstacles.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-3">
                    <i class="bi bi-shield-check display-6"></i>
                    <p class="mt-2">No hay obstáculos manuales registrados</p>
                </div>
            `;
            return;
        }

        // Mostrar solo los últimos 10 obstáculos
        const lastObstacles = obstacles.slice(-10);

        container.innerHTML = lastObstacles.map(obs => `
            <div class="alert alert-warning mb-2" data-obstacle-id="${obs.id_evento}">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <strong>${obs.status_texto}</strong><br>
                        <small>Ubicación: ${obs.ubicacion}</small><br>
                        <small>${new Date(obs.fecha_hora).toLocaleTimeString()}</small>
                    </div>
                    <button class="btn btn-sm btn-outline-danger" onclick="app.deleteManualObstacle(${obs.id_evento})">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');

        console.log('✅ Tabla de obstáculos actualizada:', lastObstacles.length, 'registros');
    }

    // ==========================================
    // EJECUCIÓN DE SECUENCIAS
    // ==========================================

    async executeSequenceWithMode(sequenceId) {
        this.setMode('sequence');
        await this.sleep(1000);
        await this.executeSequence(sequenceId);
        this.onSequenceComplete();
    }

    async executeSequence(sequenceId) {
        if (!this.isWSConnected) {
            this.showAlert('❌ No conectado al servidor WebSocket', 'danger');
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
        
        if (sequence.id_dispositivo !== this.currentDevice) {
            this.selectDevice(sequence.id_dispositivo);
            await this.sleep(1000);
        }

        let operations;
        if (Array.isArray(sequence.operaciones)) {
            operations = sequence.operaciones;
        } else {
            operations = sequence.operaciones ? sequence.operaciones.split(',').map(op => parseInt(op.trim())) : [];
        }
        
        this.showAlert(`🚀 Ejecutando secuencia: ${sequence.nombre_secuencia}`, 'info');
        this.showWsMessage(`🎬 Iniciando secuencia: ${sequence.nombre_secuencia}`, 'info');

        // Enviar comando de inicio de secuencia
        const startSequenceData = {
            command: "start_sequence",
            sequence_id: sequenceId,
            operations: sequence,
            timestamp: new Date().toISOString()
        };
        
        this.sendWSMessage(startSequenceData);

        for (let i = 0; i < operations.length; i++) {
            if (!this.isDemoRunning) {
                this.showWsMessage('⏹️ Secuencia cancelada', 'warning');
                break;
            }

            if (this.obstacleStatus.detected) {
                const op = operations[i];
                const opText = this.getOperationText(op);
                
                if (op === 1 || op === 4 || op === 5) {
                    this.showWsMessage(`⏭️ Saltando movimiento (${opText}) - Obstáculo detectado`, 'warning');
                    continue;
                }
            }

            const op = operations[i];
            this.sendWSCommand(op);
            const opText = this.getOperationText(op);
            this.showWsMessage(`🎬 [${i + 1}/${operations.length}] ${opText}`, 'info');
            
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        if (this.isDemoRunning) {
            this.showAlert(`✅ Secuencia completada: ${sequence.nombre_secuencia}`, 'success');
            this.showWsMessage('✅ Secuencia finalizada', 'success');
        }

        this.isDemoRunning = false;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    onSequenceComplete() {
        this.setMode('manual');
        console.log('✅ Secuencia completada - Volviendo a modo manual');
        this.showNotification('✅ Secuencia completada - Volviendo a modo manual', 'success');
    }

    getDemoSequenceId() {
        if (this.sequences && this.sequences.length > 0) {
            return this.sequences[0].id_secuencia;
        }
        return 1;
    }

    // ==========================================
    // MÉTODOS RESTANTES (SE MANTIENEN IGUAL)
    // ==========================================

    initializeObstacleDetection() {
        console.log('🛡️ Inicializando sistema de detección de obstáculos...');
        this.obstacleStatus = {
            detected: false,
            distance: 0,
            location: 'none',
            lastDetection: null,
            lastClear: null
        };
    }

    handleObstacleDetection(obstacleData) {
        this.obstacleStatus = {
            detected: true,
            distance: obstacleData.distance || 0,
            location: obstacleData.location || 'unknown',
            lastDetection: new Date().toISOString(),
            action: obstacleData.action || 'stopped'
        };
        
        this.showObstacleAlert(obstacleData);
        this.updateObstacleUI();
        
        this.addToObstacleHistory({
            id_dispositivo: this.currentDevice,
            status_obstaculo: this.getObstacleCode(obstacleData.location),
            status_texto: `Obstáculo detectado a ${obstacleData.distance}cm`,
            ubicacion: obstacleData.location,
            descripcion: `Obstáculo automático a ${obstacleData.distance}cm`,
            automatico: true
        });

        this.updateButtons();
    }

    handlePathClear(clearData) {
        this.obstacleStatus.detected = false;
        this.obstacleStatus.lastClear = new Date().toISOString();
        
        this.showNotification('✅ Vía libre - Obstáculo despejado', 'success');
        this.updateObstacleUI();
        this.updateButtons();
        
        console.log('🛣️ Vía libre restaurada');
    }

    updateObstacleStatusFromHeartbeat(heartbeatData) {
        if (heartbeatData.obstacle_detected && !this.obstacleStatus.detected) {
            this.handleObstacleDetection({
                location: heartbeatData.obstacle_location || 'front',
                distance: heartbeatData.obstacle_distance || 0,
                action: 'warning'
            });
        } else if (!heartbeatData.obstacle_detected && this.obstacleStatus.detected) {
            this.handlePathClear({});
        }
        
        if (heartbeatData.obstacle_detected) {
            this.obstacleStatus.distance = heartbeatData.obstacle_distance || 0;
            this.obstacleStatus.location = heartbeatData.obstacle_location || 'front';
            this.updateObstacleUI();
        }
    }

    showObstacleAlert(obstacleData) {
        const distance = obstacleData.distance || 0;
        const location = this.getLocationText(obstacleData.location);
        
        const alertMessage = `🛑 OBSTÁCULO DETECTADO\nDistancia: ${distance}cm\nUbicación: ${location}`;
        
        this.showAlert(alertMessage, 'danger');
        this.showWsMessage(`🛑 Obstáculo detectado a ${distance}cm (${location})`, 'danger');
        this.triggerObstacleVisualAlert();
    }

    updateObstacleUI() {
        const obstacleElement = document.getElementById('lastObstacle');
        const timeElement = document.getElementById('lastObstacleTime');
        
        if (obstacleElement && timeElement) {
            if (this.obstacleStatus.detected) {
                const locationText = this.getLocationText(this.obstacleStatus.location);
                obstacleElement.innerHTML = `<span class="text-danger">🛑 Obstáculo a ${this.obstacleStatus.distance}cm (${locationText})</span>`;
            } else {
                obstacleElement.innerHTML = `<span class="text-success">✅ Vía libre</span>`;
            }
            
            timeElement.textContent = `Hora: ${new Date().toLocaleTimeString()}`;
        }
        
        this.updateObstacleIndicator();
    }

    updateObstacleIndicator() {
        let indicator = document.getElementById('obstacleLiveIndicator');
        
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'obstacleLiveIndicator';
            indicator.className = 'obstacle-indicator';
            indicator.style.cssText = `
                position: fixed;
                top: 80px;
                right: 20px;
                padding: 10px 15px;
                border-radius: 20px;
                color: white;
                font-weight: bold;
                z-index: 9999;
                transition: all 0.3s ease;
                box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
            `;
            document.body.appendChild(indicator);
        }
        
        if (this.obstacleStatus.detected) {
            indicator.innerHTML = `🛑 OBSTÁCULO ${this.obstacleStatus.distance}cm`;
            indicator.style.backgroundColor = '#dc3545';
            indicator.style.display = 'block';
        } else {
            indicator.style.display = 'none';
        }
    }

    triggerObstacleVisualAlert() {
        const header = document.querySelector('.custom-navbar');
        if (header) {
            header.style.backgroundColor = '#dc3545';
            header.style.transition = 'background-color 0.3s ease';
            
            setTimeout(() => {
                header.style.backgroundColor = '';
            }, 1000);
        }
    }

    getLocationText(location) {
        const locations = {
            'front': 'Frente',
            'front_left': 'Frente-Izquierda',
            'front_right': 'Frente-Derecha',
            'left': 'Izquierda',
            'right': 'Derecha',
            'back': 'Atrás',
            'unknown': 'Desconocida'
        };
        return locations[location] || location;
    }

    getObstacleCode(location) {
        const codes = {
            'front': 1,
            'front_left': 2,
            'front_right': 3,
            'left': 2,
            'right': 3,
            'back': 5
        };
        return codes[location] || 1;
    }

    updateButtons() {
        const buttons = document.querySelectorAll('.movement-btn');
        const shouldEnable = this.isWSConnected && this.carConnected && !this.obstacleStatus.detected;
        
        buttons.forEach(btn => {
            btn.disabled = !shouldEnable;
            
            if (!shouldEnable && this.obstacleStatus.detected) {
                btn.title = '⚠️ Bloqueado - Obstáculo detectado';
                btn.style.opacity = '0.6';
                btn.style.cursor = 'not-allowed';
            } else {
                btn.title = '';
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
            }
        });
        
        const stopBtn = document.getElementById('stopBtn');
        if (stopBtn) {
            stopBtn.disabled = !this.isWSConnected;
        }
    }

    updateServerStatus(connected) {
        this.isWSConnected = connected;
        
        const serverStatus = document.getElementById('serverStatus');
        const serverIndicator = document.getElementById('serverIndicator');
        
        if (serverStatus && serverIndicator) {
            if (connected) {
                serverStatus.textContent = 'Conectado';
                serverIndicator.className = 'status-indicator online';
            } else {
                serverStatus.textContent = 'Desconectado';
                serverIndicator.className = 'status-indicator offline';
                this.updateCarStatus(false);
            }
        }
        
        this.updateButtons();
    }

    updateCarStatus(connected) {
        this.carConnected = connected;
        
        const carStatus = document.getElementById('carStatus');
        const carIndicator = document.getElementById('carIndicator');
        
        if (carStatus && carIndicator) {
            if (connected) {
                carStatus.textContent = 'Conectado';
                carIndicator.className = 'status-indicator online';
            } else {
                carStatus.textContent = 'Desconectado';
                carIndicator.className = 'status-indicator offline';
            }
        }
        
        this.updateButtons();
    }

    updateBattery(level) {
        const batteryElement = document.getElementById('batteryLevel');
        const batteryBar = document.querySelector('.battery-fill');
        
        if (batteryElement) {
            batteryElement.textContent = `${level}%`;
        }
        
        if (batteryBar) {
            batteryBar.style.width = `${level}%`;
            
            if (level > 60) {
                batteryBar.style.backgroundColor = '#4CAF50';
            } else if (level > 30) {
                batteryBar.style.backgroundColor = '#FFC107';
            } else {
                batteryBar.style.backgroundColor = '#F44336';
            }
        }
    }

    showNotification(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);
        this.showWsMessage(message, type);
    }

    initializeStatusUpdates() {
        setInterval(() => {
            this.updateStatusTimestamp();
        }, 1000);
    }

    updateCurrentStatus() {
        const statusElement = document.getElementById('currentStatus');
        const deviceSelect = document.getElementById('deviceSelect');
        
        if (statusElement && deviceSelect) {
            const deviceName = deviceSelect.options[deviceSelect.selectedIndex].text;
            
            statusElement.innerHTML = `
                <span class="badge ${this.isWSConnected ? 'bg-success' : 'bg-secondary'}">
                    ${this.isWSConnected ? 'Conectado' : 'Desconectado'} - ${deviceName}
                </span>
            `;
        }
    }

    updateLastMovement(operationText) {
        const movementElement = document.getElementById('lastMovement');
        const timeElement = document.getElementById('lastMovementTime');
        
        if (movementElement && timeElement) {
            movementElement.innerHTML = `<span class="text-success">${operationText}</span>`;
            timeElement.textContent = `Hora: ${new Date().toLocaleTimeString()}`;
        }
    }

    updateLastObstacle(obstacleText) {
        const obstacleElement = document.getElementById('lastObstacle');
        const timeElement = document.getElementById('lastObstacleTime');
        
        if (obstacleElement && timeElement) {
            obstacleElement.innerHTML = `<span class="text-warning">${obstacleText}</span>`;
            timeElement.textContent = `Hora: ${new Date().toLocaleTimeString()}`;
        }
    }

    updateStatusTimestamp() {
        const timestampElement = document.getElementById('statusTimestamp');
        if (timestampElement) {
            timestampElement.textContent = `Actualizado: ${new Date().toLocaleTimeString()}`;
        }
    }

    addToCommandHistory(commandData) {
        if (!this.commandHistory) {
            this.commandHistory = [];
        }
        this.commandHistory.push({
            ...commandData,
            timestamp: new Date().toISOString()
        });
        
        if (this.commandHistory.length > 1000) {
            this.commandHistory = this.commandHistory.slice(-500);
        }
        
        this.updateLastMovement(commandData.status_texto);
    }

    addToObstacleHistory(obstacleData) {
        if (!this.obstacleHistory) {
            this.obstacleHistory = [];
        }
        this.obstacleHistory.push({
            ...obstacleData,
            timestamp: new Date().toISOString()
        });
        
        if (this.obstacleHistory.length > 1000) {
            this.obstacleHistory = this.obstacleHistory.slice(-500);
        }
        
        this.updateLastObstacle(obstacleData.status_texto);
    }

    addObstacleToTableRealTime(obstacleData) {
        const container = document.getElementById('manualObstaclesList');
        if (!container) return;
        
        const obstacleElement = document.createElement('div');
        obstacleElement.className = 'alert alert-warning mb-2';
        obstacleElement.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <strong>${obstacleData.status_texto}</strong><br>
                    <small>Distancia: ${obstacleData.distance}cm</small><br>
                    <small>Ubicación: ${obstacleData.ubicacion}</small><br>
                    <small>${new Date(obstacleData.fecha_hora).toLocaleTimeString()}</small>
                </div>
                ${obstacleData.automatico ? 
                    '<span class="badge bg-info">Automático</span>' : 
                    '<button class="btn btn-sm btn-outline-danger" onclick="app.deleteManualObstacle(' + (obstacleData.id_evento || '0') + ')"><i class="bi bi-trash"></i></button>'
                }
            </div>
        `;
        
        if (container.firstChild) {
            container.insertBefore(obstacleElement, container.firstChild);
        } else {
            container.appendChild(obstacleElement);
        }
        
        const obstacles = container.querySelectorAll('.alert');
        if (obstacles.length > 10) {
            obstacles[obstacles.length - 1].remove();
        }
    }

    updateObstacleCounter() {
        const counterElement = document.getElementById('obstacleCounter');
        if (counterElement) {
            const currentCount = parseInt(counterElement.textContent) || 0;
            counterElement.textContent = currentCount + 1;
        }
    }

    // ==========================================
    // NOTIFICACIONES ESPECÍFICAS
    // ==========================================

    showObstacleAlertManual(distance) {
        const alert = document.createElement('div');
        alert.className = 'obstacle-alert-manual';
        alert.innerHTML = `
            <div class="alert-content">
                <i class="bi bi-exclamation-triangle-fill"></i>
                <div>
                    <strong>🛑 OBSTÁCULO DETECTADO</strong>
                    <p>Distancia: ${distance} cm</p>
                    <p><strong>Carro detenido - Se requiere intervención manual</strong></p>
                </div>
                <button class="close-alert" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        document.body.appendChild(alert);
        setTimeout(() => alert.classList.add('show'), 10);
        
        setTimeout(() => {
            if (alert.parentElement) {
                alert.classList.remove('show');
                setTimeout(() => alert.remove(), 300);
            }
        }, 10000);
    }

    showObstacleAvoidedAuto(distance) {
        const alert = document.createElement('div');
        alert.className = 'obstacle-alert-auto';
        alert.innerHTML = `
            <div class="alert-content">
                <i class="bi bi-robot"></i>
                <div>
                    <strong>🤖 ESQUIVA AUTOMÁTICA</strong>
                    <p>Obstáculo a ${distance} cm - Esquivando...</p>
                </div>
                <button class="close-alert" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        document.body.appendChild(alert);
        setTimeout(() => alert.classList.add('show'), 10);
        
        setTimeout(() => {
            if (alert.parentElement) {
                alert.classList.remove('show');
                setTimeout(() => alert.remove(), 300);
            }
        }, 5000);
    }

    playAlertSound() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (e) {
            console.log('No se pudo reproducir sonido de alerta');
        }
    }

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
            11: '⟲ Giro 360° Izquierda'
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

    // ==========================================
    // UI HELPERS
    // ==========================================
    
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
        if (!container) return;
        
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        container.appendChild(alertDiv);
        
        setTimeout(() => {
            if (alertDiv.parentElement) {
                alertDiv.remove();
            }
        }, 5000);
    }

    showWsMessage(message, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `ws-message ws-${type}`;
        messageDiv.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <span>${message}</span>
                <button type="button" class="btn-close btn-close-white" onclick="this.parentElement.parentElement.remove()"></button>
            </div>
        `;
        
        const container = document.getElementById('wsMessages');
        if (container) {
            container.appendChild(messageDiv);
            
            setTimeout(() => {
                if (messageDiv.parentElement) {
                    messageDiv.remove();
                }
            }, 5000);
        }
    }

    // ==========================================
    // EVENT LISTENERS
    // ==========================================

    initializeEventListeners() {
        // Botones de movimiento
        document.querySelectorAll('.movement-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const operation = parseInt(e.target.closest('button').dataset.operation);
                this.sendWSCommand(operation);
            });
        });

        // Botones de velocidad
        document.querySelectorAll('.speed-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const speed = e.target.closest('button').dataset.speed;
                this.setSpeed(speed);
            });
        });

        // Selector de dispositivo
        const deviceSelect = document.getElementById('deviceSelect');
        if (deviceSelect) {
            deviceSelect.addEventListener('change', (e) => {
                const oldDevice = this.currentDevice;
                this.currentDevice = parseInt(e.target.value);
                
                this.showAlert(`Cambiado a: ${e.target.options[e.target.selectedIndex].text}`, 'info');
                this.updateCurrentStatus();
                
                // Recargar datos del nuevo dispositivo
                this.refreshObstaclesDisplay();
                this.refreshCommandsDisplay();
            });
        }

        // Botón modo demo
        const demoBtn = document.getElementById('demoBtn');
        if (demoBtn) {
            demoBtn.addEventListener('click', () => {
                if (!this.isDemoRunning) {
                    this.executeSequenceWithMode(this.getDemoSequenceId());
                } else {
                    this.showAlert('⚠️ Demo ya en ejecución', 'warning');
                }
            });
        }

        // Botón detener emergencia
        const stopBtn = document.getElementById('stopBtn');
        if (stopBtn) {
            stopBtn.addEventListener('click', () => {
                this.isDemoRunning = false;
                this.sendWSCommand(3);
                this.showAlert('🛑 PARADA DE EMERGENCIA ACTIVADA', 'danger');
            });
        }

        // Botón nueva secuencia
        const newSequenceBtn = document.getElementById('newSequenceBtn');
        if (newSequenceBtn) {
            newSequenceBtn.addEventListener('click', () => {
                this.openSequenceModal();
            });
        }

        // Botón nuevo dispositivo
        const newDeviceBtn = document.getElementById('newDeviceBtn');
        if (newDeviceBtn) {
            newDeviceBtn.addEventListener('click', () => {
                this.openDeviceModal();
            });
        }

        // Botón guardar secuencia
        const saveSequenceBtn = document.getElementById('saveSequenceBtn');
        if (saveSequenceBtn) {
            saveSequenceBtn.addEventListener('click', () => {
                this.saveSequence();
            });
        }

        // Botón guardar dispositivo
        const saveDeviceBtn = document.getElementById('saveDeviceBtn');
        if (saveDeviceBtn) {
            saveDeviceBtn.addEventListener('click', () => {
                this.saveDevice();
            });
        }

        // Botones de modo manual/automático
        const manualModeBtn = document.querySelector('[onclick*="setManualMode"]');
        const autoModeBtn = document.querySelector('[onclick*="setAutoMode"]');
        
        if (manualModeBtn) {
            manualModeBtn.addEventListener('click', () => this.setMode('manual'));
        }
        if (autoModeBtn) {
            autoModeBtn.addEventListener('click', () => this.setMode('sequence'));
        }

        // Inicializar listeners de obstáculos manuales
        this.initializeObstacleListeners();
    }

    initializeObstacleListeners() {
        document.querySelectorAll('.obstacle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const ubicacion = e.target.closest('button').dataset.ubicacion;
                this.createManualObstacle(ubicacion);
            });
        });

        const clearObstaclesBtn = document.getElementById('clearObstaclesBtn');
        if (clearObstaclesBtn) {
            clearObstaclesBtn.addEventListener('click', () => {
                this.clearManualObstacles();
            });
        }
    }
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    window.app = new CarControlApp();
});

// Función global para modo manual
function setManualMode() {
    if (window.app) {
        window.app.setMode('manual');
    }
}

// Función global para modo automático
function setAutoMode() {
    if (window.app) {
        window.app.setMode('sequence');
    }
}