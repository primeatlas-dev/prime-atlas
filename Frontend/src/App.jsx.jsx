// PRIME ATLAS ERP - FRONTEND (REACT)
// Complete UI Application for Property Sourcing

import React, { useState, useEffect } from 'react';
import { Menu, Plus, Search, Eye, Edit, Trash2, Send, MapPin, Home, DollarSign, Users, TrendingUp, LogOut, ChevronDown, MessageCircle } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// ==================== MAIN APP ====================
export default function PrimeAtlasApp() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (token) {
      setUser({ authenticated: true });
    }
  }, [token]);

  if (!token) {
    return <LoginPage setToken={setToken} />;
  }

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar 
        currentPage={currentPage} 
        setCurrentPage={setCurrentPage}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <Header 
          currentPage={currentPage}
          onLogout={handleLogout}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-6">
          {currentPage === 'dashboard' && <DashboardPage token={token} />}
          {currentPage === 'properties' && <PropertiesPage token={token} />}
          {currentPage === 'buying-agents' && <BuyingAgentsPage token={token} />}
          {currentPage === 'deals' && <DealsPage token={token} />}
          {currentPage === 'communications' && <CommunicationsPage token={token} />}
        </div>
      </div>
    </div>
  );
}

// ==================== SIDEBAR ====================
function Sidebar({ currentPage, setCurrentPage, sidebarOpen, setSidebarOpen }) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
    { id: 'properties', label: 'Properties', icon: Home },
    { id: 'buying-agents', label: 'Buying Agents', icon: Users },
    { id: 'deals', label: 'Deals', icon: DollarSign },
    { id: 'communications', label: 'Communications', icon: MessageCircle },
  ];

  return (
    <div className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-gradient-to-b from-blue-900 to-blue-800 text-white transition-all duration-300 flex flex-col`}>
      {/* Logo */}
      <div className="p-4 border-b border-blue-700 flex items-center justify-center">
        <div className="text-2xl font-bold">
          {sidebarOpen ? 'Prime Atlas' : 'PA'}
        </div>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                currentPage === item.id 
                  ? 'bg-blue-600 text-white' 
                  : 'text-blue-100 hover:bg-blue-700'
              }`}
            >
              <Icon size={20} />
              {sidebarOpen && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-blue-700">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="w-full py-2 text-blue-100 hover:bg-blue-700 rounded-lg"
        >
          {sidebarOpen ? '←' : '→'}
        </button>
      </div>
    </div>
  );
}

// ==================== HEADER ====================
function Header({ currentPage, onLogout, sidebarOpen, setSidebarOpen }) {
  const pageNames = {
    dashboard: 'Dashboard',
    properties: 'Properties',
    'buying-agents': 'Buying Agents',
    deals: 'Deals',
    communications: 'Communications'
  };

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
      <div className="flex items-center space-x-4">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <Menu size={24} />
        </button>
        <h1 className="text-2xl font-bold text-gray-800">{pageNames[currentPage]}</h1>
      </div>
      <button
        onClick={onLogout}
        className="flex items-center space-x-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
      >
        <LogOut size={18} />
        <span>Logout</span>
      </button>
    </div>
  );
}

