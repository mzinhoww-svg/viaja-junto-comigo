import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useDeleteAccount } from "@/hooks/useDeleteAccount";

const CONFIRMACAO = "EXCLUIR";

/**
 * Exclusão de conta (LGPD, VJT-017) — ação irreversível: remove a(s)
 * viagem(ns) própria(s) e todo o conteúdo delas (orçamento, economia,
 * checklists, roteiro, respostas de NPS), via cascade no Postgres. Exige
 * digitar "EXCLUIR" para habilitar o botão destrutivo, evitando exclusão
 * por toque acidental.
 */
export function DeleteAccountCard() {
  const nav = useNavigate();
  const del = useDeleteAccount();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const podeExcluir = confirmText === CONFIRMACAO && !del.isPending;

  function handleDelete() {
    del.mutate(undefined, {
      onSuccess: () => {
        nav({ to: "/portal/login" });
      },
      onError: (e) => {
        toast.error((e as Error).message || "Não foi possível excluir sua conta agora.");
      },
    });
  }

  return (
    <Card className="border-destructive/40">
      <CardContent className="space-y-2 p-4">
        <p className="text-sm font-medium text-foreground">Excluir minha conta</p>
        <p className="text-xs text-muted-foreground">
          Remove permanentemente sua conta e todas as viagens que você criou (orçamento, economia,
          checklists e roteiro). Essa ação não pode ser desfeita.
        </p>
        <Button variant="destructive" size="sm" className="w-full" onClick={() => setOpen(true)}>
          <Trash2 className="mr-2 h-4 w-4" aria-hidden />
          Excluir minha conta
        </Button>
      </CardContent>

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setConfirmText("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir sua conta?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso remove sua conta e todas as viagens que você é dono(a), com todo o conteúdo
              (orçamento, economia, checklists, roteiro). Não é possível desfazer. Para confirmar,
              digite <span className="font-semibold text-foreground">{CONFIRMACAO}</span> abaixo.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRMACAO}
            aria-label={`Digite ${CONFIRMACAO} para confirmar`}
          />

          <AlertDialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={del.isPending}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={!podeExcluir} onClick={handleDelete}>
              {del.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                "Excluir permanentemente"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
