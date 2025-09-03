import React from 'react';
import { motion } from 'framer-motion';
import { PricingTable } from '@clerk/clerk-react';
import { Shield, Zap, Star } from 'lucide-react';

const PricingPage: React.FC = () => {
  return (
    <div className="pt-16">
      {/* Header */}
      <section className="section-padding bg-gradient-to-br from-purple-50 via-blue-50 to-gray-50">
        <div className="container-custom text-center">
          <motion.h1
            className="text-4xl md:text-6xl font-bold text-gray-900 mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            Simple, transparent{' '}
            <span className="gradient-text">pricing</span>
          </motion.h1>
          
          <motion.p
            className="text-xl text-gray-600 mb-12 max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Choose the perfect plan for your document redaction needs. Start free and upgrade anytime.
          </motion.p>
        </div>
      </section>

      {/* Clerk Pricing Table */}
      <section className="py-20 bg-white">
        <div className="container-custom">
          <motion.div
            className="max-w-7xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <PricingTable />
          </motion.div>

          {/* FAQ Preview */}
          <motion.div
            className="mt-20 max-w-3xl mx-auto text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h3 className="text-2xl font-bold text-gray-900 mb-6">
              Questions about our plans?
            </h3>
            <p className="text-gray-600 mb-8">
              All plans include bank-level security, compliance features, and 24/7 uptime monitoring.
            </p>
            <div className="flex flex-wrap justify-center space-x-8">
              <div className="flex items-center space-x-2 text-gray-600">
                <Shield className="w-5 h-5 text-green-500" />
                <span>SOC 2 Compliant</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-600">
                <Zap className="w-5 h-5 text-yellow-500" />
                <span>99.9% Uptime</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-600">
                <Star className="w-5 h-5 text-purple-500" />
                <span>4.9/5 Rating</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default PricingPage;
