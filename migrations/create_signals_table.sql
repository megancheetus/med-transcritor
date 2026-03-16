-- Tabela para armazenar mensagens de sinalizacao WebRTC
CREATE TABLE IF NOT EXISTS videoconsulta_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL,
  type TEXT NOT NULL, -- 'offer', 'answer', 'ice-candidate'
  signal JSONB NOT NULL,
  from_role TEXT NOT NULL, -- 'professional' or 'patient'
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (room_id) REFERENCES videoconsulta_rooms(id) ON DELETE CASCADE,
  INDEX idx_room_from (room_id, from_role)
);

-- Limpar signals antigos (mais de 5 minutos)
CREATE OR REPLACE FUNCTION cleanup_old_signals() RETURNS void AS $$
BEGIN
  DELETE FROM videoconsulta_signals
  WHERE created_at < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;
