# TIAFLIX

Interface de streaming estática, sem login, usuários ou banco de dados. Feita com HTML, CSS e JavaScript e pronta para GitHub Pages.

## Publicar no GitHub Pages

1. Crie um repositório no GitHub (por exemplo `tiaflix`).
2. Envie todos os arquivos desta pasta para a raiz do repositório.
3. Abra **Settings → Pages**.
4. Em **Build and deployment**, escolha **Deploy from a branch**.
5. Selecione a branch `main` e a pasta `/ (root)`, depois clique em **Save**.
6. Aguarde o GitHub publicar o endereço do site.

## Cadastrar seus vídeos

Edite `catalogo.json`. Cada título possui os campos `titulo`, `tipo`, `ano`, `genero`, `descricao`, `capa`, `banner` e `driveId`.

No Google Drive:
1. Abra o vídeo e clique em **Compartilhar**.
2. Altere o acesso para **Qualquer pessoa com o link — Leitor**.
3. Copie o link e cole o link inteiro ou somente o ID no campo `driveId`.
4. Salve o JSON e envie a alteração ao GitHub.

Exemplo de link:
`https://drive.google.com/file/d/SEU_ID_DO_ARQUIVO/view?usp=sharing`

O site converte o ID para o formato de pré-visualização do Drive. A reprodução depende das permissões, limites e compatibilidade do Google Drive; ele não é um serviço de streaming dedicado.

## Personalização

- Troque capas e banners usando URLs de imagens que você tenha direito de usar.
- Duplique um objeto dentro de `catalogo.json` para adicionar outro filme ou episódio.
- Para um título aparecer no destaque da página inicial, use `"destaque": true`.
- A seção “Minha lista” é salva no navegador de cada visitante via `localStorage`; não sincroniza entre dispositivos.
- A seção “Continue assistindo” está como vitrine inicial demonstrativa; não guarda progresso ainda.

## Observações

O projeto não inclui autenticação, perfis, analytics ou banco de dados. O catálogo é público porque está no repositório e no site.
