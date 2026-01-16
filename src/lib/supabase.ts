import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";

export type { Session, User };

export const signUp = async (email: string, password: string) => {
  const redirectUrl = `${window.location.origin}/facturacion`;

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectUrl,
    },
  });

  return { error };
};

export const signIn = async (email: string, password: string) => {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  return { error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getSession = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
};
