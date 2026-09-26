// IDs from the original CRM identify the requested document and its period.
// A file's upload date alone never establishes the accounting period.
export function legacyTemplateKey(id:string) {
 return id.replace(/^\d+_/, "");
}
export function legacyMinimumChecklist(year=new Date().getFullYear()) {
 const rows=[
  ["contrato_social","Contrato social consolidado","Cadastro","Atual"],
  ...[year-2,year-1,year].map(y=>[`fat_${y}`,`Faturamento ${y}`,"Faturamento",y===year?`${y} até o último mês fechado`:String(y)]),
  ...[year-2,year-1].flatMap(y=>[[`balanco_${y}`,`Balanço ${y}`,"Contábil",String(y)],[`dre_${y}`,`DRE ${y}`,"Contábil",String(y)]]),
  [`balancete_${year}`,`Balancete ${year}`,"Contábil",`Corte recente de ${year}`],
  [`dre_${year}`,`DRE acumulada ${year}`,"Contábil",`Corte recente de ${year}`],
  ["endividamento","Mapa de endividamento e contratos","Endividamento","Posição atual"],
  ["pedido","Finalidade e condições pretendidas","Outros","Operação atual"],
 ];
 return rows.map(([key,title,category,period])=>({key:`legacy-${key}`,title,category,period,requirement:"Confirmar entidade, período, integridade e exigência com a instituição."}));
}
