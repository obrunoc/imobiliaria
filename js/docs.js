/*
  Painel → Documentos: contrato de locação (modelo da VC), recibo de aluguel, termo de entrega
  de chaves, autorização de venda e termo de vistoria.
  Tudo é montado no navegador. Nada é salvo nem enviado (fotos da vistoria inclusive).
*/
window.Docs = (() => {
  "use strict";

  let ui;
  let current = "locacao";
  let settings = {};
  const H = () => Contracts.helpers;

  const { esc, money } = U;
  const ph = (label) => `<span class="ph">[${esc(label)}]</span>`;
  const val = (v, label) => (v === "" || v === null || v === undefined || v === 0 ? ph(label) : esc(v));
  const g = (sex, m, f) => (sex === "F" ? f : m);
  const moneyFull = (n) => `${money(n)} (${H().moneyWords(n)})`;
  const dateTxt = (iso, label = "data") => { const d = H().parseDate(iso); return d ? H().dateWords(d) : ph(label); };
  const cityDate = (s) => `<p class="date">${val(s.cidade, "cidade")}, ${dateTxt(s.data)}.</p>`;
  const signs = (list) => `<div class="signs">${list.map(([name, role]) => `<div class="sign"><div class="sign__line"></div><div>${name}</div><div>${role}</div></div>`).join("")}</div>`;
  const vc = () => `<b>VC IMÓVEIS</b>${settings.creci ? `, CRECI ${esc(settings.creci)}` : ""}`;
  const propAddress = (p) => [p.street, `bairro ${p.neighborhood}`, `na cidade de ${(typeof CITY !== "undefined" ? CITY : "Brazópolis - MG").replace(" - ", "/")}`].filter(Boolean).join(", ");

  const STD_NOTICE = "Modelo padrão criado pelo sistema, sem revisão jurídica. Revise com o advogado da imobiliária antes de usar.";
  const ROOM_STATES = ["Novo", "Bom", "Regular", "Ruim"];
  const DEFAULT_ROOMS = ["Sala", "Cozinha", "Quarto 1", "Banheiro", "Área de serviço", "Área externa"];

  // ---------- Modelos ----------
  const DOCS = {
    locacao: { name: "Contrato de locação", notice: "Modelo da VC Imóveis. Os pontos marcados para revisão do advogado continuam valendo." },

    recibo: {
      name: "Recibo de aluguel",
      notice: STD_NOTICE,
      fromProp: (p, s) => { s.imovel = propAddress(p); s.aluguel = Number(p.price) || 0; s.condominio = Number(p.condo) || 0; s.iptu = Number(p.iptu) || 0; },
      sections: [
        { title: "Pagamento", fields: [
          { k: "referencia", label: "Mês de referência *", type: "month", req: true },
          { k: "data", label: "Data do pagamento *", type: "date", req: true, def: () => H().isoToday() },
          { k: "forma", label: "Forma de pagamento", type: "select", options: ["Pix", "Transferência", "Dinheiro", "Boleto", "Cartão"] },
          { k: "numero", label: "Nº do recibo", ph: "Ex.: 015/2026" },
        ] },
        { title: "Pessoas e imóvel", fields: [
          { k: "locatario", label: "Pago por (inquilino) *", req: true },
          { k: "cpf", label: "CPF do inquilino", type: "cpf" },
          { k: "locador", label: "Proprietário (locador) *", req: true, span: 2 },
          { k: "imovel", label: "Endereço do imóvel *", req: true, span: 2 },
        ] },
        { title: "Valores", fields: [
          { k: "aluguel", label: "Aluguel *", type: "money", req: true },
          { k: "condominio", label: "Condomínio", type: "money" },
          { k: "iptu", label: "IPTU", type: "money" },
          { k: "agua", label: "Água / esgoto", type: "money" },
          { k: "multa", label: "Multa e juros por atraso", type: "money" },
          { k: "desconto", label: "Desconto", type: "money" },
          { k: "outros", label: "Outros valores", type: "money" },
          { k: "outrosDesc", label: "Descrição de outros", ph: "Ex.: taxa de lixo" },
          { k: "cidade", label: "Cidade", def: "Brazópolis" },
        ] },
      ],
      fileName: (s) => `Recibo de aluguel - ${s.locatario || "inquilino"} - ${s.referencia || ""}`,
      build(s) {
        const lines = [["Aluguel", s.aluguel], ["Condomínio", s.condominio], ["IPTU", s.iptu], ["Água / esgoto", s.agua], ["Multa e juros por atraso", s.multa], [s.outrosDesc || "Outros", s.outros]].filter(([, v]) => Number(v));
        const total = lines.reduce((t, [, v]) => t + Number(v), 0) - (Number(s.desconto) || 0);
        const [y, m] = String(s.referencia || "").split("-").map(Number);
        const ref = y && m ? `${["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"][m - 1]} de ${y}` : ph("mês de referência");
        return `
          <h1>RECIBO DE ALUGUEL${s.numero ? ` Nº ${esc(s.numero)}` : ""}</h1>
          <p class="big-value">VALOR: ${total > 0 ? money(total) : ph("valor")}</p>
          <p>Recebemos de <b>${val(s.locatario, "nome do inquilino")}</b>${s.cpf ? `, CPF nº ${esc(s.cpf)}` : ""}, a importância de <b>${total > 0 ? moneyFull(total) : ph("valor")}</b>, referente ao aluguel do mês de <b>${ref}</b> e encargos do imóvel situado na ${val(s.imovel, "endereço do imóvel")}, conforme discriminado abaixo:</p>
          <table class="doc-table">
            ${lines.map(([t, v]) => `<tr><td>${esc(t)}</td><td class="num">${money(v)}</td></tr>`).join("") || `<tr><td colspan="2">${ph("valores")}</td></tr>`}
            ${Number(s.desconto) ? `<tr><td>Desconto</td><td class="num">− ${money(s.desconto)}</td></tr>` : ""}
            <tr class="total"><td>Total recebido</td><td class="num">${total > 0 ? money(total) : "-"}</td></tr>
          </table>
          <p>Pagamento realizado por ${esc(s.forma === "Pix" || !s.forma ? "Pix" : String(s.forma).toLowerCase())} em ${dateTxt(s.data, "data do pagamento")}. Pelo que damos plena quitação dos valores acima discriminados.</p>
          ${cityDate(s)}
          ${signs([[vc(), `por conta e ordem de ${val(s.locador, "proprietário")}`]])}`;
      },
    },

    chaves: {
      name: "Entrega de chaves",
      notice: STD_NOTICE,
      fromProp: (p, s) => { s.imovel = propAddress(p); },
      sections: [
        { title: "Inquilino", fields: [
          { k: "locatario", label: "Nome do inquilino *", req: true, span: 2 },
          { k: "sexo", label: "No termo aparece como", type: "sex", m: "LOCATÁRIO", f: "LOCATÁRIA" },
          { k: "cpf", label: "CPF *", type: "cpf", req: true },
        ] },
        { title: "Imóvel e entrega", fields: [
          { k: "imovel", label: "Endereço do imóvel *", req: true, span: 2 },
          { k: "locador", label: "Proprietário (locador) *", req: true, span: 2 },
          { k: "data", label: "Data da entrega *", type: "date", req: true, def: () => H().isoToday() },
          { k: "qtd", label: "Quantidade de chaves *", type: "number", req: true, def: 2 },
          { k: "agua", label: "Leitura do relógio de água", ph: "Opcional" },
          { k: "energia", label: "Leitura do relógio de energia", ph: "Opcional" },
          { k: "obs", label: "Observações", type: "textarea", span: 2 },
          { k: "cidade", label: "Cidade", def: "Brazópolis" },
        ] },
      ],
      fileName: (s) => `Termo de entrega de chaves - ${s.locatario || "inquilino"}`,
      build(s) {
        const W = g(s.sexo, "LOCATÁRIO", "LOCATÁRIA");
        const qtd = Number(s.qtd) || 0;
        return `
          <h1>TERMO DE ENTREGA DE CHAVES</h1>
          <p>Pelo presente termo, <b>${val(s.locatario, "nome do inquilino")}</b>, ${g(s.sexo, "inscrito", "inscrita")} no CPF sob o nº ${val(s.cpf, "CPF")}, na qualidade de ${W} do imóvel situado na ${val(s.imovel, "endereço do imóvel")}, de propriedade de ${val(s.locador, "proprietário")}, entrega nesta data à ${vc()} ${qtd ? `${qtd} (${H().intWords(qtd)}) ${qtd === 1 ? "chave" : "chaves"}` : ph("quantidade de chaves")} do referido imóvel, encerrando a sua ocupação.</p>
          <p>A entrega das chaves será formalizada após a vistoria final do imóvel. Eventuais débitos de aluguéis, encargos, contas de consumo ou reparos apurados na vistoria final, nos termos do contrato de locação, poderão ser cobrados posteriormente, não implicando este termo quitação de tais valores.</p>
          ${s.agua || s.energia ? `<p>Leituras dos medidores na data da entrega: ${[s.agua && `água ${esc(s.agua)}`, s.energia && `energia ${esc(s.energia)}`].filter(Boolean).join("; ")}.</p>` : ""}
          ${s.obs ? `<p><b>Observações:</b> ${esc(s.obs)}</p>` : ""}
          ${cityDate(s)}
          ${signs([[val(s.locatario, "nome"), W], [vc(), "IMOBILIÁRIA"]])}`;
      },
    },

    autorizacao: {
      name: "Autorização de venda",
      notice: `${STD_NOTICE} Confira também o percentual de honorários com a tabela do CRECI-MG.`,
      fromProp: (p, s) => { s.imovel = propAddress(p); if (p.mode === "comprar") s.valor = Number(p.price) || 0; },
      sections: [
        { title: "Proprietário", fields: [
          { k: "nome", label: "Nome completo *", req: true, span: 2 },
          { k: "sexo", label: "No documento aparece como", type: "sex", m: "PROPRIETÁRIO", f: "PROPRIETÁRIA" },
          { k: "nacionalidade", label: "Nacionalidade", ph: "brasileiro(a)" },
          { k: "civil", label: "Estado civil *", type: "civil", req: true },
          { k: "profissao", label: "Profissão *", req: true },
          { k: "rg", label: "RG *", req: true },
          { k: "cpf", label: "CPF *", type: "cpf", req: true },
          { k: "endereco", label: "Endereço completo *", req: true, span: 2 },
        ] },
        { title: "Imóvel e condições", fields: [
          { k: "imovel", label: "Endereço do imóvel *", req: true, span: 2 },
          { k: "matricula", label: "Matrícula no cartório", ph: "Opcional" },
          { k: "valor", label: "Valor de venda *", type: "money", req: true },
          { k: "comissao", label: "Honorários (%) *", type: "number", req: true, def: 6, step: "0.5" },
          { k: "prazo", label: "Prazo (dias) *", type: "number", req: true, def: 90 },
          { k: "exclusiva", label: "Exclusividade", type: "select", options: [["sim", "Com exclusividade"], ["nao", "Sem exclusividade"]], def: "sim" },
          { k: "data", label: "Data", type: "date", def: () => H().isoToday() },
          { k: "cidade", label: "Cidade", def: "Brazópolis" },
        ] },
      ],
      fileName: (s) => `Autorização de venda - ${s.nome || "proprietário"}`,
      build(s) {
        const W = g(s.sexo, "PROPRIETÁRIO", "PROPRIETÁRIA");
        const civil = s.civil === "" || s.civil === undefined ? ph("estado civil") : H().CIVIL[+s.civil][s.sexo === "F" ? 1 : 0];
        const nac = String(s.nacionalidade || "").trim() || g(s.sexo, "brasileiro", "brasileira");
        const pct = Number(s.comissao) || 0;
        const pctTxt = pct ? (Number.isInteger(pct) ? `${pct}% (${H().intWords(pct)} por cento)` : `${String(pct).replace(".", ",")}%`) : ph("percentual");
        const prazo = Number(s.prazo) || 0;
        const excl = s.exclusiva !== "nao";
        const art = g(s.sexo, "o", "a");
        return `
          <h1>AUTORIZAÇÃO DE VENDA${excl ? " COM EXCLUSIVIDADE" : ""}</h1>
          <p><b>${val(s.nome, "nome do proprietário")}</b>, ${esc(nac)}, ${civil}, ${val(s.profissao, "profissão")}, ${g(s.sexo, "portador", "portadora")} da cédula de identidade RG nº ${val(s.rg, "RG")}, ${g(s.sexo, "inscrito", "inscrita")} no CPF sob o nº ${val(s.cpf, "CPF")}, residente e ${g(s.sexo, "domiciliado", "domiciliada")} na ${val(s.endereco, "endereço")}, doravante ${g(s.sexo, "denominado", "denominada")} <b>${W}</b>, autoriza a ${vc()}, com sede em Brazópolis – MG, doravante denominada <b>IMOBILIÁRIA</b>, a promover a venda do imóvel abaixo descrito, nas seguintes condições:</p>
          <h3>1. DO IMÓVEL</h3>
          <p>Imóvel situado na ${val(s.imovel, "endereço do imóvel")}${s.matricula ? `, objeto da matrícula nº ${esc(s.matricula)}` : ""}.</p>
          <h3>2. DO PREÇO</h3>
          <p>Valor de venda de ${Number(s.valor) ? moneyFull(s.valor) : ph("valor de venda")}, podendo ser negociado mediante concordância expressa d${art} ${W}.</p>
          <h3>3. DA DIVULGAÇÃO</h3>
          <p>Fica a IMOBILIÁRIA autorizada a anunciar o imóvel em seu site, redes sociais e portais imobiliários, a fotografá-lo, a colocar placa e a acompanhar interessados em visitas.</p>
          <h3>4. DOS HONORÁRIOS</h3>
          <p>Concretizada a venda, ${art} ${W} pagará à IMOBILIÁRIA honorários de ${pctTxt} sobre o valor efetivo da venda, devidos na assinatura do compromisso de compra e venda ou do documento que formalize o negócio.</p>
          <h3>5. DO PRAZO${excl ? " E DA EXCLUSIVIDADE" : ""}</h3>
          <p>Esta autorização é concedida ${excl ? "com" : "sem"} exclusividade, pelo prazo de ${prazo ? `${prazo} (${H().intWords(prazo)}) dias` : ph("prazo")}, a contar da data de sua assinatura.${excl ? ` Durante esse prazo, os honorários serão devidos ainda que a venda seja realizada diretamente pel${art} ${W} ou por terceiros, nos termos do art. 726 do Código Civil.` : ""}</p>
          <p>Os honorários também serão devidos se, após o término do prazo, a venda for realizada com interessado apresentado pela IMOBILIÁRIA durante a vigência desta autorização, nos termos do art. 727 do Código Civil.</p>
          <h3>6. DO FORO</h3>
          <p>Fica eleito o foro da Comarca de Brazópolis – MG para dirimir quaisquer questões relativas a esta autorização.</p>
          ${cityDate(s)}
          ${signs([[val(s.nome, "nome"), W], [vc(), "IMOBILIÁRIA"]])}`;
      },
    },

    vistoria: {
      name: "Termo de vistoria",
      notice: `${STD_NOTICE} As fotos aparecem no PDF; no Word, só o texto.`,
      fromProp: (p, s) => { s.imovel = propAddress(p); },
      sections: [
        { title: "Vistoria", fields: [
          { k: "tipo", label: "Tipo de vistoria", type: "select", options: [["entrada", "Entrada (início da locação)"], ["saida", "Saída (fim da locação)"]], def: "entrada" },
          { k: "data", label: "Data da vistoria *", type: "date", req: true, def: () => H().isoToday() },
          { k: "imovel", label: "Endereço do imóvel *", req: true, span: 2 },
          { k: "locatario", label: "Inquilino *", req: true },
          { k: "locador", label: "Proprietário *", req: true },
          { k: "chaves", label: "Chaves entregues", type: "number" },
          { k: "agua", label: "Leitura da água", ph: "Opcional" },
          { k: "energia", label: "Leitura da energia", ph: "Opcional" },
          { k: "cidade", label: "Cidade", def: "Brazópolis" },
        ] },
        { title: "Cômodos", rooms: true },
        { title: "Observações gerais", fields: [{ k: "obs", label: "Observações", type: "textarea", span: 2 }] },
      ],
      fileName: (s) => `Termo de vistoria de ${s.tipo === "saida" ? "saída" : "entrada"} - ${s.locatario || "imóvel"}`,
      build(s) {
        const saida = s.tipo === "saida";
        const rooms = (s.rooms || []).filter((r) => r.nome);
        return `
          <h1>TERMO DE VISTORIA DE ${saida ? "SAÍDA" : "ENTRADA"}</h1>
          <p><b>Imóvel:</b> ${val(s.imovel, "endereço do imóvel")}<br/>
          <b>Inquilino:</b> ${val(s.locatario, "inquilino")}<br/>
          <b>Proprietário:</b> ${val(s.locador, "proprietário")}<br/>
          <b>Data da vistoria:</b> ${dateTxt(s.data, "data")}</p>
          <p>As partes abaixo assinadas realizaram, nesta data, a vistoria de ${saida ? "saída" : "entrada"} do imóvel acima, constatando o estado de conservação descrito a seguir:</p>
          ${rooms.length ? rooms.map((r) => `
            <div class="room">
              <h3>${esc(r.nome)}</h3>
              <p><b>Estado geral:</b> ${esc(r.estado || "Bom")}${r.obs ? `. ${esc(r.obs)}` : "."}</p>
              ${r.photos.length ? `<div class="photos">${r.photos.map((ph2) => `<img src="${esc(ph2.url)}" alt="${esc(r.nome)}" />`).join("")}</div>` : ""}
            </div>`).join("") : `<p>${ph("cômodos")}</p>`}
          ${s.chaves || s.agua || s.energia ? `<p>${[s.chaves && `Chaves entregues: ${esc(s.chaves)}`, s.agua && `leitura da água: ${esc(s.agua)}`, s.energia && `leitura da energia: ${esc(s.energia)}`].filter(Boolean).join("; ")}.</p>` : ""}
          ${s.obs ? `<p><b>Observações gerais:</b> ${esc(s.obs)}</p>` : ""}
          <p>As partes declaram estar de acordo com as informações deste termo${saida ? "" : ", que passa a integrar o contrato de locação"}.</p>
          ${cityDate(s)}
          ${signs([[val(s.locatario, "inquilino"), "LOCATÁRIO(A)"], [val(s.locador, "proprietário"), "LOCADOR(A)"], [vc(), "IMOBILIÁRIA"]])}`;
      },
    },
  };

  // ---------- Estado dos modelos genéricos ----------
  const state = {};
  const fieldsOf = (id) => DOCS[id].sections.flatMap((sec) => sec.fields || []);
  function blank(id) {
    const s = {};
    fieldsOf(id).forEach((f) => { s[f.k] = typeof f.def === "function" ? f.def() : (f.def ?? (f.type === "money" ? 0 : "")); });
    if (f_hasSex(id)) s.sexo = s.sexo || "M";
    if (id === "vistoria") s.rooms = DEFAULT_ROOMS.map((n) => ({ id: Math.random().toString(36).slice(2), nome: n, estado: "Bom", obs: "", photos: [] }));
    return s;
  }
  const f_hasSex = (id) => fieldsOf(id).some((f) => f.type === "sex");
  const hasData = (id) => {
    if (id === "locacao") return Contracts.hasData();
    const s = state[id];
    if (!s) return false;
    const b = blank(id);
    return fieldsOf(id).some((f) => String(s[f.k] ?? "") !== String(b[f.k] ?? "")) || (s.rooms || []).some((r) => r.obs || r.photos.length);
  };

  // ---------- Formulário genérico ----------
  function fieldHTML(f, s) {
    const id = `dg-${f.k}`;
    const v = s[f.k] ?? "";
    const span = f.span === 2 ? ' class="span-2"' : "";
    if (f.type === "sex") {
      return `<div${span}><span class="lbl">${esc(f.label)}</span><div class="seg seg--sm">
        <label><input type="radio" name="${id}" value="M" data-k="${f.k}" ${v !== "F" ? "checked" : ""} /><span>${esc(f.m)}</span></label>
        <label><input type="radio" name="${id}" value="F" data-k="${f.k}" ${v === "F" ? "checked" : ""} /><span>${esc(f.f)}</span></label></div></div>`;
    }
    let input;
    if (f.type === "select" || f.type === "civil") {
      const opts = f.type === "civil" ? [["", "Selecione"], ...H().CIVIL.map((c, i) => [String(i), c[2]])] : f.options.map((o) => (Array.isArray(o) ? o : [o, o]));
      input = `<select class="input" id="${id}" data-k="${f.k}">${opts.map(([ov, ol]) => `<option value="${esc(ov)}" ${String(v) === String(ov) ? "selected" : ""}>${esc(ol)}</option>`).join("")}</select>`;
    } else if (f.type === "textarea") {
      input = `<textarea class="input textarea" id="${id}" data-k="${f.k}" rows="3">${esc(v)}</textarea>`;
    } else if (f.type === "money") {
      input = `<input class="input" id="${id}" data-k="${f.k}" data-dmoney inputmode="numeric" placeholder="R$ 0,00" value="${Number(v) ? esc(money(v)) : ""}" />`;
    } else if (f.type === "cpf") {
      input = `<input class="input" id="${id}" data-k="${f.k}" data-dcpf inputmode="numeric" placeholder="000.000.000-00" value="${esc(v)}" /><small class="ct-err" hidden>CPF inválido, confira os números.</small>`;
    } else {
      const type = { date: "date", month: "month", number: "number" }[f.type] || "text";
      input = `<input class="input" id="${id}" type="${type}" data-k="${f.k}" value="${esc(v)}" ${f.ph ? `placeholder="${esc(f.ph)}"` : ""} ${f.step ? `step="${f.step}"` : ""} ${type === "number" ? 'min="0"' : ""} />`;
    }
    return `<div${span}><label class="lbl" for="${id}">${esc(f.label)}</label>${input}</div>`;
  }

  function roomsHTML(s) {
    return `<div class="rooms">${s.rooms.map((r, i) => `
      <div class="room-edit" data-room="${i}">
        <div class="room-edit__row">
          <input class="input" value="${esc(r.nome)}" data-rk="nome" placeholder="Cômodo" aria-label="Nome do cômodo" />
          <select class="input" data-rk="estado" aria-label="Estado">${ROOM_STATES.map((o) => `<option ${o === r.estado ? "selected" : ""}>${o}</option>`).join("")}</select>
          <button type="button" class="icon-btn" data-room-del aria-label="Remover cômodo">${ui.icon("trash")}</button>
        </div>
        <textarea class="input textarea" rows="2" data-rk="obs" placeholder="Paredes, piso, portas, janelas, louças, instalações…">${esc(r.obs)}</textarea>
        <div class="room-edit__photos">
          ${r.photos.map((p, j) => `<span class="room-photo"><img src="${esc(p.url)}" alt="" /><button type="button" data-photo-del="${j}" aria-label="Remover foto">${ui.icon("close")}</button></span>`).join("")}
          <label class="room-photo room-photo--add">${ui.icon("plus")}<span>Fotos</span><input type="file" accept="image/*" multiple data-room-photos /></label>
        </div>
      </div>`).join("")}</div>
      <button type="button" class="btn btn--outline btn--sm" data-room-add>${ui.icon("plus")} Adicionar cômodo</button>`;
  }

  function renderForm() {
    const d = DOCS[current];
    const s = state[current];
    const props = ui.items.filter((p) => Store.PUBLIC_STATUS.includes(p.status) || p.status === "alugado" || p.status === "vendido");
    ui.$("#docForm").innerHTML = `
      ${d.fromProp ? `<fieldset class="ct-section"><legend>Imóvel cadastrado</legend>
        <label class="sr-only" for="dg-fromProp">Puxar dados de um imóvel cadastrado</label>
        <select class="input" id="dg-fromProp"><option value="">Puxar de um imóvel cadastrado…</option>${props.map((p) => `<option value="${esc(p.id)}">Cód. ${esc(p.code)} · ${esc(p.type)} · ${esc(p.neighborhood)}</option>`).join("")}</select></fieldset>` : ""}
      ${d.sections.map((sec) => `
        <fieldset class="ct-section"><legend>${esc(sec.title)}</legend>
          ${sec.rooms ? roomsHTML(s) : `<div class="ct-fields">${sec.fields.map((f) => fieldHTML(f, s)).join("")}</div>`}
        </fieldset>`).join("")}`;
    ui.$$("#docForm [data-dcpf]").forEach(checkCpf);
  }

  function checkCpf(el) {
    const bad = ui.digits(el.value).length === 11 && !H().cpfValid(el.value);
    el.classList.toggle("is-invalid", bad);
    el.parentElement.querySelector(".ct-err").hidden = !bad;
  }

  function missing(id) {
    if (id === "locacao") return Contracts.missing();
    const s = state[id];
    const miss = fieldsOf(id).filter((f) => f.req && (s[f.k] === "" || s[f.k] === undefined || s[f.k] === 0)).map((f) => f.label.replace(" *", "").toLowerCase());
    fieldsOf(id).filter((f) => f.type === "cpf" && s[f.k] && !H().cpfValid(s[f.k])).forEach(() => miss.push("CPF válido"));
    return miss.length ? [miss.join(", ")] : [];
  }

  const buildCurrent = () => (current === "locacao" ? Contracts.build() : DOCS[current].build(state[current]));
  const fileBase = () => (current === "locacao" ? Contracts.fileBase() : DOCS[current].fileName(state[current])).replace(/[\\/:*?"<>|]/g, "").trim();

  function renderPreview() {
    const { $ } = ui;
    $("#ctDoc").innerHTML = buildCurrent();
    const m = missing(current);
    $("#ctMissing").hidden = m.length === 0;
    $("#ctMissing").innerHTML = m.length ? `<strong>Falta preencher:</strong> ${m.map(esc).join(" · ")}` : "";
  }

  function renderTypes() {
    ui.$("#docTypes").innerHTML = Object.entries(DOCS).map(([id, d]) =>
      `<button type="button" role="tab" class="status-tab ${id === current ? "is-active" : ""}" aria-selected="${id === current}" data-doc="${id}">${esc(d.name)}</button>`).join("");
    const notice = DOCS[current].notice;
    ui.$("#docNotice").hidden = !notice;
    ui.$("#docNotice").textContent = notice || "";
    ui.$("#ctRental").hidden = current !== "locacao";
  }

  function select(id) {
    current = id;
    const isLoc = id === "locacao";
    ui.$("#ctForm").hidden = !isLoc;
    ui.$("#docForm").hidden = isLoc;
    Contracts.setActive(isLoc);
    if (!isLoc) {
      if (!state[id]) state[id] = blank(id);
      renderForm();
    } else {
      Contracts.fillRentals();
    }
    renderTypes();
    renderPreview();
  }

  // ---------- Exportação ----------
  const DOC_CSS = `
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; line-height: 1.5; color: #000; }
    h1 { font-size: 14pt; text-align: center; margin: 0 0 18pt; }
    h3 { font-size: 11pt; text-align: center; margin: 16pt 0 8pt; }
    p { text-align: justify; margin: 0 0 8pt; }
    p.date { margin-top: 18pt; }
    p.big-value { text-align: right; font-size: 13pt; font-weight: bold; }
    table.doc-table { width: 100%; border-collapse: collapse; margin: 6pt 0 12pt; }
    table.doc-table td { border-bottom: 1px solid #999; padding: 4pt 0; }
    table.doc-table td.num { text-align: right; }
    table.doc-table tr.total td { font-weight: bold; border-bottom: 2px solid #000; }
    .room h3 { text-align: left; }
    .signs { margin-top: 36pt; }
    .sign { text-align: center; margin: 0 auto 30pt; width: 300pt; page-break-inside: avoid; }
    .sign__line { border-top: 1px solid #000; margin-bottom: 4pt; height: 1pt; }
    .ph { background: #ffef9a; }
  `;

  function downloadWord() {
    let body = buildCurrent();
    if (/<img /.test(body)) body = body.replace(/<div class="photos">[\s\S]*?<\/div>/g, "<p><i>(Fotos na versão em PDF.)</i></p>");
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${esc(fileBase())}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>@page { size: 21cm 29.7cm; margin: 2.5cm 2.5cm 2.5cm 3cm; } ${DOC_CSS}</style></head>
<body>${body}</body></html>`;
    const blob = new Blob(["﻿", html], { type: "application/msword" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${fileBase()}.doc`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function printPDF() {
    const area = ui.$("#ctPrint");
    area.innerHTML = buildCurrent();
    const prevTitle = document.title;
    document.title = fileBase();
    document.body.classList.add("is-printing");
    const done = () => {
      document.body.classList.remove("is-printing");
      document.title = prevTitle;
      area.innerHTML = "";
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    window.print();
  }

  async function exportWith(fn) {
    const m = missing(current);
    if (m.length && !(await ui.confirmBox("O documento ainda tem campos em branco. Eles vão sair marcados em amarelo. Continuar mesmo assim?", "Continuar"))) return;
    fn();
  }

  function freePhotos(id) {
    (state[id]?.rooms || []).forEach((r) => r.photos.forEach((p) => URL.revokeObjectURL(p.url)));
  }

  async function clearCurrent() {
    if (hasData(current) && !(await ui.confirmBox(`Apagar todos os dados preenchidos em "${DOCS[current].name}"?`, "Apagar"))) return;
    if (current === "locacao") Contracts.reset();
    else { freePhotos(current); state[current] = blank(current); renderForm(); }
    renderPreview();
  }

  function clearAll() {
    Contracts.reset();
    Object.keys(state).forEach((id) => { freePhotos(id); delete state[id]; });
    if (current !== "locacao") { state[current] = blank(current); renderForm(); }
    renderPreview();
  }

  // ---------- Eventos ----------
  function onGenericInput(e) {
    const s = state[current];
    const t = e.target;
    if (t.dataset.rk) {
      const r = s.rooms[+t.closest("[data-room]").dataset.room];
      r[t.dataset.rk] = t.value;
    } else if (t.dataset.k) {
      if (t.matches("[data-dmoney]")) { const d = ui.digits(t.value); t.value = d ? money(+d / 100) : ""; s[t.dataset.k] = d ? +d / 100 : 0; }
      else if (t.matches("[data-dcpf]")) { t.value = H().cpfMask(t.value); s[t.dataset.k] = t.value; checkCpf(t); }
      else if (t.type === "radio") { if (t.checked) s[t.dataset.k] = t.value; }
      else s[t.dataset.k] = t.value;
    }
    renderPreview();
  }

  function init(ctx) {
    ui = ctx;
    const { $ } = ui;
    Contracts.init({ getRentals: () => ui.items.filter((p) => p.mode === "alugar") });
    Store.getSettings().then((s) => { settings = s; renderPreview(); });

    $("#docTypes").addEventListener("click", (e) => { const b = e.target.closest("[data-doc]"); if (b) select(b.dataset.doc); });
    const form = $("#docForm");
    form.addEventListener("input", onGenericInput);
    form.addEventListener("change", (e) => {
      const t = e.target;
      if (t.id === "dg-fromProp") {
        const p = ui.items.find((x) => String(x.id) === t.value);
        if (p) { DOCS[current].fromProp(p, state[current]); renderForm(); renderPreview(); }
        return;
      }
      if (t.matches("[data-room-photos]")) {
        const r = state[current].rooms[+t.closest("[data-room]").dataset.room];
        [...t.files].filter((f) => f.type.startsWith("image/")).forEach((f) => r.photos.push({ url: URL.createObjectURL(f), name: f.name }));
        renderForm();
        renderPreview();
        return;
      }
      onGenericInput(e);
    });
    form.addEventListener("click", (e) => {
      const s = state[current];
      if (e.target.closest("[data-room-add]")) {
        s.rooms.push({ id: Math.random().toString(36).slice(2), nome: `Cômodo ${s.rooms.length + 1}`, estado: "Bom", obs: "", photos: [] });
      } else if (e.target.closest("[data-room-del]")) {
        const [r] = s.rooms.splice(+e.target.closest("[data-room]").dataset.room, 1);
        r.photos.forEach((p) => URL.revokeObjectURL(p.url));
      } else if (e.target.closest("[data-photo-del]")) {
        const b = e.target.closest("[data-photo-del]");
        const r = s.rooms[+b.closest("[data-room]").dataset.room];
        const [p] = r.photos.splice(+b.dataset.photoDel, 1);
        URL.revokeObjectURL(p.url);
      } else return;
      renderForm();
      renderPreview();
    });
    form.addEventListener("submit", (e) => e.preventDefault());

    $("#ctWord").addEventListener("click", () => exportWith(downloadWord));
    $("#ctPdf").addEventListener("click", () => exportWith(printPDF));
    $("#ctClear").addEventListener("click", clearCurrent);
    $("#ctRental").addEventListener("click", () => Rentals.openNew(Contracts.rentalDraft()));
    $("#ctShowPreview").addEventListener("click", () => $("#ctPreviewWrap").scrollIntoView({ behavior: "smooth" }));

    window.addEventListener("beforeunload", (e) => {
      if (["locacao", ...Object.keys(state)].some(hasData)) { e.preventDefault(); e.returnValue = ""; }
    });
    select("locacao");
  }

  function open(prop) {
    if (prop) {
      select("locacao");
      Contracts.applyProperty(prop);
    } else {
      select(current);
    }
  }

  return { init, open, clearAll };
})();
