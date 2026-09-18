# Modo de Sobrevivência Agressivo - Guia de Implementação

## Visão Geral

O **Modo de Sobrevivência** agora funciona de forma **automática e agressiva**, bloqueando requisições de rede não-essenciais sempre que:
- **Bateria baixa** (≤ 20%)
- **Conexão 2G/slow-2G** ativa
- Usuário habilita economias de dados no sistema operacional

Diferente de apenas esconder imagens, o sistema **impede requisições HTTP** imediatamente, economizando dados e bateria de forma radical.

## Arquitetura

### Componentes Principais

1. **`network-interceptor.js`** - Define o whitelist de requisições essenciais vs. não-essenciais
2. **`survival-mode-state.js`** - Gerenciador global de estado (não-React)
3. **`api.js`** - Integração com `apiFetch`, `apiFetchRaw`, `apiUpload`
4. **`SurvivalModeContext.jsx`** - Provider que sincroniza bateria/conexão com interceptor
5. **`useSafeApiFetch.js`** - Hook React para tratar requisições bloqueadas
6. **`SurvivalModeBlockedBanner.jsx`** - Componente de feedback visual

## Classificação de Requisições

Toda requisição é automaticamente classificada em:

| Classificação | Comportamento | Exemplos |
|--|--|--|
| **ESSENTIAL** | ✅ Sempre permitida | `/auth`, `/classes`, `/grades`, `/attendance`, `/sync`, `/admin/grades` |
| **ADVISORY** | ⚠️ Permitida por padrão, mas pode ser rejeitada em futuras fases | `/announcements`, `/settings`, `/messages` |
| **NON_ESSENTIAL** | ❌ Bloqueada em modo de sobrevivência | `/analytics`, `/gamification`, `/leaderboards`, `/health` |

## Como Usar

### 1. Requisições Automáticas (Padrão)

Requisições através de `apiFetch()` são interceptadas automaticamente:

```javascript
import { apiFetch } from '../../lib/api.js'

// Esta requisição será BLOQUEADA em modo de sobrevivência
const analytics = await apiFetch('/analytics/summary', { token })
```

### 2. Tratamento de Bloqueio com Try-Catch

```javascript
import { SurvivalModeNetworkError } from '../../lib/network-interceptor.js'

const loadAnalytics = async () => {
  try {
    const data = await apiFetch('/analytics/summary', { token })
    setAnalytics(data)
  } catch (err) {
    if (err instanceof SurvivalModeNetworkError) {
      // Requisição foi bloqueada - mostrar feedback elegante
      setIsBlocked(true)
    } else {
      // Erro real de rede
      setError(err.message)
    }
  }
}
```

### 3. Hook `useSafeApiFetch` (Recomendado)

Para componentes que precisam diferenciar bloqueio de erro real:

```javascript
import { useSafeApiFetch } from '../../context/useSafeApiFetch.js'
import SurvivalModeBlockedBanner from '../../components/SurvivalModeBlockedBanner.jsx'

function MyAnalyticsPanel() {
  const { data, error, isBlocked, isSurvivalMode, loading, execute } = useSafeApiFetch(
    () => apiFetch('/analytics/summary', { token }),
    null
  )

  useEffect(() => {
    execute()
  }, [])

  if (loading) return <SkeletonLoader />
  if (isBlocked) return <SurvivalModeBlockedBanner message="Analytics indisponível" />
  if (error) return <ErrorBanner error={error} />
  
  return <AnalyticsContent data={data} />
}
```

### 4. Componente Banner

Para mostrar avisos elegantes quando algo está bloqueado:

```javascript
import SurvivalModeBlockedBanner from '../../components/SurvivalModeBlockedBanner.jsx'

<SurvivalModeBlockedBanner
  message="Relatórios bloqueados para economizar dados"
  reason="non-essential"
  onDismiss={() => setShowBanner(false)}
/>
```

## Adicionando Novas Classificações

Para modificar o whitelist, edite [network-interceptor.js](apps/frontend/src/lib/network-interceptor.js):

### Marcar como ESSENCIAL (sempre permitida)

```javascript
const ESSENTIAL_PATTERNS = [
  /^\/myfeature(\/|$|\?)/,  // Sempre será permitida
]
```

### Marcar como NÃO-ESSENCIAL (bloqueada)

```javascript
const NON_ESSENTIAL_PATTERNS = [
  /^\/reports\//,  // Será bloqueada em modo de sobrevivência
]
```

## Comportamento do Sistema

