import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../services/api';
import * as Icons from 'lucide-react';

export interface Partner {
  id: string;
  name: string;
  type: 'SUPPLIER' | 'DISTRIBUTOR' | 'DEALER' | 'DIRECT_DEALER';
  parentPartnerId: string | null;
  territory: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  creditLimit: number | string;
  status: string;
}

export const PartnersPage: React.FC = () => {
  const { user, permissions } = useAuth();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // Modals state
  const [activeModal, setActiveModal] = useState<'DISTRIBUTOR' | 'DEALER' | 'DIRECT_DEALER' | 'CREDIT_LIMIT' | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formTerritory, setFormTerritory] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formCreditLimit, setFormCreditLimit] = useState<number>(100000);
  const [formParentPartnerId, setFormParentPartnerId] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  const canCreate = permissions.some((p) => p.resource === 'PARTNER' && p.action === 'CREATE');
  const canUpdate = permissions.some((p) => p.resource === 'PARTNER' && p.action === 'UPDATE');
  const isDistributorRole = user?.role === 'DISTRIBUTOR';

  const fetchPartners = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<Partner[]>('/partners');
      setPartners(data);

      const initExpanded: Record<string, boolean> = {};
      data.forEach((p) => {
        initExpanded[p.id] = true;
      });
      setExpandedNodes(initExpanded);

      if (data.length > 0 && !selectedPartner) {
        setSelectedPartner(data[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load partners');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPartners();
  }, []);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSelectPartner = (partner: Partner) => {
    setSelectedPartner(partner);
  };

  const openCreateModal = (type: 'DISTRIBUTOR' | 'DEALER' | 'DIRECT_DEALER') => {
    setFormName('');
    setFormTerritory('');
    setFormAddress('');
    setFormPhone('');
    setFormEmail('');
    setFormCreditLimit(type === 'DISTRIBUTOR' ? 1000000 : type === 'DIRECT_DEALER' ? 500000 : 250000);
    
    if (type === 'DEALER') {
      if (isDistributorRole && user?.partnerId) {
        setFormParentPartnerId(user.partnerId);
      } else {
        const firstDistributor = partners.find((p) => p.type === 'DISTRIBUTOR');
        setFormParentPartnerId(firstDistributor ? firstDistributor.id : '');
      }
    } else if (type === 'DISTRIBUTOR' || type === 'DIRECT_DEALER') {
      if (user?.partnerId) {
        setFormParentPartnerId(user.partnerId);
      } else {
        const firstSupplier = partners.find((p) => p.type === 'SUPPLIER');
        setFormParentPartnerId(firstSupplier ? firstSupplier.id : '');
      }
    } else {
      setFormParentPartnerId('');
    }

    setActiveModal(type);
  };

  const openCreditLimitModal = () => {
    if (!selectedPartner) return;
    setFormCreditLimit(Number(selectedPartner.creditLimit));
    setActiveModal('CREDIT_LIMIT');
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setError(null);

    try {
      if (activeModal === 'DISTRIBUTOR') {
        await api.post('/partners', {
          name: formName,
          type: 'DISTRIBUTOR',
          parentPartnerId: formParentPartnerId || undefined,
          territory: formTerritory || undefined,
          address: formAddress || undefined,
          phone: formPhone || undefined,
          email: formEmail || undefined,
          creditLimit: Number(formCreditLimit),
        });
      } else if (activeModal === 'DEALER') {
        await api.post('/partners', {
          name: formName,
          type: 'DEALER',
          parentPartnerId: formParentPartnerId || undefined,
          territory: formTerritory || undefined,
          address: formAddress || undefined,
          phone: formPhone || undefined,
          email: formEmail || undefined,
          creditLimit: Number(formCreditLimit),
        });
      } else if (activeModal === 'DIRECT_DEALER') {
        await api.post('/partners/direct-dealer/onboard', {
          name: formName,
          territory: formTerritory || undefined,
          address: formAddress || undefined,
          phone: formPhone || undefined,
          email: formEmail || undefined,
          creditLimit: Number(formCreditLimit),
        });
      } else if (activeModal === 'CREDIT_LIMIT' && selectedPartner) {
        const updated = await api.patch<Partner>(`/partners/${selectedPartner.id}`, {
          creditLimit: Number(formCreditLimit),
        });
        setSelectedPartner(updated);
      }

      setActiveModal(null);
      await fetchPartners();
    } catch (err: any) {
      setError(err.message || 'Operation failed');
    } finally {
      setFormSubmitting(false);
    }
  };

  const suppliers = partners.filter((p) => p.type === 'SUPPLIER');
  const distributors = partners.filter((p) => p.type === 'DISTRIBUTOR');
  const directDealers = partners.filter((p) => p.type === 'DIRECT_DEALER');
  
  const getDealersForDistributor = (distributorId: string) => {
    return partners.filter((p) => p.type === 'DEALER' && p.parentPartnerId === distributorId);
  };

  const myDealers = isDistributorRole
    ? partners.filter((p) => p.type === 'DEALER' && (p.parentPartnerId === user?.partnerId || p.id !== user?.partnerId))
    : [];

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'SUPPLIER':
        return <span className="px-2.5 py-0.5 text-xs font-bold rounded-md bg-purple-50 text-purple-700 border border-purple-200">Supplier</span>;
      case 'DISTRIBUTOR':
        return <span className="px-2.5 py-0.5 text-xs font-bold rounded-md bg-blue-50 text-blue-700 border border-blue-200">Distributor</span>;
      case 'DEALER':
        return <span className="px-2.5 py-0.5 text-xs font-bold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">Dealer</span>;
      case 'DIRECT_DEALER':
        return <span className="px-2.5 py-0.5 text-xs font-bold rounded-md bg-amber-50 text-amber-700 border border-amber-200">Direct Dealer</span>;
      default:
        return <span className="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-gray-100 text-gray-700 border border-gray-200">{type}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2.5">
            <Icons.Building2 className="w-6 h-6 text-blue-600" />
            {isDistributorRole ? 'My Dealers & Network' : 'Partner Hierarchy Tree'}
          </h1>
          <p className="text-gray-500 text-xs mt-1">
            {isDistributorRole
              ? 'Manage and view your assigned dealer network'
              : 'Enterprise multi-tier organization tree and credit limits'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={fetchPartners}
            className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-lg border border-gray-300 transition flex items-center gap-2 text-xs font-medium"
          >
            <Icons.RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {canCreate && !isDistributorRole && (
            <>
              <button
                onClick={() => openCreateModal('DISTRIBUTOR')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs transition shadow-sm flex items-center gap-2"
              >
                <Icons.Plus className="w-4 h-4" />
                <span>Add Distributor</span>
              </button>
              <button
                onClick={() => openCreateModal('DEALER')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs transition shadow-sm flex items-center gap-2"
              >
                <Icons.Plus className="w-4 h-4" />
                <span>Add Dealer</span>
              </button>
              <button
                onClick={() => openCreateModal('DIRECT_DEALER')}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-xs transition shadow-sm flex items-center gap-2"
              >
                <Icons.Plus className="w-4 h-4" />
                <span>Add Direct Dealer</span>
              </button>
            </>
          )}

          {canCreate && isDistributorRole && (
            <button
              onClick={() => openCreateModal('DEALER')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs transition shadow-sm flex items-center gap-2"
            >
              <Icons.Plus className="w-4 h-4" />
              <span>Add Dealer</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center justify-between text-xs font-medium">
          <div className="flex items-center gap-2">
            <Icons.AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <Icons.X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Partner Tree Column */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-sm font-bold text-gray-800 mb-4 flex items-center justify-between">
            <span>{isDistributorRole ? 'My Dealers' : 'Organization Tree'}</span>
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-md border border-gray-200">
              Total: {partners.length} Partners
            </span>
          </h2>

          {loading ? (
            <div className="py-16 text-center text-gray-500 text-xs flex flex-col items-center gap-2">
              <Icons.Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <p>Loading hierarchy data...</p>
            </div>
          ) : isDistributorRole ? (
            <div className="space-y-2.5">
              {myDealers.length === 0 ? (
                <div className="py-12 text-center text-gray-500 border border-dashed border-gray-200 rounded-lg text-xs">
                  <Icons.Users className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                  <p>No dealers found under your distributor account.</p>
                </div>
              ) : (
                myDealers.map((d) => (
                  <div
                    key={d.id}
                    onClick={() => handleSelectPartner(d)}
                    className={`p-3.5 rounded-lg border transition cursor-pointer flex items-center justify-between ${
                      selectedPartner?.id === d.id
                        ? 'bg-blue-50 border-blue-300 text-blue-900'
                        : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 rounded-md text-emerald-600">
                        <Icons.Store className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm">{d.name}</h4>
                        <p className="text-xs text-gray-500">Territory: {d.territory || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getTypeBadge(d.type)}
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400">Credit Limit</p>
                        <p className="font-mono text-xs font-bold text-gray-900">
                          ₹{Number(d.creditLimit).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {suppliers.map((supp) => (
                <div key={supp.id} className="space-y-2.5">
                  {/* Supplier Node */}
                  <div
                    onClick={() => handleSelectPartner(supp)}
                    className={`p-4 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                      selectedPartner?.id === supp.id
                        ? 'bg-purple-50 border-purple-300 text-purple-900'
                        : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => toggleExpand(supp.id, e)}
                        className="p-1 text-gray-400 hover:text-gray-700 rounded"
                      >
                        {expandedNodes[supp.id] ? (
                          <Icons.ChevronDown className="w-4 h-4" />
                        ) : (
                          <Icons.ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                      <div className="p-2 bg-purple-50 rounded-lg text-purple-600 border border-purple-100">
                        <Icons.Building className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 text-sm">{supp.name}</h3>
                        <p className="text-xs text-gray-500">{supp.email || supp.phone || 'Root Supplier'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {getTypeBadge(supp.type)}
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400">Credit Limit</p>
                        <p className="font-mono text-xs font-bold text-gray-900">
                          ₹{Number(supp.creditLimit).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Children of Supplier */}
                  {expandedNodes[supp.id] && (
                    <div className="pl-5 space-y-2 border-l-2 border-gray-200 ml-4">
                      {distributors.map((dist) => {
                        const dealers = getDealersForDistributor(dist.id);
                        return (
                          <div key={dist.id} className="space-y-2">
                            <div
                              onClick={() => handleSelectPartner(dist)}
                              className={`p-3 rounded-lg border transition cursor-pointer flex items-center justify-between ${
                                selectedPartner?.id === dist.id
                                  ? 'bg-blue-50 border-blue-300 text-blue-900'
                                  : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-800'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={(e) => toggleExpand(dist.id, e)}
                                  className="p-1 text-gray-400 hover:text-gray-700 rounded"
                                >
                                  {expandedNodes[dist.id] ? (
                                    <Icons.ChevronDown className="w-4 h-4" />
                                  ) : (
                                    <Icons.ChevronRight className="w-4 h-4" />
                                  )}
                                </button>
                                <div className="p-1.5 bg-blue-50 rounded-md text-blue-600 border border-blue-100">
                                  <Icons.Truck className="w-4 h-4" />
                                </div>
                                <div>
                                  <h4 className="font-bold text-gray-900 text-xs">{dist.name}</h4>
                                  <p className="text-[11px] text-gray-500">Territory: {dist.territory || 'N/A'}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                {getTypeBadge(dist.type)}
                                <span className="font-mono text-xs font-bold text-gray-800">
                                  ₹{Number(dist.creditLimit).toLocaleString()}
                                </span>
                              </div>
                            </div>

                            {/* Dealers under Distributor */}
                            {expandedNodes[dist.id] && (
                              <div className="pl-5 space-y-1.5 border-l-2 border-blue-200 ml-3">
                                {dealers.length === 0 ? (
                                  <p className="text-xs text-gray-400 italic pl-3 py-1">No dealers onboarded</p>
                                ) : (
                                  dealers.map((dlr) => (
                                    <div
                                      key={dlr.id}
                                      onClick={() => handleSelectPartner(dlr)}
                                      className={`p-2.5 rounded-md border transition cursor-pointer flex items-center justify-between ${
                                        selectedPartner?.id === dlr.id
                                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                                          : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-800'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <div className="p-1 bg-emerald-50 rounded text-emerald-600">
                                          <Icons.Store className="w-3.5 h-3.5" />
                                        </div>
                                        <span className="text-xs font-semibold text-gray-900">{dlr.name}</span>
                                      </div>
                                      <div className="flex items-center gap-2.5">
                                        {getTypeBadge(dlr.type)}
                                        <span className="font-mono text-xs text-gray-800 font-bold">
                                          ₹{Number(dlr.creditLimit).toLocaleString()}
                                        </span>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Direct Dealers */}
                      {directDealers.map((dd) => (
                        <div
                          key={dd.id}
                          onClick={() => handleSelectPartner(dd)}
                          className={`p-3 rounded-lg border transition cursor-pointer flex items-center justify-between ${
                            selectedPartner?.id === dd.id
                              ? 'bg-amber-50 border-amber-300 text-amber-900'
                              : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-800'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-amber-50 rounded-md text-amber-600 border border-amber-100">
                              <Icons.Zap className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="font-bold text-gray-900 text-xs">{dd.name}</h4>
                              <p className="text-[11px] text-gray-500">Direct Dealer (No Distributor)</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {getTypeBadge(dd.type)}
                            <span className="font-mono text-xs font-bold text-gray-800">
                              ₹{Number(dd.creditLimit).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Partner Details Column */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Icons.Info className="w-4 h-4 text-blue-600" />
              Partner Inspection Details
            </h2>

            {selectedPartner ? (
              <div className="space-y-4 text-xs">
                <div className="p-3.5 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-gray-500 text-[10px] font-semibold uppercase">Partner Name</span>
                    {getTypeBadge(selectedPartner.type)}
                  </div>
                  <h3 className="text-base font-bold text-gray-900">{selectedPartner.name}</h3>
                  <p className="text-[10px] text-gray-400 font-mono mt-0.5">ID: {selectedPartner.id}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-gray-500 text-[10px] font-semibold uppercase">Credit Limit</p>
                    <p className="font-mono text-sm font-bold text-emerald-700 mt-0.5">
                      ₹{Number(selectedPartner.creditLimit).toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-gray-500 text-[10px] font-semibold uppercase">Status</p>
                    <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {selectedPartner.status}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-gray-100 text-xs">
                  <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                    <span className="text-gray-500 flex items-center gap-2">
                      <Icons.MapPin className="w-3.5 h-3.5 text-gray-400" /> Territory
                    </span>
                    <span className="text-gray-800 font-semibold">{selectedPartner.territory || 'Not set'}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                    <span className="text-gray-500 flex items-center gap-2">
                      <Icons.Mail className="w-3.5 h-3.5 text-gray-400" /> Email
                    </span>
                    <span className="text-gray-800 font-semibold">{selectedPartner.email || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                    <span className="text-gray-500 flex items-center gap-2">
                      <Icons.Phone className="w-3.5 h-3.5 text-gray-400" /> Phone
                    </span>
                    <span className="text-gray-800 font-semibold">{selectedPartner.phone || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-gray-500 flex items-center gap-2">
                      <Icons.Building className="w-3.5 h-3.5 text-gray-400" /> Address
                    </span>
                    <span className="text-gray-800 font-semibold truncate max-w-[160px]">{selectedPartner.address || 'N/A'}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-gray-400 text-xs">Select a partner from the tree to view details</div>
            )}
          </div>

          {selectedPartner && canUpdate && (
            <div className="mt-6 pt-3 border-t border-gray-200">
              <button
                onClick={openCreditLimitModal}
                className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-semibold rounded-lg text-xs transition flex items-center justify-center gap-2"
              >
                <Icons.CreditCard className="w-4 h-4" />
                <span>Update Credit Limit</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Form Modal */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-gray-200 rounded-xl w-full max-w-md p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                {activeModal === 'DISTRIBUTOR' && 'Add New Distributor'}
                {activeModal === 'DEALER' && 'Add New Dealer'}
                {activeModal === 'DIRECT_DEALER' && 'Onboard Direct Dealer'}
                {activeModal === 'CREDIT_LIMIT' && `Update Credit Limit for ${selectedPartner?.name}`}
              </h3>
              <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-600">
                <Icons.X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
              {activeModal !== 'CREDIT_LIMIT' && (
                <>
                  <div>
                    <label className="block font-semibold text-gray-700 mb-1 uppercase">Partner Name *</label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. Metro Electronics"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                    />
                  </div>

                  {activeModal === 'DEALER' && !isDistributorRole && (
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1 uppercase">Parent Distributor *</label>
                      <select
                        required
                        value={formParentPartnerId}
                        onChange={(e) => setFormParentPartnerId(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                      >
                        <option value="" disabled>Select a Distributor</option>
                        {distributors.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.territory || 'No Territory'})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1 uppercase">Territory</label>
                      <input
                        type="text"
                        value={formTerritory}
                        onChange={(e) => setFormTerritory(e.target.value)}
                        placeholder="e.g. North Region"
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1 uppercase">Phone</label>
                      <input
                        type="text"
                        value={formPhone}
                        onChange={(e) => setFormPhone(e.target.value)}
                        placeholder="+1 555-0100"
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1 uppercase">Email Address</label>
                    <input
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="contact@partner.com"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1 uppercase">Address</label>
                    <input
                      type="text"
                      value={formAddress}
                      onChange={(e) => setFormAddress(e.target.value)}
                      placeholder="Street address, city"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block font-semibold text-gray-700 mb-1 uppercase">
                  Credit Limit (₹) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  required
                  value={formCreditLimit}
                  onChange={(e) => setFormCreditLimit(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 font-mono focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg flex items-center gap-2 shadow-sm"
                >
                  {formSubmitting && <Icons.Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Save Partner</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartnersPage;
