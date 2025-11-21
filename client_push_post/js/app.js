class CarControlApp {
    constructor() {
        this.apiBaseUrl = 'http://98.91.159.217:5500';
        this.socket = io('http://98.91.159.217:5500', {
            transports: ['websocket'],
            secure: false
        });
        
        // ==========================================
        // CONFIGURACIÓN WEBSOCKET
        // ==========================================
        this.WS_HOST = '98.91.159.217';
        this.WS_PORT = 5501;
        this.WS_PATH = '/client';
        this.WS_URL = `ws://${this.WS_HOST}:${this.WS_PORT}${this.WS_PATH}`;
        
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
        this.loadDevices();
        this.loadSequences();
        this.connectSocketIO();
        this.initializeSyncFeatures();
        this.initializeStatusUpdates();
        this.connectWebSocket();
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
        badge.textContent = speed === 'low' ? 'Baja' : speed === 'medium' ? 'Media' : 'Alta';
        badge.className = 'badge ' + (speed === 'low' ? 'bg-success' : speed === 'medium' ? 'bg-warning' : 'bg-danger');
        
        // Enviar al Arduino
        if (this.isWSConnected) {
            const message = {
                command: 'set_speed',
                speed: this.SPEED_VALUES[speed],
                timestamp: new Date().toISOString()
            };
            
            this.ws.send(JSON.stringify(message));
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
        
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
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
    // WEBSOCKET CON DETECCIÓN DE OBSTÁCULOS - ACTUALIZADO
    // ==========================================

    connectWebSocket() {
        console.log('🔌 Conectando a WebSocket...');
        
        try {
            this.ws = new WebSocket(this.WS_URL);
            
            this.ws.onopen = () => {
                console.log('✅ WebSocket conectado');
                this.updateServerStatus(true);
                this.showNotification('Conectado al servidor WebSocket', 'success');
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('📨 Mensaje WebSocket:', data);
                    
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
                        } else {
                            this.showNotification('Carro desconectado', 'warning');
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
                    }
                    
                    // OBSTÁCULO ESQUIVADO EN MODO SECUENCIA
                    else if (data.event === 'obstacle_avoided' && this.currentMode === 'sequence') {
                        const distance = data.distance || 0;
                        this.showObstacleAvoidedAuto(distance);
                    }
                    
                    // MANEJO DE OBSTÁCULOS DEL CARRO
                    else if (data.type === 'obstacle_detected') {
                        console.log('🛑 OBSTÁCULO DETECTADO POR EL CARRO:', data);
                        this.handleObstacleDetection(data);
                    }
                    
                    // Manejo de vía libre
                    else if (data.type === 'path_clear') {
                        console.log('✅ VÍA LIBRE:', data);
                        this.handlePathClear(data);
                    }
                    
                    // Heartbeat con información de obstáculos
                    else if (data.type === 'car_heartbeat' && data.obstacle_detected !== undefined) {
                        this.updateObstacleStatusFromHeartbeat(data);
                    }
                    
                    // Respuesta de comando
                    else if (data.status === 'success') {
                        console.log(`✅ Comando aceptado por servidor: ${data.message}`);
                        if (data.cars_reached === 0) {
                            this.showNotification('No hay carros conectados', 'warning');
                            this.updateCarStatus(false);
                        } else {
                            this.updateCarStatus(true);
                        }
                    }
                    
                } catch (e) {
                    console.error('Error procesando mensaje WebSocket:', e);
                }
            };
            
            this.ws.onerror = (error) => {
                console.error('❌ WebSocket error:', error);
                this.showNotification('Error de conexión WebSocket', 'error');
            };
            
            this.ws.onclose = () => {
                console.log('🔌 WebSocket desconectado');
                this.updateServerStatus(false);
                
                // Reconectar después de 5 segundos
                setTimeout(() => {
                    console.log('🔄 Intentando reconectar WebSocket...');
                    this.connectWebSocket();
                }, 5000);
            };
            
        } catch (error) {
            console.error('Error creando WebSocket:', error);
            this.updateServerStatus(false);
        }
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

    // ==========================================
    // EVENT LISTENERS ACTUALIZADOS
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
        document.getElementById('deviceSelect').addEventListener('change', (e) => {
            const oldDevice = this.currentDevice;
            this.currentDevice = parseInt(e.target.value);
            
            if (this.socket && this.socket.connected) {
                this.socket.emit('unsubscribe_device', { device_id: oldDevice });
                this.socket.emit('subscribe_device', { device_id: this.currentDevice });
            }
            
            this.showAlert(`Cambiado a: ${e.target.options[e.target.selectedIndex].text}`, 'info');
            this.loadManualObstacles();
            this.updateCurrentStatus();
        });

        // Botón modo demo ACTUALIZADO
        document.getElementById('demoBtn').addEventListener('click', () => {
            if (!this.isDemoRunning) {
                this.executeSequenceWithMode(this.getDemoSequenceId());
            } else {
                this.showAlert('⚠️ Demo ya en ejecución', 'warning');
            }
        });

        // Botón detener emergencia
        document.getElementById('stopBtn').addEventListener('click', () => {
            this.isDemoRunning = false;
            this.sendWSCommand(3);
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

        // Botón guardar dispositivo
        document.getElementById('saveDeviceBtn').addEventListener('click', () => {
            this.saveDevice();
        });

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

        // Control con teclado
        document.addEventListener('keydown', (e) => {
            if (!this.isWSConnected || !this.carConnected) return;
            
            switch(e.key) {
                case 'ArrowUp':
                case 'w':
                case 'W':
                    this.sendWSCommand(1);
                    e.preventDefault();
                    break;
                case 'ArrowDown':
                case 's':
                case 'S':
                    this.sendWSCommand(2);
                    e.preventDefault();
                    break;
                case 'ArrowLeft':
                case 'a':
                case 'A':
                    this.sendWSCommand(9);
                    e.preventDefault();
                    break;
                case 'ArrowRight':
                case 'd':
                case 'D':
                    this.sendWSCommand(8);
                    e.preventDefault();
                    break;
                case ' ':
                    this.sendWSCommand(3);
                    e.preventDefault();
                    break;
                case '1':
                    this.setSpeed('low');
                    e.preventDefault();
                    break;
                case '2':
                    this.setSpeed('medium');
                    e.preventDefault();
                    break;
                case '3':
                    this.setSpeed('high');
                    e.preventDefault();
                    break;
            }
        });
    }

    // ==========================================
    // ENVIAR COMANDOS WEBSOCKET CON VELOCIDAD
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
            
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                const blockedMessage = {
                    type: 'movement_blocked',
                    command: operation.command,
                    reason: 'obstacle_detected',
                    distance: this.obstacleStatus.distance,
                    location: this.obstacleStatus.location,
                    timestamp: new Date().toISOString()
                };
                this.ws.send(JSON.stringify(blockedMessage));
            }
            return;
        }
        
        const message = {
            command: operation.command,
            duration: operation.duration,
            speed: this.SPEED_VALUES[this.currentSpeed], // 🆕 Incluir velocidad actual
            timestamp: new Date().toISOString()
        };
        
        console.log(`📤 Enviando comando al servidor: ${operation.name} a velocidad ${this.currentSpeed}`);
        console.log(`   Comando API: ${operation.command}`);
        console.log(`   Duración: ${operation.duration}ms`);
        console.log(`   Velocidad: ${this.SPEED_VALUES[this.currentSpeed]} PWM`);
        
        try {
            this.ws.send(JSON.stringify(message));
            this.showNotification(`Ejecutando: ${operation.name} (Velocidad: ${this.currentSpeed})`, 'info');
            
            this.addToCommandHistory({
                id_dispositivo: this.currentDevice,
                status_operacion: operationId,
                status_texto: this.getOperationText(operationId)
            });
            
            const button = document.querySelector(`[data-operation="${operationId}"]`);
            if (button) {
                button.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    button.style.transform = 'scale(1)';
                }, 100);
            }
            
        } catch (error) {
            console.error('Error enviando comando WebSocket:', error);
            this.showNotification('Error enviando comando', 'error');
        }
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

    updateCurrentStatus() {
        const statusElement = document.getElementById('currentStatus');
        const deviceName = document.getElementById('deviceSelect').options[document.getElementById('deviceSelect').selectedIndex].text;
        
        if (statusElement) {
            statusElement.innerHTML = `
                <span class="badge ${this.isConnected ? 'bg-success' : 'bg-secondary'}">
                    ${this.isConnected ? 'Conectado' : 'Desconectado'} - ${deviceName}
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

    // ==========================================
    // SINCRONIZACIÓN CON APP MONITOREO
    // ==========================================

    initializeSyncFeatures() {
        this.setupMonitoringSync();
    }

    setupMonitoringSync() {
        setInterval(() => {
            this.syncMonitoringApp();
        }, 10000);
    }

    syncMonitoringApp() {
        if (!this.isConnected) return;
        
        this.socket.emit('monitoring_sync', {
            type: 'status_update',
            device_id: this.currentDevice,
            timestamp: new Date().toISOString(),
            data: {
                total_commands: this.getTotalCommands(),
                total_obstacles: this.getTotalObstacles(),
                is_demo_running: this.isDemoRunning,
                connection_status: this.isConnected ? 'connected' : 'disconnected',
                current_device: this.currentDevice,
                ws_connected: this.isWSConnected,
                car_connected: this.carConnected,
                obstacle_detected: this.obstacleStatus.detected,
                obstacle_distance: this.obstacleStatus.distance,
                obstacle_location: this.obstacleStatus.location,
                current_mode: this.currentMode,
                current_speed: this.currentSpeed,
                speed_pwm: this.SPEED_VALUES[this.currentSpeed]
            }
        });
    }

    getTotalCommands() {
        return this.commandHistory ? this.commandHistory.length : 0;
    }

    getTotalObstacles() {
        return this.obstacleHistory ? this.obstacleHistory.length : 0;
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
        this.syncMonitoringApp();
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
        this.syncMonitoringApp();
    }

    // ==========================================
    // OBSTÁCULOS MANUALES
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

    async createManualObstacle(ubicacion) {
        if (!this.isConnected) {
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
            id_dispositivo: this.currentDevice,
            status_obstaculo: status_obstaculo,
            ubicacion: ubicacion,
            descripcion: descripcion
        };

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/obstacles/manual`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(obstacleData)
            });

            const data = await response.json();

            if (data.status === 'success') {
                this.showAlert(`✅ Obstáculo en ${ubicacion} registrado`, 'success');
                this.showWsMessage(`🛑 Obstáculo manual: ${descripcion}`, 'warning');
                
                this.addToObstacleHistory({
                    ...obstacleData,
                    status_texto: this.getObstacleText(status_obstaculo)
                });
                
                this.loadManualObstacles();
            } else {
                this.showAlert(`❌ Error: ${data.message}`, 'danger');
            }
        } catch (error) {
            console.error('Error creating manual obstacle:', error);
            this.showAlert('⚠️ Error al registrar obstáculo', 'danger');
        }
    }

    async loadManualObstacles() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/obstacles/manual?device_id=${this.currentDevice}&limit=10`);
            const data = await response.json();
            
            if (data.status === 'success') {
                this.renderManualObstaclesList(data.data);
            }
        } catch (error) {
            console.error('Error loading manual obstacles:', error);
        }
    }

    renderManualObstaclesList(obstacles) {
        const container = document.getElementById('manualObstaclesList');
        if (!container) return;
        
        if (obstacles.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-3">
                    <i class="bi bi-shield-check display-6"></i>
                    <p class="mt-2">No hay obstáculos manuales registrados</p>
                </div>
            `;
            return;
        }

        container.innerHTML = obstacles.map(obs => `
            <div class="alert alert-warning mb-2">
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
    }

    async deleteManualObstacle(obstacleId) {
        if (!confirm('¿Eliminar este obstáculo manual?')) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/obstacles/manual/${obstacleId}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (data.status === 'success') {
                this.showAlert('✅ Obstáculo manual eliminado', 'success');
                this.loadManualObstacles();
                this.syncMonitoringApp();
            } else {
                this.showAlert(`❌ Error: ${data.message}`, 'danger');
            }
        } catch (error) {
            console.error('Error deleting manual obstacle:', error);
            this.showAlert('⚠️ Error al eliminar obstáculo', 'danger');
        }
    }

    async clearManualObstacles() {
        if (!confirm('¿Eliminar todos los obstáculos manuales?')) {
            return;
        }

        try {
            const obstacles = await this.getCurrentManualObstacles();
            
            for (const obstacle of obstacles) {
                await this.deleteManualObstacle(obstacle.id_evento);
            }
            
            this.showAlert('✅ Todos los obstáculos manuales eliminados', 'success');
            this.syncMonitoringApp();
        } catch (error) {
            console.error('Error clearing manual obstacles:', error);
            this.showAlert('⚠️ Error al limpiar obstáculos', 'danger');
        }
    }

    async getCurrentManualObstacles() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/obstacles/manual?device_id=${this.currentDevice}&limit=50`);
            const data = await response.json();
            return data.status === 'success' ? data.data : [];
        } catch (error) {
            return [];
        }
    }

    // ==========================================
    // DISPOSITIVOS
    // ==========================================

    async loadDevices() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/devices`);
            const data = await response.json();
            
            if (data.status === 'success') {
                this.devices = data.data;
                this.populateDeviceSelect(data.data);
                this.renderDevicesList(data.data);
                this.showWsMessage('✅ Dispositivos cargados correctamente', 'success');
                this.loadManualObstacles();
                this.updateCurrentStatus();
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

    // ==========================================
    // DISPOSITIVOS CRUD
    // ==========================================

    async saveDevice() {
        const id = document.getElementById('deviceId').value;
        const name = document.getElementById('deviceName').value.trim();
        const description = document.getElementById('deviceDescription').value.trim();

        if (!name) {
            this.showAlert('⚠️ El nombre del dispositivo es requerido', 'warning');
            return;
        }

        const deviceData = {
            nombre_dispositivo: name,
            descripcion: description
        };

        try {
            let url, method;
            
            if (id) {
                url = `${this.apiBaseUrl}/api/devices/${id}`;
                method = 'PUT';
            } else {
                url = `${this.apiBaseUrl}/api/devices`;
                method = 'POST';
            }

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(deviceData)
            });

            const data = await response.json();

            if (data.status === 'success') {
                this.showAlert(`✅ Dispositivo ${id ? 'actualizado' : 'creado'} correctamente`, 'success');
                bootstrap.Modal.getInstance(document.getElementById('deviceModal')).hide();
                await this.loadDevices();
                this.syncMonitoringApp();
            } else {
                this.showAlert(`❌ Error: ${data.message}`, 'danger');
            }
        } catch (error) {
            console.error('Error saving device:', error);
            this.showAlert('⚠️ Error al guardar dispositivo', 'danger');
        }
    }

    async deleteDevice(deviceId) {
        if (!confirm('¿Estás seguro de eliminar este dispositivo? Esta acción no se puede deshacer.')) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/devices/${deviceId}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (data.status === 'success') {
                this.showAlert('✅ Dispositivo eliminado correctamente', 'success');
                await this.loadDevices();
                this.syncMonitoringApp();
            } else {
                this.showAlert(`❌ Error: ${data.message}`, 'danger');
            }
        } catch (error) {
            console.error('Error deleting device:', error);
            this.showAlert('⚠️ Error al eliminar dispositivo', 'danger');
        }
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
    // SECUENCIAS
    // ==========================================

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

    async saveSequence() {
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

        const sequenceData = {
            id_dispositivo: device,
            nombre_secuencia: name,
            movimientos: opsArray
        };

        try {
            let url, method;
            
            if (id) {
                url = `${this.apiBaseUrl}/api/sequences/${id}`;
                method = 'PUT';
            } else {
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
                this.syncMonitoringApp();
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
                this.syncMonitoringApp();
            } else {
                this.showAlert(`❌ Error: ${data.message}`, 'danger');
            }
        } catch (error) {
            console.error('Error deleting sequence:', error);
            this.showAlert('⚠️ Error al eliminar secuencia', 'danger');
        }
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
        this.syncMonitoringApp();
    }

    // ==========================================
    // SOCKET.IO
    // ==========================================
    
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
                this.updateCurrentStatus();
                
                this.socket.emit('subscribe_device', { device_id: this.currentDevice });
                this.syncMonitoringApp();
            });

            this.socket.on('disconnect', () => {
                this.isConnected = false;
                this.updateConnectionStatus('Desconectado ❌', 'danger');
                this.showWsMessage('🔌 Conexión perdida. Reintentando...', 'warning');
                this.updateCurrentStatus();
                this.syncMonitoringApp();
            });

            this.socket.on('connect_error', (error) => {
                console.error('Connection error:', error);
                this.updateConnectionStatus('Error ❌', 'danger');
                this.showWsMessage('❌ Error de conexión. Verificando servidor...', 'danger');
                this.updateCurrentStatus();
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
                    
                    this.addToCommandHistory(data.data);
                }
            });

            this.socket.on('obstacle_update', (data) => {
                if (data.type === 'new_obstacle' && data.data) {
                    this.showWsMessage(`🛡️ Obstáculo detectado: ${data.data.status_texto}`, 'warning');
                    
                    this.addToObstacleHistory(data.data);
                }
                if (data.type === 'manual_obstacle_created' || data.type === 'manual_obstacle_deleted') {
                    this.loadManualObstacles();
                    this.syncMonitoringApp();
                }
            });

            this.socket.on('sequence_update', (data) => {
                if (data.type === 'sequence_created' || data.type === 'sequence_updated' || data.type === 'sequence_deleted') {
                    this.loadSequences();
                    this.syncMonitoringApp();
                }
            });

        } catch (error) {
            console.error('Socket.IO error:', error);
            this.showAlert('❌ Error al inicializar Socket.IO', 'danger');
        }
    }

    // ==========================================
    // COMANDOS
    // ==========================================
    
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
                
                this.addToCommandHistory({
                    ...commandData,
                    status_texto: operationText,
                    nombre_dispositivo: deviceName
                });
                
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
        this.syncMonitoringApp();
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
    console.log('🚀 Iniciando Control Carro IoT con WebSocket...');
    app = new CarControlApp();
});

// ==========================================
// FUNCIONES GLOBALES PARA HTML
// ==========================================

function setManualMode() {
    if (app) app.setMode('manual');
}

function setAutoMode() {
    if (app) app.setMode('sequence');
}

function setSpeed(speed) {
    if (app) app.setSpeed(speed);
}

// ==========================================
// MANEJO DE CIERRE WEBSOCKET
// ==========================================
window.addEventListener('beforeunload', function() {
    if (app && app.ws) {
        app.ws.close();
    }
});