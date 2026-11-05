const secoes = [
  {
    titulo: "Quais dados guardamos",
    texto:
      "Nome, município e UF das fazendas; nome e contorno (polígono) dos talhões; e os resultados calculados a partir de imagens de satélite: índice NDVI, zonas de manejo e alertas.",
  },
  {
    titulo: "Para que usamos",
    texto:
      "Apenas para mostrar o mapa, a evolução da vegetação, os alertas e gerar o relatório em PDF do seu talhão. Não vendemos nem compartilhamos esses dados.",
  },
  {
    titulo: "Telefone",
    texto:
      "O número de telefone usado no aviso por WhatsApp não é guardado: é usado só no momento do envio (simulado nesta versão).",
  },
  {
    titulo: "Como excluir",
    texto:
      "Excluir um talhão apaga também suas cenas, zonas, alertas, relatórios e arquivos de imagem. Excluir uma fazenda apaga todos os seus talhões e dados associados.",
  },
];

export default function PrivacyNotice() {
  return (
    <article className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-xs font-semibold uppercase tracking-widest text-barro">Transparência</p>
      <h1 className="mt-2 font-serif text-4xl font-bold text-tinta">Aviso de privacidade</h1>
      <div className="mt-8 space-y-6 border-l-4 border-folha pl-6">
        {secoes.map((s) => (
          <section key={s.titulo}>
            <h2 className="font-serif text-xl font-bold text-folha">{s.titulo}</h2>
            <p className="mt-1 leading-relaxed">{s.texto}</p>
          </section>
        ))}
      </div>
    </article>
  );
}
