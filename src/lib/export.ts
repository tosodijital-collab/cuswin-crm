// CSV ve Excel dışa aktarma (tarayıcıda üretilir).

import { formatPhone } from "@/lib/domain/contact-info";
import { CALL_STATUS_LABELS, CATEGORY_LABELS, SALES_STAGE_LABELS, SOURCE_LABELS } from "@/lib/domain/labels";
import { toDateStr } from "@/lib/domain/time";
import type { Business } from "@/lib/domain/types";

export const EXPORT_COLUMNS: [header: string, value: (b: Business) => string][] = [
  ["İşletme", (b) => b.name],
  ["Kategoriler", (b) => b.categories.map((c) => CATEGORY_LABELS[c]).join(", ")],
  ["Telefon", (b) => formatPhone(b.phone) ?? ""],
  ["E-posta", (b) => b.email ?? ""],
  ["Web sitesi", (b) => b.website ?? ""],
  ["İlçe", (b) => b.district ?? ""],
  ["Adres", (b) => b.address ?? ""],
  ["Kişiler", (b) => b.contacts.map((c) => (c.role ? `${c.name} (${c.role})` : c.name)).join("; ")],
  ["Arama durumu", (b) => CALL_STATUS_LABELS[b.callStatus]],
  ["Satış aşaması", (b) => SALES_STAGE_LABELS[b.salesStage]],
  ["Sonraki işlem", (b) => [b.nextActionDate, b.nextActionTime].filter(Boolean).join(" ")],
  ["Kontrol notu", (b) => b.reviewReason ?? ""],
  ["Kaynak", (b) => SOURCE_LABELS[b.source]],
  ["Kaynak kimliği", (b) => b.sourceId ?? ""],
  ["Bulunma tarihi", (b) => toDateStr(new Date(b.foundAt))],
  ["Son doğrulama", (b) => (b.verifiedAt ? toDateStr(new Date(b.verifiedAt)) : "")],
];

/** Excel'in formül olarak çalıştırabileceği hücreleri etkisizleştirir (CSV injection). */
export function safeCell(v: string) {
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

export function toCsv(rows: Business[]): string {
  const esc = (v: string) => {
    const s = safeCell(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [EXPORT_COLUMNS.map(([h]) => h), ...rows.map((b) => EXPORT_COLUMNS.map(([, f]) => f(b)))];
  // BOM: Excel Türkçe karakterleri doğru açsın
  return "﻿" + lines.map((l) => l.map(esc).join(",")).join("\r\n");
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadCsv(rows: Business[]) {
  download(new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }), `cuswin-kayitlar-${toDateStr(new Date())}.csv`);
}

export async function downloadXlsx(rows: Business[]) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Kayıtlar");
  ws.columns = EXPORT_COLUMNS.map(([header]) => ({ header, width: header === "İşletme" || header === "Adres" ? 40 : 18 }));
  ws.getRow(1).font = { bold: true };
  for (const b of rows) ws.addRow(EXPORT_COLUMNS.map(([, f]) => safeCell(f(b))));
  const buffer = await wb.xlsx.writeBuffer();
  download(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `cuswin-kayitlar-${toDateStr(new Date())}.xlsx`,
  );
}
