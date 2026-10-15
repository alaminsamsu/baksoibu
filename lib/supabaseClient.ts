import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uafhfbbphzpzpuqsfuja.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZmhmYmJwaHpwenB1cXNmdWphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5NjY1NDQsImV4cCI6MjEwNzU0MjU0NH0.Hdi8A0Y82iFXWKbEFGH8LYitYc_W0y-GZO01y9zFYX8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
