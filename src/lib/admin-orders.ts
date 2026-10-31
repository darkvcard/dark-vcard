// Pure helpers behind the admin orders table so filtering by customer email or
// TXID can be unit tested without rendering the table.

export type OrderStatusFilter = "all" | "pending" | "pending_approval" | "completed" | "failed";

export type SearchableOrder = {
  id: string;
  user_id: string;
  status: string;
  txid?: string | null;
  transaction_hash?: string | null;
};

export type EmailLookup = Record<string, string | null | undefined>;

/** Email of the customer who placed the order, if the admin lookup found one. */
export function customerEmail(
  order: Pick<SearchableOrder, "user_id">,
  emails: EmailLookup,
): string {
  return emails[order.user_id] ?? "";
}

/**
 * Filters admin orders by status tab and by a free-text search that matches the
 * customer email, the submitted TXID, the stored transaction hash or the order id.
 */
export function filterAdminOrders<T extends SearchableOrder>(
  orders: readonly T[],
  { status, search, emails }: { status: OrderStatusFilter; search: string; emails: EmailLookup },
): T[] {
  const query = search.trim().toLowerCase();
  return orders.filter((order) => {
    // The "to review" tab holds everything an admin still has to act on: orders
    // the old flow moved to `pending_approval`, plus new checkout submissions
    // that stay `pending` but already carry a TXID.
    if (status === "pending_approval") {
      const needsReview =
        order.status === "pending_approval" || (order.status === "pending" && !!order.txid);
      if (!needsReview) return false;
    } else if (status !== "all" && order.status !== status) return false;
    if (!query) return true;
    return [
      customerEmail(order, emails),
      order.txid ?? "",
      order.transaction_hash ?? "",
      order.id,
    ].some((value) => value.toLowerCase().includes(query));
  });
}
