# Edge Function: gerenciar-usuarios

Deployada via Supabase MCP. Endpoint:
POST {{SUPABASE_URL}}/functions/v1/gerenciar-usuarios

Auth: Bearer JWT do usuário logado (verify_jwt: true).
Permissão: requer auth_pode_admin() = true (RPC).

Ações:
- { acao: "criar", email, nome, perfil } → cria auth.users + perfis + dispara email de redefinição
- { acao: "desativar", user_id } → set perfis.ativo = false (não pode desativar a si mesmo)
- { acao: "reativar", user_id } → set perfis.ativo = true

Service role usado internamente como secret SUPABASE_SERVICE_ROLE_KEY.
