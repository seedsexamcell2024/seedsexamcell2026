
import React from 'react';

/**
 * SEEDS AI CORE - Virtual Assistant
 * Restricted by Role and fullscreen environment settings
 */
const VirtualAssistant = () => {
  const userRole = localStorage.getItem('session_role');
  
  // Explicitly hide for Staff/Teachers as per professional requirements
  if (userRole === 'TEACHER') {
    return null;
  }

  // Currently disabled for all in fullscreen production mode
  return null;
};

export default VirtualAssistant;
