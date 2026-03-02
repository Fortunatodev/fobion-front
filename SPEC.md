# Forbion — Product Specification

> Plataforma SaaS para estéticas automotivas.
> O dono gerencia tudo pelo painel. O cliente tem experiência premium para agendar.

***

## 1. Produto

**Nome:** Forbion  
**Tagline:** Eleve sua estética. Automatize sua gestão.  
**Modelo:** SaaS B2B2C — o dono paga a Forbion, os clientes do dono usam de graça.  
**Mercado:** Estéticas automotivas, lava-rápidos, detailers.

**Problema que resolve:**
O dono gerencia tudo no papel, WhatsApp e memória.
Perde agendamento, esquece cliente, não sabe quanto faturou.
A Forbion resolve com um sistema simples, bonito e que realmente funciona.

**Dois produtos em um:**
- Painel admin para o dono gerenciar o negócio
- Loja pública para o cliente agendar e assinar planos

***

## 2. Stack

**Backend**
- Runtime: Node.js + Express + TypeScript
- ORM: Prisma + PostgreSQL (Neon serverless)
- Auth: Google OAuth 2.0 + JWT (7 dias)
- Pagamentos: CactoPay (links externos)
- Upload: UploadThing

**Frontend**
- Framework: Next.js 15 App Router
- Language: TypeScript strict
- Styling: Tailwind CSS + Shadcn/ui
- Animations: Framer Motion
- Charts: Recharts
- HTTP: Axios
- Toast: Sonner
- Icons: Lucide React
- Fonts: Inter

**Variáveis de Ambiente**

    NEXT_PUBLIC_API_URL=http://localhost:3000
    NEXT_PUBLIC_APP_URL=http://localhost:3001

***

## 3. Design System

**Filosofia:** Dark, futurista, premium. Cada pixel tem intenção.
Inspiração: Linear.app + Vercel Dashboard + Stripe.
O usuário abre e pensa: nunca vi algo assim na minha vida.

**Paleta de Cores**

    --background:     #0A0A0A   base de tudo
    --surface:        #111111   cards, sidebar, modais
    --surface-2:      #161616   hover rows, fundos internos
    --border:         #1F1F1F   bordas sutis
    --border-2:       #2F2F2F   bordas visíveis
    --muted:          #A1A1AA   textos secundários
    --white:          #FFFFFF   textos primários

    --primary:        #0066FF   azul principal
    --primary-hover:  #0052CC
    --primary-light:  #0066FF1A
    --primary-glow:   0 0 30px rgba(0,102,255,0.25)

    --purple:         #7C3AED   accent e gradientes
    --success:        #10B981
    --success-light:  #10B9811A
    --warning:        #F59E0B
    --warning-light:  #F59E0B1A
    --danger:         #EF4444
    --danger-light:   #EF44441A

**Tipografia**

    Hero titles:  48px / 700 / gradient #0066FF → #7C3AED
    Page titles:  28px / 700 / white
    Section:      18px / 600 / white
    Body:         14px / 400 / white
    Caption:      12px / 400 / muted

**Efeitos obrigatórios**
- Glassmorphism nos modais: backdrop-blur(12px) + bg rgba(17,17,17,0.9)
- Glow no botão primary: box-shadow 0 0 30px rgba(0,102,255,0.3)
- Grid animado no fundo do login (CSS keyframes)
- Gradient text nos títulos principais
- Micro-animações em TUDO com Framer Motion
- Cards com border que acende em #0066FF33 no hover
- Skeleton loaders em todas as listas (nunca spinner genérico)
- Transições de 200ms em todos os estados interativos
- Scrollbar: 6px, #2F2F2F, rounded

***

## 4. Arquitetura de Rotas

**Admin Panel**

    /auth/login                        login Google (única opção)
    /auth/callback?token=JWT           recebe JWT, salva, redireciona

    /dashboard                         overview + métricas + agenda do dia
    /dashboard/agenda                  timeline completa do dia
    /dashboard/agendamentos            lista + filtros + novo agendamento
    /dashboard/clientes                grid de clientes + detalhes
    /dashboard/servicos                CRUD de serviços
    /dashboard/planos                  CRUD de planos de assinatura
    /dashboard/assinantes              gestão de assinantes
    /dashboard/configuracoes           dados + visual + horários
    /dashboard/upgrade                 pricing Forbion PRO

