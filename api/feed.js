// /portais/vrsync.xml → arquivo de integração no padrão VRSync (Grupo OLX: ZAP Imóveis, Viva Real e OLX).
// O portal lê este endereço de tempos em tempos e atualiza os anúncios sozinho.
const { config, rest, esc, origin, settings } = require("./_lib");

const TYPES = {
  Casa: ["Residential", "Residential / Home"],
  Apartamento: ["Residential", "Residential / Apartment"],
  Kitnet: ["Residential", "Residential / Kitnet"],
  Terreno: ["Residential", "Residential / Land Lot"],
  "Chácara": ["Residential", "Residential / Farm Ranch"],
  "Sala comercial": ["Commercial", "Commercial / Office"],
};

const x = (s) => esc(s).replace(/&#39;/g, "&apos;");

module.exports = async (req, res) => {
  const base = origin(req);
  const cfg = config();
  let rows = [];
  let site = {};
  if (cfg) {
    try {
      [rows, site] = await Promise.all([
        rest(cfg, "properties?select=*&status=eq.disponivel&order=code.asc"),
        settings(cfg),
      ]);
    } catch { rows = []; }
  }
  const phone = String(site.phone || "").replace(/\D/g, "");

  const listings = rows.map((p) => {
    const [usage, ptype] = TYPES[p.type] || ["Residential", "Residential / Home"];
    const rent = p.mode === "alugar";
    const images = (p.media || []).filter((m) => m.type === "image");
    return `    <Listing>
      <ListingID>${x(p.code)}</ListingID>
      <Title>${x(`${p.type} ${rent ? "para alugar" : "à venda"} no bairro ${p.neighborhood}`)}</Title>
      <TransactionType>${rent ? "For Rent" : "For Sale"}</TransactionType>
      <PublicationType>STANDARD</PublicationType>
      <DetailViewUrl>${x(`${base}/imovel/${p.code}`)}</DetailViewUrl>
      <Media>
${images.map((m, i) => `        <Item medium="image"${i === 0 ? ' primary="true"' : ""}>${x(m.url)}</Item>`).join("\n")}
      </Media>
      <Details>
        <UsageType>${usage}</UsageType>
        <PropertyType>${x(ptype)}</PropertyType>
        <Description><![CDATA[${String(p.description || "").replace(/]]>/g, "]] >")}]]></Description>
        ${rent ? `<RentalPrice currency="BRL" period="Monthly">${Math.round(p.price)}</RentalPrice>` : `<ListPrice currency="BRL">${Math.round(p.price)}</ListPrice>`}
        ${Number(p.condo) ? `<PropertyAdministrationFee currency="BRL">${Math.round(p.condo)}</PropertyAdministrationFee>` : ""}
        ${Number(p.iptu) ? `<YearlyTax currency="BRL">${Math.round(p.iptu * 12)}</YearlyTax>` : ""}
        ${Number(p.area) ? `<LivingArea unit="square metres">${Math.round(p.area)}</LivingArea>` : ""}
        <Bedrooms>${Number(p.beds) || 0}</Bedrooms>
        <Bathrooms>${Number(p.baths) || 0}</Bathrooms>
        <Garage type="Parking Space">${Number(p.parking) || 0}</Garage>
        <Features>
${(p.amenities || []).map((a) => `          <Feature>${x(a)}</Feature>`).join("\n")}
        </Features>
      </Details>
      <Location displayAddress="Neighborhood">
        <Country abbreviation="BR">Brasil</Country>
        <State abbreviation="MG">Minas Gerais</State>
        <City>Brazópolis</City>
        <Neighborhood>${x(p.neighborhood)}</Neighborhood>
        <Address>${x(p.street)}</Address>
      </Location>
      <ContactInfo>
        <Name>VC Imóveis</Name>
        ${site.email ? `<Email>${x(site.email)}</Email>` : ""}
        ${phone ? `<Telephone>${x(phone)}</Telephone>` : ""}
      </ContactInfo>
    </Listing>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ListingDataFeed xmlns="http://www.vivareal.com/schemas/1.0/VRSync" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.vivareal.com/schemas/1.0/VRSync http://xml.vivareal.com/vrsync.xsd">
  <Header>
    <Provider>VC Imóveis</Provider>
    ${site.email ? `<Email>${x(site.email)}</Email>` : ""}
    <ContactName>VC Imóveis</ContactName>
    <PublishDate>${new Date().toISOString()}</PublishDate>
    ${phone ? `<Telephone>${x(phone)}</Telephone>` : ""}
  </Header>
  <Listings>
${listings.join("\n")}
  </Listings>
</ListingDataFeed>
`;
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=1800");
  res.status(200).send(xml);
};
