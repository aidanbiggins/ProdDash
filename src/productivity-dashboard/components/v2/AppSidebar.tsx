'use client';

import React from 'react';
import {
    LayoutDashboard,
    MessageSquare,
    Stethoscope,
    CalendarClock,
    Settings,
    ChevronUp,
    User2,
} from 'lucide-react';

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
} from '../../../components/ui/sidebar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';

export type TabId = 'command-center' | 'ask-platovue' | 'diagnose' | 'plan' | 'settings';

interface AppSidebarProps {
    activeTab: TabId;
    onTabChange: (tab: TabId) => void;
    userEmail?: string;
    onSignOut?: () => void;
}

const mainNavItems: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'command-center', label: 'Command Center', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'ask-platovue', label: 'Ask PlatoVue', icon: <MessageSquare className="w-4 h-4" /> },
];

const analyzeItems: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'diagnose', label: 'Diagnose', icon: <Stethoscope className="w-4 h-4" /> },
    { id: 'plan', label: 'Plan', icon: <CalendarClock className="w-4 h-4" /> },
];

const settingsItems: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
];

export function AppSidebar({ activeTab, onTabChange, userEmail, onSignOut }: AppSidebarProps) {
    return (
        <Sidebar collapsible="icon">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            size="lg"
                            onClick={() => onTabChange('command-center')}
                            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                        >
                            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                                <LayoutDashboard className="size-4" />
                            </div>
                            <div className="grid flex-1 text-left text-sm leading-tight">
                                <span className="truncate font-semibold">PlatoVue</span>
                                <span className="truncate text-xs text-muted-foreground">AI Recruiting</span>
                            </div>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                {/* Main Navigation */}
                <SidebarGroup>
                    <SidebarGroupLabel>Navigation</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {mainNavItems.map((item) => (
                                <SidebarMenuItem key={item.id}>
                                    <SidebarMenuButton
                                        onClick={() => onTabChange(item.id)}
                                        isActive={activeTab === item.id}
                                        tooltip={item.label}
                                    >
                                        {item.icon}
                                        <span className="text-slate-700 dark:text-slate-300 group-data-[active=true]/menu-button:text-white dark:group-data-[active=true]/menu-button:text-white">{item.label}</span>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                {/* Analyze Section */}
                <SidebarGroup>
                    <SidebarGroupLabel>Analyze</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {analyzeItems.map((item) => (
                                <SidebarMenuItem key={item.id}>
                                    <SidebarMenuButton
                                        onClick={() => onTabChange(item.id)}
                                        isActive={activeTab === item.id}
                                        tooltip={item.label}
                                    >
                                        {item.icon}
                                        <span>{item.label}</span>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                {/* Settings Section */}
                <SidebarGroup className="mt-auto">
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {settingsItems.map((item) => (
                                <SidebarMenuItem key={item.id}>
                                    <SidebarMenuButton
                                        onClick={() => onTabChange(item.id)}
                                        isActive={activeTab === item.id}
                                        tooltip={item.label}
                                    >
                                        {item.icon}
                                        <span>{item.label}</span>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <SidebarMenuButton
                                    size="lg"
                                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                                >
                                    <User2 className="size-4" />
                                    <div className="grid flex-1 text-left text-sm leading-tight">
                                        <span className="truncate font-semibold">Account</span>
                                        <span className="truncate text-xs text-muted-foreground">
                                            {userEmail || 'Not signed in'}
                                        </span>
                                    </div>
                                    <ChevronUp className="ml-auto size-4" />
                                </SidebarMenuButton>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                                side="top"
                                align="end"
                                sideOffset={4}
                            >
                                <DropdownMenuItem onClick={onSignOut}>
                                    Sign out
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>

            <SidebarRail />
        </Sidebar>
    );
}

export default AppSidebar;
