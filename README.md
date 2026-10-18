# ITA · Caderno de Engenharia & Planejamento de Estudos

Aplicação Web Desktop-First para organização tática de estudos para o vestibular do **ITA (Instituto Tecnológico de Aeronáutica)**, construída sob a direção de design **Editorial Acadêmico (Anti-Slop)** com **PostgreSQL**, **Drizzle ORM**, **Next.js (App Router)** e **Google Gemini API (`@google/genai`)**.

## Telas Principais

1. **`01. Hoje` (`/`)**: A tela principal de execução diária. Exibe a **Próxima Sessão em Foco** com cronômetro líquido (`tabular-nums`), micro-fluxo de conclusão com agendamento automático de revisão espaçada (`24h`, `3d`, `7d`), reagendamento rápido, fila do dia, revisões pendentes e checklist de tarefas operacionais.
2. **`02. Planejamento semanal` (`/semanal`)**: Visão de Segunda a Domingo por horário, distinguindo blocos de estudo, pausas obrigatórias, compromissos fixos imutáveis (textura hachurada) e o **Motor Determinístico de Indicação de Sobrecarga**.
3. **`03. Minha rotina` (`/rotina`)**: Parametrização das regras do cronograma — limites diários/semanais, duração de blocos, pausas obrigatórias, pesos e metas semanais por disciplina da matriz ITA (`MAT`, `FIS`, `QUI`, `POR`, `ING`), disponibilidade recorrente e exceções de calendário.
4. **`04. Evolução` (`/evolucao`)**: Painel de auditoria comparando horas planejadas vs. realizadas por dia, distribuição e saldo por disciplina do ITA, fila de revisões atrasadas (*backlog*) e matriz de consistência semanal.

## Atalhos de Teclado (Desktop-First)

- `Ctrl+K` / `Cmd+K`: Abre a **Command Palette** para navegação e disparo rápido do Assistente IA.
- `Ctrl+J` / `Cmd+J`: Abre/fecha a gaveta lateral direita do **Assistente de Planejamento IA**.
- `Alt+1` a `Alt+4`: Alterna instantaneamente entre `01. Hoje`, `02. Planejamento semanal`, `03. Minha rotina` e `04. Evolução`.
- `Esc`: Fecha modais e a paleta de comandos.

## Como Executar

1. **Banco de Dados PostgreSQL 16 (Docker):**
   ```bash
   docker start ita_study_postgres
   ```
   *(String de conexão configurada em `.env`: `postgresql://ita_user:ita_password@localhost:5432/ita_study_db`)*

2. **Chave da API Gemini (Opcional para Inferência Generativa Ao Vivo):**
   Edite o arquivo `.env` e adicione sua chave em `GEMINI_API_KEY="..."` para utilizar os modelos `gemini-3.8-flash` e `gemini-4-argon` via `@google/genai`. Sem a chave, o sistema opera automaticamente com o **Solver Determinístico Local** acoplado ao PostgreSQL.

3. **Servidor de Desenvolvimento / Produção:**
   ```bash
   npm run dev
   # Acesse http://localhost:3000
   ```