**Loja Pública**

    /[slug]                            home da loja
    /[slug]/agendar                    fluxo de agendamento
    /[slug]/planos                     planos de assinatura
    /[slug]/minha-conta                área do cliente
    /[slug]/minha-conta/agendamentos   histórico do cliente

**Middleware**
- Todas as rotas `/dashboard/*` exigem JWT válido via cookie `forbion_token`
- Redirect automático para `/auth/login` se inválido ou expirado
- Redirect para `/dashboard` se tentar acessar login já autenticado

***

## 5. Backend API

**Base URL:** `http://localhost:3000/api`  
**Autenticação:** Bearer JWT no header Authorization  
**🔒** = rota protegida

**JWT Payload**

    {
      userId:     string
      businessId: string
      role:       "OWNER" | "STAFF"
      iat:        number
      exp:        number
    }

**Auth**

    GET  /auth/google                  inicia OAuth Google
    GET  /auth/google/callback         retorna JWT
    GET  /auth/me                      { user, business }  🔒

**Business**

    GET  /business                     dados + horários            🔒
    PUT  /business                     atualiza negócio            🔒
    PUT  /business/hours               atualiza horários           🔒
    POST /business/upload/logo         upload logo                 🔒
    POST /business/upload/cover        upload capa                 🔒
    GET  /billing/payment-link         link Forbion PRO            🔒

**Serviços**

    GET    /services                   lista                       🔒
    POST   /services                   cria                        🔒
    PUT    /services/:id               atualiza                    🔒
    DELETE /services/:id               remove (soft delete)        🔒

**Clientes**

    GET    /customers                  lista (search, page, limit) 🔒
    GET    /customers/:id              detalhes + veículos         🔒
    POST   /customers                  cria                        🔒
    PUT    /customers/:id              atualiza                    🔒
    DELETE /customers/:id              remove                      🔒
    POST   /customers/:id/vehicles     adiciona veículo            🔒
    PUT    /vehicles/:id               atualiza veículo            🔒
    DELETE /vehicles/:id               remove veículo              🔒

**Agendamentos**

    GET    /schedules                  lista (date, status, page)  🔒
    GET    /schedules/:id              detalhes completos          🔒
    POST   /schedules                  cria agendamento            🔒
    PUT    /schedules/:id/status       atualiza status             🔒
    PUT    /schedules/:id/close        fecha comanda + pagamento   🔒
    DELETE /schedules/:id              cancela                     🔒
    GET    /schedules/available-slots  slots livres (date,svcId)   🔒

**Planos**

    GET    /customer-plans             lista                       🔒
    POST   /customer-plans             cria                        🔒
    PUT    /customer-plans/:id         atualiza                    🔒
    DELETE /customer-plans/:id         remove                      🔒
    GET    /customer-plans/:id/payment-link  link CactoPay         🔒

**Assinaturas**

    GET  /customer-plans/subscriptions               lista         🔒
    POST /customer-plans/subscriptions               aplica plano  🔒
    PUT  /customer-plans/subscriptions/:id/activate  ativa         🔒
    PUT  /customer-plans/subscriptions/:id/cancel    cancela       🔒

**Loja Pública (sem auth)**

    GET  /public/:slug                 { business, services, plans, hours }

**⚠️ Rotas pendentes — criar antes dos prompts 16-21**

    GET  /public/:slug/available-slots
    POST /public/:slug/book
    POST /public/:slug/subscribe
    POST /public/customer/login
    GET  /public/customer/schedules

***

## 6. Data Models

**Service**

    id, businessId
    name: string
    description?: string
    price: number              centavos
    durationMinutes: number
    imageUrl?: string
    isActive: boolean
    createdAt: string

**Customer**

    id, businessId
    name: string
    phone: string              obrigatório
    email?: string
    notes?: string
    createdAt: string
    vehicles?: Vehicle[]
    _count?: { schedules, subscriptions }

**Vehicle**

    id, customerId, businessId
    plate: string              obrigatório
    brand?, model?, color?
    type: CAR | MOTORCYCLE | TRUCK | OTHER
    createdAt: string

