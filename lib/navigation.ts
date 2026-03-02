import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  Users,
  Wrench,
  CreditCard,
  Crown,
  Settings,
  type LucideIcon,
} from "lucide-react"

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
}

export interface NavGroup {
  label?: string
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  {
    items: [
      { label: "Dashboard", href: "/dashboard",       icon: LayoutDashboard },
      { label: "Agenda",    href: "/dashboard/agenda", icon: CalendarDays },
    ],
  },
  {
    label: "GESTÃO",
    items: [
      { label: "Agendamentos", href: "/dashboard/agendamentos", icon: ClipboardList },
      { label: "Clientes",     href: "/dashboard/clientes",     icon: Users },
      { label: "Serviços",     href: "/dashboard/servicos",     icon: Wrench },
      { label: "Planos",       href: "/dashboard/planos",       icon: CreditCard },
      { label: "Assinantes",   href: "/dashboard/assinantes",   icon: Crown },
    ],
  },
  {
    label: "CONTA",
    items: [
      { label: "Configurações", href: "/dashboard/configuracoes", icon: Settings },
    ],
  },
]