import React, { useState } from 'react';
import { Globe, Shield, Power, Settings, ChevronDown, Check, RefreshCw } from 'lucide-react';

const ProxyExtension = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLocationOpen, setIsLocationOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState("Automatic");
  
  const locations = [
    "Automatic",
    "United States",
    "United Kingdom",
    "Japan",
    "Germany",
    "Singapore"
  ];

  return (
    <div className="w-80 bg-gradient-to-b from-gray-900 to-gray-800 text-white rounded-lg shadow-xl">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield size={24} className="text-blue-400" />
            <h1 className="text-xl font-bold">SecureProxy</h1>
          </div>
          <Settings size={20} className="text-gray-400 hover:text-white cursor-pointer" />
        </div>
      </div>

      {/* Connection Status */}
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

      {/* Location Selector */}
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

          {/* Location Dropdown */}
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

      {/* Status Bar */}
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
    </div>
  );
};

export default ProxyExtension;
