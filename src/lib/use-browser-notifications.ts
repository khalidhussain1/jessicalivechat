"use client";

export function notificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return "denied";
  return Notification.requestPermission();
}

export function showNotification(title: string, body: string) {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  try {
    const notification = new Notification(title, {
      body,
      icon: "/icons/icon-192.png",
      tag: "jessica-chat-message",
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    // some browsers (notably iOS Safari outside PWA) don't support the Notification
    // constructor at all — never let that break the chat
  }
}
