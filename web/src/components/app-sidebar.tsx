import {
  Brain,
  Compass,
  MoreHorizontal,
} from "lucide-react";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { SyncIndicator } from "@/components/sync-indicator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Link } from "react-router";
import { Logo } from "./logo";
import { useAuth } from "@/hooks/use-auth";
import { useMemo } from "react";

const data = {
  navMain: [
    {
      title: "Intelligence",
      url: "/ask",
      icon: Brain,
      isActive: true,
      items: [
        {
          title: "Ask",
          url: "/ask",
        },
        {
          title: "NL Input",
          url: "/nl-input",
        },
      ],
    },
    {
      title: "Explore",
      url: "/entities",
      icon: Compass,
      isActive: true,
      items: [
        {
          title: "Entities",
          url: "/entities",
        },
        {
          title: "Graph",
          url: "/graph",
        },
        {
          title: "Map",
          url: "/map",
        },
      ],
    },
    {
      title: "More",
      url: "/intel",
      icon: MoreHorizontal,
      isActive: false,
      items: [
        {
          title: "Intel",
          url: "/intel",
        },
        {
          title: "Relations",
          url: "/relations",
        },
        {
          title: "Path Finder",
          url: "/path-finder",
        },
        {
          title: "Timeline",
          url: "/timeline",
        },
        {
          title: "Sources",
          url: "/sources",
        },
        {
          title: "Tags",
          url: "/tags",
        },
      ],
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuth();

  const navUser = useMemo(() => {
    if (!user) {
      return {
        name: "Guest",
        email: "",
        avatar: "",
      };
    }
    return {
      name: user.entity?.data?.["name"] || "User",
      email: user.email,
      avatar: "",
    };
  }, [user]);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="w-full" asChild>
              <Link to="#">
                <div className="flex aspect-square size-8 p-1.5 items-center justify-center">
                  <Logo className="text-sidebar-primary w-full" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Tether</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <SyncIndicator />
        <NavUser user={navUser} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
