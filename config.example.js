/**
 * TEMPLATE de configuração.
 *
 * Como usar:
 *   1) Copie este arquivo para config.js (na mesma pasta).
 *   2) Preencha com os valores reais do projeto Supabase da Terra.
 *   3) config.js está no .gitignore — não vá para o GitHub.
 *
 * Onde encontrar:
 *   Supabase → Project Settings → API
 *     • Project URL               → SUPABASE_URL
 *     • Publishable key (sb_publishable_…) → SUPABASE_PUBLISHABLE_KEY
 *
 * A publishable key é desenhada para ficar pública no frontend —
 * a proteção dos dados vem da Row Level Security (RLS).
 * NUNCA coloque a secret key (sb_secret_…) aqui.
 *
 * Em produção (Vercel), estes valores virão de variáveis de ambiente.
 */
window.TERRA_CONFIG = {
  SUPABASE_URL: "https://SEU-PROJETO.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_COLE_A_CHAVE_AQUI"
};
