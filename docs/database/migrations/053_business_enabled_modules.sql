-- Feature flags por negocio: módulos opcionales que el superadmin habilita/deshabilita
-- al crear el negocio (cocina, stock, empleados, telegram, impresora/dispositivos, mesero).
ALTER TABLE businesses
  ADD COLUMN enabled_modules jsonb NOT NULL DEFAULT
  '{"kitchen":true,"stock":true,"employees":true,"telegram":false,"printer":true,"mesero":false}'::jsonb;