**Schedule**

    id, businessId, customerId, vehicleId
    scheduledAt: string        ISO datetime
    status: PENDING | CONFIRMED | IN_PROGRESS | DONE | CANCELLED
    totalPrice: number         centavos
    paymentMethod?: PIX | CREDIT_CARD | DEBIT_CARD | CASH | PENDING
    paymentStatus: PENDING | PAID | CANCELLED
    isSubscriber: boolean
    discountApplied: number    centavos
    subscriptionId?: string
    notes?, closedAt?, closedById?
    createdAt: string
    customer?, vehicle?, services?: ScheduleService[]

**ScheduleService**

    id, scheduleId, serviceId
    priceSnapshot: number      preço no momento do agendamento
    service?: Service

**CustomerPlan**

    id, businessId
    name: string
    description?: string
    price: number              centavos por ciclo
    interval: MONTHLY | YEARLY
    discountPercent: number    % desconto nos serviços
    cactopayPaymentLink?: string
    isActive: boolean
    createdAt: string
    _count?: { subscriptions }

**CustomerSubscription**

    id, businessId, customerId, customerPlanId
    status: ACTIVE | CANCELLED | EXPIRED | PENDING
    startedAt: string
    cancelledAt?: string
    createdAt: string
    customer?, customerPlan?

**BusinessHours**

    id, businessId
    dayOfWeek: number          0=Dom, 1=Seg ... 6=Sáb
    isOpen: boolean
    openTime: string           HH:mm
    closeTime: string          HH:mm

***

## 7. Regras de Negócio

**Dois tipos de plano — nunca confundir:**
- `CustomerPlan` → plano que o dono vende aos clientes (Básico, Premium...)
- `Business.plan` → plano que o dono paga à Forbion (FREE, PRO, ENTERPRISE)

**Desconto de assinante:**
O backend calcula `discountApplied` automaticamente ao fechar comanda.
O frontend nunca calcula desconto — apenas exibe o que o backend retorna.

**Fechar comanda:**
Única rota: `PUT /schedules/:id/close` com `{ paymentMethod }`.
Backend atualiza `status → DONE` e `paymentStatus → PAID` atomicamente.

**Fluxo de assinatura (manual via CactoPay):**
1. Dono cria plano com link CactoPay cadastrado
2. Dono aplica plano ao cliente → status PENDING
3. Dono envia link pelo WhatsApp
4. Cliente paga externamente
5. Dono ativa no sistema → status ACTIVE
6. Descontos passam a valer nos próximos agendamentos

**Horários disponíveis:**
Backend calcula slots com base em `BusinessHours` e agendamentos existentes.
Frontend nunca calcula disponibilidade — sempre consome a API.

**Slug na URL:**
Loja pública usa sempre o slug. Nenhuma rota pública expõe IDs internos.

***

## 8. Fluxos Críticos

**Fechar Comanda**
1. Botão "Fechar" em agendamento CONFIRMED ou IN_PROGRESS
2. Modal: cliente, serviço, valor original
3. Se assinante: desconto destacado em verde
4. Seleciona pagamento: PIX / Cartão / Débito / Dinheiro
5. Confirma → PUT /schedules/:id/close
6. Toast de sucesso com valor cobrado
7. Lista atualiza automaticamente

**Novo Agendamento (stepper 3 passos)**
1. Busca cliente por telefone → se não existe, cria (nome + tel + placa)
2. Seleciona serviços (checkbox com preço, duração, total)
3. Escolhe data e horário disponível (grid visual)
4. POST /schedules

**Aplicar Plano a Cliente**
1. Botão "Aplicar plano" na página de assinantes
2. Seleciona cliente (busca por nome/telefone)
3. Seleciona plano
4. POST /customer-plans/subscriptions → status PENDING
5. Botão "Enviar link" → abre WhatsApp com mensagem + link
6. Dono confirma pagamento → PUT .../activate → status ACTIVE

**Agendamento pela Loja Pública**
1. Cliente acessa /[slug]
2. Clica em agendar → /[slug]/agendar
3. Serviço → data → horário → dados pessoais → confirmação
4. Tela de sucesso com resumo e botão WhatsApp

***

## 9. Padrões de Código

- TypeScript strict — zero `any`
- Comentários JSDoc em todas as funções exportadas
- try/catch + toast.error em 100% dos requests
- Loading state em toda ação assíncrona
- Empty state em toda lista possivelmente vazia
- Skeleton loader em todo conteúdo assíncrono
- Nomes de variáveis em inglês, comentários em português
- Imports: libs externas → libs internas → tipos
