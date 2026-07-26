import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateTrip } from "@/hooks/useCreateTrip";
import { brlToCents, formatBRL } from "@/lib/money";
import { OUTRO_DESTINO_ID, TRIP_DESTINATIONS } from "@/lib/trip-destinations";
import {
  validarNovaTripInput,
  type NovaTripInput,
  limparOrcamento,
  orcamentoInicialSugerido,
  ORCAMENTO_OUTRO,
  ORCAMENTO_SUGESTOES,
  type WizardOrcamentoItem,
} from "@/lib/trip-wizard";

const TOTAL_PASSOS = 4;

type FormState = {
  destinoId: string;
  paisLivre: string;
  cidadeLivre: string;
  modoSonho: boolean;
  dataViagem: string;
  numPessoas: number;
  numCriancas: number;
  orcamento: WizardOrcamentoItem[];
};

const ESTADO_INICIAL: FormState = {
  destinoId: TRIP_DESTINATIONS[0].id,
  paisLivre: "",
  cidadeLivre: "",
  modoSonho: true,
  dataViagem: "",
  numPessoas: 2,
  numCriancas: 0,
  orcamento: orcamentoInicialSugerido(),
};

function buildInput(form: FormState): NovaTripInput {
  const destinoEscolhido = TRIP_DESTINATIONS.find((d) => d.id === form.destinoId);
  const destino =
    form.destinoId === OUTRO_DESTINO_ID || !destinoEscolhido
      ? {
          pais: form.paisLivre,
          cidade: form.cidadeLivre.trim() || null,
          regiao: null,
          clima: null,
          destinoPack: null,
        }
      : {
          pais: destinoEscolhido.pais,
          cidade: destinoEscolhido.cidade,
          regiao: destinoEscolhido.regiao,
          clima: destinoEscolhido.clima,
          destinoPack: destinoEscolhido.destinoPack,
        };

  return {
    destino,
    dataViagem: form.modoSonho ? null : form.dataViagem || null,
    viajantes: { numPessoas: form.numPessoas, numCriancas: form.numCriancas },
    // Sugestões que o usuário não preencheu não são itens — some com elas
    // antes da validação (VJT-021).
    orcamento: limparOrcamento(form.orcamento),
  };
}

