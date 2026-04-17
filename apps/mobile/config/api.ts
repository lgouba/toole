/**
 * Configuration API - URL du backend
 *
 * En production : https://api.tolle.qalitylabs.fr
 * En dev local : remplacer par l'IP locale de votre Mac (ex: http://192.168.1.10:3000)
 */

// Priorite : variable d'env > production par defaut
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'https://api.tolle.qalitylabs.fr';

export const SOCKET_URL = API_BASE_URL;
