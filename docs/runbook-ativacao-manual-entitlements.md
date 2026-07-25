# Runbook — ativação de Premium fora do checkout (bônus Pro+/Vip+, QA, demo)

**Para quem**: consultoria e suporte da Viajaly, e quem faz QA interno do Viajaly Trip.
**Quando usar**: liberar o Premium para alguém que **não comprou pelo checkout** — bônus incluso nos pacotes **Pro+** e **Vip+** da consultoria, cortesia, correção de erro ou teste interno.
**Quando NÃO usar**: compra normal pelo site. Essa passa pelo Stripe e ativa o Premium sozinha (VJT-012); mexer por cima só atrapalha o rastro do pagamento.

> Pacote **Start+ não tem Premium incluso** — é argumento de upsell. Antes de ativar, confirme o pacote contratado.

Ref.: `VIAJALY-TRIP.md` Seção 2 (planos) e Seção 7 (VJT-011, VJT-011b, VJT-011c, VJT-011d).

---

## Existem dois caminhos. Comece pelo código.

|                    | **Código de acesso** (VJT-011c/d)                                                 | **SQL Editor** (VJT-011b)          |
| ------------------ | --------------------------------------------------------------------------------- | ---------------------------------- |
| Onde               | `/trip/mais` → "Tenho um código de acesso"; ou `/trip/login` → "Acesso da equipe" | Supabase → SQL Editor              |
| Quem consegue usar | qualquer pessoa da equipe com o código                                            | quem tem acesso ao painel Supabase |
| Ativa para         | **quem digita**, e só                                                             | qualquer `user_id`                 |
| `origem` gravada   | sempre `manual`                                                                   | `manual` **ou** `pacote_visto`     |
| `expires_at`       | sempre `null` (vitalício)                                                         | qualquer data, ou `null`           |
| Revoga?            | não                                                                               | sim                                |
| Deixa rastro       | sim, em `audit_log`                                                               | não (só o `updated_at` da linha)   |
| Tempo              | ~10 segundos                                                                      | ~2 minutos                         |

**Regra prática**: se quem vai ficar Premium é você ou alguém da equipe que está com você, use o código. Para tudo o mais, o SQL do Caminho B.

### O código não cobre 5 casos — e é por isso que o SQL continua aqui

1. **Ativar para um cliente que não vai receber o código.** A ativação é sempre para o usuário autenticado que digitou (a server fn não aceita `user_id` como parâmetro — de propósito, para um código vazado nunca virar ferramenta de escrita em conta alheia).
2. **Registrar o bônus como `pacote_visto`.** O código grava sempre `origem = 'manual'`. Se o registro precisa dizer "isto veio do pacote Pro+/Vip+", só o SQL faz.
3. **Acesso com prazo.** O código sempre grava `expires_at = null`. Prazo é SQL.
4. **Revogar.** O código só ativa.
5. **Reativar um `pacote_visto` que expirou sem perder a linhagem.** Feito por código, a linha volta como `manual` e a origem original some do registro.

---

## Caminho A — código de acesso (padrão)

### A1. Liberar o Premium de quem já está logado

1. A pessoa abre **`/trip/mais`** e toca em **"Usar código"** no card "Tenho um código de acesso".
2. Digita o código e confirma. Hífen, espaço e maiúscula/minúscula são ignorados — `vjt-aaaa bbbb-cccc` e `VJTAAAABBBBCCCC` são o mesmo código.
3. Resposta esperada: toast **"Premium ativado!"**. O card some da tela (ele só aparece para quem ainda não é Premium) e os 6 gatilhos de paywall param de bater **na hora, sem recarregar a página**.

Se a pessoa **já era Premium**, o toast é "Seu plano Premium já estava ativo." e **nada é escrito** — inclusive a `origem` de quem pagou no Stripe fica intacta.

### A2. Entrar e já liberar (equipe, sem esperar e-mail)

Em **`/trip/login`** → **"Acesso da equipe"** → mesmo código. Isso abre a sessão da conta configurada em `TRIP_ADMIN_EMAIL` e **já ativa o Premium dela** — não precisa repetir o passo A1. Se essa conta ainda não existir no ambiente, ela é criada já confirmada.

> O código de login **não entra na conta de um cliente**. Ele abre exclusivamente a conta de `TRIP_ADMIN_EMAIL`, que é uma credencial compartilhada da equipe — não uma chave mestra do produto. Essa distinção é o que limita o estrago se o código vazar.

### A3. Cuidados

