import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBRL } from "@/lib/money";
import type { DonutSlice } from "@/lib/trip-budget";

type Props = {
  fatias: DonutSlice[];
};

export function BudgetDonutChart({ fatias }: Props) {
  if (fatias.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Distribuição do orçamento estimado
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={fatias}
                dataKey="valorBrlCents"
                nameKey="nome"
                innerRadius="55%"
                outerRadius="90%"
                paddingAngle={2}
              >
                {fatias.map((fatia) => (
                  <Cell key={fatia.categoryId} fill={fatia.cor} />
                ))}
              </Pie>
              <Tooltip formatter={(valor: number) => formatBRL(valor)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {fatias.map((fatia) => (
            <li key={fatia.categoryId} className="flex items-center gap-1.5 truncate">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: fatia.cor }}
                aria-hidden
              />
              <span className="truncate">{fatia.nome}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
