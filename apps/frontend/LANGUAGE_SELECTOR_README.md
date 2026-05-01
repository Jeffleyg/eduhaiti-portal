# Sistema de Seletor de Idioma Global

## Visão Geral

Você agora tem um sistema completo de seleção de idiomas globais que permite aos usuários escolher qualquer idioma suportado. O sistema suporta:

- **Francês** (fr) - Idioma principal
- **Crioulo Haitiano** (ht) - Idioma complementar
- **Português Brasileiro** (pt) - Novo suporte
- **+40 idiomas** via tradução automática

## Características

✅ **Seletor de Idioma Global** - Dropdown com todos os idiomas disponíveis
✅ **Detecção Automática** - Detecta o idioma do navegador
✅ **Persistência** - Salva a preferência no localStorage
✅ **Tradução Automática** - Usa LibreTranslate para idiomas não traduzidos
✅ **Cache** - Armazena traduções para performance
✅ **Responsivo** - Funciona bem em mobile e desktop

## Componentes Incluídos

### 1. **LanguageSelector.jsx**
Componente visual do seletor de idiomas
- Localização: `src/components/LanguageSelector.jsx`
- Uso: Substituiu o botão simples de alternância

### 2. **translationService.js**
Serviço de tradução automática
- Localização: `src/lib/translationService.js`
- Funções principais:
  - `translateText()` - Traduz um texto
  - `translateObject()` - Traduz um objeto inteiro
  - `getSupportedLanguages()` - Lista idiomas suportados
  - `translationCache` - Cache de traduções

### 3. **LanguageSelector.css**
Estilos do seletor
- Localização: `src/styles/LanguageSelector.css`
- Design elegante e responsivo

### 4. **ptTranslations.js**
Traduções em Português Brasileiro
- Localização: `src/lib/ptTranslations.js`
- Contém todas as chaves traduzidas

## Como Usar

### Usar o Seletor de Idioma
Importe o componente onde quiser usar:

```jsx
import LanguageSelector from "../components/LanguageSelector"

function MyComponent() {
  return (
    <div>
      <LanguageSelector />
    </div>
  )
}
```

### Adicionar um Novo Idioma

#### Opção 1: Com Traduções Completas (Recomendado)

1. **Crie um arquivo de traduções**:
```javascript
// src/lib/esTranslations.js
const esTranslation = {
  brand: "Portal de Educación",
  tagline: "Portal educativo para gestión escolar clara y colaborativa.",
  // ... todas as outras chaves
}
export default esTranslation
```

2. **Atualize i18n.js**:
```javascript
import esTranslation from "./lib/esTranslations.js"

const resources = {
  // ... outros idiomas
  es: {
    translation: esTranslation,
  },
}
```

#### Opção 2: Com Tradução Automática

Se não quiser traduzir todos os textos manualmente, o sistema pode usar tradução automática via LibreTranslate:

```jsx
// No seu componente
import { translateObject } from "../lib/translationService"

// Quando o usuário selecionar um idioma não suportado
const translations = await translateObject(frenchTranslations, 'es', 'fr')
```

## Linguagens Suportadas (por padrão)

Linguagens com tradução manual completa:
- 🇫🇷 Francês (fr)
- 🇭🇹 Crioulo Haitiano (ht)
- 🇧🇷 Português (pt)

Linguagens com suporte automático (40+):
- Inglês, Espanhol, Alemão, Italiano, Russo, Chinês, Árabe, Hindi, Japonês, e mais...

## Detalhamento de Funcionalidades

### Detecção Automática de Idioma
O sistema detecta o idioma do navegador na seguinte ordem:
1. Preferência salva no localStorage
2. Idioma do navegador (navigator)
3. Fallback padrão: Francês

### Cache de Traduções
As traduções automáticas são armazenadas por 24 horas:
- Armazenadas no localStorage com prefix `translation_cache_`
- Podem ser limpas com `translationCache.clear()`
- Expiram automaticamente

### Tratamento de Erros
- Se a tradução falhar, o texto original é retornado
- Erros são logados no console
- Nenhuma interrupção da experiência do usuário

## Performance

- Tradução automática é assíncrona (não bloqueia a UI)
- Cache reduz chamadas à API de tradução
- Componente é otimizado para re-renders

## Próximos Passos

1. **Adicionar mais idiomas** com traduções manuais (e.g., Espanhol)
2. **Melhorar** textos de português (enviar PRs)
3. **Expandir** suporte a mais idiomas especializados se necessário

## Troubleshooting

### Seletor não aparece
- Verifique se LanguageSelector está importado corretamente
- Verifique console para erros de import

### Idioma não muda
- Limpe o cache: `translationCache.clear()`
- Verifique localStorage: `localStorage.removeItem('preferredLanguage')`
- Recarregue a página

### Tradução automática lenta
- Aguarde (primeira chamada é mais lenta)
- Verifique conexão com internet
- Verifique se LibreTranslate está disponível

## API Referência

### translationService.js

```javascript
// Traduzir um texto
await translateText(
  "Olá mundo",      // texto
  "fr",              // idioma alvo
  "pt"               // idioma origem (padrão: "fr")
)

// Traduzir objeto inteiro
await translateObject(
  { brand: "Portal", tagline: "..." },
  "es",
  "fr"
)

// Obter idiomas suportados
getSupportedLanguages()
// Retorna: [{ code: "en", name: "English", nativeName: "English" }, ...]

// Cache
translationCache.get('key')
translationCache.set('key', value, expiresInHours)
translationCache.isExpired('key')
translationCache.clear()
```

## Suporte

Para problemas ou dúvidas, verifique:
- Console do navegador para mensagens de erro
- localStorage para preferências salvas
- Arquivo de log de tradução automática

---

**Versão**: 1.0
**Data**: Abril 2026
**Status**: Produção
