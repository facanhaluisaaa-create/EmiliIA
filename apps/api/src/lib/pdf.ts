import PDFDocument from "pdfkit";

export const PDF_COLORS = { forest: "#1D2924", sage: "#A9B8A3", muted: "#65776C", line: "#E3E6E0", cream: "#F5F5F0" };

export interface PdfHeader {
  title: string;
  subtitle?: string;
  clinic: { name: string; professional: string; crp: string };
}

/** Cria um documento PDF com cabeçalho padrão do consultório; retorna o doc e uma promessa do buffer. */
export function createPdf(header: PdfHeader): { doc: PDFKit.PDFDocument; done: Promise<Buffer> } {
  const doc = new PDFDocument({ size: "A4", margin: 48, bufferPages: true, info: { Title: header.title, Author: header.clinic.name } });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.rect(0, 0, doc.page.width, 92).fill(PDF_COLORS.forest);
  doc.fillColor("#F5F5F0").font("Times-Roman").fontSize(26).text("emilIA", 48, 30);
  doc.font("Helvetica").fontSize(9).fillColor(PDF_COLORS.sage).text(header.clinic.name.toUpperCase(), 48, 62, { characterSpacing: 1.5 });
  doc.fontSize(9).fillColor("#F5F5F0").text(`${header.clinic.professional} · ${header.clinic.crp}`, 48, 30, { align: "right", width: doc.page.width - 96 });
  doc.fillColor(PDF_COLORS.forest).font("Times-Roman").fontSize(20).text(header.title, 48, 112);
  if (header.subtitle) doc.font("Helvetica").fontSize(10).fillColor(PDF_COLORS.muted).text(header.subtitle, 48, 138);
  doc.moveDown(2);
  doc.font("Helvetica").fillColor(PDF_COLORS.forest).fontSize(10);
  return { doc, done };
}

export interface TableColumn {
  label: string;
  width: number;
  align?: "left" | "right";
}

/** Encurta o texto com reticências até caber na largura disponível. */
function fit(doc: PDFKit.PDFDocument, text: string, width: number): string {
  if (doc.widthOfString(text) <= width) return text;
  let t = text;
  while (t.length > 1 && doc.widthOfString(`${t}…`) > width) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/** Desenha uma tabela simples com cabeçalho e linhas alternadas, quebrando páginas automaticamente. */
export function drawTable(doc: PDFKit.PDFDocument, columns: TableColumn[], rows: string[][], startY?: number): number {
  const x0 = 48;
  let y = startY ?? doc.y + 8;
  const rowH = 20;
  const available = doc.page.width - 96;
  const total = columns.reduce((s, c) => s + c.width, 0);
  if (total > available) columns = columns.map((c) => ({ ...c, width: (c.width / total) * available }));
  const header = () => {
    doc.rect(x0, y, doc.page.width - 96, rowH).fill(PDF_COLORS.cream);
    let x = x0;
    doc.fillColor(PDF_COLORS.muted).font("Helvetica-Bold").fontSize(8);
    for (const c of columns) {
      doc.text(fit(doc, c.label.toUpperCase(), c.width - 12), x + 6, y + 6, { width: c.width - 12, align: c.align ?? "left", lineBreak: false });
      x += c.width;
    }
    y += rowH;
  };
  header();
  doc.font("Helvetica").fontSize(9).fillColor(PDF_COLORS.forest);
  rows.forEach((r, i) => {
    if (y + rowH > doc.page.height - 60) {
      doc.addPage();
      y = 48;
      header();
      doc.font("Helvetica").fontSize(9).fillColor(PDF_COLORS.forest);
    }
    if (i % 2 === 1) doc.rect(x0, y, doc.page.width - 96, rowH).fill("#FAFAF7");
    doc.fillColor(PDF_COLORS.forest);
    let x = x0;
    r.forEach((cell, j) => {
      const c = columns[j];
      doc.text(fit(doc, cell, c.width - 12), x + 6, y + 6, { width: c.width - 12, align: c.align ?? "left", lineBreak: false });
      x += c.width;
    });
    doc.moveTo(x0, y + rowH).lineTo(doc.page.width - 48, y + rowH).strokeColor(PDF_COLORS.line).lineWidth(0.5).stroke();
    y += rowH;
  });
  doc.x = x0;
  doc.y = y + 8;
  return doc.y;
}

export function pdfFooter(doc: PDFKit.PDFDocument, text: string): void {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.font("Helvetica").fontSize(8).fillColor(PDF_COLORS.muted).text(`${text} · página ${i + 1} de ${range.count}`, 48, doc.page.height - 40, { align: "center", width: doc.page.width - 96 });
  }
}
