import { observer } from "mobx-react-lite";
import { useRootStore } from "@/stores/RootStore";
import {
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const SyncIndicator = observer(function SyncIndicator() {
  const { syncStatus } = useRootStore();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const dotColor = (() => {
    if (syncStatus.lastError) return "bg-red-500";
    if (syncStatus.connectionStatus === "offline") return "bg-amber-500";
    if (syncStatus.progress.phase !== "idle") return "bg-blue-500";
    return "bg-emerald-500";
  })();

  const statusText = (() => {
    if (syncStatus.connectionStatus === "offline") return "Offline";
    if (syncStatus.progress.phase === "pull") return "Pulling...";
    if (syncStatus.progress.phase === "push") return "Pushing...";
    if (syncStatus.progress.phase === "reconcile") return "Reconciling...";
    if (syncStatus.lastError) return "Sync error";
    return "Synced";
  })();

  const lastSyncLabel = syncStatus.lastSyncAt
    ? `Last sync: ${new Date(syncStatus.lastSyncAt).toLocaleTimeString()}`
    : null;

  const content = (
    <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-sidebar-foreground/70">
      <div
        className={`size-2 shrink-0 rounded-full ${dotColor} ${
          syncStatus.progress.phase !== "idle" ? "animate-pulse" : ""
        }`}
      />
      {!collapsed && (
        <div className="flex flex-1 items-center justify-between gap-2 overflow-hidden">
          <span className="truncate">{statusText}</span>
          <div className="flex items-center gap-1.5">
            {syncStatus.pendingOutboxCount > 0 && (
              <span className="text-sidebar-foreground/50">
                {syncStatus.pendingOutboxCount} pending
              </span>
            )}
            {lastSyncLabel && !syncStatus.lastError && (
              <span className="text-sidebar-foreground/40 truncate">
                {lastSyncLabel}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (syncStatus.lastError && !collapsed) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          {content}
          <div className="px-2 pb-1.5 text-[10px] text-red-500 truncate">
            {syncStatus.lastError}
          </div>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  if (collapsed) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex justify-center py-1.5 cursor-default">
                <div
                  className={`size-2 rounded-full ${dotColor} ${
                    syncStatus.progress.phase !== "idle" ? "animate-pulse" : ""
                  }`}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{statusText}</p>
              {syncStatus.pendingOutboxCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  {syncStatus.pendingOutboxCount} pending
                </p>
              )}
              {lastSyncLabel && (
                <p className="text-xs text-muted-foreground">{lastSyncLabel}</p>
              )}
              {syncStatus.lastError && (
                <p className="text-xs text-red-500">{syncStatus.lastError}</p>
              )}
            </TooltipContent>
          </Tooltip>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>{content}</SidebarMenuItem>
    </SidebarMenu>
  );
});
