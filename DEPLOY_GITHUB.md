# 🚀 Publicação no GitHub Actions & GitHub Pages

Este repositório já está configurado para compilar e publicar automaticamente o aplicativo no **GitHub Pages** a cada `push` nos branches `main` ou `master`.

---

## 🛠️ Passo a Passo para Ativar a Publicação Automática

### 1. Enviar o Código para o seu Repositório GitHub
Se você ainda não enviou o código para o GitHub, execute no terminal do seu projeto:

```bash
git add .
git commit -m "feat: configurado deploy no github actions"
git push origin main
```

---

### 2. Ativar o GitHub Pages no Repositório
1. Acesse o seu repositório no [GitHub](https://github.com).
2. Clique na aba **Settings** (Configurações) no topo.
3. No menu lateral esquerdo, clique em **Pages** (dentro da seção *Code and automation*).
4. Em **Build and deployment**:
   - No campo **Source**, selecione **GitHub Actions**.
5. Pronto! 

---

### 3. Execução Automática (Workflow)
- Assim que você fizer o `git push` (ou clicar em **Actions → Deploy to GitHub Pages → Run workflow**), o GitHub Actions fará:
  1. Instalação das dependências (`npm ci`).
  2. Compilação otimizada do React + Tailwind CSS (`npm run build`).
  3. Publicação direta no GitHub Pages no formato `https://seu-usuario.github.io/nome-do-repositorio/`.

---

### 📁 Arquivo de Workflow Criado
O arquivo de automação foi criado em:
- `.github/workflows/deploy.yml`

### ⚙️ Compatibilidade de Rotas e Assets
O `vite.config.ts` foi configurado com `base: './'` para garantir que todas as imagens, fontes, estilos CSS e scripts JavaScript carreguem perfeitamente tanto no GitHub Pages quanto em qualquer domínio ou subpasta personalizada.
