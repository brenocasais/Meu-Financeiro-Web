export interface TemplateSubcategory {
  name: string;
  icon: string;
}

export interface TemplateCategory {
  name: string;
  icon: string;
  subcategories: TemplateSubcategory[];
}

export const CATEGORY_TEMPLATES: TemplateCategory[] = [
  {
    name: 'Moradia',
    icon: '🏠',
    subcategories: [
      { name: 'Aluguel', icon: '🏘️' },
      { name: 'Financiamento', icon: '🏦' },
      { name: 'Condomínio', icon: '🏢' },
      { name: 'Energia Elétrica', icon: '💡' },
      { name: 'Água', icon: '💧' },
      { name: 'Gás', icon: '🔥' },
      { name: 'Internet', icon: '🌐' },
    ],
  },
  {
    name: 'Alimentação',
    icon: '🍽️',
    subcategories: [
      { name: 'Supermercado', icon: '🛒' },
      { name: 'Restaurante', icon: '🍔' },
      { name: 'Delivery', icon: '🛵' },
      { name: 'Padaria', icon: '🥖' },
    ],
  },
  {
    name: 'Transporte',
    icon: '🚗',
    subcategories: [
      { name: 'Combustível', icon: '⛽' },
      { name: 'Transporte Público', icon: '🚌' },
      { name: 'Apps de Transporte', icon: '🚕' },
      { name: 'Manutenção', icon: '🔧' },
      { name: 'Estacionamento', icon: '🅿️' },
    ],
  },
  {
    name: 'Saúde',
    icon: '🏥',
    subcategories: [
      { name: 'Plano de Saúde', icon: '⚕️' },
      { name: 'Farmácia', icon: '💊' },
      { name: 'Consultas', icon: '🩺' },
      { name: 'Exames', icon: '🔬' },
      { name: 'Academia', icon: '💪' },
    ],
  },
  {
    name: 'Educação',
    icon: '📚',
    subcategories: [
      { name: 'Mensalidade Escolar', icon: '🎓' },
      { name: 'Cursos', icon: '📖' },
      { name: 'Material Escolar', icon: '✏️' },
      { name: 'Livros', icon: '📕' },
    ],
  },
  {
    name: 'Lazer',
    icon: '🎉',
    subcategories: [
      { name: 'Streaming', icon: '📺' },
      { name: 'Cinema', icon: '🎬' },
      { name: 'Shows', icon: '🎤' },
      { name: 'Viagens', icon: '✈️' },
      { name: 'Hobbies', icon: '🎨' },
    ],
  },
  {
    name: 'Compras',
    icon: '🛍️',
    subcategories: [
      { name: 'Roupas', icon: '👕' },
      { name: 'Calçados', icon: '👟' },
      { name: 'Eletrônicos', icon: '💻' },
      { name: 'Casa e Decoração', icon: '🛋️' },
    ],
  },
  {
    name: 'Assinaturas e Contas',
    icon: '📱',
    subcategories: [
      { name: 'Celular', icon: '📞' },
      { name: 'Seguro', icon: '🛡️' },
      { name: 'Serviços Digitais', icon: '☁️' },
      { name: 'Tarifas Bancárias', icon: '🏦' },
    ],
  },
  {
    name: 'Investimentos',
    icon: '💰',
    subcategories: [
      { name: 'Investimentos', icon: '📈' },
      { name: 'Reserva Financeira', icon: '🪙' },
    ],
  },
  {
    name: 'Impostos e Taxas',
    icon: '🧾',
    subcategories: [
      { name: 'IPVA', icon: '🚙' },
      { name: 'IPTU', icon: '🏠' },
      { name: 'Imposto de Renda', icon: '💼' },
    ],
  },
  {
    name: 'Cuidados Pessoais',
    icon: '💇',
    subcategories: [
      { name: 'Cabelo e Salão', icon: '💇' },
      { name: 'Higiene e Beleza', icon: '🧴' },
    ],
  },
  {
    name: 'Pets',
    icon: '🐾',
    subcategories: [
      { name: 'Ração', icon: '🦴' },
      { name: 'Veterinário', icon: '🐕‍🦺' },
      { name: 'Banho e Tosa', icon: '🧼' },
    ],
  },
  {
    name: 'Presentes e Doações',
    icon: '🎁',
    subcategories: [
      { name: 'Presentes', icon: '🎁' },
      { name: 'Doações', icon: '❤️' },
    ],
  },
  {
    name: 'Filhos',
    icon: '👶',
    subcategories: [
      { name: 'Fralda e Higiene', icon: '🍼' },
      { name: 'Escola Infantil', icon: '🏫' },
      { name: 'Brinquedos', icon: '🧸' },
    ],
  },
];
