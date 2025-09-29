import { PersonCategory } from '../types';

export const generateBio = async (
  firstName: string,
  lastName: string,
  category: PersonCategory,
  roleOrClass: string
): Promise<string> => {
  const response = await fetch('/api/generate-bio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firstName, lastName, category, roleOrClass }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: 'Failed to generate bio' }));
    throw new Error(errorBody.error || 'An unknown error occurred while generating bio.');
  }
  
  const { bio } = await response.json();
  return bio;
};
