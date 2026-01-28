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
    Sun,
    Moon,
    Monitor,
    Check,
    Database,
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
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from '../../../components/ui/dropdown-menu';
import { useTheme, Theme } from '../../../contexts/ThemeContext';
import { useSidebar } from '../../../components/ui/sidebar';

export type TabId = 'command-center' | 'ask-platovue' | 'diagnose' | 'plan' | 'settings';

interface DataStats {
    candidateCount: number;
    reqCount: number;
    lastUpdated: Date | null;
}

interface AppSidebarProps {
    activeTab: TabId;
    onTabChange: (tab: TabId) => void;
    userEmail?: string;
    onSignOut?: () => void;
    dataStats?: DataStats;
    onNavigateToDataImport?: () => void;
}

const STALE_THRESHOLD_DAYS = 7;

function isDataStale(lastUpdated: Date | null): boolean {
    if (!lastUpdated) return false;
    const now = new Date();
    const diffMs = now.getTime() - new Date(lastUpdated).getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays > STALE_THRESHOLD_DAYS;
}

function formatLastUpdated(lastUpdated: Date | null): string {
    if (!lastUpdated) return 'Never';
    const now = new Date();
    const date = new Date(lastUpdated);
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return date.toLocaleDateString();
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

const themeOptions: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: 'light', label: 'Light', icon: <Sun className="w-4 h-4" /> },
    { value: 'dark', label: 'Dark', icon: <Moon className="w-4 h-4" /> },
    { value: 'system', label: 'System', icon: <Monitor className="w-4 h-4" /> },
];

export function AppSidebar({ activeTab, onTabChange, userEmail, onSignOut, dataStats, onNavigateToDataImport }: AppSidebarProps) {
    const { theme, setTheme } = useTheme();
    const { state } = useSidebar();
    const isCollapsed = state === 'collapsed';
    const stale = dataStats ? isDataStale(dataStats.lastUpdated) : false;

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

            {/* Data Stats - compact display, clickable to update */}
            {dataStats && dataStats.candidateCount > 0 && (
                <button
                    type="button"
                    onClick={onNavigateToDataImport}
                    className={`w-full px-3 py-2 border-t border-sidebar-border text-left transition-colors hover:bg-sidebar-accent/50 ${isCollapsed ? 'hidden' : ''}`}
                    title={stale ? 'Data may be outdated. Click to update.' : 'Click to update data'}
                >
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Database className={`h-3 w-3 ${stale ? 'text-warning' : 'text-sidebar-foreground/50'}`} />
                        <span>{dataStats.candidateCount.toLocaleString()}</span>
                        <span className="opacity-50">•</span>
                        <span>{dataStats.reqCount} reqs</span>
                        {stale && (
                            <span className="ml-auto flex items-center gap-1 text-warning">
                                <span className="relative flex h-1.5 w-1.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-warning"></span>
                                </span>
                            </span>
                        )}
                    </div>
                    <div className={`text-[10px] mt-0.5 pl-[18px] ${stale ? 'text-warning/80' : 'text-muted-foreground/70'}`}>
                        {formatLastUpdated(dataStats.lastUpdated)}
                        {stale && ' · Refresh recommended'}
                    </div>
                </button>
            )}

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
                                <DropdownMenuLabel className="text-xs text-muted-foreground">Theme</DropdownMenuLabel>
                                {themeOptions.map((option) => (
                                    <DropdownMenuItem
                                        key={option.value}
                                        onClick={() => setTheme(option.value)}
                                        className="flex items-center justify-between"
                                    >
                                        <span className="flex items-center gap-2">
                                            {option.icon}
                                            {option.label}
                                        </span>
                                        {theme === option.value && <Check className="w-4 h-4" />}
                                    </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator />
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
