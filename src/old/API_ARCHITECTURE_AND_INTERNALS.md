# Arquitetura de API e Internals do Sistema (Deep Dive)

| Documento | API_ARCHITECTURE_AND_INTERNALS.md |
|-----------|-----------------------------------|
| Nível     | Engenharia Sênior / DevOps |
| Escopo    | Backend (Proxy), Frontend (Service Layer), File System IO |
| Versão    | 1.0.0 (Rev. 2025) |

---

## 1. Middleware de Proxy Reverso (Node.js/Express)

O servidor proxy não é apenas um pass-through; ele atua como um **adaptador de protocolo** para viabilizar a arquitetura Single Page Application (SPA) em um ambiente com CORS restritivo.

### 1.1 Tabela de Roteamento Interno

A aplicação roda em `localhost` (ou domínio interno), mas consome APIs de `docuware.cloud`. O Proxy intercepta e reescreve cabeçalhos *on-the-fly*.

| Método | Rota de Entrada (Local) | Header `x-target-url` (Dynamic) | Rota de Saída (DocuWare) | Ação do Proxy |
|--------|-------------------------|---------------------------------|--------------------------|---------------|
| `OPTIONS` | `*` | *Ignorado* | *N/A* | **Retorna 200 OK** imediatamente (Bypass Preflight). |
| `GET` | `/DocuWare/FileCabinets` | `https://{org}.docuware.cloud/DocuWare/FileCabinets` | `/FileCabinets` | Remove `Origin`, Forward Auth. |
| `POST` | `/DocuWare/.../Query/...` | `https://{org}.docuware.cloud/DocuWare/...` | `/Query/DialogExpression` | Stream JSON Body. |
| `GET` | `/DocuWare/.../FileDownload` | `https://{org}.docuware.cloud/DocuWare/...` | `/FileDownload` | Stream Binary (Blob) response. |

### 1.2 Lógica de Interceptação (Deep Dive)

No arquivo `proxy-server.js`:

```javascript
// O "Coração" do Proxy
router: (req) => {
    // 1. Extração Dinâmica: Permite multi-tenant (várias orgs na mesma sessão)
    const targetUrl = req.headers['x-target-url']; 
    if (!targetUrl) throw new Error('Missing X-Target-URL');
    return targetUrl;
},
onProxyReq: (proxyReq) => {
    // 2. Sanitização de Headers:
    // O DocuWare rejeita requisições se perceber headers "estranhos" ou Origins não autorizadas.
    proxyReq.removeHeader('x-target-url');
    proxyReq.removeHeader('origin'); 
    proxyReq.removeHeader('referer');
}
```

---

## 2. Especificação da API DocuWare (Camada de Serviço)

Detalhes técnicos dos endpoints consumidos em `src/services/docuwareService.js`.

### 2.1 Autenticação e Sessão
*   **Mecanismo**: OAuth2 (Implícito ou Password Flow simulado via Cookie/Token).
*   **Persistência**: `sessionStorage.getItem('docuware_auth')`.
*   **Header**: `Authorization: Bearer <JWT_TOKEN>`.

### 2.2 Busca Avançada (`POST /Query/DialogExpression`)

Esta é a rota mais complexa do sistema. Não usamos buscas simples de URL, construímos expressões lógicas.

**Endpoint**: `/FileCabinets/{CabinetID}/Query/DialogExpression?dialogId={SearchDialogID}&count={Limit}`

**Payload JSON (Schema):**
```json
{
    "Condition": [
        {
            "DBName": "COMPANY_NAME", 
            "Value": ["Acme Corp"],
            "Operation": "Equals" // Implícito se omitido
        },
        {
            "DBName": "DOCUMENT_DATE",
            "Value": ["2024-01-01", "2024-12-31"], 
            "Operation": "Between" // Inferido pelo array de 2 itens em campos data
        }
    ],
    "Operation": "And", // Operador lógico entre as condições
    "CalculateTotalCount": true,
    "Brief": false // Se true, retorna apenas metadados compactos
}
```

### 2.3 Substituição de Arquivo (Workaround Técnico)

O DocuWare **NÃO** possui um verbo `PUT /Document/{id}/Content`. Para substituir um arquivo, executamos uma **transação atômica simulada** no Frontend:

