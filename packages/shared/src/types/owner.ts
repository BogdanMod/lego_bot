export type OwnerRole = 'owner' | 'admin' | 'staff' | 'viewer';

export type OwnerEventStatus = 'new' | 'in_progress' | 'done' | 'cancelled';
export type OwnerEventPriority = 'low' | 'normal' | 'high';

export interface OwnerBotAccess {
  botId: string;
  name: string;
  role: OwnerRole;
}

export interface OwnerAuthMeResponse {
  user: {
    telegramUserId: number;
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    photoUrl?: string | null;
  };
  bots: OwnerBotAccess[];
  csrfToken: string;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface OwnerInboxEvent {
  id: string;
  botId: string;
  type: string;
  entityType: string | null;
  entityId: string | null;
  status: OwnerEventStatus;
  priority: OwnerEventPriority;
  assignee: number | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface OwnerCustomer {
  id: string;
  botId: string;
  telegramUserId: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  tags: string[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OwnerLead {
  id: string;
  botId: string;
  customerId: string | null;
  status: string;
  title: string | null;
  message: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OwnerOrder {
  id: string;
  botId: string;
  customerId: string | null;
  status: string;
  paymentStatus: string;
  amount: string | null;
  currency: string | null;
  tracking: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OwnerAppointment {
  id: string;
  botId: string;
  customerId: string | null;
  staffId: string | null;
  serviceId: string | null;
  status: string;
  startsAt: string;
  endsAt: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

