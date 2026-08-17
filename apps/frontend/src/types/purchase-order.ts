export type OrderStatus =
  | 'DRAFT'
  | 'PLACED'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'PROCESSING'
  | 'DISPATCHED'
  | 'DELIVERED'
  | 'INVOICED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REJECTED';

export interface PurchaseOrderLineProduct {
  id: string;
  SKU: string;
  name: string;
  brand: string;
  model?: string | null;
  minimumOrderQuantity?: number;
  IMEITracked?: boolean;
}

export interface PurchaseOrderLine {
  id: string;
  purchaseOrderId: string;
  productId: string;
  product: PurchaseOrderLineProduct;
  quantity: number;
  unitPrice: number | string;
  tax: number | string;
  total: number | string;
}

export interface PartnerSummary {
  id: string;
  name: string;
  type: 'SUPPLIER' | 'DISTRIBUTOR' | 'DEALER' | 'DIRECT_DEALER';
  parentPartnerId?: string | null;
  territory?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  creditLimit?: number | string;
}

export interface WarehouseSummary {
  id: string;
  name: string;
  code: string;
  partnerId: string;
}

export interface UserSummary {
  id: string;
  name: string;
  email: string;
}

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  buyerPartnerId: string;
  buyerPartner: PartnerSummary;
  sellerPartnerId: string;
  sellerPartner: PartnerSummary;
  sourceWarehouseId?: string | null;
  sourceWarehouse?: WarehouseSummary | null;
  destinationWarehouseId?: string | null;
  destinationWarehouse?: WarehouseSummary | null;
  status: OrderStatus;
  totalAmount: number | string;
  taxAmount: number | string;
  requiresApproval: boolean;
  approvedByUserId?: string | null;
  approvedByUser?: UserSummary | null;
  approvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  lines: PurchaseOrderLine[];
}

export interface PurchaseOrderLineInput {
  productId: string;
  quantity: number;
  imeis?: string[];
}

export interface CreatePurchaseOrderInput {
  sellerPartnerId: string;
  sourceWarehouseId?: string;
  destinationWarehouseId?: string;
  lines: PurchaseOrderLineInput[];
}

export interface UpdatePurchaseOrderInput {
  sourceWarehouseId?: string;
  destinationWarehouseId?: string;
  lines?: PurchaseOrderLineInput[];
}

export interface PurchaseOrderQuery {
  status?: OrderStatus;
  buyerPartnerId?: string;
  sellerPartnerId?: string;
}
