import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { CANDIDATS, JOURS, FRAIS_PAR_PRESENCE } from "@/data/candidats";

const fmt = (n: number) => n.toLocaleString("fr-FR").replace(/\u202f|,/g, " ");

export function genererPdfPresences(presences: Set<string>) {
  const doc = new jsPDF({ orientation: "landscape" });

  doc.setFontSize(18);
  doc.text("Registre des présences", 14, 18);
  doc.setFontSize(10);
  doc.text("Bootcamp — 21 au 25 septembre 2026", 14, 25);
  doc.text("Frais de déplacement : 5 000 BIF par journée de présence", 14, 31);

  let totalPresences = 0;

  const body = CANDIDATS.map((c) => {
    const marques = JOURS.map((j) => {
      const present = presences.has(`${c.id}|${j.iso}`);
      if (present) totalPresences += 1;
      return present ? "X" : "-";
    });
    const jours = marques.filter((m) => m === "X").length;
    return [
      c.nom,
      c.groupe,
      ...marques,
      String(jours),
      `${fmt(jours * FRAIS_PAR_PRESENCE)} BIF`,
    ];
  });

  autoTable(doc, {
    startY: 38,
    head: [
      [
        "Candidat",
        "Groupe",
        ...JOURS.map((j) => `${j.jour} ${j.num}`),
        "Jours",
        "Montant",
      ],
    ],
    body,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [255, 46, 77], textColor: 255 },
    columnStyles: { 8: { halign: "right" } },
    foot: [
      [
        "TOTAL",
        "",
        "",
        "",
        "",
        "",
        "",
        String(totalPresences),
        `${fmt(totalPresences * FRAIS_PAR_PRESENCE)} BIF`,
      ],
    ],
    footStyles: { fillColor: [20, 20, 31], textColor: 255 },
  });

  doc.save("presences-bootcamp-2026.pdf");
}
