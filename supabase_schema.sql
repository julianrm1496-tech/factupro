-- FactuPro - Script SQL para Supabase
-- Ejecuta esto en el SQL Editor de tu proyecto Supabase

-- Tabla de clientes
CREATE TABLE clientes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  nit TEXT,
  email TEXT,
  telefono TEXT,
  direccion TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de facturas
CREATE TABLE facturas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero TEXT NOT NULL UNIQUE,
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
  fecha_emision DATE NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  monto NUMERIC(18,2) NOT NULL DEFAULT 0,
  descripcion TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de pagos / abonos
CREATE TABLE pagos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  factura_id UUID REFERENCES facturas(id) ON DELETE CASCADE,
  monto NUMERIC(18,2) NOT NULL,
  fecha DATE NOT NULL,
  metodo TEXT DEFAULT 'Transferencia bancaria',
  referencia TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vista útil: facturas con total pagado y saldo
CREATE OR REPLACE VIEW facturas_resumen AS
SELECT
  f.*,
  c.nombre AS cliente_nombre,
  c.email AS cliente_email,
  c.telefono AS cliente_telefono,
  COALESCE(SUM(p.monto), 0) AS total_pagado,
  f.monto - COALESCE(SUM(p.monto), 0) AS saldo_pendiente,
  CASE
    WHEN COALESCE(SUM(p.monto), 0) >= f.monto THEN 'pagada'
    WHEN f.fecha_vencimiento < CURRENT_DATE AND COALESCE(SUM(p.monto), 0) < f.monto THEN 'vencida'
    ELSE 'pendiente'
  END AS estado
FROM facturas f
JOIN clientes c ON c.id = f.cliente_id
LEFT JOIN pagos p ON p.factura_id = f.id
GROUP BY f.id, c.nombre, c.email, c.telefono;

-- Índices para mejor rendimiento
CREATE INDEX idx_facturas_cliente ON facturas(cliente_id);
CREATE INDEX idx_pagos_factura ON pagos(factura_id);
CREATE INDEX idx_facturas_fecha ON facturas(fecha_vencimiento);

-- Row Level Security (RLS) - Seguridad por usuario autenticado
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;

-- Políticas: solo usuarios autenticados pueden ver/editar datos
CREATE POLICY "Usuarios autenticados pueden ver clientes"
  ON clientes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden ver facturas"
  ON facturas FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden ver pagos"
  ON pagos FOR ALL TO authenticated USING (true) WITH CHECK (true);
