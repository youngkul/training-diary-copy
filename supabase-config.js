import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://chyfkizuxorfgxdoqlxd.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoeWZraXp1eG9yZmd4ZG9xbHhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYzNzI2MTAsImV4cCI6MjA2MTk0ODYxMH0.oGd7OTxHc6Gp8EYY_Akl8BwG6574zxvblPaYPiYviXA";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

