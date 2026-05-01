# Guia de Estabilidade Visual - Componentes de Carregamento

## Problema Resolvido

❌ **Antes**: Interface tremendo, piscando, elementos se movendo durante carregamento  
✅ **Depois**: Interface sólida, confiável, visual estável e profissional

---

## Componentes Criados

### 1. **SkeletonLoader.jsx**
Placeholders que reservam espaço enquanto dados carregam

```jsx
import SkeletonLoader from "../components/SkeletonLoader"

// Opções de tipos
<SkeletonLoader type="card" count={3} />      // Cartões
<SkeletonLoader type="table" count={5} />     // Tabela
<SkeletonLoader type="section" />              // Seção
<SkeletonLoader type="dashboard" />            // Dashboard inteiro
<SkeletonLoader type="list" count={4} />      // Lista
```

**Benefícios:**
- Mantém espaço reservado (sem layout shift)
- Animação shimmer elegante
- Parece que algo está acontecendo

---

### 2. **LoadingState.jsx**
Gerencia estados de carregamento, erro e sucesso

```jsx
import LoadingState from "../components/LoadingState"

// Inline (dentro de container)
<LoadingState 
  isLoading={loading} 
  error={error}
  success={success}
  message="Carregando dados..." 
  type="inline"
/>

// Tipos disponíveis
type="inline"    // Dentro de um container
type="overlay"   // Cobre a tela inteira
type="minimal"   // Apenas ícone
type="banner"    // No topo/fundo
```

**Benefícios:**
- Feedback visual consistente
- Múltiplos tipos para diferentes contextos
- Transições suaves

---

## Como Integrar em Suas Páginas

### Exemplo 1: Dashboard com Skeleton

```jsx
import SkeletonLoader from "../components/SkeletonLoader"
import LoadingState from "../components/LoadingState"

function StudentDashboard() {
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState([])
  const [error, setError] = useState("")

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const data = await apiFetch("/classes/my-classes", { token })
      setClasses(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="Dashboard" subtitle="Bem-vindo!" />
      
      {loading ? (
        <SkeletonLoader type="dashboard" />
      ) : error ? (
        <LoadingState 
          error={error} 
          type="inline"
          message="Erro ao carregar dados"
        />
      ) : (
        <div className="space-y-4">
          {/* Seu conteúdo aqui */}
          {classes.map(cls => (
            <div key={cls.id} className="card">
              {cls.name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

### Exemplo 2: Lista com Carregamento

```jsx
function TeacherAttendance() {
  const [loading, setLoading] = useState(false)
  const [students, setStudents] = useState([])
  const [error, setError] = useState("")

  const loadAttendance = async () => {
    setLoading(true)
    setError("")
    try {
      const data = await apiFetch("/attendance/class/{id}", { token })
      setStudents(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <button onClick={loadAttendance} disabled={loading}>
        Carregar Presença
      </button>

      {loading && <SkeletonLoader type="table" count={10} />}
      
      {error && (
        <LoadingState error={error} type="inline" />
      )}

      {!loading && !error && (
        <table>
          {/* Seus dados */}
        </table>
      )}
    </div>
  )
}
```

### Exemplo 3: Formulário com Submissão

```jsx
function LoginForm() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setSuccess(false)

    try {
      await apiFetch("/auth/login", {
        method: "POST",
        body: { email, password }
      })
      setSuccess(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input type="email" placeholder="Email" />
      <input type="password" placeholder="Senha" />
      
      <button 
        type="submit" 
        disabled={loading}
        className="primary-button"
      >
        {loading ? "Conectando..." : "Entrar"}
      </button>

      <LoadingState
        isLoading={loading}
        error={error}
        success={success}
        message={success ? "Login bem-sucedido!" : ""}
        type="banner"
      />
    </form>
  )
}
```

---

## Melhores Práticas

### ✅ DO's

1. **Use Skeleton Loaders para dados esperados**
   - Mostre placeholder enquanto carrega
   - Mantém altura consistente da página

2. **Sempre tenha um estado de erro**
   - Mensagens claras
   - Botão de retry

3. **Transições suaves**
   - Fade in/out dos dados
   - Não aparecer/desaparecer abruptamente

4. **Estados claros**
   - Loading → Dados/Erro → Sucesso

### ❌ DON'Ts

1. **Não mostre apenas "Carregando..."**
   - Use um skeleton em vez disso
   - Mais visual e profissional

2. **Não deixe elementos se moverem**
   - Use alturas fixas ou min-height
   - Reserve espaço para conteúdo

3. **Não ignore erros**
   - Sempre mostre feedback
   - Dê opção de retry

4. **Não use animações abruptas**
   - Prefira transições suaves
   - Duration de 200-300ms

---

## Customização

### Cores personalizadas

```css
/* Edite SkeletonLoader.css */
.skeleton-base {
  background: linear-gradient(
    90deg,
    rgba(sua-cor, 0.5) 0%,
    rgba(sua-cor-mais-clara, 0.5) 20%,
    rgba(sua-cor, 0.5) 40%
  );
}
```

### Velocidade de animação

```css
/* Edite SkeletonLoader.css */
@keyframes shimmer {
  /* Mude 2s para 3s para mais lento, 1s para mais rápido */
  animation: shimmer 2s infinite;
}
```

---

## Performance

- Skeleton loaders usam CSS puro (sem JavaScript)
- Animações otimizadas com GPU
- Suporte a reduced-motion para acessibilidade
- Tamanho mínimo de bundle

---

## Exemplos de Componentes Prontos

- `SkeletonLoader type="dashboard"` - Dashboard inteira
- `SkeletonLoader type="card" count={3}` - 3 cartões
- `SkeletonLoader type="table" count={10}` - Tabela de 10 linhas
- `SkeletonLoader type="list" count={5}` - Lista de 5 itens
- `LoadingState type="banner"` - Banner de progresso

---

## Checklist de Implementação

Ao implementar em uma página:

- [ ] Adicione estado `loading`
- [ ] Adicione estado `error`
- [ ] Use SkeletonLoader enquanto loading
- [ ] Use LoadingState para erros
- [ ] Teste com rede lenta (DevTools)
- [ ] Teste estados: loading, success, error
- [ ] Verifique layout não se move
- [ ] Verifique animações suaves

---

## Suporte

Se encontrar problemas:

1. Verifique se os CSS estão importados
2. Verifique estado loading/error
3. Teste em DevTools com rede lenta
4. Verifique console para erros
5. Compare com exemplo acima

---

**Versão**: 1.0  
**Data**: Abril 2026  
**Status**: Pronto para uso