1.  **GET** `/FileCabinets/{id}/Documents/{docId}`
    *   *Objetivo*: Mapear IDs de todas as seções existentes (`Sections[].Id`).
2.  **POST** `/FileCabinets/{id}/Sections?docId={docId}`
    *   *Header*: `Content-Type: application/pdf`, `Content-Disposition: inline`.
    *   *Body*: Binary Blob (o arquivo novo).
    *   *Resultado*: O documento agora tem (N + 1) seções. A nova é a última.
3.  **DELETE** `/FileCabinets/{id}/Sections/{SectionID}`
    *   *Loop*: Itera sobre os IDs capturados no passo 1.
    *   *Resultado Final*: Resta apenas a seção nova. O índice e metadados do documento são preservados.

**Tratamento de Falha**: Se o passo 2 falhar, nada é deletado (seguro). Se o passo 3 falhar no meio, o documento pode ficar com múltiplas seções (arquivo "híbrido"), exigindo intervenção manual, mas sem perda de dados.

---

## 3. Arquitetura de I/O Local (File System Access API)

O sistema "fura" a sandbox do navegador usando a API `window.showDirectoryPicker`.

### 3.1 Handles e Permissões
*   **DirectoryHandle**: Um ponteiro persistente para uma pasta no disco do usuário.
*   **Ciclo de Vida**:
    1.  Usuário clica "Selecionar Pasta" -> Browser pede permissão (R/W).
    2.  Aplicação guarda o objeto `handle` em memória (React State). *Nota: Handles não sobrevivem a um F5 (Refresh) por segurança.*

### 3.2 Algoritmo de Monitoramento (Loop de Eventos)

Implementado em `DownloadPage.jsx` (`checkFolderForUploads`).

**Estado**:
*   `monitorHandle`: Ponteiro para a pasta raiz.
*   `isProcessingRef`: Mutex (Lock) para evitar que o `setInterval` dispare o loop 2x se o upload for lento.
*   `failedUploads`: Hashmap `{ filename: retryCount }`.

**Pseudocódigo do Loop:**
```python
while (True):
    for entry in monitorHandle.list():
        if entry is FILE and entry.name matches REGEX:
            # Regex: ^(\d+)___(.+)___(.+)\.pdf$
            
            if retry_count > 3:
                move_to_error_folder(entry)
                continue
            
            try:
                upload_replacement(doc_id, entry.content)
                update_metadata(doc_id, "STATUS", "OK")
                move_to_success_folder(entry) # Move = Copy + Delete
            except Exception:
                retry_count++
                log_error()
                
    if (no_activity_for_5_min):
        stop_monitoring()
    
    wait(5_seconds)
```

---

## 4. Tratamento de Erros e Códigos HTTP

O sistema reage aos seguintes códigos do DocuWare:

| Código | Significado | Ação do Sistema |
|--------|-------------|-----------------|
| `401` | Unauthorized | Token expirou. O Proxy retorna erro, o Frontend detecta e redireciona para `/login`. |
| `404` | Not Found | Gaveta ou Documento não existe. Comum em ambientes de Dev onde IDs mudam. Loga "Warning". |
| `429` | Too Many Requests | Throttling. O serviço `getAllDocuments` (Analytics) usa **Batching** (Chunks de 5) para mitigar isso. |
| `500` | Internal Error | Erro genérico do DocuWare. Exibido no `LogConsole` para o operador. |

## 5. Estrutura de Diretórios Recomendada (Cliente)

Para o funcionamento do "Round-Trip", a máquina do cliente deve ter a seguinte estrutura (criada automaticamente pelo script externo de compressão):

```text
/MeusDocumentos/DocuWare_Sync/
│
├── Entrada/        <-- (Onde o React salva os PDFs originais "Download em Massa")
│
├── Saida/          <-- (Onde o script externo joga os PDFs comprimidos)
│   │               <-- (O React monitora ESTA pasta)
│   ├── Processados/ <-- (Movidos pelo React após upload sucesso)
│   └── Erros/       <-- (Movidos pelo React após 3 falhas)
│
└── Scripts/        <-- (Ghostscript/Python scripts)
```
