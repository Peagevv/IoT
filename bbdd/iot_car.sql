--SE CREA LA BASE DE DATOS IoT
CREATE DATABASE IF NOT EXISTS IoT;
-- Se pone en uso la base de datos
USE IoT;

SELECT * FROM historial_operaciones ORDER BY fecha_hora DESC LIMIT 10;

-- se crea la tabla cliente
CREATE TABLE 'cliente' IF NOT EXISTS (
  'id_cliente' int AUTO_INCREMENT PRIMARY KEY,
  'nombre_cliente' char(25),
  'apellido_p' char(19),
  'apellido_m' char(19),
  'telefono' VARCHAR(12),
  'correo' varchar(25),
  'pais' char(20),
  'ciudad' char(20)
);
SELECT * FROM cliente;
-- se crea la tabla dispositivo, es decir cuantos carritos se han agregado
--cuales son, su ip, su ubi
CREATE TABLE `dispositivo` if not exists(
  `id_dispositivo` INT AUTO_INCREMENT PRIMARY KEY,
  `id_cliente` int NOT NULL,
  `ip` varchar(15),
  `latitud` decimal(10,7),
  `longitud` decimal(10,7),
  `nombre_dispositivo` varchar(100)
);
SELECT * FROM dispositivo;

-- se crea la tabla de operaciones, en donde se guardan los movimientos que puede
-- realizar el carrito
CREATE TABLE `operaciones` (
  `status_operacion` int PRIMARY KEY,
  `status_texto` varchar(100)
);
SELECT * FROM operaciones;

-- se crea la tabla de obstaculos, en donde se guardan los tipos de obstaculos
-- detectados por el carrito, es decir su ubicacion
DROP TABLE IF EXISTS obstaculos;

CREATE TABLE obstaculos (
  status_obstaculo INT PRIMARY KEY,
  status_texto VARCHAR(100)
);

INSERT INTO obstaculos (status_obstaculo, status_texto)
VALUES
(1, 'Obstáculo al frente'),
(2, 'Obstáculo a la izquierda'),
(3, 'Obstáculo a la derecha'),
(4, 'Obstáculo atrás'),
(5, 'Retroceso de emergencia');
SELECT * FROM obstaculos;

INSERT INTO obstaculos (status_obstaculo, status_texto)
VALUES
(1, 'Obstáculo al frente'),
(2, 'Obstáculo a la izquierda'),
(3, 'Obstáculo a la derecha'),
(4, 'Obstáculo atrás'),
(5, 'Retroceso de emergencia');

