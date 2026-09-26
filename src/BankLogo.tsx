import { useState } from "react";
import type { Bank } from "./directory";
const logos: Record<string, string> = {
  ABC: "abc.png", ABCBRASIL: "abc.png", ASA: "asa.png", AUDAX: "audax.jpeg", BADESUL: "badesul.png", BRASIL: "banco-do-brasil.jpg", DOBRASIL: "banco-do-brasil.jpg", BB: "banco-do-brasil.jpg", BANRISUL: "banrisul.png", BNDES: "bndes.jpg", BRADESCO: "bradesco.png", BRDE: "brde.jpg", BTG: "btg.png", BTGPACTUAL: "btg.png", BV: "bv.png", CAIXA: "caixa.png", CAIXAECONOMICAFEDERAL: "caixa.png", CASHME: "cashme.png", DAYCOVAL: "daycoval.png", FINEP: "finep.jpg", GALLERIA: "galleria.png", ITAU: "itau.png", ITAUUNIBANCO: "itau.png", SOFISA: "sofisa.jpg", REDASSET: "redasset.png", RNX: "rnx.png", RNXFIDC: "rnx.png", SAFRA: "safra.jpg", SANTANDER: "santander.png", SENFF: "senff.jpg", SICOOB: "sicoob.jpg", SICREDI: "sicredi.jpg", UNICRED: "unicred.png", VIACREDI: "viacredi.png",
};
export function bankLogoPath(name: string) {
  const key = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/^BANCO\s+/, "").replace(/[^A-Z0-9]/g, "");
  const file = logos[key] || (key === "GALLERIABANK" ? "galleria.png" : "");
  return file ? `/institutions/${file}` : "";
}
export function BankLogo({ bank, name = "" }: { bank?: Bank; name?: string }) {
  const label = bank?.name || name, src = bankLogoPath(label) || bank?.logoUrl || "";
  const [failed, setFailed] = useState("");
  return <span className={`institution-logo ${src && failed !== src ? "with-image" : ""}`} style={{background: src && failed !== src ? "#fff" : bank?.color || "#18334a"}}>{src && failed !== src ? <img src={src} alt={`Logo ${label}`} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(src)} /> : label.slice(0, 2).toUpperCase()}</span>;
}
