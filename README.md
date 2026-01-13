# PBI EXPORT - RCS Vision

Aplicação para exportação de dados do DocuWare para análise no Power BI.

## Pré-requisitos

- **Node.js** (versão 18 ou superior)
- **npm** (gerenciador de pacotes do Node)
- **Credenciais DocuWare** (Client ID, Client Secret configurados no DocuWare)

## Instalação

```bash
# Clonar o repositório
git clone https://github.com/cesarfois/PBI-EXPORT.git
cd PBI-EXPORT

# Instalar dependências
npm install
```

## Configuração

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```env
VITE_DOCUWARE_CLIENT_ID=seu_client_id
VITE_DOCUWARE_CLIENT_SECRET=seu_client_secret
VITE_DOCUWARE_REDIRECT_URI=http://localhost:5173/auth/callback
```

## Como Rodar

Você precisa iniciar **dois servidores** em terminais separados:

### Terminal 1: Servidor de Desenvolvimento (Frontend)
```bash
npm run dev
```
Acesse: http://localhost:5173

### Terminal 2: Proxy Server (Backend)
```bash
node proxy-server.js
```
Roda na porta 3001

## Uso

1. Acesse http://localhost:5173
2. Insira a URL do DocuWare (ex: `https://rcsangola.docuware.cloud`)
3. Clique em "Continuar com DocuWare"
4. Faça login com suas credenciais DocuWare
5. Use as funcionalidades:
   - **Export Data**: Exportar dados de documentos
   - **Workflow History**: Histórico de workflows por ID

## Estrutura do Projeto

```
├── src/
│   ├── components/     # Componentes React
│   ├── pages/          # Páginas da aplicação
│   ├── services/       # Serviços de API
│   ├── context/        # Contextos React (Auth)
│   └── old/            # Código legado (não usado)
├── proxy-server.js     # Servidor proxy para CORS
├── vite.config.js      # Configuração Vite
└── package.json        # Dependências
```

## Tecnologias

- **React** + **Vite**
- **TailwindCSS**
- **Axios** para requisições HTTP
- **Express** para proxy server