-- se crea la tabla de historial de operaciones que almacena los movimientos
-- que ha realizado el carrito
CREATE TABLE `historial_operaciones` (
  `id_evento` INT AUTO_INCREMENT PRIMARY KEY,
  `id_dispositivo` INT NOT NULL,
  `status_operacion` INT NOT NULL,
  `fecha_hora` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE historial_operaciones
MODIFY fecha_hora TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;


SELECT * FROM historial_operaciones;

-- se crea la tabla  de historial de obstaculos que almacena los obstaculos
-- que ha detectado el carrito
DROP TABLE IF EXISTS historial_obstaculos;
CREATE TABLE historial_obstaculos (
  id_evento INT AUTO_INCREMENT PRIMARY KEY,
  id_dispositivo INT NOT NULL,
  status_obstaculo INT NOT NULL,
  fecha_hora TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

SELECT * FROM historial_obstaculos;

SELECT * 
FROM historial_obstaculos
ORDER BY fecha_hora DESC
LIMIT 10;

SELECT 
    ho.id_evento,
    d.nombre_dispositivo,
    o.status_texto AS tipo_obstaculo,
    ho.fecha_hora
FROM historial_obstaculos ho
JOIN dispositivo d ON ho.id_dispositivo = d.id_dispositivo
JOIN obstaculos o ON ho.status_obstaculo = o.status_obstaculo
ORDER BY ho.fecha_hora DESC
LIMIT 10;



-- se crea la tabla de secuencias demo, en donde se guardan las secuencias
-- de operaciones predefinidos por el usuario
CREATE TABLE `secuencias_demo` (
  `id_secuencia` serial PRIMARY KEY,
  `id_dispositivo` int NOT NULL,
  `nombre_secuencia` varchar(100),
  `fecha_creacion` timestamp
);
SELECT * FROM secuencias_demo; 
-- Consultas de prueba
-- Buscar secuencias que contengan 'Exploracion' en su nombre
SELECT id_secuencia, nombre_secuencia 
FROM secuencias_demo 
WHERE nombre_secuencia LIKE '%Exploracion%';
SELECT 
    so.orden,
    o.status_operacion,
    o.status_texto as operacion
FROM secuencia_operaciones so
INNER JOIN operaciones o ON so.status_operacion = o.status_operacion
WHERE so.id_secuencia = 1
ORDER BY so.orden;


-- Agregar tabla de velocidades
CREATE TABLE IF NOT EXISTS velocidades (
  id_velocidad INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(50) NOT NULL,
  valor_pwm INT NOT NULL,
  descripcion VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar velocidades predefinidas
INSERT INTO velocidades (id_velocidad, nombre, valor_pwm, descripcion) VALUES
(1, 'Baja', 100, 'Velocidad baja - 40% PWM'),
(2, 'Media', 150, 'Velocidad media - 60% PWM'),
(3, 'Alta', 200, 'Velocidad alta - 80% PWM')
ON DUPLICATE KEY UPDATE 
  nombre = VALUES(nombre),
  valor_pwm = VALUES(valor_pwm),
  descripcion = VALUES(descripcion);

-- Verificar datos
SELECT * FROM velocidades;
-- se crea la tabla de operaciones que almacena las operaciones
-- que compoene cada secuencia demo y cual sera su orden de ejecucion
CREATE TABLE `secuencia_operaciones` (
  `id_secuencia_operaciones` serial PRIMARY KEY,
  `id_secuencia` int NOT NULL,
  `status_operacion` int NOT NULL,
  `orden` int
);
SELECT * FROM secuencia_operaciones;

-- se crea la tabla de ejecucion de secuencias
-- aqui se almacenan las veces que se ha ejecutado una secuencia demo
-- y su estado actual
CREATE TABLE `ejecucion_secuencias` (
  `id_ejecucion` serial PRIMARY KEY,
  `id_secuencia` int NOT NULL,
  `fecha_ejecucion` timestamp,
  `estado` enum('pendiente','progreso','completado','cancelado','fallido')
);
SELECT * FROM ejecucion_secuencias;


ALTER TABLE `dispositivo` ADD FOREIGN KEY (`id_cliente`) REFERENCES `cliente` (`id_cliente`);

ALTER TABLE `historial_operaciones` ADD FOREIGN KEY (`id_dispositivo`) REFERENCES `dispositivo` (`id_dispositivo`);

ALTER TABLE `historial_operaciones` ADD FOREIGN KEY (`status_operacion`) REFERENCES `operaciones` (`status_operacion`);

ALTER TABLE `historial_obstaculos` ADD FOREIGN KEY (`id_dispositivo`) REFERENCES `dispositivo` (`id_dispositivo`);

ALTER TABLE `historial_obstaculos` ADD FOREIGN KEY (`status_obstaculo`) REFERENCES `obstaculos` (`status_obstaculo`);

ALTER TABLE `secuencias_demo` ADD FOREIGN KEY (`id_dispositivo`) REFERENCES `dispositivo` (`id_dispositivo`);

ALTER TABLE `secuencia_operaciones` ADD FOREIGN KEY (`id_secuencia`) REFERENCES `secuencias_demo` (`id_secuencia`);

ALTER TABLE `secuencia_operaciones` ADD FOREIGN KEY (`status_operacion`) REFERENCES `operaciones` (`status_operacion`);

ALTER TABLE `ejecucion_secuencias` ADD FOREIGN KEY (`id_secuencia`) REFERENCES `secuencias_demo` (`id_secuencia`);
SELECT DATABASE();
SHOW DATABASES;
SHOW TABLES;
USE IoT;
SHOW PROCEDURE STATUS WHERE Db = 'IoT';

USE IoT;

-- 1. Agregar un estatus de movimiento
DELIMITER //
CREATE PROCEDURE sp_agregar_movimiento(
    IN p_id_dispositivo INT,
    IN p_status_operacion INT
)
BEGIN
    INSERT INTO historial_operaciones (id_dispositivo, status_operacion)
    VALUES (p_id_dispositivo, p_status_operacion);
    
    SELECT LAST_INSERT_ID() as id_evento, 'Movimiento agregado correctamente' as mensaje;
END //
DELIMITER ;
-- modo manual y automatico
-- 2. Conocer el último estatus de movimiento
DELIMITER //
CREATE PROCEDURE sp_ultimo_movimiento(IN p_id_dispositivo INT)
BEGIN
    SELECT ho.*, o.status_texto, d.nombre_dispositivo
    FROM historial_operaciones ho
    JOIN operaciones o ON ho.status_operacion = o.status_operacion
    JOIN dispositivo d ON ho.id_dispositivo = d.id_dispositivo
    WHERE ho.id_dispositivo = p_id_dispositivo
    ORDER BY ho.fecha_hora DESC
    LIMIT 1;
END //
DELIMITER ;

-- 3. Conocer los últimos 10 estatus de movimientos
DELIMITER //
CREATE PROCEDURE sp_ultimos_10_movimientos(IN p_id_dispositivo INT)
BEGIN
    SELECT ho.id_evento, ho.fecha_hora, o.status_operacion, o.status_texto, d.nombre_dispositivo
    FROM historial_operaciones ho
    JOIN operaciones o ON ho.status_operacion = o.status_operacion
    JOIN dispositivo d ON ho.id_dispositivo = d.id_dispositivo
    WHERE ho.id_dispositivo = p_id_dispositivo
    ORDER BY ho.fecha_hora DESC
    LIMIT 10;
END //
DELIMITER ;

-- 4. Agregar secuencia DEMO con programación automática de N movimientos
DELIMITER //
CREATE PROCEDURE sp_agregar_secuencia_demo(
    IN p_id_dispositivo INT,
    IN p_nombre_secuencia VARCHAR(100),
    IN p_movimientos JSON
)
BEGIN
    DECLARE v_id_secuencia INT;
    
    INSERT INTO secuencias_demo (id_dispositivo, nombre_secuencia)
    VALUES (p_id_dispositivo, p_nombre_secuencia);
    
    SET v_id_secuencia = LAST_INSERT_ID();
    
    INSERT INTO secuencia_operaciones (id_secuencia, status_operacion, orden)
    SELECT v_id_secuencia, movimientos.status_op, @row_number := @row_number + 1 as orden
    FROM JSON_TABLE(p_movimientos, '$[*]' COLUMNS (
        status_op INT PATH '$'
    )) AS movimientos, (SELECT @row_number := 0) AS t;
    
    SELECT v_id_secuencia as id_secuencia, 'Secuencia DEMO creada correctamente' as mensaje;
END //
DELIMITER ;

-- 5. Conocer las últimas 20 secuencias DEMO
DELIMITER //
CREATE PROCEDURE sp_ultimas_20_secuencias()
BEGIN
    SELECT sd.*, d.nombre_dispositivo, COUNT(so.id_secuencia_operaciones) as total_movimientos
    FROM secuencias_demo sd
    JOIN dispositivo d ON sd.id_dispositivo = d.id_dispositivo
    LEFT JOIN secuencia_operaciones so ON sd.id_secuencia = so.id_secuencia
    GROUP BY sd.id_secuencia, d.nombre_dispositivo
    ORDER BY sd.fecha_creacion DESC
    LIMIT 20;
END //
DELIMITER ;

-- 6. Repetir una secuencia DEMO
DELIMITER //
CREATE PROCEDURE sp_repetir_secuencia(IN p_id_secuencia INT)
BEGIN
    SELECT so.orden, o.status_operacion, o.status_texto
    FROM secuencia_operaciones so
    JOIN operaciones o ON so.status_operacion = o.status_operacion
    WHERE so.id_secuencia = p_id_secuencia
    ORDER BY so.orden;
    
    INSERT INTO ejecucion_secuencias (id_secuencia, estado)
    VALUES (p_id_secuencia, 'pendiente');
    
    SELECT 'Secuencia lista para ejecutar' as mensaje;
END //
DELIMITER ;

-- 7. Agregar la lógica del obstáculo
DELIMITER //
CREATE PROCEDURE sp_agregar_obstaculo(
    IN p_id_dispositivo INT,
    IN p_status_obstaculo INT
)
BEGIN
    INSERT INTO historial_obstaculos (id_dispositivo, status_obstaculo)
    VALUES (p_id_dispositivo, p_status_obstaculo);
    
    SELECT LAST_INSERT_ID() as id_evento, 'Obstáculo registrado correctamente' as mensaje;
END //
DELIMITER ;

-- 8. Conocer el último estatus del obstáculo
DELIMITER //
CREATE PROCEDURE sp_ultimo_obstaculo(IN p_id_dispositivo INT)
BEGIN
    SELECT ho.*, obs.status_texto, d.nombre_dispositivo
    FROM historial_obstaculos ho
    JOIN obstaculos obs ON ho.status_obstaculo = obs.status_obstaculo
    JOIN dispositivo d ON ho.id_dispositivo = d.id_dispositivo
    WHERE ho.id_dispositivo = p_id_dispositivo
    ORDER BY ho.fecha_hora DESC
    LIMIT 1;
END //
DELIMITER ;

-- 9. Conocer los últimos 10 estatus de los obstáculos
DELIMITER //
CREATE PROCEDURE sp_ultimos_10_obstaculos(IN p_id_dispositivo INT)
BEGIN
    SELECT ho.id_evento, ho.fecha_hora, obs.status_obstaculo, obs.status_texto, d.nombre_dispositivo
    FROM historial_obstaculos ho
    JOIN obstaculos obs ON ho.status_obstaculo = obs.status_obstaculo
    JOIN dispositivo d ON ho.id_dispositivo = d.id_dispositivo
    WHERE ho.id_dispositivo = p_id_dispositivo
    ORDER BY ho.fecha_hora DESC
    LIMIT 10;
END //
DELIMITER ;


USE IoT;

-- 1. Insertar datos en las tablas catálogo 
INSERT IGNORE INTO operaciones (status_operacion, status_texto) VALUES
(1, 'Adelante'),
(2, 'Atrás'),
(3, 'Detener'),
(4, 'Vuelta adelante derecha'),
(5, 'Vuelta adelante izquierda'),
(6, 'Vuelta atrás derecha'),
(7, 'Vuelta atrás izquierda'),
(8, 'Giro 90° derecha'),
(9, 'Giro 90° izquierda'),
(10, 'Giro 360° derecha'),
(11, 'Giro 360° izquierda');

-- 1. Insertar datos en la tabla de obstáculos
INSERT IGNORE INTO obstaculos (status_obstaculo, status_texto) VALUES
(1, 'Adelante'),
(2, 'Adelante-Izquierda'),
(3, 'Adelante-Derecha'),
(4, 'Adelante-Izquierda-Derecha'),
(5, 'Retrocede');

-- 2. Insertar cliente de prueba
INSERT IGNORE INTO cliente (id_cliente, nombre_cliente, apellido_p, apellido_m, telefono, correo, pais, ciudad) VALUES
(1, 'Juan Carlos', 'Perez', 'Gomez', '5512345678', 'juan@email.com', 'México', 'CDMX'),
(2, 'Maria Elena', 'Lopez', 'Garcia', '5512345679', 'maria@email.com', 'México', 'Guadalajara');

-- 3. Insertar dispositivos de prueba
INSERT IGNORE INTO dispositivo (id_dispositivo, id_cliente, ip, latitud, longitud, nombre_dispositivo) VALUES
(1, 1, '192.168.1.100', 19.4326077, -99.133208, 'Carro_Principal'),
(2, 1, '192.168.1.101', 19.4326077, -99.133209, 'Carro_Secundario'),
(3, 2, '192.168.2.100', 20.6666666, -103.333333, 'Carro_GDL_1');

-- 4. Insertar movimientos/historial de operaciones de prueba
INSERT INTO historial_operaciones (id_dispositivo, status_operacion, fecha_hora) VALUES
(1, 1, NOW() - INTERVAL 10 MINUTE),  -- Adelante
(1, 8, NOW() - INTERVAL 9 MINUTE),   -- Giro 90° derecha
(1, 1, NOW() - INTERVAL 8 MINUTE),   -- Adelante
(1, 3, NOW() - INTERVAL 7 MINUTE),   -- Detener
(1, 5, NOW() - INTERVAL 6 MINUTE),   -- Vuelta adelante izquierda
(2, 1, NOW() - INTERVAL 5 MINUTE),   -- Adelante
(2, 9, NOW() - INTERVAL 4 MINUTE),   -- Giro 90° izquierda
(1, 2, NOW() - INTERVAL 3 MINUTE),   -- Atrás
(1, 3, NOW() - INTERVAL 2 MINUTE),   -- Detener
(1, 10, NOW() - INTERVAL 1 MINUTE);  -- Giro 360° derecha

-- 5. Insertar obstáculos de prueba
INSERT INTO historial_obstaculos (id_dispositivo, status_obstaculo, fecha_hora) VALUES
(1, 1, NOW() - INTERVAL 15 MINUTE),  -- Adelante
(1, 2, NOW() - INTERVAL 12 MINUTE),  -- Adelante-Izquierda
(1, 3, NOW() - INTERVAL 10 MINUTE),  -- Adelante-Derecha
(2, 4, NOW() - INTERVAL 8 MINUTE),   -- Adelante-Izquierda-Derecha
(1, 5, NOW() - INTERVAL 5 MINUTE),   -- Retrocede
(1, 1, NOW() - INTERVAL 3 MINUTE);   -- Adelante

-- 6. Insertar secuencias DEMO de prueba
INSERT INTO secuencias_demo (id_dispositivo, nombre_secuencia, fecha_creacion) VALUES
(1, 'Secuencia Exploración', NOW() - INTERVAL 1 HOUR),
(1, 'Secuencia Evasión', NOW() - INTERVAL 45 MINUTE),
(2, 'Secuencia Patrullaje', NOW() - INTERVAL 30 MINUTE);

-- 7. Insertar operaciones para las secuencias
INSERT INTO secuencia_operaciones (id_secuencia, status_operacion, orden) VALUES
-- Secuencia 1: Exploración
(1, 1, 1),   -- Adelante
(1, 8, 2),   -- Giro 90° derecha
(1, 1, 3),   -- Adelante
(1, 9, 4),   -- Giro 90° izquierda
(1, 1, 5),   -- Adelante
(1, 3, 6),   -- Detener
-- Secuencia 2: Evasión
(2, 1, 1),   -- Adelante
(2, 5, 2),   -- Vuelta adelante izquierda
(2, 1, 3),   -- Adelante
(2, 4, 4),   -- Vuelta adelante derecha
(2, 3, 5),   -- Detener
-- Secuencia 3: Patrullaje
(3, 1, 1),   -- Adelante
(3, 8, 2),   -- Giro 90° derecha
(3, 1, 3),   -- Adelante
(3, 9, 4),   -- Giro 90° izquierda
(3, 2, 5);   -- Atrás

-- 8. Insertar ejecuciones de secuencias
INSERT INTO ejecucion_secuencias (id_secuencia, fecha_ejecucion, estado) VALUES
(1, NOW() - INTERVAL 50 MINUTE, 'completado'),
(2, NOW() - INTERVAL 25 MINUTE, 'completado'),
(3, NOW() - INTERVAL 10 MINUTE, 'progreso'),
(1, NOW() - INTERVAL 5 MINUTE, 'pendiente');

-- 9. Verificar datos insertados
SELECT 'Clientes:' as '';
SELECT * FROM cliente;

SELECT 'Dispositivos:' as '';
SELECT * FROM dispositivo;

SELECT 'Total movimientos por dispositivo:' as '';
SELECT d.nombre_dispositivo, COUNT(ho.id_evento) as total_movimientos
FROM dispositivo d
LEFT JOIN historial_operaciones ho ON d.id_dispositivo = ho.id_dispositivo
GROUP BY d.id_dispositivo, d.nombre_dispositivo;

SELECT 'Total obstáculos por dispositivo:' as '';
SELECT d.nombre_dispositivo, COUNT(hob.id_evento) as total_obstaculos
FROM dispositivo d
LEFT JOIN historial_obstaculos hob ON d.id_dispositivo = hob.id_dispositivo
GROUP BY d.id_dispositivo, d.nombre_dispositivo;



USE IoT;

-- Probar cada stored procedure
SELECT '=== 1. ÚLTIMO MOVIMIENTO ===' as '';
CALL sp_ultimo_movimiento(1);

SELECT '=== 2. ÚLTIMOS 10 MOVIMIENTOS ===' as '';
CALL sp_ultimos_10_movimientos(1);

SELECT '=== 3. ÚLTIMO OBSTÁCULO ===' as '';
CALL sp_ultimo_obstaculo(1);

SELECT '=== 4. ÚLTIMOS 10 OBSTÁCULOS ===' as '';
CALL sp_ultimos_10_obstaculos(1);

SELECT '=== 5. ÚLTIMAS 20 SECUENCIAS ===' as '';
CALL sp_ultimas_20_secuencias();

SELECT '=== 6. REPETIR SECUENCIA ===' as '';
CALL sp_repetir_secuencia(1);

-- Probar agregar nuevos datos
SELECT '=== 7. AGREGAR NUEVO MOVIMIENTO ===' as '';
CALL sp_agregar_movimiento(1, 1);

SELECT '=== 8. AGREGAR NUEVO OBSTÁCULO ===' as '';
CALL sp_agregar_obstaculo(1, 2);

SELECT '=== 9. AGREGAR NUEVA SECUENCIA DEMO ===' as '';
CALL sp_agregar_secuencia_demo(1, 'Nueva Secuencia Test', '[1, 8, 1, 9, 3]');


-- Stored Procedure para actualizar secuencia
DELIMITER //
CREATE PROCEDURE sp_actualizar_secuencia(
    IN p_id_secuencia INT,
    IN p_id_dispositivo INT,
    IN p_nombre_secuencia VARCHAR(100)
)
BEGIN
    UPDATE secuencias_demo 
    SET nombre_secuencia = p_nombre_secuencia,
        id_dispositivo = p_id_dispositivo
    WHERE id_secuencia = p_id_secuencia;
END //
DELIMITER ;

-- Stored Procedure para eliminar operaciones de una secuencia
DELIMITER //
CREATE PROCEDURE sp_eliminar_operaciones_secuencia(IN p_id_secuencia INT)
BEGIN
    DELETE FROM secuencia_operaciones 
    WHERE id_secuencia = p_id_secuencia;
END //
DELIMITER ;

-- Stored Procedure para agregar operación a secuencia
DELIMITER //
CREATE PROCEDURE sp_agregar_operacion_secuencia(
    IN p_id_secuencia INT,
    IN p_status_operacion INT,
    IN p_orden INT
)
BEGIN
    INSERT INTO secuencia_operaciones (id_secuencia, status_operacion, orden)
    VALUES (p_id_secuencia, p_status_operacion, p_orden);
END //
DELIMITER ;