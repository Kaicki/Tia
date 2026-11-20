
function semelhantes() {
  var alvo = $("dLista2");
  alvo.innerHTML = "";

  var generosAlvo = t.generos.map(function (g) {
    return simples(g);
  }).filter(Boolean);

  var recomendados = state.todos
    .filter(function (x) {
      return x.id !== t.id;
    })
    .map(function (x) {
      var generos = x.generos.map(function (g) {
        return simples(g);
      }).filter(Boolean);

      var comuns = generosAlvo.filter(function (g) {
        return generos.indexOf(g) !== -1;
      });

      var pontuacao = 0;

      // Gêneros em comum
      pontuacao += comuns.length * 10;

      // Prioriza conteúdos do mesmo tipo
      if (x.tipo === t.tipo) {
        pontuacao += 3;
      }

      // Valoriza títulos com mais de um gênero compatível
      if (comuns.length >= 2) {
        pontuacao += 5;
      }

      // Pequeno bônus para títulos com categorias semelhantes
      if (
        generosAlvo.length &&
        comuns.length === generosAlvo.length
      ) {
        pontuacao += 5;
      }

      return {
        titulo: x,
        pontos: pontuacao
      };
    })
    .filter(function (x) {
      return x.pontos > 0;
    });

  // Ordena pelos títulos mais semelhantes
  recomendados.sort(function (a, b) {
    return b.pontos - a.pontos;
  });

  // Embaralha títulos com pontuação igual
  var grupos = {};

  recomendados.forEach(function (x) {
    (grupos[x.pontos] = grupos[x.pontos] || []).push(x.titulo);
  });

  var resultado = [];

  Object.keys(grupos)
    .map(Number)
    .sort(function (a, b) {
      return b - a;
    })
    .forEach(function (pontos) {
      resultado = resultado.concat(
        embaralha(grupos[pontos])
      );
    });

  // Se houver poucos resultados, completa com outros títulos
  if (resultado.length < 8) {
    var extras = embaralha(
      state.todos.filter(function (x) {
        return (
          x.id !== t.id &&
          resultado.indexOf(x) === -1
        );
      })
    );

    resultado = resultado.concat(extras);
  }

  if (!resultado.length) {
    alvo.innerHTML =
      '<p class="vazio">Nenhum título semelhante encontrado.</p>';
    return;
  }

  var g = document.createElement("div");
  g.className = "grade";
  g.style.padding = "12px 0";

  resultado.slice(0, 15).forEach(function (x) {
    g.appendChild(cartaz(x));
  });

  alvo.appendChild(g);
}
