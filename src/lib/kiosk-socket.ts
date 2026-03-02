"use client";

import { io, Socket } from "socket.io-client";

let kioskSocket: Socket | null = null;

export function connectKioskSocket(): Socket {
  if (!kioskSocket) {
    kioskSocket = io(`${process.env.NEXT_PUBLIC_API_URL}/kiosk`, {
      transports: ["websocket", "polling"],
      withCredentials: true,
    });

    kioskSocket.on("connect_error", (error) => {
      console.error("[KioskSocket] Connection error:", error.message);
    });
  }

  return kioskSocket;
}

export function disconnectKioskSocket(): void {
  if (kioskSocket) {
    kioskSocket.disconnect();
    kioskSocket = null;
  }
}
