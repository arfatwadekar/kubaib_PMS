export interface Notification {
  webNotificationId?: number;
  name: string;
  email: string;

  // 👇 ADD THIS
  phone?: string;      // agar backend se "phone" aata hai
  phoneNumber?: string; // agar backend se "phoneNumber" aata hai

  message: string;
  createdOn: string;
  isRead: boolean;
}