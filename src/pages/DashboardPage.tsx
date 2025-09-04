import React, { useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { motion } from 'framer-motion';
import { 
  FileText, 
  Upload, 
  Crown, 
  File, 
  FileUp,
  X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Mock data - in real app this would come from your backend




const DashboardPage: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [showRedactOptions, setShowRedactOptions] = useState(false);





  return (
    <div className="min-h-screen pt-16 bg-gray-50">
      <div className="container-custom py-12">
        {/* Welcome Header */}
        <motion.div
          className="mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            Welcome back, {user?.firstName || 'User'}!
          </h1>
          <p className="text-lg text-gray-600">
            Manage your redaction projects and monitor your usage below.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Quick Actions */}
            <motion.div
              className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                <button 
                  onClick={() => setShowRedactOptions(true)}
                  className="btn-primary flex items-center justify-center space-x-2 flex-1"
                >
                  <Upload className="w-5 h-5" />
                  <span>Redact Document</span>
                </button>
                <button 
                  onClick={() => window.location.href = '/pricing'}
                  className="btn-secondary flex items-center justify-center space-x-2 flex-1"
                >
                  <Crown className="w-5 h-5" />
                  <span>Upgrade Plan</span>
                </button>
              </div>
            </motion.div>


          </div>

          {/* Sidebar */}
          <div className="space-y-8">





          </div>
        </div>


      </div>
    </div>
  );
};

export default DashboardPage;

        {/* Redact Document Options Modal */}
        {showRedactOptions && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              className="bg-white rounded-2xl p-8 max-w-md w-full"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Redact Document</h2>
                <button onClick={() => setShowRedactOptions(false)} className="text-gray-500 hover:text-gray-700">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <button 
                  onClick={() => navigate("/pdf")}
                  className="flex items-center space-x-4 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <FileText className="w-8 h-8 text-red-500" />
                  <span className="text-lg font-medium text-gray-800">PDF Document</span>
                </button>
                <button 
                  onClick={() => navigate("/docs")}
                  className="flex items-center space-x-4 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <FileUp className="w-8 h-8 text-blue-500" />
                  <span className="text-lg font-medium text-gray-800">Word Document</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
