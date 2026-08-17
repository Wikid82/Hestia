import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { WSEvent } from "@/types";

// Connects to the backend's /api/ws endpoint and invalidates the
// relevant react-query caches when a chore/reward event comes in, so
// every open tab/kiosk screen stays in sync without polling.
export function useRealtime(enabled: boolean) {
  const queryClient = useQueryClient();
  const enabledRef = useRef(enabled);

  useEffect(() => {
    enabledRef.current = enabled;
  });

  useEffect(() => {
    if (!enabled) return;

    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closedByCleanup = false;

    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${protocol}//${window.location.host}/api/ws`);

      socket.onmessage = (event) => {
        let payload: WSEvent;
        try {
          payload = JSON.parse(event.data);
        } catch {
          return;
        }

        switch (payload.type) {
          case "chore.completed":
          case "chore.uncompleted":
            queryClient.invalidateQueries({ queryKey: ["chores"] });
            queryClient.invalidateQueries({ queryKey: ["members"] });
            break;
          case "reward.redeemed":
            queryClient.invalidateQueries({ queryKey: ["rewards"] });
            queryClient.invalidateQueries({ queryKey: ["members"] });
            break;
        }
      };

      socket.onclose = () => {
        if (closedByCleanup || !enabledRef.current) return;
        reconnectTimer = setTimeout(connect, 2000);
      };
    }

    connect();

    return () => {
      closedByCleanup = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [enabled, queryClient]);
}
