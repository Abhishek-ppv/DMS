import { api } from './api';
import {
  PurchaseOrder,
  CreatePurchaseOrderInput,
  UpdatePurchaseOrderInput,
  PurchaseOrderQuery,
} from '../types/purchase-order';

export const purchaseOrdersService = {
  /**
   * Fetch all tenant-scoped purchase orders.
   */
  async getAll(query?: PurchaseOrderQuery): Promise<PurchaseOrder[]> {
    const params = new URLSearchParams();
    if (query?.status) params.append('status', query.status);
    if (query?.buyerPartnerId) params.append('buyerPartnerId', query.buyerPartnerId);
    if (query?.sellerPartnerId) params.append('sellerPartnerId', query.sellerPartnerId);

    const queryString = params.toString();
    const url = `/purchase-orders${queryString ? `?${queryString}` : ''}`;
    return api.get<PurchaseOrder[]>(url);
  },

  /**
   * Fetch a single purchase order by ID.
   */
  async getById(id: string): Promise<PurchaseOrder> {
    return api.get<PurchaseOrder>(`/purchase-orders/${id}`);
  },

  /**
   * Create a new draft purchase order.
   */
  async create(input: CreatePurchaseOrderInput): Promise<PurchaseOrder> {
    return api.post<PurchaseOrder>('/purchase-orders', input);
  },

  /**
   * Update a draft purchase order.
   */
  async updateDraft(id: string, input: UpdatePurchaseOrderInput): Promise<PurchaseOrder> {
    return api.patch<PurchaseOrder>(`/purchase-orders/${id}`, input);
  },

  /**
   * Place a draft purchase order.
   */
  async place(id: string): Promise<PurchaseOrder> {
    return api.post<PurchaseOrder>(`/purchase-orders/${id}/place`);
  },

  /**
   * Manager approve a placed purchase order.
   */
  async approve(id: string): Promise<PurchaseOrder> {
    return api.post<PurchaseOrder>(`/purchase-orders/${id}/approve`);
  },

  /**
   * Manager reject a placed purchase order.
   */
  async reject(id: string): Promise<PurchaseOrder> {
    return api.post<PurchaseOrder>(`/purchase-orders/${id}/reject`);
  },

  /**
   * Dispatch an approved purchase order.
   */
  async dispatch(id: string): Promise<PurchaseOrder> {
    return api.post<PurchaseOrder>(`/purchase-orders/${id}/dispatch`);
  },

  /**
   * Mark a dispatched purchase order as delivered.
   */
  async deliver(id: string): Promise<PurchaseOrder> {
    return api.post<PurchaseOrder>(`/purchase-orders/${id}/deliver`);
  },
};
