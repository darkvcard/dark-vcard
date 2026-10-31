import { describe, expect, it } from "vitest";

import { customerEmail, filterAdminOrders, type SearchableOrder } from "@/lib/admin-orders";

const emails = {
  "user-1": "alice@example.com",
  "user-2": "bob@example.com",
};

const orders: SearchableOrder[] = [
  {
    id: "order-1",
    user_id: "user-1",
    status: "pending_approval",
    txid: "0xAAA111",
    transaction_hash: "0xAAA111",
  },
  {
    id: "order-2",
    user_id: "user-2",
    status: "pending",
    txid: null,
    transaction_hash: "awaiting-payment:order-2",
  },
  {
    id: "order-3",
    user_id: "user-1",
    status: "completed",
    txid: "5VERv8NMvzb",
    transaction_hash: "5VERv8NMvzb",
  },
  {
    id: "order-4",
    user_id: "user-3",
    status: "pending",
    txid: "0xBBB222",
    transaction_hash: "0xBBB222",
  },
];

describe("Admin orders filtering", () => {
  it("joins each order with the customer email from the admin lookup", () => {
    expect(customerEmail(orders[0]!, emails)).toBe("alice@example.com");
    expect(customerEmail({ user_id: "unknown" }, emails)).toBe("");
  });

  it("finds orders by customer email regardless of case", () => {
    expect(
      filterAdminOrders(orders, { status: "all", search: "BOB@example.com", emails }).map(
        (o) => o.id,
      ),
    ).toEqual(["order-2"]);
  });

  it("finds orders by TXID", () => {
    expect(
      filterAdminOrders(orders, { status: "all", search: "5verv8", emails }).map((o) => o.id),
    ).toEqual(["order-3"]);
    expect(
      filterAdminOrders(orders, { status: "all", search: "0xaaa", emails }).map((o) => o.id),
    ).toEqual(["order-1"]);
  });

  it("keeps the status tab filter while searching", () => {
    expect(
      filterAdminOrders(orders, { status: "completed", search: "alice", emails }).map((o) => o.id),
    ).toEqual(["order-3"]);
    expect(filterAdminOrders(orders, { status: "pending", search: "alice", emails })).toEqual([]);
  });

  it("puts every submitted TXID in the review tab, whatever the stored status", () => {
    expect(
      filterAdminOrders(orders, { status: "pending_approval", search: "", emails }).map(
        (o) => o.id,
      ),
    ).toEqual(["order-1", "order-4"]);
    expect(
      filterAdminOrders(orders, { status: "pending", search: "", emails }).map((o) => o.id),
    ).toEqual(["order-2", "order-4"]);
  });

  it("returns every order in the current status tab when the search box is empty", () => {
    expect(filterAdminOrders(orders, { status: "all", search: "   ", emails })).toHaveLength(4);
    expect(
      filterAdminOrders(orders, { status: "pending", search: "", emails }).map((o) => o.id),
    ).toEqual(["order-2", "order-4"]);
  });
});
