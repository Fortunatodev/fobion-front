import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  Users,
  Wrench,
  CreditCard,
  Crown,
  Settings,
  Wallet,
  type LucideIcon,
} from "lucide-react"

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  /** Visível só para o dono (OWNER); escondido para EMPLOYEE. Espelha o Sidebar. */
  ownerOnly?: boolean
}

export interface NavGroup {
  label?: string
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  {
    items: [
      // RBAC: Dashboard (resumo financeiro) é gerencial → escondido do EMPLOYEE.
      { label: "Dashboard", href: "/dashboard",       icon: LayoutDashboard, ownerOnly: true },
      { label: "Agenda",    href: "/dashboard/agenda", icon: CalendarDays },
    ],
  },
  {
    label: "GESTÃO",
    items: [
      // Operacional (visível pro funcionário): só Agendamentos. O resto é gestão (ownerOnly).
      { label: "Agendamentos", href: "/dashboard/agendamentos", icon: ClipboardList },
      { label: "Clientes",     href: "/dashboard/clientes",     icon: Users, ownerOnly: true },
      { label: "Serviços",     href: "/dashboard/servicos",     icon: Wrench, ownerOnly: true },
      { label: "Planos",       href: "/dashboard/planos",       icon: CreditCard, ownerOnly: true },
      { label: "Assinantes",   href: "/dashboard/assinantes",   icon: Crown, ownerOnly: true },
      { label: "Repasses",     href: "/dashboard/relatorios/repasses", icon: Wallet, ownerOnly: true },
    ],
  },
  {
    label: "CONTA",
    items: [
      { label: "Configurações", href: "/dashboard/configuracoes", icon: Settings, ownerOnly: true },
    ],
  },
]