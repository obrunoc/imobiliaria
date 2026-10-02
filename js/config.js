/*
  Configuração do site VC Imóveis.

  Enquanto supabaseUrl e supabaseAnonKey estiverem vazios, o site roda em MODO DEMONSTRAÇÃO:
  os imóveis cadastrados no painel ficam salvos só no navegador de quem cadastrou.

  Para colocar no ar de verdade, siga o arquivo CONFIGURAR.md e cole aqui os dados do Supabase
  (Project Settings → API → Project URL e anon public key).
*/
window.VC_CONFIG = {
  supabaseUrl: "",
  supabaseAnonKey: "",

  whatsapp: "5535000000000", // DDI + DDD + número, só dígitos
};
