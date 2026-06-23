import { useEffect, useRef } from "react";

interface OTPInputProps {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
}

/**
 * Campo de código estilo OTP: N caixas, auto-avanço, backspace volta,
 * paste inteligente, teclado numérico no mobile e suporte ao
 * autocomplete "one-time-code" (auto-preenchimento via SMS no iOS/Android).
 */
export function OTPInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled,
  autoFocus = true,
}: OTPInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (value.length === length && onComplete) onComplete(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function setAt(i: number, d: string) {
    const next = (value.slice(0, i) + d + value.slice(i + 1)).slice(0, length);
    onChange(next.replace(/\D/g, ""));
  }

  function handleChange(i: number, raw: string) {
    const digits = raw.replace(/\D/g, "");
    if (!digits) {
      // limpou
      const next = (value.slice(0, i) + value.slice(i + 1)).slice(0, length);
      onChange(next);
      return;
    }
    if (digits.length === 1) {
      setAt(i, digits);
      refs.current[Math.min(i + 1, length - 1)]?.focus();
    } else {
      // colou múltiplos
      const merged = (value.slice(0, i) + digits).slice(0, length);
      onChange(merged);
      const nextIdx = Math.min(merged.length, length - 1);
      refs.current[nextIdx]?.focus();
    }
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      if (value[i]) {
        const next = value.slice(0, i) + value.slice(i + 1);
        onChange(next);
        e.preventDefault();
      } else if (i > 0) {
        refs.current[i - 1]?.focus();
        const next = value.slice(0, i - 1) + value.slice(i);
        onChange(next);
        e.preventDefault();
      }
    } else if (e.key === "ArrowLeft" && i > 0) {
      refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < length - 1) {
      refs.current[i + 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (text) {
      onChange(text);
      const idx = Math.min(text.length, length - 1);
      setTimeout(() => refs.current[idx]?.focus(), 0);
      e.preventDefault();
    }
  }

  return (
    <div
      className="flex gap-2 justify-between"
      role="group"
      aria-label="Código de acesso"
    >
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          pattern="\d*"
          maxLength={1}
          disabled={disabled}
          value={value[i] ?? ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.currentTarget.select()}
          aria-label={`Dígito ${i + 1}`}
          className="w-12 h-14 md:w-14 md:h-16 rounded-2xl border-2 border-[var(--color-border)] focus:border-coral focus:outline-none text-center font-display font-extrabold text-2xl md:text-3xl text-navy bg-white disabled:opacity-50 disabled:bg-[var(--color-muted)] transition"
        />
      ))}
    </div>
  );
}
