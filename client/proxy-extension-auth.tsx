import React, { useState } from 'react';
import { Globe, Shield, Power, Settings, ChevronDown, Check, RefreshCw, Mail, Lock, ArrowLeft, User } from 'lucide-react';

const ProxyExtensionAuth = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLocationOpen, setIsLocationOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState("Automatic");
  const [currentView, setCurrentView] = useState('login'); // login, signup, main
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const locations = [
    "Automatic",
    "United States",
    "United Kingdom",
    "Japan",
    "Germany",
    "Singapore"
  ];

  const AuthHeader = () => (
    <div className="p-4 border-b border-gray-700">
      {currentView !== 'main' && (
        <div className="flex items-center gap-2">
          <Shield size={24} className="text-blue-400" />
          <h1 className="text-xl font-bold">SecureProxy</h1>
        </div>
      )}
    </div>
  );

  const LoginView = () => (
    <div className="p-6">
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-bold text-center mb-4">Welcome Back</h2>
        <div className="space-y-4">
          <div className="relative">
            <Mail size={20} className="absolute left-3 top-2.5 text-gray-400" />
            <input
              type="email"
              placeholder="Email"
              className="w-full pl-10 pr-4 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-400 focus:outline-none"
            />
          </div>
          <div className="relative">
            <Lock size={20} className="absolute left-3 top-2.5 text-gray-400" />
            <input
              type="password"
              placeholder="Password"
              className="w-full pl-10 pr-4 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-400 focus:outline-none"
            />
          </div>
          <button
            onClick={() => setIsAuthenticated(true)}
            className="w-full py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Sign In
          </button>
        </div>
        <p className="text-center text-gray-400 text-sm">
          Don't have an account?{' '}
          <button
            onClick={() => setCurrentView('signup')}
            className="text-blue-400 hover:underline"
          >
            Sign Up
          </button>
        </p>
      </div>
    </div>
  );

  const SignupView = () => (
    <div className="p-6">
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-bold text-center mb-4">Create Account</h2>
        <div className="space-y-4">
          <div className="relative">
            <User size={20} className="absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Username"
              className="w-full pl-10 pr-4 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-400 focus:outline-none"
            />
          </div>
          <div className="relative">
            <Mail size={20} className="absolute left-3 top-2.5 text-gray-400" />
            <input
              type="email"
              placeholder="Email"
              className="w-full pl-10 pr-4 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-400 focus:outline-none"
            />
          </div>
          <div className="relative">
            <Lock size={20} className="absolute left-3 top-2.5 text-gray-400" />
            <input
              type="password"
              placeholder="Password"
              className="w-full pl-10 pr-4 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-400 focus:outline-none"
            />
          </div>
          <button
            onClick={() => setIsAuthenticated(true)}
            className="w-full py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Sign Up
          </button>
        </div>
        <p className="text-center text-gray-400 text-sm">
          Already have an account?{' '}
          <button
            onClick={() => setCurrentView('login')}
            className="text-blue-400 hover:underline"
          >
            Sign In
          </button>
        </p>
      </div>
    </div>
  );

  const MainView = () => (
    <>
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield size={24} className="text-blue-400" />
            <h1 className="text-xl font-bold">SecureProxy</h1>
          </div>
          <div className="flex items-center gap-3">
            <Settings size={20} className="text-gray-400 hover:text-white cursor-pointer" />
            <button 
              onClick={() => {
                setIsAuthenticated(false);
                setCurrentView('login');
              }}
              className="text-sm text-gray-400 hover:text-white"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="flex flex-col items-center gap-4">
          <div 
            className={`w-16 h-16 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 ${isConnected ? 'bg-green-500/20' : 'bg-gray-700'}`}
            onClick={() => setIsConnected(!isConnected)}
          >
            <Power 
              size={32} 
              className={`${isConnected ? 'text-green-400' : 'text-gray-400'} transition-colors duration-300`}
            />
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold">
              {isConnected ? 'Connected' : 'Not Connected'}
            </p>
            <p className="text-sm text-gray-400">
              {isConnected ? 'Your connection is secure' : 'Click to connect'}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-gray-700">
        <div className="relative">
          <button
            onClick={() => setIsLocationOpen(!isLocationOpen)}
            className="w-full p-3 bg-gray-800 rounded-lg flex items-center justify-between hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Globe size={20} className="text-blue-400" />
              <span>{selectedLocation}</span>
            </div>
            <ChevronDown size={20} className={`transition-transform duration-200 ${isLocationOpen ? 'rotate-180' : ''}`} />
          </button>

          {isLocationOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-gray-800 rounded-lg shadow-xl z-10">
              {locations.map((location) => (
                <button
                  key={location}
                  onClick={() => {
                    setSelectedLocation(location);
                    setIsLocationOpen(false);
                  }}
                  className="w-full p-3 flex items-center justify-between hover:bg-gray-700 transition-colors"
                >
                  <span>{location}</span>
                  {selectedLocation === location && (
                    <Check size={16} className="text-blue-400" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {isConnected && (
        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400"></div>
              <span className="text-gray-400">IP: 192.168.1.XX</span>
            </div>
            <RefreshCw size={16} className="text-gray-400 hover:text-white cursor-pointer" />
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="w-80 bg-gradient-to-b from-gray-900 to-gray-800 text-white rounded-lg shadow-xl">
      {isAuthenticated ? (
        <MainView />
      ) : (
        <>
          <AuthHeader />
          {currentView === 'login' ? <LoginView /> : <SignupView />}
        </>
      )}
    </div>
  );
};

export default ProxyExtensionAuth;
