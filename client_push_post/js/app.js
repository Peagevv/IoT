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
        
        // ✅ CAMBIAR: Hacer WebSocket global
        window.ws = null;
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
        // ✅ NUEVO: HISTORIAL DE ÚLTIMOS MOVIMIENTOS CON PERSISTENCIA
        // ==========================================
        this.movementHistory = this.loadMovementHistoryFromStorage();
        
        // ==========================================
        // ✅ NUEVO: ESTADO ACTUAL PERSISTENTE
        // ==========================================
        this.currentState = this.loadCurrentStateFromStorage();
        
        // ==========================================
        // SISTEMA DE DETECCIÓN DE OBSTÁCULOS
        // ==========================================
        this.initializeObstacleDetection();
        
        this.initializeEventListeners();
        this.connectWebSocket(); // Solo WebSocket, no más HTTP
        this.initializeStatusUpdates();
        
        // ✅ INICIALIZAR TABLA DE MOVIMIENTOS CON DATOS PERSISTENTES
        this.initializeMovementLog();
        
        // ✅ ACTUALIZAR ESTADO ACTUAL CON DATOS PERSISTENTES
        this.updateCurrentStateUI();

        // Temporal: cargar datos de prueba después de 3 segundos solo si no hay datos reales
        setTimeout(() => {
            if ((this.devices.length === 0 || this.sequences.length === 0) && this.isWSConnected) {
                console.log('🔄 Cargando datos de prueba...');
                this.loadSampleData();
            }
        }, 3000);
    }

    // ==========================================
    // ✅ SISTEMA DE PERSISTENCIA LOCAL
    // ==========================================

    // Cargar historial de movimientos desde localStorage
    loadMovementHistoryFromStorage() {
        try {
            const saved = localStorage.getItem('carMovementHistory');
            if (saved) {
                const history = JSON.parse(saved);
                console.log('📂 Movimientos cargados desde almacenamiento:', history.length);
                return history;
            }
        } catch (error) {
            console.error('❌ Error cargando movimientos desde almacenamiento:', error);
        }
        return [];
    }

    // Guardar historial de movimientos en localStorage
    saveMovementHistoryToStorage() {
        try {
            localStorage.setItem('carMovementHistory', JSON.stringify(this.movementHistory));
            console.log('💾 Movimientos guardados en almacenamiento:', this.movementHistory.length);
        } catch (error) {
            console.error('❌ Error guardando movimientos en almacenamiento:', error);
        }
    }

    // Cargar estado actual desde localStorage
    loadCurrentStateFromStorage() {
        try {
            const saved = localStorage.getItem('carCurrentState');
            if (saved) {
                const state = JSON.parse(saved);
                console.log('📂 Estado actual cargado desde almacenamiento:', state);
                return state;
            }
        } catch (error) {
            console.error('❌ Error cargando estado desde almacenamiento:', error);
        }
        return {
            lastMovement: 'Sin movimientos',
            lastMovementTime: '',
            lastObstacle: 'Sin obstáculos',
            lastObstacleTime: '',
            currentStatus: 'Desconectado',
            statusTimestamp: ''
        };
    }

    // Guardar estado actual en localStorage
    saveCurrentStateToStorage() {
        try {
            localStorage.setItem('carCurrentState', JSON.stringify(this.currentState));
            console.log('💾 Estado actual guardado en almacenamiento');
        } catch (error) {
            console.error('❌ Error guardando estado en almacenamiento:', error);
        }
    }

    // ==========================================
    // ✅ NUEVA TABLA DE ÚLTIMOS 10 MOVIMIENTOS CON PERSISTENCIA
    // ==========================================

    // Función para inicializar la tabla de últimos movimientos
    initializeMovementLog() {
        console.log('📊 Inicializando tabla de últimos movimientos...');
        this.renderMovementLog();
    }

    // Función para agregar un movimiento al historial
    addToMovementLog(operationId, commandName) {
        if (!this.movementHistory) {
            this.movementHistory = [];
        }

        const movement = {
            id: Date.now(),
            operationId: operationId,
            command: commandName,
            operationText: this.getOperationText(operationId),
            timestamp: new Date().toISOString(),
            deviceId: this.currentDevice,
            speed: this.currentSpeed
        };

        // Agregar al inicio del array
        this.movementHistory.unshift(movement);

        // Mantener solo los últimos 10 movimientos
        if (this.movementHistory.length > 10) {
            this.movementHistory = this.movementHistory.slice(0, 10);
        }

        // ✅ GUARDAR EN ALMACENAMIENTO LOCAL
        this.saveMovementHistoryToStorage();

        // Actualizar la tabla
        this.renderMovementLog();

        // ✅ ACTUALIZAR ESTADO ACTUAL
        this.updateCurrentMovement(movement.operationText);

        console.log(`📝 Movimiento agregado al log: ${commandName}`);
    }

    // Función para renderizar la tabla de movimientos
    renderMovementLog() {
        const container = document.getElementById('movementLogTable');
        if (!container) {
            console.log('❌ No se encontró movementLogTable');
            return;
        }

        if (!this.movementHistory || this.movementHistory.length === 0) {
            container.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center text-muted py-4">
                        <i class="bi bi-clock-history display-6"></i>
                        <p class="mt-2">No hay movimientos recientes</p>
                        <small>Los movimientos aparecerán aquí cuando ejecutes comandos</small>
                    </td>
                </tr>
            `;
            return;
        }

        console.log('📊 Renderizando tabla de movimientos:', this.movementHistory.length, 'movimientos');

        container.innerHTML = this.movementHistory.map(movement => `
            <tr class="new-movement">
                <td>
                    <div class="d-flex align-items-center">
                        <span class="movement-icon me-2">${this.getMovementIcon(movement.operationId)}</span>
                        ${movement.operationText}
                    </div>
                </td>
                <td>
                    <span class="badge bg-secondary">${movement.deviceId}</span>
                </td>
                <td>
                    <span class="badge ${this.getSpeedBadgeClass(movement.speed)}">
                        ${this.getSpeedText(movement.speed)}
                    </span>
                </td>
                <td>
                    <small class="text-muted">${new Date(movement.timestamp).toLocaleTimeString()}</small>
                </td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="app.repeatMovement(${movement.operationId})" 
                            title="Repetir movimiento">
                        <i class="bi bi-arrow-repeat"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    // ==========================================
    // ✅ SISTEMA DE ESTADO ACTUAL MEJORADO
    // ==========================================

    // Actualizar estado actual del movimiento
    updateCurrentMovement(operationText) {
        this.currentState.lastMovement = operationText;
        this.currentState.lastMovementTime = new Date().toLocaleTimeString();
        this.saveCurrentStateToStorage();
        this.updateCurrentStateUI();
    }

    // Actualizar estado actual del obstáculo
    updateCurrentObstacle(obstacleText) {
        this.currentState.lastObstacle = obstacleText;
        this.currentState.lastObstacleTime = new Date().toLocaleTimeString();
        this.saveCurrentStateToStorage();
        this.updateCurrentStateUI();
    }

    // Actualizar estado de conexión
    updateCurrentStatus(status) {
        this.currentState.currentStatus = status;
        this.currentState.statusTimestamp = new Date().toLocaleTimeString();
        this.saveCurrentStateToStorage();
        this.updateCurrentStateUI();
    }

    // Actualizar UI del estado actual
    updateCurrentStateUI() {
        // Actualizar último movimiento
        const movementElement = document.getElementById('lastMovement');
        const movementTimeElement = document.getElementById('lastMovementTime');
        if (movementElement && movementTimeElement) {
            movementElement.innerHTML = `<span class="text-success">${this.currentState.lastMovement}</span>`;
            movementTimeElement.textContent = `Hora: ${this.currentState.lastMovementTime}`;
        }

        // Actualizar último obstáculo
        const obstacleElement = document.getElementById('lastObstacle');
        const obstacleTimeElement = document.getElementById('lastObstacleTime');
        if (obstacleElement && obstacleTimeElement) {
            obstacleElement.innerHTML = `<span class="text-warning">${this.currentState.lastObstacle}</span>`;
            obstacleTimeElement.textContent = `Hora: ${this.currentState.lastObstacleTime}`;
        }

        // Actualizar estado actual
        const statusElement = document.getElementById('currentStatus');
        const statusTimeElement = document.getElementById('statusTimestamp');
        if (statusElement && statusTimeElement) {
            statusElement.innerHTML = `
                <span class="badge ${this.isWSConnected ? 'bg-success' : 'bg-secondary'}">
                    ${this.currentState.currentStatus}
                </span>
            `;
            statusTimeElement.textContent = `Actualizado: ${this.currentState.statusTimestamp}`;
        }
    }

    // ==========================================
    // ✅ CARGAR SECUENCIAS EN TABLA
    // ==========================================

    renderSequencesTable(sequences) {
        const container = document.getElementById('sequencesTable');
        if (!container) {
            console.log('❌ No se encontró sequencesTable');
            return;
        }
        
        if (!sequences || sequences.length === 0) {
            container.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center text-muted py-3">
                        <i class="bi bi-collection-play"></i>
                        <p class="mt-2">No hay secuencias guardadas</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        console.log('📊 Renderizando tabla de secuencias:', sequences.length, 'secuencias');
        
        container.innerHTML = sequences.map(seq => {
            const operationsArray = Array.isArray(seq.operaciones) ? 
                seq.operaciones : 
                (seq.operaciones ? seq.operaciones.split(',').map(op => parseInt(op.trim())) : []);
            
            const operationsText = operationsArray.map(op => this.getOperationText(op)).join(' → ');
            const deviceName = this.devices.find(d => d.id_dispositivo === seq.id_dispositivo)?.nombre_dispositivo || 'Desconocido';
            
            return `
                <tr>
                    <td>${seq.nombre_secuencia}</td>
                    <td>${deviceName}</td>
                    <td>${operationsArray.length} operaciones</td>
                    <td>
                        <small class="text-muted">${operationsText.substring(0, 50)}${operationsText.length > 50 ? '...' : ''}</small>
                    </td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-success" onclick="app.executeSequenceWithMode(${seq.id_secuencia})">
                                <i class="bi bi-play-fill"></i>
                            </button>
                            <button class="btn btn-warning" onclick="app.openSequenceModal(${JSON.stringify(seq).replace(/"/g, '&quot;')})">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-danger" onclick="app.deleteSequence(${seq.id_secuencia})">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // ==========================================
    // ✅ CARGAR DISPOSITIVOS EN TABLA
    // ==========================================

    renderDevicesTable(devices) {
        const container = document.getElementById('devicesTable');
        if (!container) {
            console.log('❌ No se encontró devicesTable');
            return;
        }
        
        if (!devices || devices.length === 0) {
            container.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center text-muted py-3">
                        <i class="bi bi-car-front"></i>
                        <p class="mt-2">No hay dispositivos registrados</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        console.log('📊 Renderizando tabla de dispositivos:', devices.length, 'dispositivos');
        
        container.innerHTML = devices.map(device => `
            <tr>
                <td>${device.nombre_dispositivo}</td>
                <td>${device.id_dispositivo}</td>
                <td>${device.descripcion || 'Sin descripción'}</td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-primary" onclick="app.selectDevice(${device.id_dispositivo})">
                            <i class="bi bi-check-circle"></i> Seleccionar
                        </button>
                        <button class="btn btn-warning" onclick="app.openDeviceModal(${JSON.stringify(device).replace(/"/g, '&quot;')})">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-danger" onclick="app.deleteDevice(${device.id_dispositivo})">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    // ==========================================
    // ✅ ACTUALIZAR TABLA DE OBSTÁCULOS - CORREGIDO Y UNIFICADO
    // ==========================================

    updateObstaclesTable(obstacles) {
        console.log('🔄 Actualizando tabla de obstáculos con:', obstacles);
        
        // Asegurar que obstacles sea un array
        if (!Array.isArray(obstacles)) {
            console.error('❌ Los obstáculos no son un array:', obstacles);
            obstacles = [];
        }
        
        // Actualizar el historial interno
        this.obstacleHistory = obstacles;
        
        // Renderizar la tabla
        this.renderObstaclesTable(this.obstacleHistory);
        
        // También actualizar la lista de obstáculos manuales si existe
        this.updateManualObstaclesList(this.obstacleHistory.filter(obs => !obs.automatico));
    }

    // ==========================================
    // ✅ RENDERIZAR TABLA DE OBSTÁCULOS - MEJORADO
    // ==========================================

    renderObstaclesTable(obstacles) {
        const container = document.getElementById('obstaclesTable');
        if (!container) {
            console.log('❌ No se encontró obstaclesTable');
            return;
        }
        
        if (!obstacles || obstacles.length === 0) {
            container.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center text-muted py-4">
                        <i class="bi bi-shield-check display-6"></i>
                        <p class="mt-2">No hay obstáculos registrados</p>
                        <small class="text-muted">Los obstáculos aparecerán aquí cuando sean detectados</small>
                    </td>
                </tr>
            `;
            return;
        }
        
        console.log('📊 Renderizando tabla de obstáculos:', obstacles.length, 'obstáculos');
        
        // Ordenar por fecha (más recientes primero)
        const sortedObstacles = [...obstacles].sort((a, b) => {
            const dateA = new Date(a.fecha_hora || a.timestamp || Date.now());
            const dateB = new Date(b.fecha_hora || b.timestamp || Date.now());
            return dateB - dateA;
        });
        
        container.innerHTML = sortedObstacles.map((obs, index) => {
            const fechaHora = obs.fecha_hora ? new Date(obs.fecha_hora) : 
                             obs.timestamp ? new Date(obs.timestamp) : new Date();
            const ubicacion = obs.ubicacion || obs.location || 'Desconocida';
            const distancia = obs.distancia_detectada || obs.distance || obs.obstacle_distance || 'N/A';
            const tipo = obs.status_texto || obs.descripcion || 'Obstáculo detectado';
            const automatico = obs.automatico !== undefined ? obs.automatico : 
                              (obs.status_texto && obs.status_texto.includes('automático')) ? true : false;
            
            return `
                <tr class="${index === 0 ? 'table-warning' : ''}">
                    <td>
                        <small>${fechaHora.toLocaleDateString()}</small><br>
                        <strong>${fechaHora.toLocaleTimeString()}</strong>
                    </td>
                    <td>${tipo}</td>
                    <td>
                        <span class="badge bg-secondary">${ubicacion}</span>
                    </td>
                    <td>
                        <span class="badge ${distancia !== 'N/A' && distancia < 20 ? 'bg-danger' : 'bg-info'}">
                            ${distancia} cm
                        </span>
                    </td>
                    <td>
                        ${automatico ? 
                            '<span class="badge bg-info"><i class="bi bi-robot"></i> Automático</span>' : 
                            '<span class="badge bg-warning"><i class="bi bi-person"></i> Manual</span>'
                        }
                    </td>
                </tr>
            `;
        }).join('');
    }

    // ==========================================
    // ✅ ACTUALIZAR LISTA DE OBSTÁCULOS MANUALES
    // ==========================================

    updateManualObstaclesList(manualObstacles) {
        const container = document.getElementById('manualObstaclesList');
        if (!container) {
            console.log('❌ No se encontró manualObstaclesList');
            return;
        }
        
        if (!manualObstacles || manualObstacles.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="bi bi-shield-check display-6"></i>
                    <p class="mt-2">No hay obstáculos manuales registrados</p>
                    <small class="text-muted">Usa los botones de arriba para agregar obstáculos manuales</small>
                </div>
            `;
            return;
        }
        
        console.log('📝 Actualizando lista de obstáculos manuales:', manualObstacles.length);
        
        // Ordenar por fecha (más recientes primero)
        const sortedObstacles = [...manualObstacles].sort((a, b) => {
            const dateA = new Date(a.fecha_hora || a.timestamp || Date.now());
            const dateB = new Date(b.fecha_hora || b.timestamp || Date.now());
            return dateB - dateA;
        });
        
        container.innerHTML = sortedObstacles.map(obs => {
            const fechaHora = obs.fecha_hora ? new Date(obs.fecha_hora) : 
                             obs.timestamp ? new Date(obs.timestamp) : new Date();
            const ubicacion = obs.ubicacion || 'Desconocida';
            const descripcion = obs.descripcion || obs.status_texto || 'Obstáculo manual';
            const obstacleId = obs.id_evento || obs.id || Date.now();
            
            return `
                <div class="alert alert-warning mb-2">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1">
                            <div class="d-flex align-items-center mb-1">
                                <i class="bi bi-exclamation-triangle-fill me-2"></i>
                                <strong>${descripcion}</strong>
                            </div>
                            <div class="small text-muted">
                                <div><i class="bi bi-geo-alt me-1"></i> Ubicación: ${ubicacion}</div>
                                <div><i class="bi bi-clock me-1"></i> ${fechaHora.toLocaleString()}</div>
                            </div>
                        </div>
                        <button class="btn btn-sm btn-outline-danger ms-2" 
                                onclick="app.deleteManualObstacle(${obstacleId})"
                                title="Eliminar obstáculo">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ==========================================
    // ✅ MÉTODO PARA AGREGAR OBSTÁCULOS EN TIEMPO REAL - COMPLETAMENTE REESCRITO
    // ==========================================

    addObstacleToTableRealTime(obstacleData) {
        console.log('🛑 Agregando obstáculo en tiempo real:', obstacleData);
        
        // Inicializar el historial si no existe
        if (!this.obstacleHistory) {
            this.obstacleHistory = [];
        }
        
        // Crear objeto de obstáculo completo
        const newObstacle = {
            id_evento: obstacleData.id_evento || Date.now(),
            fecha_hora: obstacleData.fecha_hora || new Date().toISOString(),
            status_texto: obstacleData.status_texto || 'Obstáculo detectado',
            ubicacion: obstacleData.ubicacion || obstacleData.location || 'Desconocida',
            distancia_detectada: obstacleData.distancia_detectada || obstacleData.distance || 'N/A',
            descripcion: obstacleData.descripcion || obstacleData.status_texto || 'Obstáculo detectado',
            automatico: obstacleData.automatico !== undefined ? obstacleData.automatico : true,
            id_dispositivo: obstacleData.id_dispositivo || this.currentDevice
        };
        
        // Agregar al inicio del historial
        this.obstacleHistory.unshift(newObstacle);
        
        // Mantener solo los últimos 50 obstáculos
        if (this.obstacleHistory.length > 50) {
            this.obstacleHistory = this.obstacleHistory.slice(0, 50);
        }
        
        // Actualizar ambas vistas
        this.renderObstaclesTable(this.obstacleHistory);
        
        // Si es manual, actualizar también la lista específica
        if (!newObstacle.automatico) {
            const manualObstacles = this.obstacleHistory.filter(obs => !obs.automatico);
            this.updateManualObstaclesList(manualObstacles);
        }
        
        // Actualizar contador
        this.updateObstacleCounter();
        
        // Mostrar notificación
        this.showNotification(`🛑 ${newObstacle.status_texto}`, 'warning');
    }

    // ==========================================
    // ✅ ACTUALIZAR CONTADOR DE OBSTÁCULOS - MEJORADO
    // ==========================================

    updateObstacleCounter() {
        const counterElement = document.getElementById('obstacleCounter');
        if (counterElement) {
            const totalObstacles = this.obstacleHistory ? this.obstacleHistory.length : 0;
            const manualObstacles = this.obstacleHistory ? this.obstacleHistory.filter(obs => !obs.automatico).length : 0;
            const autoObstacles = totalObstacles - manualObstacles;
            
            counterElement.innerHTML = `
                <span class="badge bg-primary">Total: ${totalObstacles}</span>
                <span class="badge bg-warning">Manuales: ${manualObstacles}</span>
                <span class="badge bg-info">Automáticos: ${autoObstacles}</span>
            `;
        }
    }

    // ==========================================
    // ✅ DATOS DE PRUEBA TEMPORALES
    // ==========================================

    loadSampleData() {
        console.log('📊 Cargando datos de prueba...');
        
        // Solo cargar datos de prueba si no hay datos reales
        if (this.movementHistory.length === 0) {
            const sampleMovements = [
                {
                    operationId: 1,
                    command: 'forward',
                    operationText: '🚗 Adelante',
                    timestamp: new Date().toISOString(),
                    deviceId: 1,
                    speed: 'medium'
                },
                {
                    operationId: 8,
                    command: 'turn_right', 
                    operationText: '↷ Giro 90° Derecha',
                    timestamp: new Date(Date.now() - 30000).toISOString(),
                    deviceId: 1,
                    speed: 'medium'
                }
            ];
            this.movementHistory = sampleMovements;
            this.saveMovementHistoryToStorage();
            this.renderMovementLog();
        }

        // Datos de prueba para secuencias
        const sampleSequences = [
            {
                id_secuencia: 1,
                nombre_secuencia: 'Recorrido Cuadrado',
                id_dispositivo: 1,
                operaciones: [1, 8, 1, 9, 1, 8, 1, 9, 3]
            }
        ];
        
        // Datos de prueba para dispositivos
        const sampleDevices = [
            {
                id_dispositivo: 1,
                nombre_dispositivo: 'Carro Principal',
                descripcion: 'Dispositivo principal de pruebas'
            }
        ];
        
        // Renderizar datos de prueba
        this.renderSequencesTable(sampleSequences);
        this.renderDevicesTable(sampleDevices);
        
        this.showNotification('📊 Datos de prueba cargados', 'info');
    }

    // ==========================================
    // ✅ FORMATEAR DATOS DE SECUENCIAS
    // ==========================================

    formatSequencesData(sequences) {
        return sequences.map(seq => {
            // Asegurar que las operaciones estén en el formato correcto
            let operaciones = [];
            
            if (Array.isArray(seq.operaciones)) {
                operaciones = seq.operaciones;
            } else if (seq.operaciones && typeof seq.operaciones === 'string') {
                operaciones = seq.operaciones.split(',').map(op => parseInt(op.trim())).filter(op => !isNaN(op));
            } else if (seq.movimientos) {
                operaciones = Array.isArray(seq.movimientos) ? seq.movimientos : 
                             (typeof seq.movimientos === 'string' ? seq.movimientos.split(',').map(op => parseInt(op.trim())).filter(op => !isNaN(op)) : []);
            }
            
            return {
                id_secuencia: seq.id_secuencia || seq.id,
                nombre_secuencia: seq.nombre_secuencia || seq.nombre || 'Secuencia sin nombre',
                id_dispositivo: seq.id_dispositivo || seq.device_id || this.currentDevice,
                operaciones: operaciones,
                descripcion: seq.descripcion || ''
            };
        });
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
        if (this.isWSConnected && window.ws && window.ws.readyState === WebSocket.OPEN) {
            const message = {
                command: 'set_speed',
                speed: this.SPEED_VALUES[speed],
                timestamp: new Date().toISOString()
            };
            
            window.ws.send(JSON.stringify(message));
            console.log(`⚡ Velocidad cambiada a: ${speed} (${this.SPEED_VALUES[speed]} PWM)`);
            this.showNotification(`Velocidad: ${badge.textContent}`, 'info');
        }
    }

    // ==========================================
    // SISTEMA DE MODOS - FUNCIONES NUEVAS
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
        
        if (window.ws && window.ws.readyState === WebSocket.OPEN) {
            window.ws.send(JSON.stringify(message));
            console.log(`🔄 Cambiando a modo: ${mode}`);
            this.showNotification(`🔄 Cambiando a modo: ${mode}`, 'info');
        }
        
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

    // ==========================================
    // FUNCIONES AUXILIARES PARA MODOS
    // ==========================================

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    onSequenceComplete() {
        this.setMode('manual');
        console.log('✅ Secuencia completada - Volviendo a modo manual');
        this.showNotification('✅ Secuencia completada - Volviendo a modo manual', 'success');
    }

    // ==========================================
    // INICIALIZACIÓN DETECCIÓN DE OBSTÁCULOS
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

    // ==========================================
    // WEBSOCKET - TODO POR WEBSOCKET CON MEJORAS
    // ==========================================

    connectWebSocket() {
        console.log('🔌 Conectando a WebSocket...', this.WS_URL);
        
        try {
            window.ws = new WebSocket(this.WS_URL);
            
            window.ws.onopen = () => {
                console.log('✅ WebSocket conectado');
                this.isWSConnected = true;
                this.updateServerStatus(true);
                this.updateCurrentStatus('Conectado - Carro Principal');
                this.showNotification('Conectado al servidor WebSocket', 'success');
                
                // Solicitar datos iniciales via WebSocket
                this.requestInitialData();
            };
            
            window.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('📨 Mensaje WebSocket RECIBIDO:', data);
                    
                    // Agrega este log para ver TODOS los mensajes
                    console.log('🔍 Tipo de mensaje:', data.type, '| Datos:', data);
                    
                    // Mensaje de bienvenida
                    if (data.status === 'connected' && data.type === 'client') {
                        console.log(`Carros disponibles: ${data.cars_connected}`);
                        if (data.cars_connected > 0) {
                            this.updateCarStatus(true);
                        }
                    }
                    
                    // Estado del carro
                    else if (data.type === 'car_status') {
                        this.updateCarStatus(data.status === 'connected');
                        if (data.status === 'connected') {
                            this.showNotification('Carro conectado', 'success');
                            this.updateCurrentStatus('Conectado - Carro Principal');
                        } else {
                            this.showNotification('Carro desconectado', 'warning');
                            this.updateCurrentStatus('Desconectado');
                        }
                    }
                    
                    // Heartbeat (batería)
                    else if (data.type === 'car_heartbeat') {
                        this.updateBattery(data.battery);
                    }
                    
                    // Comando ejecutado
                    else if (data.type === 'command_executed') {
                        console.log(`✅ Comando "${data.command}" ejecutado`);
                        this.showNotification(`Comando ${data.command} ejecutado`, 'success');
                    }
                    
                    // MANEJO DE EVENTOS DE MODO
                    else if (data.event === 'mode_changed') {
                        this.currentMode = data.autonomous_mode ? 'sequence' : 'manual';
                        this.updateModeIndicator(this.currentMode);
                        this.modeChangePending = false;
                        console.log(`✅ Modo cambiado a: ${this.currentMode}`);
                    }
                    
                    // OBSTÁCULO DETECTADO EN MODO MANUAL
                    else if ((data.event === 'obstacle_detected' || data.type === 'obstacle_detected') && this.currentMode === 'manual') {
                        const distance = data.distance || data.obstacle_distance || 0;
                        this.showObstacleAlertManual(distance);
                        this.playAlertSound();
                        
                        // ✅ ACTUALIZAR ESTADO ACTUAL DEL OBSTÁCULO
                        this.updateCurrentObstacle(`🛑 Obstáculo detectado a ${distance}cm`);
                        
                        // ✅ AGREGAR A LA TABLA EN TIEMPO REAL
                        this.addObstacleToTableRealTime({
                            fecha_hora: new Date().toISOString(),
                            status_texto: 'Obstáculo detectado automáticamente',
                            distance: distance,
                            location: data.location || 'front',
                            automatico: true
                        });
                    }
                    
                    // OBSTÁCULO ESQUIVADO EN MODO SECUENCIA
                    else if (data.event === 'obstacle_avoided' && this.currentMode === 'sequence') {
                        const distance = data.distance || 0;
                        this.showObstacleAvoidedAuto(distance);
                        
                        // ✅ ACTUALIZAR ESTADO ACTUAL DEL OBSTÁCULO
                        this.updateCurrentObstacle(`🤖 Obstáculo esquivado a ${distance}cm`);
                    }
                    
                    // ✅ OBSTÁCULOS DETECTADOS POR EL CARRO - WebSocket
                    else if (data.type === 'obstacle_detected') {
                        console.log('🛑 OBSTÁCULO DETECTADO POR EL CARRO:', data);
                        
                        // ✅ ACTUALIZAR ESTADO ACTUAL DEL OBSTÁCULO
                        const distance = data.distance || 0;
                        const location = this.getLocationText(data.location || 'front');
                        this.updateCurrentObstacle(`🛑 Obstáculo a ${distance}cm (${location})`);
                        
                        // Actualizar tabla automáticamente via WebSocket
                        this.addObstacleToTableRealTime({
                            fecha_hora: new Date().toISOString(),
                            status_texto: 'Obstáculo detectado automáticamente',
                            distance: data.distance,
                            location: data.location || 'front',
                            automatico: true
                        });
                        
                        this.handleObstacleDetection(data);
                    }
                    
                    // Manejo de vía libre
                    else if (data.type === 'path_clear') {
                        console.log('✅ VÍA LIBRE:', data);
                        this.handlePathClear(data);
                        
                        // ✅ ACTUALIZAR ESTADO ACTUAL DEL OBSTÁCULO
                        this.updateCurrentObstacle('✅ Vía libre');
                    }
                    
                    // Heartbeat con información de obstáculos
                    else if (data.type === 'car_heartbeat' && data.obstacle_detected !== undefined) {
                        this.updateObstacleStatusFromHeartbeat(data);
                    }
                    
                    // ✅ DATOS INICIALES - WebSocket
                    else if (data.type === 'initial_data') {
                        console.log('📦 Recibiendo datos iniciales via WebSocket');
                        this.handleInitialData(data);
                    }
                    
                    // ✅ RESPUESTA DE DISPOSITIVOS - WebSocket (CORREGIDO)
                    else if (data.type === 'devices_list' || data.type === 'devices_data') {
                        console.log('📱 Recibiendo dispositivos via WebSocket:', data.devices || data.data);
                        this.devices = data.devices || data.data || [];
                        this.populateDeviceSelect(this.devices);
                        this.renderDevicesList(this.devices);
                        this.renderDevicesTable(this.devices);
                    }
                    
                    // ✅ RESPUESTA DE SECUENCIAS - WebSocket (CORREGIDO)
                    else if (data.type === 'sequences_list' || data.type === 'sequences_data') {
                        console.log('🎬 Recibiendo secuencias via WebSocket:', data.sequences || data.data);
                        const rawSequences = data.sequences || data.data || [];
                        this.sequences = this.formatSequencesData(rawSequences);
                        this.renderSequencesList(this.sequences);
                        this.renderSequencesTable(this.sequences);
                    }
                    
                    // ✅ RESPUESTA DE OBSTÁCULOS - WebSocket (CORREGIDO)
                    else if (data.type === 'obstacles_list' || data.type === 'obstacles_data') {
                        console.log('🛑 Recibiendo obstáculos via WebSocket:', data.obstacles || data.data);
                        const obstacles = data.obstacles || data.data || [];
                        
                        // ✅ LLAMAR A LA FUNCIÓN CORRECTA
                        this.updateObstaclesTable(obstacles);
                        
                        // También actualizar la lista manual si es necesario
                        const manualObstacles = obstacles.filter(obs => !obs.automatico);
                        this.updateManualObstaclesList(manualObstacles);
                    }

                    // ✅ RESPUESTA DE CREACIÓN DE OBSTÁCULO - WebSocket
                    else if (data.type === 'obstacle_created') {
                        console.log('✅ Obstáculo creado via WebSocket:', data);
                        this.showNotification('✅ Obstáculo registrado correctamente', 'success');
                        
                        // ✅ ACTUALIZAR INMEDIATAMENTE LA TABLA
                        if (data.obstacle) {
                            this.addObstacleToTableRealTime(data.obstacle);
                        }
                        
                        // También recargar obstáculos después de crear uno nuevo
                        setTimeout(() => {
                            this.requestObstaclesUpdate();
                        }, 1000);
                    }

                    // ✅ RESPUESTA DE ELIMINACIÓN DE OBSTÁCULO - WebSocket
                    else if (data.type === 'obstacle_deleted') {
                        console.log('✅ Obstáculo eliminado via WebSocket:', data);
                        this.showNotification('✅ Obstáculo eliminado correctamente', 'success');
                        // Recargar obstáculos después de eliminar
                        this.requestObstaclesUpdate();
                    }

                    // ✅ RESPUESTA DE CREACIÓN DE DISPOSITIVO - WebSocket
                    else if (data.type === 'device_created' || data.type === 'device_updated') {
                        console.log('✅ Dispositivo guardado via WebSocket:', data);
                        this.showNotification('✅ Dispositivo guardado correctamente', 'success');
                        // Recargar dispositivos después de guardar
                        this.requestDevicesUpdate();
                    }

                    // ✅ RESPUESTA DE ELIMINACIÓN DE DISPOSITIVO - WebSocket
                    else if (data.type === 'device_deleted') {
                        console.log('✅ Dispositivo eliminado via WebSocket:', data);
                        this.showNotification('✅ Dispositivo eliminado correctamente', 'success');
                        // Recargar dispositivos después de eliminar
                        this.requestDevicesUpdate();
                    }

                    // ✅ RESPUESTA DE CREACIÓN DE SECUENCIA - WebSocket
                    else if (data.type === 'sequence_created' || data.type === 'sequence_updated') {
                        console.log('✅ Secuencia guardada via WebSocket:', data);
                        this.showNotification('✅ Secuencia guardada correctamente', 'success');
                        // Recargar secuencias después de guardar
                        this.requestSequencesUpdate();
                    }

                    // ✅ RESPUESTA DE ELIMINACIÓN DE SECUENCIA - WebSocket
                    else if (data.type === 'sequence_deleted') {
                        console.log('✅ Secuencia eliminada via WebSocket:', data);
                        this.showNotification('✅ Secuencia eliminada correctamente', 'success');
                        // Recargar secuencias después de eliminar
                        this.requestSequencesUpdate();
                    }
                    
                    // Respuesta de comando
                    else if (data.status === 'success') {
                        console.log(`✅ Comando aceptado por servidor: ${data.message}`);
                        if (data.cars_reached === 0) {
                            this.showNotification('No hay carros conectados', 'warning');
                            this.updateCarStatus(false);
                            this.updateCurrentStatus('Desconectado');
                        } else {
                            this.updateCarStatus(true);
                            this.updateCurrentStatus('Conectado - Carro Principal');
                        }
                    }
                    
                } catch (e) {
                    console.error('❌ Error procesando mensaje WebSocket:', e);
                    console.log('📨 Mensaje RAW:', event.data);
                }
            };
            
            window.ws.onerror = (error) => {
                console.error('❌ WebSocket error:', error);
                this.isWSConnected = false;
                this.updateServerStatus(false);
                this.updateCurrentStatus('Error de conexión');
                this.showNotification('Error de conexión WebSocket', 'error');
            };
            
            window.ws.onclose = (event) => {
                console.log('🔌 WebSocket desconectado:', event.code, event.reason);
                this.isWSConnected = false;
                this.updateServerStatus(false);
                this.updateCurrentStatus('Desconectado');
                
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
            this.updateCurrentStatus('Error de conexión');
        }
    }

    // ==========================================
    // ✅ SOLICITAR DATOS INICIALES POR WEBSOCKET
    // ==========================================

    requestInitialData() {
        if (!this.isWSConnected || !window.ws || window.ws.readyState !== WebSocket.OPEN) {
            console.log('❌ WebSocket no conectado para solicitar datos iniciales');
            return;
        }
        
        console.log('📡 Solicitando datos iniciales via WebSocket...');
        
        // Solicitar dispositivos
        console.log('📱 Enviando solicitud de dispositivos...');
        this.requestDevicesUpdate();
        
        // Solicitar secuencias
        console.log('🎬 Enviando solicitud de secuencias...');
        this.requestSequencesUpdate();
        
        // Solicitar obstáculos
        console.log('🛑 Enviando solicitud de obstáculos...');
        this.requestObstaclesUpdate();
    }

    // ==========================================
    // ✅ MANEJAR DATOS INICIALES POR WEBSOCKET
    // ==========================================

    handleInitialData(data) {
        console.log('📦 Procesando datos iniciales via WebSocket:', data);
        
        // Dispositivos
        if (data.devices) {
            this.devices = data.devices;
            this.populateDeviceSelect(this.devices);
            this.renderDevicesList(this.devices);
            this.renderDevicesTable(this.devices);
        }
        
        // Secuencias
        if (data.sequences) {
            this.sequences = data.sequences;
            this.renderSequencesList(this.sequences);
            this.renderSequencesTable(this.sequences);
        }
        
        // Obstáculos
        if (data.obstacles) {
            this.updateObstaclesTable(data.obstacles);
        }
        
        this.showNotification('✅ Datos iniciales cargados via WebSocket', 'success');
    }

    // ==========================================
    // ✅ SOLICITAR ACTUALIZACIONES POR WEBSOCKET
    // ==========================================

    requestObstaclesUpdate() {
        if (!this.isWSConnected || !window.ws || window.ws.readyState !== WebSocket.OPEN) {
            return;
        }
        
        const request = {
            type: 'get_obstacles',
            device_id: this.currentDevice,
            timestamp: new Date().toISOString()
        };
        
        try {
            window.ws.send(JSON.stringify(request));
            console.log('📡 Solicitando obstáculos via WebSocket...');
        } catch (error) {
            console.error('❌ Error solicitando obstáculos:', error);
        }
    }

    requestDevicesUpdate() {
        if (!this.isWSConnected || !window.ws || window.ws.readyState !== WebSocket.OPEN) {
            return;
        }
        
        const request = {
            type: 'get_devices',
            timestamp: new Date().toISOString()
        };
        
        try {
            window.ws.send(JSON.stringify(request));
            console.log('📡 Solicitando dispositivos via WebSocket...');
        } catch (error) {
            console.error('❌ Error solicitando dispositivos:', error);
        }
    }

    requestSequencesUpdate() {
        if (!this.isWSConnected || !window.ws || window.ws.readyState !== WebSocket.OPEN) {
            return;
        }
        
        const request = {
            type: 'get_sequences',
            timestamp: new Date().toISOString()
        };
        
        try {
            window.ws.send(JSON.stringify(request));
            console.log('📡 Solicitando secuencias via WebSocket...');
        } catch (error) {
            console.error('❌ Error solicitando secuencias:', error);
        }
    }

    // ==========================================
    // ✅ CREAR OBSTÁCULO MANUAL POR WEBSOCKET - ACTUALIZADO
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

        try {
            window.ws.send(JSON.stringify(obstacleData));
            console.log('📤 Enviando obstáculo manual via WebSocket:', obstacleData);
            this.showAlert(`✅ Obstáculo en ${ubicacion} registrado via WebSocket`, 'success');
            
            // ✅ ACTUALIZAR ESTADO ACTUAL DEL OBSTÁCULO
            this.updateCurrentObstacle(`🛑 Obstáculo manual en ${ubicacion}`);
            
            // ✅ AGREGAR INMEDIATAMENTE A LA TABLA (feedback inmediato)
            this.addObstacleToTableRealTime({
                fecha_hora: new Date().toISOString(),
                status_texto: 'Obstáculo manual registrado',
                ubicacion: ubicacion,
                distancia_detectada: 'N/A',
                descripcion: descripcion,
                automatico: false
            });
            
        } catch (error) {
            console.error('Error enviando obstáculo manual:', error);
            this.showAlert('⚠️ Error al registrar obstáculo', 'danger');
        }
    }

    // ==========================================
    // ✅ ELIMINAR OBSTÁCULO MANUAL POR WEBSOCKET
    // ==========================================

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

        try {
            window.ws.send(JSON.stringify(deleteData));
            console.log('🗑️ Enviando eliminación de obstáculo via WebSocket:', deleteData);
        } catch (error) {
            console.error('Error eliminando obstáculo:', error);
            this.showAlert('⚠️ Error al eliminar obstáculo', 'danger');
        }
    }

    // ==========================================
    // ✅ LIMPIAR OBSTÁCULOS MANUALES POR WEBSOCKET
    // ==========================================

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

        try {
            window.ws.send(JSON.stringify(clearData));
            console.log('🧹 Enviando limpieza de obstáculos via WebSocket:', clearData);
            this.showAlert('✅ Limpiando obstáculos manuales via WebSocket', 'success');
            
            // Recargar tabla de obstáculos
            this.requestObstaclesUpdate();
            
        } catch (error) {
            console.error('Error limpiando obstáculos:', error);
            this.showAlert('⚠️ Error al limpiar obstáculos', 'danger');
        }
    }

    // ==========================================
    // ✅ GUARDAR DISPOSITIVO POR WEBSOCKET
    // ==========================================

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

        try {
            window.ws.send(JSON.stringify(deviceData));
            console.log('💾 Enviando dispositivo via WebSocket:', deviceData);
            
            // Cerrar modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('deviceModal'));
            if (modal) {
                modal.hide();
            }
            
            this.showAlert(`✅ Dispositivo ${id ? 'actualizado' : 'creado'} via WebSocket`, 'success');
        } catch (error) {
            console.error('Error guardando dispositivo:', error);
            this.showAlert('⚠️ Error al guardar dispositivo', 'danger');
        }
    }

    // ==========================================
    // ✅ ELIMINAR DISPOSITIVO POR WEBSOCKET
    // ==========================================

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

        try {
            window.ws.send(JSON.stringify(deleteData));
            console.log('🗑️ Enviando eliminación de dispositivo via WebSocket:', deleteData);
        } catch (error) {
            console.error('Error eliminando dispositivo:', error);
            this.showAlert('⚠️ Error al eliminar dispositivo', 'danger');
        }
    }

    // ==========================================
    // ✅ GUARDAR SECUENCIA POR WEBSOCKET
    // ==========================================

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

        try {
            window.ws.send(JSON.stringify(sequenceData));
            console.log('💾 Enviando secuencia via WebSocket:', sequenceData);
            
            // Cerrar modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('sequenceModal'));
            if (modal) {
                modal.hide();
            }
            
            this.showAlert(`✅ Secuencia ${id ? 'actualizada' : 'creada'} via WebSocket`, 'success');
        } catch (error) {
            console.error('Error guardando secuencia:', error);
            this.showAlert('⚠️ Error al guardar secuencia', 'danger');
        }
    }

    // ==========================================
    // ✅ ELIMINAR SECUENCIA POR WEBSOCKET
    // ==========================================

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

        try {
            window.ws.send(JSON.stringify(deleteData));
            console.log('🗑️ Enviando eliminación de secuencia via WebSocket:', deleteData);
        } catch (error) {
            console.error('Error eliminando secuencia:', error);
            this.showAlert('⚠️ Error al eliminar secuencia', 'danger');
        }
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
        
        if (!this.isWSConnected || !window.ws || window.ws.readyState !== WebSocket.OPEN) {
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
            window.ws.send(JSON.stringify(blockedMessage));
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
            window.ws.send(JSON.stringify(message));
            this.showNotification(`Ejecutando: ${operation.name} (Velocidad: ${this.currentSpeed})`, 'info');
            
            // ✅ AGREGAR MOVIMIENTO AL LOG
            this.addToMovementLog(operationId, operation.name);
            
        } catch (error) {
            console.error('Error enviando comando WebSocket:', error);
            this.showNotification('Error enviando comando', 'error');
        }
    }

    // ==========================================
    // FUNCIONES DE MANEJO DE OBSTÁCULOS
    // ==========================================

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

    // ==========================================
    // BLOQUEO AUTOMÁTICO DE CONTROLES
    // ==========================================

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

    // ==========================================
    // FUNCIONES DE ESTADO WEBSOCKET
    // ==========================================

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

    // ==========================================
    // NOTIFICACIONES WEBSOCKET
    // ==========================================

    showNotification(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);
        this.showWsMessage(message, type);
    }

    // ==========================================
    // ACTUALIZACIONES DE ESTADO
    // ==========================================

    initializeStatusUpdates() {
        setInterval(() => {
            this.updateStatusTimestamp();
        }, 1000);
    }

    updateStatusTimestamp() {
        const timestampElement = document.getElementById('statusTimestamp');
        if (timestampElement) {
            timestampElement.textContent = `Actualizado: ${new Date().toLocaleTimeString()}`;
        }
    }

    getUptime() {
        if (!this.startTime) {
            this.startTime = new Date();
        }
        const now = new Date();
        const diff = now - this.startTime;
        return Math.floor(diff / 1000); // Segundos de actividad
    }

    getTotalCommands() {
        return this.commandHistory ? this.commandHistory.length : 0;
    }

    getTotalObstacles() {
        return this.obstacleHistory ? this.obstacleHistory.length : 0;
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
    }

    // ==========================================
    // DISPOSITIVOS - TODO POR WEBSOCKET
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
        document.getElementById('deviceSelect').value = deviceId;
        document.getElementById('deviceSelect').dispatchEvent(new Event('change'));
        
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

    // ==========================================
    // SECUENCIAS - TODO POR WEBSOCKET
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
            document.getElementById('sequenceModalTitle').textContent = 'Nueva Secuencia';
            document.getElementById('sequenceForm').reset();
            document.getElementById('sequenceId').value = '';
            document.getElementById('sequenceDevice').value = this.currentDevice;
        }
        
        modal.show();
    }

    // ==========================================
    // EJECUCIÓN DE SECUENCIA MEJORADA
    // ==========================================

    async executeSequenceWithMode(sequenceId) {
        // Cambiar a modo secuencia
        this.setMode('sequence');
        await this.sleep(1000);
        
        // Ejecutar secuencia
        await this.executeSequence(sequenceId);
        
        // Al terminar, volver a modo manual
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
            document.getElementById('deviceSelect').value = sequence.id_dispositivo;
            document.getElementById('deviceSelect').dispatchEvent(new Event('change'));
        }

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

            // Verificar obstáculos antes de cada movimiento
            if (this.obstacleStatus.detected) {
                const op = operations[i];
                const opText = this.getOperationText(op);
                
                // Si hay obstáculo y el movimiento es hacia adelante, saltarlo
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

    // ==========================================
    // FUNCIONES AUXILIARES
    // ==========================================

    getDemoSequenceId() {
        if (this.sequences && this.sequences.length > 0) {
            return this.sequences[0].id_secuencia;
        }
        return 1;
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
    // FUNCIONES PARA ICONOS Y BADGES
    // ==========================================

    getMovementIcon(operationId) {
        const icons = {
            1: '🚗',    // Adelante
            2: '🚗',    // Atrás
            3: '🛑',    // Detener
            4: '↗️',    // Vuelta Adelante Der.
            5: '↖️',    // Vuelta Adelante Izq.
            6: '↘️',    // Vuelta Atrás Der.
            7: '↙️',    // Vuelta Atrás Izq.
            8: '↷',     // Giro 90° Derecha
            9: '↶',     // Giro 90° Izquierda
            10: '⟳',    // Giro 360° Derecha
            11: '⟲'     // Giro 360° Izquierda
        };
        return icons[operationId] || '📝';
    }

    getSpeedBadgeClass(speed) {
        const classes = {
            'low': 'bg-success',
            'medium': 'bg-warning',
            'high': 'bg-danger'
        };
        return classes[speed] || 'bg-secondary';
    }

    getSpeedText(speed) {
        const texts = {
            'low': 'Baja',
            'medium': 'Media',
            'high': 'Alta'
        };
        return texts[speed] || speed;
    }

    // ==========================================
    // DEMO RÁPIDO
    // ==========================================
    
    async startDemoMode() {
        if (!this.isWSConnected) {
            this.showAlert('❌ No conectado al servidor WebSocket', 'danger');
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

            // Verificar obstáculos antes de cada movimiento
            if (this.obstacleStatus.detected && demoSequence[i].op === 1) {
                this.showWsMessage(`⏭️ Saltando movimiento adelante - Obstáculo detectado`, 'warning');
                continue;
            }

            const step = demoSequence[i];
            this.sendWSCommand(step.op);
            this.showWsMessage(`🔧 Demo [${i + 1}/${demoSequence.length}]: ${step.text}`, 'info');
            
            await new Promise(resolve => setTimeout(resolve, step.delay));
        }

        if (this.isDemoRunning) {
            this.showAlert('✅ MODO DEMO COMPLETADO', 'success');
            this.showWsMessage('✅ Secuencia finalizada', 'success');
        }

        this.isDemoRunning = false;
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
        
        // Auto-remove after 5 seconds
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
            
            // Auto-remove after 5 seconds
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
                this.updateCurrentStatus(`Conectado - ${e.target.options[e.target.selectedIndex].text}`);
                
                // Solicitar obstáculos del nuevo dispositivo
                this.requestObstaclesUpdate();
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

        // ✅ BOTÓN PARA LIMPIAR HISTORIAL DE MOVIMIENTOS
        const clearMovementsBtn = document.getElementById('clearMovementsBtn');
        if (clearMovementsBtn) {
            clearMovementsBtn.addEventListener('click', () => {
                this.clearMovementLog();
            });
        }

        // Inicializar listeners de obstáculos manuales
        this.initializeObstacleListeners();
    }

    // ==========================================
    // OBSTÁCULOS MANUALES - LISTENERS
    // ==========================================

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

    // ==========================================
    // ✅ FUNCIÓN PARA REPETIR MOVIMIENTO
    // ==========================================

    repeatMovement(operationId) {
        console.log(`🔄 Repitiendo movimiento: ${operationId}`);
        this.sendWSCommand(operationId);
        this.showNotification(`🔄 Repitiendo: ${this.getOperationText(operationId)}`, 'info');
    }

    // ==========================================
    // ✅ FUNCIÓN PARA LIMPIAR HISTORIAL DE MOVIMIENTOS
    // ==========================================

    clearMovementLog() {
        if (!this.movementHistory || this.movementHistory.length === 0) {
            this.showNotification('ℹ️ No hay movimientos para limpiar', 'info');
            return;
        }

        if (confirm('¿Estás seguro de que quieres limpiar el historial de movimientos?')) {
            this.movementHistory = [];
            this.saveMovementHistoryToStorage();
            this.renderMovementLog();
            this.showNotification('🗑️ Historial de movimientos limpiado', 'success');
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