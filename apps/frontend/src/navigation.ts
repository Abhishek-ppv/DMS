export interface NavigationItem {
  label: string;
  path: string;
  icon: string;
  permission?: {
    resource: string;
    action: string;
  };
  roles?: string[];
}

export const navigationConfig: NavigationItem[] = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: 'LayoutDashboard',
  },
  {
    label: 'POS / New Sale',
    path: '/pos',
    icon: 'Store',
    permission: { resource: 'ORDER', action: 'CREATE' },
    roles: ['DEALER', 'DIRECT_DEALER', 'ADMIN'],
  },
  {
    label: 'Sales Orders',
    path: '/sales-orders',
    icon: 'Receipt',
    permission: { resource: 'ORDER', action: 'READ' },
  },
  {
    label: 'Products',
    path: '/products',
    icon: 'Package',
    permission: { resource: 'PRODUCT', action: 'READ' },
  },
  {
    label: 'Categories',
    path: '/categories',
    icon: 'FolderTree',
    permission: { resource: 'CATEGORY', action: 'READ' },
  },
  {
    label: 'Inventory',
    path: '/inventory',
    icon: 'Warehouse',
    permission: { resource: 'INVENTORY', action: 'READ' },
  },
  {
    label: 'Partners',
    path: '/partners',
    icon: 'Handshake',
    permission: { resource: 'PARTNER', action: 'READ' },
  },
  {
    label: 'Purchase Orders',
    path: '/purchase-orders',
    icon: 'ShoppingCart',
    permission: { resource: 'ORDER', action: 'READ' },
  },
  {
    label: 'PO Approvals',
    path: '/purchase-orders/approvals',
    icon: 'CheckSquare',
    permission: { resource: 'ORDER', action: 'UPDATE' },
  },
  {
    label: 'Finance',
    path: '/finance',
    icon: 'DollarSign',
    permission: { resource: 'FINANCE', action: 'READ' },
  },
];