- **O código é da equipe, não do cliente.** Quem recebe libera o próprio Premium — e pode repassar o código adiante. Para dar Premium a um cliente, prefira o Caminho B, que ativa a conta dele sem entregar credencial nenhuma.
- **Nunca escreva o código em issue, PR, ticket de suporte ou arquivo do repositório.** Ele vive só em variável de ambiente do servidor.
- **Precisa trocar o código?** `TRIP_ADMIN_CODE` aceita vários separados por vírgula: cadastre o novo junto do antigo, avise a equipe, depois remova o antigo — sem janela de indisponibilidade.

### A4. Configuração do ambiente (uma vez, por ambiente)

| Variável           | Para quê                         | Sem ela                                                                       |
| ------------------ | -------------------------------- | ----------------------------------------------------------------------------- |
| `TRIP_ADMIN_CODE`  | o(s) código(s) válido(s)         | o card responde "Ativação por código está desativada neste ambiente"          |
| `TRIP_ADMIN_EMAIL` | conta que o login da equipe abre | `/trip/login` responde "Acesso da equipe não está configurado neste ambiente" |

Nenhuma das duas leva o prefixo `VITE_` — com o prefixo elas iriam para o bundle do navegador e o código estaria público. Código com menos de **12 caracteres** (já normalizado) é ignorado: configuração fraca deixa o recurso desligado em vez de existir um código adivinhável liberando Premium vitalício.

Cinco tentativas erradas bloqueiam por 15 minutos. O contador vive na memória do processo do servidor, então em serverless cada instância tem o seu — é atrito contra força bruta ingênua, não garantia distribuída; quem segura a porta é a entropia do código.

### A5. Auditoria

Toda entrada por código deixa rastro em `audit_log` — é a vantagem operacional desse caminho sobre o SQL, que não registra quem rodou o quê:

```sql
select created_at, actor, action, payload
from public.audit_log
where action in ('trip_admin_code_redeemed', 'trip_admin_login')
order by created_at desc
limit 50;
```

`actor` = `target` = o usuário que ficou Premium. `payload.already = true` significa que a pessoa já era Premium e nada foi escrito.

---

## Caminho B — SQL Editor

Use nos 5 casos que o código não cobre. É também o caminho de diagnóstico quando o cliente diz que não liberou.

### O que a ativação faz

O plano de cada pessoa vive numa linha só, na tabela `entitlements` (uma linha por usuário, chave `user_id`). O app lê essa linha e nada mais — não existe "premium por viagem" nem flag em outro lugar.

| Coluna              | O que colocar na ativação manual                                      |
| ------------------- | --------------------------------------------------------------------- |
| `user_id`           | UUID do usuário no Supabase Auth                                      |
| `plano`             | `premium`                                                             |
| `origem`            | `pacote_visto` (bônus Pro+/Vip+) ou `manual` (cortesia, QA, correção) |
| `expires_at`        | `null` para vitalício, ou uma data se o acesso tem prazo              |
| `stripe_payment_id` | **não mexer** — é do checkout                                         |

Com a linha gravada, o app libera o Premium **na hora, sem a pessoa recarregar a página** (Realtime, VJT-011): os 6 gatilhos de paywall param de bater, as viagens ficam ilimitadas, o PDF libera, a cota de IA sobe para 100/mês e os checklists completos aparecem.

### Passo 1 — achar o `user_id` pelo e-mail

Supabase → projeto do app (`urrlqljlibpzaqnemlwf`, Lovable Cloud) → **SQL Editor** → nova query:

```sql
select id, email, created_at
from auth.users
where lower(email) = lower('cliente@exemplo.com');
```

- **Nenhuma linha**: a pessoa ainda não criou conta no app. Peça para ela se cadastrar primeiro em `/trip/login` — Google ou link mágico, os dois criam a conta na hora (o Premium é por usuário, então precisa existir o usuário). Não dá para "pré-ativar" um e-mail.
- **Mais de uma linha**: cadastro duplicado (e-mails diferentes por maiúscula/minúscula, ou login social + e-mail/senha). Confirme com a pessoa qual conta ela usa para entrar — ative só essa. Ativar as duas não quebra nada, mas dobra o trabalho de revogar depois.

Copie o `id`. É esse UUID que entra no passo 2.

### Passo 2 — ativar

Troque o UUID e a origem, e rode:

```sql
insert into public.entitlements (user_id, plano, origem, expires_at, updated_at)
values ('COLE-O-UUID-AQUI', 'premium', 'pacote_visto', null, now())
on conflict (user_id) do update
set plano      = 'premium',
    origem     = excluded.origem,
    expires_at = excluded.expires_at,
    updated_at = now()
where entitlements.origem is distinct from 'stripe';
```

Por que assim:

