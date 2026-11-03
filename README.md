# 3DM — FRC 1156 Under Control

## O que é

Aplicativo web colaborativo da equipe FRC 1156 para o **3DM (Data-Driven Decision Making)**, o processo que vai do manual do jogo até o arquétipo do robô e o plano de CAD logo após o kickoff. Substitui a planilha do Google, é independente de temporada e guarda todo o histórico. Só membros da equipe (lista de e-mails autorizados) entram, com login Google.

## Como funciona

- **5 etapas** (mesma estrutura da planilha do 3DM). Grupos de 4–5 pessoas trabalham em paralelo, cada um numa etapa, com edição em tempo real. Nenhuma etapa bloqueia as outras.
- **A IA lê o manual**: na configuração da temporada, o PDF do manual é enviado direto do navegador ao provedor (Anthropic ou OpenAI). O PDF não é guardado, só o modelo da temporada resultante.
- **Itens de IA**: tudo que a IA gera aparece marcado como "IA" (com citação do manual quando possível) até uma pessoa aceitar ou editar. Cada etapa tem "Sugerir" e há uma caixa de perguntas ao manual.
- **Histórico**: quem mudou o quê, quando e por quê, e se foi IA ou humano.
- **Temporadas**: cada temporada fica arquivada e consultável depois.

## Configuração inicial (uma vez)

### 1. Projeto Firebase

1. No [console do Firebase](https://console.firebase.google.com), crie um projeto no plano **Spark** (gratuito).
2. **Authentication** > Sign-in method > ative **Google**.
3. **Firestore Database** > criar banco em **modo de produção**.
4. **Realtime Database** > criar banco (modo bloqueado; as regras vêm do repositório).
5. **Hosting** > começar.
6. **Authentication** > Settings > Authorized domains: adicione o domínio de produção (`<projeto>.web.app` e `<projeto>.firebaseapp.com` já vêm por padrão; adicione qualquer domínio próprio).
7. Em Configurações do projeto > Seus apps, registre um app **Web** e copie a configuração.
8. Edite `.firebaserc` e troque `demo-3dm` pelo ID do seu projeto.

### 2. Variáveis de ambiente e segredos

Copie `.env.example` para `.env.local` e preencha com a configuração web (não commite arquivos `.env`):

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_DATABASE_URL=...
VITE_FIREBASE_APP_ID=...
```

No GitHub, em Settings > Secrets and variables > Actions, crie estes segredos:

| Segredo | Valor |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | `apiKey` da configuração web |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` |
| `VITE_FIREBASE_DATABASE_URL` | `databaseURL` |
| `VITE_FIREBASE_APP_ID` | `appId` |
| `FIREBASE_PROJECT_ID` | ID do projeto (mesmo de `.firebaserc`) |
| `FIREBASE_SERVICE_ACCOUNT` | JSON completo da conta de serviço (abaixo) |

**Conta de serviço**: no Google Cloud Console (mesmo projeto) > IAM e administrador > Contas de serviço > criar conta, com os papéis **Firebase Hosting Admin**, **Firebase Rules Admin**, **Cloud Datastore Index Admin**, **Firebase Realtime Database Admin** e **Service Usage Consumer**. O primeiro deploy valida as permissões: se faltar algum papel, o passo correspondente do workflow falha com erro de permissão; adicione o papel indicado e rode de novo. Depois, em Chaves > Adicionar chave > JSON, e cole o conteúdo inteiro do arquivo no segredo `FIREBASE_SERVICE_ACCOUNT`. Apague o arquivo local depois.

A cada push em `main`, o workflow `.github/workflows/deploy.yml` roda lint e testes, faz o build, publica as regras do Firestore, os índices e as regras do Realtime Database e, por último, o Hosting (assim o app novo nunca fica no ar com regras antigas).

### 3. Primeiro administrador

Ninguém entra sem estar na lista, então o primeiro admin precisa ser criado à mão. No console do Firebase, em Firestore, crie o documento `members/{e-mail em minúsculas}` (o ID do documento é o e-mail, por exemplo `fulano@gmail.com`) com os campos:

- `email` (string): o e-mail em minúsculas
- `role` (string): `admin`

Depois disso, entre no app com esse e-mail e adicione os demais membros em **Membros**.

### 4. Chave de IA

A IA é opcional: sem chave, tudo pode ser editado à mão e os botões de IA mostram "configure uma chave".

- **Chave pessoal**: cada pessoa cola a própria chave em **IA** (menu). Ela fica só no `localStorage` daquele navegador, nunca vai para o Firestore e só é enviada ao provedor. Tem precedência sobre a chave da equipe. Há o botão "Remover chave".
- **Chave da equipe** (admin): um admin salva uma chave compartilhada em **IA**, gravada no Firestore em `secrets/ai`, legível por qualquer membro autorizado e gravável só por admins.

**Riscos aceitos**: não há servidor, então qualquer membro autorizado consegue, tecnicamente, ler a chave da equipe pelo navegador; admins podem trocar ou remover a chave a qualquer momento. Quem tem acesso ao navegador/perfil, ou um bug de XSS, também consegue ler uma chave pessoal. Por isso use **sempre uma chave com limite de gasto baixo**.

**Como criar a chave**:
- Anthropic: [console.anthropic.com](https://console.anthropic.com) > API Keys > Create Key. Defina o limite de gasto em Settings > Limits.
- OpenAI: [platform.openai.com](https://platform.openai.com) > API keys > Create new secret key. Defina o limite em Settings > Limits (Budget).

## Desenvolvimento local

```
npm install
npx firebase emulators:start    # Auth 9099, Firestore 8080, Realtime Database 9000
```

Em `.env.local`, adicione `VITE_USE_EMULATORS=true` (junto com as demais variáveis; valores fictícios servem com `demo-3dm`). Em outro terminal:

```
npm run dev
```

Testes:

```
npm test            # testes unitários e de componentes
npm run test:rules  # regras de segurança (precisa de Java e dos emuladores)
npm run lint
npm run build
```

## Checklist do kickoff

1. **Criar a temporada**: menu **Temporadas** (`/admin/seasons`), com nome e ano.
2. **Configurar a temporada com o manual**: `/s/<id-da-temporada>/setup` (admin). Envie o PDF do manual e revise o que a IA preencheu.
3. **Criar os grupos**: menu **Grupos** (`/s/<id-da-temporada>/groups`).
4. **Atribuir grupos e prazos às etapas**: no pipeline, abra cada etapa e defina o grupo responsável e o prazo.
