/* Listas usadas pelo site e pelo painel + imóveis de exemplo do modo demonstração. */
const IMG = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=70`;

const P = {
  houseModern: IMG("photo-1600596542815-ffad4c1539a9"),
  housePool: IMG("photo-1512917774080-9991f1c4c750"),
  houseWhite: IMG("photo-1600585154340-be6161a56a0c"),
  houseClassic: IMG("photo-1564013799919-ab600027ffc6"),
  houseSuburb: IMG("photo-1580587771525-78b9dba3b914"),
  houseGarden: IMG("photo-1523217582562-09d0def993a6"),
  aptLiving: IMG("photo-1502672260266-1c1ef2d93688"),
  aptLiving2: IMG("photo-1522708323590-d24dbb6b0267"),
  aptBright: IMG("photo-1560448204-e02f11c3d0e2"),
  aptCozy: IMG("photo-1493809842364-78817add7ffb"),
  kitchen: IMG("photo-1484154218962-a197022b5858"),
  kitchen2: IMG("photo-1600566753190-17f0baa2a6c3"),
  bedroom: IMG("photo-1505691938895-1758d7feb511"),
  living3: IMG("photo-1560185007-cde436f6a4d0"),
  interior: IMG("photo-1600607687939-ce8a6c25118c"),
  building: IMG("photo-1545324418-cc1a3fa10c00"),
  studio: IMG("photo-1554995207-c18c203602cb"),
  decor: IMG("photo-1586023492125-27b2c045efd7"),
};

const CITY = "Brazópolis - MG";

// Sugestões de bairro no painel (a equipe também pode digitar um bairro novo).
const NEIGHBORHOODS = ["Centro", "Jardim América", "Vila Nova", "Jardim Primavera", "Bela Vista", "São José"];

const PROPERTY_TYPES = ["Casa", "Apartamento", "Kitnet", "Terreno", "Chácara", "Sala comercial"];

const AMENITIES = ["Aceita pet", "Mobiliado", "Quintal", "Churrasqueira", "Piscina", "Varanda", "Garagem coberta", "Área de serviço"];

// Dados do site editáveis no painel (aba "Site"). Estes são os valores iniciais.
window.DEFAULT_SETTINGS = {
  whatsapp: "5535000000000",
  phone: "(35) 00000-0000",
  email: "",
  address: "Rua Principal, 100 – Centro, Brazópolis - MG",
  hours: "Seg a sex, 8h às 18h · Sáb, 8h às 12h",
  creci: "00000-J",
  instagram: "",
  googleReviewsUrl: "",
  about: "A VC Imóveis ajuda famílias de Brazópolis e região a encontrar, comprar, vender e alugar imóveis com segurança. Conhecemos cada bairro da cidade e acompanhamos você em todas as etapas, da primeira visita à entrega das chaves.",
  team: [],
  testimonials: [],
};

// Usados só no modo demonstração, na primeira vez que o site abre.
window.SEED_PROPERTIES = [
  { id: 1, status: "disponivel", mode: "alugar", type: "Casa", neighborhood: "Jardim América", street: "Rua das Acácias", price: 1500, condo: 0, iptu: 60, area: 90, beds: 2, baths: 1, parking: 1, amenities: ["Quintal", "Aceita pet"], images: [P.houseClassic, P.living3, P.kitchen, P.bedroom], daysAgo: 1, description: "Casa térrea com quintal nos fundos, cozinha ampla e garagem coberta. Rua calma, perto da escola e do mercado." },
  { id: 2, featured: true, status: "disponivel", mode: "comprar", type: "Casa", neighborhood: "Jardim Primavera", street: "Rua dos Ipês", price: 480000, condo: 0, iptu: 90, area: 160, beds: 3, baths: 2, parking: 2, amenities: ["Churrasqueira", "Quintal", "Varanda"], images: [P.houseSuburb, P.living3, P.kitchen2, P.bedroom], daysAgo: 3, description: "Casa com suíte, varanda na frente e área de churrasqueira coberta. Terreno de 300 m² com espaço para piscina." },
  { id: 3, status: "disponivel", mode: "alugar", type: "Apartamento", neighborhood: "Centro", street: "Av. Brasil", price: 1200, condo: 250, iptu: 40, area: 58, beds: 2, baths: 1, parking: 1, amenities: ["Varanda"], images: [P.aptBright, P.kitchen, P.bedroom, P.building], daysAgo: 0, description: "Apartamento no 3º andar com sacada, a duas quadras da praça. Prédio com elevador e vaga demarcada." },
  { id: 4, featured: true, status: "disponivel", mode: "comprar", type: "Casa", neighborhood: "Bela Vista", street: "Rua Projetada 4", price: 890000, condo: 0, iptu: 150, area: 240, beds: 3, baths: 4, parking: 3, amenities: ["Piscina", "Churrasqueira", "Quintal", "Aceita pet"], images: [P.houseModern, P.interior, P.kitchen2, P.housePool], daysAgo: 5, description: "Casa nova com 3 suítes, piscina e espaço gourmet integrado. Acabamento de primeira e pé-direito alto na sala." },
  { id: 5, status: "alugado", mode: "alugar", type: "Kitnet", neighborhood: "Centro", street: "Rua XV de Novembro", price: 750, condo: 0, iptu: 0, area: 30, beds: 1, baths: 1, parking: 0, amenities: ["Mobiliado"], images: [P.studio, P.decor], daysAgo: 2, description: "Kitnet mobiliada, água inclusa no aluguel. Ideal para estudante ou para quem trabalha no centro." },
  { id: 6, status: "disponivel", mode: "comprar", type: "Apartamento", neighborhood: "Centro", street: "Rua Sete de Setembro", price: 320000, condo: 280, iptu: 55, area: 70, beds: 2, baths: 2, parking: 1, amenities: ["Varanda"], images: [P.aptLiving, P.kitchen, P.bedroom, P.building], daysAgo: 8, description: "Apartamento reformado com suíte, cozinha planejada e sacada. Aceita financiamento." },
  { id: 7, old_price: 2500, status: "disponivel", mode: "alugar", type: "Casa", neighborhood: "Vila Nova", street: "Rua São Paulo", price: 2300, condo: 0, iptu: 90, area: 140, beds: 3, baths: 2, parking: 2, amenities: ["Churrasqueira", "Quintal", "Aceita pet"], images: [P.houseGarden, P.living3, P.kitchen2, P.bedroom], daysAgo: 4, description: "Casa ampla com 3 quartos (1 suíte), churrasqueira e quintal gramado. Garagem para 2 carros." },
  { id: 8, status: "disponivel", mode: "comprar", type: "Terreno", neighborhood: "São José", street: "Rua Ribeirão Preto", price: 140000, condo: 0, iptu: 25, area: 300, beds: 0, baths: 0, parking: 0, amenities: [], images: [P.houseGarden], daysAgo: 6, description: "Terreno plano de 12 x 25 m, pronto para construir. Rua asfaltada com água, luz e esgoto." },
  { id: 9, featured: true, status: "disponivel", mode: "alugar", type: "Apartamento", neighborhood: "Jardim América", street: "Rua das Palmeiras", price: 1650, condo: 300, iptu: 50, area: 72, beds: 2, baths: 2, parking: 1, amenities: ["Varanda", "Aceita pet", "Piscina"], images: [P.aptLiving2, P.bedroom, P.kitchen, P.building], daysAgo: 7, description: "Apartamento com suíte em condomínio com piscina e salão de festas. Portaria eletrônica." },
  { id: 10, status: "vendido", mode: "comprar", type: "Casa", neighborhood: "Vila Nova", street: "Rua Bahia", price: 265000, condo: 0, iptu: 45, area: 85, beds: 2, baths: 1, parking: 1, amenities: ["Quintal"], images: [P.houseWhite, P.living3, P.kitchen], daysAgo: 2, description: "Casa térrea bem conservada, ótima primeira moradia. Aceita financiamento pela Caixa." },
  { id: 11, status: "reservado", mode: "alugar", type: "Casa", neighborhood: "Bela Vista", street: "Rua Projetada 2", price: 3400, condo: 0, iptu: 130, area: 210, beds: 3, baths: 3, parking: 2, amenities: ["Piscina", "Churrasqueira", "Quintal"], images: [P.housePool, P.interior, P.kitchen2, P.bedroom], daysAgo: 10, description: "Casa com piscina e área gourmet, 3 quartos sendo 2 suítes. Bairro novo e tranquilo." },
  { id: 12, status: "disponivel", mode: "comprar", type: "Apartamento", neighborhood: "Jardim América", street: "Rua das Palmeiras", price: 410000, condo: 300, iptu: 70, area: 75, beds: 2, baths: 2, parking: 1, amenities: ["Piscina", "Varanda", "Aceita pet"], images: [P.aptCozy, P.aptLiving2, P.bedroom, P.building], daysAgo: 1, description: "Apartamento novo, nunca habitado, em condomínio com piscina. Sacada com churrasqueira." },
];
