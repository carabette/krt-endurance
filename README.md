# KRT Endurance — Site de Cronograma de Stints

Site para gerenciamento de stints de corridas de endurance no iRacing.
Backend em Google Apps Script + Google Sheets. Frontend estático no GitHub Pages.

---

## Setup (passo a passo)

### 1. Criar a planilha Google Sheets

1. Crie uma nova planilha em [sheets.google.com](https://sheets.google.com)
2. Copie o **ID da planilha** da URL:
   `https://docs.google.com/spreadsheets/d/**SEU_ID_AQUI**/edit`
3. As abas serão criadas automaticamente pelo script na primeira execução.

---

### 2. Publicar o Google Apps Script

1. Na planilha, clique em **Extensões → Apps Script**
2. Apague o código padrão e cole o conteúdo de `apps-script/Code.gs`
3. Substitua `const SHEET_ID = '';` pelo ID da sua planilha
4. (Opcional) Defina a senha de admin:
   - Clique em **Projeto → Propriedades do script → Propriedades de script**
   - Adicione: `ADMIN_PASSWORD` = `sua_senha_admin`
   - Padrão se não configurado: `krt2024`
5. Clique em **Implantar → Nova implantação**
   - Tipo: **Web App**
   - Executar como: **Eu (minha conta)**
   - Quem tem acesso: **Qualquer pessoa**
6. Autorize as permissões solicitadas
7. Copie o **URL** gerado (formato: `https://script.google.com/macros/s/.../exec`)

---

### 3. Configurar o site

Edite o arquivo `js/config.js` e cole o URL do Apps Script:

```js
window.KRT_CONFIG = {
  scriptUrl: 'https://script.google.com/macros/s/SEU_ID_AQUI/exec',
};
```

---

### 4. Publicar no GitHub Pages

1. Crie um repositório no GitHub (ex: `krt-endurance`)
2. Faça upload de todos os arquivos:
   ```bash
   git init
   git add .
   git commit -m "KRT Endurance site"
   git remote add origin https://github.com/SEU_USUARIO/krt-endurance.git
   git push -u origin main
   ```
3. No GitHub, vá em **Settings → Pages**
4. Source: **Deploy from a branch** → `main` → `/ (root)`
5. O site estará disponível em: `https://SEU_USUARIO.github.io/krt-endurance`

---

## Fluxo de uso

### Admin (criar corrida)
1. Acesse `admin.html`
2. Faça login com a senha de admin (padrão: `krt2024`)
3. Preencha os dados da corrida (nome, data, horários, equipes)
4. Informe para cada equipe: nome, carro, capacidade do tanque, tempo de volta e consumo médio
5. Clique **Criar Corrida** — os timeslots são gerados automaticamente
6. Adicione os pilotos na seção "Pilotos" com seus iRatings e carros disponíveis

### Piloto (enviar disponibilidade)
1. Acesse `disponibilidade.html`
2. Selecione a corrida
3. Selecione seu nome
4. Informe o horário em que estará disponível (horário local)
5. Marque as condições que aceita (chuva, noite)
6. Informe tempo máximo no carro e descanso mínimo entre stints
7. (Opcional) Informe seus dados de pilotagem para cálculo personalizado de stint
8. Digite a senha do time e envie

### Admin (gerar cronograma)
1. Acesse `index.html`
2. Selecione a corrida
3. Clique no link "⚙ Admin" no rodapé
4. Digite a senha da corrida
5. Clique **Alocar Equipes** — distribui pilotos entre equipes balanceando iRating
6. Clique **Gerar Cronograma** — atribui pilotos aos slots respeitando todas as restrições
7. A grade atualiza automaticamente

### Ajustes manuais
- **No site**: clique no ✎ sobre qualquer stint (requer modo admin ativo)
- **Na planilha**: edite diretamente a aba `schedule` (coluna `status` será marcada como `manual`)

---

## Estrutura das abas no Google Sheets

| Aba | Descrição |
|---|---|
| `races` | Corridas cadastradas |
| `teams` | Equipes por corrida + configuração do carro |
| `drivers` | Pilotos globais (iRating, carros disponíveis) |
| `timeslots` | Slots de tempo por corrida (gerados automaticamente) |
| `availability` | Disponibilidade submetida pelos pilotos |
| `team_assignments` | Alocação de pilotos às equipes |
| `schedule` | Cronograma final de stints |

### Editar chuva nos slots
Na aba `timeslots`, edite a coluna `rain_pct` com o percentual de chuva previsto para cada slot.

---

## Algoritmos

### Balanceamento de equipes
- Pilotos são elegíveis apenas para equipes cujo carro possuem (`cars_available`)
- Snake draft: a equipe com menor iRating médio recebe o próximo piloto elegível mais forte
- Resultado garante o menor desvio possível entre as médias de iRating das equipes

### Auto-agendamento de stints
Para cada slot de tempo e cada equipe:
- Filtra pilotos disponíveis no horário, que aceitam as condições (chuva, noite)
- Verifica respeito ao descanso mínimo e ao limite máximo de tempo no carro
- Durações de stint calculadas por piloto: se o piloto forneceu dados de consumo, usa esses; caso contrário, usa o padrão do carro
- Em condições difíceis (chuva, noite), prioriza pilotos com maior iRating
- Em condições normais, distribui stints equitativamente entre os pilotos

---

## Personalização

### Adicionar mais equipes
- Ao criar a corrida no admin, clique "Adicionar Equipe" para incluir quantas equipes precisar
- Cada equipe tem suas próprias configurações de carro e combustível

### Alterar cores das equipes
Edite `css/style.css`:
```css
--color-team-1: #D8C48B;  /* KRT — dourado */
--color-team-2: #FCF9CE;  /* KRT-992 — creme */
```

### Editar dados diretamente na planilha
Todas as abas podem ser editadas diretamente. O site lerá os dados atualizados no próximo carregamento.

---

## Troubleshooting

**"URL do script não configurado"**
→ Edite `js/config.js` e cole o URL do Apps Script.

**"Erro ao carregar corridas"**
→ Verifique se o Apps Script está publicado com acesso "Qualquer pessoa".
→ Confirme que o `SHEET_ID` no `Code.gs` está correto.

**"Senha incorreta"**
→ A senha da corrida é definida ao criar a corrida no campo "Senha para pilotos".
→ A senha de admin é a propriedade `ADMIN_PASSWORD` no Apps Script (padrão: `krt2024`).

**Timeslots não gerados**
→ Verifique se os campos "Hora início (local)" e "Duração (horas)" foram preenchidos ao criar a corrida.
→ Na planilha, verifique a aba `timeslots` — se estiver vazia, tente recriar a corrida.
