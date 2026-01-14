-- Seeding initial data for the access control system
-- Insert default areas
INSERT INTO areas (name, description) VALUES 
('Administración', 'Área administrativa y gerencial'),
('Producción', 'Área de manufactura y producción'),
('Logística', 'Área de almacén y distribución'),
('Mantenimiento', 'Área de mantenimiento y servicios'),
('Seguridad', 'Área de seguridad y vigilancia');

-- Insert default admin user (password: admin123)
INSERT INTO users (email, password_hash, role, name) VALUES 
('admin@empresa.com', '$2b$10$rOvsFwjNn.xDhAlaE8WjO.K8yF8Qg8qY9mXvKjY8qY9mXvKjY8qY9m', 'administrador', 'Administrador Sistema');

-- Insert sample guard user (password: guard123)
INSERT INTO users (email, password_hash, role, name) VALUES 
('guardia@empresa.com', '$2b$10$rOvsFwjNn.xDhAlaE8WjO.K8yF8Qg8qY9mXvKjY8qY9mXvKjY8qY9m', 'guardia', 'Juan Pérez');

-- Insert sample supervisor user (password: super123)
INSERT INTO users (email, password_hash, role, name) VALUES 
('supervisor@empresa.com', '$2b$10$rOvsFwjNn.xDhAlaE8WjO.K8yF8Qg8qY9mXvKjY8qY9mXvKjY8qY9m', 'supervisor', 'María González');

-- Insert sample employees
INSERT INTO people (dni, name, email, type, area_id, sucursal) VALUES 
('12345678', 'Carlos Rodriguez', 'carlos@empresa.com', 'empleado', 1, 'PHQ Cordoba'),
('87654321', 'Ana Lopez', 'ana@empresa.com', 'empleado', 2, 'PHQ Cordoba'),
('11223344', 'Pedro Martinez', 'pedro@empresa.com', 'empleado', 3, 'Buenos Aires'),
('33445566', 'Laura Diaz', 'laura@empresa.com', 'empleado', 4, 'Rosario'),
('22334455', 'Miguel Alvarez', 'miguel@empresa.com', 'empleado', 5, 'Santa Fe');

-- Insert sample providers
INSERT INTO people (dni, name, email, type, area_id, sucursal) VALUES 
('99887766', 'Transportes ABC', 'contacto@transportesabc.com', 'proveedor', 3, 'Buenos Aires'),
('55443322', 'Servicios XYZ', 'info@serviciosxyz.com', 'proveedor', 4, 'PHQ Cordoba'),
('66554433', 'Distribuidora Delta', 'delta@logistica.com', 'proveedor', 2, 'Buenos Aires Dds'),
('77665544', 'Logistica Pampero', 'pampero@servicios.com', 'proveedor', 1, 'Rosario'),
('88990011', 'Consultora Norte', 'contacto@consultoranorte.com', 'proveedor', 5, 'Santa Fe');

-- Insert sample vehicles for providers
INSERT INTO vehicles (license_plate, person_id, brand, model, color) VALUES 
('ABC123', 6, 'Ford', 'Transit', 'Blanco'),
('XYZ789', 7, 'Chevrolet', 'NPR', 'Azul'),
('RST456', 8, 'Iveco', 'Daily', 'Rojo'),
('LMN321', 9, 'Mercedes', 'Sprinter', 'Plata'),
('OPQ654', 10, 'Renault', 'Master', 'Gris');

-- Insert providers catalog base entries (matching DNIs)
INSERT INTO providers (name, dni, area, supervisor_id, vehicle_access)
VALUES 
('Transportes ABC', '99887766', 'Logistica', 3, 1),
('Servicios XYZ', '55443322', 'Mantenimiento', 3, 0),
('Distribuidora Delta', '66554433', 'Produccion', 2, 1),
('Logistica Pampero', '77665544', 'Administracion', 1, 1),
('Consultora Norte', '88990011', 'Seguridad', 3, 0);




