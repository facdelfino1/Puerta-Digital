-- Creating database schema for access control system
-- Users table with role-based permissions
CREATE TABLE users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    email NVARCHAR(255) UNIQUE NOT NULL,
    password_hash NVARCHAR(255) NOT NULL,
    role NVARCHAR(50) NOT NULL CHECK (role IN ('guardia', 'supervisor', 'administrador')),
    name NVARCHAR(255) NOT NULL,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    photo_url NVARCHAR(500) NULL,
    is_active BIT DEFAULT 1
);

-- Company areas table
CREATE TABLE areas (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(255) NOT NULL,
    description NVARCHAR(500),
    created_at DATETIME2 DEFAULT GETDATE()
);

-- People table (employees and providers)
CREATE TABLE people (
    id INT IDENTITY(1,1) PRIMARY KEY,
    dni NVARCHAR(20) UNIQUE NOT NULL,
    name NVARCHAR(255) NOT NULL,
    email NVARCHAR(255),
    photo_url NVARCHAR(500),
    type NVARCHAR(50) NOT NULL CHECK (type IN ('empleado', 'proveedor', 'guardia', 'supervisor', 'administrador')),
    area_id INT,
    sucursal NVARCHAR(50) NOT NULL CHECK (sucursal IN ('PHQ Cordoba', 'Buenos Aires', 'Rosario', 'Santa Fe', 'Buenos Aires Dds')),
    supervisor_user_id INT NULL,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    photo_url NVARCHAR(500) NULL,
    is_active BIT DEFAULT 1,
    FOREIGN KEY (area_id) REFERENCES areas(id),
    FOREIGN KEY (supervisor_user_id) REFERENCES users(id)
);

-- Vehicles table for providers
CREATE TABLE vehicles (
    id INT IDENTITY(1,1) PRIMARY KEY,
    license_plate NVARCHAR(20) UNIQUE NOT NULL,
    person_id INT NOT NULL,
    brand NVARCHAR(100),
    model NVARCHAR(100),
    color NVARCHAR(50),
    created_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (person_id) REFERENCES people(id)
);

-- Access logs table
CREATE TABLE access_logs (
    id INT IDENTITY(1,1) PRIMARY KEY,
    person_id INT NOT NULL,
    vehicle_id INT NULL,
    entry_time DATETIME2 NOT NULL,
    exit_time DATETIME2 NULL,
    guard_user_id INT NOT NULL,
    notes NVARCHAR(500),
    created_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (person_id) REFERENCES people(id),
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
    FOREIGN KEY (guard_user_id) REFERENCES users(id)
);

-- Indexes for better performance
CREATE INDEX IX_access_logs_person_id ON access_logs(person_id);
CREATE INDEX IX_access_logs_entry_time ON access_logs(entry_time);
CREATE INDEX IX_access_logs_exit_time ON access_logs(exit_time);
CREATE INDEX IX_people_dni ON people(dni);
CREATE INDEX IX_people_type ON people(type);

-- Settings key/value table for system configuration
IF NOT EXISTS (
  SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.settings') AND type in (N'U')
)
BEGIN
  CREATE TABLE settings (
    [key] NVARCHAR(100) NOT NULL PRIMARY KEY,
    [value] NVARCHAR(255) NULL
  );
END

-- Providers catalog table
IF NOT EXISTS (
  SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.providers') AND type in (N'U')
)
BEGIN
  CREATE TABLE providers (
      id INT IDENTITY(1,1) PRIMARY KEY,
      name NVARCHAR(255) NOT NULL,
      dni NVARCHAR(20) UNIQUE NOT NULL,
      area NVARCHAR(255),
      supervisor_id INT NULL,
      vehicle_access BIT DEFAULT 0,
      is_active BIT DEFAULT 1,
      created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    photo_url NVARCHAR(500) NULL,
      FOREIGN KEY (supervisor_id) REFERENCES users(id)
  );
END

-- Provider documents table
IF NOT EXISTS (
  SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.provider_docs') AND type in (N'U')
)
BEGIN
  CREATE TABLE provider_docs (
      id INT IDENTITY(1,1) PRIMARY KEY,
      provider_id INT NOT NULL,
      doc_type NVARCHAR(50) NOT NULL,
      pdf_path NVARCHAR(500) NOT NULL,
      allows_vehicle BIT DEFAULT 0,
      upload_date DATETIME2 NOT NULL,
      expiration_date DATETIME2 NULL,
      uploaded_by INT NULL,
      estado NVARCHAR(50),
      dias_restantes INT NULL,
      created_at DATETIME2 DEFAULT GETDATE(),
      FOREIGN KEY (provider_id) REFERENCES providers(id),
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
  );

  CREATE INDEX IX_provider_docs_provider ON provider_docs(provider_id, doc_type);
END

