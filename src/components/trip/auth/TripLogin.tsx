import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ViajalyLogo } from "@/components/trip/ViajalyLogo";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { loginWithAdminCode } from "@/lib/admin-login.functions";

/**
 * Login próprio do Viajaly Trip (VJT-011d). O Trip é vendido separado da
 * consultoria de vistos, então ele não manda mais ninguém para
 * `/portal/login` — aquela tela fala de consultora, código de 6 dígitos e
 * viagem aos EUA, contexto que não existe para quem comprou só o Trip.
 *
 * Mesmo projeto Supabase dos dois produtos (banco centralizado, decisão do
 * dono do produto): quem já é cliente Viajaly de visto entra aqui com o
 * MESMO e-mail e cai na mesma conta — sem cadastro duplicado, sem migração,
 * e uma sessão ativa no portal já vale para o Trip (é por isso que o "entrar
 * como cliente Viajaly" não precisa de fluxo de SSO próprio).
 *
 * Diferença que faz o Trip ser vendável sozinho: aqui o cadastro é aberto
 * (`shouldCreateUser: true`), enquanto o portal só deixa entrar quem a
 * consultoria já cadastrou.
 */
/** Marca oficial do Google, inline (o CSP do app não carrega imagem externa). */
function GoogleMark() {
  return (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 48 48" aria-hidden focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export function TripLogin({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [modoEquipe, setModoEquipe] = useState(false);
  const [codigo, setCodigo] = useState("");
  const adminLogin = useServerFn(loginWithAdminCode);

  /**
   * Google é o caminho principal: entra em um toque, sem depender de entrega
   * de e-mail (o link mágico esbarra em spam e em quem abre o e-mail em
   * outro aparelho).
   *
   * VJT-021 — por que existe uma sondagem antes de navegar: a versão anterior
   * chamava `signInWithOAuth` sem `skipBrowserRedirect`, então o próprio
   * supabase-js já mandava o navegador para `/auth/v1/authorize`. Com o
   * provider habilitado no painel MAS sem Client ID/Secret, esse endpoint
   * responde `400 {"error_code":"validation_failed","msg":"Unsupported
   * provider: missing OAuth secret"}` — e o usuário via o JSON cru numa
   * página em branco. O `onError` daqui nunca chegava a rodar, porque do lado
   * do JS não houve erro nenhum: a falha acontece depois da navegação.
   *
   * Então pedimos a URL sem navegar e batemos nela antes. `opaqueredirect` é
   * a resposta de um provider configurado (ele quer redirecionar para o
   * Google); status >= 400 é a configuração faltando. Se o fetch falhar por
   * CORS ou rede, seguimos o fluxo normal: barrar um login que provavelmente
   * funciona seria pior que o risco de mostrar o erro.
   */
  /**
   * VJT-021b — usamos o helper gerenciado do Lovable Cloud
   * (`lovable.auth.signInWithOAuth`), que já tem credenciais Google
   * provisionadas e funciona no preview em iframe (fluxo web_message).
   *
   * `redirect_uri` PRECISA ser público same-origin — não pode apontar direto
   * para uma rota protegida. O destino desejado (`next`) fica guardado em
   * sessionStorage e é lido depois que a sessão está hidratada.
   */
  // Quando o Google retorna via full-page redirect, ele volta com
  // `#access_token=...` no hash. O cliente Supabase (detectSessionInUrl)
  // consome esse hash automaticamente no primeiro load da página que
  // monta o React — por isso o `redirect_uri` PRECISA ser uma rota React
  // (ex.: `/trip/login`), NÃO a home (`/`), que serve HTML estático e
  // deixaria os tokens presos na URL sem virar sessão.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        let destino = next;
        try {
          const salvo = sessionStorage.getItem("viajaly:post-login-next");
          if (salvo) destino = salvo;
          sessionStorage.removeItem("viajaly:post-login-next");
        } catch {
          /* Safari privado, etc. */
        }
        window.location.replace(destino);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [next]);

  const googleMut = useMutation({
    mutationFn: async () => {
      try {
        sessionStorage.setItem("viajaly:post-login-next", next);
      } catch {
        /* Safari privado, etc. — seguimos sem persistir o destino */
      }
      const result = await lovable.auth.signInWithOAuth("google", {
        // Rota React same-origin que monta o cliente Supabase e consome o
        // hash `#access_token` no retorno do provedor. Apontar para `/`
        // (HTML estático) fazia o usuário parar na home com os tokens
        // visíveis na URL e sem sessão.
        redirect_uri: `${window.location.origin}/trip/login`,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      // Popup: sessão já foi setada — leva o usuário para o destino.
      window.location.href = next;
    },
    onError: () => toast.error("Não foi possível abrir o login do Google. Tente o e-mail."),
  });


  const linkMut = useMutation({
    mutationFn: async () => {
      const valor = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) throw new Error("EMAIL_INVALIDO");
      const { error } = await supabase.auth.signInWithOtp({
        email: valor,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}${next}`,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => setEnviado(true),
    onError: (e: Error) => {
      toast.error(
        e.message === "EMAIL_INVALIDO"
          ? "Digite um e-mail válido."
          : "Não conseguimos enviar o link agora. Tente de novo em instantes.",
      );
    },
  });

  const equipeMut = useMutation({
    mutationFn: async () => {
      const resultado = await adminLogin({ data: { code: codigo.trim() } });
      if (!resultado.ok) throw new Error(resultado.error);
      const { error } = await supabase.auth.verifyOtp({
        email: resultado.email,
        token_hash: resultado.hashed_token,
        type: "magiclink",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      // Recarrega em vez de navegar: o layout de /trip/* lê a sessão no
      // beforeLoad, e uma navegação client-side pode rodar antes do storage
      // da sessão assentar.
      window.location.href = next;
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível entrar."),
  });

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-6 py-10">
      <div className="space-y-3">
        <ViajalyLogo size="lg" />
        <p className="text-sm text-muted-foreground">
          Planeje sua viagem inteira num lugar só: roteiro, orçamento, checklists e economia.
        </p>
      </div>

      <div className="space-y-3">
        {/* Fundo branco com borda, e não o coral do app: a diretriz de marca
            do Google admite botão branco ou preto, nunca uma cor arbitrária —
            e o mark colorido sobre o coral tinha contraste ruim de verdade em
            tela de celular sob luz do dia. `h-12` para alvo de toque
            confortável no mobile-first (base 375px). */}
        <Button
          variant="outline"
          className="h-12 w-full border-input bg-white text-base font-medium text-[#1F1F1F] hover:bg-neutral-50 hover:text-[#1F1F1F]"
          onClick={() => googleMut.mutate()}
          disabled={googleMut.isPending}
        >
          {googleMut.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Abrindo…
            </>
          ) : (
            <>
              <GoogleMark />
              Continuar com Google
            </>
          )}
        </Button>
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">ou</span>
          <span className="h-px flex-1 bg-border" />
        </div>
      </div>

      {enviado ? (
        <div className="space-y-3 rounded-xl border p-4">
          <p className="text-sm font-medium text-foreground">Link enviado para {email.trim()}</p>
          <p className="text-xs text-muted-foreground">
            Abra o e-mail no mesmo celular e toque no link para entrar. Não chegou? Confira o spam
            ou envie de novo.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              setEnviado(false);
              linkMut.reset();
            }}
          >
            Usar outro e-mail
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="trip-email" className="text-sm font-medium text-foreground">
              Seu e-mail
            </label>
            <Input
              id="trip-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="voce@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && email.trim()) linkMut.mutate();
              }}
              disabled={linkMut.isPending}
            />
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => linkMut.mutate()}
            disabled={!email.trim() || linkMut.isPending}
          >
            {linkMut.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Enviando…
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" aria-hidden />
                Entrar com link por e-mail
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground">
            É a mesma conta nos dois produtos: se você já é cliente Viajaly da consultoria de
            vistos, use o mesmo e-mail de lá (no Google ou no link) e entra direto, sem cadastro
            novo. Se ainda não tem conta, ela é criada na hora, sem senha.
          </p>
        </div>
      )}

      <div className="border-t pt-4">
        {modoEquipe ? (
          <div className="space-y-2">
            <label htmlFor="trip-admin-code" className="text-sm font-medium text-foreground">
              Código da equipe
            </label>
            <div className="flex gap-2">
              <Input
                id="trip-admin-code"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && codigo.trim()) equipeMut.mutate();
                }}
                placeholder="VJT-XXXX-XXXX-XXXX"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                className="font-mono text-xs uppercase"
                disabled={equipeMut.isPending}
              />
              <Button
                variant="secondary"
                onClick={() => equipeMut.mutate()}
                disabled={!codigo.trim() || equipeMut.isPending}
              >
                {equipeMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  "Entrar"
                )}
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setModoEquipe(true)}
            className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <KeyRound className="h-3.5 w-3.5" aria-hidden />
            Acesso da equipe
          </button>
        )}
      </div>
    </div>
  );
}
