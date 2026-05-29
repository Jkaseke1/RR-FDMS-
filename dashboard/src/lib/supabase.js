import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://tgqekxawvnlwdjingonh.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRncWVreGF3dm5sd2RqaW5nb25oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNzg2NjIsImV4cCI6MjA5NDg1NDY2Mn0.7qQx53zzEQ9vGRaI81M2M7JfRhBWjzts93ckzUXvwRI';

let client;
if (supabaseUrl && supabaseKey) {
  client = createClient(supabaseUrl, supabaseKey);
} else {
  const emptyResult = { data: [], error: null };
  const nullResult = { data: null, error: null };

  function makeChain(result) {
    return {
      select: () => makeChain(emptyResult),
      order: () => makeChain(emptyResult),
      eq: () => makeChain(emptyResult),
      ilike: () => makeChain(emptyResult),
      limit: () => makeChain(emptyResult),
      single: () => makeChain(nullResult),
      then: (onResolve, onReject) => Promise.resolve(result).then(onResolve, onReject),
      catch: (onReject) => Promise.resolve(result).catch(onReject),
    };
  }

  client = {
    from: () => makeChain(emptyResult),
  };
  console.warn('Supabase not configured — add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file');
}

export const supabase = client;