export function TripWizard() {
  const [passo, setPasso] = useState(1);
  const [form, setForm] = useState<FormState>(ESTADO_INICIAL);
  const createTrip = useCreateTrip();
  const navigate = useNavigate();

  const avancar = () => {
    const parcial = buildInput(form);
    const errosDoPasso = validarPasso(passo, parcial);
    if (errosDoPasso.length) {
      toast.error(errosDoPasso[0]);
      return;
    }
    setPasso((p) => Math.min(TOTAL_PASSOS, p + 1));
  };

  const voltar = () => setPasso((p) => Math.max(1, p - 1));

  const concluir = async () => {
    const input = buildInput(form);
    const erros = validarNovaTripInput(input);
    if (erros.length) {
      toast.error(erros[0]);
      return;
    }
    try {
      await createTrip.mutateAsync(input);
      toast.success("Viagem criada!");
      navigate({ to: "/trip" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar a viagem.");
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 pb-24 pt-8">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Passo {passo} de {TOTAL_PASSOS}
      </p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${(passo / TOTAL_PASSOS) * 100}%` }}
        />
      </div>

      <div className="mt-8 flex-1">
        {passo === 1 && <PassoDestino form={form} setForm={setForm} />}
        {passo === 2 && <PassoData form={form} setForm={setForm} />}
        {passo === 3 && <PassoViajantes form={form} setForm={setForm} />}
        {passo === 4 && <PassoOrcamento form={form} setForm={setForm} />}
      </div>

      <div className="mt-8 flex gap-3">
        {passo > 1 && (
          <Button variant="outline" className="flex-1" onClick={voltar}>
            Voltar
          </Button>
        )}
        {passo < TOTAL_PASSOS ? (
          <Button className="flex-1" onClick={avancar}>
            Avançar
          </Button>
        ) : (
          <Button className="flex-1" onClick={concluir} disabled={createTrip.isPending}>
            {createTrip.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              "Criar viagem"
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Validação incremental por passo — só valida os campos já preenchidos até aqui. */
function validarPasso(passo: number, input: NovaTripInput): string[] {
  const todos = validarNovaTripInput(input);
  if (passo === 1) return todos.filter((e) => e.includes("destino"));
  if (passo === 2) return todos.filter((e) => e.includes("Data"));
  if (passo === 3) return todos.filter((e) => e.includes("viajantes") || e.includes("crianças"));
  return todos;
}

type PassoProps = { form: FormState; setForm: (updater: (f: FormState) => FormState) => void };

function PassoDestino({ form, setForm }: PassoProps) {
  const isOutro = form.destinoId === OUTRO_DESTINO_ID;
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-foreground">Para onde vai a viagem?</h1>
      <div>
        <Label htmlFor="destino">Destino</Label>
        <Select
          value={form.destinoId}
          onValueChange={(v) => setForm((f) => ({ ...f, destinoId: v }))}
        >
          <SelectTrigger id="destino" className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TRIP_DESTINATIONS.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.label}
              </SelectItem>
            ))}
            <SelectItem value={OUTRO_DESTINO_ID}>Outro destino</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {isOutro && (
        <>
          <div>
            <Label htmlFor="pais">País</Label>
            <Input
              id="pais"
              className="mt-1"
              value={form.paisLivre}
              onChange={(e) => setForm((f) => ({ ...f, paisLivre: e.target.value }))}
              placeholder="Ex.: Groenlândia"
            />
          </div>
          <div>
            <Label htmlFor="cidade">Cidade (opcional)</Label>
            <Input
              id="cidade"
              className="mt-1"
              value={form.cidadeLivre}
              onChange={(e) => setForm((f) => ({ ...f, cidadeLivre: e.target.value }))}
            />
          </div>
        </>
      )}
    </div>
  );
}

function PassoData({ form, setForm }: PassoProps) {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-foreground">Quando vai ser a viagem?</h1>
      <div className="flex items-center justify-between rounded-md border border-border p-3">
        <Label htmlFor="modo-sonho" className="pr-4">
          Ainda não sei a data (modo sonho)
        </Label>
        <Switch
          id="modo-sonho"
          checked={form.modoSonho}
          onCheckedChange={(checked) => setForm((f) => ({ ...f, modoSonho: checked }))}
        />
      </div>
      {!form.modoSonho && (
        <div>
          <Label htmlFor="data-viagem">Data da viagem</Label>
          <Input
            id="data-viagem"
            type="date"
            className="mt-1"
            value={form.dataViagem}
            onChange={(e) => setForm((f) => ({ ...f, dataViagem: e.target.value }))}
          />
        </div>
      )}
    </div>
  );
}

function PassoViajantes({ form, setForm }: PassoProps) {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-foreground">Quem vai viajar?</h1>
      <div>
        <Label htmlFor="num-pessoas">Número de viajantes</Label>
        <Input
          id="num-pessoas"
          type="number"
          min={1}
          max={10}
          className="mt-1"
          value={form.numPessoas}
          onChange={(e) => setForm((f) => ({ ...f, numPessoas: Number(e.target.value) || 1 }))}
        />
      </div>
      <div>
        <Label htmlFor="num-criancas">Quantas são crianças?</Label>
        <Input
          id="num-criancas"
          type="number"
          min={0}
          max={form.numPessoas}
          className="mt-1"
          value={form.numCriancas}
          onChange={(e) => setForm((f) => ({ ...f, numCriancas: Number(e.target.value) || 0 }))}
        />
      </div>
    </div>
  );
}

function PassoOrcamento({ form, setForm }: PassoProps) {
  const adicionarItem = () =>
    setForm((f) => ({
      ...f,
      orcamento: [...f.orcamento, { nome: "", valorEstimadoBrlCents: 0 }],
    }));

  const removerItem = (index: number) =>
    setForm((f) => ({ ...f, orcamento: f.orcamento.filter((_, i) => i !== index) }));

  const atualizarItem = (index: number, patch: Partial<WizardOrcamentoItem>) =>
    setForm((f) => ({
      ...f,
      orcamento: f.orcamento.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-foreground">Orçamento inicial (opcional)</h1>
      <p className="text-sm text-muted-foreground">
        Adicione itens que já sabe que vai gastar. Pode pular e preencher depois.
      </p>
      {form.orcamento.map((item, index) => (
        <ItemOrcamento
          key={index}
          item={item}
          index={index}
          onChange={(patch) => atualizarItem(index, patch)}
          onRemove={() => removerItem(index)}
        />
      ))}
      <Button variant="outline" className="h-12 w-full" onClick={adicionarItem}>
        <Plus className="mr-2 h-4 w-4" aria-hidden />
        Adicionar item
      </Button>
    </div>
  );
}

/**
 * Uma linha do orçamento (VJT-021). Duas mudanças, e as duas vieram de uso em
 * aparelho real:
 *
 * 1. **Empilhada, não em uma linha só.** O layout anterior era
 *    `flex` com nome (`flex-1`) + valor (`w-32`) + botão de lixeira lado a
 *    lado. A 375px, descontando o `px-6` do wizard, sobravam ~143px para o
 *    nome — o placeholder "Ex.: Passagens aéreas" não cabia inteiro. Agora o
 *    nome ocupa a largura toda e valor/remover dividem a linha de baixo.
 * 2. **Sugestão em vez de campo em branco.** O campo livre só aparece depois
 *    de escolher "Outro", que é quando ele de fato é necessário.
 */
function ItemOrcamento({
  item,
  index,
  onChange,
  onRemove,
}: {
  item: WizardOrcamentoItem;
  index: number;
  onChange: (patch: Partial<WizardOrcamentoItem>) => void;
  onRemove: () => void;
}) {
  // "Outro" é um estado da linha, não do dado: um item cujo nome não está na
  // lista de sugestões já é, por definição, um item livre — inclusive quando
  // a tela remonta. Guardar isso em `useState` faria a linha voltar para o
  // Select depois de qualquer re-render.
  const livre = item.nome !== "" && !ORCAMENTO_SUGESTOES.includes(item.nome);
  const [forcarLivre, setForcarLivre] = useState(false);
  const mostrarCampoLivre = livre || forcarLivre;

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div>
        <Label htmlFor={`item-nome-${index}`}>Item</Label>
        {mostrarCampoLivre ? (
          <Input
            id={`item-nome-${index}`}
            className="mt-1 h-11"
            value={item.nome}
            autoFocus={forcarLivre}
            onChange={(e) => onChange({ nome: e.target.value })}
            placeholder="Ex.: Estacionamento no aeroporto"
          />
        ) : (
          <Select
            value={item.nome || undefined}
            onValueChange={(valor) => {
              if (valor === ORCAMENTO_OUTRO) {
                setForcarLivre(true);
                onChange({ nome: "" });
                return;
              }
              onChange({ nome: valor });
            }}
          >
            <SelectTrigger id={`item-nome-${index}`} className="mt-1 h-11">
              <SelectValue placeholder="Escolha um item" />
            </SelectTrigger>
            <SelectContent>
              {ORCAMENTO_SUGESTOES.map((sugestao) => (
                <SelectItem key={sugestao} value={sugestao}>
                  {sugestao}
                </SelectItem>
              ))}
              <SelectItem value={ORCAMENTO_OUTRO}>Outro (digitar)</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label htmlFor={`item-valor-${index}`}>Valor estimado</Label>
          <Input
            id={`item-valor-${index}`}
            className="mt-1 h-11"
            inputMode="decimal"
            value={item.valorEstimadoBrlCents ? formatBRL(item.valorEstimadoBrlCents) : ""}
            onChange={(e) => onChange({ valorEstimadoBrlCents: brlToCents(e.target.value) })}
            placeholder="R$ 0,00"
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0"
          aria-label={`Remover ${item.nome || "item"}`}
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
