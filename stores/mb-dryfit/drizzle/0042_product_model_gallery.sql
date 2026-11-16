-- Preparação de galeria independente (0042 reservada após revisão Codex 0035–0041).
-- Não executar em produção sem recuperar e conciliar as migrações intermediárias.
CREATE TABLE IF NOT EXISTS product_model_gallery(
 model_key TEXT PRIMARY KEY,
 photos TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(photos) AND json_type(photos)='array'),
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>=1),
 updated_at TEXT NOT NULL
);