```
┌─ Detector de Conexão/Bateria
│  ├─ Bateria ≤ 20% → isSurvivalMode = true
│  └─ Conexão = 2G/slow-2G → isSurvivalMode = true
│
└─ SurvivalModeProvider
   ├─ Sincroniza estado com survivalModeStateManager
   └─ Emite para componentes via React Context
      │
      └─ apiFetch() intercepta requisições
         ├─ Consulta survivalModeStateManager.getSurvivalMode()
         ├─ Classifica endpoint (ESSENTIAL/NON_ESSENTIAL)
         └─ Se NON_ESSENTIAL + survival mode → lança SurvivalModeNetworkError
            │
            └─ Componentes tratam com try-catch ou useSafeApiFetch
```

## Exemplos Práticos

### Exemplo 1: Painel de Owner (Implementado)

Veja [OwnerDashboard.jsx](apps/frontend/src/pages/owner/OwnerDashboard.jsx) para um exemplo completo:

```javascript
const [analyticsBlocked, setAnalyticsBlocked] = useState(false)

const loadAnalytics = async () => {
  try {
    const data = await apiFetch('/owner/analytics/summary', { token })
    setAnalytics(data)
  } catch (err) {
    if (err instanceof SurvivalModeNetworkError) {
      setAnalyticsBlocked(true)  // UI sabe que foi bloqueado
    } else {
      setError(err.message)  // Erro real
    }
  }
}
```

### Exemplo 2: Componente com Graceful Degradation

```javascript
function GamificationPanel() {
  const { data, isBlocked } = useSafeApiFetch(
    () => apiFetch('/gamification/leaderboard', { token })
  )

  if (isBlocked) {
    return (
      <div className="p-4 bg-gray-50 rounded">
        <p className="text-sm text-gray-600">
          Gamificação desabilitada em modo de economia de dados
        </p>
      </div>
    )
  }

  return <LeaderboardTable data={data} />
}
```

## Testando Localmente

### Simular Bateria Baixa
```javascript
// Chrome DevTools → Conditions → Model = "Low-end mobile"
// Ou aguardar hasta que bateria real ≤ 20%
```

### Simular Conexão 2G
```javascript
// Chrome DevTools → Network → Throttle = "Slow 2G"
// Devtools exibirá no Console quando modo de sobrevivência ativar
```

### Verificar Status
```javascript
// No Console do navegador:
console.log(navigator.connection.effectiveType)  // "2g" | "3g" | "4g" | "slow-2g"
console.log(navigator.getBattery?.())  // Promise<Battery>
```

## Boas Práticas

✅ **Faça:**
- Use `useSafeApiFetch` para requisições não-essenciais
- Mostre `SurvivalModeBlockedBanner` quando algo for bloqueado
- Deixe requisições ESSENCIAIS passarem (auth, dados críticos)
- Teste com Devtools em "Slow 2G" e bateria simulada

❌ **Não faça:**
- Marque analytics/gamification como ESSENTIAL
- Ignore erros `SurvivalModeNetworkError` (são intencionais)
- Tente fazer retry automático de requisições bloqueadas
- Modifique ESSENTIAL_PATTERNS sem discussão de segurança

## Status da Implementação

✅ Sistema de classificação de requisições
✅ Integração automática em `apiFetch`, `apiFetchRaw`, `apiUpload`
✅ Sincronização com contexto React
✅ Hook `useSafeApiFetch` para componentes
✅ Componente `SurvivalModeBlockedBanner`
✅ Implementação piloto em `OwnerDashboard`
✅ Build validado (sem erros)

### Próximos Passos
- [ ] Integrar em mais páginas (analytics, relatórios)
- [ ] Adicionar persistência de preferência do usuário
- [ ] Criar dashboard de "modo de sobrevivência" na admin
- [ ] Documentar todos os endpoints bloqueados para usuário final

## Arquivos Relacionados

- [network-interceptor.js](apps/frontend/src/lib/network-interceptor.js) - Classificação
- [survival-mode-state.js](apps/frontend/src/lib/survival-mode-state.js) - Estado global
- [api.js](apps/frontend/src/lib/api.js) - Integração HTTP
- [SurvivalModeContext.jsx](apps/frontend/src/context/SurvivalModeContext.jsx) - Provider
- [useSafeApiFetch.js](apps/frontend/src/context/useSafeApiFetch.js) - Hook React
- [SurvivalModeBlockedBanner.jsx](apps/frontend/src/components/SurvivalModeBlockedBanner.jsx) - UI
- [OwnerDashboard.jsx](apps/frontend/src/pages/owner/OwnerDashboard.jsx) - Exemplo
