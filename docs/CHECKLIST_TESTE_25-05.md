# Checklist de Teste — Sessão 25/05

**URL:** https://terra-gestao-financeira.vercel.app
**Commit:** `dd9f7f8`

---

## Antes de começar

- [ ] **0.1** Editar um funcionário (ex.: você mesma) → setar **Cargo = "Analista de RH Generalista"** → Salvar. Libera o botão Oficializar do organograma pra esse usuário.
- [ ] **0.2** Forçar refresh com **Ctrl+F5** pra pegar JS/CSS novos.

---

## Tópico 1 — Organograma (`Dep. Pessoal e RH → Organograma`)

- [ ] **1.1** Dropdown "+ atribuir" agora lista funcionários ativos (não texto livre). Posições antigas com texto aparecem como "Nome (legado)".
- [ ] **1.2** Atribuir funcionário a posição vazia → badge amarelo "PENDENTE" + borda tracejada laranja.
- [ ] **1.3** Clicar "Oficializar" (botão dourado pequeno) → badge vira verde "OFICIALIZADO".
- [ ] **1.4** Trocar funcionário em posição já oficializada deve voltar pra "PENDENTE".
- [ ] **1.5** Login com usuário sem cargo Analista RH Generalista e não-master → botão "Oficializar" não aparece.
- [ ] **1.6** **Bug PDF**: "Baixar PDF" baixa o organograma de verdade (não mais "Carregando…"). Se clicar antes de carregar, mostra alerta.

## Tópico 2 — Cargos (`Dep. Pessoal e RH → Cargos`)

- [ ] **2.1** Filtro "Status" tem opções: Ativos / Inativos / **Rascunhos** / **Publicados** / Todos.
- [ ] **2.2** Cargos antigos com dados aparecem com badge "PUBLICADO".
- [ ] **2.3** "+ Novo cargo" — modal tem seções: Identificação (com toggle "É cargo de gestão"), Subordinados (checkboxes), Descritivo, **Competências Técnicas** (Conhecimentos + Habilidades), **Competências Comportamentais** (Competências + Atitudes), Outros.
- [ ] **2.4** Preencher só o título e clicar **"Salvar como rascunho"** → salva. Lista mostra badge "RASCUNHO".
- [ ] **2.5** Em Funcionários → editar → dropdown "Cargo" **NÃO** lista o cargo em rascunho.
- [ ] **2.6** Reabrir cargo e clicar **"Publicar"** sem preencher tudo → erro listando faltantes.
- [ ] **2.7** Preencher tudo (+ subordinados se for gestão) → Publicar → badge "PUBLICADO" e passa a aparecer em Funcionários.
- [ ] **2.8** Marcar cargos subordinados → salvar → outros cargos têm seu "Superior" atualizado.
- [ ] **2.9** Clicar **"Ficha PDF"** em cargo publicado → PDF com logo Terra, nome em destaque, missão, responsabilidades, quadros 2 colunas de competências, bloco de assinatura (Profissional/Empresa + data).
- [ ] **2.10** Linha inteira da lista abre o modal (não só o botão Editar).

## Tópico 3 — Funcionários (`Dep. Pessoal e RH → Funcionários`)

- [ ] **3.1** **Bug filtro estourando** corrigido: não aparece mais card branco gigante ("🔍 Filtrar (101 opcoes)").
- [ ] **3.2** Cards "Total" e "Folha mensal base" sumiram; só ficou "Ativos" pequeno.
- [ ] **3.3** Cabeçalho da tabela fixo ao rolar.
- [ ] **3.4** Colunas "Centro de Custo" e "Posição (organograma)" sumiram da lista (continuam no modal).
- [ ] **3.5** Embaixo do nome aparece "e-Social: XXXX" quando houver.
- [ ] **3.6** Buscar pelo número do e-Social filtra.
- [ ] **3.7** Clique na linha (não no botão) abre modal.
- [ ] **3.8** Modificar campo e tentar fechar → pop-up "alterações não salvas".
- [ ] **3.9** Campo "Função / Cargo (texto livre — legado)" sumiu. Dropdown "Cargo" só mostra publicados.
- [ ] **3.10** Clicar em campo do modal → fundo branco + borda dourada.
- [ ] **3.11** Ficha cadastral: grid 2 colunas dentro de cada seção, sem encavalar.
- [ ] **3.12** Salvar com cargo → coluna "Cargo" mostra o nome do cargo (vindo do cargo_id).

## Tópico 4 — Alerta ASO (`Configuração → 🩺 Alerta ASO`)

- [ ] **4.1** Cartão "🩺 Alerta ASO" aparece no menu Configuração.
- [ ] **4.2** Digitar email → "Salvar email" → toast verde.
- [ ] **4.3** Recarregar página → email persiste.
- [ ] **4.4** "Gerar alertas agora" → confirmar → toast com quantidade gerada.
- [ ] **4.5** Lista mostra ASOs vencendo em até 30 dias com dias coloridos (≤7 vermelho, ≤15 laranja, ≤30 marrom).
- [ ] **4.6** Status email "Pendente envio" (esperado — Resend ainda não está configurado).

## Tópico 5 — Quattrocento

- [ ] **5.1** Navegar várias telas (Dashboard, Receita, Folha, Configuração) → conferir se em algum botão/badge/label/input a fonte está diferente. Reportar onde escapou.

## Regressões (não devem ter quebrado)

- [ ] **R.1** Login / logout.
- [ ] **R.2** Modais antigos (Pessoas, Receita, Folha, Centros de Custo) abrem e salvam.
- [ ] **R.3** "Baixar Ficha Funcional" (PDF do funcionário).
- [ ] **R.4** "Holerite".
- [ ] **R.5** Importação de PDFs da Folha.