- **`insert ... on conflict`**: funciona tanto para quem nunca teve linha quanto para quem já tem (ex.: premium que expirou). Rodar duas vezes não duplica nada — a chave primária é o `user_id`.
- **`where entitlements.origem is distinct from 'stripe'`**: protege quem já pagou. Sem essa cláusula, a ativação manual sobrescreveria `origem = 'stripe'` e o rastro da compra sumiria do registro. Se a query retornar `INSERT 0 0`, é exatamente esse caso — **a pessoa já é premium por pagamento e não precisa de nada**.
- **`stripe_payment_id` fica de fora do comando**: o `do update` só toca as colunas listadas, então um pagamento antigo continua registrado.
- Para acesso com prazo, troque `null` por uma data: `'2027-01-31T23:59:59Z'::timestamptz`. Depois dessa data o app rebaixa para free sozinho, sem ninguém precisar revogar.

### Passo 3 — conferir que colou

```sql
select user_id, plano, origem, expires_at, stripe_payment_id, updated_at
from public.entitlements
where user_id = 'COLE-O-UUID-AQUI';
```

Ativação bem-sucedida = `plano = premium`, `origem` igual à que você mandou, `expires_at` nulo (ou a data combinada) e `updated_at` de agora.

Confirmação do lado do cliente: peça para ela abrir o app **sem recarregar** e tentar algo que era travado — criar uma segunda viagem, ou abrir os checklists (a linha "+N itens completos" com cadeado some). Se funcionar, acabou.

### Passo 4 — revogar (quando precisar)

Não existe revogação por código; é sempre por aqui.

```sql
update public.entitlements
set plano = 'free', origem = 'manual', expires_at = null, updated_at = now()
where user_id = 'COLE-O-UUID-AQUI'
  and origem is distinct from 'stripe';
```

Mesma proteção do passo 2: **nunca revogue um premium comprado no Stripe por aqui** — isso é caso de reembolso, não de SQL. O acesso cai na hora, também sem reload.

---

## Quando a pessoa diz que não liberou

Na ordem, do mais comum ao menos:

1. **A conta ativada não é a que ela usa.** Refaça o passo 1 do Caminho B e confirme o e-mail exato do login. É de longe a causa mais frequente (o cliente contratou com um e-mail e se cadastrou com outro). Vale também para o Caminho A: se ela digitou o código **logada em outra conta**, o Premium foi para a outra conta.
2. **A linha não está como você acha.** Rode o passo 3. Se `plano` estiver `free`, a ativação não passou — provavelmente o `INSERT 0 0` do passo 2, por já existir `origem = 'stripe'`.
3. **`expires_at` no passado.** O app rebaixa para free mesmo com `plano = 'premium'` gravado. Rode o passo 2 de novo com `null`.
4. **O código não está configurado no ambiente.** Se a tela respondeu "Ativação por código está desativada neste ambiente", não é código errado — é `TRIP_ADMIN_CODE` faltando (ver A4). Confira em `audit_log` (A5) se o resgate chegou a acontecer.
5. **A conexão em tempo real caiu no aparelho dela** (rede instável, app aberto há muito tempo). Peça para fechar e abrir o app — na abertura o plano é lido de novo, sem depender do canal. Se aí liberar, era só isso.
6. **Nada acima explica.** Guarde o `user_id`, o horário e o resultado do passo 3, e passe para quem cuida do código.

---

## Nota para quem programa

Este runbook é o procedimento oficial dos dois caminhos. Os comentários de `src/hooks/useEntitlement.ts`, `src/lib/trip-admin-code.ts`, `src/lib/trip-admin-code.functions.ts`, `src/lib/admin-login.functions.ts` e da migration `supabase/migrations/20260725190000_vjt011_entitlements_realtime.sql` apontam para cá — se o procedimento mudar, atualize aqui e mantenha os ponteiros.

O Caminho A é `redeemAdminCode` (`trip-admin-code.functions.ts`) e `loginWithAdminCode` (`admin-login.functions.ts`); os dois terminam em `activateManualPremiumEntitlement` (`premium-entitlement.server.ts`), que lê a linha antes de escrever e **nunca rebaixa nem troca a origem de quem já é premium** por qualquer origem (`stripe`, `pacote_visto` ou `manual`) — comportamento coberto por `premium-entitlement.manual.server.test.ts`.

`entitlements` continua **sem nenhuma policy de escrita para o client** (só `ent_select_own`, de leitura da própria linha). Toda escrita é service role: o webhook do Stripe (`premium-entitlement.server.ts`, VJT-012), as server fns do Caminho A, ou o SQL do Caminho B. Nunca adicione policy de `insert`/`update` nessa tabela para o client — seria o mesmo que deixar o usuário se dar Premium.
