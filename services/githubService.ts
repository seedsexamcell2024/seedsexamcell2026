
import { GitHubConfig } from '../types';

/**
 * SEEDS GitHub Mirror & Deployment Engine (v5.0)
 * Optimized for automatic source-to-server mirroring and zero-config execution.
 */

const BASE_URL = 'https://api.github.com';

const encodeBase64 = (str: string) => {
  return btoa(unescape(encodeURIComponent(str)));
};

export const getGitHubPreviewUrl = (config: GitHubConfig): string => {
  if (!config.owner || !config.repo) return '';
  // Construct the professional GitHub Pages execution URL
  const domain = config.owner.toLowerCase().endsWith('.github.io') ? config.owner : `${config.owner}.github.io`;
  const repoPath = config.owner.toLowerCase().endsWith('.github.io') ? '' : `/${config.repo}`;
  return `https://${domain}${repoPath}/SEEDS/`;
};

/**
 * Pushes a single file to the SEEDS cluster on GitHub.
 */
export const pushToGitHub = async (config: GitHubConfig, path: string, content: string): Promise<boolean> => {
  if (!config.isEnabled || !config.token || !config.owner || !config.repo) return false;

  const deploymentPath = `SEEDS/${path}`;
  const url = `${BASE_URL}/repos/${config.owner}/${config.repo}/contents/${deploymentPath}?ref=${config.branch}`;
  
  try {
    let sha: string | null = null;
    const getResponse = await fetch(url, {
      headers: {
        'Authorization': `token ${config.token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (getResponse.ok) {
      const fileData = await getResponse.json();
      sha = fileData.sha;
    }

    const putResponse = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${config.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `[SEEDS CLUSTER SYNC] ${path} updated at ${new Date().toISOString()}`,
        content: encodeBase64(content),
        sha: sha || undefined,
        branch: config.branch
      })
    });

    return putResponse.ok;
  } catch (e) {
    console.error(`Mirroring Error [${path}]:`, e);
    return false;
  }
};

/**
 * Mirroring Engine: Deploys the static shell and logic files to GitHub.
 */
export const deployFullInstitutionalSoftware = async (config: GitHubConfig): Promise<boolean> => {
    if (!config.isConnected) return false;
    
    try {
        const filesToMirror = [
            './index.html',
            './index.tsx',
            './App.tsx',
            './types.ts',
            './config.ts',
            './metadata.json'
        ];

        const results = await Promise.all(filesToMirror.map(async (filePath) => {
            const response = await fetch(filePath);
            if (!response.ok) return false;
            const content = await response.text();
            const fileName = filePath.replace('./', '');
            return await pushToGitHub(config, fileName, content);
        }));

        return results.every(r => r === true);
    } catch (e) {
        console.error("Institutional Mirroring Protocol Failed:", e);
        return false;
    }
};

export const fetchFromGitHub = async (config: GitHubConfig, path: string): Promise<any | null> => {
  if (!config.owner || !config.repo) return null;
  const url = `https://raw.githubusercontent.com/${config.owner}/${config.repo}/${config.branch}/SEEDS/${path}?t=${Date.now()}`;
  try {
    const response = await fetch(url);
    if (response.ok) return await response.json();
  } catch (e) {
    console.warn("High-Speed Mirror Fetch Failure:", e);
  }
  return null;
};
