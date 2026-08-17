import { api } from './api';

export interface CreateSalesOrderLinePayload {
  productId: string;
  inventoryItemId?: string;
  quantity: number;
}

export interface CreateSalesOrderPayload {
  customerId: string;
  lines: CreateSalesOrderLinePayload[];
}

export interface SalesOrderLine {
  id: string;
  salesOrderId: string;
  productId: string;
  inventoryItemId?: string | null;
  quantity: number;
  unitPrice: number | string;
  tax: number | string;
  total: number | string;
  product?: {
    id: string;
    SKU: string;
    name: string;
    brand: string;
    model?: string;
    IMEITracked: boolean;
  };
  inventoryItem?: {
    id: string;
    IMEI: string;
    serialNumber: string;
    status: string;
  } | null;
}

export interface SalesOrder {
  id: string;
  orderNumber: string;
  buyerPartnerId?: string | null;
  sellerPartnerId: string;
  customerId?: string | null;
  status: string;
  totalAmount: number | string;
  taxAmount: number | string;
  createdAt: string;
  updatedAt: string;
  customer?: {
    id: string;
    name: string;
    phone: string;
    email?: string | null;
    address?: string | null;
  } | null;
  sellerPartner?: {
    id: string;
    name: string;
    type: string;
  };
  buyerPartner?: {
    id: string;
    name: string;
    type: string;
  } | null;
  lines?: SalesOrderLine[];
}

export class SalesOrdersService {
  async createSalesOrder(payload: CreateSalesOrderPayload): Promise<SalesOrder> {
    return api.post<SalesOrder>('/sales-orders', payload);
  }

  async getSalesOrders(params?: { customerId?: string; status?: string }): Promise<SalesOrder[]> {
    const query = new URLSearchParams();
    if (params?.customerId) query.append('customerId', params.customerId);
    if (params?.status) query.append('status', params.status);
    const queryString = query.toString();
    const path = `/sales-orders${queryString ? `?${queryString}` : ''}`;
    return api.get<SalesOrder[]>(path);
  }

  async getSalesOrderById(id: string): Promise<SalesOrder> {
    return api.get<SalesOrder>(`/sales-orders/${id}`);
  }
}

export const salesOrdersService = new SalesOrdersService();
