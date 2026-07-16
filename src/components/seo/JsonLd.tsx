/**
 * Renderiza um bloco JSON-LD (<script type="application/ld+json">).
 * Presente no HTML renderizado no servidor (SSR) para que crawlers de busca
 * e motores de IA leiam os dados estruturados sem executar JavaScript.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // JSON serializado — seguro; escapamos `<` para evitar quebra de tag.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