// ==================== DASHBOARD PAGE ====================
function DashboardPage({ token }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      const res = await fetch(`${API_URL}/dashboard/summary`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setMetrics(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching metrics:', error);
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          title="Total Properties Sourced"
          value={metrics?.total_properties_sourced || 0}
          icon={Home}
          color="blue"
        />
        <MetricCard
          title="Deals Closed"
          value={metrics?.total_deals_closed || 0}
          icon={DollarSign}
          color="green"
        />
        <MetricCard
          title="In Progress"
          value={metrics?.deals_in_progress || 0}
          icon={TrendingUp}
          color="amber"
        />
        <MetricCard
          title="Commission Earned"
          value={`£${(metrics?.total_commission_earned || 0).toLocaleString()}`}
          icon={DollarSign}
          color="purple"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-semibold mb-4">Properties by Status</h3>
          <div className="space-y-3">
            {metrics?.properties_by_status.map(item => (
              <div key={item.deal_status} className="flex justify-between items-center">
                <span className="text-gray-600">{item.deal_status}</span>
                <div className="w-48 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${(item.count / metrics.total_properties_sourced) * 100}%` }}
                  ></div>
                </div>
                <span className="font-semibold">{item.count}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-4">Top Regions</h3>
          <div className="space-y-3">
            {metrics?.properties_by_region.slice(0, 5).map((region, idx) => (
              <div key={region.region} className="flex justify-between items-center">
                <span className="text-gray-600">{region.region}</span>
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">
                  {region.count}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ==================== PROPERTIES PAGE ====================
function PropertiesPage({ token }) {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    try {
      const res = await fetch(`${API_URL}/properties`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setProperties(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching properties:', error);
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex space-x-4 flex-1 mr-4">
          <input 
            type="text" 
            placeholder="Search properties..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg">
            <Search size={18} />
          </button>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg"
        >
          <Plus size={18} />
          <span>Add Property</span>
        </button>
      </div>

      {showForm && (
        <PropertyForm 
          token={token}
          onClose={() => setShowForm(false)}
          onSave={() => { setShowForm(false); fetchProperties(); }}
        />
      )}

      {selectedProperty ? (
        <PropertyDetail 
          token={token}
          property={selectedProperty}
          onBack={() => setSelectedProperty(null)}
          onUpdate={() => fetchProperties()}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map(prop => (
            <Card 
              key={prop.id}
              onClick={() => setSelectedProperty(prop)}
              className="cursor-pointer hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-semibold text-gray-800 flex-1">{prop.property_title}</h3>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  prop.deal_status === 'closed' ? 'bg-green-100 text-green-800' :
                  prop.deal_status === 'sourced' ? 'bg-blue-100 text-blue-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {prop.deal_status}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-2">📍 {prop.address}</p>
              <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                <div><span className="text-gray-600">Price:</span> <strong>£{prop.price?.toLocaleString()}</strong></div>
                <div><span className="text-gray-600">Beds:</span> <strong>{prop.bedrooms}</strong></div>
              </div>
              <div className="pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-500">Source: {prop.source}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== PROPERTY DETAIL ====================
function PropertyDetail({ token, property, onBack, onUpdate }) {
  const [photos, setPhotos] = useState([]);
  const [deals, setDeals] = useState([]);

  useEffect(() => {
    fetchPropertyDetails();
  }, [property.id]);

  const fetchPropertyDetails = async () => {
    try {
      const res = await fetch(`${API_URL}/properties/${property.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setPhotos(data.photos || []);
      setDeals(data.deals || []);
    } catch (error) {
      console.error('Error fetching property details:', error);
    }
  };

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 mb-4"
      >
        <span>← Back to Properties</span>
      </button>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Property Info */}
        <div className="col-span-2 space-y-6">
          <Card>
            <h2 className="text-2xl font-bold mb-2">{property.property_title}</h2>
            <p className="text-gray-600 mb-4">📍 {property.address}</p>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-gray-600">Price</p>
                <p className="text-2xl font-bold">£{property.price?.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-600">Valuation</p>
                <p className="text-2xl font-bold">£{property.valuation?.toLocaleString()}</p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <p className="text-gray-600 text-sm">Bedrooms</p>
                <p className="text-xl font-bold">{property.bedrooms}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Bathrooms</p>
                <p className="text-xl font-bold">{property.bathrooms}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Car Parks</p>
                <p className="text-xl font-bold">{property.car_parking}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Plot Size</p>
                <p className="text-xl font-bold">{property.plot_size}m²</p>
              </div>
            </div>
          </Card>

          {/* Photos Gallery */}
          {photos.length > 0 && (
            <Card>
              <h3 className="text-lg font-semibold mb-4">Property Gallery</h3>
              <div className="grid grid-cols-3 gap-4">
                {photos.map(photo => (
                  <img 
                    key={photo.id}
                    src={photo.photo_url}
                    alt="Property"
                    className="w-full h-40 object-cover rounded-lg"
                  />
                ))}
              </div>
            </Card>
          )}

          {/* Deals History */}
          {deals.length > 0 && (
            <Card>
              <h3 className="text-lg font-semibold mb-4">Deal History</h3>
              <div className="space-y-3">
                {deals.map(deal => (
                  <div key={deal.id} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold">{deal.agent_name}</p>
                        <p className="text-sm text-gray-600">{deal.agent_email}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        deal.deal_status === 'closed' ? 'bg-green-100 text-green-800' :
                        deal.deal_status === 'pitched' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {deal.deal_status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">Commission: £{deal.agreed_commission?.toLocaleString() || 'N/A'}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <h3 className="font-semibold mb-4">Sourcing Info</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-600">Source</p>
                <p className="font-semibold">{property.source}</p>
              </div>
              <div>
                <p className="text-gray-600">Sourced From</p>
                <p className="font-semibold">{property.sourced_from}</p>
              </div>
              <div>
                <p className="text-gray-600">Region</p>
                <p className="font-semibold">{property.region}</p>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="font-semibold mb-4">Property Info</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-600">Built Year</p>
                <p className="font-semibold">{property.built_year}</p>
              </div>
              <div>
                <p className="text-gray-600">Condition</p>
                <p className="font-semibold">{property.condition}</p>
              </div>
              <div>
                <p className="text-gray-600">Type</p>
                <p className="font-semibold">{property.property_type}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ==================== BUYING AGENTS PAGE ====================
function BuyingAgentsPage({ token }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const res = await fetch(`${API_URL}/buying-agents`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setAgents(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching agents:', error);
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <input 
          type="text" 
          placeholder="Search buying agents..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mr-4"
        />
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg"
        >
          <Plus size={18} />
          <span>Add Agent</span>
        </button>
      </div>

      {showForm && (
        <AgentForm 
          token={token}
          onClose={() => setShowForm(false)}
          onSave={() => { setShowForm(false); fetchAgents(); }}
        />
      )}

      {selectedAgent ? (
        <AgentDetail 
          token={token}
          agent={selectedAgent}
          onBack={() => setSelectedAgent(null)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agents.map(agent => (
            <Card 
              key={agent.id}
              onClick={() => setSelectedAgent(agent)}
              className="cursor-pointer hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-semibold text-lg text-gray-800">{agent.name}</h3>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  agent.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {agent.status}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-2">🏢 {agent.company_name}</p>
              <p className="text-sm text-gray-600 mb-2">📧 {agent.email}</p>
              <p className="text-sm text-gray-600 mb-2">📱 {agent.phone}</p>
              {agent.min_price && (
                <div className="text-sm text-gray-600">
                  💰 £{agent.min_price?.toLocaleString()} - £{agent.max_price?.toLocaleString()}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== DEALS PAGE ====================
function DealsPage({ token }) {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchDeals();
  }, [filter]);

  const fetchDeals = async () => {
    try {
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const res = await fetch(`${API_URL}/deals${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setDeals(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching deals:', error);
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  const statusFilters = ['all', 'pitched', 'interested', 'negotiating', 'closed', 'rejected'];

  return (
    <div className="space-y-6">
      <div className="flex space-x-2 mb-6">
        {statusFilters.map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              filter === status
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-100 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-800">Property</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-800">Buying Agent</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-800">Status</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-800">Commission</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-800">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {deals.map(deal => (
              <tr key={deal.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm">{deal.property_title}</td>
                <td className="px-6 py-4 text-sm">{deal.agent_name}</td>
                <td className="px-6 py-4 text-sm">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    deal.deal_status === 'closed' ? 'bg-green-100 text-green-800' :
                    deal.deal_status === 'pitched' ? 'bg-blue-100 text-blue-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {deal.deal_status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm">£{deal.agreed_commission?.toLocaleString()}</td>
                <td className="px-6 py-4 text-sm">{new Date(deal.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==================== COMMUNICATIONS PAGE ====================
function CommunicationsPage({ token }) {
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [communications, setCommunications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const res = await fetch(`${API_URL}/buying-agents`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setAgents(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching agents:', error);
      setLoading(false);
    }
  };

  const fetchCommunications = async (agentId) => {
    try {
      const res = await fetch(`${API_URL}/buying-agents/${agentId}/communications`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setCommunications(data);
    } catch (error) {
      console.error('Error fetching communications:', error);
    }
  };

  const handleSelectAgent = (agent) => {
    setSelectedAgent(agent);
    fetchCommunications(agent.id);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="grid grid-cols-3 gap-6 h-[calc(100vh-200px)]">
      {/* Agent List */}
      <div className="col-span-1 bg-white rounded-lg shadow p-4 overflow-y-auto">
        <h3 className="font-semibold mb-4">Buying Agents</h3>
        <div className="space-y-2">
          {agents.map(agent => (
            <button
              key={agent.id}
              onClick={() => handleSelectAgent(agent)}
              className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                selectedAgent?.id === agent.id
                  ? 'bg-blue-100 border-l-4 border-blue-600'
                  : 'hover:bg-gray-50'
              }`}
            >
              <p className="font-semibold text-sm">{agent.name}</p>
              <p className="text-xs text-gray-600">{agent.company_name}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Communication Thread */}
      {selectedAgent ? (
        <div className="col-span-2 bg-white rounded-lg shadow flex flex-col">
          <div className="border-b border-gray-200 p-4">
            <h3 className="font-semibold text-lg">{selectedAgent.name}</h3>
            <p className="text-sm text-gray-600">{selectedAgent.email}</p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {communications.map(comm => (
              <div key={comm.id} className="flex justify-end">
                <div className="bg-blue-100 rounded-lg p-3 max-w-xs">
                  <p className="text-xs text-gray-600 mb-1">{comm.communication_type}</p>
                  <p className="text-sm font-semibold mb-1">{comm.subject}</p>
                  <p className="text-sm text-gray-700">{comm.message}</p>
                  <p className="text-xs text-gray-600 mt-2">{new Date(comm.created_at).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-200 p-4">
            <div className="flex space-x-2">
              <input 
                type="text"
                placeholder="Type a message..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg">
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="col-span-2 bg-white rounded-lg shadow flex items-center justify-center">
          <p className="text-gray-500">Select an agent to view communications</p>
        </div>
      )}
    </div>
  );
}

// ==================== FORMS ====================
function PropertyForm({ token, onClose, onSave }) {
  const [formData, setFormData] = useState({
    property_title: '',
    address: '',
    region: '',
    property_type: 'Residential',
    bedrooms: '',
    bathrooms: '',
    price: '',
    source: 'Off-market',
    sourced_from: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/properties`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        onSave();
      }
    } catch (error) {
      console.error('Error creating property:', error);
    }
  };

  return (
    <Card>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Add New Property</h2>
        <button onClick={onClose} className="text-gray-600 hover:text-gray-800">✕</button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 grid grid-cols-2 gap-4">
        <input type="text" placeholder="Property Title" onChange={(e) => setFormData({...formData, property_title: e.target.value})} required />
        <input type="text" placeholder="Address" onChange={(e) => setFormData({...formData, address: e.target.value})} required />
        <input type="text" placeholder="Region" onChange={(e) => setFormData({...formData, region: e.target.value})} />
        <select onChange={(e) => setFormData({...formData, property_type: e.target.value})}>
          <option>Residential</option>
          <option>Commercial</option>
          <option>Land</option>
        </select>
        <input type="number" placeholder="Bedrooms" onChange={(e) => setFormData({...formData, bedrooms: e.target.value})} />
        <input type="number" placeholder="Bathrooms" onChange={(e) => setFormData({...formData, bathrooms: e.target.value})} />
        <input type="number" placeholder="Price" onChange={(e) => setFormData({...formData, price: e.target.value})} required />
        <input type="text" placeholder="Sourced From" onChange={(e) => setFormData({...formData, sourced_from: e.target.value})} />
        
        <div className="col-span-2">
          <button type="submit" className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Save Property
          </button>
        </div>
      </form>
    </Card>
  );
}

function AgentForm({ token, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company_name: '',
    commission_percentage: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/buying-agents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        onSave();
      }
    } catch (error) {
      console.error('Error creating agent:', error);
    }
  };

  return (
    <Card>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Add Buying Agent</h2>
        <button onClick={onClose} className="text-gray-600 hover:text-gray-800">✕</button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="text" placeholder="Name" onChange={(e) => setFormData({...formData, name: e.target.value})} required />
        <input type="email" placeholder="Email" onChange={(e) => setFormData({...formData, email: e.target.value})} required />
        <input type="tel" placeholder="Phone" onChange={(e) => setFormData({...formData, phone: e.target.value})} />
        <input type="text" placeholder="Company" onChange={(e) => setFormData({...formData, company_name: e.target.value})} />
        <input type="number" placeholder="Commission %" onChange={(e) => setFormData({...formData, commission_percentage: e.target.value})} />
        
        <button type="submit" className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          Save Agent
        </button>
      </form>
    </Card>
  );
}

// ==================== AGENT DETAIL ====================
function AgentDetail({ token, agent, onBack }) {
  const [deals, setDeals] = useState([]);

  useEffect(() => {
    fetchAgentDeals();
  }, [agent.id]);

  const fetchAgentDeals = async () => {
    try {
      const res = await fetch(`${API_URL}/deals?agentId=${agent.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setDeals(data);
    } catch (error) {
      console.error('Error fetching deals:', error);
    }
  };

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 mb-4"
      >
        <span>← Back to Agents</span>
      </button>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1">
          <Card>
            <h2 className="text-2xl font-bold mb-4">{agent.name}</h2>
            <div className="space-y-4">
              <div>
                <p className="text-gray-600 text-sm">Company</p>
                <p className="font-semibold">{agent.company_name}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Email</p>
                <p className="font-semibold">{agent.email}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Phone</p>
                <p className="font-semibold">{agent.phone}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Commission</p>
                <p className="font-semibold">{agent.commission_percentage}%</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="col-span-2">
          <Card>
            <h3 className="text-xl font-bold mb-4">Deal History</h3>
            <div className="space-y-3">
              {deals.map(deal => (
                <div key={deal.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold">{deal.property_title}</p>
                      <p className="text-sm text-gray-600">£{deal.price?.toLocaleString()}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      deal.deal_status === 'closed' ? 'bg-green-100 text-green-800' :
                      deal.deal_status === 'pitched' ? 'bg-blue-100 text-blue-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {deal.deal_status}
                    </span>
                  </div>
                  <p className="text-sm">Commission: £{deal.agreed_commission?.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ==================== REUSABLE COMPONENTS ====================
function Card({ children, onClick, className = '' }) {
  return (
    <div onClick={onClick} className={`bg-white rounded-lg shadow p-6 ${className}`}>
      {children}
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, color }) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    amber: 'bg-amber-100 text-amber-600',
    purple: 'bg-purple-100 text-purple-600'
  };

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600 text-sm mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-800">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon size={32} />
        </div>
      </div>
    </Card>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );
}

// ==================== LOGIN PAGE ====================
function LoginPage({ setToken }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const endpoint = isSignUp ? '/api/auth/register' : '/api/auth/login';
    const body = isSignUp 
      ? { email, password, name }
      : { email, password };

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
      }
    } catch (error) {
      console.error('Auth error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-800 flex items-center justify-center">
      <Card className="w-full max-w-md">
        <h1 className="text-3xl font-bold mb-6 text-center">Prime Atlas</h1>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <input
              type="text"
              placeholder="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <button
            type="submit"
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
          >
            {isSignUp ? 'Sign Up' : 'Login'}
          </button>
        </form>

        <p className="text-center text-gray-600 mt-4">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-blue-600 hover:text-blue-800 font-semibold ml-2"
          >
            {isSignUp ? 'Login' : 'Sign Up'}
          </button>
        </p>
      </Card>
    </div>
  );
}
