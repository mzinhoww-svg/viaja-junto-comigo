// Pix BR Code (EMV estático) — gera "copia e cola" + payload para QR.
// Sem dependências externas. Spec: BCB Manual do BR Code.

function tlv(id: string, value: string) {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

function crc16(payload: string) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

// Sanitiza para BR Code: ASCII, sem acentos, maiúsculas (campos de merchant aceitam só ASCII).
function ascii(s: string, max: number) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 .,\-]/g, "")
    .slice(0, max)
    .trim();
}

export type PixArgs = {
  pixKey: string;
  amountCents: number;
  merchantName: string;
  merchantCity: string;
  txid?: string;
};

export function buildPixPayload({ pixKey, amountCents, merchantName, merchantCity, txid }: PixArgs): string {
  const gui = tlv("00", "br.gov.bcb.pix");
  const key = tlv("01", pixKey);
  const merchantAccount = tlv("26", gui + key);
  const amount = (amountCents / 100).toFixed(2);
  const cleanTxid = (txid ?? "***").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";
  const additional = tlv("62", tlv("05", cleanTxid));

  const partial =
    tlv("00", "01") +
    merchantAccount +
    tlv("52", "0000") +
    tlv("53", "986") +
    tlv("54", amount) +
    tlv("58", "BR") +
    tlv("59", ascii(merchantName, 25) || "RECEBEDOR") +
    tlv("60", ascii(merchantCity, 15) || "BRASIL") +
    additional +
    "6304";
  return partial + crc16(partial);
}
