const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export type FamilyMember = {
  id: string;
  fullname?: string;
  login?: string;
  email?: string;
  role: 'owner' | 'member';
  joinedAt?: string;
};

export type Family = {
  id: string;
  name: string;
  ownerId: string;
  members: FamilyMember[];
  createdAt?: string;
  updatedAt?: string;
};

export type FamilyStatus = {
  hasFamily: boolean;
  family: Family | null;
  pendingInvitationsCount: number;
};

export type FamilyInvitation = {
  id: string;
  familyId: string;
  familyName: string;
  inviter: {
    id: string;
    fullname?: string;
    login?: string;
    email?: string;
  };
  invitedEmail: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  createdAt?: string;
  updatedAt?: string;
};

type RequestOptions = {
  method?: string;
  body?: unknown;
};

async function familyRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const token = localStorage.getItem('token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Ошибка запроса');
  }

  return data;
}

export const getFamilyStatus = () => {
  return familyRequest<FamilyStatus>('/api/auth/family/status');
};

export const createFamily = (name: string) => {
  return familyRequest<{ message: string; hasFamily: boolean; family: Family }>('/api/auth/family', {
    method: 'POST',
    body: { name },
  });
};

export const sendFamilyInvitation = (email: string) => {
  return familyRequest<{ message: string; invitation: FamilyInvitation }>('/api/auth/family/invitations', {
    method: 'POST',
    body: { email },
  });
};

export const getFamilyInvitations = () => {
  return familyRequest<{ invitations: FamilyInvitation[] }>('/api/auth/family/invitations');
};

export const acceptFamilyInvitation = (invitationId: string) => {
  return familyRequest<FamilyStatus & { message: string }>(`/api/auth/family/invitations/${invitationId}/accept`, {
    method: 'PATCH',
  });
};

export const declineFamilyInvitation = (invitationId: string) => {
  return familyRequest<{ message: string; pendingInvitationsCount: number }>(
    `/api/auth/family/invitations/${invitationId}/decline`,
    {
      method: 'PATCH',
    },
  );
};

export type FamilyTransaction = {
  _id?: string;
  id?: string;
  familyId?: string;
  userId?: string;
  amount: number;
  date?: string;
  createdAt?: string;
  category?: string;
  categoryInfo?: string;
  bank?: string;
  commentary?: string;
  balance?: number;
  page?: number;
  transactionNum?: number;
};

export type FamilyTransactionsResponse = {
  data: FamilyTransaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export const getFamilyTransactions = (page = 1, limit = 200) => {
  return familyRequest<FamilyTransactionsResponse>(
    `/api/family/transactions?page=${page}&limit=${limit}&sortBy=date&order=desc`,
  );
};
