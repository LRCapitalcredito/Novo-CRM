import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, BookOpen, ChevronDown, ChevronUp, X } from "lucide-react";

// Apresentação e retratos da LR Capital, conferidos no site institucional.
const partners = [
  { name: "Ricardo Reis", short: "Ricardo", role: "Diretor Executivo", photo: "socio-ricardo-web.jpg", focus: "Estratégia e crédito estruturado", description: "Ricardo conduz a estratégia da LR Capital, a estruturação das operações e o relacionamento com clientes e instituições. Sua trajetória em vendas e desenvolvimento de negócios se conecta à experiência prática em negociação e defesa de crédito.", position: "50% 36%" },
  { name: "Lucas Macedo", short: "Lucas", role: "Diretor de Operações", photo: "socio-lucas-web.jpg", focus: "Análise e execução", description: "Lucas traz a experiência do sistema cooperativo de crédito para a leitura financeira e o desenho das alternativas. Sua atuação conecta o relacionamento institucional à organização e ao acompanhamento das operações.", position: "50% 27%" },
  { name: "Giovani Moura de Souza", short: "Giovani", role: "Diretor Comercial", photo: "socio-giovani-web.jpg", focus: "Negócios e relacionamento", description: "Giovani atua no desenvolvimento de mercado e na originação de oportunidades. Sua experiência comercial aproxima a LR Capital dos empresários, qualifica demandas e desenvolve conexões com parceiros e soluções.", position: "50% 18%" },
];

export function TeamCover({ onRoutine }: { onRoutine: () => void }) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("lr-cover-collapsed") === "true"; } catch { return false; }
  });
  const [panel, setPanel] = useState<number | "story" | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (panel === null) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, [panel !== null]);
  const toggle = () => setCollapsed((value) => {
    try { localStorage.setItem("lr-cover-collapsed", String(!value)); } catch { /* Preferência opcional. */ }
    return !value;
  });
  return <>
    <section className={`team-cover editorial-cover ${collapsed ? "is-collapsed" : ""}`} aria-label="Apresentação da LR Capital">
      <div className="cover-topline">
        <div className="cover-identity">
          <span className="cover-logo"><img src="/brand/lr-capital-oficial.png" alt="Logo LR Capital" width="52" height="44" /></span>
          <div><span>LR CAPITAL</span><small>ESTRATÉGIA FINANCEIRA EMPRESARIAL</small></div>
        </div>
        <div className="cover-controls">
          <button onClick={() => setPanel("story")}><BookOpen size={15} /> Nossa história</button>
          <button onClick={toggle} aria-expanded={!collapsed} aria-controls="cover-content" aria-label={collapsed ? "Expandir capa" : "Recolher capa"}>
            {collapsed ? <ChevronDown size={17} /> : <ChevronUp size={17} />}
          </button>
        </div>
      </div>
      <div id="cover-content" hidden={collapsed}>
        <div className="editorial-layout">
          <div className="editorial-message">
            <span className="editorial-kicker">VISÃO INTEGRADA. ATUAÇÃO PRÓXIMA.</span>
            <h2>Capital, estratégia<br /> e <em>relacionamento.</em></h2>
            <p>Cada cliente, uma estratégia.<br /> Cada operação, um próximo passo claro.</p>
            <button className="cover-cta" onClick={onRoutine}>Organizar minha rotina <ArrowRight size={16} /></button>
          </div>
          <div className="editorial-photo">
            <img src="/brand/parceria-editorial.webp" alt="Cena ilustrativa de uma parceria empresarial, em um escritório ao pôr do sol" width="1536" height="1024" fetchPriority="high" />
          </div>
        </div>
        <div className="editorial-team">
          <p>Três trajetórias.<br /><strong>Uma visão compartilhada.</strong></p>
          <div className="editorial-partners">
            {partners.map((p, i) => <button key={p.name} onClick={() => setPanel(i)} aria-label={`Conhecer ${p.name}`} className="editorial-partner">
              <img src={`/brand/${p.photo}`} alt="" style={{ objectPosition: p.position }} width="48" height="56" />
              <span><strong>{p.short}</strong><small>{p.role}</small></span>
              <ArrowUpRight size={15} aria-hidden="true" />
            </button>)}
          </div>
        </div>
      </div>
    </section>
    {panel !== null && <dialog ref={dialog} className="brand-dialog" aria-labelledby="brand-dialog-title" onCancel={() => setPanel(null)} onClick={(e) => { if (e.target === e.currentTarget) setPanel(null); }}>
      <div className="brand-dialog-inner">
        <header><span className="eyebrow">CONHEÇA A LR CAPITAL</span><button className="icon-button" aria-label="Fechar apresentação" onClick={() => setPanel(null)}><X size={21} /></button></header>
        <nav className="brand-dialog-tabs" aria-label="Apresentação institucional">
          <button aria-pressed={panel === "story"} onClick={() => setPanel("story")}>Nossa história</button>
          {partners.map((p, i) => <button key={p.name} aria-pressed={panel === i} onClick={() => setPanel(i)}>{p.short}</button>)}
        </nav>
        {panel === "story" ? <div className="brand-story">
          <h2 id="brand-dialog-title">Trajetórias que se encontram.<br /><em>Uma atuação que se completa.</em></h2>
          <p>A LR Capital reúne experiência comercial, vivência no sistema financeiro cooperativo e desenvolvimento de negócios. A complementaridade de seus sócios dá forma a uma atuação próxima das empresas, do diagnóstico à negociação e à execução.</p>
          <p>O trabalho integra leitura financeira, organização de informações, estruturação de capital e relacionamento com instituições e especialistas. O objetivo é transformar a realidade de cada empresa em alternativas claras e em próximos passos acompanhados.</p>
          <div className="brand-method">{["Diagnosticar", "Planejar", "Preparar", "Executar", "Acompanhar"].map((s, i) => <span key={s}><b>0{i + 1}</b>{s}</span>)}</div>
        </div> : <div className="partner-profile">
          <img src={`/brand/${partners[panel].photo}`} alt={partners[panel].name} style={{ objectPosition: partners[panel].position }} />
          <div><span className="eyebrow">{partners[panel].role}</span><h2 id="brand-dialog-title">{partners[panel].name}</h2><h3>{partners[panel].focus}</h3><p>{partners[panel].description}</p></div>
        </div>}
        <footer><span>Apresentação institucional LR Capital</span><a href="https://www.lrcapitalcredito.com/" target="_blank" rel="noreferrer">Visitar nosso site <ArrowUpRight size={14} /></a></footer>
      </div>
    </dialog>}
  </>;
}
