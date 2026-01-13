# API Endpoints Documentation - PBI EXPORT

Este documento descreve detalhadamente todos os endpoints utilizados pela aplicação para autenticação, consulta de workflows e exportação de dados.

---

## 🔐 FASE 1: AUTENTICAÇÃO

### 1.1. Descoberta do Identity Service
```
GET {baseUrl}/DocuWare/Platform/Home/IdentityServiceInfo
```
- **Quando**: Ao clicar em "Continuar com DocuWare"
- **Parâmetros**: Nenhum (a URL base é informada pelo usuário)
- **Retorno**: 
```json
{
  "IdentityServiceUrl": "https://login-emea.docuware.cloud/{org-guid}"
}
```

### 1.2. Descoberta de Endpoints OpenID
```
GET {identityServiceUrl}/.well-known/openid-configuration
```
- **Quando**: Após obter o IdentityServiceUrl
- **Retorno**: 
```json
{
  "authorization_endpoint": "https://login-emea.docuware.cloud/.../connect/authorize",
  "token_endpoint": "https://login-emea.docuware.cloud/.../connect/token"
}
```

### 1.3. Autorização (Redirect)
```
GET {authorization_endpoint}?response_type=code&client_id={CLIENT_ID}&redirect_uri={REDIRECT_URI}&scope=docuware.platform offline_access
```
- **Quando**: Usuário é redirecionado para fazer login no DocuWare
- **Resultado**: Após login bem-sucedido, DocuWare redireciona para `/auth/callback?code={authorizationCode}`

### 1.4. Troca de Código por Token
```
POST {token_endpoint}
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code={authorizationCode}
&client_id={CLIENT_ID}
&client_secret={CLIENT_SECRET}
&redirect_uri={REDIRECT_URI}
```
- **Quando**: Após callback do OAuth
- **Retorno**:
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI...",
  "refresh_token": "abc123...",
  "expires_in": 3600
}
```
- **Armazenamento**: Token salvo em `sessionStorage['docuware_auth']`

---

## 📋 FASE 2: CONSULTA DE ARMÁRIOS (File Cabinets)

### 2.1. Listar Armários
```
GET /DocuWare/Platform/FileCabinets
Authorization: Bearer {access_token}
```
- **Quando**: Ao carregar a página de Workflow History
- **Retorno**:
```json
{
  "FileCabinet": [
    { "Id": "uuid-1", "Name": "Armário A" },
    { "Id": "uuid-2", "Name": "Armário B" }
  ]
}
```

### 2.2. Obter Campos do Armário
```
GET /DocuWare/Platform/FileCabinets/{cabinetId}
Authorization: Bearer {access_token}
```
- **Fallback se campos não vierem**:
```
GET /DocuWare/Platform/FileCabinets/{cabinetId}/Fields
```
- **Retorno**:
```json
{
  "Fields": [
    { "FieldName": "DWDOCID", "DisplayName": "DocID" },
    { "FieldName": "FORNECEDOR", "DisplayName": "Fornecedor" }
  ]
}
```

---

## 🔍 FASE 3: BUSCA DO HISTÓRICO DE WORKFLOW

### 3.1. Obter Histórico de Instâncias do Documento
```
GET /DocuWare/Platform/Workflow/Instances/DocumentHistory
    ?fileCabinetId={cabinetId}
    &documentId={docId}
Authorization: Bearer {access_token}
```
- **Quando**: Usuário pesquisa por um Document ID
- **Retorno**:
```json
{
  "InstanceHistory": [
    {
      "Id": "instance-guid-1",
      "WorkflowId": "workflow-guid",
      "Name": "Aprovação Faturas",
      "Version": 1,
      "StartDate": "/Date(1699999999999)/",
      "Links": [
        { "Rel": "self", "href": "/DocuWare/Platform/.../History" }
      ]
    }
  ]
}
```

### 3.2. Obter Passos Detalhados de Cada Instância
```
GET /DocuWare/Platform/Workflow/Workflows/{workflowId}/Instances/{instanceId}/History
Authorization: Bearer {access_token}
```
- **Quando**: Para cada instância retornada no passo anterior
- **Retorno**:
```json
{
  "HistorySteps": [
    {
      "ActivityName": "Aprovação Gerente",
      "ActivityType": "UserTask",
      "Info": {
        "Item": {
          "UserName": "joao.silva",
          "DecisionName": "Aprovado",
          "DecisionDate": "/Date(1700000000000)/"
        }
      }
    }
  ]
}
```

---

## 📄 FASE 4: OBTER DADOS DO DOCUMENTO (para Export CSV)

### 4.1. Obter Metadados do Documento
```
GET /DocuWare/Platform/FileCabinets/{cabinetId}/Documents/{docId}
Authorization: Bearer {access_token}
```
- **Quando**: Usuário clica em "Exportar CSV"
- **Retorno**:
```json
{
  "Id": 12345,
  "Fields": [
    { "FieldName": "FORNECEDOR", "Item": "ACME Corp" },
    { "FieldName": "VALOR", "Item": 15000.00 },
    { "FieldName": "DATA_EMISSAO", "Item": "/Date(1699999999999)/" }
  ]
}
```

---

## 📊 FLUXO COMPLETO (Resumo Visual)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          FLUXO DE AUTENTICAÇÃO                          │
├─────────────────────────────────────────────────────────────────────────┤
│  1. Usuário insere URL → /Home/IdentityServiceInfo                      │
│  2. Descobre endpoints → /.well-known/openid-configuration              │
│  3. Redirect para DocuWare → /connect/authorize                         │
│  4. Callback com código → /connect/token                                │
│  5. Token salvo em sessionStorage                                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          FLUXO DE CONSULTA                              │
├─────────────────────────────────────────────────────────────────────────┤
│  1. Carregar armários → /FileCabinets                                   │
│  2. Usuário seleciona armário e digita DocID                            │
│  3. Buscar histórico → /Workflow/Instances/DocumentHistory              │
│  4. Para cada instância → /Workflow/.../Instances/{id}/History          │
│  5. Exibir tabela com todas as atividades/decisões                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          FLUXO DE EXPORTAÇÃO CSV                        │
├─────────────────────────────────────────────────────────────────────────┤
│  1. Usuário clica "Exportar CSV"                                        │
│  2. Buscar campos do doc → /FileCabinets/{id}/Documents/{docId}         │
│  3. Combinar dados: Histórico + Campos do Documento                     │
│  4. Gerar CSV com colunas:                                              │
│     - Instance GUID, DOCID, Instância, Versão                           │
│     - Atividade, Tipo, Decisão, Usuário, Data                           │
│     - [Todos os campos dinâmicos do documento]                          │
│     - Link do Documento                                                 │
│  5. Download do arquivo .csv                                            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 REFRESH TOKEN

```
POST {token_endpoint}
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
&refresh_token={refresh_token}
&client_id={CLIENT_ID}
&client_secret={CLIENT_SECRET}
```
- **Quando**: Token expira (interceptor automático em caso de 401)

---

## 📁 ARQUIVOS DE REFERÊNCIA

| Arquivo | Endpoints Utilizados |
|---------|---------------------|
| `authService.js` | Identity, OpenID, Token |
| `docuwareService.js` | FileCabinets, Documents |
| `workflowAnalyticsService.js` | Workflow History |
| `WorkflowHistoryPage.jsx` | Chama os services e gera CSV |
