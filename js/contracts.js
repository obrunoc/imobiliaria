/*
  Gerador de contrato de locação residencial (modelo da VC Imóveis).
  Tudo acontece no navegador: nada do que é digitado é enviado ou salvo.
*/
window.Contracts = (() => {
  "use strict";

  const { $, $$, esc, digits, money } = U;

  // ---------- Números e datas por extenso ----------
  const UNITS = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const TENS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const HUNDREDS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
  const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

  function below1000(n) {
    if (n === 100) return "cem";
    const parts = [];
    const h = Math.floor(n / 100), r = n % 100;
    if (h) parts.push(HUNDREDS[h]);
    if (r) {
      if (r < 20) parts.push(UNITS[r]);
      else parts.push(TENS[Math.floor(r / 10)] + (r % 10 ? ` e ${UNITS[r % 10]}` : ""));
    }
    return parts.join(" e ");
  }

  function intWords(n) {
    n = Math.floor(n);
    if (n === 0) return "zero";
    const mi = Math.floor(n / 1e6), th = Math.floor(n / 1000) % 1000, rest = n % 1000;
    const groups = [];
    if (mi) groups.push({ v: mi, t: mi === 1 ? "um milhão" : `${below1000(mi)} milhões` });
    if (th) groups.push({ v: th, t: th === 1 ? "mil" : `${below1000(th)} mil` });
    if (rest) groups.push({ v: rest, t: below1000(rest) });
    return groups.reduce((acc, g, i) => {
      if (i === 0) return g.t;
      const last = i === groups.length - 1;
      const joinE = last && (g.v < 100 || g.v % 100 === 0);
      return `${acc}${joinE ? " e " : " "}${g.t}`;
    }, "");
  }

  function moneyWords(value) {
    const cents = Math.round(Number(value) * 100);
    const reais = Math.floor(cents / 100), c = cents % 100;
    const parts = [];
    if (reais) {
      const w = intWords(reais);
      const de = reais >= 1e6 && reais % 1e6 === 0 ? " de" : "";
      parts.push(`${w}${de} ${reais === 1 ? "real" : "reais"}`);
    }
    if (c) parts.push(`${intWords(c)} ${c === 1 ? "centavo" : "centavos"}`);
    return parts.join(" e ") || "zero reais";
  }

  const parseDate = (iso) => { const [y, m, d] = String(iso).split("-").map(Number); return y ? new Date(y, m - 1, d) : null; };
  const dateWords = (dt) => `${dt.getDate()} de ${MONTHS[dt.getMonth()]} de ${dt.getFullYear()}`;
  const addMonths = (dt, n) => { const r = new Date(dt); const day = r.getDate(); r.setMonth(r.getMonth() + n); if (r.getDate() !== day) r.setDate(0); return r; };
  const isoToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

  // ---------- CPF ----------
  function cpfValid(v) {
    const d = digits(v);
    if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
    const calc = (len) => {
      let s = 0;
      for (let i = 0; i < len; i++) s += +d[i] * (len + 1 - i);
      const r = (s * 10) % 11;
      return r === 10 ? 0 : r;
    };
    return calc(9) === +d[9] && calc(10) === +d[10];
  }
  const cpfMask = (v) => {
    const d = digits(v).slice(0, 11);
    return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  };

  // ---------- Formulário ----------
  const PARTIES = [
    { key: "locador", title: "Locador (proprietário)", m: "LOCADOR", f: "LOCADORA" },
    { key: "locatario", title: "Locatário (inquilino)", m: "LOCATÁRIO", f: "LOCATÁRIA" },
    { key: "fiador", title: "Fiador", m: "FIADOR", f: "FIADORA" },
  ];
  const CIVIL = [
    ["solteiro", "solteira", "Solteiro(a)"],
    ["casado", "casada", "Casado(a)"],
    ["divorciado", "divorciada", "Divorciado(a)"],
    ["viúvo", "viúva", "Viúvo(a)"],
    ["em união estável", "em união estável", "União estável"],
  ];
  const INDEXES = {
    IPCA: "IPCA (Índice Nacional de Preços ao Consumidor Amplo)",
    "IGP-M": "IGP-M (Índice Geral de Preços do Mercado)",
  };

  function partyFieldsHTML(p) {
    const id = (f) => `ct-${p.key}-${f}`;
    return `
      <fieldset class="ct-section" data-party="${p.key}">
        <legend>${p.title}</legend>
        ${p.key === "fiador" ? `
          <label class="ct-toggle"><input type="checkbox" id="ct-hasFiador" checked /><span>Contrato com fiador</span></label>` : ""}
        <div class="ct-fields" ${p.key === "fiador" ? 'id="ct-fiador-fields"' : ""}>
          <div class="span-2"><label class="lbl" for="${id("nome")}">Nome completo *</label><input class="input" id="${id("nome")}" data-f="${p.key}.nome" /></div>
          <div>
            <span class="lbl">No contrato aparece como</span>
            <div class="seg seg--sm">
              <label><input type="radio" name="${id("sexo")}" value="M" data-f="${p.key}.sexo" checked /><span>${p.m}</span></label>
              <label><input type="radio" name="${id("sexo")}" value="F" data-f="${p.key}.sexo" /><span>${p.f}</span></label>
            </div>
          </div>
          <div><label class="lbl" for="${id("nac")}">Nacionalidade</label><input class="input" id="${id("nac")}" data-f="${p.key}.nacionalidade" placeholder="brasileiro(a)" /></div>
          <div><label class="lbl" for="${id("civil")}">Estado civil *</label>
            <select class="input" id="${id("civil")}" data-f="${p.key}.civil"><option value="">Selecione</option>${CIVIL.map((c, i) => `<option value="${i}">${c[2]}</option>`).join("")}</select></div>
          <div><label class="lbl" for="${id("prof")}">Profissão *</label><input class="input" id="${id("prof")}" data-f="${p.key}.profissao" /></div>
          <div><label class="lbl" for="${id("rg")}">RG *</label><input class="input" id="${id("rg")}" data-f="${p.key}.rg" placeholder="MG-00.000.000" /></div>
          <div><label class="lbl" for="${id("cpf")}">CPF *</label><input class="input" id="${id("cpf")}" data-f="${p.key}.cpf" inputmode="numeric" placeholder="000.000.000-00" data-cpf /><small class="ct-err" hidden>CPF inválido, confira os números.</small></div>
          <div class="span-2"><label class="lbl" for="${id("end")}">Endereço completo *</label><input class="input" id="${id("end")}" data-f="${p.key}.endereco" placeholder="Rua, nº, bairro, cidade/UF, CEP" /></div>
        </div>
      </fieldset>`;
  }

  // ---------- Estado ----------
  let state = blank();
  let getRentals = () => [];

  function blank() {
    const party = () => ({ nome: "", sexo: "M", nacionalidade: "", civil: "", profissao: "", rg: "", cpf: "", endereco: "" });
    return {
      locador: party(), locatario: party(), fiador: party(), hasFiador: true,
      imovel: "", aluguel: 0, vencimento: "", indice: "IPCA", prazo: 36, inicio: "",
      cidade: "Brazópolis", dataAssinatura: isoToday(),
    };
  }

  const hasData = () => {
    const s = state;
    return ["locador", "locatario", "fiador"].some((k) => s[k].nome || s[k].cpf || s[k].rg) || s.imovel || s.aluguel;
  };

  // ---------- Montagem do texto ----------
  function build(s) {
    const ph = (label) => `<span class="ph">[${label}]</span>`;
    const val = (v, label) => (v === "" || v === null || v === undefined || v === 0 ? ph(label) : esc(v));
    const word = (p) => {
      const F = s[p].sexo === "F";
      const W = PARTIES.find((x) => x.key === p)[F ? "f" : "m"];
      return {
        W, F,
        A: F ? `A ${W}` : `O ${W}`,
        a: F ? `a ${W}` : `o ${W}`,
        da: F ? `da ${W}` : `do ${W}`,
        a_: F ? `à ${W}` : `ao ${W}`,
        g: (m, f) => (F ? f : m),
      };
    };
    const L = word("locador"), T = word("locatario"), FI = word("fiador");

    const qualify = (p) => {
      const d = s[p], w = word(p);
      const nac = d.nacionalidade.trim() || w.g("brasileiro", "brasileira");
      const civil = d.civil === "" ? ph("estado civil") : CIVIL[+d.civil][w.F ? 1 : 0];
      return `<p><strong>${val(d.nome, `nome ${w.da.toLowerCase()}`)}</strong>, ${esc(nac)}, ${civil}, ${val(d.profissao, "profissão")}, ${w.g("portador", "portadora")} da cédula de identidade RG nº ${val(d.rg, "RG")}, ${w.g("inscrito", "inscrita")} no CPF sob o nº ${val(d.cpf, "CPF")}, residente e ${w.g("domiciliado", "domiciliada")} na ${val(d.endereco, "endereço")}, doravante ${w.g("denominado", "denominada")} <strong>${w.W}</strong>.</p>`;
    };

    const rent = Number(s.aluguel) || 0;
    const rentTxt = rent ? `${money(rent)} (${moneyWords(rent)})` : ph("valor do aluguel");
    const start = parseDate(s.inicio);
    const prazo = Number(s.prazo) || 0;
    const end = start && prazo ? addMonths(start, prazo) : null;
    const prazoTxt = prazo ? `${prazo} (${intWords(prazo)}) meses` : ph("prazo em meses");
    const idx = INDEXES[s.indice];
    const exemplo = rent ? Math.floor((rent * 7) / 12 * 100) / 100 : 0;
    const signDate = parseDate(s.dataAssinatura);

    const ORD = ["PRIMEIRA", "SEGUNDA", "TERCEIRA", "QUARTA", "QUINTA", "SEXTA", "SÉTIMA", "OITAVA", "NONA", "DÉCIMA", "DÉCIMA PRIMEIRA", "DÉCIMA SEGUNDA"];
    let n = 0;
    const clause = (title) => `<h3>CLÁUSULA ${ORD[n++]} – ${title}</h3>`;

    const out = [];
    out.push(`<h1>CONTRATO DE LOCAÇÃO DE IMÓVEL RESIDENCIAL</h1>`);
    out.push(qualify("locador"));
    out.push(qualify("locatario"));
    if (s.hasFiador) out.push(qualify("fiador"));
    out.push(`<p>Pelo presente instrumento de contrato, as partes acima citadas ajustam a locação de um imóvel residencial, de acordo com as cláusulas e condições adiante estipuladas e pelas condições de preço, forma e termo de pagamento descritas no presente.</p>`);

    out.push(clause("DO OBJETO"));
    out.push(`<p>1.1. O objeto do presente contrato de locação é o imóvel residencial urbano localizado na ${val(s.imovel, "endereço do imóvel")}. Tal imóvel se destina, exclusivamente, a fins residenciais ${T.da} e de seu núcleo familiar, vedada qualquer outra destinação.</p>`);
    out.push(`<p>1.2. ${L.A} e ${T.a} declaram que o imóvel está nas condições descritas no Laudo de Vistoria anexo, devidamente conferido e assinado por ambas as partes, integrando este contrato para todos os fins. Em caso de divergência, prevalece o disposto no laudo, inclusive quanto às instalações e ao estado de conservação do imóvel.</p>`);

    out.push(clause("DO PREÇO E PAGAMENTO"));
    out.push(`<p>2.1. O valor mensal do aluguel, acordado livremente entre as partes, é de ${rentTxt}.</p>`);
    out.push(`<p>2.2. ${T.A} se compromete a realizar anualmente o pagamento referente ao valor vigente do IPTU do imóvel objeto do presente contrato.</p>`);
    out.push(`<p>2.3. O pagamento do referido aluguel terá vencimento todo dia ${val(s.vencimento, "dia")} do mês corrente, referente ao uso do imóvel.</p>`);
    out.push(`<p>2.4. Se ${T.a} não efetuar o pagamento do aluguel até 5 (cinco) dias após a data firmada, se obriga a pagar multa de 10% sobre o valor do aluguel vigente, mais juros de 1% ao mês.</p>`);
    out.push(`<p>2.5. A inadimplência do valor acordado por dois meses consecutivos será caracterizada como infração contratual e outras sanções legais, resultando na rescisão do contrato e necessidade de desocupação imediata por parte ${T.da}, independentemente de notificação ou aviso.</p>`);
    out.push(`<p>2.6. Haverá reajuste anual do valor do aluguel, que será calculado com base no índice ${idx}.</p>`);
    out.push(`<p>2.7. O pagamento dos valores relativos aos aluguéis não implica renúncia de cobrança de possíveis diferenças de valores, impostos ou encargos que não tenham sido lançados no período devido.</p>`);

    out.push(clause("DA VIGÊNCIA E RENOVAÇÃO"));
    out.push(`<p>3.1. A presente locação terá prazo de ${prazoTxt}, iniciando-se em ${start ? dateWords(start) : ph("data de início")} e encerrando-se em ${end ? dateWords(end) : ph("data de término")}.</p>`);
    out.push(`<p>3.2. Findo o prazo estipulado, o contrato poderá ser prorrogado automaticamente por igual período ou por prazo superior, desde que não haja manifestação contrária de qualquer das partes, no prazo de 30 dias antes do vencimento, nos termos da legislação vigente.</p>`);
    out.push(`<p>3.3. Permanecendo ${T.a} no imóvel após o término do prazo contratual, sem oposição ${L.da}, a locação será considerada prorrogada, mantendo-se todas as cláusulas contratuais pactuadas.</p>`);
    out.push(`<p>3.4. O valor do aluguel será reajustado anualmente, com base no índice ${idx}, independentemente de renovação formal do contrato.</p>`);

    out.push(clause(`DAS OBRIGAÇÕES ${T.da.toUpperCase()}`));
    out.push(`<p>4.1. ${T.A} deverá utilizar o imóvel exclusivamente para fins residenciais, estando ${T.g("proibido", "proibida")} de usá-lo de forma diferente do previsto, sob pena de multa e demais penalidades previstas na legislação pertinente.</p>`);
    out.push(`<p>4.2. ${T.A} deverá pagar o aluguel conforme o prazo e termo estipulados no presente instrumento.</p>`);
    out.push(`<p>4.3. ${T.A} se obriga a zelar pelo imóvel, além de não modificar sua forma externa e/ou interna sem o consentimento prévio e por escrito ${L.da}.</p>`);
    out.push(`<p>4.4. ${T.A} deve primar pela conservação das paredes, do piso e demais adereços contidos no imóvel.</p>`);
    out.push(`<p>4.5. No término indicado, fica ${T.g("obrigado", "obrigada")} ${T.a} a devolver o imóvel ora locado, com todos os acessórios conforme vistoria inicial e laudo anexo, livre e desembaraçado de coisas e pessoas, no estado em que o recebeu e com as paredes devidamente pintadas.</p>`);
    out.push(`<p>4.6. Os custos provenientes do consumo de energia, água, telefone, internet e demais despesas que venham a incidir sobre o imóvel durante a vigência do presente contrato são de responsabilidade ${T.da}.</p>`);
    out.push(`<p>4.7. ${T.A} deverá realizar os pagamentos referentes aos impostos, taxas e tributos que venham a incidir sobre o imóvel objeto do presente instrumento, durante a vigência desse contrato (pagamento do IPTU previsto na cláusula 2.2).</p>`);
    out.push(`<p>4.8. ${T.A}, no ato de entrada, se obriga a transferir a titularidade das contas de energia e água para seu nome, e se responsabiliza por todos os trâmites necessários para que a situação do fornecimento das mesmas no imóvel seja efetivada, sob pena de, não o fazendo, caracterizar-se infração contratual.</p>`);
    out.push(`<p>4.9. ${T.A} se compromete a permitir visitas, para que prováveis compradores do imóvel possam conhecê-lo, desde que a visita seja comunicada previamente, após o exercício do seu direito de preferência, sem interesse.</p>`);
    out.push(`<p>4.10. ${T.A}, quando a pedido do proprietário e/ou nos casos de venda do imóvel, se compromete a desocupá-lo em até 90 (noventa) dias, a contar da data da comunicação.</p>`);
    out.push(`<p>4.11. ${T.A} deve, ao proceder à desocupação do imóvel, encerrar o contrato junto às companhias de Energia Elétrica e Saneamento (CEMIG – COPASA).</p>`);
    out.push(`<p>4.12. Ao proceder à desocupação do imóvel, quando findo ou rescindido este contrato, ou ainda, sempre que solicitado, ${T.a} obriga-se a apresentar devidamente quitados todos os recibos de tarifas de água e energia, até então devidos e cujos pagamentos tenham ficado sob sua responsabilidade. Na hipótese de não haver recebido os respectivos avisos à época da desocupação.</p>`);

    out.push(clause(`DAS OBRIGAÇÕES ${L.da.toUpperCase()}`));
    out.push(`<p>5.1. É de responsabilidade ${L.da} assegurar o direito ${T.da} de usufruir do imóvel com tranquilidade.</p>`);
    out.push(`<p>5.2. ${L.A} deverá entregar o imóvel regularizado perante os órgãos, bem como apto para o fim ao qual se destina.</p>`);

    out.push(clause("DAS VEDAÇÕES"));
    out.push(`<p>6.1. Fica vedado ${T.a_} a sublocação, cessão ou empréstimo do imóvel que lhe foi locado, mediante assinatura do presente instrumento, quer no todo ou em parte, sob pena de rescisão.</p>`);
    out.push(`<p>6.2. Fica ${T.a} responsável pelos danos causados ao imóvel, ocasionados por seus familiares e visitas.</p>`);

    out.push(clause("DAS BENFEITORIAS"));
    out.push(`<p>7.1. Qualquer benfeitoria ou construção que seja destinada ao imóvel objeto deste deverá, de imediato, ser submetida à autorização expressa ${L.da}. Vindo a ser feita qualquer benfeitoria, faculta-se ${L.a_} aceitá-la ou não, restando ${T.a_}, em caso de ${L.a} não aceitá-la, modificar o imóvel da maneira que lhe foi entregue. As benfeitorias, consertos ou reparos farão parte integrante do imóvel, não assistindo ${T.a_} o direito de retenção ou indenização.</p>`);

    out.push(clause("DO DESCUMPRIMENTO E RESCISÃO"));
    out.push(`<p>8.1. Poderá o presente instrumento ser rescindido por qualquer uma das partes, desde que haja a comunicação formal no prazo mínimo de 30 (trinta) dias anteriores ao distrato.</p>`);
    out.push(`<p>8.2. Caso a rescisão seja feita por qualquer uma das partes antes da transcorrência de 12 (doze) meses do presente instrumento, haverá multa rescisória no valor equivalente ao pagamento vigente de uma mensalidade, proporcional ao período que falta para o contrato ser extinto naturalmente, que incidirá sobre a parte responsável pela dissolução.</p>`);
    out.push(`<p><strong>Exemplo:</strong> restando 7 meses para o fim da locação, a parte responsável pela dissolução deverá pagar uma multa no valor de ${rent ? money(exemplo) : ph("valor")}, calculado da seguinte maneira: (período de 12 meses estabelecido – tempo total de permanência = 7 meses) dividido pela vigência de 12 meses de carência contratual, resultando em 0,5833 x ${rent ? money(rent) : ph("aluguel")} = ${rent ? money(exemplo) : ph("valor")}.</p>`);
    out.push(`<p>8.3. Caso ocorra descumprimento de qualquer cláusula do presente contrato, por qualquer uma das partes, este será rescindido imediatamente.</p>`);
    out.push(`<p>8.4. Ocorrerá a rescisão do presente contrato, independentemente de qualquer comunicação prévia ou indenização por parte ${L.da}, quando:</p>`);
    out.push(`<p>a) ocorrendo qualquer sinistro, incêndio ou algo que venha a impossibilitar a posse do imóvel, independentemente de dolo ou culpa ${T.da}, bem como quaisquer outras hipóteses que maculem o imóvel de vício e impossibilitem sua posse;</p>`);
    out.push(`<p>b) em hipótese de desapropriação do imóvel locado.</p>`);

    out.push(clause("DO DIREITO DE PREFERÊNCIA"));
    out.push(`<p>9.1. Fica assegurado ${L.a_} o direito de manifestar o desejo de vender o imóvel objeto do presente instrumento, desde que comunique formalmente, por escrito, ${T.a_}, exercendo o direito de preferência ${T.g("do inquilino", "da inquilina")}. Caso ${T.g("este", "esta")} não apresente interesse, ficará ${T.g("obrigado", "obrigada")} a desocupar o imóvel em até 90 (noventa) dias, a partir da comunicação.</p>`);

    out.push(clause("DA LEGISLAÇÃO PERTINENTE"));
    out.push(`<p>10.1. O presente contrato fica adstrito, no que deixar de regulamentar e couber, à aplicação das seguintes legislações: Lei 8.245/91 (Lei do Inquilinato).</p>`);
    out.push(`<p>10.2. ${T.A} manifesta concordância com a coleta de dados, tratamento e compartilhamento necessários ao cumprimento do contrato, nos termos do art. 7º, inc. V, da Lei Geral de Proteção de Dados (LGPD), para o cumprimento das obrigações gerais, art. 7º, inc. II, assim como os que se fizerem necessários para a proteção ao crédito, art. 7º, inc. V, todos da LGPD.</p>`);

    if (s.hasFiador) {
      const c = n + 1;
      out.push(clause("DA FIANÇA"));
      out.push(`<p>${c}.1. ${FI.A} declara-se responsável ${FI.g("solidário", "solidária")} pelo cumprimento de todas as obrigações assumidas pel${T.F ? "a" : "o"} ${T.W} neste contrato, respondendo pelo pagamento de aluguéis, encargos, multas e demais obrigações contratuais.</p>`);
      out.push(`<p>${c}.2. A responsabilidade ${FI.da} perdurará até a efetiva devolução das chaves do imóvel, ainda que o contrato seja prorrogado por prazo indeterminado.</p>`);
      out.push(`<p>${c}.3. ${FI.A} assume responsabilidade solidária com ${T.a}, podendo ${L.a} cobrar a dívida de qualquer um deles, isoladamente ou em conjunto, sem necessidade de cobrança prévia ${T.da}.</p>`);
      out.push(`<p>${c}.4. A responsabilidade ${FI.da} perdurará até a efetiva devolução das chaves do imóvel, através de assinatura no Termo de Entrega das Chaves na desocupação do imóvel, momento em que se extinguirão todas as suas obrigações futuras, desde que não existam débitos pendentes.</p>`);
      out.push(`<p>${c}.5. Em casos de insolvência, interdição, recuperação judicial, falência ou, ainda, no caso de falecimento ${FI.da}, ${T.a} terá o prazo de 30 dias para apresentar novo fiador (substituto) que corresponda às mesmas condições ${FI.da} atual.</p>`);
    }

    const cf = n + 1;
    out.push(clause("DO FORO"));
    out.push(`<p>${cf}.1. Para dirimir quaisquer controvérsias oriundas do presente contrato, as partes elegem o foro da Comarca de Brazópolis – MG como único competente para dirimir quaisquer questões pertinentes a esse contrato, renunciando a qualquer outro, por mais privilegiado que seja.</p>`);
    out.push(`<p>E por estarem, as partes, justas e contratadas, firmam o presente contrato de locação de imóvel residencial, em três vias de igual teor e forma.</p>`);

    out.push(`<h3>LAUDO DE VISTORIA</h3>`);
    out.push(`<p>Pelo presente instrumento, ${L.W} e ${T.W} acima indicados declaram que o imóvel se encontra em condições adequadas para uso e que o mesmo deverá ser devolvido ao final da locação livre e desembaraçado de pessoas e objetos, no mesmo estado de conservação em que foi recebido, ressalvadas as deteriorações decorrentes do uso normal. As partes poderão, de comum acordo, definir formalmente a realização dos reparos das avarias ocorridas.</p>`);
    out.push(`<p class="date">${val(s.cidade, "cidade")}, ${signDate ? dateWords(signDate) : ph("data")}.</p>`);

    const sign = (p, w) => `<div class="sign"><div class="sign__line"></div><div>${val(s[p].nome, "nome")}</div><div>${w.W}</div></div>`;
    out.push(`<div class="signs">${sign("locador", L)}${sign("locatario", T)}${s.hasFiador ? sign("fiador", FI) : ""}</div>`);
    return out.join("\n");
  }

  // ---------- Pendências ----------
  function missing(s) {
    const m = [];
    const parties = s.hasFiador ? ["locador", "locatario", "fiador"] : ["locador", "locatario"];
    const names = { locador: "locador", locatario: "locatário", fiador: "fiador" };
    for (const p of parties) {
      const d = s[p];
      const miss = [!d.nome && "nome", d.civil === "" && "estado civil", !d.profissao && "profissão", !d.rg && "RG", !d.cpf && "CPF", d.cpf && !cpfValid(d.cpf) && "CPF válido", !d.endereco && "endereço"].filter(Boolean);
      if (miss.length) m.push(`${names[p]}: ${miss.join(", ")}`);
    }
    const c = [!s.imovel && "endereço do imóvel", !s.aluguel && "aluguel", !s.vencimento && "dia do vencimento", !s.prazo && "prazo", !s.inicio && "data de início"].filter(Boolean);
    if (c.length) m.push(`contrato: ${c.join(", ")}`);
    return m;
  }

  // ---------- UI (o módulo Documentos cuida de exportar, limpar e trocar de documento) ----------
  let active = true;
  let propertyId = null;

  function readForm() {
    $$("#ctForm [data-f]").forEach((el) => {
      const [a, b] = el.dataset.f.split(".");
      if (el.type === "radio") { if (el.checked) state[a][b] = el.value; return; }
      if (b) state[a][b] = el.value.trim(); else state[a] = el.value.trim();
    });
    state.aluguel = Number(digits($("#ct-aluguel").value)) / 100 || 0;
    state.hasFiador = $("#ct-hasFiador").checked;
  }

  function writeForm() {
    $$("#ctForm [data-f]").forEach((el) => {
      const [a, b] = el.dataset.f.split(".");
      const v = b ? state[a][b] : state[a];
      if (el.type === "radio") el.checked = el.value === v;
      else el.value = v ?? "";
    });
    $("#ct-aluguel").value = state.aluguel ? money(state.aluguel) : "";
    $("#ct-hasFiador").checked = state.hasFiador;
    $("#ct-fiador-fields").hidden = !state.hasFiador;
    $$("#ctForm [data-cpf]").forEach(checkCpf);
  }

  function checkCpf(el) {
    const bad = digits(el.value).length === 11 && !cpfValid(el.value);
    el.classList.toggle("is-invalid", bad);
    el.parentElement.querySelector(".ct-err").hidden = !bad;
  }

  function renderPreview() {
    if (!active) return;
    $("#ctDoc").innerHTML = build(state);
    const m = missing(state);
    const box = $("#ctMissing");
    box.hidden = m.length === 0;
    box.innerHTML = m.length ? `<strong>Falta preencher:</strong> ${m.map(esc).join(" · ")}` : "";
  }

  function fillRentals() {
    const list = getRentals();
    $("#ct-fromProp").innerHTML = `<option value="">Puxar de um imóvel cadastrado…</option>` +
      list.map((p) => `<option value="${esc(p.id)}">Cód. ${esc(p.code)} · ${esc(p.type)} · ${esc(p.neighborhood)} · ${money(p.price)}/mês</option>`).join("");
  }

  function applyProperty(p) {
    if (!p) return;
    const city = typeof CITY !== "undefined" ? CITY.replace(" - ", "/") : "Brazópolis/MG";
    state.imovel = [p.street, `bairro ${p.neighborhood}`, `na cidade de ${city}`].filter(Boolean).join(", ");
    state.aluguel = Number(p.price) || 0;
    propertyId = p.id;
    writeForm();
    renderPreview();
  }

  function reset() {
    state = blank();
    propertyId = null;
    writeForm();
    renderPreview();
  }

  function fileBase() {
    const who = state.locatario.nome.trim() || "locatario";
    return `Contrato de locação - ${who}`;
  }

  /** Dados básicos para registrar a locação (sem CPF/RG). */
  function rentalDraft() {
    readForm();
    const p = propertyId ? getRentals().find((x) => x.id === propertyId) : null;
    return {
      property: p || undefined,
      property_label: p ? undefined : state.imovel,
      tenant_name: state.locatario.nome,
      owner_name: state.locador.nome,
      rent: state.aluguel,
      due_day: Number(state.vencimento) || "",
      index_name: state.indice,
      start_date: state.inicio,
      months: Number(state.prazo) || 30,
    };
  }

  function init(opts) {
    getRentals = opts.getRentals;

    $("#ctParties").innerHTML = PARTIES.map(partyFieldsHTML).join("");
    $("#ct-indice").innerHTML = Object.keys(INDEXES).map((k) => `<option value="${k}">${k}</option>`).join("");
    writeForm();

    const form = $("#ctForm");
    form.addEventListener("input", (e) => {
      if (e.target.matches("[data-cpf]")) { e.target.value = cpfMask(e.target.value); checkCpf(e.target); }
      if (e.target.id === "ct-aluguel") { const d = digits(e.target.value); e.target.value = d ? money(+d / 100) : ""; }
      readForm();
      renderPreview();
    });
    form.addEventListener("change", (e) => {
      if (e.target.id === "ct-hasFiador") $("#ct-fiador-fields").hidden = !e.target.checked;
      if (e.target.id === "ct-fromProp") { applyProperty(getRentals().find((p) => String(p.id) === e.target.value)); e.target.value = ""; return; }
      readForm();
      renderPreview();
    });
    form.addEventListener("submit", (e) => e.preventDefault());
  }

  return {
    init,
    fillRentals,
    applyProperty,
    reset,
    hasData,
    fileBase,
    rentalDraft,
    setActive(on) { active = on; if (on) renderPreview(); },
    build: () => { readForm(); return build(state); },
    missing: () => { readForm(); return missing(state); },
    helpers: { intWords, moneyWords, cpfValid, cpfMask, parseDate, dateWords, money, isoToday, CIVIL },

  };
})();
