import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const cardsQuery = queryOptions({
  queryKey: ["cards"],
  queryFn: async () => {
    const { data, error } = await supabase.from("cards").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});
