import Link from "next/link";
import {
  Home,
  ClipboardList,
  UserPlus,
  BedDouble,
  BarChart3,
  XCircle,
  MessageCircle,
  UtensilsCrossed,
  Sparkle,
  ConciergeBell,
  Settings,
  Palette,
  FileText,
  Image as ImageIcon,
  HelpCircle,
  Sparkles,
  MessageSquareQuote,
  Mail,
  Star,
  Users,
  ScrollText,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { NavLink } from "@/components/public/nav-link";

export type Role = "receptionist" | "manager" | "super_admin";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  minRole: Role;
  // For section-root URLs like "/dashboard" or "/admin/pages" where deeper
  // routes (e.g. "/dashboard/rooms" or "/admin/pages/home") exist as siblings
  // rather than children of this item, set exact so prefix-matching doesn't
  // light it up.
  exact?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

// Single source of truth for back-office navigation. Both the dashboard and
// admin layouts render this same component so a super_admin sees one
// consistent sidebar — instead of bouncing between two confusingly-different
// "portals". Items are filtered by role at render time.
const GROUPS: NavGroup[] = [
  {
    label: "Today",
    items: [
      { href: "/dashboard", label: "Overview", icon: Home, minRole: "receptionist", exact: true },
      { href: "/dashboard/bookings", label: "Bookings", icon: ClipboardList, minRole: "receptionist" },
      { href: "/dashboard/walk-in", label: "Walk-in", icon: UserPlus, minRole: "receptionist" },
      { href: "/dashboard/cancellations", label: "Cancellations", icon: XCircle, minRole: "receptionist" },
      { href: "/dashboard/service-requests", label: "Service requests", icon: ConciergeBell, minRole: "receptionist" },
      { href: "/dashboard/chat", label: "Chat", icon: MessageCircle, minRole: "receptionist" },
    ],
  },
  {
    label: "Catalog",
    items: [
      { href: "/dashboard/rooms", label: "Rooms", icon: BedDouble, minRole: "manager" },
      { href: "/dashboard/menu", label: "Menu", icon: UtensilsCrossed, minRole: "manager" },
      { href: "/dashboard/services-manage", label: "Services", icon: Sparkle, minRole: "manager" },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/pages", label: "Pages", icon: FileText, minRole: "super_admin", exact: false },
      { href: "/admin/gallery", label: "Gallery", icon: ImageIcon, minRole: "super_admin" },
      { href: "/admin/faqs", label: "FAQs", icon: HelpCircle, minRole: "super_admin" },
      { href: "/admin/amenities", label: "Amenities", icon: Sparkles, minRole: "super_admin" },
      { href: "/admin/testimonials", label: "Testimonials", icon: MessageSquareQuote, minRole: "super_admin" },
      { href: "/admin/reviews", label: "Google reviews", icon: Star, minRole: "super_admin" },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/dashboard/reports", label: "Reports", icon: BarChart3, minRole: "manager" },
      { href: "/admin/settings", label: "Site settings", icon: Settings, minRole: "super_admin" },
      { href: "/admin/branding", label: "Branding", icon: Palette, minRole: "super_admin" },
      { href: "/admin/templates", label: "Email templates", icon: Mail, minRole: "super_admin" },
      { href: "/admin/staff", label: "Staff", icon: Users, minRole: "super_admin" },
      { href: "/admin/audit", label: "Audit log", icon: ScrollText, minRole: "super_admin" },
    ],
  },
];

const RANK: Record<Role, number> = {
  receptionist: 1,
  manager: 2,
  super_admin: 3,
};

const ROLE_LABEL: Record<Role, string> = {
  receptionist: "Reception",
  manager: "Manager",
  super_admin: "Super admin",
};

function canSee(userRole: Role, minRole: Role) {
  return RANK[userRole] >= RANK[minRole];
}

export function BackOfficeNav({
  hotelName,
  role,
}: {
  hotelName: string;
  role: Role;
}) {
  const visibleGroups = GROUPS
    .map((g) => ({ ...g, items: g.items.filter((i) => canSee(role, i.minRole)) }))
    .filter((g) => g.items.length > 0);

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-border/60 bg-card">
      <Link href="/dashboard" className="flex items-center gap-3 border-b border-border/60 p-5">
        <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-accent" />
        <div className="min-w-0">
          <p className="truncate font-display text-base font-semibold">{hotelName}</p>
          <p className="text-xs text-muted-foreground">Back office</p>
        </div>
      </Link>

      <nav className="flex-1 space-y-5 overflow-y-auto p-3">
        {visibleGroups.map((g) => (
          <div key={g.label}>
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {g.label}
            </p>
            <div className="space-y-0.5">
              {g.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink key={item.href} href={item.href} exact={item.exact}>
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-border/60 p-3">
        <div className="mb-2 flex items-center gap-3 rounded-md bg-muted/60 px-3 py-2">
          <Avatar name={ROLE_LABEL[role]} size={32} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">Signed in</p>
            <p className="truncate text-xs text-muted-foreground">{ROLE_LABEL[role]}</p>
          </div>
        </div>
        <form action="/logout" method="post">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
