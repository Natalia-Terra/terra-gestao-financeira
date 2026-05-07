# 🚀 ROTEIRO DE GO-LIVE — Sistema Terra Conttemporânea

**Versão:** 2026-05-07 (final)
**Para:** Juliana (master) — qualquer pessoa consegue seguir
**Sistema em produção:** https://terra-gestao-financeira.vercel.app
**Tempo estimado:** 60-90 minutos pra fazer tudo

---

## 📋 ÍNDICE

1. [Antes de começar](#1-antes-de-começar)
2. [Lista de arquivos necessários](#2-lista-de-arquivos-necessários)
3. [Passo 1 — Login no sistema](#passo-1--login-no-sistema)
4. [Passo 2 — Reset da base (limpa tudo)](#passo-2--reset-da-base-limpa-tudo)
5. [Passo 3 — Configuração base](#passo-3--configuração-base)
6. [Passo 4 — Importações (na ordem certa)](#passo-4--importações-na-ordem-certa)
7. [Passo 5 — Cadastros manuais](#passo-5--cadastros-manuais)
8. [Passo 6 — Validação (tela por tela)](#passo-6--validação-tela-por-tela)
9. [Passo 7 — Testar o cálculo do Bônus](#passo-7--testar-o-cálculo-do-bônus)
10. [Em caso de erro](#em-caso-de-erro)

---

## 1. Antes de começar

### O que você precisa ter na mão

✅ **Computador com internet**
✅ **Navegador** Chrome, Edge ou Firefox (não use Internet Explorer)
✅ **Email e senha** de master (juliana@polimatagrc.com.br ou financeiro@terraconttemporanea.com.br)
✅ **Pasta com os arquivos** (Downloads, Desktop ou onde preferir) — lista completa abaixo

### Vai abrir QUANTAS abas no navegador?

**Apenas 1 aba** na URL `https://terra-gestao-financeira.vercel.app`. Pronto.

### O que NÃO fazer

❌ Não abrir várias abas do sistema ao mesmo tempo (pode confundir o estado)
❌ Não atualizar (F5) no meio de uma importação grande
❌ Não fechar o navegador no meio do "Confirmar e importar"

---

## 2. Lista de arquivos necessários

> ⚠️ **Coloque todos esses 6 arquivos numa pasta só** (ex: `C:\Users\polim\Documents\TerraTeste\`). Vai facilitar muito na hora dos uploads.

### Arquivos OBRIGATÓRIOS pra carga inicial

| # | Nome do arquivo | Origem | Pra que serve |
|---|---|---|---|
| 1 | **30032026_Gestão Faturamento e Receita.xlsx** | Bíblia da Juliana | 2 imports: Histórico Mov Financeiro (aba "Mov Financeiro") + Histórico Saldo a Reconhecer (aba "Saldo a Reconhecer") |
| 2 | **Dashboard de Orçamentos.xlsx** | Sistema interno | Popula 3 tabelas: itens dos orçamentos, OSs vinculadas, custos previstos vs realizados |
| 3 | **Relatório orçamento aprovado por parceiro no mês.xls** | Aerolito | Popula tabela de Orçamentos com Parceiros (clientes) |
| 4 | **Relatório A Pagar x A Receber - Dt. Baixa.xlsx** | Sistema fiscal | Popula movimentos de caixa (Pagar/Receber) com classificação automática |
| 5 | **Saída de Estoque Por Período.xlsx** | Sistema interno | Popula 4 tabelas: detalhes de saída, resumo por OS, evolução mensal, custo direto |
| 6 | **Relatório de Emissão de Notas Fiscais** | Sistema fiscal | Popula NFs emitidas com vínculo às OSs |

### Configurações de cada arquivo (pra dropdown do Importar)

| Arquivo (#) | No dropdown "Tipo:" você escolhe | Tela onde imported aparece |
|---|---|---|
| #1 (aba Mov Financeiro) | **"Histórico Mov Financeiro (arquivo Excel)"** | Lançamentos (Contabilidade Gerencial) + Despesas |
| #1 (aba Saldo a Reconhecer) | **"Histórico Saldo a Reconhecer (arquivo Excel)"** | Receita > Saldo a Reconhecer |
| #2 | **"Dashboard de Orçamentos"** | Comercial > Dashboard de Orçamentos + Dashboard de Faturamento (rico) |
| #3 | **"Orçamentos"** | Vendas, Gestão de Faturamento, Dashboards |
| #4 | **"A Pagar x A Receber (Dt. Baixa)"** | Financeiro > Lançamentos de Caixa |
| #5 | **"Saída de Estoque (CPV-Matéria Prima)"** | Custo por OS, Custo Direto Via OS, Dashboard Faturamento (coluna Custo) |
| #6 | **"Notas Fiscais"** | Comercial > Notas Fiscais + Dashboard Faturamento (coluna NF) |

### Arquivos OPCIONAIS (cadastrar mais tarde se quiser)

- **Contas Bancárias** (cadastra direto na tela, não precisa importar)
- **Saldos Mensais por Conta** (cadastra ou importa — depende do que você tiver)
- **Compromissos Financeiros** (cadastra ou importa)
- **Recebimentos Previstos** (cadastra ou importa)
- **Folha de Pagamento mensal** (Despesas Folha Mensal — importa mês a mês conforme RH gera)

---

## PASSO 1 — Login no sistema

### O que fazer (clique a clique)

1. **Abre o navegador** (Chrome, Edge ou Firefox)
2. **Clica na barra de endereço** (em cima)
3. **Digita** exatamente isso e aperta Enter:
   ```
   https://terra-gestao-financeira.vercel.app
   ```
4. **Vai abrir uma tela de login** com fundo claro e logo da Terra à esquerda
5. **Clica no campo "Email"** e digita seu email completo
6. **Clica no campo "Senha"** e digita sua senha (se não lembrar, peça pra Juliana resetar via Configuração > Usuários)
7. **Clica no botão "Entrar"** (botão dourado)

### O que você deve ver

✅ A tela "Dashboard" com 4 cards no topo: **Orçamentos / Total vendido / Total faturado / Total recebido**
✅ Menu na lateral esquerda com 8 grupos: Dashboard, Receita, Financeiro, Comercial, Custeio, Contabilidade Gerencial, Dep. Pessoal e RH, Configuração
✅ No rodapé do menu: 2 botões — **Importar** e **Configuração**

### ❓ Se não aparecer "Importar" no rodapé do menu

Significa que você não está logada como **master**. Faz o seguinte:
1. Vai em **Configuração** > **Usuários**
2. Confere se o seu email tem perfil "**master**" na coluna correspondente
3. Se não tiver, edita e troca pra "master"
4. Faz logout e login de novo

---

## PASSO 2 — Reset da base (limpa tudo)

> ⚠️ **ATENÇÃO:** isso APAGA todos os dados de negócio (orçamentos, NFs, movimentos, estoque, etc). Se já tem dados que não pode perder, **não execute**. Pra um go-live limpo do zero, é o caminho.

### O que fica preservado mesmo após o Reset?

✅ Plano de Contas (510 contas)
✅ CFOP (590 códigos)
✅ Centros de Custo (15)
✅ Funcionários (320 importados antes)
✅ Organograma
✅ Perfis e Tipos de Perfil (master, admin, operador, consulta)
✅ Listas de Naturezas e Tipos de Produto
✅ Classif. Faturamento

### O que será apagado

❌ Todos os Orçamentos, NFs, Movimentos
❌ Estoque, Receitas/Custos, Folha de Pagamento
❌ Bônus (períodos, metas), Saldos, Compromissos, Recebimentos
❌ Histórico de auditoria
❌ Medidas Disciplinares e Avaliações **NÃO são apagadas** (mantém histórico do RH)

### Passo a passo do Reset

1. **No menu lateral**, clica em **"Configuração"** (último botão, com ícone de engrenagem)
2. **Vai abrir uma tela com vários cards quadrados** — procura o **card vermelho** com o título **"⚠ Reset Completo"**
3. **Clica nesse card vermelho**
4. **Vai abrir uma tela com aviso amarelo de PERIGO** — leia tudo
5. **Procura no meio da tela um campo de texto** com o placeholder "Digite RESET"
6. **Clica no campo** e digita **RESET** (em letras MAIÚSCULAS, sem espaços)
7. **O botão "Executar Reset Completo"** que estava cinza vai ficar **vermelho ativo**
8. **Clica no botão vermelho** "Executar Reset Completo"
9. **Vai aparecer uma janela de confirmação** ("ÚLTIMA CONFIRMAÇÃO...") — lê e clica em **OK**
10. **Aguarda alguns segundos** (até 30s) — vai aparecer mensagem verde **"✓ Reset concluído com sucesso. Recarregue a página (F5)"**
11. **Aperta F5** no teclado pra recarregar

### O que você deve ver depois

✅ Dashboard com cards mostrando "—" ou "0" (sem dados)
✅ Vendas, Notas, Recebimentos — todas vazias

---

## PASSO 3 — Configuração base

### 3.1 — Definir tipo de custo dos 15 Centros de Custo

> Esse passo é **fundamental**: sem ele, o cálculo de Custo Direto/Indireto/Despesa fica errado.

1. Menu lateral: **Configuração** > **Centros de Custo**
2. Vai abrir uma tela com lista de 15 CCs (Marcenaria, Administrativo, Montagem, etc.)
3. **Pra cada CC, clica na linha**
4. **Define a coluna "Tipo de custo"** com uma destas 3 opções:
   - **direto** = vai pra Custo Direto (ex: Marcenaria, Montagem, Lustração)
   - **indireto** = vai pra Custo Indireto (ex: supervisão, qualidade)
   - **despesa** = vai pra Despesa Operacional (ex: Administrativo, Comercial)
5. **Salva** cada um

### 3.2 — Cadastrar Contas Bancárias

1. Menu lateral: **Contabilidade Gerencial** > **Contas Bancárias**
2. Clica em **"+ Nova conta"**
3. **Preenche cada campo**:
   - **Nome (apelido):** ex: "Itaú Conta Corrente"
   - **Banco:** Itaú
   - **Tipo:** Conta Corrente
   - **Agência:** ex: 0123
   - **Conta:** ex: 45678-9
   - **Ordem:** 1 (pra aparecer primeiro)
   - **Ativa:** Sim
4. Clica em **Salvar**
5. **Repete pra cada conta da Terra** (BB, CEF, XP, etc.)

### 3.3 — Conferir Plano de Contas e CFOP

1. **Configuração** > **Plano de Contas** — devem aparecer **510 contas**
2. **Configuração** > **CFOP** — devem aparecer **590 códigos**

Se estiver tudo lá, **OK**. Não precisa mexer.

---

## PASSO 4 — Importações (NA ORDEM CERTA)

> ⚠️ **A ORDEM IMPORTA.** Algumas tabelas dependem de outras. Segue a sequência abaixo.

### Padrão de TODA importação

Pra qualquer arquivo que você for importar, o passo a passo é SEMPRE igual:

1. **No menu**, clica em **"Importar"** (rodapé)
2. Vai abrir uma tela com 3 elementos no topo:
   - Dropdown **"Tipo:"** — onde você escolhe que tipo de arquivo é
   - Botão **"Escolher arquivo"** (ou caixa de input file)
   - Botão **"Pré-visualizar"** (cinza, fica ativo depois que escolher arquivo)
3. **Escolhe o tipo no dropdown** (vou indicar exatamente qual em cada passo)
4. **Clica em "Escolher arquivo"**, navega até a pasta dos arquivos e seleciona
5. **Clica em "Pré-visualizar"**
6. Aguarda alguns segundos
7. **Vai aparecer:**
   - Mensagem em verde com resumo do parsing
   - Tabela com **as primeiras 10 linhas** do arquivo (pré-visualização)
8. **Confere a tabela** — se estiver certo, clica em **"Confirmar e importar"** (botão dourado)
9. **Vai aparecer um popup** ("Confirmar importação de X linhas?")
10. Clica em **OK**
11. Aguarda — vai aparecer **"Sucesso! Inseridos N registros. Import #M"**

> 💡 **Anote o número do "Import #" de cada importação** num caderno ou Excel — vai te ajudar caso precise reverter (no futuro)

### 4.1 — Importação 1: Orçamentos (Aerolito)

**Arquivo:** `Relatório orçamento aprovado por parceiro no mês.xls`
**No dropdown:** escolhe **"Orçamentos"**
**O que vai acontecer de especial:**
- Sistema vai abrir uma janela perguntando o **tipo de faturamento padrão**
- Você digita um número:
  - **100** = todos os orçamentos sendo importados são 100% com NF
  - **0** = todos sem NF
  - **50** = parcial (50% com NF, 50% sem)
- Aperta OK
- Continua o fluxo normal

**O que vai popular:** tabela `orcamentos` (com novos campos `tipo_faturamento`, `pct_com_nf`, `versao`)

### 4.2 — Importação 2: Dashboard de Orçamentos

**Arquivo:** `Dashboard de Orçamentos.xlsx`
**No dropdown:** **"Dashboard de Orçamentos"**
**Mensagem esperada:** algo como "598 itens em orcamento_items, X OSs em os_custos_planejados, Y entradas em ordens_servico (UPSERT)"

### 4.3 — Importação 3: Saída de Estoque

**Arquivo:** `Saída de Estoque Por Período.xlsx`
**No dropdown:** **"Saída de Estoque (CPV-Matéria Prima)"**
**Mensagem esperada:** "X linhas em estoque_detalhes (CPV-MP R$ Y), Z em estoque_resumo, W em os_evolucao_mensal, V em custo_direto_competencia (CPV-Direto R$ U). N linha(s) ignorada(s)."

> 💡 **Esse arquivo é GRANDE (25.801 linhas).** Pode demorar **~1-2 minutos** o pré-visualizar e mais ~30s o confirmar. Não desespere.

### 4.4 — Importação 4: A Pagar x A Receber

**Arquivo:** `Relatório A Pagar x A Receber - Dt. Baixa.xlsx`
**No dropdown:** **"A Pagar x A Receber (Dt. Baixa)"**
**Mensagem esperada:** "N linhas totais, X PAGAR, Y RECEBER classificadas auto, Z RECEBER pendentes"

### 4.5 — Importação 5: Notas Fiscais

**Arquivo:** `Relatório de Emissão de Notas Fiscais` (você gera ou já tem)
**No dropdown:** **"Notas Fiscais"**
**O que vai acontecer de especial:**
- Depois do "Pré-visualizar", aparece um **modal de revisão NF↔OS**
- Pra cada NF, sistema busca as OSs do orçamento e **pré-marca todas**
- Você revisa marcando/desmarcando se houver erro
- Clica em **"Confirmar e gravar"**

### 4.6 — Importação 6: Histórico Mov Financeiro (bíblia)

**Arquivo:** `30032026_Gestão Faturamento e Receita.xlsx` — **mesma planilha**, mas sistema lê automaticamente a **aba "Mov Financeiro"**
**No dropdown:** **"Histórico Mov Financeiro (arquivo Excel)"**
**Mensagem esperada:** "Sucesso! N lançamentos em movimentos. Import #X"

### 4.7 — Importação 7: Histórico Saldo a Reconhecer (bíblia)

**Arquivo:** `30032026_Gestão Faturamento e Receita.xlsx` — mesma planilha, sistema lê **aba "Saldo a Reconhecer"**
**No dropdown:** **"Histórico Saldo a Reconhecer (arquivo Excel)"**
**Mensagem esperada:** "Sucesso! 218 linhas em saldo_reconhecer. Import #X"

> 💡 **Re-importar o mesmo arquivo nunca duplica** (graças à política M24-M26). Versões anteriores ficam como `vigente=false` no banco.

---

## PASSO 5 — Cadastros manuais

> Esses cadastros não vêm de planilha — você cadastra direto via tela.

### 5.1 — Período de Bônus

1. Menu: **Dep. Pessoal e RH** > **Bônus — Configuração**
2. Aba **"Períodos"**
3. Clica **"+ Novo período"**
4. Preenche:
   - Nome: **2026-1**
   - Início: **2026-01-01**
   - Fim: **2026-06-30**
   - Status: **Ativo**

### 5.2 — Metas da Empresa (Esfera Empresa do Bônus)

Ainda em **Bônus — Configuração**, aba **"Empresa"**:

| Meta-chave | Valor da meta | Peso % |
|---|---|---|
| `faturamento` | **7000000** (R$ 7 milhões semestral) | 10 |
| `margem_liquida` | **0.10** (10%) | 10 |
| `caixa_positivo` | (sim/não — sem valor) | 5 |
| `icc` | (cobertura de 6 meses) | 5 |

### 5.3 — Metas das Áreas (Esfera Área do Bônus)

Ainda em **Bônus — Configuração**, aba **"Áreas"**:

Pra cada área do organograma (Marcenaria, Comercial, etc.), cadastre 1 ou mais metas. Exemplo:
- **Marcenaria** → meta: "Concluir produção das OSs do mês" — peso 100%

### 5.4 — Saldos Mensais por Conta (opcional)

Se você tem o histórico:

1. Menu: **Contabilidade Gerencial** > **Saldos Mensais**
2. **+ Novo saldo** (ou importa via "Importar > Saldos Mensais por Conta")
3. Preenche conta + mes_ref + saldo_inicial + saldo_final

### 5.5 — Compromissos Financeiros (opcional)

1. Menu: **Financeiro** > **Contas a Pagar**
2. Cadastra compromissos futuros (folha, fornecedores, impostos)

---

## PASSO 6 — Validação (tela por tela)

> Marca [x] em cada item conforme valida. Se algo der errado, anota o erro e me avisa.

### Comercial

- [ ] **Vendas** — mostra os orçamentos importados
- [ ] **Gestão de Faturamento** — mostra os orçamentos com colunas Venda/Adto/Recebimento
- [ ] **Dashboard de Faturamento (rico)** — 14 colunas, mostra totais agregados das 5 fontes (Orçamento, Mov Caixa, NFs, OSs, Estoque)
- [ ] **Notas Fiscais** — lista das NFs importadas
- [ ] **Dashboard de Orçamentos** — clica numa linha, abre modal com itens

### Receita

- [ ] **Por Apropriação** — gráficos preenchidos
- [ ] **Por Faturamento** — idem
- [ ] **Saldo a Reconhecer** — tabela com 218 linhas (do histórico) + cálculo em tempo real

### Financeiro

- [ ] **Consolidado** — gráficos
- [ ] **Contas a Receber** — orçamentos a receber
- [ ] **Contas a Pagar** — compromissos cadastrados
- [ ] **Lançamentos de Caixa** — movimentos do A Pagar x A Receber importado, com classificação automática nas linhas Resultado Financeiro

### Custeio

- [ ] **Custo por OS** — clica numa linha de OS → abre modal com itens MP do estoque
- [ ] **Custo Direto Via OS** — clica → modal funciona
- [ ] **Custo Direto Lançamento** — lançamentos por plano de contas
- [ ] **Custo Indireto** — folha + outros indiretos
- [ ] **Despesas** — agregado mensal
- [ ] **Custo por Área** — agregado por área do organograma

### Contabilidade Gerencial

- [ ] **Fluxo de Caixa 12m** — visão consolidada
- [ ] **Lançamentos** — todos os lançamentos do Mov Financeiro importado
- [ ] **DRE** — Demonstrativo de Resultado

### RH

- [ ] **Funcionários** — 320 funcionários (pré-existentes)
- [ ] **Medidas Disciplinares** — vazia (você ainda não cadastrou)
- [ ] **Avaliação de Desempenho** — vazia
- [ ] **Bônus — Configuração** — período + metas que você cadastrou no Passo 5

---

## PASSO 7 — Testar o cálculo do Bônus

### Como calcular o Bônus de um funcionário

1. Menu: **Dep. Pessoal e RH** > **Funcionários**
2. Clica numa **linha de qualquer funcionário** (ex: Adailton)
3. Vai abrir uma janela: **"Histórico de RH — Adailton..."**
4. Vai mostrar:
   - Cards: qtd Medidas / qtd Avaliações / Última nota
   - Tabela das medidas disciplinares (se tiver)
   - Tabela das avaliações (se tiver)
5. **Clica no botão dourado "Calcular Bônus do semestre →"**
6. Vai aparecer outra janela com o cálculo completo:
   - **4 cards no topo:** Profissional / Área / Empresa / **TOTAL**
   - **Card "💰 Bônus estimado: R$ X"** com o cálculo do pool
   - **3 seções expansíveis** com detalhes por componente

### O que esperar (com dados parciais)

Sem cadastrar Frequência (que precisa do PDF Folha de Ponto), os componentes Faltas/Atrasos vão aparecer com **"aguardando dados de frequência"**. É normal.

Se o funcionário tem 0 medidas disciplinares (esperado nesse início), **Conduta** = 12,5% pleno.
Se não tem avaliação ainda, **Avaliação** = 0%.

Vai dar um valor estimado pequeno (ex: R$ 1.700) — esse valor cresce conforme você for adicionando dados de frequência, avaliação, e cadastrando metas.

### Pra adicionar uma medida disciplinar (teste)

1. Menu: **Dep. Pessoal e RH** > **Medidas Disciplinares**
2. Clica **"+ Nova medida"**
3. Modal abre. Preenche:
   - Funcionário: escolhe um (ex: ALEXANDRE VITO CLERICI)
   - Data: hoje
   - Gravidade: **Leve**
   - Descrição: "Teste"
4. **Sistema vai sugerir automaticamente:** "Sugestão automática: Advertência Verbal" (porque é a 1ª leve no ano)
5. Clica em **"Aplicar"** pra aceitar a sugestão
6. **Salva**
7. Volta na tela de Funcionários, clica no Alexandre, calcula bônus → agora **Conduta vai estar 0%** (porque tem 1 medida)

---

## ❌ Em caso de erro

### Erro: "Nenhum funcionário ativo encontrado"

→ Significa que o reset apagou os funcionários (não devia ter acontecido — eles são preservados). Me chama via WhatsApp/chat com print do erro.

### Erro durante importação ("HTTP 500" ou similar)

1. Espera 30 segundos
2. Aperta F5
3. Tenta de novo
4. Se persistir, me manda print + nome do arquivo

### Tela vazia mesmo após importar

1. Aperta **Ctrl+Shift+R** (hard reload — limpa cache)
2. Se persistir, me chama

### "Erro: column does not exist"

Algum campo da planilha não está no formato esperado. Me manda print da mensagem completa de erro.

### Cálculo do bônus com valores estranhos

Pode ser que metas não foram cadastradas (Empresa/Área retornam 0%). Volte ao Passo 5.

### Reset não aparece em Configuração

Significa que você não está logada como master. Verifica via Configuração > Usuários se seu perfil é "master". Se não for, me chama.

---

## ✅ Checklist final do Go-Live

Quando você completar tudo, deve ter:

- [ ] Sistema com base zerada (Reset feito)
- [ ] 15 CCs com tipo_custo definido
- [ ] Contas Bancárias cadastradas
- [ ] **7 importações concluídas** com sucesso (cada uma com Import #N anotado)
- [ ] Período 2026-1 cadastrado
- [ ] Metas da Empresa cadastradas
- [ ] Pelo menos 1 meta por área cadastrada
- [ ] Pelo menos 1 funcionário tem cálculo de bônus rodando

**Você está LIVE.** 🎉

---

## 📞 Contato

Se travar em qualquer ponto, me manda mensagem com:
1. Print da tela
2. Mensagem de erro (se houver)
3. Em qual passo do roteiro travou

Boa sorte! ✨
