# Manual Técnico - Workflow Vision (RCSVision)

| Documento | TECHNICAL_MANUAL.md |
|-----------|--------------------|
| Autor     | Engenharia de Software RCSVision |
| Data      | 20/12/2025 |
| Versão    | 2.0 |

---

## 1. Arquitetura do Sistema

O **Workflow Vision** é uma aplicação web aceleradora projetada para interagir com a plataforma **DocuWare Cloud**. Sua arquitetura foi desenhada para superar as limitações de CORS (Cross-Origin Resource Sharing) impostas pelos navegadores e para permitir operações complexas de arquivos (como compressão em massa) utilizando recursos locais.

### 1.1 Diagrama de Componentes

```mermaid
graph TD
    Client[Browser Client (React/Vite)] -->|HTTP/REST| Proxy[Node.js Proxy Server]
    Proxy -->|Forward Request| DW[DocuWare Cloud API]
    
    subgraph "Fluxo de Compressão (Round-Trip)"
        Client -->|File System API| LocalFolder[Pasta Local do Usuário]
        LocalFolder -.->|Watch & Process| GhostScript[Script de Compressão Externo]
        GhostScript -.->|Save Reduced| LocalFolder
        Client -->|Read & Upload| LocalFolder
    end
```

### 1.2 Componentes Principais

1.  **Backend (Proxy Server)**:
    *   **Tecnologia**: Node.js + Express + `http-proxy-middleware`.
    *   **Função**: Atua como um "tunel" transparente. O navegador não pode chamar `docuware.cloud` diretamente devido a políticas de segurança. O Proxy recebe a requisição em `localhost:3001` e a repassa para o DocuWare adicionando/modificando os headers necessários.
    *   **Arquivo**: `proxy-server.js`.

2.  **Frontend (React App)**:
    *   **Tecnologia**: React 19, Vite, TailwindCSS.
    *   **Função**: Interface do usuário para busca, visualização de fluxos e orquestração de downloads em massa.
    *   **Autenticação**: Gerencia tokens de sessão e identidade organizacional.

---

## 2. Dicionário de Funções (Integração DocuWare)

A camada de integração está centralizada em `src/services/docuwareService.js`. Abaixo estão as funções críticas para o funcionamento do sistema.

| Função | Parâmetros | Retorno | Descrição Técnica |
|--------|------------|---------|-------------------|
| `getCabinets` | `void` | `Array<FileCabinet>` | Retorna todas as gavetas disponíveis para o usuário logado. |
| `searchDocuments` | `cabinetId`, `filters` | `{items, total}` | Executa uma busca complexa. Se houver filtros, utiliza o endpoint `/Query/DialogExpression`. Se vazio, lista documentos recentes. |
| `downloadDocument` | `cabinetId`, `docId` | `Blob` | Baixa o binário do arquivo. Utiliza `targetFileType='pdf'` para garantir compatibilidade. |
| `uploadReplacement` | `cabinetId`, `docId`, `blob` | `Document` | **Crítico**: Realiza a substituição do arquivo. Como o DocuWare não possui "Update File", o fluxo é: (1) Adicionar nova seção, (2) Deletar seções antigas. |
| `updateDocumentFields` | `cabinetId`, `docId`, `field, value` | `Object` | Atualiza metadados (índices) do documento para sinalizar status (ex: "COMPRIMIDO"). |

---

## 3. Integração e Fluxo de Dados

### 3.1 O Problema de CORS e a Solução Proxy
O DocuWare Cloud não permite chamadas AJAX diretas de domínios desconhecidos (como `localhost`).
*   **Requisição Original (Bloqueada)**: `GET https://customer.docuware.cloud/API`
*   **Requisição via Proxy (Sucesso)**: `GET http://localhost:3001/DocuWare/API`
    *   **Header Obrigatório**: `x-target-url: https://customer.docuware.cloud/API`

### 3.2 Estrutura da Requisição Padrão
Todas as chamadas via `src/services/api.js` injetam automaticamente este comportamento:

```javascript
// Exemplo de chamada interna
api.get('/FileCabinets/123')

// Transformada pelo Axios Interceptor em:
GET http://localhost:3001/DocuWare/FileCabinets/123
Headers: {
  "Authorization": "Bearer <TOKEN>",
  "x-target-url": "https://<ORG>.docuware.cloud/DocuWare/FileCabinets/123"
}
```

---

## 4. O Sistema de Compressão (Round-Trip)

O módulo de "Download e Upload de Retorno" (`DownloadPage.jsx`) utiliza a **File System Access API** do navegador para criar uma ponte entre a Web e o Desktop.

1.  **Download**: O React escreve os PDFs originais em uma pasta local selecionada pelo usuário.
2.  **Processamento Externo**: Espera-se que um agente externo (ex: script Python/Node com Ghostscript) monitore esta pasta, comprima os arquivos e salve-os com o mesmo nome ou sufixo.
3.  **Upload (Monitoramento)**: 
    *   O Frontend fica em loop (`setInterval`) verificando a pasta.
    *   Se detectar um arquivo que corresponde ao padrão (ex: `123___Cabinet___Nome.pdf`), ele inicia o upload.
    *   Usa `uploadReplacement` para substituir o arquivo original no DocuWare pela versão local comprimida.
    *   Move o arquivo local para uma subpasta `Processados` após o sucesso.

---

## 5. Notas de Manutenção

### 5.1 Tokens e Sessão
*   O token de autenticação é volátil. Se o Proxy retornar `401 Unauthorized`, a aplicação redireciona automaticamente para o Login.
*   **Atenção**: O token é armazenado em `sessionStorage` (`docuware_auth`).

### 5.2 Limites da API
*   O DocuWare impõe throttling. O serviço `getAllDocuments` (Analytics) implementa uma lógica de **Batching** (lotes de 5 requisições simultâneas) para evitar erros `429 Too Many Requests`.
*   **Timeout**: Operações de upload grandes tem um timeout configurado para 120 segundos (`120000ms`).

### 5.3 Debugging do Proxy
Se houver falha de conexão:
1.  Verifique se o proxy está rodando: `node proxy-server.js`.
2.  Verifique os logs do terminal do proxy. Ele imprime: `[Proxy] ❌ Error: <detalhe>` se a conexão com o DocuWare falhar (DNS, Timeout).
