# Runbook — ativação manual de Premium (bônus Pro+/Vip+)

**Para quem**: consultoria e suporte da Viajaly, ou quem estiver operando o SQL Editor do Supabase.
**Quando usar**: liberar o Premium do Viajaly Trip para um cliente que **não comprou pelo checkout** — bônus incluso nos pacotes **Pro+** e **Vip+** da consultoria, cortesia, correção de erro ou QA interno.
**Quando NÃO usar**: compra normal pelo site. Essa passa pelo Stripe e ativa o Premium sozinha (VJT-012); rodar SQL por cima só atrapalha o rastro do pagamento.

> Pacote **Start+ não tem Premium incluso** — é argumento de upsell. Antes de ativar, confirme o pacote contratado.

Ref.: `VIAJALY-TRIP.md` Seção 2 (planos) e Seção 7 (VJT-011/VJT-011b).

---

## O que a ativação faz

O plano de cada pessoa vive numa linha só, na tabela `entitlements` (uma linha por usuário, chave `user_id`). O app lê essa linha e nada mais — não existe "premium por viagem" nem flag em outro lugar.

| Coluna              | O que colocar na ativação manual                                      |
| ------------------- | --------------------------------------------------------------------- |
| `user_id`           | UUID do usuário no Supabase Auth                                      |
| `plano`             | `premium`                                                             |
| `origem`            | `pacote_visto` (bônus Pro+/Vip+) ou `manual` (cortesia, QA, correção) |
| `expires_at`        | `null` para vitalício, ou uma data se o acesso tem prazo              |
| `stripe_payment_id` | **não mexer** — é do checkout                                         |

Com a linha gravada, o app libera o Premium **na hora, sem a pessoa recarregar a página** (Realtime, VJT-011): os 6 gatilhos de paywall param de bater, as viagens ficam ilimitadas, o PDF libera, a cota de IA sobe para 100/mês e os checklists completos aparecem.

---

## Passo 1 — achar o `user_id` pelo e-mail

Supabase → projeto do app (`urrlqljlibpzaqnemlwf`, Lovable Cloud) → **SQL Editor** → nova query:

```sql
select id, email, created_at
from auth.users
where lower(email) = lower('cliente@exemplo.com');
```

- **Nenhuma linha**: a pessoa ainda não criou conta no app. Peça para ela se cadastrar primeiro (o Premium é por usuário, então precisa existir o usuário). Não dá para "pré-ativar" um e-mail.
- **Mais de uma linha**: cadastro duplicado (e-mails diferentes por maiúscula/minúscula, ou login social + e-mail/senha). Confirme com a pessoa qual conta ela usa para entrar — ative só essa. Ativar as duas não quebra nada, mas dobra o trabalho de revogar depois.

Copie o `id`. É esse UUID que entra no passo 2.

## Passo 2 — ativar

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

## Passo 3 — conferir que colou

```sql
select user_id, plano, origem, expires_at, stripe_payment_id, updated_at
from public.entitlements
where user_id = 'COLE-O-UUID-AQUI';
```

Ativação bem-sucedida = `plano = premium`, `origem` igual à que você mandou, `expires_at` nulo (ou a data combinada) e `updated_at` de agora.

Confirmação do lado do cliente: peça para ela abrir o app **sem recarregar** e tentar algo que era travado — criar uma segunda viagem, ou abrir os checklists (a linha "+N itens completos" com cadeado some). Se funcionar, acabou.

## Passo 4 — revogar (quando precisar)

```sql
update public.entitlements
set plano = 'free', origem = 'manual', expires_at = null, updated_at = now()
where user_id = 'COLE-O-UUID-AQUI'
  and origem is distinct from 'stripe';
```

Mesma proteção do passo 2: **nunca revogue um premium comprado no Stripe por aqui** — isso é caso de reembolso, não de SQL. O acesso cai na hora, também sem reload.

---

## Quando o cliente diz que não liberou

Na ordem, do mais comum ao menos:

1. **A conta ativada não é a que ela usa.** Refaça o passo 1 e confirme o e-mail exato do login. É de longe a causa mais frequente (o cliente contratou com um e-mail e se cadastrou com outro).
2. **A linha não está como você acha.** Rode o passo 3. Se `plano` estiver `free`, a ativação não passou — provavelmente o `INSERT 0 0` do passo 2, por já existir `origem = 'stripe'`.
3. **`expires_at` no passado.** O app rebaixa para free mesmo com `plano = 'premium'` gravado. Rode o passo 2 de novo com `null`.
4. **A conexão em tempo real caiu no aparelho dela** (rede instável, app aberto há muito tempo). Peça para fechar e abrir o app — na abertura o plano é lido de novo, sem depender do canal. Se aí liberar, era só isso.
5. **Nada acima explica.** Guarde o `user_id`, o horário e o resultado do passo 3, e passe para quem cuida do código.

---

## Nota para quem programa

Este runbook é o procedimento oficial do caminho manual. Os comentários de `src/hooks/useEntitlement.ts` e da migration `supabase/migrations/20260725190000_vjt011_entitlements_realtime.sql` apontam para cá — se o procedimento mudar, atualize aqui e mantenha os ponteiros.

`entitlements` continua **sem nenhuma policy de escrita para o client** (só `ent_select_own`, de leitura da própria linha). Toda escrita é service role: o webhook do Stripe (`src/lib/premium-entitlement.server.ts`, VJT-012) ou o SQL acima. Nunca adicione policy de `insert`/`update` nessa tabela para o client — seria o mesmo que deixar o usuário se dar Premium.
