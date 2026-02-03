
import { SchoolConfig } from './types';

/**
 * SEEDS PERMANENT INSTITUTIONAL CONFIGURATION
 * Hard-coded identity for seedsexamcell2024@gmail.com
 */
export const PERMANENT_CONFIG: SchoolConfig = {
  name: 'SEEDS School of Excellence',
  monogram: 'https://www.seedsschool.edu.pk/wp-content/uploads/2021/09/seeds-logo-green.png', 
  developerPhoto: 'https://i.ibb.co/S7V6NfD/IMG-20240212-WA0001.jpg', 
  address: 'School Of Excellence in Education and Development Studies',
  email: 'seedsexamcell2024@gmail.com',
  terms: ['1st', '2nd'],
  
  // PRIMARY CLOUD ENDPOINT - This should be updated after setting up the script on seedsexamcell2024@gmail.com
  deploymentUrl: 'https://script.google.com/macros/s/AKfycbyFB6z4Jja5rlWUO0mxMvMbRqJlENkcS5nPAsSKYuOFG2FZxVgNzj12iSkfupTEWzyd9A/exec'
};

export const getCloudUrl = () => {
  const storedUrl = localStorage.getItem('seeds_cloud_url');
  if (storedUrl && storedUrl.startsWith('https://script.google.com')) {
    return storedUrl.trim();
  }
  return (PERMANENT_CONFIG.deploymentUrl || '').trim();
};

export const setCloudUrl = (url: string) => {
  if (url && url.startsWith('https://script.google.com')) {
    const cleanUrl = url.trim().split('?')[0];
    localStorage.setItem('seeds_cloud_url', cleanUrl);
    // Force a fresh sync on next boot
    localStorage.removeItem('last_sync_timestamp');
  }
};
