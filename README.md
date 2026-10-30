# TIAFLIX

Site de streaming estilo Netflix (HTML + CSS + JavaScript puro). Sem login e sem banco de dados.

## Arquivos
- `index.html`, `style.css`, `script.js` — o site (não precisa mexer para adicionar filmes)
- `catalogo.json` — filmes
- `catalogoseries.json` — séries
- `img/` — capas e banners

## Adicionar um filme ou série
Copie um bloco de `catalogo.json` (ou `catalogoseries.json`), cole no final da lista (com vírgula entre os blocos) e edite:

```json
{
  "id": 7,
  "titulo": "Nome do Filme",
  "ano": 2026,
  "genero": ["Ação", "Drama"],
  "descricao": "Sinopse curta.",
  "capa": "img/capa7.jpg",
  "banner": "img/banner7.jpg",
  "link": "https://drive.google.com/file/d/ID_DO_VIDEO/view",
  "destaque": false,
  "popular": false,
  "adicionado": "2026-10-30"
}
```

- `id`: número único dentro do arquivo.
- `destaque`: `true` mostra no banner principal da página inicial.
- `popular`: `true` coloca na linha "Populares".
- `adicionado`: data `AAAA-MM-DD`; define a linha "Adicionados recentemente".
- `capa`: imagem vertical (proporção 2:3). `banner`: imagem horizontal (16:9). Pode ser um arquivo em `img/` ou uma URL.
- Se a imagem não existir, o site mostra um cartão com o título.

## Vídeos no Google Drive
1. Envie o vídeo ao Drive.
2. Botão direito > **Compartilhar** > Acesso geral: **Qualquer pessoa com o link**.
3. Copie o link e cole em `"link"`. O site converte automaticamente para o formato de reprodução.

## Publicar no GitHub Pages
1. Crie um repositório e envie todos os arquivos (incluindo a pasta `img`).
2. **Settings > Pages > Deploy from a branch** > `main` / `(root)` > Save.
3. O site fica em `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.

> Para testar no computador, não abra o `index.html` com duplo clique (o navegador bloqueia o `fetch` dos JSON). Use um servidor local: `python3 -m http.server` e acesse `http://localhost:8000`.

## Observações
- Favoritos ficam salvos no navegador (LocalStorage), em cada aparelho.
- Tela cheia: o botão tenta girar para paisagem no celular. No iPhone, use também o botão de tela cheia do próprio player do Drive.
- O Google Drive pode limitar reprodução de arquivos muito acessados ou muito grandes.
