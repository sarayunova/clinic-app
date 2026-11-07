import React from 'react';
import { Link } from 'react-router-dom';
import { ImmunizationRecallDashboard } from '../components/ImmunizationRecallDashboard';

export function ImmunizationRecallPage() {
  return (
    <div className="page stack space-y-6" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem' }}>
      <div className="flex items-center justify-between">
        <div>
          <Link to="/patients" className="text-sm text-blue-600 hover:underline font-medium">
            ← Back to Patients Directory
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">
            Clinic-Wide Pediatric Immunization Recall &amp; WhatsApp Center
          </h1>
        </div>
      </div>

      <ImmunizationRecallDashboard />
    </div>
  );
}
