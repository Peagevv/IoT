class CarControlApp {
    constructor() {
        this.apiBaseUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent('http://98.91.159.217:5500');
        this.wsUrl = null;
        this.ws = null;
        this.isConnected = false;
        this.currentDevice = 1;
        this.demos = [];
        this.isDemoRunning = false;
        
        this.initializeEventListeners();
        this.loadDevices();
        this.loadDemos();
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
            this.showDemoSelector();
        });

        // Botón gestionar demos
        document.getElementById('manageDemosBtn').addEventListener('click', () => {
            this.showDemoManager();
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
                this.populateDeviceSelect(data.data);
            } else {
                throw new Error(`Error del servidor: ${data.message}`);
            }
        } catch (error) {
            console.error('Error loading devices:', error);
            this.populateDeviceSelect();
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
            10: '⟳ Giro 360° derecha', 11: '⟲ Giro 360° izquierda'
        };
        return operations[operation] || `Operación ${operation}`;
    }

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
        
        if (confirm('¿Estás segura de que quieres eliminar esta demo?')) {
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
                this.showAlert('❌ Error eliminando demo', 'danger');
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
        
        const emptyMessage = document.createElement('div');
        emptyMessage.id = 'emptySequenceMessage';
        emptyMessage.className = 'text-center text-muted';
        
        const emptyText = document.createElement('p');
        emptyText.textContent = 'No hay movimientos en la secuencia';
        
        const addBtn = this.createButton(
            'Agregar Movimiento',
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
    }

    createMovementStep() {
        const step = document.createElement('div');
        step.className = 'movement-step card custom-card mb-2';
        
        const cardBody = document.createElement('div');
        cardBody.className = 'card-body';
        
        const row = document.createElement('div');
        row.className = 'row align-items-center';
        
        // Selector de operación
        const opCol = document.createElement('div');
        opCol.className = 'col-md-5';
        
        const opSelect = document.createElement('select');
        opSelect.className = 'form-select custom-select movement-operation';
        
        Object.entries(this.getOperationText).forEach(([key, value]) => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = value;
            opSelect.appendChild(option);
        });
        
        opCol.appendChild(opSelect);
        
        // Input de delay
        const delayCol = document.createElement('div');
        delayCol.className = 'col-md-4';
        
        const delayInput = document.createElement('input');
        delayInput.type = 'number';
        delayInput.className = 'form-control custom-input movement-delay';
        delayInput.placeholder = 'Delay (ms)';
        delayInput.value = '2000';
        
        delayCol.appendChild(delayInput);
        
        // Botón eliminar
        const deleteCol = document.createElement('div');
        deleteCol.className = 'col-md-3';
        
        const deleteBtn = this.createButton(
            '',
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
            const text = this.getOperationText(parseInt(operation));
            
            movements.push({
                op: parseInt(operation),
                text: text,
                delay: parseInt(delay)
            });
        });
        
        if (!name || movements.length === 0) {
            this.showAlert('❌ Nombre y al menos un movimiento requeridos', 'danger');
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/demos`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    nombre_demo: name,
                    secuencia: movements,
                    descripcion: description
                })
            });
            
            if (response.ok) {
                this.showAlert('✅ Demo guardada correctamente', 'success');
                await this.loadDemos();
                this.closeModal('demoCreatorModal');
            } else {
                this.showAlert('❌ Error guardando demo', 'danger');
            }
        } catch (error) {
            this.showAlert('❌ Error de conexión', 'danger');
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
            () => this.showDemoCreator()
        );
        
        createBtnContainer.appendChild(createBtn);
        
        // Lista de demos
        const demoList = document.createElement('div');
        demoList.className = 'list-group custom-list-group';
        
        this.demos.forEach(demo => {
            const demoItem = this.createDemoListItem(demo);
            demoList.appendChild(demoItem);
        });
        
        container.appendChild(createBtnContainer);
        container.appendChild(demoList);
        
        return container;
    }

    createDemoListItem(demo) {
        const item = document.createElement('div');
        item.className = 'list-group-item custom-list-group-item';
        
        const header = document.createElement('div');
        header.className = 'd-flex w-100 justify-content-between';
        
        const title = document.createElement('h6');
        title.className = 'mb-1';
        title.textContent = demo.nombre_demo;
        
        const date = document.createElement('small');
        date.textContent = new Date(demo.fecha_creacion).toLocaleDateString();
        
        header.appendChild(title);
        header.appendChild(date);
        
        const description = document.createElement('p');
        description.className = 'mb-1';
        description.textContent = demo.descripcion;
        
        const sequenceInfo = document.createElement('small');
        sequenceInfo.textContent = `Secuencia: ${demo.secuencia.length} movimientos`;
        
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'mt-2';
        
        const executeBtn = this.createButton(
            'Ejecutar',
            'custom-btn-primary btn-sm me-1',
            'bi-play-fill',
            () => this.startDemoMode(demo.secuencia)
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
        if (confirm('¿Estás segura de que quieres eliminar esta demo?')) {
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
                this.showAlert('❌ Error eliminando demo', 'danger');
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

    createFormGroup(labelText, inputType, inputId, placeholder) {
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
        
        group.appendChild(label);
        group.appendChild(input);
        
        return group;
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