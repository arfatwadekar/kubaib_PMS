export interface Notification {

  webNotificationId: number;

  name: string;

  email?: string;

  phone?: string;

  phoneNumber?: string;

  message?: string;

  createdOn: string;

  isRead: boolean;

  // UI state
  isDeleting?: boolean;

}